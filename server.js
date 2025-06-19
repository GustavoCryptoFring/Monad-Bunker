const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

console.log('🚀 Starting Single Room Bunker Game Server...');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// === ОБНОВЛЕННЫЕ КАРТЫ ДЕЙСТВИЙ ===

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
        name: "Месть", 
        description: "Может состарить любого игрока на 20 лет, если вылетает (активируется автоматически при изгнании)", 
        type: "revenge", 
        usesLeft: 1,
        icon: "⚰️"
    },
    { 
        id: 3, 
        name: "Доктор", 
        description: "Может вылечить себя или ухудшить здоровье другого игрока", 
        type: "medical", 
        usesLeft: 1,
        icon: "🏥"
        },
];

// === СПЕЦИАЛЬНЫЙ СПИСОК БОЛЕЗНЕЙ ДЛЯ ДОКТОРА ===
const severeDiseases = [
    'Карликовость',
    'ДЦП', 
    'Рак',
    'Полностью слепой',
    'Глухой',
    'Инвалид',
    'Нет двух рук',
    'Нет двух ног'
];

// === МАССИВЫ ХАРАКТЕРИСТИК И СООБЩЕНИЙ ===

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

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server listening on port ${PORT}`);
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

// ИСПРАВЛЕНО: Обработчик timeout с автоматическим раскрытием карт
function handlePhaseTimeout() {
    console.log('⏰ Phase timeout:', gameRoom.gamePhase);
    
    switch (gameRoom.gamePhase) {
        case 'revelation':
            // ИСПРАВЛЕНО: Автоматически раскрываем карты если игрок не успел
            const currentPlayer = gameRoom.players.find(p => p.id === gameRoom.currentTurnPlayer);
            if (currentPlayer && currentPlayer.isAlive) {
                const requiredCards = getRequiredCardsForRound(gameRoom.currentRound);
                const currentlyRevealed = currentPlayer.cardsRevealedThisRound || 0;
                
                if (currentlyRevealed < requiredCards) {
                    console.log(`⏰ Time's up for ${currentPlayer.name}, auto-revealing remaining cards`);
                    autoRevealRemainingCards(currentPlayer);
                }
            }
            
            // Переходим к следующему игроку
            nextPlayerTurn();
            break;
        case 'discussion':
            startVotingPhase();
            break;
        case 'voting':
            // УЛУЧШЕННАЯ ЛОГИКА: Проверяем результаты голосования при таймауте
            console.log('⏰ Voting timeout - processing current results');
            
            // Подсчитываем текущие голоса
            let maxVotes = 0;
            const alivePlayers = gameRoom.players.filter(p => p.isAlive);
            
            alivePlayers.forEach(player => {
                if ((player.votes || 0) > maxVotes) {
                    maxVotes = player.votes || 0;
                }
            });
            
            const playersWithMaxVotes = alivePlayers.filter(p => (p.votes || 0) === maxVotes && maxVotes > 0);
            
            if (maxVotes === 0) {
                // Никто не голосовал - переходим к следующему раунду
                console.log('⏰ No votes cast during timeout - proceeding to next round');
                nextRound();
            } else {
                // Обрабатываем результаты как обычно
                processVotingResults();
            }
            break;
        case 'justification':
            // Время оправдания истекло - переходим к следующему
            nextJustification();
            break;
    }
}

// НОВАЯ ФУНКЦИЯ: Автоматическое раскрытие оставшихся карт
function autoRevealRemainingCards(player) {
    const requiredCards = getRequiredCardsForRound(gameRoom.currentRound);
    const currentlyRevealed = player.cardsRevealedThisRound || 0;
    const cardsToReveal = requiredCards - currentlyRevealed;
    
    if (cardsToReveal <= 0) return;
    
    // Получаем доступные для раскрытия характеристики
    const allCharacteristics = ['profession', 'health', 'hobby', 'phobia', 'baggage', 'fact1', 'fact2'];
    const alreadyRevealed = player.revealedCharacteristics || [];
    const availableCharacteristics = allCharacteristics.filter(char => 
        !alreadyRevealed.includes(char) && player.characteristics[char]
    );
    
    // В первом раунде, если профессия не раскрыта, раскрываем её первой
    if (gameRoom.currentRound === 1 && !alreadyRevealed.includes('profession')) {
        if (!player.revealedCharacteristics) {
            player.revealedCharacteristics = [];
        }
        
        player.revealedCharacteristics.push('profession');
        player.cardsRevealedThisRound = (player.cardsRevealedThisRound || 0) + 1;
        
        console.log(`🎲 Auto-revealed profession for ${player.name}: ${player.characteristics.profession}`);
        
        // Отправляем уведомление о раскрытии
        io.to('game-room').emit('characteristic-revealed', {
            playerId: player.id,
            playerName: player.name,
            characteristic: 'profession',
            value: player.characteristics.profession,
            players: gameRoom.players,
            cardsRevealedThisRound: player.cardsRevealedThisRound,
            requiredCards: requiredCards,
            autoRevealed: true
        });
        
        // Обновляем доступные характеристики
        const professionIndex = availableCharacteristics.indexOf('profession');
        if (professionIndex !== -1) {
            availableCharacteristics.splice(professionIndex, 1);
        }
    }
    
    // Раскрываем оставшиеся карты случайно - БЕЗ ASYNC/AWAIT
    const remainingToReveal = requiredCards - (player.cardsRevealedThisRound || 0);
    
    for (let i = 0; i < remainingToReveal && availableCharacteristics.length > 0; i++) {
        const randomIndex = Math.floor(Math.random() * availableCharacteristics.length);
        const characteristic = availableCharacteristics.splice(randomIndex, 1)[0];
        
        if (!player.revealedCharacteristics) {
            player.revealedCharacteristics = [];
        }
        
        player.revealedCharacteristics.push(characteristic);
        player.cardsRevealedThisRound = (player.cardsRevealedThisRound || 0) + 1;
        
        console.log(`🎲 Auto-revealed ${characteristic} for ${player.name}: ${player.characteristics[characteristic]}`);
        
        // Отправляем уведомление о раскрытии
        io.to('game-room').emit('characteristic-revealed', {
            playerId: player.id,
            playerName: player.name,
            characteristic: characteristic,
            value: player.characteristics[characteristic],
            players: gameRoom.players,
            cardsRevealedThisRound: player.cardsRevealedThisRound,
            requiredCards: requiredCards,
            autoRevealed: true
        });
    }
    
    // Отмечаем что игрок завершил раскрытие
    player.hasRevealed = true;
    
    // Уведомляем о завершении автоматического раскрытия
    io.to('game-room').emit('auto-reveal-completed', {
        playerName: player.name,
        cardsRevealed: player.cardsRevealedThisRound,
        players: gameRoom.players
    });
}

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
        
        // НОВОЕ: Если раскрывается возраст и есть модификатор - применяем его
        let displayValue = player.characteristics[characteristic];
        if (characteristic === 'age' && player.ageModifier) {
            player.characteristics[characteristic] += player.ageModifier;
            displayValue = player.characteristics[characteristic];
            player.ageModifier = 0; // Сбрасываем модификатор
            
            io.to('game-room').emit('age-modifier-applied', {
                playerName: player.name,
                newAge: displayValue,
                modifier: player.ageModifier
            });
        }
        
        console.log(`🔍 ${player.name} revealed ${characteristic}: ${displayValue}`);
        
        // Отправляем обновление всем игрокам
        io.to('game-room').emit('characteristic-revealed', {
            playerId: player.id,
            playerName: player.name,
            characteristic: characteristic,
            value: displayValue,
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
        
        // НОВОЕ: Проверяем двойной голос
        const voteWeight = (player.activeEffects && player.activeEffects.doubleVote) ? 2 : 1;
        
        // Увеличиваем счетчик голосов у цели
        targetPlayer.votes = (targetPlayer.votes || 0) + voteWeight;
        
        // Сохраняем в результатах голосования
        if (!gameRoom.votingResults[data.targetId]) {
            gameRoom.votingResults[data.targetId] = [];
        }
        gameRoom.votingResults[data.targetId].push(socket.id);
        
        console.log(`🗳️ ${player.name} voted for ${targetPlayer.name} (${voteWeight} vote${voteWeight > 1 ? 's' : ''}, total: ${targetPlayer.votes})`);
        
        // ИСПРАВЛЯЕМ: Отправляем полное обновление состояния
        io.to('game-room').emit('vote-update', {
            players: gameRoom.players,
            votingResults: gameRoom.votingResults,
            canChangeVote: gameRoom.canChangeVote,
            gamePhase: gameRoom.gamePhase,
            timeLeft: gameRoom.timeLeft
        });
        
        // Проверяем, все ли проголосовали
        const alivePlayers = gameRoom.players.filter(p => p.isAlive);
        const votedPlayers = alivePlayers.filter(p => p.hasVoted);
        
        console.log(`🗳️ Voting progress: ${votedPlayers.length}/${alivePlayers.length}`);
        
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
        
        // ИСПРАВЛЯЕМ: Правильно обрабатываем двойной голос при смене
        const voteWeight = (player.activeEffects && player.activeEffects.doubleVote) ? 2 : 1;
        
        // Убираем предыдущий голос
        if (player.votedFor) {
            const previousTarget = gameRoom.players.find(p => p.id === player.votedFor);
            if (previousTarget) {
                previousTarget.votes = Math.max(0, (previousTarget.votes || 0) - voteWeight);
            }
            
            // Убираем из результатов голосования
            if (gameRoom.votingResults[player.votedFor]) {
                gameRoom.votingResults[player.votedFor] = gameRoom.votingResults[player.votedFor].filter(id => id !== socket.id);
            }
        }
        
        // Добавляем новый голос
        player.votedFor = data.targetId;
        targetPlayer.votes = (targetPlayer.votes || 0) + voteWeight;
        
        if (!gameRoom.votingResults[data.targetId]) {
            gameRoom.votingResults[data.targetId] = [];
        }
        gameRoom.votingResults[data.targetId].push(socket.id);
        
        // Убираем возможность изменить голос еще раз
        gameRoom.canChangeVote[socket.id] = false;
        
        console.log(`🔄 ${player.name} changed vote to ${targetPlayer.name} (${voteWeight} vote${voteWeight > 1 ? 's' : ''})`);
        
        // ИСПРАВЛЯЕМ: Отправляем полное обновление состояния
        io.to('game-room').emit('vote-update', {
            players: gameRoom.players,
            votingResults: gameRoom.votingResults,
            canChangeVote: gameRoom.canChangeVote,
            gamePhase: gameRoom.gamePhase,
            timeLeft: gameRoom.timeLeft
        });
    });

    // НОВАЯ ФУНКЦИЯ: Обработка карты "Месть"
    function triggerRevengeCard(eliminatedPlayer) {
        if (!eliminatedPlayer.actionCards) return;
        
        const revengeCard = eliminatedPlayer.actionCards.find(card => 
            card.id === 2 && card.usesLeft > 0
        );
        
        if (!revengeCard) return;
        
        console.log('⚰️ Triggering revenge card for:', eliminatedPlayer.name);
        
        const alivePlayers = gameRoom.players.filter(p => p.isAlive && p.id !== eliminatedPlayer.id);
        
        if (alivePlayers.length === 0) return;
        
        // Отправляем выбор цели исключенному игроку
        io.to(eliminatedPlayer.id).emit('revenge-card-triggered', {
            cardName: revengeCard.name,
            targets: alivePlayers.map(p => ({ id: p.id, name: p.name }))
        });
    }

    // НОВАЯ ФУНКЦИЯ: Применение эффекта мести
    function applyRevengeEffect(targetId) {
        const targetPlayer = gameRoom.players.find(p => p.id === targetId);
        if (!targetPlayer) return;
        
        if (!targetPlayer.characteristics) return;
        
        // Проверяем, открыт ли возраст
        const ageRevealed = targetPlayer.revealedCharacteristics && 
                           targetPlayer.revealedCharacteristics.includes('age');
        
        if (ageRevealed) {
            // Если возраст открыт - добавляем 20 лет
            const currentAge = targetPlayer.characteristics.age;
            targetPlayer.characteristics.age = currentAge + 20;
            
            io.to('game-room').emit('revenge-applied', {
                targetName: targetPlayer.name,
                effect: `Возраст увеличен с ${currentAge} до ${targetPlayer.characteristics.age} лет`,
                players: gameRoom.players
            });
        } else {
            // Если возраст не открыт - добавляем пометку +20
            if (!targetPlayer.ageModifier) {
                targetPlayer.ageModifier = 0;
            }
            targetPlayer.ageModifier += 20;
            
            io.to('game-room').emit('revenge-applied', {
                targetName: targetPlayer.name,
                effect: `Получил модификатор возраста +20 (будет применен при раскрытии)`,
                players: gameRoom.players
            });
        }
    }

    // ИСПРАВЛЯЕМ обработчик использования карты действия
    socket.on('use-action-card', (data) => {
        console.log('✨ Action card use request:', data);
        
        const player = gameRoom.players.find(p => p.id === socket.id);
        if (!player || !player.isAlive) {
            socket.emit('error', 'Вы не можете использовать карты действий!');
            return;
        }
        
        if (!player.actionCards) {
            socket.emit('error', 'У вас нет карт действий!');
            return;
        }
        
        const actionCard = player.actionCards.find(card => card.id === data.cardId);
        if (!actionCard || actionCard.usesLeft <= 0) {
            socket.emit('error', 'Карта недоступна для использования!');
            return;
        }
        
        let success = false;
        
        switch (actionCard.id) {
            case 1: // Двойной голос
                if (gameRoom.gamePhase !== 'preparation' && gameRoom.gamePhase !== 'discussion') {
                    socket.emit('error', 'Карту "Двойной голос" нужно активировать ДО голосования!');
                    return;
                }
                
                // Активируем эффект двойного голоса
                if (!player.activeEffects) {
                    player.activeEffects = {};
                }
                player.activeEffects.doubleVote = true;
                actionCard.usesLeft = 0;
                success = true;
                
                io.to('game-room').emit('action-card-used', {
                    playerName: player.name,
                    cardName: actionCard.name,
                    effect: 'Активирован двойной голос для следующего голосования',
                    players: gameRoom.players
                });
                break;
                
            case 2: // Месть - активируется автоматически при исключении
                socket.emit('error', 'Карта "Месть" активируется автоматически при изгнании!');
                return;
                
            case 3: // Доктор
                if (!data.actionType || !data.targetId) {
                    socket.emit('error', 'Выберите действие и цель!');
                    return;
                }
                
                success = applyDoctorEffect(socket.id, data.targetId, data.actionType);
                if (success) {
                    actionCard.usesLeft = 0;
                }
                break;
        }
        
        if (success) {
            console.log(`✨ ${player.name} used ${actionCard.name}`);
            
            // Обновляем состояние для всех игроков
            io.to('game-room').emit('players-updated', {
                players: gameRoom.players
            });
        } else {
            socket.emit('error', 'Не удалось использовать карту действия!');
        }
    });
