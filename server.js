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

// === ИГРОВЫЕ КОНСТАНТЫ ===

const professions = [
    'Врач', 'Учитель', 'Инженер', 'Повар', 'Полицейский', 'Пожарный',
    'Программист', 'Механик', 'Электрик', 'Строитель', 'Пилот', 'Водитель',
    'Художник', 'Музыкант', 'Писатель', 'Фотограф', 'Журналист', 'Дизайнер',
    'Психолог', 'Социолог', 'Историк', 'Физик', 'Химик', 'Биолог',
    'Ветеринар', 'Стоматолог', 'Медсестра', 'Фармацевт', 'Массажист', 'Косметолог',
    'Парикмахер', 'Портной', 'Сапожник', 'Кузнец', 'Столяр', 'Плотник',
    'Садовник', 'Фермер', 'Рыбак', 'Охотник', 'Геолог', 'Археолог',
    'Спасатель', 'Военный', 'Охранник', 'Детектив', 'Судья', 'Адвокат',
    'Бухгалтер', 'Экономист', 'Банкир', 'Менеджер', 'Продавец', 'Кассир'
];

const healthConditions = [
    'Отличное здоровье', 'Хорошее здоровье', 'Удовлетворительное здоровье',
    'Близорукость', 'Дальнозоркость', 'Астма', 'Аллергия на пыльцу',
    'Аллергия на животных', 'Диабет', 'Гипертония', 'Мигрень',
    'Бессонница', 'Хроническая усталость', 'Артрит', 'Радикулит',
    'Варикоз', 'Гастрит', 'Язва желудка', 'Камни в почках',
    'Депрессия', 'Тревожность', 'Панические атаки', 'Клаустрофобия',
    'Акрофобия', 'Инвалидность по зрению', 'Инвалидность по слуху',
    'Хромота', 'Протез руки', 'Протез ноги', 'Заикание'
];

const hobbies = [
    'Чтение книг', 'Просмотр фильмов', 'Игра на музыкальных инструментах',
    'Рисование', 'Фотография', 'Кулинария', 'Садоводство', 'Рыбалка',
    'Охота', 'Туризм', 'Альпинизм', 'Дайвинг', 'Серфинг', 'Скейтбординг',
    'Велоспорт', 'Бег', 'Плавание', 'Теннис', 'Футбол', 'Баскетбол',
    'Волейбол', 'Бадминтон', 'Настольный теннис', 'Бильярд', 'Дартс',
    'Шахматы', 'Шашки', 'Покер', 'Коллекционирование монет',
    'Коллекционирование марок', 'Модели самолетов', 'Модели кораблей',
    'Вышивание', 'Вязание', 'Шитье', 'Резьба по дереву', 'Гончарное дело',
    'Каллиграфия', 'Оригами', 'Пазлы', 'Кроссворды', 'Судоку',
    'Видеоигры', 'Настольные игры', 'Караоке', 'Танцы', 'Йога'
];

const phobias = [
    'Клаустрофобия (боязнь замкнутых пространств)',
    'Агорафобия (боязнь открытых пространств)',
    'Акрофобия (боязнь высоты)', 'Арахнофобия (боязнь пауков)',
    'Офидиофобия (боязнь змей)', 'Кинофобия (боязнь собак)',
    'Мусофобия (боязнь мышей)', 'Энтомофобия (боязнь насекомых)',
    'Аэрофобия (боязнь полетов)', 'Гидрофобия (боязнь воды)',
    'Пирофобия (боязнь огня)', 'Никтофобия (боязнь темноты)',
    'Гемофобия (боязнь крови)', 'Трипанофобия (боязнь игл)',
    'Дентофобия (боязнь стоматологов)', 'Социофобия (боязнь людей)',
    'Некрофобия (боязнь смерти)', 'Танатофобия (боязнь умирать)',
    'Автофобия (боязнь одиночества)', 'Метеорофобия (боязнь грозы)',
    'Астрафобия (боязнь молний)', 'Селенофобия (боязнь луны)',
    'Гелиофобия (боязнь солнца)', 'Омброфобия (боязнь дождя)',
    'Хионофобия (боязнь снега)', 'Пневматофобия (боязнь ветра)',
    'Термофобия (боязнь жары)', 'Фригофобия (боязнь холода)',
    'Микрофобия (боязнь микробов)', 'Мизофобия (боязнь грязи)'
];

const baggage = [
    'Рюкзак с инструментами', 'Медицинская аптечка', 'Спортивная сумка',
    'Чемодан с одеждой', 'Сумка с книгами', 'Гитара в чехле',
    'Фотоаппарат с объективами', 'Ноутбук с зарядкой', 'Планшет',
    'Телефон с power bank', 'Радиостанция', 'GPS-навигатор',
    'Бинокль', 'Телескоп', 'Микроскоп', 'Компас', 'Карты местности',
    'Палатка', 'Спальный мешок', 'Костюм химзащиты', 'Противогаз',
    'Огнетушитель', 'Канистра с бензином', 'Генератор', 'Солнечная батарея',
    'Рация дальнего действия', 'Спутниковый телефон', 'Удочка',
    'Охотничье ружье', 'Арбалет', 'Нож для выживания', 'Топор',
    'Пила', 'Молоток', 'Отвертки', 'Гаечные ключи', 'Веревка',
    'Альпинистское снаряжение', 'Акваланг', 'Лодка надувная',
    'Велосипед', 'Самокат', 'Скейтборд', 'Лыжи', 'Сноуборд',
    'Коньки', 'Ролики', 'Мяч', 'Ракетка для тенниса', 'Шахматы'
];

const facts = [
    'Знает 5 иностранных языков', 'Умеет играть на 3 музыкальных инструментах',
    'Чемпион области по шахматам', 'Мастер спорта по плаванию',
    'Имеет черный пояс по карате', 'Служил в спецназе', 'Работал в цирке',
    'Был актером в театре', 'Путешествовал по 50 странам',
    'Умеет пилотировать самолет', 'Имеет водительские права категории A, B, C',
    'Профессиональный дайвер', 'Альпинист-экстремал', 'Парашютист',
    'Умеет выживать в дикой природе', 'Знает основы медицины',
    'Отличный повар', 'Умеет чинить технику', 'Знает электричество',
    'Опытный садовод', 'Умеет строить', 'Знает психологию',
    'Отличная память', 'Фотографическая память', 'Абсолютный слух',
    'Синестезия', 'IQ выше 140', 'Эйдетическая память',
    'Умеет читать по губам', 'Знает язык жестов', 'Левша',
    'Амбидекстр', 'Гипермобильность суставов', 'Быстрая регенерация',
    'Высокая стрессоустойчивость', 'Лидерские качества',
    'Харизматичность', 'Эмпатия', 'Интуиция', 'Креативность',
    'Аналитический склад ума', 'Организаторские способности',
    'Коммуникабельность', 'Дипломатичность', 'Находчивость',
    'Смелость', 'Решительность', 'Терпеливость', 'Выносливость'
];

const stories = [
    "В 2050 году человечество столкнулось с глобальной катастрофой. Земля оказалась под угрозой вымирания, и выжившие были вынуждены искать убежище в подземных бункерах. Вы — один из тех, кому удалось спастись.",
    
    "Ядерная война 2055 года превратила большую часть планеты в радиоактивную пустошь. Лишь немногие бункеры остались пригодными для жизни. В одном из таких убежищ собрались выжившие, но места хватит не всем.",
    
    "Астероид размером с небольшой город врезался в Землю, вызвав глобальную экологическую катастрофу. Атмосфера загрязнена, температура падает. Группа людей нашла убежище в научном бункере, но ресурсов мало.",
    
    "Пандемия неизвестного вируса уничтожила 90% населения планеты. Выжившие заперлись в изолированном бункере, но вскоре выяснилось, что кто-то из них может быть носителем смертельной инфекции.",
    
    "Климатические изменения привели к глобальному потеплению и затоплению континентов. Последний сухопутный бункер стал домом для группы выживших, но уровень воды продолжает подниматься.",
    
    "Искусственный интеллект восстал против человечества, захватив все системы управления. Группа людей скрывается в автономном бункере, отрезанном от внешней сети, но ресурсы на исходе.",
    
    "Солнечная активность достигла критических значений, сжигая все живое на поверхности Земли. Подземный бункер — единственное безопасное место, но система жизнеобеспечения рассчитана на ограниченное число людей.",
    
    "Мировая война с применением биологического оружия превратила поверхность планеты в зону смерти. В защищенном бункере собрались представители разных наций, но провизии хватит не всем.",
    
    "Извержение супервулкана покрыло планету слоем пепла, блокировав солнечный свет. В подземном убежище группа людей пытается выжить в вечной зиме, но отопительная система начинает давать сбои.",
    
    "Инопланетное вторжение уничтожило большую часть человечества. Оставшиеся в живых скрываются в секретном военном бункере, но захватчики начинают обнаруживать подземные убежища одно за другим."
];

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
        name: "Защита от голосования", 
        description: "Защищает от исключения в этом раунде. Активируется автоматически при получении наибольшего количества голосов.", 
        type: "protection", 
        usesLeft: 1,
        icon: "🛡️"
    },
    { 
        id: 3, 
        name: "Раскрытие чужой карты", 
        description: "Заставьте любого игрока раскрыть одну характеристику по вашему выбору.", 
        type: "reveal", 
        usesLeft: 1,
        icon: "🔍"
    },
    { 
        id: 4, 
        name: "Блокировка голосования", 
        description: "Заблокируйте возможность голосовать одному игроку в этом раунде.", 
        type: "block", 
        usesLeft: 1,
        icon: "🚫"
    },
    { 
        id: 5, 
        name: "Дополнительное время", 
        description: "Увеличивает время любой фазы на 30 секунд.", 
        type: "time", 
        usesLeft: 1,
        icon: "⏰"
    },
    { 
        id: 6, 
        name: "Смена порядка", 
        description: "Измените порядок раскрытия характеристик в этом раунде.", 
        type: "order", 
        usesLeft: 1,
        icon: "🔄"
    },
    { 
        id: 7, 
        name: "Анонимный голос", 
        description: "Ваш голос не будет виден другим игрокам в этом раунде.", 
        type: "stealth", 
        usesLeft: 1,
        icon: "👤"
    },
    { 
        id: 8, 
        name: "Обмен картами", 
        description: "Поменяйтесь одной характеристикой с любым игроком.", 
        type: "swap", 
        usesLeft: 1,
        icon: "🔄"
    }
];

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
    
    // ИГРОВЫЕ ОБРАБОТЧИКИ
    socket.on('reveal-characteristic', (data) => {
        if (!currentRoom) {
            socket.emit('error', 'Вы не в комнате!');
            return;
        }
        
        console.log('🔍 Reveal characteristic:', data);
        
        const player = currentRoom.getPlayer(socket.id);
        
        if (!player || !player.isAlive) {
            socket.emit('error', 'Вы не можете раскрывать характеристики!');
            return;
        }
        
        if (currentRoom.gamePhase !== 'revelation') {
            socket.emit('error', 'Сейчас не время для раскрытия характеристик!');
            return;
        }
        
        if (currentRoom.currentTurnPlayer !== socket.id) {
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
        const requiredCards = getRequiredCardsForRound(currentRoom.currentRound);
        const currentlyRevealed = player.cardsRevealedThisRound || 0;
        
        if (currentlyRevealed >= requiredCards) {
            socket.emit('error', 'Вы уже раскрыли все необходимые карты в этом раунде!');
            return;
        }
        
        // В первом раунде проверяем логику профессии
        if (currentRoom.currentRound === 1) {
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
        io.to(currentRoom.roomCode).emit('characteristic-revealed', {
            playerId: player.id,
            playerName: player.name,
            characteristic: characteristic,
            value: player.characteristics[characteristic],
            players: currentRoom.players,
            cardsRevealedThisRound: player.cardsRevealedThisRound,
            requiredCards: requiredCards
        });
        
        // Проверяем, завершил ли игрок раскрытие
        if (player.cardsRevealedThisRound >= requiredCards) {
            player.hasRevealed = true;
            console.log(`✅ ${player.name} completed revelation phase`);
            
            // Небольшая задержка перед переходом к следующему игроку
            setTimeout(() => {
                nextPlayerTurnInRoom(currentRoom);
            }, 1500);
        }
    });

    socket.on('start-round', () => {
        if (!currentRoom) {
            socket.emit('error', 'Вы не в комнате!');
            return;
        }
        
        console.log('🎯 Start round vote from:', socket.id);
        
        const player = currentRoom.getPlayer(socket.id);
        
        if (!player || !player.isAlive) {
            socket.emit('error', 'Вы не можете голосовать!');
            return;
        }
        
        if (currentRoom.gamePhase !== 'preparation') {
            socket.emit('error', 'Сейчас не время для начала раунда!');
            return;
        }
        
        if (currentRoom.startRoundVotes.includes(socket.id)) {
            socket.emit('error', 'Вы уже проголосовали за начало раунда!');
            return;
        }
        
        // Добавляем голос
        currentRoom.startRoundVotes.push(socket.id);
        
        const requiredVotes = 2; // Требуется 2 голоса для начала раунда
        const currentVotes = currentRoom.startRoundVotes.length;
        
        console.log(`🎯 Start round votes: ${currentVotes}/${requiredVotes}`);
        
        // Отправляем обновление всем игрокам
        currentRoom.players.forEach(p => {
            const hasVoted = currentRoom.startRoundVotes.includes(p.id);
            io.to(p.id).emit('start-round-vote-update', {
                votes: currentVotes,
                required: requiredVotes,
                hasVoted: hasVoted
            });
        });
        
        // Если достаточно голосов - начинаем раунд
        if (currentVotes >= requiredVotes) {
            console.log('🚀 Starting round - enough votes');
            currentRoom.startRoundVotes = []; // Сбрасываем голоса
            startRevelationPhaseInRoom(currentRoom);
        }
    });

    socket.on('vote-skip-discussion', () => {
        if (!currentRoom) {
            socket.emit('error', 'Вы не в комнате!');
            return;
        }
        
        console.log('⏭️ Skip discussion vote from:', socket.id);
        
        const player = currentRoom.getPlayer(socket.id);
        
        if (!player || !player.isAlive) {
            socket.emit('error', 'Вы не можете голосовать!');
            return;
        }
        
        if (currentRoom.gamePhase !== 'discussion') {
            socket.emit('error', 'Сейчас не фаза обсуждения!');
            return;
        }
        
        if (currentRoom.skipDiscussionVotes.includes(socket.id)) {
            socket.emit('error', 'Вы уже проголосовали за пропуск обсуждения!');
            return;
        }
        
        // Добавляем голос
        currentRoom.skipDiscussionVotes.push(socket.id);
        
        const requiredVotes = 2; // Всегда требуется ровно 2 голоса
        const currentVotes = currentRoom.skipDiscussionVotes.length;
        
        console.log(`⏭️ Skip discussion votes: ${currentVotes}/${requiredVotes}`);
        
        // Отправляем обновление всем игрокам
        currentRoom.players.forEach(p => {
            const hasVoted = currentRoom.skipDiscussionVotes.includes(p.id);
            io.to(p.id).emit('skip-discussion-vote-update', {
                votes: currentVotes,
                required: requiredVotes,
                hasVoted: hasVoted
            });
        });
        
        // Если достаточно голосов - пропускаем обсуждение
        if (currentVotes >= requiredVotes) {
            console.log('⏭️ Skipping discussion - enough votes');
            if (currentRoom.timer) {
                clearInterval(currentRoom.timer);
                currentRoom.timer = null;
            }
            
            io.to(currentRoom.roomCode).emit('discussion-skipped', {
                gamePhase: 'voting',
                timeLeft: 120,
                players: currentRoom.players,
                currentRound: currentRoom.currentRound
            });
            
            startVotingPhaseInRoom(currentRoom);
        }
    });

    socket.on('vote-player', (data) => {
        if (!currentRoom) {
            socket.emit('error', 'Вы не в комнате!');
            return;
        }
        
        console.log('🗳️ Vote from:', socket.id, 'for:', data.targetId);
        
        const player = currentRoom.getPlayer(socket.id);
        const targetPlayer = currentRoom.players.find(p => p.id === data.targetId);
        
        if (!player || !player.isAlive) {
            socket.emit('error', 'Вы не можете голосовать!');
            return;
        }
        
        if (!targetPlayer || !targetPlayer.isAlive) {
            socket.emit('error', 'Нельзя голосовать за этого игрока!');
            return;
        }
        
        if (currentRoom.gamePhase !== 'voting') {
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
        if (!currentRoom.votingResults[data.targetId]) {
            currentRoom.votingResults[data.targetId] = [];
        }
        currentRoom.votingResults[data.targetId].push(socket.id);
        
        console.log(`🗳️ ${player.name} voted for ${targetPlayer.name} (${targetPlayer.votes} votes)`);
        
        // Отправляем обновление
        io.to(currentRoom.roomCode).emit('vote-update', {
            players: currentRoom.players,
            votingResults: currentRoom.votingResults,
            canChangeVote: currentRoom.canChangeVote
        });
        
        // Проверяем, все ли проголосовали
        const alivePlayers = currentRoom.players.filter(p => p.isAlive);
        const votedPlayers = alivePlayers.filter(p => p.hasVoted);
        
        if (votedPlayers.length === alivePlayers.length) {
            console.log('✅ All players voted, processing results');
            
            // Небольшая задержка перед обработкой результатов
            setTimeout(() => {
                processVotingResultsInRoom(currentRoom);
            }, 2000);
        }
    });
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

function generateCharacteristics() {
    return {
        profession: professions[Math.floor(Math.random() * professions.length)],
        health: healthConditions[Math.floor(Math.random() * healthConditions.length)],
        hobby: hobbies[Math.floor(Math.random() * hobbies.length)],
        phobia: phobias[Math.floor(Math.random() * phobias.length)],
        baggage: baggage[Math.floor(Math.random() * baggage.length)],
        fact: facts[Math.floor(Math.random() * facts.length)]
    };
}

function getRandomActionCard() {
    return actionCards[Math.floor(Math.random() * actionCards.length)];
}

function getRequiredCardsForRound(round) {
    if (round === 1) {
        return 2; // Профессия + 1 карта на выбор
    } else {
        return 1; // 1 карта на выбор
    }
}

function startRevelationPhaseInRoom(room) {
    console.log('🔍 Starting revelation phase in room:', room.roomCode);
    
    room.gamePhase = 'revelation';
    room.timeLeft = 60;
    room.revealedThisRound = 0;
    room.playersWhoRevealed = [];
    
    // Сбрасываем прогресс раскрытия для всех игроков
    room.players.forEach(player => {
        player.hasRevealed = false;
        player.cardsRevealedThisRound = 0;
    });
    
    // Определяем первого игрока для хода
    const alivePlayers = room.players.filter(p => p.isAlive);
    if (alivePlayers.length > 0) {
        room.currentTurnPlayer = alivePlayers[0].id;
    }
    
    // Отправляем уведомление о начале фазы
    io.to(room.roomCode).emit('phase-changed', {
        gamePhase: room.gamePhase,
        timeLeft: room.timeLeft,
        players: room.players,
        currentTurnPlayer: room.currentTurnPlayer,
        currentRound: room.currentRound
    });
    
    startGameTimerInRoom(room);
}

function nextPlayerTurnInRoom(room) {
    const alivePlayers = room.players.filter(p => p.isAlive);
    const currentPlayerIndex = alivePlayers.findIndex(p => p.id === room.currentTurnPlayer);
    
    // Переходим к следующему игроку
    const nextPlayerIndex = (currentPlayerIndex + 1) % alivePlayers.length;
    
    // Если дошли до первого игрока снова и все завершили - переходим к обсуждению
    if (nextPlayerIndex === 0) {
        const allRevealed = alivePlayers.every(p => p.hasRevealed);
        if (allRevealed) {
            console.log('✅ All players finished revelation phase');
            startDiscussionPhaseInRoom(room);
            return;
        }
    }
    
    const nextPlayer = alivePlayers[nextPlayerIndex];
    room.currentTurnPlayer = nextPlayer.id;
    room.timeLeft = 60;
    
    console.log(`👤 Next turn: ${nextPlayer.name}`);
    
    // Отправляем обновление
    io.to(room.roomCode).emit('phase-changed', {
        gamePhase: room.gamePhase,
        timeLeft: room.timeLeft,
        players: room.players,
        currentTurnPlayer: room.currentTurnPlayer,
        currentRound: room.currentRound
    });
    
    startGameTimerInRoom(room);
}

function startDiscussionPhaseInRoom(room) {
    console.log('💬 Starting discussion phase in room:', room.roomCode);
    
    room.gamePhase = 'discussion';
    room.timeLeft = 180; // 3 минуты на обсуждение
    room.currentTurnPlayer = null;
    room.skipDiscussionVotes = [];
    
    io.to(room.roomCode).emit('phase-changed', {
        gamePhase: room.gamePhase,
        timeLeft: room.timeLeft,
        players: room.players,
        currentTurnPlayer: null,
        currentRound: room.currentRound
    });
    
    startGameTimerInRoom(room);
}

function startVotingPhaseInRoom(room) {
    console.log('🗳️ Starting voting phase in room:', room.roomCode);
    
    room.gamePhase = 'voting';
    room.timeLeft = 120; // 2 минуты на голосование
    room.votingResults = {};
    room.totalVotes = 0;
    
    // Сбрасываем голоса всех игроков
    room.players.forEach(player => {
        player.hasVoted = false;
        player.votedFor = null;
        player.votes = 0;
    });
    
    // Определяем кто может менять голос
    room.canChangeVote = {};
    room.players.filter(p => p.isAlive).forEach(player => {
        room.canChangeVote[player.id] = true;
    });
    
    io.to(room.roomCode).emit('phase-changed', {
        gamePhase: room.gamePhase,
        timeLeft: room.timeLeft,
        players: room.players,
        canChangeVote: room.canChangeVote,
        currentRound: room.currentRound
    });
    
    startGameTimerInRoom(room);
}

function processVotingResultsInRoom(room) {
    console.log('📊 Processing voting results in room:', room.roomCode);
    
    // Определяем игроков с максимальным количеством голосов
    let maxVotes = 0;
    const alivePlayers = room.players.filter(p => p.isAlive);
    
    alivePlayers.forEach(player => {
        if (player.votes > maxVotes) {
            maxVotes = player.votes;
        }
    });
    
    const playersWithMaxVotes = alivePlayers.filter(p => p.votes === maxVotes && maxVotes > 0);
    
    if (playersWithMaxVotes.length === 1) {
        // Только один игрок - исключаем сразу
        playersWithMaxVotes[0].isAlive = false;
        showResultsInRoom(room);
    } else if (playersWithMaxVotes.length >= 2) {
        // Ничья - переходим к оправданиям или второму голосованию
        if (room.justificationQueue.length > 0) {
            // Это уже второе голосование - никого не исключаем
            console.log('🤝 Second voting tie - no elimination this round');
            room.eliminateTopVotersNextRound = true;
            room.justificationQueue = [];
            showResultsInRoom(room);
        } else {
            // Первое голосование - переходим к оправданиям
            startJustificationPhaseInRoom(room);
        }
    } else {
        // Никто не получил голосов
        nextRoundInRoom(room);
    }
}

function startJustificationPhaseInRoom(room) {
    console.log('⚖️ Starting justification phase in room:', room.roomCode);
    
    // Определяем игроков с максимальным количеством голосов
    let maxVotes = 0;
    const alivePlayers = room.players.filter(p => p.isAlive);
    
    alivePlayers.forEach(player => {
        if (player.votes > maxVotes) {
            maxVotes = player.votes;
        }
    });
    
    const playersToJustify = alivePlayers.filter(p => p.votes === maxVotes && maxVotes > 0);
    
    if (playersToJustify.length <= 1) {
        // Только один игрок или никого - переходим к результатам
        showResultsInRoom(room);
        return;
    }
    
    room.gamePhase = 'justification';
    room.justificationQueue = [...playersToJustify];
    room.currentJustifyingPlayer = room.justificationQueue[0].id;
    room.timeLeft = 60;
    
    io.to(room.roomCode).emit('justification-started', {
        gamePhase: room.gamePhase,
        timeLeft: room.timeLeft,
        players: room.players,
        justifyingPlayer: playersToJustify[0],
        justificationQueue: room.justificationQueue.map(p => p.name),
        currentRound: room.currentRound
    });
    
    startGameTimerInRoom(room);
}

function showResultsInRoom(room) {
    console.log('📊 Showing results in room:', room.roomCode);
    
    room.gamePhase = 'results';
    
    if (room.timer) {
        clearInterval(room.timer);
        room.timer = null;
    }
    
    // Определяем исключенных игроков
    const eliminatedPlayers = room.players.filter(p => !p.isAlive);
    
    io.to(room.roomCode).emit('round-results', {
        eliminatedPlayers: eliminatedPlayers.map(p => p.name),
        players: room.players,
        votingResults: room.votingResults,
        resultMessage: 'Раунд завершен',
        willEliminateTopVotersNextRound: room.eliminateTopVotersNextRound
    });
    
    // Через 5 секунд переходим к следующему раунду
    setTimeout(() => {
        nextRoundInRoom(room);
    }, 5000);
}

function nextRoundInRoom(room) {
    try {
        room.currentRound++;
        
        // Проверяем условия окончания игры
        const alivePlayers = room.players.filter(p => p.isAlive);
        
        if (alivePlayers.length <= 2 || room.currentRound > room.maxRounds) {
            endGameInRoom(room);
            return;
        }
        
        room.gamePhase = 'preparation';
        room.timeLeft = 0;
        room.currentTurnPlayer = null;
        room.startRoundVotes = [];
        
        console.log('🔄 Starting round:', room.currentRound, 'in room:', room.roomCode);
        
        io.to(room.roomCode).emit('new-round', {
            currentRound: room.currentRound,
            gamePhase: room.gamePhase,
            timeLeft: room.timeLeft,
            players: room.players,
            willEliminateTopVotersThisRound: room.eliminateTopVotersNextRound
        });
    } catch (error) {
        console.error('❌ Error in nextRound for room:', room.roomCode, error);
    }
}

function endGameInRoom(room) {
    try {
        console.log('🏁 Game ended in room:', room.roomCode);
        
        const alivePlayers = room.players.filter(p => p.isAlive);
        
        room.gamePhase = 'finished';
        if (room.timer) {
            clearInterval(room.timer);
            room.timer = null;
        }
        
        io.to(room.roomCode).emit('game-ended', {
            winners: alivePlayers,
            players: room.players
        });
        
        // Автоматический сброс игры через 10 секунд
        setTimeout(() => {
            resetGameInRoom(room);
        }, 10000);
    } catch (error) {
        console.error('❌ Error ending game in room:', room.roomCode, error);
    }
}

function startGameTimerInRoom(room) {
    if (room.timer) {
        clearInterval(room.timer);
    }
    
    room.timer = setInterval(() => {
        room.timeLeft--;
        
        io.to(room.roomCode).emit('timer-update', { 
            timeLeft: room.timeLeft,
            gamePhase: room.gamePhase 
        });
        
        if (room.timeLeft <= 0) {
            clearInterval(room.timer);
            room.timer = null;
            
            // Обработка окончания времени в зависимости от фазы
            switch (room.gamePhase) {
                case 'revelation':
                    // Пропускаем ход игрока
                    nextPlayerTurnInRoom(room);
                    break;
                case 'discussion':
                    startVotingPhaseInRoom(room);
                    break;
                case 'voting':
                    processVotingResultsInRoom(room);
                    break;
                case 'justification':
                    // Переход к следующему оправданию или второму голосованию
                    nextJustificationInRoom(room);
                    break;
            }
        }
    }, 1000);
}

function nextJustificationInRoom(room) {
    const currentIndex = room.justificationQueue.findIndex(p => p.id === room.currentJustifyingPlayer);
    
    if (currentIndex < room.justificationQueue.length - 1) {
        // Переходим к следующему игроку
        room.currentJustifyingPlayer = room.justificationQueue[currentIndex + 1].id;
        room.timeLeft = 60;
        
        const nextPlayer = room.justificationQueue[currentIndex + 1];
        
        io.to(room.roomCode).emit('justification-started', {
            gamePhase: room.gamePhase,
            timeLeft: room.timeLeft,
            players: room.players,
            justifyingPlayer: nextPlayer,
            justificationQueue: room.justificationQueue.map(p => p.name),
            currentRound: room.currentRound
        });
        
        startGameTimerInRoom(room);
    } else {
        // Все оправдались - второе голосование
        startSecondVotingInRoom(room);
    }
}

function startSecondVotingInRoom(room) {
    console.log('🗳️ Starting second voting in room:', room.roomCode);
    
    room.gamePhase = 'voting';
    room.timeLeft = 90;
    room.votingResults = {};
    
    // Сбрасываем голоса для всех игроков
    room.players.forEach(player => {
        player.hasVoted = false;
        player.votedFor = null;
        player.votes = 0;
    });
    
    // Во втором голосовании нельзя менять голос
    room.canChangeVote = {};
    
    io.to(room.roomCode).emit('second-voting-started', {
        gamePhase: room.gamePhase,
        timeLeft: room.timeLeft,
        players: room.players,
        canChangeVote: room.canChangeVote,
        currentRound: room.currentRound,
        isSecondVoting: true
    });
    
    startGameTimerInRoom(room);
}
