const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

console.log('🚀 Starting Multi-Room Bunker Game Server...');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// === СИСТЕМА КОМНАТ ===

const gameRooms = new Map(); // Хранилище комнат

class GameRoom {
    constructor(roomCode, hostId, hostName, maxPlayers = 8) {
        this.roomCode = roomCode;
        this.players = [];
        this.gameState = 'lobby';
        this.maxPlayers = maxPlayers;
        this.gamePhase = 'waiting';
        this.currentRound = 1;
        this.maxRounds = 3;
        this.timer = null;
        this.timeLeft = 0;
        this.votingResults = {};
        this.revealedThisRound = 0;
        this.currentTurnPlayer = null;
        this.playersWhoRevealed = [];
        this.totalVotes = 0;
        this.skipDiscussionVotes = [];
        this.justificationQueue = [];
        this.currentJustifyingPlayer = null;
        this.justificationPhase = 1;
        this.canChangeVote = {};
        this.startRoundVotes = [];
        this.activeEffects = {};
        this.pendingEliminationNextRound = false;
        this.eliminateTopVotersNextRound = false;
        this.createdAt = new Date();
        
        // Добавляем хоста как первого игрока
        this.addPlayer(hostId, hostName, true);
    }
    
    addPlayer(socketId, playerName, isHost = false) {
        const player = {
            id: socketId,
            name: playerName,
            isAlive: true,
            isHost: isHost,
            votes: 0,
            hasVoted: false,
            votedFor: null,
            hasRevealed: false,
            cardsRevealedThisRound: 0,
            revealedCharacteristics: [],
            characteristics: null,
            actionCards: []
        };
        
        this.players.push(player);
        return player;
    }
    
    removePlayer(socketId) {
        const playerIndex = this.players.findIndex(p => p.id === socketId);
        if (playerIndex !== -1) {
            const removedPlayer = this.players.splice(playerIndex, 1)[0];
            
            // Если хост ушел, назначаем нового хоста
            if (removedPlayer.isHost && this.players.length > 0) {
                this.players[0].isHost = true;
            }
            
            return removedPlayer;
        }
        return null;
    }
    
    getPlayer(socketId) {
        return this.players.find(p => p.id === socketId);
    }
    
    isEmpty() {
        return this.players.length === 0;
    }
    
    isFull() {
        return this.players.length >= this.maxPlayers;
    }
    
    // Очистка ресурсов комнаты
    cleanup() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
}

// Функция генерации уникального кода комнаты
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Проверяем уникальность
    if (gameRooms.has(result)) {
        return generateRoomCode(); // Рекурсивно генерируем новый код
    }
    
    return result;
}

// Функция получения URL для комнаты
function getRoomLink(roomCode) {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    return `${baseUrl}/${roomCode}`;
}

// Статические файлы
app.use(express.static(__dirname));

// Главная страница и страницы комнат
app.get('/', (req, res) => {
    console.log('📄 Serving main page');
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/:roomCode', (req, res) => {
    const roomCode = req.params.roomCode.toUpperCase();
    console.log('📄 Serving room page for:', roomCode);
    
    // Проверяем, существует ли комната
    if (roomCode.length === 6 && gameRooms.has(roomCode)) {
        res.sendFile(path.join(__dirname, 'index.html'));
    } else {
        // Если комната не существует, перенаправляем на главную
        res.redirect('/');
    }
});

// API для здоровья сервера
app.get('/api/health', (req, res) => {
    try {
        const totalPlayers = Array.from(gameRooms.values()).reduce((sum, room) => sum + room.players.length, 0);
        
        res.json({ 
            status: 'OK', 
            timestamp: new Date().toISOString(),
            rooms: gameRooms.size,
            totalPlayers: totalPlayers,
            connections: io.engine ? io.engine.clientsCount : 0,
            uptime: process.uptime(),
            memory: process.memoryUsage()
        });
    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({ 
            status: 'ERROR', 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// === ОБРАБОТЧИКИ ПОДКЛЮЧЕНИЙ ===

io.on('connection', (socket) => {
    console.log('🔗 New connection:', socket.id);
    
    let currentRoom = null;
    
    // Создание новой комнаты
    socket.on('create-room', (data) => {
        console.log('🆕 Creating room for:', data.playerName, 'Socket:', socket.id);
        
        const playerName = data.playerName?.trim();
        
        if (!playerName || playerName.length < 2 || playerName.length > 20) {
            socket.emit('error', 'Неверное имя игрока');
            return;
        }
        
        try {
            const roomCode = generateRoomCode();
            const room = new GameRoom(roomCode, socket.id, playerName);
            
            gameRooms.set(roomCode, room);
            currentRoom = room;
            
            socket.join(roomCode);
            
            console.log('✅ Room created:', roomCode, 'Host:', playerName);
            
            socket.emit('room-created', {
                roomCode: roomCode,
                roomLink: getRoomLink(roomCode),
                playerId: socket.id,
                playerName: playerName,
                isHost: true,
                maxPlayers: room.maxPlayers,
                players: room.players
            });
            
        } catch (error) {
            console.error('❌ Error creating room:', error);
            socket.emit('error', 'Ошибка создания комнаты');
        }
    });
    
    // Присоединение к существующей комнате
    socket.on('join-room', (data) => {
        console.log('🚪 Joining room:', data.roomCode, 'Player:', data.playerName, 'Socket:', socket.id);
        
        const playerName = data.playerName?.trim();
        const roomCode = data.roomCode?.trim().toUpperCase();
        
        if (!playerName || playerName.length < 2 || playerName.length > 20) {
            socket.emit('error', 'Неверное имя игрока');
            return;
        }
        
        if (!roomCode || roomCode.length !== 6) {
            socket.emit('error', 'Неверный код комнаты');
            return;
        }
        
        const room = gameRooms.get(roomCode);
        if (!room) {
            socket.emit('error', 'Комната не найдена');
            return;
        }
        
        if (room.isFull()) {
            socket.emit('error', 'Комната заполнена');
            return;
        }
        
        // Проверяем, нет ли игрока с таким именем
        const existingPlayer = room.players.find(p => 
            p.name.toLowerCase() === playerName.toLowerCase() && 
            p.id !== socket.id
        );
        
        if (existingPlayer) {
            socket.emit('error', 'Игрок с таким именем уже есть в комнате');
            return;
        }
        
        try {
            // Удаляем игрока из предыдущей комнаты если он там был
            if (currentRoom && currentRoom !== room) {
                currentRoom.removePlayer(socket.id);
                socket.leave(currentRoom.roomCode);
            }
            
            room.addPlayer(socket.id, playerName);
            currentRoom = room;
            
            socket.join(roomCode);
            
            console.log('✅ Player joined room:', roomCode, 'Player:', playerName);
            
            socket.emit('room-joined', {
                roomCode: roomCode,
                roomLink: getRoomLink(roomCode),
                playerId: socket.id,
                playerName: playerName,
                isHost: false,
                maxPlayers: room.maxPlayers,
                players: room.players
            });
            
            // Уведомляем всех в комнате о новом игроке
            socket.to(roomCode).emit('player-joined', {
                players: room.players,
                maxPlayers: room.maxPlayers,
                gameState: room.gameState
            });
            
        } catch (error) {
            console.error('❌ Error joining room:', error);
            socket.emit('error', 'Ошибка присоединения к комнате');
        }
    });
    
    // Покидание комнаты
    socket.on('leave-room', () => {
        console.log('🚪 Player leaving room:', socket.id);
        
        if (currentRoom) {
            const removedPlayer = currentRoom.removePlayer(socket.id);
            if (removedPlayer) {
                console.log('👋 Player left room:', currentRoom.roomCode, 'Player:', removedPlayer.name);
                
                socket.leave(currentRoom.roomCode);
                
                // Уведомляем остальных игроков
                const newHost = currentRoom.players.find(p => p.isHost);
                socket.to(currentRoom.roomCode).emit('player-left', {
                    players: currentRoom.players,
                    gameState: currentRoom.gameState,
                    newHost: newHost ? newHost.id : null
                });
                
                // Если комната пуста, удаляем её
                if (currentRoom.isEmpty()) {
                    console.log('🗑️ Removing empty room:', currentRoom.roomCode);
                    currentRoom.cleanup();
                    gameRooms.delete(currentRoom.roomCode);
                } else if (currentRoom.gameState === 'playing' && currentRoom.players.length < 2) {
                    // Если игра идет и игроков меньше 2, сбрасываем игру
                    resetGameInRoom(currentRoom);
                }
                
                currentRoom = null;
            }
        }
    });
    
    // Отключение игрока
    socket.on('disconnect', () => {
        console.log('❌ Player disconnected:', socket.id);
        
        if (currentRoom) {
            const removedPlayer = currentRoom.removePlayer(socket.id);
            if (removedPlayer) {
                console.log('👋 Player disconnected from room:', currentRoom.roomCode, 'Player:', removedPlayer.name);
                
                // Уведомляем остальных игроков
                const newHost = currentRoom.players.find(p => p.isHost);
                socket.to(currentRoom.roomCode).emit('player-left', {
                    players: currentRoom.players,
                    gameState: currentRoom.gameState,
                    newHost: newHost ? newHost.id : null
                });
                
                // Если комната пуста, удаляем её
                if (currentRoom.isEmpty()) {
                    console.log('🗑️ Removing empty room:', currentRoom.roomCode);
                    currentRoom.cleanup();
                    gameRooms.delete(currentRoom.roomCode);
                } else if (currentRoom.gameState === 'playing' && currentRoom.players.length < 2) {
                    // Если игра идет и игроков меньше 2, сбрасываем игру
                    resetGameInRoom(currentRoom);
                }
            }
        }
    });
    
    // === ИГРОВЫЕ ОБРАБОТЧИКИ ===
    
    // Изменение максимального количества игроков
    socket.on('change-max-players', (data) => {
        if (!currentRoom) {
            socket.emit('error', 'Вы не в комнате!');
            return;
        }
        
        const player = currentRoom.getPlayer(socket.id);
        if (!player || !player.isHost) {
            socket.emit('error', 'Только хост может изменять настройки!');
            return;
        }
        
        if (currentRoom.gameState !== 'lobby') {
            socket.emit('error', 'Нельзя изменять настройки во время игры!');
            return;
        }
        
        const newMaxPlayers = parseInt(data.maxPlayers);
        if (newMaxPlayers < 2 || newMaxPlayers > 16) {
            socket.emit('error', 'Неверное количество игроков!');
            return;
        }
        
        if (newMaxPlayers < currentRoom.players.length) {
            socket.emit('error', 'Нельзя установить лимит меньше текущего количества игроков!');
            return;
        }
        
        currentRoom.maxPlayers = newMaxPlayers;
        
        console.log('🔧 Max players changed in room:', currentRoom.roomCode, 'to:', newMaxPlayers);
        
        io.to(currentRoom.roomCode).emit('max-players-changed', {
            maxPlayers: currentRoom.maxPlayers,
            players: currentRoom.players
        });
    });
    
    // Начало игры
    socket.on('start-game', () => {
        console.log('🎮 Game start requested in room:', currentRoom?.roomCode, 'by:', socket.id);
        
        if (!currentRoom) {
            socket.emit('error', 'Вы не в комнате!');
            return;
        }
        
        const player = currentRoom.getPlayer(socket.id);
        if (!player || !player.isHost) {
            socket.emit('error', 'Только хост может начать игру!');
            return;
        }
        
        if (currentRoom.players.length < 2) {
            socket.emit('error', 'Для начала игры нужно минимум 2 игрока!');
            return;
        }
        
        if (currentRoom.gameState !== 'lobby') {
            socket.emit('error', 'Игра уже идет!');
            return;
        }
        
        startGameInRoom(currentRoom);
    });
    
    // Остальные игровые обработчики (копируем из оригинального server.js)
    // reveal-characteristic, vote-player, start-round, и т.д.
    
});

// === ФУНКЦИИ УПРАВЛЕНИЯ ИГРОЙ ===

function startGameInRoom(room) {
    try {
        console.log('🚀 Starting game in room:', room.roomCode);
        
        // Генерируем характеристики для всех игроков
        room.players.forEach(player => {
            player.characteristics = generateCharacteristics();
            player.actionCards = [getRandomActionCard()];
            player.hasRevealed = false;
            player.hasVoted = false;
            player.revealedCharacteristics = [];
            player.cardsRevealedThisRound = 0;
        });
        
        room.gameState = 'playing';
        room.gamePhase = 'preparation';
        room.currentRound = 1;
        room.timeLeft = 0;
        room.playersWhoRevealed = [];
        room.currentTurnPlayer = null;
        
        const randomStory = stories[Math.floor(Math.random() * stories.length)];
        
        console.log('🚀 Game started in room:', room.roomCode, 'Players:', room.players.length);
        
        io.to(room.roomCode).emit('game-started', {
            players: room.players,
            gameState: room.gameState,
            gamePhase: room.gamePhase,
            currentRound: room.currentRound,
            timeLeft: room.timeLeft,
            story: randomStory
        });
        
    } catch (error) {
        console.error('❌ Error starting game in room:', room.roomCode, error);
    }
}

function resetGameInRoom(room) {
    try {
        console.log('🔄 Resetting game in room:', room.roomCode);
        
        if (room.timer) {
            clearInterval(room.timer);
            room.timer = null;
        }
        
        // Сбрасываем состояние игроков
        room.players.forEach((player) => {
            player.isAlive = true;
            player.votes = 0;
            player.hasRevealed = false;
            player.hasVoted = false;
            player.votedFor = null;
            player.cardsRevealedThisRound = 0;
            player.revealedCharacteristics = [];
            player.characteristics = null;
            player.actionCards = [];
        });
        
        // Сбрасываем состояние комнаты
        room.gameState = 'lobby';
        room.gamePhase = 'waiting';
        room.currentRound = 1;
        room.timer = null;
        room.timeLeft = 0;
        room.votingResults = {};
        room.revealedThisRound = 0;
        room.currentTurnPlayer = null;
        room.playersWhoRevealed = [];
        room.totalVotes = 0;
        room.skipDiscussionVotes = [];
        room.justificationQueue = [];
        room.currentJustifyingPlayer = null;
        room.canChangeVote = {};
        room.startRoundVotes = [];
        room.activeEffects = {};
        room.pendingEliminationNextRound = false;
        room.eliminateTopVotersNextRound = false;
        
        io.to(room.roomCode).emit('game-reset', {
            players: room.players,
            gameState: room.gameState
        });
        
    } catch (error) {
        console.error('❌ Error resetting game in room:', room.roomCode, error);
    }
}

// Периодическая очистка пустых комнат
setInterval(() => {
    const emptyRooms = [];
    for (const [roomCode, room] of gameRooms) {
        if (room.isEmpty()) {
            emptyRooms.push(roomCode);
        }
    }
    
    emptyRooms.forEach(roomCode => {
        const room = gameRooms.get(roomCode);
        if (room) {
            room.cleanup();
            gameRooms.delete(roomCode);
            console.log('🗑️ Cleaned up empty room:', roomCode);
        }
    });
    
    if (emptyRooms.length > 0) {
        console.log('🧹 Cleaned up', emptyRooms.length, 'empty rooms');
    }
}, 60000); // Каждую минуту

// Логирование статистики каждые 5 минут
setInterval(() => {
    const totalPlayers = Array.from(gameRooms.values()).reduce((sum, room) => sum + room.players.length, 0);
    console.log('📊 Server stats: Rooms:', gameRooms.size, 'Total players:', totalPlayers);
}, 300000);

// === ИГРОВЫЕ КОНСТАНТЫ И ФУНКЦИИ (копируем из оригинального server.js) ===

const actionCards = [
    { 
        id: 1, 
        name: "Двойной голос", 
        description: "Ваш голос считается за два во время голосования. Нужно активировать ДО голосования.", 
        type: "voting", 
        usesLeft: 1,
        icon: "🗳️"
    },
    { 
        id: 2, 
        name: "Детектив", 
        description: "Узнайте одну скрытую характеристику любого игрока", 
        type: "investigative", 
        usesLeft: 1,
        icon: "🔍"
    },
    { 
        id: 3, 
        name: "Защитник", 
        description: "Спасите одного игрока от исключения (включая себя)", 
        type: "protective", 
        usesLeft: 1,
        icon: "🛡️"
    },
    { 
        id: 4, 
        name: "Анонимный голос", 
        description: "Ваш голос не будет показан другим игрокам", 
        type: "stealth", 
        usesLeft: 1,
        icon: "👤"
    },
    { 
        id: 5, 
        name: "Блокировщик", 
        description: "Заблокируйте использование карты действия другого игрока", 
        type: "disruptive", 
        usesLeft: 1,
        icon: "🚫"
    },
    { 
        id: 6, 
        name: "Лидер", 
        description: "Принудительно начните следующую фазу игры", 
        type: "control", 
        usesLeft: 1,
        icon: "👑"
    }
];

const professions = [
    'Врач', 'Учитель', 'Инженер', 'Повар', 'Полицейский', 'Пожарный',
    'Программист', 'Архитектор', 'Электрик', 'Сантехник', 'Механик',
    'Фермер', 'Ветеринар', 'Психолог', 'Журналист', 'Художник',
    'Музыкант', 'Актер', 'Танцор', 'Писатель', 'Библиотекарь',
    'Продавец', 'Бухгалтер', 'Юрист', 'Судья', 'Военный',
    'Пилот', 'Стюардесса', 'Водитель', 'Почтальон', 'Охранник'
];

const healthConditions = [
    'Здоров', 'Близорукость', 'Астма', 'Диабет', 'Аллергия на орехи',
    'Гипертония', 'Артрит', 'Мигрень', 'Бессонница', 'Депрессия',
    'Тревожность', 'Спортивная травма', 'Операция на сердце', 'Протез ноги',
    'Слуховой аппарат', 'Хроническая боль в спине', 'Эпилепсия',
    'Анемия', 'Плохая координация', 'Быстрая утомляемость'
];

const hobbies = [
    'Чтение', 'Спорт', 'Готовка', 'Рисование', 'Музыка', 'Танцы',
    'Фотография', 'Садоводство', 'Рыбалка', 'Охота', 'Путешествия',
    'Коллекционирование', 'Вязание', 'Шахматы', 'Видеоигры', 'Кино',
    'Театр', 'Астрономия', 'Геология', 'Археология', 'История',
    'Языки', 'Программирование', 'Робототехника', 'Моделирование',
    'Скалолазание', 'Парашютный спорт', 'Дайвинг', 'Серфинг', 'Йога'
];

const phobias = [
    'Арахнофобия (пауки)', 'Клаустрофобия (замкнутые пространства)', 
    'Акрофобия (высота)', 'Аэрофобия (полеты)', 'Аквафобия (вода)',
    'Социофобия (люди)', 'Агорафобия (открытые пространства)',
    'Никтофобия (темнота)', 'Офидиофобия (змеи)', 'Кинофобия (собаки)',
    'Мизофобия (грязь)', 'Гемофобия (кровь)', 'Танатофобия (смерть)',
    'Автофобия (одиночество)', 'Фонофобия (громкие звуки)',
    'Пирофобия (огонь)', 'Трипофобия (дырки)', 'Энтомофобия (насекомые)',
    'Метеорофобия (погода)', 'Ксенофобия (незнакомцы)'
];

const baggage = [
    'Рюкзак с едой', 'Медицинская аптечка', 'Набор инструментов',
    'Спальный мешок', 'Палатка', 'Фонарик с батарейками',
    'Радиоприемник', 'Компас и карты', 'Веревка 50м', 'Нож',
    'Зажигалка', 'Спички водостойкие', 'Консервы', 'Вода 10л',
    'Одеяло', 'Запасная одежда', 'Книги', 'Игральные карты',
    'Музыкальный инструмент', 'Фотоаппарат', 'Документы',
    'Деньги', 'Украшения', 'Семейные фото', 'Оружие',
    'Алкоголь', 'Сигареты', 'Лекарства', 'Семена растений', 'Удочка'
];

const facts = [
    'Служил в армии', 'Знает боевые искусства', 'Умеет готовить',
    'Говорит на 3 языках', 'Имеет водительские права', 'Умеет шить',
    'Знает первую помощь', 'Умеет чинить технику', 'Хорошо стреляет',
    'Умеет выживать в дикой природе', 'Знает психологию', 'Умеет петь',
    'Хорошо танцует', 'Умеет играть на инструменте', 'Знает историю',
    'Умеет считать быстро', 'Хорошая память', 'Знает географию',
    'Умеет рисовать карты', 'Знает астрономию', 'Умеет предсказывать погоду',
    'Хорошо ориентируется', 'Умеет лазить по деревьям', 'Быстро бегает',
    'Сильные руки', 'Хорошее зрение', 'Острый слух', 'Чувствует опасность',
    'Умеет убеждать людей', 'Хороший лидер'
];

const roundMessages = [
    "Внимание! Сейчас начнется новый раунд.",
    "Подготовьтесь к следующему этапу!",
    "Скоро будет важное событие...",
    "У вас есть время обсудить стратегию.",
    "Следующий раунд может изменить всё!"
];

const stories = [
  "В 2050 году человечество столкнулось с глобальной катастрофой. Земля оказалась под угрозой вымирания, и выжившие были вынуждены искать убежище в подземных бункерах. Вы — один из тех, кому удалось спастись.",
  "После разрушительной войны большая часть планеты стала непригодной для жизни. Группа людей собирается вместе, чтобы выжить в новом мире, где каждое решение может стать последним.",
  "Вирус, вырвавшийся из секретной лаборатории, уничтожил большую часть населения. Теперь спасшиеся должны не только бороться с болезнью, но и защищать ограниченные ресурсы.",
  // ... добавьте еще варианты историй, длиной 250-500 символов
];

function startRound() {
  // ... ваш другой код для старта раунда

  const randomStory = stories[Math.floor(Math.random() * stories.length)];
  io.emit('showStory', randomStory);
}

function onStartRound() {
    const message = roundMessages[Math.floor(Math.random() * roundMessages.length)];
    // Отправьте сообщение ВСЕМ клиентам
    io.emit('roundMessage', message);
}

// Статические файлы
app.use(express.static(__dirname));

// Главная страница
app.get('/', (req, res) => {
    console.log('📄 Serving main page');
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API для здоровья сервера
app.get('/api/health', (req, res) => {
    try {
        const totalPlayers = Array.from(gameRooms.values()).reduce((sum, room) => sum + room.players.length, 0);
        
        res.json({ 
            status: 'OK', 
            timestamp: new Date().toISOString(),
            rooms: gameRooms.size,
            totalPlayers: totalPlayers,
            connections: io.engine ? io.engine.clientsCount : 0,
            uptime: process.uptime(),
            memory: process.memoryUsage()
        });
    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({ 
            status: 'ERROR', 
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// === ИГРОВОЕ СОСТОЯНИЕ ===

const gameRoom = {
    players: [],
    gameState: 'lobby',
    maxPlayers: 8,
    gamePhase: 'waiting',
    currentRound: 1,
    maxRounds: 3,
    timer: null,
    timeLeft: 0,
    votingResults: {},
    revealedThisRound: 0,
    currentTurnPlayer: null,
    playersWhoRevealed: [],
    totalVotes: 0,
    skipDiscussionVotes: [],
    justificationQueue: [],
    currentJustifyingPlayer: null,
    justificationPhase: 1,
    canChangeVote: {},
    startRoundVotes: [],
    activeEffects: {},
    pendingEliminationNextRound: false, // НОВОЕ: флаг отложенного исключения
    eliminateTopVotersNextRound: false   // НОВОЕ: флаг исключения топ игроков
};

// Функция получения необходимого количества карт для раунда
function getRequiredCardsForRound(round) {
    if (round === 1) {
        return 2; // Профессия + 1 карта на выбор
    } else {
        return 1; // 1 карта на выбор
    }
}

// Функция начала фазы раскрытия
function startRevelationPhase() {
    console.log('🔍 Starting revelation phase');
    
    gameRoom.gamePhase = 'revelation';
    gameRoom.timeLeft = 60;
    gameRoom.revealedThisRound = 0;
    gameRoom.playersWhoRevealed = [];
    
    // Сбрасываем прогресс раскрытия для всех игроков
    gameRoom.players.forEach(player => {
        player.hasRevealed = false;
        player.cardsRevealedThisRound = 0;
    });
    
    // Определяем первого игрока для хода
    const alivePlayers = gameRoom.players.filter(p => p.isAlive);
    if (alivePlayers.length > 0) {
        gameRoom.currentTurnPlayer = alivePlayers[0].id;
    }
    
    // Отправляем уведомление о начале фазы
    io.to('game-room').emit('phase-changed', {
        gamePhase: gameRoom.gamePhase,
        timeLeft: gameRoom.timeLeft,
        players: gameRoom.players,
        currentTurnPlayer: gameRoom.currentTurnPlayer,
        currentRound: gameRoom.currentRound
    });
    
    startGameTimer();
}

// Функция обработки раскрытия характеристик
io.on('connection', (socket) => {
    console.log('🔗 New connection:', socket.id);
    
    // Отправляем текущее количество игроков
    socket.emit('player-count', { count: gameRoom.players.length });
    
    // ИСПРАВЛЯЕМ обработчик присоединения к игре
    socket.on('join-game', (data) => {
        console.log('👋 Player joining:', data.playerName, 'Socket:', socket.id);
        
        const playerName = data.playerName?.trim();
        
        if (!playerName || playerName.length < 2 || playerName.length > 20) {
            socket.emit('error', 'Неверное имя игрока');
            return;
        }
        
        // ИСПРАВЛЯЕМ: Проверяем только ЖИВЫХ игроков и исключаем текущий socket
        const existingPlayer = gameRoom.players.find(p => 
            p.name.toLowerCase() === playerName.toLowerCase() && 
            p.id !== socket.id
        );
        
        if (existingPlayer) {
            console.log('❌ Name already taken:', playerName, 'by player:', existingPlayer.id);
            socket.emit('error', 'Игрок с таким именем уже есть в игре');
            return;
        }
        
        // Проверяем лимит игроков
        if (gameRoom.players.length >= gameRoom.maxPlayers) {
            socket.emit('error', 'Игра заполнена');
            return;
        }
        
        // ИСПРАВЛЯЕМ: Удаляем предыдущего игрока с таким же socket.id если он есть
        const existingPlayerIndex = gameRoom.players.findIndex(p => p.id === socket.id);
        if (existingPlayerIndex !== -1) {
            console.log('🔄 Removing previous player with same socket:', socket.id);
            gameRoom.players.splice(existingPlayerIndex, 1);
        }
        
        // Создаем игрока
        const player = {
            id: socket.id,
            name: playerName,
            isAlive: true,
            isHost: gameRoom.players.length === 0, // Первый игрок - хост
            votes: 0,
            hasVoted: false,
            votedFor: null,
            hasRevealed: false,
            cardsRevealedThisRound: 0,
            revealedCharacteristics: [],
            characteristics: null,
            actionCards: []
        };
        
        gameRoom.players.push(player);
        socket.join('game-room');
        
        console.log('✅ Player joined:', playerName, 'Total players:', gameRoom.players.length);
        
        // Подтверждаем подключение
        socket.emit('join-confirmed', {
            playerId: socket.id,
            playerName: playerName,
            isHost: player.isHost,
            maxPlayers: gameRoom.maxPlayers,
            players: gameRoom.players,
            gameState: gameRoom.gameState
        });
        
        // Уведомляем всех о новом игроке
        io.to('game-room').emit('player-joined', {
            players: gameRoom.players,
            maxPlayers: gameRoom.maxPlayers,
            gameState: gameRoom.gameState
        });
    });
    
    // ДОБАВЛЯЕМ обработчик отключения
    socket.on('disconnect', () => {
        console.log('❌ Player disconnected:', socket.id);
        
        const playerIndex = gameRoom.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
            const player = gameRoom.players[playerIndex];
            console.log('👋 Player left:', player.name);
            
            // Удаляем игрока
            gameRoom.players.splice(playerIndex, 1);
            
            // Если хост ушел, назначаем нового хоста
            if (player.isHost && gameRoom.players.length > 0) {
                gameRoom.players[0].isHost = true;
                console.log('👑 New host:', gameRoom.players[0].name);
            }
            
            // Если все игроки ушли или игроков стало меньше 2, сбрасываем игру
            if (gameRoom.players.length === 0 || (gameRoom.gameState === 'playing' && gameRoom.players.length < 2)) {
                resetGame();
            } else {
                // Уведомляем остальных игроков
                io.to('game-room').emit('player-left', {
                    players: gameRoom.players,
                    gameState: gameRoom.gameState
                });
            }
        }
    });
    
    // ДОБАВЛЯЕМ обработчик смены максимального количества игроков
    socket.on('change-max-players', (data) => {
        const player = gameRoom.players.find(p => p.id === socket.id);
        
        if (!player || !player.isHost) {
            socket.emit('error', 'Только хост может изменять настройки!');
            return;
        }
        
        if (gameRoom.gameState !== 'lobby') {
            socket.emit('error', 'Нельзя изменять настройки во время игры!');
            return;
        }
        
        const newMaxPlayers = parseInt(data.maxPlayers);
        if (newMaxPlayers < 2 || newMaxPlayers > 16) {
            socket.emit('error', 'Неверное количество игроков!');
            return;
        }
        
        if (newMaxPlayers < gameRoom.players.length) {
            socket.emit('error', 'Нельзя установить лимит меньше текущего количества игроков!');
            return;
        }
        
        gameRoom.maxPlayers = newMaxPlayers;
        
        console.log('🔧 Max players changed to:', newMaxPlayers);
        
        io.to('game-room').emit('max-players-changed', {
            maxPlayers: gameRoom.maxPlayers,
            players: gameRoom.players
        });
    });
    
    // ДОБАВЛЯЕМ обработчик старта игры
    socket.on('start-game', () => {
        console.log('🎮 Game start requested by:', socket.id);
        
        const player = gameRoom.players.find(p => p.id === socket.id);
        
        if (!player || !player.isHost) {
            socket.emit('error', 'Только хост может начать игру!');
            return;
        }
        
        if (gameRoom.players.length < 2) {
            socket.emit('error', 'Для начала игры нужно минимум 2 игрока!');
            return;
        }
        
        if (gameRoom.gameState !== 'lobby') {
            socket.emit('error', 'Игра уже идет!');
            return;
        }
        
        // Генерируем характеристики для всех игроков
        gameRoom.players.forEach(player => {
            player.characteristics = generateCharacteristics();
            player.actionCards = [getRandomActionCard()];
            player.hasRevealed = false;
            player.hasVoted = false;
            player.revealedCharacteristics = [];
            player.cardsRevealedThisRound = 0;
        });
        
        gameRoom.gameState = 'playing';
        gameRoom.gamePhase = 'preparation';
        gameRoom.currentRound = 1;
        gameRoom.timeLeft = 0;
        gameRoom.playersWhoRevealed = [];
        gameRoom.currentTurnPlayer = null;
        
        // ДОБАВЛЯЕМ: Выбираем случайную историю
        const randomStory = stories[Math.floor(Math.random() * stories.length)];
        
        console.log('🚀 Game started! Players:', gameRoom.players.length);
        console.log('📖 Selected story:', randomStory.substring(0, 50) + '...');
        
        // Уведомляем всех игроков о начале игры
        io.to('game-room').emit('game-started', {
            players: gameRoom.players,
            gameState: gameRoom.gameState,
            gamePhase: gameRoom.gamePhase,
            currentRound: gameRoom.currentRound,
            timeLeft: gameRoom.timeLeft,
            story: randomStory // ДОБАВЛЯЕМ историю
        });
    });
    
    // ДОБАВЛЯЕМ обработчик раскрытия характеристик
    socket.on('reveal-characteristic', (data) => {
        console.log('🔍 Reveal characteristic:', data);
        
        const player = gameRoom.players.find(p => p.id === socket.id);
        
        if (!player || !player.isAlive) {
            socket.emit('error', 'Вы не можете раскрывать характеристики!');
            return;
        }
        
        if (gameRoom.gamePhase !== 'revelation') {
            socket.emit('error', 'Сейчас не время для раскрытия характеристик!');
            return;
        }
        
        if (gameRoom.currentTurnPlayer !== socket.id) {
            socket.emit('error', 'Сейчас не ваш ход!');
            return;
        }
        
        const characteristic = data.characteristic;
        
        if (!player.characteristics || !player.characteristics[characteristic]) {
            socket.emit('error', 'Такой характеристики не существует!');
            return;
        }
        
        if (player.revealedCharacteristics && player.revealedCharacteristics.includes(characteristic)) {
            socket.emit('error', 'Эта характеристика уже раскрыта!');
            return;
        }
        
        // Проверяем логику раскрытия для первого раунда
        const requiredCards = getRequiredCardsForRound(gameRoom.currentRound);
        const currentlyRevealed = player.cardsRevealedThisRound || 0;
        
        if (currentlyRevealed >= requiredCards) {
            socket.emit('error', 'Вы уже раскрыли все необходимые карты в этом раунде!');
            return;
        }
        
        // В первом раунде проверяем логику профессии
        if (gameRoom.currentRound === 1) {
            if (currentlyRevealed === 0 && characteristic !== 'profession') {
                socket.emit('error', 'В первом раунде сначала нужно раскрыть профессию!');
                return;
            }
            
            if (currentlyRevealed === 1 && characteristic === 'profession') {
                socket.emit('error', 'Профессия уже раскрыта! Выберите другую характеристику.');
                return;
            }
        }
        
        // Раскрываем характеристику
        if (!player.revealedCharacteristics) {
            player.revealedCharacteristics = [];
        }
        
        player.revealedCharacteristics.push(characteristic);
        player.cardsRevealedThisRound = (player.cardsRevealedThisRound || 0) + 1;
        
        console.log(`🔍 ${player.name} revealed ${characteristic}: ${player.characteristics[characteristic]}`);
        
        // Отправляем обновление всем игрокам
        io.to('game-room').emit('characteristic-revealed', {
            playerId: player.id,
            playerName: player.name,
            characteristic: characteristic,
            value: player.characteristics[characteristic],
            players: gameRoom.players,
            cardsRevealedThisRound: player.cardsRevealedThisRound,
            requiredCards: requiredCards
        });
        
        // Проверяем, завершил ли игрок раскрытие
        if (player.cardsRevealedThisRound >= requiredCards) {
            player.hasRevealed = true;
            console.log(`✅ ${player.name} completed revelation phase`);
            
            // Небольшая задержка перед переходом к следующему игроку
            setTimeout(() => {
                nextPlayerTurn();
            }, 1500);
        }
    });
    
    // ДОБАВЛЯЕМ обработчик пропуска обсуждения
    socket.on('vote-skip-discussion', () => {
        console.log('⏭️ Skip discussion vote from:', socket.id);
        
        const player = gameRoom.players.find(p => p.id === socket.id);
        
        if (!player || !player.isAlive) {
            socket.emit('error', 'Вы не можете голосовать!');
            return;
        }
        
        if (gameRoom.gamePhase !== 'discussion') {
            socket.emit('error', 'Сейчас не фаза обсуждения!');
            return;
        }
        
        if (gameRoom.skipDiscussionVotes.includes(socket.id)) {
            socket.emit('error', 'Вы уже проголосовали за пропуск обсуждения!');
            return;
        }
        
        // Добавляем голос
        gameRoom.skipDiscussionVotes.push(socket.id);
        
        const requiredVotes = 2; // Всегда требуется ровно 2 голоса
        const currentVotes = gameRoom.skipDiscussionVotes.length;
        
        console.log(`⏭️ Skip discussion votes: ${currentVotes}/${requiredVotes}`);
        
        // Отправляем обновление всем игрокам
        gameRoom.players.forEach(p => {
            const hasVoted = gameRoom.skipDiscussionVotes.includes(p.id);
            io.to(p.id).emit('skip-discussion-vote-update', {
                votes: currentVotes,
                required: requiredVotes,
                hasVoted: hasVoted
            });
        });
        
        // Если достаточно голосов - пропускаем обсуждение
        if (currentVotes >= requiredVotes) {
            console.log('⏭️ Skipping discussion - enough votes');
            clearInterval(gameRoom.timer);
            gameRoom.timer = null;
            
            io.to('game-room').emit('discussion-skipped', {
                gamePhase: 'voting',
                timeLeft: 120,
                players: gameRoom.players
            });
            
            startVotingPhase();
        }
    });
    
    // ДОБАВЛЯЕМ недостающий обработчик голосования за начало раунда
    socket.on('start-round', () => {
        console.log('🎯 Start round vote from:', socket.id);
        
        const player = gameRoom.players.find(p => p.id === socket.id);
        
        if (!player || !player.isAlive) {
            socket.emit('error', 'Вы не можете голосовать!');
            return;
        }
        
        if (gameRoom.gamePhase !== 'preparation') {
            socket.emit('error', 'Сейчас не время для начала раунда!');
            return;
        }
        
        if (gameRoom.startRoundVotes.includes(socket.id)) {
            socket.emit('error', 'Вы уже проголосовали за начало раунда!');
            return;
        }
        
        // Добавляем голос
        gameRoom.startRoundVotes.push(socket.id);
        
        const requiredVotes = 2; // Требуется 2 голоса для начала раунда
        const currentVotes = gameRoom.startRoundVotes.length;
        
        console.log(`🎯 Start round votes: ${currentVotes}/${requiredVotes}`);
        
        // Отправляем обновление всем игрокам
        gameRoom.players.forEach(p => {
            const hasVoted = gameRoom.startRoundVotes.includes(p.id);
            io.to(p.id).emit('start-round-vote-update', {
                votes: currentVotes,
                required: requiredVotes,
                hasVoted: hasVoted
            });
        });
        
        // Если достаточно голосов - начинаем раунд
        if (currentVotes >= requiredVotes) {
            console.log('🚀 Starting round - enough votes');
            gameRoom.startRoundVotes = []; // Сбрасываем голоса
            startRevelationPhase();
        }
    });
    
    // ДОБАВЛЯЕМ недостающие обработчики голосования
    socket.on('vote-player', (data) => {
        console.log('🗳️ Vote from:', socket.id, 'for:', data.targetId);
        
        const player = gameRoom.players.find(p => p.id === socket.id);
        const targetPlayer = gameRoom.players.find(p => p.id === data.targetId);
        
        if (!player || !player.isAlive) {
            socket.emit('error', 'Вы не можете голосовать!');
            return;
        }
        
        if (!targetPlayer || !targetPlayer.isAlive) {
            socket.emit('error', 'Нельзя голосовать за этого игрока!');
            return;
        }
        
        if (gameRoom.gamePhase !== 'voting') {
            socket.emit('error', 'Сейчас не время для голосования!');
            return;
        }
        
        if (player.hasVoted) {
            socket.emit('error', 'Вы уже проголосовали!');
            return;
        }
        
        // Записываем голос
        player.hasVoted = true;
        player.votedFor = data.targetId;
        
        // Увеличиваем счетчик голосов у цели
        targetPlayer.votes = (targetPlayer.votes || 0) + 1;
        
        // Сохраняем в результатах голосования
        if (!gameRoom.votingResults[data.targetId]) {
            gameRoom.votingResults[data.targetId] = [];
        }
        gameRoom.votingResults[data.targetId].push(socket.id);
        
        console.log(`🗳️ ${player.name} voted for ${targetPlayer.name} (${targetPlayer.votes} votes)`);
        
        // Отправляем обновление
        io.to('game-room').emit('vote-update', {
            players: gameRoom.players,
            votingResults: gameRoom.votingResults,
            canChangeVote: gameRoom.canChangeVote
        });
        
        // Проверяем, все ли проголосовали
        const alivePlayers = gameRoom.players.filter(p => p.isAlive);
        const votedPlayers = alivePlayers.filter(p => p.hasVoted);
        
        if (votedPlayers.length === alivePlayers.length) {
            console.log('✅ All players voted, processing results');
            
            // Небольшая задержка перед обработкой результатов
            setTimeout(() => {
                processVotingResults();
            }, 2000);
        }
    });

    socket.on('change-vote', (data) => {
        console.log('🔄 Change vote from:', socket.id, 'to:', data.targetId);
        
        const player = gameRoom.players.find(p => p.id === socket.id);
        const targetPlayer = gameRoom.players.find(p => p.id === data.targetId);
        
        if (!player || !player.isAlive) {
            socket.emit('error', 'Вы не можете голосовать!');
            return;
        }
        
        if (!targetPlayer || !targetPlayer.isAlive) {
            socket.emit('error', 'Нельзя голосовать за этого игрока!');
            return;
        }
        
        if (gameRoom.gamePhase !== 'voting') {
            socket.emit('error', 'Сейчас не время для голосования!');
            return;
        }
        
        if (!gameRoom.canChangeVote[socket.id]) {
            socket.emit('error', 'Вы не можете изменить голос!');
            return;
        }
        
        // Убираем предыдущий голос
        if (player.votedFor) {
            const previousTarget = gameRoom.players.find(p => p.id === player.votedFor);
            if (previousTarget) {
                previousTarget.votes = Math.max(0, (previousTarget.votes || 0) - 1);
            }
            
            // Убираем из результатов голосования
            if (gameRoom.votingResults[player.votedFor]) {
                gameRoom.votingResults[player.votedFor] = gameRoom.votingResults[player.votedFor].filter(id => id !== socket.id);
            }
        }
        
        // Добавляем новый голос
        player.votedFor = data.targetId;
        targetPlayer.votes = (targetPlayer.votes || 0) + 1;
        
        if (!gameRoom.votingResults[data.targetId]) {
            gameRoom.votingResults[data.targetId] = [];
        }
        gameRoom.votingResults[data.targetId].push(socket.id);
        
        // Убираем возможность изменить голос еще раз
        gameRoom.canChangeVote[socket.id] = false;
        
        console.log(`🔄 ${player.name} changed vote to ${targetPlayer.name}`);
        
        // Отправляем обновление
        io.to('game-room').emit('vote-update', {
            players: gameRoom.players,
            votingResults: gameRoom.votingResults,
            canChangeVote: gameRoom.canChangeVote
        });
    });

    // ИСПРАВЛЯЕМ функцию обработки результатов голосования
    function processVotingResults() {
        // Определяем игроков с максимальным количеством голосов
        let maxVotes = 0;
        const alivePlayers = gameRoom.players.filter(p => p.isAlive);
        
        alivePlayers.forEach(player => {
            if (player.votes > maxVotes) {
                maxVotes = player.votes;
            }
        });
        
        const playersWithMaxVotes = alivePlayers.filter(p => p.votes === maxVotes && maxVotes > 0);
        
        console.log(`🗳️ Voting results: Max votes: ${maxVotes}, Players with max votes: ${playersWithMaxVotes.length}`);
        
        // ДОБАВЛЯЕМ: Проверяем, это первое или второе голосование
        const isSecondVoting = gameRoom.justificationQueue && gameRoom.justificationQueue.length > 0;
        
        if (playersWithMaxVotes.length === 1) {
            // Только один игрок - исключаем сразу
            playersWithMaxVotes[0].isAlive = false;
            showResults();
        } else if (playersWithMaxVotes.length >= 2 && playersWithMaxVotes.length <= 3) {
            if (isSecondVoting) {
                // НОВАЯ ЛОГИКА: Если это второе голосование и снова ничья - никого не исключаем
                console.log('🤝 Second voting tie - no elimination this round, double elimination next round');
                gameRoom.eliminateTopVotersNextRound = true;
                gameRoom.justificationQueue = []; // ВАЖНО: Очищаем очередь оправданий
                showResults(); // Переходим к результатам без исключения
            } else {
                // Первое голосование - идут оправдываться
                startJustificationPhase();
            }
        } else {
            // Никого не исключаем
            showResults();
        }
    }

    socket.on('finish-justification', () => {
        console.log('✅ Finish justification from:', socket.id);
        
        const player = gameRoom.players.find(p => p.id === socket.id);
        
        if (!player || gameRoom.currentJustifyingPlayer !== socket.id) {
            socket.emit('error', 'Сейчас не ваша очередь оправдываться!');
            return;
        }
        
        if (gameRoom.gamePhase !== 'justification') {
            socket.emit('error', 'Сейчас не время для оправданий!');
            return;
        }
        
        // Переходим к следующему оправданию
        nextJustification();
    });

    socket.on('surrender', () => {
        console.log('🏳️ Surrender from:', socket.id);
        
        const player = gameRoom.players.find(p => p.id === socket.id);
        
        if (!player || !player.isAlive) {
            socket.emit('error', 'Вы не можете сдаться!');
            return;
        }
        
        // Игрок сдается - исключаем его
        player.isAlive = false;
        
        console.log(`🏳️ ${player.name} surrendered`);
        
        // Уведомляем всех
        io.to('game-room').emit('player-surrendered', {
            playerName: player.name,
            players: gameRoom.players
        });
        
        // Проверяем условия окончания игры
        const alivePlayers = gameRoom.players.filter(p => p.isAlive);
        if (alivePlayers.length <= 2) {
            endGame();
        } else if (gameRoom.gamePhase === 'justification') {
            // Если сдался во время оправданий - переходим к следующему
            nextJustification();
        }
    });
});

// Функция перехода к следующему игроку
function nextPlayerTurn() {
    const alivePlayers = gameRoom.players.filter(p => p.isAlive);
    const currentPlayerIndex = alivePlayers.findIndex(p => p.id === gameRoom.currentTurnPlayer);
    
    // Переходим к следующему игроку
    const nextPlayerIndex = (currentPlayerIndex + 1) % alivePlayers.length;
    
    // Если дошли до первого игрока снова и все завершили - переходим к обсуждению
    if (nextPlayerIndex === 0) {
        const allRevealed = alivePlayers.every(p => p.hasRevealed);
        if (allRevealed) {
            console.log('✅ All players finished revelation phase');
            startDiscussionPhase();
            return;
        }
    }
    
    const nextPlayer = alivePlayers[nextPlayerIndex];
    gameRoom.currentTurnPlayer = nextPlayer.id;
    gameRoom.timeLeft = 60;
    
    console.log(`👤 Next turn: ${nextPlayer.name}`);
    
    // Отправляем обновление
    io.to('game-room').emit('phase-changed', {
        gamePhase: gameRoom.gamePhase,
        timeLeft: gameRoom.timeLeft,
        players: gameRoom.players,
        currentTurnPlayer: gameRoom.currentTurnPlayer,
        currentRound: gameRoom.currentRound
    });
    
    startGameTimer();
}

// Функция начала фазы обсуждения
function startDiscussionPhase() {
    console.log('💬 Starting discussion phase');
    
    gameRoom.gamePhase = 'discussion';
    gameRoom.timeLeft = 180; // 3 минуты на обсуждение
    gameRoom.currentTurnPlayer = null;
    gameRoom.skipDiscussionVotes = [];
    
    io.to('game-room').emit('phase-changed', {
        gamePhase: gameRoom.gamePhase,
        timeLeft: gameRoom.timeLeft,
        players: gameRoom.players,
        currentTurnPlayer: null,
        currentRound: gameRoom.currentRound
    });
    
    startGameTimer();
}

// Функция начала фазы голосования
function startVotingPhase() {
    console.log('🗳️ Starting voting phase');
    
    gameRoom.gamePhase = 'voting';
    gameRoom.timeLeft = 120; // 2 минуты на голосование
    gameRoom.votingResults = {};
    gameRoom.totalVotes = 0;
    
    // Сбрасываем голоса всех игроков
    gameRoom.players.forEach(player => {
        player.hasVoted = false;
        player.votedFor = null;
        player.votes = 0;
    });
    
    // Определяем кто может менять голос (каждый игрок может поменять голос один раз)
    gameRoom.canChangeVote = {};
    gameRoom.players.filter(p => p.isAlive).forEach(player => {
        gameRoom.canChangeVote[player.id] = true;
    });
    
    io.to('game-room').emit('phase-changed', {
        gamePhase: gameRoom.gamePhase,
        timeLeft: gameRoom.timeLeft,
        players: gameRoom.players,
        canChangeVote: gameRoom.canChangeVote,
        currentRound: gameRoom.currentRound
    });
    
    startGameTimer();
}

// Функция начала фазы оправдания
function startJustificationPhase() {
    console.log('⚖️ Starting justification phase');
    
    // Определяем игроков с максимальным количеством голосов
    let maxVotes = 0;
    const alivePlayers = gameRoom.players.filter(p => p.isAlive);
    
    alivePlayers.forEach(player => {
        if (player.votes > maxVotes) {
            maxVotes = player.votes;
        }
    });
    
    // Получаем игроков с максимальным количеством голосов
    const playersToJustify = alivePlayers.filter(p => 
        p.votes === maxVotes && maxVotes > 0
    );
    
    console.log(`⚖️ Max votes: ${maxVotes}, Players with max votes:`, playersToJustify.map(p => `${p.name}(${p.votes})`));
    
    if (playersToJustify.length === 0) {
        // Никто не получил голосов - переходим к следующему раунду
        console.log('⚖️ No votes - proceeding to next round');
        nextRound();
        return;
    }
    
    if (playersToJustify.length === 1) {
        // ИСПРАВЛЕНО: Только один игрок с максимумом голосов - сразу исключаем
        const eliminatedPlayer = playersToJustify[0];
        eliminatedPlayer.isAlive = false;
        console.log('💀 Single player eliminated:', eliminatedPlayer.name);
        
        // Показываем результаты без оправданий
        showResults();
        return;
    }
    
    // ИСПРАВЛЕНО: Несколько игроков с одинаковым максимумом голосов - они оправдываются
    console.log(`⚖️ Multiple players tied with ${maxVotes} votes - starting justifications`);
    
    gameRoom.gamePhase = 'justification';
    gameRoom.justificationQueue = [...playersToJustify];
    gameRoom.currentJustifyingPlayer = gameRoom.justificationQueue[0].id;
    gameRoom.timeLeft = 60; // 1 минута на оправдание
    
    console.log(`⚖️ Players justifying: ${playersToJustify.map(p => p.name).join(', ')}`);
    
    io.to('game-room').emit('justification-started', {
        gamePhase: gameRoom.gamePhase,
        timeLeft: gameRoom.timeLeft,
        players: gameRoom.players,
        justifyingPlayer: playersToJustify[0],
        justificationQueue: gameRoom.justificationQueue.map(p => p.name),
        currentRound: gameRoom.currentRound
    });
    
    startGameTimer();
}

// Функция перехода к следующему оправданию
function nextJustification() {
    const currentIndex = gameRoom.justificationQueue.findIndex(p => p.id === gameRoom.currentJustifyingPlayer);
    
    if (currentIndex < gameRoom.justificationQueue.length - 1) {
        // Переходим к следующему игроку
        gameRoom.currentJustifyingPlayer = gameRoom.justificationQueue[currentIndex + 1].id;
        gameRoom.timeLeft = 60;
        
        const nextPlayer = gameRoom.justificationQueue[currentIndex + 1];
        
        io.to('game-room').emit('justification-started', {
            gamePhase: gameRoom.gamePhase,
            timeLeft: gameRoom.timeLeft,
            players: gameRoom.players,
            justifyingPlayer: nextPlayer,
            justificationQueue: gameRoom.justificationQueue.map(p => p.name),
            currentRound: gameRoom.currentRound
        });
        
        startGameTimer();
    } else {
        // Все оправдались - начинаем второе голосование
        startSecondVoting();
    }
}

// Функция второго голосования
function startSecondVoting() {
    console.log('🗳️ Starting second voting after justifications');
    
    gameRoom.gamePhase = 'voting';
    gameRoom.timeLeft = 90; // 1.5 минуты на второе голосование
    gameRoom.votingResults = {};
    
    // Сбрасываем голоса для всех игроков
    gameRoom.players.forEach(player => {
        player.hasVoted = false;
        player.votedFor = null;
        player.votes = 0;
    });
    
    // Во втором голосовании нельзя менять голос
    gameRoom.canChangeVote = {};
    
    // ВАЖНО: НЕ очищаем justificationQueue здесь - она нужна для определения второго голосования
    
    io.to('game-room').emit('second-voting-started', {
        gamePhase: gameRoom.gamePhase,
        timeLeft: gameRoom.timeLeft,
        players: gameRoom.players,
        canChangeVote: gameRoom.canChangeVote,
        currentRound: gameRoom.currentRound,
        isSecondVoting: true
    });
    
    startGameTimer();
}

// Функция показа результатов раунда
function showResults() {
    console.log('📊 Showing round results');
    
    gameRoom.gamePhase = 'results';
    
    // Определяем игроков с максимальным количеством голосов
    let maxVotes = 0;
    const alivePlayers = gameRoom.players.filter(p => p.isAlive);
    
    alivePlayers.forEach(player => {
        if (player.votes > maxVotes) {
            maxVotes = player.votes;
        }
    });
    
    const playersWithMaxVotes = alivePlayers.filter(p => p.votes === maxVotes && maxVotes > 0);
    
    console.log(`📊 Results: Max votes: ${maxVotes}, Players with max votes: ${playersWithMaxVotes.length}`);
    console.log(`📊 Eliminate top voters next round: ${gameRoom.eliminateTopVotersNextRound}`);
    
    let eliminatedPlayers = [];
    let resultMessage = '';
    
    // НОВАЯ ЛОГИКА: Проверяем условия исключения
    if (gameRoom.eliminateTopVotersNextRound) {
        // Исключаем топ-2 игроков (с наибольшим и вторым по величине количеством голосов)
        console.log('💀 Eliminating top 2 voters from previous round');
        
        // Сортируем по убыванию голосов
        const sortedByVotes = [...alivePlayers].sort((a, b) => (b.votes || 0) - (a.votes || 0));
        
        // Получаем уникальные значения голосов
        const uniqueVotes = [...new Set(sortedByVotes.map(p => p.votes || 0))].filter(v => v > 0);
        
        if (uniqueVotes.length >= 2) {
            // Есть первое и второе место
            const firstPlaceVotes = uniqueVotes[0];
            const secondPlaceVotes = uniqueVotes[1];
            
            const firstPlacePlayers = sortedByVotes.filter(p => p.votes === firstPlaceVotes);
            const secondPlacePlayers = sortedByVotes.filter(p => p.votes === secondPlaceVotes);
            
            // Добавляем всех с первым местом и столько со вторым, чтобы общее количество было 2
            eliminatedPlayers = [...firstPlacePlayers];
            const remainingSlots = 2 - eliminatedPlayers.length;
            
            if (remainingSlots > 0) {
                eliminatedPlayers.push(...secondPlacePlayers.slice(0, remainingSlots));
            }
        } else if (uniqueVotes.length === 1) {
            // Все с одинаковыми голосами - берем первых двух
            eliminatedPlayers = sortedByVotes.slice(0, 2);
        }
        
        // Исключаем игроков
        eliminatedPlayers.forEach(player => {
            player.isAlive = false;
        });
        
        resultMessage = `Специальное исключение: ${eliminatedPlayers.map(p => p.name).join(', ')} (двойное исключение за ничью в прошлом раунде)`;
        gameRoom.eliminateTopVotersNextRound = false;
        
    } else if (playersWithMaxVotes.length === 1 && maxVotes > 0) {
        // Стандартное исключение одного игрока
        eliminatedPlayers = [playersWithMaxVotes[0]];
        playersWithMaxVotes[0].isAlive = false;
        resultMessage = `Исключен: ${playersWithMaxVotes[0].name}`;
        
    } else if (playersWithMaxVotes.length >= 2 && playersWithMaxVotes.length <= 3 && maxVotes > 0) {
        // НОВАЯ ЛОГИКА: Ничья между 2-3 игроками - никого не исключаем, но в следующем раунде исключим топ-2
        console.log(`🤝 Tie between ${playersWithMaxVotes.length} players - deferring elimination to next round`);
        eliminatedPlayers = [];
        resultMessage = `Ничья между ${playersWithMaxVotes.map(p => p.name).join(', ')}. В следующем раунде будут исключены 2 игрока с наибольшими голосами!`;
        gameRoom.eliminateTopVotersNextRound = true;
        
    } else {
        // Никого не исключаем
        eliminatedPlayers = [];
        resultMessage = 'Никто не исключен в этом раунде';
    }
    
    // ВАЖНО: Сбрасываем все состояния голосования
    gameRoom.players.forEach(player => {
        player.hasVoted = false;
        player.votedFor = null;
        player.votes = 0;
        player.hasRevealed = false;
        player.cardsRevealedThisRound = 0;
    });
    
    gameRoom.votingResults = {};
    gameRoom.canChangeVote = {};
    gameRoom.currentTurnPlayer = null;
    gameRoom.currentJustifyingPlayer = null;
    gameRoom.justificationQueue = []; // ВАЖНО: Очищаем очередь оправданий
    
    // Очищаем таймер
    if (gameRoom.timer) {
        clearInterval(gameRoom.timer);
        gameRoom.timer = null;
    }
    
    io.to('game-room').emit('round-results', {
        eliminatedPlayers: eliminatedPlayers.map(p => p.name),
        players: gameRoom.players,
        votingResults: gameRoom.votingResults,
        resultMessage: resultMessage,
        willEliminateTopVotersNextRound: gameRoom.eliminateTopVotersNextRound
    });
    
    // Через 5 секунд переходим к следующему раунду
    setTimeout(() => {
        nextRound();
    }, 5000);
}

// ОБНОВЛЯЕМ функцию перехода к следующему раунду
function nextRound() {
    try {
        gameRoom.currentRound++;
        
        // Проверяем условия окончания игры
        const alivePlayers = gameRoom.players.filter(p => p.isAlive);
        
        if (alivePlayers.length <= 2 || gameRoom.currentRound > gameRoom.maxRounds) {
            endGame();
            return;
        }
        
        gameRoom.gamePhase = 'preparation';
        gameRoom.timeLeft = 0;
        gameRoom.currentTurnPlayer = null;
        gameRoom.startRoundVotes = [];
        
        console.log('🔄 Starting round:', gameRoom.currentRound, 'Alive players:', alivePlayers.length);
        
        // НОВОЕ: Отправляем информацию о специальном режиме исключения
        io.to('game-room').emit('new-round', {
            currentRound: gameRoom.currentRound,
            gamePhase: gameRoom.gamePhase,
            timeLeft: gameRoom.timeLeft,
            players: gameRoom.players,
            willEliminateTopVotersThisRound: gameRoom.eliminateTopVotersNextRound
        });
    } catch (error) {
        console.error('❌ Error in nextRound:', error);
    }
}

// ОБНОВЛЯЕМ функцию сброса игры
function resetGame() {
    console.log('🔄 Resetting game...');
    
    try {
        if (gameRoom.timer) {
            clearInterval(gameRoom.timer);
            gameRoom.timer = null;
        }
        
        // Оставляем игроков, но сбрасываем игровое состояние
        gameRoom.players.forEach((player) => {
            player.isAlive = true;
            player.votes = 0;
            player.hasRevealed = false;
            player.hasVoted = false;
            player.votedFor = null;
            player.cardsRevealedThisRound = 0;
            player.revealedCharacteristics = [];
            player.characteristics = null;
            player.actionCards = [];
        });
        
        gameRoom.gameState = 'lobby';
        gameRoom.gamePhase = 'waiting';
        gameRoom.currentRound = 1;
        gameRoom.timer = null;
        gameRoom.timeLeft = 0;
        gameRoom.votingResults = {};
        gameRoom.revealedThisRound = 0;
        gameRoom.currentTurnPlayer = null;
        gameRoom.playersWhoRevealed = [];
        gameRoom.totalVotes = 0;
        gameRoom.skipDiscussionVotes = [];
        gameRoom.justificationQueue = [];
        gameRoom.currentJustifyingPlayer = null;
        gameRoom.canChangeVote = {};
        gameRoom.startRoundVotes = [];
        gameRoom.activeEffects = {};
        gameRoom.pendingEliminationNextRound = false; // НОВОЕ: сброс
        gameRoom.eliminateTopVotersNextRound = false;  // НОВОЕ: сброс
        
        io.to('game-room').emit('game-reset', {
            players: gameRoom.players,
            gameState: gameRoom.gameState
        });
    } catch (error) {
        console.error('❌ Error resetting game:', error);
    }
}

// Функция завершения игры
function endGame() {
    try {
        console.log('🏁 Game ended');
        
        const alivePlayers = gameRoom.players.filter(p => p.isAlive);
        
        gameRoom.gamePhase = 'finished';
        if (gameRoom.timer) {
            clearInterval(gameRoom.timer);
            gameRoom.timer = null;
        }
        
        io.to('game-room').emit('game-ended', {
            winners: alivePlayers,
            players: gameRoom.players
        });
        
        // Автоматический сброс игры через 10 секунд
        setTimeout(() => {
            resetGame();
        }, 10000);
    } catch (error) {
        console.error('❌ Error ending game:', error);
    }
}

// ИСПРАВЛЯЕМ обработку ошибок для всех тайм-аутов
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    // Не выходим из процесса, просто логируем
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    // Не выходим из процесса, просто логируем
});

// ИСПРАВЛЯЕМ запуск сервера
const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', (error) => {
    if (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
    
    console.log(`🚀 Multi-Room Bunker Server running on port ${PORT}`);
    console.log(`🌐 Access the game at: http://localhost:${PORT}`);
    console.log('🎯 Ready for players to create and join rooms!');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    
    // Очищаем все комнаты
    for (const room of gameRooms.values()) {
        room.cleanup();
    }
    gameRooms.clear();
    
    server.close((error) => {
        if (error) {
            console.error('❌ Error closing server:', error);
        }
        console.log('🔚 Process terminated');
        process.exit(0);
    });
});

console.log('🎮 Multi-Room Bunker Game Server Loaded');
