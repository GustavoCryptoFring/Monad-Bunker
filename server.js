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
    "Вирус, вырвавшийся из секретной лаборатории, уничтожил большую часть населения. Теперь спасшиеся должны не только бороться с болезнью, но и защищать ограниченные ресурсы.",
    "Астероид столкнулся с Землей, изменив климат навсегда. Выжившие укрываются в подземных убежищах, но припасы ограничены, и нужно решить, кто достоин жить.",
    "Искусственный интеллект вышел из-под контроля и захватил большую часть мира. Люди прячутся в старом бункере, но роботы приближаются, и времени остается мало.",
    "Солнечная буря уничтожила всю электронику на планете. Цивилизация рухнула, и теперь выжившие должны решить, как строить новое общество в подземном убежище."
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

// === ИГРОВОЕ СОСТОЯНИЕ ===

const gameRoom = {
    players: [],
    gameState: 'lobby',
    maxPlayers: 8,
    gamePhase: 'waiting',
    currentRound: 1,
    maxRounds: 6, // ИСПРАВЛЕНО: 6 раундов
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
    eliminateTopVotersNextRound: false,
    currentStory: null, // ДОБАВЛЕНО: текущая история игры
    isSecondVoting: false // ДОБАВЛЕНО: флаг второго голосования
};

// Функция получения необходимого количества карт для раунда
function getRequiredCardsForRound(round) {
    if (round === 1) {
        return 2; // Профессия + 1 карта на выбор
    } else {
        return 1; // 1 карта на выбор
    }
}

// ИСПРАВЛЕНО: Функция определения целевого количества победителей
function getTargetWinners(totalPlayers) {
    if (totalPlayers <= 8) return 2;
    if (totalPlayers <= 12) return 6;
    return Math.max(2, Math.floor(totalPlayers / 2));
}

// Функция автоматического раскрытия оставшихся карт
function autoRevealRemainingCards(player) {
    const requiredCards = getRequiredCardsForRound(gameRoom.currentRound);
    const currentlyRevealed = player.cardsRevealedThisRound || 0;
    const cardsToReveal = requiredCards - currentlyRevealed;
    
    if (cardsToReveal <= 0) return;
    
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
        
        const professionIndex = availableCharacteristics.indexOf('profession');
        if (professionIndex !== -1) {
            availableCharacteristics.splice(professionIndex, 1);
        }
    }
    
    // Раскрываем оставшиеся карты случайно
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
    
    player.hasRevealed = true;
    
    io.to('game-room').emit('auto-reveal-completed', {
        playerName: player.name,
        cardsRevealed: player.cardsRevealedThisRound,
        players: gameRoom.players
    });
}

// Функция начала фазы раскрытия
function startRevelationPhase() {
    console.log('🔍 Starting revelation phase');
    
    gameRoom.gamePhase = 'revelation';
    gameRoom.timeLeft = 60;
    gameRoom.revealedThisRound = 0;
    gameRoom.playersWhoRevealed = [];
    
    gameRoom.players.forEach(player => {
        player.hasRevealed = false;
        player.cardsRevealedThisRound = 0;
    });
    
    const alivePlayers = gameRoom.players.filter(p => p.isAlive);
    if (alivePlayers.length > 0) {
        gameRoom.currentTurnPlayer = alivePlayers[0].id;
    }
    
    io.to('game-room').emit('phase-changed', {
        gamePhase: gameRoom.gamePhase,
        timeLeft: gameRoom.timeLeft,
        players: gameRoom.players,
        currentTurnPlayer: gameRoom.currentTurnPlayer,
        currentRound: gameRoom.currentRound
    });
    
    startGameTimer();
}

// Функция перехода к следующему игроку
function nextPlayerTurn() {
    const alivePlayers = gameRoom.players.filter(p => p.isAlive);
    const currentPlayerIndex = alivePlayers.findIndex(p => p.id === gameRoom.currentTurnPlayer);
    
    const nextPlayerIndex = (currentPlayerIndex + 1) % alivePlayers.length;
    
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
    gameRoom.timeLeft = 180;
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
    gameRoom.timeLeft = 120;
    gameRoom.votingResults = {};
    gameRoom.totalVotes = 0;
    gameRoom.isSecondVoting = false; // ИСПРАВЛЕНО: сброс флага
    
    gameRoom.players.forEach(player => {
        player.hasVoted = false;
        player.votedFor = null;
        player.votes = 0;
    });
    
    // ИСПРАВЛЕНО: Смена голоса НЕ разрешена в первом голосовании
    gameRoom.canChangeVote = {};
    
    io.to('game-room').emit('phase-changed', {
        gamePhase: gameRoom.gamePhase,
        timeLeft: gameRoom.timeLeft,
        players: gameRoom.players,
        canChangeVote: gameRoom.canChangeVote,
        currentRound: gameRoom.currentRound,
        isSecondVoting: false
    });
    
    startGameTimer();
}

// Функция начала фазы оправдания
function startJustificationPhase() {
    console.log('⚖️ Starting justification phase');
    
    const playersToJustify = gameRoom.justificationQueue;
    
    if (!playersToJustify || playersToJustify.length === 0) {
        console.log('⚖️ No players to justify - proceeding to next round');
        nextRound();
        return;
    }
    
    console.log(`⚖️ Players justifying: ${playersToJustify.map(p => p.name).join(', ')}`);
    
    gameRoom.gamePhase = 'justification';
    gameRoom.currentJustifyingPlayer = gameRoom.justificationQueue[0].id;
    gameRoom.timeLeft = 60;
    
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
        startSecondVoting();
    }
}

// ИСПРАВЛЕНО: Функция второго голосования
function startSecondVoting() {
    console.log('🗳️ Starting second voting after justifications');
    
    gameRoom.gamePhase = 'voting';
    gameRoom.timeLeft = 90;
    gameRoom.votingResults = {};
    gameRoom.isSecondVoting = true; // ИСПРАВЛЕНО: устанавливаем флаг
    
    gameRoom.players.forEach(player => {
        player.hasVoted = false;
        player.votedFor = null;
        player.votes = 0;
    });
    
    // ИСПРАВЛЕНО: Во втором голосовании МОЖНО менять голос
    gameRoom.canChangeVote = {};
    gameRoom.players.filter(p => p.isAlive).forEach(player => {
        gameRoom.canChangeVote[player.id] = true;
    });
    
    console.log(`🗳️ Second voting for players: ${gameRoom.justificationQueue.map(p => p.name).join(', ')}`);
    
    io.to('game-room').emit('second-voting-started', {
        gamePhase: gameRoom.gamePhase,
        timeLeft: gameRoom.timeLeft,
        players: gameRoom.players,
        canChangeVote: gameRoom.canChangeVote,
        currentRound: gameRoom.currentRound,
        isSecondVoting: true,
        justifyingPlayers: gameRoom.justificationQueue.map(p => p.name)
    });
    
    startGameTimer();
}

// ИСПРАВЛЕНО: Функция обработки результатов голосования
function processVotingResults() {
    let maxVotes = 0;
    const alivePlayers = gameRoom.players.filter(p => p.isAlive);
    
    alivePlayers.forEach(player => {
        if (player.votes > maxVotes) {
            maxVotes = player.votes;
        }
    });
    
    const playersWithMaxVotes = alivePlayers.filter(p => p.votes === maxVotes && maxVotes > 0);
    
    console.log(`🗳️ Voting results: Max votes: ${maxVotes}, Players with max votes: ${playersWithMaxVotes.length}`);
    console.log(`🗳️ Is second voting: ${gameRoom.isSecondVoting}`);
    
    if (playersWithMaxVotes.length === 1) {
        playersWithMaxVotes[0].isAlive = false;
        console.log(`💀 Single player eliminated: ${playersWithMaxVotes[0].name}`);
        
        gameRoom.justificationQueue = [];
        gameRoom.isSecondVoting = false;
        showResults();
    } else if (playersWithMaxVotes.length >= 2 && playersWithMaxVotes.length <= 3) {
        if (gameRoom.isSecondVoting) {
            console.log('🤝 Second voting tie - no elimination this round, double elimination next round');
            gameRoom.eliminateTopVotersNextRound = true;
            gameRoom.justificationQueue = [];
            gameRoom.isSecondVoting = false;
            showResults();
        } else {
            console.log(`⚖️ First voting tie - starting justifications for ${playersWithMaxVotes.length} players`);
            gameRoom.justificationQueue = [...playersWithMaxVotes];
            startJustificationPhase();
        }
    } else {
        console.log('🤝 No elimination - too many tied players or no votes');
        gameRoom.justificationQueue = [];
        gameRoom.isSecondVoting = false;
        showResults();
    }
}

// Функция показа результатов раунда
function showResults() {
    console.log('📊 Showing round results');
    
    gameRoom.gamePhase = 'results';
    
    let maxVotes = 0;
    const alivePlayers = gameRoom.players.filter(p => p.isAlive);
    
    alivePlayers.forEach(player => {
        if (player.votes > maxVotes) {
            maxVotes = player.votes;
        }
    });
    
    const playersWithMaxVotes = alivePlayers.filter(p => p.votes === maxVotes && maxVotes > 0);
    
    let eliminatedPlayers = [];
    let resultMessage = '';
    
    if (gameRoom.eliminateTopVotersNextRound) {
        console.log('💀 Special round - eliminating top 2 voters');
        
        const sortedByVotes = [...alivePlayers].sort((a, b) => (b.votes || 0) - (a.votes || 0));
        const uniqueVotes = [...new Set(sortedByVotes.map(p => p.votes || 0))].filter(v => v > 0);
        
        if (uniqueVotes.length >= 2) {
            const firstPlaceVotes = uniqueVotes[0];
            const secondPlaceVotes = uniqueVotes[1];
            
            const firstPlacePlayers = sortedByVotes.filter(p => (p.votes || 0) === firstPlaceVotes);
            const secondPlacePlayers = sortedByVotes.filter(p => (p.votes || 0) === secondPlaceVotes);
            
            eliminatedPlayers = [...firstPlacePlayers];
            
            if (firstPlacePlayers.length === 1 && secondPlacePlayers.length > 0) {
                eliminatedPlayers.push(secondPlacePlayers[0]);
            }
            
        } else if (uniqueVotes.length === 1) {
            eliminatedPlayers = sortedByVotes.slice(0, Math.min(2, sortedByVotes.length));
        } else {
            eliminatedPlayers = [];
        }
        
        eliminatedPlayers.forEach(player => {
            player.isAlive = false;
            console.log(`💀 Special elimination: ${player.name} with ${player.votes || 0} votes`);
        });
        
        if (eliminatedPlayers.length > 0) {
            resultMessage = `Специальное исключение: ${eliminatedPlayers.map(p => p.name).join(', ')} (двойное исключение за ничью в прошлом раунде)`;
        } else {
            resultMessage = 'Специальный раунд: никто не исключен (недостаточно голосов)';
        }
        
        gameRoom.eliminateTopVotersNextRound = false;
        
    } else {
        const wasSecondVoting = gameRoom.isSecondVoting;
        
        if (wasSecondVoting && playersWithMaxVotes.length >= 2) {
            console.log('🤝 Second voting resulted in tie - no elimination, setting up double elimination next round');
            eliminatedPlayers = [];
            resultMessage = `Повторная ничья между ${playersWithMaxVotes.map(p => p.name).join(', ')}. В следующем раунде будут исключены 2 игрока с наибольшими голосами!`;
            gameRoom.eliminateTopVotersNextRound = true;
            
        } else if (playersWithMaxVotes.length === 1 && maxVotes > 0) {
            const playerToEliminate = playersWithMaxVotes[0];
            playerToEliminate.isAlive = false;
            eliminatedPlayers = [playerToEliminate];
            resultMessage = `Исключен: ${playerToEliminate.name}`;
            console.log(`💀 Standard elimination: ${playerToEliminate.name}`);
            
        } else {
            eliminatedPlayers = [];
            resultMessage = 'Никто не исключен в этом раунде';
        }
    }
    
    // Сброс состояний
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
    gameRoom.isSecondVoting = false;
    
    if (gameRoom.timer) {
        clearInterval(gameRoom.timer);
        gameRoom.timer = null;
    }
    
    console.log(`📊 Final result: ${eliminatedPlayers.length} players eliminated`);
    
    io.to('game-room').emit('round-results', {
        eliminatedPlayers: eliminatedPlayers.map(p => p.name),
        players: gameRoom.players,
        votingResults: gameRoom.votingResults,
        resultMessage: resultMessage,
        willEliminateTopVotersNextRound: gameRoom.eliminateTopVotersNextRound
    });
    
    setTimeout(() => {
        nextRound();
    }, 5000);
}

// ИСПРАВЛЕНО: Функция перехода к следующему раунду
function nextRound() {
    try {
        gameRoom.currentRound++;
        
        const alivePlayers = gameRoom.players.filter(p => p.isAlive);
        const targetWinners = getTargetWinners(gameRoom.maxPlayers);
        
        // ИСПРАВЛЕНО: Проверяем условия окончания игры
        if (alivePlayers.length <= targetWinners || gameRoom.currentRound > gameRoom.maxRounds) {
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
            players: gameRoom.players,
            willEliminateTopVotersThisRound: gameRoom.eliminateTopVotersNextRound
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
        
        setTimeout(() => {
            resetGame();
        }, 10000);
    } catch (error) {
        console.error('❌ Error ending game:', error);
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
        gameRoom.eliminateTopVotersNextRound = false;
        gameRoom.currentStory = null;
        gameRoom.isSecondVoting = false;
        
        io.to('game-room').emit('game-reset', {
            players: gameRoom.players,
            gameState: gameRoom.gameState
        });
    } catch (error) {
        console.error('❌ Error resetting game:', error);
    }
}

// Функция обработки timeout
function handlePhaseTimeout() {
    console.log('⏰ Phase timeout:', gameRoom.gamePhase);
    
    switch (gameRoom.gamePhase) {
        case 'revelation':
            const currentPlayer = gameRoom.players.find(p => p.id === gameRoom.currentTurnPlayer);
            if (currentPlayer && currentPlayer.isAlive) {
                const requiredCards = getRequiredCardsForRound(gameRoom.currentRound);
                const currentlyRevealed = currentPlayer.cardsRevealedThisRound || 0;
                
                if (currentlyRevealed < requiredCards) {
                    console.log(`⏰ Time's up for ${currentPlayer.name}, auto-revealing remaining cards`);
                    autoRevealRemainingCards(currentPlayer);
                }
            }
            nextPlayerTurn();
            break;
        case 'discussion':
            startVotingPhase();
            break;
        case 'voting':
            console.log('⏰ Voting timeout - processing current results');
            
            let maxVotes = 0;
            const alivePlayers = gameRoom.players.filter(p => p.isAlive);
            
            alivePlayers.forEach(player => {
                if ((player.votes || 0) > maxVotes) {
                    maxVotes = player.votes || 0;
                }
            });
            
            if (maxVotes === 0) {
                console.log('⏰ No votes cast during timeout - proceeding to next round');
                nextRound();
            } else {
                processVotingResults();
            }
            break;
        case 'justification':
            nextJustification();
            break;
    }
}

// Функция запуска игрового таймера
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

// Функции генерации
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

// === ОБРАБОТЧИКИ СОБЫТИЙ SOCKET.IO ===

io.on('connection', (socket) => {
    console.log('🔗 New connection:', socket.id);
    
    socket.emit('player-count', { count: gameRoom.players.length });
    
    // Присоединение к игре
    socket.on('join-game', (data) => {
        console.log('👋 Player joining:', data.playerName, 'Socket:', socket.id);
        
        const playerName = data.playerName?.trim();
        
        if (!playerName || playerName.length < 2 || playerName.length > 20) {
            socket.emit('error', 'Неверное имя игрока');
            return;
        }
        
        const existingPlayer = gameRoom.players.find(p => 
            p.name.toLowerCase() === playerName.toLowerCase() && 
            p.id !== socket.id
        );
        
        if (existingPlayer) {
            console.log('❌ Name already taken:', playerName, 'by player:', existingPlayer.id);
            socket.emit('error', 'Игрок с таким именем уже есть в игре');
            return;
        }
        
        if (gameRoom.players.length >= gameRoom.maxPlayers) {
            socket.emit('error', 'Игра заполнена');
            return;
        }
        
        const existingPlayerIndex = gameRoom.players.findIndex(p => p.id === socket.id);
        if (existingPlayerIndex !== -1) {
            console.log('🔄 Removing previous player with same socket:', socket.id);
            gameRoom.players.splice(existingPlayerIndex, 1);
        }
        
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
        
        socket.emit('join-confirmed', {
            playerId: socket.id,
            playerName: playerName,
            isHost: player.isHost,
            maxPlayers: gameRoom.maxPlayers,
            players: gameRoom.players,
            gameState: gameRoom.gameState
        });
        
        io.to('game-room').emit('player-joined', {
            players: gameRoom.players,
            maxPlayers: gameRoom.maxPlayers,
            gameState: gameRoom.gameState
        });
    });
    
    // Отключение игрока
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
    
    // Смена максимального количества игроков
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
        if (newMaxPlayers < 2 || newMaxPlayers > 12) {
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
    
    // Старт игры
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
        
        // Генерируем характеристики и выбираем историю
        gameRoom.players.forEach(player => {
            player.characteristics = generateCharacteristics();
            player.actionCards = [getRandomActionCard()];
            player.hasRevealed = false;
            player.hasVoted = false;
            player.revealedCharacteristics = [];
            player.cardsRevealedThisRound = 0;
        });
        
        // ИСПРАВЛЕНО: Выбираем случайную историю
        gameRoom.currentStory = stories[Math.floor(Math.random() * stories.length)];
        
        gameRoom.gameState = 'playing';
        gameRoom.gamePhase = 'preparation';
        gameRoom.currentRound = 1;
        gameRoom.timeLeft = 0;
        gameRoom.playersWhoRevealed = [];
        gameRoom.currentTurnPlayer = null;
        
        console.log('🚀 Game started! Players:', gameRoom.players.length);
        console.log('📖 Selected story:', gameRoom.currentStory.substring(0, 50) + '...');
        
        io.to('game-room').emit('game-started', {
            players: gameRoom.players,
            gameState: gameRoom.gameState,
            gamePhase: gameRoom.gamePhase,
            currentRound: gameRoom.currentRound,
            timeLeft: gameRoom.timeLeft,
            story: gameRoom.currentStory
        });
    });
    
    // Раскрытие характеристик
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
    
    // Пропуск обсуждения
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
    
    // Голосование за начало раунда
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
    
    // Голосование за игрока
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
        
        player.hasVoted = true;
        player.votedFor = data.targetId;
        
        targetPlayer.votes = (targetPlayer.votes || 0) + 1;
        
        if (!gameRoom.votingResults[data.targetId]) {
            gameRoom.votingResults[data.targetId] = [];
        }
        gameRoom.votingResults[data.targetId].push(socket.id);
        
        console.log(`🗳️ ${player.name} voted for ${targetPlayer.name} (${targetPlayer.votes} votes)`);
        
        io.to('game-room').emit('vote-update', {
            players: gameRoom.players,
            votingResults: gameRoom.votingResults,
            canChangeVote: gameRoom.canChangeVote
        });
        
        const alivePlayers = gameRoom.players.filter(p => p.isAlive);
        const votedPlayers = alivePlayers.filter(p => p.hasVoted);
        
        if (votedPlayers.length === alivePlayers.length) {
            console.log('✅ All players voted, processing results');
            
            setTimeout(() => {
                processVotingResults();
            }, 2000);
        }
    });

    // ИСПРАВЛЕНО: Смена голоса только во втором голосовании
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
        
        // ИСПРАВЛЕНО: Смена голоса только во втором голосовании
        if (!gameRoom.isSecondVoting) {
            socket.emit('error', 'Смена голоса доступна только во втором голосовании!');
            return;
        }
        
        if (!gameRoom.canChangeVote[socket.id]) {
            socket.emit('error', 'Вы не можете изменить голос!');
            return;
        }
        
        if (player.votedFor) {
            const previousTarget = gameRoom.players.find(p => p.id === player.votedFor);
            if (previousTarget) {
                previousTarget.votes = Math.max(0, (previousTarget.votes || 0) - 1);
            }
            
            if (gameRoom.votingResults[player.votedFor]) {
                gameRoom.votingResults[player.votedFor] = gameRoom.votingResults[player.votedFor].filter(id => id !== socket.id);
            }
        }
        
        player.votedFor = data.targetId;
        targetPlayer.votes = (targetPlayer.votes || 0) + 1;
        
        if (!gameRoom.votingResults[data.targetId]) {
            gameRoom.votingResults[data.targetId] = [];
        }
        gameRoom.votingResults[data.targetId].push(socket.id);
        
        gameRoom.canChangeVote[socket.id] = false;
        
        console.log(`🔄 ${player.name} changed vote to ${targetPlayer.name}`);
        
        io.to('game-room').emit('vote-update', {
            players: gameRoom.players,
            votingResults: gameRoom.votingResults,
            canChangeVote: gameRoom.canChangeVote
        });
    });

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
        const targetWinners = getTargetWinners(gameRoom.maxPlayers);
        
        if (alivePlayers.length <= targetWinners) {
            endGame();
        } else if (gameRoom.gamePhase === 'justification') {
            nextJustification();
        }
    });
});

// Catch-all для неопределенных роутов
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Обработка ошибок
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST)
    .on('listening', () => {
        console.log(`🚀 Bunker Game Server running on ${HOST}:${PORT}`);
        console.log(`📱 Game ready for players!`);
        console.log(`🎮 Players: ${gameRoom.players.length}/${gameRoom.maxPlayers}`);
    })
    .on('error', (error) => {
        console.error('❌ Server startup error:', error);
        if (error.code === 'EADDRINUSE') {
            console.error(`Port ${PORT} is already in use`);
        }
        process.exit(1);
    });

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});