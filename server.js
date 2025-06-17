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
            // ИСПРАВЛЕНО: проверяем, были ли голоса перед переходом к оправданиям
            const hasVotes = Object.keys(gameRoom.votingResults).some(playerId => 
                gameRoom.votingResults[playerId] && gameRoom.votingResults[playerId].length > 0
            );
            
            if (hasVotes) {
                // Определяем игроков с максимальным количеством голосов
                let maxVotes = 0;
                const alivePlayers = gameRoom.players.filter(p => p.isAlive);
                
                alivePlayers.forEach(player => {
                    if (player.votes > maxVotes) {
                        maxVotes = player.votes;
                    }
                });
                
                const playersWithMaxVotes = alivePlayers.filter(p => p.votes === maxVotes && maxVotes > 0);
                
                console.log(`🗳️ Voting finished. Max votes: ${maxVotes}, Tied players: ${playersWithMaxVotes.length}`);
                
                if (playersWithMaxVotes.length === 1) {
                    // Только один игрок - исключаем сразу
                    playersWithMaxVotes[0].isAlive = false;
                    showResults();
                } else if (playersWithMaxVotes.length > 1) {
                    // Несколько игроков - идут оправдываться
                    startJustificationPhase();
                } else {
                    // Никого не исключаем
                    nextRound();
                }
            } else {
                // Если никто не голосовал - переходим к следующему раунду
                nextRound();
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
    startRoundVotes: [],  // Голоса за начало раунда
    activeEffects: {} // Для отслеживания активных эффектов карт
};

// === ДОБАВЛЯЕМ МАССИВЫ СЦЕНАРИЕВ И КОМНАТ ===
const gameScenarios = [
    {
        id: 1,
        title: "☢️ Ядерная война",
        description: "Мир охвачен ядерной войной. Радиация покрыла большую часть земли. Выжившие укрываются в бункерах, ожидая когда радиационный фон снизится до безопасного уровня. Вам предстоит провести в бункере несколько лет.",
        icon: "☢️",
        rooms: [
            { name: "Ферма", icon: "🌱" },
            { name: "Игровая комната", icon: "🎮" }
        ]
    },
    {
        id: 2,  
        title: "🧊 Ледниковый период",
        description: "Температура на Земле упала до минус 40 градусов. Ледники покрыли континенты. Человечество вынуждено жить в утепленных бункерах и ждать потепления. Холод - ваш главный враг.",
        icon: "🧊",
        rooms: [
            { name: "Бильярд", icon: "🎱" },
            { name: "Лаборатория", icon: "🔬" }
        ]
    }
];

// Функция выбора случайного сценария
function getRandomScenario() {
    return gameScenarios[Math.floor(Math.random() * gameScenarios.length)];
}

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
    // ... существующий код подключения ...
    
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
    
    // ... остальные обработчики ...
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
    
    // Сбрасываем голоса только для игроков из очереди оправданий
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
        isSecondVoting: true // ДОБАВЛЯЕМ флаг
    });
    
    startGameTimer();
}

// Функция показа результатов раунда
function showResults() {
    console.log('📊 Showing round results');
    
    gameRoom.gamePhase = 'results';
    
    // Определяем исключенных игроков
    const eliminatedPlayers = gameRoom.players.filter(p => !p.isAlive);
    const lastEliminated = eliminatedPlayers[eliminatedPlayers.length - 1];
    
    // Сбрасываем голоса и состояния для следующего раунда
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
    gameRoom.justificationQueue = [];
    
    // Очищаем таймер
    if (gameRoom.timer) {
        clearInterval(gameRoom.timer);
        gameRoom.timer = null;
    }
    
    io.to('game-room').emit('round-results', {
        eliminatedPlayer: lastEliminated ? lastEliminated.name : null,
        players: gameRoom.players,
        votingResults: gameRoom.votingResults
    });
    
    // Через 5 секунд переходим к следующему раунду
    setTimeout(() => {
        nextRound();
    }, 5000);
}

// Socket.IO логика
io.on('connection', (socket) => {
    console.log('✅ User connected:', socket.id);
    
    // Обработчик ошибок сокета
    socket.on('error', (error) => {
        console.error('❌ Socket error for', socket.id, ':', error);
    });
    
    // Обработчик отключения
    socket.on('disconnect', (reason) => {
        console.log('❌ User disconnected:', socket.id, 'Reason:', reason);
        
        try {
            const playerIndex = gameRoom.players.findIndex(p => p.id === socket.id);
            
            if (playerIndex !== -1) {
                const player = gameRoom.players[playerIndex];
                const wasHost = player.isHost;
                
                gameRoom.players.splice(playerIndex, 1);
                
                // Если хост отключился, назначаем нового хоста
                if (wasHost && gameRoom.players.length > 0) {
                    gameRoom.players[0].isHost = true;
                }
                
                // Если игроков не осталось, сбрасываем игру
                if (gameRoom.players.length === 0) {
                    resetGame();
                }
                
                console.log('📤 Player left:', player.name, 'Remaining:', gameRoom.players.length);
                
                // Уведомляем остальных игроков
                socket.to('game-room').emit('player-left', {
                    leftPlayer: player.name,
                    players: gameRoom.players,
                    gameState: gameRoom.gameState
                });
            }
        } catch (error) {
            console.error('❌ Error handling disconnect:', error);
        }
    });
    
    // Отправляем текущее состояние комнаты новому подключению
    try {
        socket.emit('room-state', {
            players: gameRoom.players,
            gameState: gameRoom.gameState,
            gamePhase: gameRoom.gamePhase,
            currentRound: gameRoom.currentRound,
            timeLeft: gameRoom.timeLeft,
            currentTurnPlayer: gameRoom.currentTurnPlayer,
            maxPlayers: gameRoom.maxPlayers,
            startRoundVotes: gameRoom.startRoundVotes || []
        });
    } catch (error) {
        console.error('❌ Error sending room state:', error);
    }
    
    socket.on('join-game', (data) => {
        console.log('🎯 Player joining:', data.playerName);
        
        // Проверяем, не превышен ли лимит игроков
        if (gameRoom.players.length >= gameRoom.maxPlayers) {
            socket.emit('error', 'Игра заполнена! Максимум игроков: ' + gameRoom.maxPlayers);
            return;
        }
        
        // ИСПРАВЛЕНО: Проверяем имя только среди активных игроков (исключаем текущий socket)
        const existingPlayer = gameRoom.players.find(p => 
            p.name === data.playerName && p.id !== socket.id
        );
        if (existingPlayer) {
            socket.emit('error', 'Игрок с таким именем уже в игре! Выберите другое имя.');
            return;
        }
        
        // ИСПРАВЛЕНО: Удаляем старую запись этого сокета если она есть
        const oldPlayerIndex = gameRoom.players.findIndex(p => p.id === socket.id);
        if (oldPlayerIndex !== -1) {
            console.log('🔄 Removing old player record for socket:', socket.id);
            gameRoom.players.splice(oldPlayerIndex, 1);
        }
        
        // Добавляем игрока
        const newPlayer = {
            id: socket.id,
            name: data.playerName,
            isHost: gameRoom.players.length === 0, // Первый игрок становится хостом
            joinedAt: new Date(),
            isAlive: true,
            votes: 0,
            hasRevealed: false,
            revealedCharacteristics: [],
            characteristics: null,
            actionCards: [],
            hasVoted: false,
            votedFor: null,
            cardsRevealedThisRound: 0
        };
        
        gameRoom.players.push(newPlayer);
        socket.join('game-room');
        
        console.log('✅ Player joined:', data.playerName, 'Total players:', gameRoom.players.length);
        
        // Подтверждение присоединения
        socket.emit('join-confirmed', {
            playerId: socket.id,
            playerName: data.playerName,
            isHost: newPlayer.isHost,
            maxPlayers: gameRoom.maxPlayers,
            startRoundVotes: gameRoom.startRoundVotes || []
        });
        
        // Отправляем обновление всем игрокам
        io.to('game-room').emit('player-joined', {
            players: gameRoom.players,
            newPlayer: data.playerName,
            gameState: gameRoom.gameState,
            maxPlayers: gameRoom.maxPlayers,
            startRoundVotes: gameRoom.startRoundVotes || []
        });
    });
    
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
        
        // ДОБАВЛЯЕМ: Выбираем случайный сценарий
        const selectedScenario = getRandomScenario();
        gameRoom.scenario = selectedScenario;
        
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
        
        console.log('🚀 Game started! Players:', gameRoom.players.length, 'Scenario:', selectedScenario.title);
        
        // ОБНОВЛЯЕМ: Отправляем сценарий вместе с данными игры
        io.to('game-room').emit('game-started', {
            players: gameRoom.players,
            gameState: gameRoom.gameState,
            gamePhase: gameRoom.gamePhase,
            currentRound: gameRoom.currentRound,
            timeLeft: gameRoom.timeLeft,
            scenario: selectedScenario // ДОБАВЛЯЕМ сценарий
        });
    });
    
    // ИСПРАВЛЯЕМ обработчик start-round - убираем дублирование
    socket.on('start-round', () => {
        console.log('🎯 Round start vote from:', socket.id);
        
        const player = gameRoom.players.find(p => p.id === socket.id);
        
        if (!player || !player.isAlive) {
            socket.emit('error', 'Вы не можете голосовать!');
            return;
        }
        
        if (gameRoom.gamePhase !== 'preparation') {
            socket.emit('error', 'Раунд уже начался!');
            return;
        }
        
        if (gameRoom.startRoundVotes.includes(socket.id)) {
            socket.emit('error', 'Вы уже проголосовали за начало раунда!');
            return;
        }
        
        // Добавляем голос
        gameRoom.startRoundVotes.push(socket.id);
        
        const requiredVotes = 2; // Всегда требуется ровно 2 голоса
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
            console.log('🎯 Starting round - enough votes');
            gameRoom.startRoundVotes = []; // Сбрасываем голоса
            startRevelationPhase();
        }
    });
    
    socket.on('vote-player', (data) => {
        console.log('🗳️ Vote from:', socket.id, 'for:', data.targetId);
        
        if (gameRoom.gamePhase !== 'voting') {
            socket.emit('error', 'Сейчас не время для голосования!');
            return;
        }
        
        const voter = gameRoom.players.find(p => p.id === socket.id);
        const target = gameRoom.players.find(p => p.id === data.targetId);
        
        if (!voter || !target || !voter.isAlive || !target.isAlive) {
            socket.emit('error', 'Некорректное голосование!');
            return;
        }
        
        if (voter.hasVoted) {
            socket.emit('error', 'Вы уже проголосовали!');
            return;
        }
        
        // Проверяем двойной голос
        const isDoubleVote = gameRoom.activeEffects[voter.id] && gameRoom.activeEffects[voter.id].doubleVote;
        const voteWeight = isDoubleVote ? 2 : 1;
        
        // Записываем голос
        if (!gameRoom.votingResults[data.targetId]) {
            gameRoom.votingResults[data.targetId] = [];
        }
        
        // Добавляем голос(ы)
        for (let i = 0; i < voteWeight; i++) {
            gameRoom.votingResults[data.targetId].push(voter.id);
        }
        
        voter.hasVoted = true;
        voter.votedFor = data.targetId;
        
        // Если использовался двойной голос, убираем эффект
        if (isDoubleVote) {
            gameRoom.activeEffects[voter.id].doubleVote = false;
        }
        
        // Обновляем счетчики голосов
        gameRoom.players.forEach(player => {
            player.votes = gameRoom.votingResults[player.id] ? gameRoom.votingResults[player.id].length : 0;
        });
        
        console.log(`📊 Vote weight: ${voteWeight}, Double vote: ${isDoubleVote}`);
        
        // Отправляем обновление голосования
        io.to('game-room').emit('vote-update', {
            players: gameRoom.players,
            votingResults: gameRoom.votingResults,
            voterName: voter.name,
            targetName: target.name,
            voteWeight: voteWeight
        });
        
        // Проверяем завершение голосования
        const alivePlayers = gameRoom.players.filter(p => p.isAlive);
        const votedPlayers = alivePlayers.filter(p => p.hasVoted);
        
        if (votedPlayers.length >= alivePlayers.length) {
            console.log('✅ All players voted - starting justification phase');
            clearInterval(gameRoom.timer);
            setTimeout(() => {
                startJustificationPhase();
            }, 1000);
        }
    });

    socket.on('change-vote', (data) => {
        console.log('🔄 Change vote from:', socket.id, 'to:', data.targetId);
        
        if (gameRoom.gamePhase !== 'voting') {
            socket.emit('error', 'Сейчас не время для голосования!');
            return;
        }
        
        const voter = gameRoom.players.find(p => p.id === socket.id);
        const newTarget = gameRoom.players.find(p => p.id === data.targetId);
        
        if (!voter || !newTarget || !voter.isAlive || !newTarget.isAlive) {
            socket.emit('error', 'Некорректная смена голоса!');
            return;
        }
        
        if (!gameRoom.canChangeVote[voter.id]) {
            socket.emit('error', 'Вы уже использовали возможность смены голоса!');
            return;
        }
        
        if (!voter.votedFor) {
            socket.emit('error', 'Вы еще не голосовали!');
            return;
        }
        
        if (voter.votedFor === data.targetId) {
            socket.emit('error', 'Вы уже голосовали за этого игрока!');
            return;
        }
        
        // Убираем старый голос
        const oldTargetVotes = gameRoom.votingResults[voter.votedFor];
        if (oldTargetVotes) {
            const voteIndex = oldTargetVotes.indexOf(voter.id);
            if (voteIndex !== -1) {
                oldTargetVotes.splice(voteIndex, 1);
            }
        }
        
        // Добавляем новый голос
        if (!gameRoom.votingResults[data.targetId]) {
            gameRoom.votingResults[data.targetId] = [];
        }
        gameRoom.votingResults[data.targetId].push(voter.id);
        voter.votedFor = data.targetId;
        
        // Убираем возможность смены голоса
        gameRoom.canChangeVote[voter.id] = false;
        
        // Обновляем счетчики голосов
        gameRoom.players.forEach(player => {
            player.votes = gameRoom.votingResults[player.id] ? gameRoom.votingResults[player.id].length : 0;
        });
        
        console.log(`🔄 Vote changed from ${voter.name}`);
        
        // Отправляем обновление голосования
        io.to('game-room').emit('vote-update', {
            players: gameRoom.players,
            votingResults: gameRoom.votingResults,
            canChangeVote: gameRoom.canChangeVote
        });
    });

    socket.on('finish-justification', () => {
        console.log('✅ Finish justification from:', socket.id);
        
        if (gameRoom.gamePhase !== 'justification') {
            socket.emit('error', 'Сейчас не фаза оправдания!');
            return;
        }
        
        if (gameRoom.currentJustifyingPlayer !== socket.id) {
            socket.emit('error', 'Сейчас не ваше время для оправдания!');
            return;
        }
        
        clearInterval(gameRoom.timer);
        nextJustification();
    });

    socket.on('surrender', () => {
        console.log('🏳️ Surrender from:', socket.id);
        
        if (gameRoom.gamePhase !== 'justification') {
            socket.emit('error', 'Сейчас не фаза оправдания!');
            return;
        }
        
        if (gameRoom.currentJustifyingPlayer !== socket.id) {
            socket.emit('error', 'Только оправдывающийся игрок может сдаться!');
            return;
        }
        
        const player = gameRoom.players.find(p => p.id === socket.id);
        if (player) {
            player.isAlive = false;
            console.log('💀 Player surrendered:', player.name);
            
            clearInterval(gameRoom.timer);
            
            // Отправляем результат сдачи
            io.to('game-room').emit('player-surrendered', {
                surrenderedPlayer: player.name,
                players: gameRoom.players
            });
            
            // Переходим к следующему раунду
            setTimeout(() => {
                nextRound();
            }, 3000);
        }
    });

    // ПЕРЕМЕЩАЕМ СЮДА - внутрь connection блока
    socket.on('use-action-card', (data) => {
        console.log('🎯 Action card use request:', data);
        
        const player = gameRoom.players.find(p => p.id === socket.id);
        
        if (!player || !player.isAlive) {
            socket.emit('error', 'Вы не можете использовать карты действий!');
            return;
        }
        
        if (!player.actionCards || player.actionCards.length === 0) {
            socket.emit('error', 'У вас нет карт действий!');
            return;
        }
        
        const actionCard = player.actionCards.find(card => card.id === data.cardId);
        
        if (!actionCard) {
            socket.emit('error', 'Карта действия не найдена!');
            return;
        }
        
        if (actionCard.usesLeft <= 0) {
            socket.emit('error', 'Карта действия уже использована!');
            return;
        }
        
        // Проверяем возможность использования карты в текущей фазе
        if (!canUseActionCard(actionCard, gameRoom.gamePhase)) {
            socket.emit('error', `Карту "${actionCard.name}" нельзя использовать в текущей фазе!`);
            return;
        }
        
        // Используем карту
        const success = useActionCard(player, actionCard, data.targetId);
        
        if (success) {
            actionCard.usesLeft--;
            console.log(`✨ ${player.name} used action card: ${actionCard.name}`);
            
            // Отправляем обновление всем игрокам
            io.to('game-room').emit('action-card-used', {
                playerId: player.id,
                playerName: player.name,
                cardName: actionCard.name,
                cardType: actionCard.type,
                players: gameRoom.players,
                targetId: data.targetId
            });
        }
    });
    
    // Обработчик ошибок
    socket.on('error', function(errorMessage) {
        console.error('❌ Socket error:', errorMessage);
        socket.emit('error', errorMessage);
    });

}); // КОНЕЦ io.on('connection')

// Функция проверки возможности использования карты
function canUseActionCard(card, gamePhase) {
    switch (card.type) {
        case 'voting':
            return gamePhase === 'voting';
        case 'investigative':
            return ['discussion', 'voting'].includes(gamePhase);
        case 'protective':
            return gamePhase === 'results';
        case 'stealth':
            return gamePhase === 'voting';
        case 'disruptive':
            return ['discussion', 'voting', 'justification'].includes(gamePhase);
        case 'control':
            return ['discussion', 'voting'].includes(gamePhase);
        default:
            return true;
    }
}

// Функция использования карты действия
function useActionCard(player, card, targetId) {
    switch (card.type) {
        case 'voting':
            // Двойной голос
            if (!gameRoom.activeEffects[player.id]) {
                gameRoom.activeEffects[player.id] = {};
            }
            gameRoom.activeEffects[player.id].doubleVote = true;
            return true;
            
        case 'investigative':
            // Детектив - показать характеристику
            if (targetId) {
                const target = gameRoom.players.find(p => p.id === targetId);
                if (target && target.characteristics) {
                    const hiddenCharacteristics = ['profession', 'health', 'hobby', 'phobia', 'baggage', 'fact1', 'fact2']
                        .filter(key => !target.revealedCharacteristics.includes(key));
                    
                    if (hiddenCharacteristics.length > 0) {
                        const randomCharacteristic = hiddenCharacteristics[Math.floor(Math.random() * hiddenCharacteristics.length)];
                        
                        io.to(player.id).emit('detective-result', {
                            targetName: target.name,
                            characteristic: randomCharacteristic,
                            value: target.characteristics[randomCharacteristic]
                        });
                        return true;
                    }
                }
            }
            return false;
            
        case 'protective':
            // Защитник - спасти от исключения
            if (targetId) {
                if (!gameRoom.activeEffects.protected) {
                    gameRoom.activeEffects.protected = [];
                }
                gameRoom.activeEffects.protected.push(targetId);
                return true;
            }
            return false;
            
        case 'stealth':
            // Анонимный голос
            if (!gameRoom.activeEffects[player.id]) {
                gameRoom.activeEffects[player.id] = {};
            }
            gameRoom.activeEffects[player.id].anonymousVote = true;
            return true;
            
        case 'disruptive':
            // Блокировщик
            if (targetId) {
                const target = gameRoom.players.find(p => p.id === targetId);
                if (target && target.actionCards) {
                    target.actionCards.forEach(card => {
                        if (card.usesLeft > 0) {
                            card.usesLeft = 0;
                        }
                    });
                    return true;
                }
            }
            return false;
            
        case 'control':
            // Лидер - форсировать переход к следующей фазе
            clearInterval(gameRoom.timer);
            handlePhaseTimeout();
            return true;
            
        default:
            return false;
    }
}

// Функция получения случайной карты действия
function getRandomActionCard() {
    const randomIndex = Math.floor(Math.random() * actionCards.length);
    return { ...actionCards[randomIndex] }; // Создаем копию карты
}

// Функция генерации характеристик
function generateCharacteristics() {
    return {
        profession: professions[Math.floor(Math.random() * professions.length)],
        health: healthConditions[Math.floor(Math.random() * healthConditions.length)],
        hobby: hobbies[Math.floor(Math.random() * hobbies.length)],
        phobia: phobias[Math.floor(Math.random() * phobias.length)],
        baggage: baggage[Math.floor(Math.random() * baggage.length)],
        fact1: facts[Math.floor(Math.random() * facts.length)],
        fact2: facts[Math.floor(Math.random() * facts.length)]
    };
}

// Функция управления таймером
function startGameTimer() {
    try {
        // Очищаем предыдущий таймер
        if (gameRoom.timer) {
            clearInterval(gameRoom.timer);
            gameRoom.timer = null;
        }
        
        gameRoom.timer = setInterval(() => {
            try {
                gameRoom.timeLeft--;
                
                // Отправляем обновление таймера каждые 10 секунд или в последние 10 секунд
                if (gameRoom.timeLeft % 10 === 0 || gameRoom.timeLeft <= 10) {
                    io.to('game-room').emit('timer-update', {
                        timeLeft: gameRoom.timeLeft,
                        gamePhase: gameRoom.gamePhase,
                        currentTurnPlayer: gameRoom.currentTurnPlayer
                    });
                }
                
                // Время истекло
                if (gameRoom.timeLeft <= 0) {
                    clearInterval(gameRoom.timer);
                    gameRoom.timer = null;
                    handlePhaseTimeout();
                }
            } catch (error) {
                console.error('❌ Timer error:', error);
                clearInterval(gameRoom.timer);
                gameRoom.timer = null;
            }
        }, 1000);
    } catch (error) {
        console.error('❌ Error starting timer:', error);
    }
}

// Функция сброса игры
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
        
        io.to('game-room').emit('game-reset', {
            players: gameRoom.players,
            gameState: gameRoom.gameState
        });
    } catch (error) {
        console.error('❌ Error resetting game:', error);
    }
}

// Функция перехода к следующему раунду
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
        
        io.to('game-room').emit('new-round', {
            currentRound: gameRoom.currentRound,
            gamePhase: gameRoom.gamePhase,
            timeLeft: gameRoom.timeLeft,
            players: gameRoom.players
        });
    } catch (error) {
        console.error('❌ Error in nextRound:', error);
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
