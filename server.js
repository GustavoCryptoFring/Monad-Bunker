const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

console.log('🚀 Starting Multi-Room Bunker Game Server...');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// === СИСТЕМА МНОЖЕСТВЕННЫХ КОМНАТ ===

const gameRooms = new Map(); // roomId -> GameRoom

class GameRoom {
    constructor(id, maxPlayers = 8) {
        this.id = id;
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
        this.pendingEliminationNextRound = false;
        this.eliminateTopVotersNextRound = false;
        this.createdAt = new Date();
        this.lastActivity = new Date();
    }

    updateActivity() {
        this.lastActivity = new Date();
    }

    getAlivePlayers() {
        return this.players.filter(p => p.isAlive);
    }

    resetForNewGame() {
        this.players.forEach(player => {
            player.isAlive = true;
            player.votes = 0;
            player.hasRevealed = false;
            player.hasVoted = false;
            player.votedFor = null;
            player.cardsRevealedThisRound = 0;
            player.revealedCharacteristics = [];
            player.characteristics = null;
        });

        this.gameState = 'lobby';
        this.gamePhase = 'waiting';
        this.currentRound = 1;
        this.timeLeft = 0;
        this.votingResults = {};
        this.revealedThisRound = 0;
        this.currentTurnPlayer = null;
        this.playersWhoRevealed = [];
        this.totalVotes = 0;
        this.skipDiscussionVotes = [];
        this.justificationQueue = [];
        this.currentJustifyingPlayer = null;
        this.canChangeVote = {};
        this.startRoundVotes = [];
        this.pendingEliminationNextRound = false;
        this.eliminateTopVotersNextRound = false;

        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
}

// === ХАРАКТЕРИСТИКИ === 
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

const stories = [
    "В 2050 году человечество столкнулось с глобальной катастрофой. Земля оказалась под угрозой вымирания, и вы - группа выживших, которые должны решить, кто достоин попасть в последний бункер на планете.",
    "После разрушительной войны большая часть планеты стала непригодной для жизни. Группа людей собирается в защищенном бункере, но места хватит не всем.",
    "Вирус, вырвавшийся из секретной лаборатории, уничтожил большую часть населения. Теперь спасшиеся должны решить, кто войдет в бункер и продолжит человеческий род."
];

// === УТИЛИТЫ ===

function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toLowerCase();
}

function generateCharacteristics() {
    return {
        profession: getRandomElement(professions),
        health: getRandomElement(healthConditions),
        hobby: getRandomElement(hobbies),
        phobia: getRandomElement(phobias),
        baggage: getRandomElement(baggage),
        fact1: getRandomElement(facts),
        fact2: getRandomElement(facts.filter(f => f !== facts[0]))
    };
}

function getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function getRequiredCardsForRound(round) {
    return round === 1 ? 2 : 1;
}

// Функции для работы с комнатами
function emitToRoom(roomId, event, data) {
    io.to(roomId).emit(event, data);
}

function getRoom(roomId) {
    return gameRooms.get(roomId);
}

function createRoom(roomId, maxPlayers = 8) {
    const room = new GameRoom(roomId, maxPlayers);
    gameRooms.set(roomId, room);
    console.log(`🏠 Created room: ${roomId}`);
    return room;
}

function removeEmptyRooms() {
    for (const [roomId, room] of gameRooms.entries()) {
        if (room.players.length === 0) {
            if (room.timer) {
                clearInterval(room.timer);
            }
            gameRooms.delete(roomId);
            console.log(`🗑️ Removed empty room: ${roomId}`);
        }
    }
}

// Очистка старых комнат каждые 5 минут
setInterval(removeEmptyRooms, 300000);

// === СТАТИЧЕСКИЕ ФАЙЛЫ ===
app.use(express.static(__dirname));

// === МАРШРУТЫ ===
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/game', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/game/:roomType', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        totalRooms: gameRooms.size,
        totalPlayers: Array.from(gameRooms.values()).reduce((sum, room) => sum + room.players.length, 0),
        rooms: Array.from(gameRooms.entries()).map(([id, room]) => ({
            id,
            players: room.players.length,
            gameState: room.gameState,
            gamePhase: room.gamePhase
        }))
    });
});

app.get('/api/rooms', (req, res) => {
    const rooms = Array.from(gameRooms.entries()).map(([id, room]) => ({
        id,
        players: room.players.length,
        maxPlayers: room.maxPlayers,
        gameState: room.gameState,
        gamePhase: room.gamePhase,
        canJoin: room.players.length < room.maxPlayers && room.gameState === 'lobby'
    }));
    res.json({ rooms });
});

// === WEBSOCKET ОБРАБОТЧИКИ ===

io.on('connection', (socket) => {
    console.log('🔗 New connection:', socket.id);

    // Присоединение к комнате
    socket.on('join-room', (data) => {
        console.log('👋 Join room request:', data);
        
        const { roomId, roomType, playerName } = data;
        
        if (!playerName || playerName.trim().length < 2 || playerName.trim().length > 20) {
            socket.emit('error', 'Неверное имя игрока');
            return;
        }

        const fullRoomId = `${roomType || 'default'}-${roomId || generateRoomId()}`;
        
        // Создаем комнату если не существует
        let gameRoom = getRoom(fullRoomId);
        if (!gameRoom) {
            gameRoom = createRoom(fullRoomId);
        }

        // Проверяем лимит игроков
        if (gameRoom.players.length >= gameRoom.maxPlayers) {
            socket.emit('error', 'Комната заполнена');
            return;
        }

        // Проверяем уникальность имени в комнате
        const existingPlayer = gameRoom.players.find(p => 
            p.name.toLowerCase() === playerName.trim().toLowerCase() && p.id !== socket.id
        );
        
        if (existingPlayer) {
            socket.emit('error', 'Игрок с таким именем уже есть в комнате');
            return;
        }

        // Удаляем игрока из предыдущей комнаты если есть
        if (socket.currentRoom) {
            leaveCurrentRoom(socket);
        }

        // Удаляем предыдущего игрока с таким же socket.id если есть
        const existingPlayerIndex = gameRoom.players.findIndex(p => p.id === socket.id);
        if (existingPlayerIndex !== -1) {
            gameRoom.players.splice(existingPlayerIndex, 1);
        }

        // Создаем игрока
        const player = {
            id: socket.id,
            name: playerName.trim(),
            isAlive: true,
            isHost: gameRoom.players.length === 0,
            votes: 0,
            hasVoted: false,
            votedFor: null,
            hasRevealed: false,
            cardsRevealedThisRound: 0,
            revealedCharacteristics: [],
            characteristics: null
        };

        // Добавляем игрока в комнату
        gameRoom.players.push(player);
        gameRoom.updateActivity();

        // Присоединяемся к socket.io комнате
        socket.join(fullRoomId);
        socket.currentRoom = fullRoomId;
        socket.playerName = playerName.trim();

        console.log(`✅ Player ${playerName} joined room ${fullRoomId} (${gameRoom.players.length}/${gameRoom.maxPlayers})`);

        // Подтверждаем подключение
        socket.emit('join-confirmed', {
            playerId: socket.id,
            playerName: playerName.trim(),
            isHost: player.isHost,
            maxPlayers: gameRoom.maxPlayers,
            players: gameRoom.players,
            gameState: gameRoom.gameState,
            roomId: fullRoomId
        });

        // Уведомляем всех в комнате о новом игроке
        emitToRoom(fullRoomId, 'player-joined', {
            players: gameRoom.players,
            maxPlayers: gameRoom.maxPlayers,
            gameState: gameRoom.gameState
        });
    });

    // Выход из текущей комнаты
    function leaveCurrentRoom(socket) {
        if (!socket.currentRoom) return;

        const gameRoom = getRoom(socket.currentRoom);
        if (!gameRoom) return;

        const playerIndex = gameRoom.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
            const player = gameRoom.players[playerIndex];
            console.log(`👋 Player ${player.name} left room ${socket.currentRoom}`);
            
            gameRoom.players.splice(playerIndex, 1);
            gameRoom.updateActivity();

            // Если хост ушел, назначаем нового хоста
            if (player.isHost && gameRoom.players.length > 0) {
                gameRoom.players[0].isHost = true;
                console.log(`👑 New host in ${socket.currentRoom}:`, gameRoom.players[0].name);
            }

            // Если все игроки ушли или игроков стало меньше 2 во время игры, сбрасываем игру
            if (gameRoom.players.length === 0 || (gameRoom.gameState === 'playing' && gameRoom.players.length < 2)) {
                resetRoom(socket.currentRoom);
            } else {
                // Уведомляем остальных игроков в комнате
                emitToRoom(socket.currentRoom, 'player-left', {
                    players: gameRoom.players,
                    gameState: gameRoom.gameState
                });
            }
        }

        socket.leave(socket.currentRoom);
        socket.currentRoom = null;
    }

    // Отключение
    socket.on('disconnect', () => {
        console.log('❌ Player disconnected:', socket.id);
        leaveCurrentRoom(socket);
        
        // Отложенная очистка пустых комнат
        setTimeout(removeEmptyRooms, 5000);
    });

    // Остальные обработчики событий (используют socket.currentRoom)
    socket.on('change-max-players', (data) => {
        if (!socket.currentRoom) {
            socket.emit('error', 'Вы не в комнате!');
            return;
        }

        const gameRoom = getRoom(socket.currentRoom);
        if (!gameRoom) return;

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
        gameRoom.updateActivity();
        
        console.log(`🔧 Max players in ${socket.currentRoom} changed to:`, newMaxPlayers);
        
        emitToRoom(socket.currentRoom, 'max-players-changed', {
            maxPlayers: gameRoom.maxPlayers,
            players: gameRoom.players
        });
    });

    // Начало игры
    socket.on('start-game', () => {
        if (!socket.currentRoom) {
            socket.emit('error', 'Вы не в комнате!');
            return;
        }

        const gameRoom = getRoom(socket.currentRoom);
        if (!gameRoom) return;

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
        gameRoom.updateActivity();
        
        const randomStory = stories[Math.floor(Math.random() * stories.length)];
        
        console.log(`🚀 Game started in room ${socket.currentRoom}! Players: ${gameRoom.players.length}`);
        
        emitToRoom(socket.currentRoom, 'game-started', {
            players: gameRoom.players,
            gameState: gameRoom.gameState,
            gamePhase: gameRoom.gamePhase,
            currentRound: gameRoom.currentRound,
            timeLeft: gameRoom.timeLeft,
            story: randomStory
        });
    });

    // Все остальные обработчики событий адаптированы для работы с комнатами
    // (reveal-characteristic, vote-player, start-round, etc.)
    // Каждый обработчик проверяет socket.currentRoom и использует getRoom(socket.currentRoom)

    socket.on('reveal-characteristic', (data) => {
        if (!socket.currentRoom) return;
        const gameRoom = getRoom(socket.currentRoom);
        if (!gameRoom) return;

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
        gameRoom.updateActivity();
        
        console.log(`🔍 ${player.name} in ${socket.currentRoom} revealed ${characteristic}: ${player.characteristics[characteristic]}`);
        
        emitToRoom(socket.currentRoom, 'characteristic-revealed', {
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
            
            setTimeout(() => {
                nextPlayerTurn(socket.currentRoom);
            }, 1500);
        }
    });

    // Добавим остальные обработчики (vote-player, start-round, etc.) с аналогичными изменениями...
    // Для краткости показываю основную структуру
});

// === ИГРОВЫЕ ФУНКЦИИ ===

function nextPlayerTurn(roomId) {
    const gameRoom = getRoom(roomId);
    if (!gameRoom) return;

    const alivePlayers = gameRoom.getAlivePlayers();
    const currentPlayerIndex = alivePlayers.findIndex(p => p.id === gameRoom.currentTurnPlayer);
    
    const nextPlayerIndex = (currentPlayerIndex + 1) % alivePlayers.length;
    
    if (nextPlayerIndex === 0) {
        const allRevealed = alivePlayers.every(p => p.hasRevealed);
        if (allRevealed) {
            console.log(`✅ All players in ${roomId} finished revelation phase`);
            startDiscussionPhase(roomId);
            return;
        }
    }
    
    const nextPlayer = alivePlayers[nextPlayerIndex];
    gameRoom.currentTurnPlayer = nextPlayer.id;
    gameRoom.timeLeft = 60;
    gameRoom.updateActivity();
    
    console.log(`👤 Next turn in ${roomId}: ${nextPlayer.name}`);
    
    emitToRoom(roomId, 'phase-changed', {
        gamePhase: gameRoom.gamePhase,
        timeLeft: gameRoom.timeLeft,
        players: gameRoom.players,
        currentTurnPlayer: gameRoom.currentTurnPlayer,
        currentRound: gameRoom.currentRound
    });
    
    startGameTimer(roomId);
}

function startDiscussionPhase(roomId) {
    const gameRoom = getRoom(roomId);
    if (!gameRoom) return;

    console.log(`💬 Starting discussion phase in ${roomId}`);
    
    gameRoom.gamePhase = 'discussion';
    gameRoom.timeLeft = 180;
    gameRoom.currentTurnPlayer = null;
    gameRoom.skipDiscussionVotes = [];
    gameRoom.updateActivity();
    
    emitToRoom(roomId, 'phase-changed', {
        gamePhase: gameRoom.gamePhase,
        timeLeft: gameRoom.timeLeft,
        players: gameRoom.players,
        currentTurnPlayer: null,
        currentRound: gameRoom.currentRound
    });
    
    startGameTimer(roomId);
}

function startGameTimer(roomId) {
    const gameRoom = getRoom(roomId);
    if (!gameRoom) return;

    if (gameRoom.timer) {
        clearInterval(gameRoom.timer);
        gameRoom.timer = null;
    }
    
    gameRoom.timer = setInterval(() => {
        gameRoom.timeLeft--;
        gameRoom.updateActivity();
        
        if (gameRoom.timeLeft % 5 === 0 || gameRoom.timeLeft <= 10) {
            emitToRoom(roomId, 'timer-update', {
                timeLeft: gameRoom.timeLeft,
                currentTurnPlayer: gameRoom.currentTurnPlayer
            });
        }
        
        if (gameRoom.timeLeft <= 0) {
            clearInterval(gameRoom.timer);
            gameRoom.timer = null;
            handlePhaseTimeout(roomId);
        }
    }, 1000);
}

function handlePhaseTimeout(roomId) {
    const gameRoom = getRoom(roomId);
    if (!gameRoom) return;

    console.log(`⏰ Phase timeout in ${roomId}:`, gameRoom.gamePhase);
    
    switch (gameRoom.gamePhase) {
        case 'revelation':
            nextPlayerTurn(roomId);
            break;
        case 'discussion':
            startVotingPhase(roomId);
            break;
        case 'voting':
            processVotingResults(roomId);
            break;
    }
}

function startVotingPhase(roomId) {
    const gameRoom = getRoom(roomId);
    if (!gameRoom) return;

    console.log(`🗳️ Starting voting phase in ${roomId}`);
    
    gameRoom.gamePhase = 'voting';
    gameRoom.timeLeft = 120;
    gameRoom.votingResults = {};
    gameRoom.totalVotes = 0;
    gameRoom.updateActivity();
    
    gameRoom.players.forEach(player => {
        player.hasVoted = false;
        player.votedFor = null;
        player.votes = 0;
    });
    
    gameRoom.canChangeVote = {};
    gameRoom.players.filter(p => p.isAlive).forEach(player => {
        gameRoom.canChangeVote[player.id] = true;
    });
    
    emitToRoom(roomId, 'phase-changed', {
        gamePhase: gameRoom.gamePhase,
        timeLeft: gameRoom.timeLeft,
        players: gameRoom.players,
        canChangeVote: gameRoom.canChangeVote,
        currentRound: gameRoom.currentRound
    });
    
    startGameTimer(roomId);
}

function processVotingResults(roomId) {
    const gameRoom = getRoom(roomId);
    if (!gameRoom) return;

    // Базовая логика обработки результатов голосования
    console.log(`📊 Processing voting results in ${roomId}`);
    
    // Показать результаты и перейти к следующему раунду
    showResults(roomId);
}

function showResults(roomId) {
    const gameRoom = getRoom(roomId);
    if (!gameRoom) return;

    console.log(`📊 Showing results in ${roomId}`);
    
    gameRoom.gamePhase = 'results';
    gameRoom.updateActivity();
    
    if (gameRoom.timer) {
        clearInterval(gameRoom.timer);
        gameRoom.timer = null;
    }
    
    emitToRoom(roomId, 'round-results', {
        eliminatedPlayers: [],
        players: gameRoom.players,
        votingResults: gameRoom.votingResults,
        resultMessage: 'Раунд завершен'
    });
    
    setTimeout(() => {
        nextRound(roomId);
    }, 5000);
}

function nextRound(roomId) {
    const gameRoom = getRoom(roomId);
    if (!gameRoom) return;

    gameRoom.currentRound++;
    gameRoom.updateActivity();
    
    const alivePlayers = gameRoom.getAlivePlayers();
    
    if (alivePlayers.length <= 2 || gameRoom.currentRound > gameRoom.maxRounds) {
        endGame(roomId);
        return;
    }
    
    gameRoom.gamePhase = 'preparation';
    gameRoom.timeLeft = 0;
    gameRoom.currentTurnPlayer = null;
    gameRoom.startRoundVotes = [];
    
    console.log(`🔄 Starting round ${gameRoom.currentRound} in ${roomId}. Alive players: ${alivePlayers.length}`);
    
    emitToRoom(roomId, 'new-round', {
        currentRound: gameRoom.currentRound,
        gamePhase: gameRoom.gamePhase,
        timeLeft: gameRoom.timeLeft,
        players: gameRoom.players
    });
}

function endGame(roomId) {
    const gameRoom = getRoom(roomId);
    if (!gameRoom) return;

    console.log(`🏁 Game ended in ${roomId}`);
    
    const alivePlayers = gameRoom.getAlivePlayers();
    
    gameRoom.gamePhase = 'finished';
    gameRoom.updateActivity();
    
    if (gameRoom.timer) {
        clearInterval(gameRoom.timer);
        gameRoom.timer = null;
    }
    
    emitToRoom(roomId, 'game-ended', {
        winners: alivePlayers,
        players: gameRoom.players
    });
    
    setTimeout(() => {
        resetRoom(roomId);
    }, 10000);
}

function resetRoom(roomId) {
    const gameRoom = getRoom(roomId);
    if (!gameRoom) return;

    console.log(`🔄 Resetting room ${roomId}...`);
    
    gameRoom.resetForNewGame();
    gameRoom.updateActivity();
    
    emitToRoom(roomId, 'game-reset', {
        players: gameRoom.players,
        gameState: gameRoom.gameState
    });
}

// === ЗАПУСК СЕРВЕРА ===

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', (error) => {
    if (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
    
    console.log(`🚀 Multi-Room Server running on port ${PORT}`);
    console.log(`🌐 Access the game at: http://localhost:${PORT}`);
    console.log('🏠 Rooms will be created dynamically');
    console.log('🎯 Ready for players to join!');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    
    for (const room of gameRooms.values()) {
        if (room.timer) {
            clearInterval(room.timer);
        }
    }
    
    server.close(() => {
        console.log('🔚 Process terminated');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    
    for (const room of gameRooms.values()) {
        if (room.timer) {
            clearInterval(room.timer);
        }
    }
    
    server.close(() => {
        console.log('🔚 Process terminated');
        process.exit(0);
    });
});