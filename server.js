const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

console.log('🚀 Starting Single Room Bunker Game Server...');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// === МАССИВЫ КАРТ ДЕЙСТВИЙ И ХАРАКТЕРИСТИКИ ===

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
  "Вирус, вырвавшийся из секретной лаборатории, уничтож
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
        res.json({ 
            status: 'OK', 
            timestamp: new Date().toISOString(),
            players: gameRoom ? gameRoom.players.length : 0,
            gameState: gameRoom ? gameRoom.gameState : 'unknown',
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

// Catch-all для неопределенных роутов
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
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
    pendingEliminationNextRound: false,
    eliminateTopVotersNextRound: false
};

// === ЕДИНСТВЕННЫЙ ОБРАБОТЧИК ПОДКЛЮЧЕНИЙ ===
io.on('connection', (socket) => {
    console.log('🔗 New connection:', socket.id);
    
    // Отправляем текущее количество игроков
    socket.emit('player-count', { count: gameRoom.players.length });
    
    // === ОБРАБОТЧИК ПРИСОЕДИНЕНИЯ К ИГРЕ ===
    socket.on('join-game', (data) => {
        console.log('👋 Player joining:', data.playerName, 'Socket:', socket.id);
        
        const playerName = data.playerName?.trim();
        
        if (!playerName || playerName.length < 2 || playerName.length > 20) {
            socket.emit('error', 'Неверное имя игрока');
            return;
        }
        
        // Проверяем только ЖИВЫХ игроков и исключаем текущий socket
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
        
        // Удаляем предыдущего игрока с таким же socket.id если он есть
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
            isHost: gameRoom.players.length === 0,
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
    
    // === ОБРАБОТЧИК ОТКЛЮЧЕНИЯ ===
    socket.on('disconnect', () => {
        console.log('❌ Player disconnected:', socket.id);
        
        const playerIndex = gameRoom.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
            const player = gameRoom.players[playerIndex];
            console.log('👋 Player left:', player.name);
            
            gameRoom.players.splice(playerIndex, 1);
            
            if (player.isHost && gameRoom.players.length > 0) {
                gameRoom.players[0].isHost = true;
                console.log('👑 New host:', gameRoom.players[0].name);
            }
            
            if (gameRoom.players.length === 0 || (gameRoom.gameState === 'playing' && gameRoom.players.length < 2)) {
                resetGame();
            } else {
                io.to('game-room').emit('player-left', {
                    players: gameRoom.players,
                    gameState: gameRoom.gameState
                });
            }
        }
    });
    
    // === ОБРАБОТЧИК ИЗМЕНЕНИЯ КОЛИЧЕСТВА ИГРОКОВ ===
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
    
    // === ОБРАБОТЧИК СТАРТА ИГРЫ ===
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
        gameRoom.startRoundVotes = [];
        
        const randomStory = stories[Math.floor(Math.random() * stories.length)];
        
        console.log('🚀 Game started! Players:', gameRoom.players.length);
        
        io.to('game-room').emit('game-started', {
            players: gameRoom.players,
            gameState: gameRoom.gameState,
            gamePhase: gameRoom.gamePhase,
            currentRound: gameRoom.currentRound,
            timeLeft: gameRoom.timeLeft,
            story: randomStory
        });
    });
    
    // === ОБРАБОТЧИК ГОЛОСОВАНИЯ ЗА НАЧАЛО РАУНДА ===
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
        
        gameRoom.startRoundVotes.push(socket.id);
        
        const requiredVotes = 2;
        const currentVotes = gameRoom.startRoundVotes.length;
        
        console.log(`🎯 Start round votes: ${currentVotes}/${requiredVotes}`);
        
        gameRoom.players.forEach(p => {
            const hasVoted = gameRoom.startRoundVotes.includes(p.id);
            io.to(p.id).emit('start-round-vote-update', {
                votes: currentVotes,
                required: requiredVotes,
                hasVoted: hasVoted
            });
        });
        
        if (currentVotes >= requiredVotes) {
            console.log('🚀 Starting round - enough votes');
            gameRoom.startRoundVotes = [];
            startRevelationPhase();
        }
    });
    
    // === ОБРАБОТЧИК РАСКРЫТИЯ ХАРАКТЕРИСТИК ===
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
        
        const requiredCards = getRequiredCardsForRound(gameRoom.currentRound);
        const currentlyRevealed = player.cardsRevealedThisRound || 0;
        
        if (currentlyRevealed >= requiredCards) {
            socket.emit('error', 'Вы уже раскрыли все необходимые карты в этом раунде!');
            return;
        }
        
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
        
        io.to('game-room').emit('characteristic-revealed', {
            playerId: player.id,
            playerName: player.name,
            characteristic: characteristic,
            value: player.characteristics[characteristic],
            players: gameRoom.players,
            cardsRevealedThisRound: player.cardsRevealedThisRound,
            requiredCards: requiredCards
        });
        
        if (player.cardsRevealedThisRound >= requiredCards) {
            player.hasRevealed = true;
            console.log(`✅ ${player.name} completed revelation phase`);
            
            setTimeout(() => {
                nextPlayerTurn();
            }, 1500);
        }
    });
    
    // === ОБРАБОТЧИК ПРОПУСКА ОБСУЖДЕНИЯ ===
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
        
        gameRoom.skipDiscussionVotes.push(socket.id);
        
        const requiredVotes = 2;
        const currentVotes = gameRoom.skipDiscussionVotes.length;
        
        console.log(`⏭️ Skip discussion votes: ${currentVotes}/${requiredVotes}`);
        
        gameRoom.players.forEach(p => {
            const hasVoted = gameRoom.skipDiscussionVotes.includes(p.id);
            io.to(p.id).emit('skip-discussion-vote-update', {
                votes: currentVotes,
                required: requiredVotes,
                hasVoted: hasVoted
            });
        });
        
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
    
    // === ОБРАБОТЧИК ГОЛОСОВАНИЯ ===
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
        
        console.log(`🗳️ Votes: ${votedPlayers.length}/${alivePlayers.length}`);
        
        if (votedPlayers.length === alivePlayers.length) {
            console.log('✅ All players voted, processing results immediately');
            
            // Останавливаем таймер и сразу обрабатываем результаты
            if (gameRoom.timer) {
                clearInterval(gameRoom.timer);
                gameRoom.timer = null;
            }
            
            // Сразу обрабатываем результаты
            processVotingResults();
        }
    });
    
    // === ОБРАБОТЧИК ЗАВЕРШЕНИЯ ОПРАВДАНИЯ ===
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
        
        nextJustification();
    });

    // === ОБРАБОТЧИК СДАЧИ ===
    socket.on('surrender', () => {
        console.log('🏳️ Surrender from:', socket.id);
        
        const player = gameRoom.players.find(p => p.id === socket.id);
        
        if (!player || !player.isAlive) {
            socket.emit('error', 'Вы не можете сдаться!');
            return;
        }
        
        player.isAlive = false;
        
        console.log(`🏳️ ${player.name} surrendered`);
        
        io.to('game-room').emit('player-surrendered', {
            playerName: player.name,
            players: gameRoom.players
        });
        
        const alivePlayers = gameRoom.players.filter(p => p.isAlive);
        if (alivePlayers.length <= 2) {
            endGame();
        } else if (gameRoom.gamePhase === 'justification') {
            nextJustification();
        }
    });
});

// === ОСТАЛЬНЫЕ ФУНКЦИИ ОСТАЮТСЯ БЕЗ ИЗМЕНЕНИЙ ===
// Функции processVotingResults, showResults, nextRound и т.д. определяются ПОСЛЕ блока io.on('connection')

// ТАКЖЕ НУЖНО ИСПРАВИТЬ обработчик голосования - убедимся что есть только один
io.on('connection', (socket) => {
    console.log('🔗 New connection:', socket.id);
    
    // Отправляем текущее количество игроков
    socket.emit('player-count', { count: gameRoom.players.length });
    
    // === ОБРАБОТЧИК ПРИСОЕДИНЕНИЯ К ИГРЕ ===
    socket.on('join-game', (data) => {
        console.log('👋 Player joining:', data.playerName, 'Socket:', socket.id);
        
        const playerName = data.playerName?.trim();
        
        if (!playerName || playerName.length < 2 || playerName.length > 20) {
            socket.emit('error', 'Неверное имя игрока');
            return;
        }
        
        // Проверяем только ЖИВЫХ игроков и исключаем текущий socket
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
        
        // Удаляем предыдущего игрока с таким же socket.id если он есть
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
            isHost: gameRoom.players.length === 0,
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
    
    // === ОБРАБОТЧИК ОТКЛЮЧЕНИЯ ===
    socket.on('disconnect', () => {
        console.log('❌ Player disconnected:', socket.id);
        
        const playerIndex = gameRoom.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
            const player = gameRoom.players[playerIndex];
            console.log('👋 Player left:', player.name);
            
            gameRoom.players.splice(playerIndex, 1);
            
            if (player.isHost && gameRoom.players.length > 0) {
                gameRoom.players[0].isHost = true;
                console.log('👑 New host:', gameRoom.players[0].name);
            }
            
            if (gameRoom.players.length === 0 || (gameRoom.gameState === 'playing' && gameRoom.players.length < 2)) {
                resetGame();
            } else {
                io.to('game-room').emit('player-left', {
                    players: gameRoom.players,
                    gameState: gameRoom.gameState
                });
            }
        }
    });
    
    // === ОБРАБОТЧИК ИЗМЕНЕНИЯ КОЛИЧЕСТВА ИГРОКОВ ===
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
    
    // === ОБРАБОТЧИК СТАРТА ИГРЫ ===
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
        gameRoom.startRoundVotes = [];
        
        const randomStory = stories[Math.floor(Math.random() * stories.length)];
        
        console.log('🚀 Game started! Players:', gameRoom.players.length);
        
        io.to('game-room').emit('game-started', {
            players: gameRoom.players,
            gameState: gameRoom.gameState,
            gamePhase: gameRoom.gamePhase,
            currentRound: gameRoom.currentRound,
            timeLeft: gameRoom.timeLeft,
            story: randomStory
        });
    });
    
    // === ОБРАБОТЧИК ГОЛОСОВАНИЯ ЗА НАЧАЛО РАУНДА ===
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
        
        gameRoom.startRoundVotes.push(socket.id);
        
        const requiredVotes = 2;
        const currentVotes = gameRoom.startRoundVotes.length;
        
        console.log(`🎯 Start round votes: ${currentVotes}/${requiredVotes}`);
        
        gameRoom.players.forEach(p => {
            const hasVoted = gameRoom.startRoundVotes.includes(p.id);
            io.to(p.id).emit('start-round-vote-update', {
                votes: currentVotes,
                required: requiredVotes,
                hasVoted: hasVoted
            });
        });
        
        if (currentVotes >= requiredVotes) {
            console.log('🚀 Starting round - enough votes');
            gameRoom.startRoundVotes = [];
            startRevelationPhase();
        }
    });
    
    // === ОБРАБОТЧИК РАСКРЫТИЯ ХАРАКТЕРИСТИК ===
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
        
        const requiredCards = getRequiredCardsForRound(gameRoom.currentRound);
        const currentlyRevealed = player.cardsRevealedThisRound || 0;
        
        if (currentlyRevealed >= requiredCards) {
            socket.emit('error', 'Вы уже раскрыли все необходимые карты в этом раунде!');
            return;
        }
        
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
        
        io.to('game-room').emit('characteristic-revealed', {
            playerId: player.id,
            playerName: player.name,
            characteristic: characteristic,
            value: player.characteristics[characteristic],
            players: gameRoom.players,
            cardsRevealedThisRound: player.cardsRevealedThisRound,
            requiredCards: requiredCards
        });
        
        if (player.cardsRevealedThisRound >= requiredCards) {
            player.hasRevealed = true;
            console.log(`✅ ${player.name} completed revelation phase`);
            
            setTimeout(() => {
                nextPlayerTurn();
            }, 1500);
        }
    });
    
    // === ОБРАБОТЧИК ПРОПУСКА ОБСУЖДЕНИЯ ===
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
        
        gameRoom.skipDiscussionVotes.push(socket.id);
        
        const requiredVotes = 2;
        const currentVotes = gameRoom.skipDiscussionVotes.length;
        
        console.log(`⏭️ Skip discussion votes: ${currentVotes}/${requiredVotes}`);
        
        gameRoom.players.forEach(p => {
            const hasVoted = gameRoom.skipDiscussionVotes.includes(p.id);
            io.to(p.id).emit('skip-discussion-vote-update', {
                votes: currentVotes,
                required: requiredVotes,
                hasVoted: hasVoted
            });
        });
        
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
    
    // === ОБРАБОТЧИК ГОЛОСОВАНИЯ ===
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
        
        console.log(`🗳️ Votes: ${votedPlayers.length}/${alivePlayers.length}`);
        
        if (votedPlayers.length === alivePlayers.length) {
            console.log('✅ All players voted, processing results immediately');
            
            // Останавливаем таймер и сразу обрабатываем результаты
            if (gameRoom.timer) {
                clearInterval(gameRoom.timer);
                gameRoom.timer = null;
            }
            
            // Сразу обрабатываем результаты
            processVotingResults();
        }
    });
    
    // === ОБРАБОТЧИК ЗАВЕРШЕНИЯ ОПРАВДАНИЯ ===
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
        
        nextJustification();
    });

    // === ОБРАБОТЧИК СДАЧИ ===
    socket.on('surrender', () => {
        console.log('🏳️ Surrender from:', socket.id);
        
        const player = gameRoom.players.find(p => p.id === socket.id);
        
        if (!player || !player.isAlive) {
            socket.emit('error', 'Вы не можете сдаться!');
            return;
        }
        
        player.isAlive = false;
        
        console.log(`🏳️ ${player.name} surrendered`);
        
        io.to('game-room').emit('player-surrendered', {
            playerName: player.name,
            players: gameRoom.players
        });
        
        const alivePlayers = gameRoom.players.filter(p => p.isAlive);
        if (alivePlayers.length <= 2) {
            endGame();
        } else if (gameRoom.gamePhase === 'justification') {
            nextJustification();
        }
    });
});

// === ОСТАЛЬНЫЕ ФУНКЦИИ ОСТАЮТСЯ БЕЗ ИЗМЕНЕНИЙ ===
// Функции processVotingResults, showResults, nextRound и т.д. определяются ПОСЛЕ блока io.on('connection')

// ТАКЖЕ НУЖНО ИСПРАВИТЬ обработчик голосования - убедимся что есть только один
io.on('connection', (socket) => {
    console.log('🔗 New connection:', socket.id);
    
    // Отправляем текущее количество игроков
    socket.emit('player-count', { count: gameRoom.players.length });
    
    // === ОБРАБОТЧИК ПРИСОЕДИНЕНИЯ К ИГРЕ ===
    socket.on('join-game', (data) => {
        console.log('👋 Player joining:', data.playerName, 'Socket:', socket.id);
        
        const playerName = data.playerName?.trim();
        
        if (!playerName || playerName.length < 2 || playerName.length > 20) {
            socket.emit('error', 'Неверное имя игрока');
            return;
        }
        
        // Проверяем только ЖИВЫХ игроков и исключаем текущий socket
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
        
        // Удаляем предыдущего игрока с таким же socket.id если он есть
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
            isHost: gameRoom.players.length === 0,
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
    
    // === ОБРАБОТЧИК ОТКЛЮЧЕНИЯ ===
    socket.on('disconnect', () => {
        console.log('❌ Player disconnected:', socket.id);
        
        const playerIndex = gameRoom.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
            const player = gameRoom.players[playerIndex];
            console.log('👋 Player left:', player.name);
            
            gameRoom.players.splice(playerIndex, 1);
            
            if (player.isHost && gameRoom.players.length > 0) {
                gameRoom.players[0].isHost = true;
                console.log('👑 New host:', gameRoom.players[0].name);
            }
            
            if (gameRoom.players.length === 0 || (gameRoom.gameState === 'playing' && gameRoom.players.length < 2)) {
                resetGame();
            } else {
                io.to('game-room').emit('player-left', {
                    players: gameRoom.players,
                    gameState: gameRoom.gameState
                });
            }
        }
    });
    
    // === ОБРАБОТЧИК ИЗМЕНЕНИЯ КОЛИЧЕСТВА ИГРОКОВ ===
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
    
    // === ОБРАБОТЧИК СТАРТА ИГРЫ ===
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
        gameRoom.startRoundVotes = [];
        
        const randomStory = stories[Math.floor(Math.random() * stories.length)];
        
        console.log('🚀 Game started! Players:', gameRoom.players.length);
        
        io.to('game-room').emit('game-started', {
            players: gameRoom.players,
            gameState: gameRoom.gameState,
            gamePhase: gameRoom.gamePhase,
            currentRound: gameRoom.currentRound,
            timeLeft: gameRoom.timeLeft,
            story: randomStory
        });
    });
    
    // === ОБРАБОТЧИК ГОЛОСОВАНИЯ ЗА НАЧАЛО РАУНДА ===
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
        
        gameRoom.startRoundVotes.push(socket.id);
        
        const requiredVotes = 2;
        const currentVotes = gameRoom.startRoundVotes.length;
        
        console.log(`🎯 Start round votes: ${currentVotes}/${requiredVotes}`);
        
        gameRoom.players.forEach(p => {
            const hasVoted = gameRoom.startRoundVotes.includes(p.id);
            io.to(p.id).emit('start-round-vote-update', {
                votes: currentVotes,
                required: requiredVotes,
                hasVoted: hasVoted
            });
        });
        
        if (currentVotes >= requiredVotes) {
            console.log('🚀 Starting round - enough votes');
            gameRoom.startRoundVotes = [];
            startRevelationPhase();
        }
    });
    
    // === ОБРАБОТЧИК РАСКРЫТИЯ ХАРАКТЕРИСТИК ===
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
        
        const requiredCards = getRequiredCardsForRound(gameRoom.currentRound);
        const currentlyRevealed = player.cardsRevealedThisRound || 0;
        
        if (currentlyRevealed >= requiredCards) {
            socket.emit('error', 'Вы уже раскрыли все необходимые карты в этом раунде!');
            return;
        }
        
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
        
        io.to('game-room').emit('characteristic-revealed', {
            playerId: player.id,
            playerName: player.name,
            characteristic: characteristic,
            value: player.characteristics[characteristic],
            players: gameRoom.players,
            cardsRevealedThisRound: player.cardsRevealedThisRound,
            requiredCards: requiredCards
        });
        
        if (player.cardsRevealedThisRound >= requiredCards) {
            player.hasRevealed = true;
            console.log(`✅ ${player.name} completed revelation phase`);
            
            setTimeout(() => {
                nextPlayerTurn();
            }, 1500);
        }
    });
    
    // === ОБРАБОТЧИК ПРОПУСКА ОБСУЖДЕНИЯ ===
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
        
        gameRoom.skipDiscussionVotes.push(socket.id);
        
        const requiredVotes = 2;
        const currentVotes = gameRoom.skipDiscussionVotes.length;
        
        console.log(`⏭️ Skip discussion votes: ${currentVotes}/${requiredVotes}`);
        
        gameRoom.players.forEach(p => {
            const hasVoted = gameRoom.skipDiscussionVotes.includes(p.id);
            io.to(p.id).emit('skip-discussion-vote-update', {
                votes: currentVotes,
                required: requiredVotes,
                hasVoted: hasVoted
            });
        });
        
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
    
    // === ОБРАБОТЧИК ГОЛОСОВАНИЯ ===
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
        
        console.log(`🗳️ Votes: ${votedPlayers.length}/${alivePlayers.length}`);
        
        if (votedPlayers.length === alivePlayers.length) {
            console.log('✅ All players voted, processing results immediately');
            
            // Останавливаем таймер и сразу обрабатываем результаты
            if (gameRoom.timer) {
                clearInterval(gameRoom.timer);
                gameRoom.timer = null;
            }
            
            // Сразу обрабатываем результаты
            processVotingResults();
        }
    });
    
    // === ОБРАБОТЧИК ЗАВЕРШЕНИЯ ОПРАВДАНИЯ ===
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
        
        nextJustification();
    });

    // === ОБРАБОТЧИК СДАЧИ ===
    socket.on('surrender', () => {
        console.log('🏳️ Surrender from:', socket.id);
        
        const player = gameRoom.players.find(p => p.id === socket.id);
        
        if (!player || !player.isAlive) {
            socket.emit('error', 'Вы не можете сдаться!');
            return;
        }
        
        player.isAlive = false;
        
        console.log(`🏳️ ${player.name} surrendered`);
        
        io.to('game-room').emit('player-surrendered', {
            playerName: player.name,
            players: gameRoom.players
        });
        
        const alivePlayers = gameRoom.players.filter(p => p.isAlive);
        if (alivePlayers.length <= 2) {
            endGame();
        } else if (gameRoom.gamePhase === 'justification') {
            nextJustification();
        }
    });
});

// === ОСТАЛЬНЫЕ ФУНКЦИИ ОСТАЮТСЯ БЕЗ ИЗМЕНЕНИЙ ===
// Функции processVotingResults, showResults, nextRound и т.д. определяются ПОСЛЕ блока io.on('connection')

// ТАКЖЕ НУЖНО ИСПРАВИТЬ обработчик голосования - убедимся что есть только один
io.on('connection', (socket) => {
    console.log('🔗 New connection:', socket.id);
    
    // Отправляем текущее количество игроков
    socket.emit('player-count', { count: gameRoom.players.length });
    
    // === ОБРАБОТЧИК ПРИСОЕДИНЕНИЯ К ИГРЕ ===
    socket.on('join-game', (data) => {
        console.log('👋 Player joining:', data.playerName, 'Socket:', socket.id);
        
        const playerName = data.playerName?.trim();
        
        if (!playerName || playerName.length < 2 || playerName.length > 20) {
            socket.emit('error', 'Неверное имя игрока');
            return;
        }
        
        // Проверяем только ЖИВЫХ игроков и исключаем текущий socket
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
        
        // Удаляем предыдущего игрока с таким же socket.id если он есть
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
            isHost: gameRoom.players.length === 0,
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
    
    // === ОБРАБОТЧИК ОТКЛЮЧЕНИЯ ===
    socket.on('disconnect', () => {
        console.log('❌ Player disconnected:', socket.id);
        
        const playerIndex = gameRoom.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
            const player = gameRoom.players[playerIndex];
            console.log('👋 Player left:', player.name);
            
            gameRoom.players.splice(playerIndex, 1);
            
            if (player.isHost && gameRoom.players.length > 0) {
                gameRoom.players[0].isHost = true;
                console.log('👑 New host:', gameRoom.players[0].name);
            }
            
            if (gameRoom.players.length === 0 || (gameRoom.gameState === 'playing' && gameRoom.players.length < 2)) {
                resetGame();
            } else {
                io.to('game-room').emit('player-left', {
                    players: gameRoom.players,
                    gameState: gameRoom.gameState
                });
            }
        }
    });
    
    // === ОБРАБОТЧИК ИЗМЕНЕНИЯ КОЛИЧЕСТВА ИГРОКОВ ===
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
    
    // === ОБРАБОТЧИК СТАРТА ИГРЫ ===
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
        gameRoom.startRoundVotes = [];
        
        const randomStory = stories[Math.floor(Math.random() * stories.length)];
        
        console.log('🚀 Game started! Players:', gameRoom.players.length);
        
        io.to('game-room').emit('game-started', {
            players: gameRoom.players,
            gameState: gameRoom.gameState,
            gamePhase: gameRoom.gamePhase,
            currentRound: gameRoom.currentRound,
            timeLeft: gameRoom.timeLeft,
            story: randomStory
        });
    });
    
    // === ОБРАБОТЧИК ГОЛОСОВАНИЯ ЗА НАЧАЛО РАУНДА ===
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
        
        gameRoom.startRoundVotes.push(socket.id);
        
        const requiredVotes = 2;
        const currentVotes = gameRoom.startRoundVotes.length;
        
        console.log(`🎯 Start round votes: ${currentVotes}/${requiredVotes}`);
        
        gameRoom.players.forEach(p => {
            const hasVoted = gameRoom.startRoundVotes.includes(p.id);
            io.to(p.id).emit('start-round-vote-update', {
                votes: currentVotes,
                required: requiredVotes,
                hasVoted: hasVoted
            });
        });
        
        if (currentVotes >= requiredVotes) {
            console.log('🚀 Starting round - enough votes');
            gameRoom.startRoundVotes = [];
            startRevelationPhase();
        }
    });
    
    // === ОБРАБОТЧИК РАСКРЫТИЯ ХАРАКТЕРИСТИК ===
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
        
        const requiredCards = getRequiredCardsForRound(gameRoom.currentRound);
        const currentlyRevealed = player.cardsRevealedThisRound || 0;
        
        if (currentlyRevealed >= requiredCards) {
            socket.emit('error', 'Вы уже раскрыли все необходимые карты в этом раунде!');
            return;
        }
        
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
        
        io.to('game-room').emit('characteristic-revealed', {
            playerId: player.id,
            playerName: player.name,
            characteristic: characteristic,
            value: player.characteristics[characteristic],
            players: gameRoom.players,
            cardsRevealedThisRound: player.cardsRevealedThisRound,
            requiredCards: requiredCards
        });
        
        if (player.cardsRevealedThisRound >= requiredCards) {
            player.hasRevealed = true;
            console.log(`✅ ${player.name} completed revelation phase`);
            
            setTimeout(() => {
                nextPlayerTurn();
            }, 1500);
        }
    });
    
    // === ОБРАБОТЧИК ПРОПУСКА ОБСУЖДЕНИЯ ===
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
        
        gameRoom.skipDiscussionVotes.push(socket.id);
        
        const requiredVotes = 2;
        const currentVotes = gameRoom.skipDiscussionVotes.length;
        
        console.log(`⏭️ Skip discussion votes: ${currentVotes}/${requiredVotes}`);
        
        gameRoom.players.forEach(p => {
            const hasVoted = gameRoom.skipDiscussionVotes.includes(p.id);
            io.to(p.id).emit('skip-discussion-vote-update', {
                votes: currentVotes,
                required: requiredVotes,
                hasVoted: hasVoted
            });
        });
        
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
    
    // === ОБРАБОТЧИК ГОЛОСОВАНИЯ ===
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
        
        console.log(`🗳️ Votes: ${votedPlayers.length}/${alivePlayers.length}`);
        
        if (votedPlayers.length === alivePlayers.length) {
            console.log('✅ All players voted, processing results immediately');
            
            // Останавливаем таймер и сразу обрабатываем результаты
            if (gameRoom.timer) {
                clearInterval(gameRoom.timer);
                gameRoom.timer = null;
            }
            
            // Сразу обрабатываем результаты
            processVotingResults();
        }
    });
    
    // === ОБРАБОТЧИК ЗАВЕРШЕНИЯ ОПРАВДАНИЯ ===
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
        
        nextJustification();
    });

    // === ОБРАБОТЧИК СДАЧИ ===
    socket.on('surrender', () => {
        console.log('🏳️ Surrender from:', socket.id);
        
        const player = gameRoom.players.find(p => p.id === socket.id);
        
        if (!player || !player.isAlive) {
            socket.emit('error', 'Вы не можете сдаться!');
            return;
        }
        
        player.isAlive = false;
        
        console.log(`🏳️ ${player.name} surrendered`);
        
        io.to('game-room').emit('player-surrendered', {
            playerName: player.name,
            players: gameRoom.players
        });
        
        const alivePlayers = gameRoom.players.filter(p => p.isAlive);
        if (alivePlayers.length <= 2) {
            endGame();
        } else if (gameRoom.gamePhase === 'justification') {
            nextJustification();
        }
    });
});

// === ОСТАЛЬНЫЕ ФУНКЦИИ ОСТАЮТСЯ БЕЗ ИЗМЕНЕНИЙ ===
// Функции processVotingResults, showResults, nextRound и т.д. определяются ПОСЛЕ блока io.on('connection')

// ТАКЖЕ НУЖНО ИСПРАВИТЬ обработчик голосования - убедимся что есть только один
io.on('connection', (socket) => {
    console.log('🔗 New connection:', socket.id);
    
    // Отправляем текущее количество игроков
    socket.emit('player-count', { count: gameRoom.players.length });
    
    // === ОБРАБОТЧИК ПРИСОЕДИНЕНИЯ К ИГРЕ ===
    socket.on('join-game', (data) => {
        console.log('👋 Player joining:', data.playerName, 'Socket:', socket.id);
        
        const playerName = data.playerName?.trim();
        
        if (!playerName || playerName.length < 2 || playerName.length > 20) {
            socket.emit('error', 'Неверное имя игрока');
            return;
        }
        
        // Проверяем только ЖИВЫХ игроков и исключаем текущий socket
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
        
        // Удаляем предыдущего игрока с таким же socket.id если он есть
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
            isHost: gameRoom.players.length === 0,
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
    
    // === ОБРАБОТЧИК ОТКЛЮЧЕНИЯ ===
    socket.on('disconnect', () => {
        console.log('❌ Player disconnected:', socket.id);
        
        const playerIndex = gameRoom.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
            const player = gameRoom.players[playerIndex];
            console.log('👋 Player left:', player.name);
            
            gameRoom.players.splice(playerIndex, 1);
            
            if (player.isHost && gameRoom.players.length > 0) {
                gameRoom.players[0].isHost = true;
                console.log('👑 New host:', gameRoom.players[0].name);
            }
            
            if (gameRoom.players.length === 0 || (gameRoom.gameState === 'playing' && gameRoom.players.length < 2)) {
                resetGame();
            } else {
                io.to('game-room').emit('player-left', {
                    players: gameRoom.players,
                    gameState: gameRoom.gameState
                });
            }
        }
    });
    
    // === ОБРАБОТЧИК ИЗМЕНЕНИЯ КОЛИЧЕСТВА ИГРОКОВ ===
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
    
    // === ОБРАБОТЧИК СТАРТА ИГРЫ ===
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
        gameRoom.startRoundVotes = [];
        
        const randomStory = stories[Math.floor(Math.random() * stories.length)];
        
        console.log('🚀 Game started! Players:', gameRoom.players.length);
        
        io.to('game-room').emit('game-started', {
            players: gameRoom.players,
            gameState: gameRoom.gameState,
            gamePhase: gameRoom.gamePhase,
            currentRound: gameRoom.currentRound,
            timeLeft: gameRoom.timeLeft,
            story: randomStory
        });
    });
    
    // === ОБРАБОТЧИК ГОЛОСОВАНИЯ ЗА НАЧАЛО РАУНДА ===
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
        
        gameRoom.startRoundVotes.push(socket.id);
        
        const requiredVotes = 2;
        const currentVotes = gameRoom.startRoundVotes.length;
        
        console.log(`🎯 Start round votes: ${currentVotes}/${requiredVotes}`);
        
        gameRoom.players.forEach(p => {
            const hasVoted = gameRoom.startRoundVotes.includes(p.id);
            io.to(p.id).emit('start-round-vote-update', {
                votes: currentVotes,
                required: requiredVotes,
                hasVoted: hasVoted
            });
        });
        
        if (currentVotes >= requiredVotes) {
            console.log('🚀 Starting round - enough votes');
            gameRoom.startRoundVotes = [];
            startRevelationPhase();
        }
    });
    
    // === ОБРАБОТЧИК РАСКРЫТИЯ ХАРАКТЕРИСТИК ===
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
        
        const requiredCards = getRequiredCardsForRound(gameRoom.currentRound);
        const currentlyRevealed = player.cardsRevealedThisRound || 0;
        
        if (currentlyRevealed >= requiredCards) {
            socket.emit('error', 'Вы уже раскрыли все необходимые карты в этом раунде!');
            return;
        }
        
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
        
        io.to('game-room').emit('characteristic-revealed', {
            playerId: player.id,
            playerName: player.name,
            characteristic: characteristic,
            value: player.characteristics[characteristic],
            players: gameRoom.players,
            cardsRevealedThisRound: player.cardsRevealedThisRound,
            requiredCards: requiredCards
        });
        
        if (player.cardsRevealedThisRound >= requiredCards) {
            player.hasRevealed = true;
            console.log(`✅ ${player.name} completed revelation phase`);
            
            setTimeout(() => {
                nextPlayerTurn();
            }, 1500);
        }
    });
    
    // === ОБРАБОТЧИК ПРОПУСКА ОБСУЖДЕНИЯ ===
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
        
        gameRoom.skipDiscussionVotes.push(socket.id);
        
        const requiredVotes = 2;
        const currentVotes = gameRoom.skipDiscussionVotes.length;
        
        console.log(`⏭️ Skip discussion votes: ${currentVotes}/${requiredVotes}`);
        
        gameRoom.players.forEach(p => {
            const hasVoted = gameRoom.skipDiscussionVotes.includes(p.id);
            io.to(p.id).emit('skip-discussion-vote-update', {
                votes: currentVotes,
                required: requiredVotes,
                hasVoted: hasVoted
            });
        });
        
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
    
    // === ОБРАБОТЧИК ГОЛОСОВАНИЯ ===
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
        
        console.log(`🗳️ Votes: ${votedPlayers.length}/${alivePlayers.length}`);
        
        if (votedPlayers.length === alivePlayers.length) {
            console.log('✅ All players voted, processing results immediately');
            
            // Останавливаем таймер и сразу обрабатываем результаты
            if (gameRoom.timer) {
                clearInterval(gameRoom.timer);
                gameRoom.timer = null;
            }
            
            // Сразу обрабатываем результаты
            processVotingResults();
        }
    });
    
    // === ОБРАБОТЧИК ЗАВЕРШЕНИЯ ОПРАВДАНИЯ ===
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
        
        nextJustification();
    });

    // === ОБРАБОТЧИК СДАЧИ ===
    socket.on('surrender', () => {
        console.log('🏳️ Surrender from:', socket.id);
        
        const player = gameRoom.players.find(p => p.id === socket.id);
        
        if (!player || !player.isAlive) {
            socket.emit('error', 'Вы не можете сдаться!');
            return;
        }
        
        player.isAlive = false;
        
        console.log(`🏳️ ${player.name} surrendered`);
        
        io.to('game-room').emit('player-surrendered', {
            playerName: player.name,
            players: gameRoom.players
        });
        
        const alivePlayers = gameRoom.players.filter(p => p.isAlive);
        if (alivePlayers.length <= 2) {
            endGame();
        } else if (gameRoom.gamePhase === 'justification') {
            nextJustification();
        }
    });
});

// === ОСТАЛЬНЫЕ ФУНКЦИИ ОСТАЮТСЯ БЕЗ ИЗМЕНЕНИЙ ===
// Функции processVotingResults, showResults, nextRound и т.д. определяются ПОСЛЕ блока io.on('connection')

// ТАКЖЕ НУЖНО ИСПРАВИТЬ обработчик голосования - убедимся что есть только один
io.on('connection', (socket) => {
    console.log('🔗 New connection:', socket.id);
    
    // Отправляем текущее количество игроков
    socket.emit('player-count', { count: gameRoom.players.length });
    
    // === ОБРАБОТЧИК ПРИСОЕДИНЕНИЯ К ИГРЕ ===
    socket.on('join-game', (data) => {
        console.log('👋 Player joining:', data.playerName, 'Socket:', socket.id);
        
        const playerName = data.playerName?.trim();
        
        if (!playerName || playerName.length < 2 || playerName.length > 20) {
            socket.emit('error', 'Неверное имя игрока');
            return;
        }
        
        // Проверяем только ЖИВЫХ игроков и исключаем текущий socket
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
        
        // Удаляем предыдущего игрока с таким же socket.id если он есть
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
            isHost: gameRoom.players.length === 0,
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
    
    // === ОБРАБОТЧИК ОТКЛЮЧЕНИЯ ===
    socket.on('disconnect', () => {
        console.log('❌ Player disconnected:', socket.id);
        
        const playerIndex = gameRoom.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
            const player = gameRoom.players[playerIndex];
            console.log('👋 Player left:', player.name);
            
            gameRoom.players.splice(playerIndex, 1);
            
            if (player.isHost && gameRoom.players.length > 0) {
                gameRoom.players[0].isHost = true;
                console.log('👑 New host:', gameRoom.players[0].name);
            }
            
            if (gameRoom.players.length === 0 || (gameRoom.gameState === 'playing' && gameRoom.players.length < 2)) {
                resetGame();
            } else {
                io.to('game-room').emit('player-left', {
                    players: gameRoom.players,
                    gameState: gameRoom.gameState
                });
            }
        }
    });
    
    // === ОБРАБОТЧИК ИЗМЕНЕНИЯ КОЛИЧЕСТВА ИГРОКОВ ===
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
    
    // === ОБРАБОТЧИК СТАРТА ИГРЫ ===
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
        gameRoom.startRoundVotes = [];
        
        const randomStory = stories[Math.floor(Math.random() * stories.length)];
        
        console.log('🚀 Game started! Players:', gameRoom.players.length);
        
        io.to('game-room').emit('game-started', {
            players: gameRoom.players,
            gameState: gameRoom.gameState,
            gamePhase: gameRoom.gamePhase,
            currentRound: gameRoom.currentRound,
            timeLeft: gameRoom.timeLeft,
            story: randomStory
        });
    });
    
    // === ОБРАБОТЧИК ГОЛОСОВАНИЯ ЗА НАЧАЛО РАУНДА ===
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
        
        gameRoom.startRoundVotes.push(socket.id);
        
        const requiredVotes = 2;
        const currentVotes = gameRoom.startRoundVotes.length;
        
        console.log(`🎯 Start round votes: ${currentVotes}/${requiredVotes}`);
        
        gameRoom.players.forEach(p => {
            const hasVoted = gameRoom.startRoundVotes.includes(p.id);
            io.to(p.id).emit('start-round-vote-update', {
                votes: currentVotes,
                required: requiredVotes,
                hasVoted: hasVoted
            });
        });
        
        if (currentVotes >= requiredVotes) {
            console.log('🚀 Starting round - enough votes');
            gameRoom.startRoundVotes = [];
            startRevelationPhase();
        }
    });
    
    // === ОБРАБОТЧИК РАСКРЫТИЯ ХАРАКТЕРИСТИК ===
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
        
        const requiredCards = getRequiredCardsForRound(gameRoom.currentRound);
        const currentlyRevealed = player.cardsRevealedThisRound || 0;
        
        if (currentlyRevealed >= requiredCards) {
            socket.emit('error', 'Вы уже раскрыли все необходимые карты в этом раунде!');
            return;
        }
        
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
        
        io.to('game-room').emit('characteristic-revealed', {
            playerId: player.id,
            playerName: player.name,
            characteristic: characteristic,
            value: player.characteristics[characteristic],
            players: gameRoom.players,
            cardsRevealedThisRound: player.cardsRevealedThisRound,
            requiredCards: requiredCards
        });
        
        if (player.cardsRevealedThisRound >= requiredCards) {
            player.hasRevealed = true;
            console.log(`✅ ${player.name} completed revelation phase`);
            
            setTimeout(() => {
                nextPlayerTurn();
            }, 1500);
        }
    });
    
    // === ОБРАБОТЧИК ПРОПУСКА ОБСУЖДЕНИЯ ===
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
        
        gameRoom.skipDiscussionVotes.push(socket.id);
        
        const requiredVotes = 2;
        const currentVotes = gameRoom.skipDiscussionVotes.length;
        
        console.log(`⏭️ Skip discussion votes: ${currentVotes}/${requiredVotes}`);
        
        gameRoom.players.forEach(p => {
            const hasVoted = gameRoom.skipDiscussionVotes.includes(p.id);
            io.to(p.id).emit('skip-discussion-vote-update', {
                votes: currentVotes,
                required: requiredVotes,
                hasVoted: hasVoted
            });
        });
        
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
    
    // === ОБРАБОТЧИК ГОЛОСОВАНИЯ ===
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
        
        console.log(`🗳️ Votes: ${votedPlayers.length}/${alivePlayers.length}`);
        
        if (votedPlayers.length === alivePlayers.length) {
            console.log('✅ All players voted, processing results immediately');
            
            // Останавливаем таймер и сразу обрабатываем результаты
            if (gameRoom.timer) {
                clearInterval(gameRoom.timer);
                gameRoom.timer = null;
            }
            
            // Сразу обрабатываем результаты
            processVotingResults();
        }
    });
    
    // === ОБРАБОТЧИК ЗАВЕРШЕНИЯ ОПРАВДАНИЯ ===
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
        
        nextJustification();
    });

    // === ОБРАБОТЧИК СДАЧИ ===
    socket.on('surrender', () => {
        console.log('🏳️ Surrender from:', socket.id);
        
        const player = gameRoom.players.find(p => p.id === socket.id);
        
        if (!player || !player.isAlive) {
            socket.emit('error', 'Вы не можете сдаться!');
            return;
        }
        
        player.isAlive = false;
        
        console.log(`🏳️ ${player.name} surrendered`);
        
        io.to('game-room').emit('player-surrendered', {
            playerName: player.name,
            players: gameRoom.players
        });
        
        const alivePlayers = gameRoom.players.filter(p => p.isAlive);
        if (alivePlayers.length <= 2) {
            endGame();
        } else if (gameRoom.gamePhase === 'justification') {
            nextJustification();
        }
    });
});

// === ОСТАЛЬНЫЕ ФУНКЦИИ ОСТАЮТСЯ БЕЗ ИЗМЕНЕНИЙ ===
// Функции processVotingResults, showResults, nextRound и т.д. определяются ПОСЛЕ блока io.on('connection')

// ТАКЖЕ НУЖНО ИСПРАВИТЬ обработчик голосования - убедимся что есть только один
io.on('connection', (socket) => {
    console.log('🔗 New connection:', socket.id);
    
    // Отправляем текущее количество игроков
    socket.emit('player-count', { count: gameRoom.players.length });
    
    // === ОБРАБОТЧИК ПРИСОЕДИНЕНИЯ К ИГРЕ ===
    socket.on('join-game', (data) => {
        console.log('👋 Player joining:', data.playerName, 'Socket:', socket.id);
        
        const playerName = data.playerName?.trim();
        
        if (!playerName || playerName.length < 2 || playerName.length > 20) {
            socket.emit('error', 'Неверное имя игрока');
            return;
        }
        
        // Проверяем только ЖИВЫХ игроков и исключаем текущий socket
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
        
        // Удаляем предыдущего игрока с таким же socket.id если он есть
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
            isHost: gameRoom.players.length === 0,
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
    
    // === ОБРАБОТЧИК ОТКЛЮЧЕНИЯ ===
    socket.on('disconnect', () => {
        console.log('❌ Player disconnected:', socket.id);
        
        const playerIndex = gameRoom.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
            const player = gameRoom.players[playerIndex];
            console.log('👋 Player left:', player.name);
            
            gameRoom.players.splice(playerIndex, 1);
            
            if (player.isHost && gameRoom.players.length > 0) {
                gameRoom.players[0].isHost = true;
                console.log('👑 New host:', gameRoom.players[0].name);
            }
            
            if (gameRoom.players.length === 0 || (gameRoom.gameState === 'playing' && gameRoom.players.length < 2)) {
                resetGame();
            } else {
                io.to('game-room').emit('player-left', {
                    players: gameRoom.players,
                    gameState: gameRoom.gameState
                });
            }
        }
    });
    
    // === ОБРАБОТЧИК ИЗМЕНЕНИЯ КОЛИЧЕСТВА ИГРОКОВ ===
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
    
    // === ОБРАБОТЧИК СТАРТА ИГРЫ ===
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
        gameRoom.startRoundVotes = [];
        
        const randomStory = stories[Math.floor(Math.random() * stories.length)];
        
        console.log('🚀 Game started! Players:', gameRoom.players.length);
        
        io.to('game-room').emit('game-started', {
            players: gameRoom.players,
            gameState: gameRoom.gameState,
            gamePhase: gameRoom.gamePhase,
            currentRound: gameRoom.currentRound,
            timeLeft: gameRoom.timeLeft,
            story: randomStory
        });
    });
    
    // === ОБРАБОТЧИК ГОЛОСОВАНИЯ ЗА НАЧАЛО РАУНДА ===
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
        
        gameRoom.startRoundVotes.push(socket.id);
        
        const requiredVotes = 2;
        const currentVotes = gameRoom.startRoundVotes.length;
        
        console.log(`🎯 Start round votes: ${currentVotes}/${requiredVotes}`);
        
        gameRoom.players.forEach(p => {
            const hasVoted = gameRoom.startRoundVotes.includes(p.id);
            io.to(p.id).emit('start-round-vote-update', {
                votes: currentVotes,
                required: requiredVotes,
                hasVoted: hasVoted
            });
        });
        
        if (currentVotes >= requiredVotes) {
            console.log('🚀 Starting round - enough votes');
            gameRoom.startRoundVotes = [];
            startRevelationPhase();
        }
    });
    
    // === ОБРАБОТЧИК РАСКРЫТИЯ ХАРАКТЕРИСТИК ===
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
        
        const requiredCards = getRequiredCardsForRound(gameRoom.currentRound);
        const currentlyRevealed = player.cardsRevealedThisRound || 0;
        
        if (currentlyRevealed >= requiredCards) {
            socket.emit('error', 'Вы уже раскрыли все необходимые карты в этом раунде!');
            return;
        }
        
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
        
        io.to('game-room').emit('characteristic-revealed', {
            playerId: player.id,
            playerName: player.name,
            characteristic: characteristic,
            value: player.characteristics[characteristic],
            players: gameRoom.players,
            cardsRevealedThisRound: player.cardsRevealedThisRound,
            requiredCards: requiredCards
        });
        
        if (player.cardsRevealedThisRound >= requiredCards) {
            player.hasRevealed = true;
            console.log(`✅ ${player.name} completed revelation phase`);
            
            setTimeout(() => {
                nextPlayerTurn();
            }, 1500);
        }
    });
    
    // === ОБРАБОТЧИК ПРОПУСКА ОБСУЖДЕНИЯ ===
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
        
        gameRoom.skipDiscussionVotes.push(socket.id);
        
        const requiredVotes = 2;
        const currentVotes = gameRoom.skipDiscussionVotes.length;
        
        console.log(`⏭️ Skip discussion votes: ${currentVotes}/${requiredVotes}`);
        
        gameRoom.players.forEach(p => {
            const hasVoted = gameRoom.skipDiscussionVotes.includes(p.id);
            io.to(p.id).emit('skip-discussion-vote-update', {
                votes: currentVotes,
                required: requiredVotes,
                hasVoted: hasVoted
            });
        });
        
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
    
    // === ОБРАБОТЧИК ГОЛОСОВАНИЯ ===
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
        
        console.log(`🗳️ Votes: ${votedPlayers.length}/${alivePlayers.length}`);
        
        if (votedPlayers.length === alivePlayers.length) {
            console.log('✅ All players voted, processing results immediately');
            
            // Останавливаем таймер и сразу обрабатываем результаты
            if (gameRoom.timer) {
                clearInterval(gameRoom.timer);
                gameRoom.timer = null;
            }
            
            // Сразу обрабатываем результаты
            processVotingResults();
        }
    });
    
    // === ОБРАБОТЧИК ЗАВЕРШЕНИЯ ОПРАВДАНИЯ ===
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
        
        nextJustification();
    });

    // === ОБРАБОТЧИК СДАЧИ ===
    socket.on('surrender', () => {
        console.log('🏳️ Surrender from:', socket.id);
        
        const player = gameRoom.players.find(p => p.id === socket.id);
        
        if (!player || !player.isAlive) {
            socket.emit('error', 'Вы не можете сдаться!');
            return;
        }
        
        player.isAlive = false;
        
        console.log(`🏳️ ${player.name} surrendered`);
        
        io.to('game-room').emit('player-surrendered', {
            playerName: player.name,
            players: gameRoom.players
        });
        
        const alivePlayers = gameRoom.players.filter(p => p.isAlive);
        if (alivePlayers.length <= 2) {
            endGame();
        } else if (gameRoom.gamePhase === 'justification') {
            nextJustification();
        }
    });
});

// === ОСТАЛЬНЫЕ ФУНКЦИИ ОСТАЮТСЯ БЕЗ ИЗМЕНЕНИЙ ===
// Функции processVotingResults, showResults, nextRound и т.д. определяются ПОСЛЕ блока io.on('connection')

// ТАКЖЕ НУЖНО ИСПРАВИТЬ обработчик голосования - убедимся что есть только один
io.on('connection', (socket) => {
    console.log('🔗 New connection:', socket.id);
    
    // Отправляем текущее количество игроков
    socket.emit('player-count', { count: gameRoom.players.length });
    
    // === ОБРАБОТЧИК ПРИСОЕДИНЕНИЯ К ИГРЕ ===
    socket.on('join-game', (data) => {
        console.log('👋 Player joining:', data.playerName, 'Socket:', socket.id);
        
        const playerName = data.playerName?.trim();
        
        if (!playerName || playerName.length < 2 || playerName.length > 20) {
            socket.emit('error', 'Неверное имя игрока');
            return;
        }
        
        // Проверяем только ЖИВЫХ игроков и исключаем текущий socket
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
        
        // Удаляем предыдущего игрока с таким же socket.id если он есть
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
            isHost: gameRoom.players.length === 0,
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
    
    // === ОБРАБОТЧИК ОТКЛЮЧЕНИЯ ===
    socket.on('disconnect', () => {
        console.log('❌ Player disconnected:', socket.id);
        
        const playerIndex = gameRoom.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
            const player = gameRoom.players[playerIndex];
            console.log('👋 Player left:', player.name);
            
            gameRoom.players.splice(playerIndex, 1);
            
            if (player.isHost && gameRoom.players.length > 0) {
                gameRoom.players[0].isHost = true;
                console.log('👑 New host:', gameRoom.players[0].name);
            }
            
            if (gameRoom.players.length === 0 || (gameRoom.gameState === 'playing' && gameRoom.players.length < 2)) {
                resetGame();
            } else {
                io.to('game-room').emit('player-left', {
                    players: gameRoom.players,
                    gameState: gameRoom.gameState
                });
            }
        }
    });
    
    // === ОБРАБОТЧИК ИЗМЕНЕНИЯ КОЛИЧЕСТВА ИГРОКОВ ===
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
    
    // === ОБРАБОТЧИК СТАРТА ИГРЫ ===
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
        gameRoom.startRoundVotes = [];
        
        const randomStory = stories[Math.floor(Math.random() * stories.length)];
        
        console.log('🚀 Game started! Players:', gameRoom.players.length);
        
        io.to('game-room').emit('game-started', {
            players: gameRoom.players,
            gameState: gameRoom.gameState,
            gamePhase: gameRoom.gamePhase,
            currentRound: gameRoom.currentRound,
            timeLeft: gameRoom.timeLeft,
            story: randomStory
        });
    });
    
    // === ОБРАБОТЧИК ГОЛОСОВАНИЯ ЗА НАЧАЛО РАУНДА ===
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
        
        gameRoom.startRoundVotes.push(socket.id);
        