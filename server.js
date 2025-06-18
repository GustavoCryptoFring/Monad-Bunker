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

const stories = [
    "В 2050 году человечество столкнулось с глобальной катастрофой. Земля оказалась под угрозой вымирания, и выжившие были вынуждены искать убежище в подземных бункерах. Вы — один из тех, кому удалось спастись.",
    "После разрушительной войны большая часть планеты стала непригодной для жизни. Группа людей собирается вместе, чтобы выжить в новом мире, где каждое решение может стать последним.",
    "Вирус, вырвавшийся из секретной лаборатории, уничтожил большую часть населения. Теперь спасшиеся должны не только бороться с болезнью, но и защищать ограниченные ресурсы."
];

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
    isSecondVoting: false,
    eliminateTopVotersNextRound: false
};

// === УТИЛИТЫ ===

function getRequiredCardsForRound(round) {
    if (round === 1) {
        return 2; // Профессия + 1 карта на выбор
    } else {
        return 1; // 1 карта на выбор
    }
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

function getRandomActionCard() {
    const availableCards = actionCards.filter(card => card.usesLeft > 0);
    const randomCard = getRandomElement(availableCards);
    return { ...randomCard };
}

function startGameTimer() {
    if (gameRoom.timer) {
        clearInterval(gameRoom.timer);
        gameRoom.timer = null;
    }
    
    gameRoom.timer = setInterval(() => {
        gameRoom.timeLeft--;
        
        if (gameRoom.timeLeft % 5 === 0 || gameRoom.timeLeft <= 10) {
            io.to('game-room').emit('timer-update', {
                timeLeft: gameRoom.timeLeft,
                currentTurnPlayer: gameRoom.currentTurnPlayer
            });
        }
        
        if (gameRoom.timeLeft <= 0) {
            clearInterval(gameRoom.timer);
            gameRoom.timer = null;
            handlePhaseTimeout();
        }
    }, 1000);
}

// === ОСНОВНЫЕ ИГРОВЫЕ ФУНКЦИИ ===

function handlePhaseTimeout() {
    console.log('⏰ Phase timeout:', gameRoom.gamePhase);
    
    switch (gameRoom.gamePhase) {
        case 'revelation':
            // Автоматически раскрываем карты если игрок не успел
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
            actionCards: [],
            wasProcessed: false // НОВОЕ: флаг для отслеживания обработанных игроков
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
            player.wasProcessed = false; // НОВОЕ: инициализация флага
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
        
        // ИСПРАВЛЕНО: Проверяем, это первое или второе голосование по флагу
        const isSecondVoting = gameRoom.isSecondVoting || false;
        
        if (playersWithMaxVotes.length === 1) {
            // Только один игрок - исключаем сразу
            playersWithMaxVotes[0].isAlive = false;
            console.log(`💀 Single elimination: ${playersWithMaxVotes[0].name}`);
            showResults();
            
        } else if (playersWithMaxVotes.length >= 2 && playersWithMaxVotes.length <= 3) {
            if (isSecondVoting) {
                // ИСПРАВЛЕНО: Второе голосование с ничьей - никого не исключаем, но следующий раунд будет особым
                console.log('🤝 Second voting tie - no elimination, next round will have double elimination');
                gameRoom.eliminateTopVotersNextRound = true;
                gameRoom.isSecondVoting = false; // Сбрасываем флаг
                showResults(); // Переходим к результатам БЕЗ исключения
                
            } else if (gameRoom.eliminateTopVotersNextRound) {
                // НОВАЯ ЛОГИКА: Специальный раунд - исключаем 2 игроков сразу БЕЗ оправданий
                console.log('💀💀 Special round - eliminating 2 players with max votes (no justifications)');
                
                // Исключаем всех с максимальными голосами (максимум 2)
                const playersToEliminate = playersWithMaxVotes.slice(0, 2);
                playersToEliminate.forEach(player => {
                    player.isAlive = false;
                });
                
                gameRoom.eliminateTopVotersNextRound = false; // Сбрасываем флаг
                showResults();
                
            } else {
                // Первое голосование с ничьей - идут оправдания
                console.log('⚖️ First voting tie - starting justifications');
                startJustificationPhase();
            }
            
        } else {
            // Никого не исключаем (0 голосов или более 3 игроков с одинаковыми)
            console.log('🤷 No elimination this round');
            showResults();
        }
    }

    // ИСПРАВЛЯЕМ функцию второго голосования
    function startSecondVoting() {
        console.log('🗳️ Starting second voting after justifications');
        
        gameRoom.gamePhase = 'voting';
        gameRoom.timeLeft = 90; // 1.5 минуты на второе голосование
        gameRoom.votingResults = {};
        gameRoom.isSecondVoting = true; // НОВЫЙ флаг для отслеживания второго голосования
        
        // Сбрасываем голоса для всех игроков
        gameRoom.players.forEach(player => {
            player.hasVoted = false;
            player.votedFor = null;
            player.votes = 0;
        });
        
        // Во втором голосовании нельзя менять голос
        gameRoom.canChangeVote = {};
        
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

    // ОБНОВЛЯЕМ функцию следующего раунда
    function nextRound() {
        console.log('🔄 Starting next round...');
        
        gameRoom.currentRound++;
        gameRoom.gamePhase = 'preparation';
        gameRoom.timeLeft = 0;
        gameRoom.startRoundVotes = [];
        gameRoom.skipDiscussionVotes = [];
        gameRoom.currentTurnPlayer = null;
        gameRoom.currentJustifyingPlayer = null;
        gameRoom.justificationQueue = [];
        gameRoom.isSecondVoting = false; // ВАЖНО: Сбрасываем флаг второго голосования
        
        // Проверяем условия окончания игры
        const alivePlayers = gameRoom.players.filter(p => p.isAlive);
        
        if (alivePlayers.length <= 1) {
            console.log('🏁 Game ended - 1 or fewer players remain');
            endGame();
            return;
        }
        
        if (gameRoom.currentRound > gameRoom.maxRounds) {
            console.log('🏁 Game ended - max rounds reached');
            endGame();
            return;
        }
        
        // Сбрасываем состояния игроков
        gameRoom.players.forEach(player => {
            player.hasVoted = false;
            player.votedFor = null;
            player.votes = 0;
            player.hasRevealed = false;
            player.cardsRevealedThisRound = 0;
        });
        
        console.log(`🔄 Round ${gameRoom.currentRound} started. Players alive: ${alivePlayers.length}`);
        
        // НОВОЕ: Проверяем нужно ли показать предупреждение о специальном раунде
        const willEliminateTopVoters = gameRoom.eliminateTopVotersNextRound;
        
        io.to('game-room').emit('new-round', {
            currentRound: gameRoom.currentRound,
            gamePhase: gameRoom.gamePhase,
            timeLeft: gameRoom.timeLeft,
            players: gameRoom.players,
            willEliminateTopVotersThisRound: willEliminateTopVoters
        });
    }

    // ИСПРАВЛЯЕМ функцию показа результатов
    function showResults() {
        console.log('📊 Showing round results');
        
        gameRoom.gamePhase = 'results';
        
        // Определяем исключенных игроков в этом раунде
        const eliminatedPlayers = gameRoom.players.filter(p => !p.isAlive && !p.wasProcessed);
        
        // Отмечаем обработанных игроков
        eliminatedPlayers.forEach(player => {
            player.wasProcessed = true;
        });
        
        let resultMessage = '';
        
        if (eliminatedPlayers.length > 0) {
            if (eliminatedPlayers.length === 1) {
                resultMessage = `Исключен: ${eliminatedPlayers[0].name}`;
            } else {
                resultMessage = `Исключены: ${eliminatedPlayers.map(p => p.name).join(', ')}`;
            }
        } else if (gameRoom.eliminateTopVotersNextRound) {
            resultMessage = 'Ничья во втором голосовании! В следующем раунде будут исключены 2 игрока с наибольшими голосами без оправданий!';
        } else {
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

    // ОБНОВЛЯЕМ gameRoom для добавления нового флага
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
        isSecondVoting: false,               // НОВЫЙ флаг для отслеживания второго голосования
        eliminateTopVotersNextRound: false   // Флаг двойного исключения в следующем раунде
    };

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
                player.wasProcessed = false; // НОВОЕ: сброс флага обработки
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
            gameRoom.isSecondVoting = false;         // НОВОЕ: сброс
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
    gameRoom.isSecondVoting = true; // НОВЫЙ флаг для отслеживания второго голосования
    
    // Сбрасываем голоса для всех игроков
    gameRoom.players.forEach(player => {
        player.hasVoted = false;
        player.votedFor = null;
        player.votes = 0;
    });
    
    // Во втором голосовании нельзя менять голос
    gameRoom.canChangeVote = {};
    
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
    
    // Определяем исключенных игроков в этом раунде
    const eliminatedPlayers = gameRoom.players.filter(p => !p.isAlive && !p.wasProcessed);
    
    // Отмечаем обработанных игроков
    eliminatedPlayers.forEach(player => {
        player.wasProcessed = true;
    });
    
    let resultMessage = '';
    
    if (eliminatedPlayers.length > 0) {
        if (eliminatedPlayers.length === 1) {
            resultMessage = `Исключен: ${eliminatedPlayers[0].name}`;
        } else {
            resultMessage = `Исключены: ${eliminatedPlayers.map(p => p.name).join(', ')}`;
        }
    } else if (gameRoom.eliminateTopVotersNextRound) {
        resultMessage = 'Ничья во втором голосовании! В следующем раунде будут исключены 2 игрока с наибольшими голосами без оправданий!';
    } else {
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

function nextRound() {
    console.log('🔄 Starting next round...');
    
    gameRoom.currentRound++;
    gameRoom.gamePhase = 'preparation';
    gameRoom.timeLeft = 0;
    gameRoom.startRoundVotes = [];
    gameRoom.skipDiscussionVotes = [];
    gameRoom.currentTurnPlayer = null;
    gameRoom.currentJustifyingPlayer = null;
    gameRoom.justificationQueue = [];
    gameRoom.isSecondVoting = false; // ВАЖНО: Сбрасываем флаг второго голосования
    
    // Проверяем условия окончания игры
    const alivePlayers = gameRoom.players.filter(p => p.isAlive);
    
    if (alivePlayers.length <= 1) {
        console.log('🏁 Game ended - 1 or fewer players remain');
        endGame();
        return;
    }
    
    if (gameRoom.currentRound > gameRoom.maxRounds) {
        console.log('🏁 Game ended - max rounds reached');
        endGame();
        return;
    }
    
    // Сбрасываем состояния игроков
    gameRoom.players.forEach(player => {
        player.hasVoted = false;
        player.votedFor = null;
        player.votes = 0;
        player.hasRevealed = false;
        player.cardsRevealedThisRound = 0;
    });
    
    console.log(`🔄 Round ${gameRoom.currentRound} started. Players alive: ${alivePlayers.length}`);
    
    // НОВОЕ: Проверяем нужно ли показать предупреждение о специальном раунде
    const willEliminateTopVoters = gameRoom.eliminateTopVotersNextRound;
    
    io.to('game-room').emit('new-round', {
        currentRound: gameRoom.currentRound,
        gamePhase: gameRoom.gamePhase,
        timeLeft: gameRoom.timeLeft,
        players: gameRoom.players,
        willEliminateTopVotersThisRound: willEliminateTopVoters
    });
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
            player.wasProcessed = false; // НОВОЕ: сброс флага обработки
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
        gameRoom.isSecondVoting = false;         // НОВОЕ: сброс
        gameRoom.eliminateTopVotersNextRound = false;  // НОВОЕ: сброс
        
        io.to('game-room').emit('game-reset', {
            players: gameRoom.players,
            gameState: gameRoom.gameState
        });
    } catch (error) {
        console.error('❌ Error resetting game:', error);
    }
}

// === ОБРАБОТЧИКИ WebSocket ===

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
            actionCards: [],
            wasProcessed: false // НОВОЕ: флаг для отслеживания обработанных игроков
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
            player.wasProcessed = false; // НОВОЕ: инициализация флага
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
        
        // ИСПРАВЛЕНО: Проверяем, это первое или второе голосование по флагу
        const isSecondVoting = gameRoom.isSecondVoting || false;
        
        if (playersWithMaxVotes.length === 1) {
            // Только один игрок - исключаем сразу
            playersWithMaxVotes[0].isAlive = false;
            console.log(`💀 Single elimination: ${playersWithMaxVotes[0].name}`);
            showResults();
            
        } else if (playersWithMaxVotes.length >= 2 && playersWithMaxVotes.length <= 3) {
            if (isSecondVoting) {
                // ИСПРАВЛЕНО: Второе голосование с ничьей - никого не исключаем, но следующий раунд будет особым
                console.log('🤝 Second voting tie - no elimination, next round will have double elimination');
                gameRoom.eliminateTopVotersNextRound = true;
                gameRoom.isSecondVoting = false; // Сбрасываем флаг
                showResults(); // Переходим к результатам БЕЗ исключения
                
            } else if (gameRoom.eliminateTopVotersNextRound) {
                // НОВАЯ ЛОГИКА: Специальный раунд - исключаем 2 игроков сразу БЕЗ оправданий
                console.log('💀💀 Special round - eliminating 2 players with max votes (no justifications)');
                
                // Исключаем всех с максимальными голосами (максимум 2)
                const playersToEliminate = playersWithMaxVotes.slice(0, 2);
                playersToEliminate.forEach(player => {
                    player.isAlive = false;
                });
                
                gameRoom.eliminateTopVotersNextRound = false; // Сбрасываем флаг
                showResults();
                
            } else {
                // Первое голосование с ничьей - идут оправдания
                console.log('⚖️ First voting tie - starting justifications');
                startJustificationPhase();
            }
            
        } else {
            // Никого не исключаем (0 голосов или более 3 игроков с одинаковыми)
            console.log('🤷 No elimination this round');
            showResults();
        }
    }

    // ИСПРАВЛЯЕМ функцию второго голосования
    function startSecondVoting() {
        console.log('🗳️ Starting second voting after justifications');
        
        gameRoom.gamePhase = 'voting';
        gameRoom.timeLeft = 90; // 1.5 минуты на второе голосование
        gameRoom.votingResults = {};
        gameRoom.isSecondVoting = true; // НОВЫЙ флаг для отслеживания второго голосования
        
        // Сбрасываем голоса для всех игроков
        gameRoom.players.forEach(player => {
            player.hasVoted = false;
            player.votedFor = null;
            player.votes = 0;
        });
        
        // Во втором голосовании нельзя менять голос
        gameRoom.canChangeVote = {};
        
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

    // ОБНОВЛЯЕМ функцию следующего раунда
    function nextRound() {
        console.log('🔄 Starting next round...');
        
        gameRoom.currentRound++;
        gameRoom.gamePhase = 'preparation';
        gameRoom.timeLeft = 0;
        gameRoom.startRoundVotes = [];
        gameRoom.skipDiscussionVotes = [];
        gameRoom.currentTurnPlayer = null;
        gameRoom.currentJustifyingPlayer = null;
        gameRoom.justificationQueue = [];
        gameRoom.isSecondVoting = false; // ВАЖНО: Сбрасываем флаг второго голосования
        
        // Проверяем условия окончания игры
        const alivePlayers = gameRoom.players.filter(p => p.isAlive);
        
        if (alivePlayers.length <= 1) {
            console.log('🏁 Game ended - 1 or fewer players remain');
            endGame();
            return;
        }
        
        if (gameRoom.currentRound > gameRoom.maxRounds) {
            console.log('🏁 Game ended - max rounds reached');
            endGame();
            return;
        }
        
        // Сбрасываем состояния игроков
        gameRoom.players.forEach(player => {
            player.hasVoted = false;
            player.votedFor = null;
            player.votes = 0;
            player.hasRevealed = false;
            player.cardsRevealedThisRound = 0;
        });
        
        console.log(`🔄 Round ${gameRoom.currentRound} started. Players alive: ${alivePlayers.length}`);
        
        // НОВОЕ: Проверяем нужно ли показать предупреждение о специальном раунде
        const willEliminateTopVoters = gameRoom.eliminateTopVotersNextRound;
        
        io.to('game-room').emit('new-round', {
            currentRound: gameRoom.currentRound,
            gamePhase: gameRoom.gamePhase,
            timeLeft: gameRoom.timeLeft,
            players: gameRoom.players,
            willEliminateTopVotersThisRound: willEliminateTopVoters
        });
    }

    // ИСПРАВЛЯЕМ функцию показа результатов
    function showResults() {
        console.log('📊 Showing round results');
        
        gameRoom.gamePhase = 'results';
        
        // Определяем исключенных игроков в этом раунде
        const eliminatedPlayers = gameRoom.players.filter(p => !p.isAlive && !p.wasProcessed);
        
        // Отмечаем обработанных игроков
        eliminatedPlayers.forEach(player => {
            player.wasProcessed = true;
        });
        
        let resultMessage = '';
        
        if (eliminatedPlayers.length > 0) {
            if (eliminatedPlayers.length === 1) {
                resultMessage = `Исключен: ${eliminatedPlayers[0].name}`;
            } else {
                resultMessage = `Исключены: ${eliminatedPlayers.map(p => p.name).join(', ')}`;
            }
        } else if (gameRoom.eliminateTopVotersNextRound) {
            resultMessage = 'Ничья во втором голосовании! В следующем раунде будут исключены 2 игрока с наибольшими голосами без оправданий!';
        } else {
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

    // ОБНОВЛЯЕМ gameRoom для добавления нового флага
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
        isSecondVoting: false,               // НОВЫЙ флаг для отслеживания второго голосования
        eliminateTopVotersNextRound: false   // Флаг двойного исключения в следующем раунде
    };

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
                player.wasProcessed = false; // НОВОЕ: сброс флага обработки
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
            gameRoom.isSecondVoting = false;         // НОВОЕ: сброс
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
    gameRoom.isSecondVoting = true; // НОВЫЙ флаг для отслеживания второго голосования
    
    // Сбрасываем голоса для всех игроков
    gameRoom.players.forEach(player => {
        player.hasVoted = false;
        player.votedFor = null;
        player.votes = 0;
    });
    
    // Во втором голосовании нельзя менять голос
    gameRoom.canChangeVote = {};
    
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
    
    // Определяем исключенных игроков в этом раунде
    const eliminatedPlayers = gameRoom.players.filter(p => !p.isAlive && !p.wasProcessed);
    
    // Отмечаем обработанных игроков
    eliminatedPlayers.forEach(player => {
        player.wasProcessed = true;
    });
    
    let resultMessage = '';
    
    if (eliminatedPlayers.length > 0) {
        if (eliminatedPlayers.length === 1) {
            resultMessage = `Исключен: ${eliminatedPlayers[0].name}`;
        } else {
            resultMessage = `Исключены: ${eliminatedPlayers.map(p => p.name).join(', ')}`;
        }
    } else if (gameRoom.eliminateTopVotersNextRound) {
        resultMessage = 'Ничья во втором голосовании! В следующем раунде будут исключены 2 игрока с наибольшими голосами без оправданий!';
    } else {
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

function nextRound() {
    console.log('🔄 Starting next round...');
    
    gameRoom.currentRound++;
    gameRoom.gamePhase = 'preparation';
    gameRoom.timeLeft = 0;
    gameRoom.startRoundVotes = [];
    gameRoom.skipDiscussionVotes = [];
    gameRoom.currentTurnPlayer = null;
    gameRoom.currentJustifyingPlayer = null;
    gameRoom.justificationQueue = [];
    gameRoom.isSecondVoting = false; // ВАЖНО: Сбрасываем флаг второго голосования
    
    // Проверяем условия окончания игры
    const alivePlayers = gameRoom.players.filter(p => p.isAlive);
    
    if (alivePlayers.length <= 1) {
        console.log('🏁 Game ended - 1 or fewer players remain');
        endGame();
        return;
    }
    
    if (gameRoom.currentRound > gameRoom.maxRounds) {
        console.log('🏁 Game ended - max rounds reached');
        endGame();
        return;
    }
    
    // Сбрасываем состояния игроков
    gameRoom.players.forEach(player => {
        player.hasVoted = false;
        player.votedFor = null;
        player.votes = 0;
        player.hasRevealed = false;
        player.cardsRevealedThisRound = 0;
    });
    
    console.log(`🔄 Round ${gameRoom.currentRound} started. Players alive: ${alivePlayers.length}`);
    
    // НОВОЕ: Проверяем нужно ли показать предупреждение о специальном раунде
    const willEliminateTopVoters = gameRoom.eliminateTopVotersNextRound;
    
    io.to('game-room').emit('new-round', {
        currentRound: gameRoom.currentRound,
        gamePhase: gameRoom.gamePhase,
        timeLeft: gameRoom.timeLeft,
        players: gameRoom.players,
        willEliminateTopVotersThisRound: willEliminateTopVoters
    });
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
            player.wasProcessed = false; // НОВОЕ: сброс флага обработки
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
        gameRoom.isSecondVoting = false;         // НОВОЕ: сброс
        gameRoom.eliminateTopVotersNextRound = false;  // НОВОЕ: сброс
        
        io.to('game-room').emit('game-reset', {
            players: gameRoom.players,
            gameState: gameRoom.gameState
        });
    } catch (error) {
        console.error('❌ Error resetting game:', error);
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
    
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Access the game at: http://localhost:${PORT}`);
    console.log('📊 Game room initialized with max', gameRoom.maxPlayers, 'players');
    console.log('🎯 Ready for players to join!');
});

// ИСПРАВЛЯЕМ graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    
    // Очищаем таймер
    if (gameRoom.timer) {
        clearInterval(gameRoom.timer);
        gameRoom.timer = null;
    }
    
    server.close((error) => {
        if (error) {
            console.error('❌ Error closing server:', error);
        }
        console.log('🔚 Process terminated');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    
    // Очищаем таймер
    if (gameRoom.timer) {
        clearInterval(gameRoom.timer);
        gameRoom.timer = null;
    }
    
    server.close((error) => {
        if (error) {
            console.error('❌ Error closing server:', error);
        }
        console.log('🔚 Process terminated');
        process.exit(0);
    });
});
