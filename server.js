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
        description: "При вашем исключении можете забрать с собой одного игрока по выбору.", 
        type: "elimination", 
        usesLeft: 1,
        icon: "⚔️"
    }
];

// === МАССИВЫ ХАРАКТЕРИСТИК ===

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
    pendingEliminationNextRound: false,
    eliminateTopVotersNextRound: false
};

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

function getRequiredCardsForRound(round) {
    if (round === 1) {
        return 2; // Профессия + 1 карта на выбор
    } else {
        return 1; // 1 карта на выбор
    }
}

function generateCharacteristics() {
    const usedFacts = [];
    const fact1 = getRandomElement(facts);
    usedFacts.push(fact1);
    const fact2 = getRandomElement(facts.filter(f => !usedFacts.includes(f)));
    
    return {
        profession: getRandomElement(professions),
        age: Math.floor(Math.random() * 60) + 18,
        health: getRandomElement(healthConditions),
        hobby: getRandomElement(hobbies),
        phobia: getRandomElement(phobias),
        baggage: getRandomElement(baggage),
        fact1: fact1,
        fact2: fact2
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
            
            const playersWithMaxVotes = alivePlayers.filter(p => (p.votes || 0) === maxVotes && maxVotes > 0);
            
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

function autoRevealRemainingCards(player) {
    const requiredCards = getRequiredCardsForRound(gameRoom.currentRound);
    const currentlyRevealed = player.cardsRevealedThisRound || 0;
    const cardsToReveal = requiredCards - currentlyRevealed;
    
    if (cardsToReveal <= 0) return;
    
    const allCharacteristics = ['profession', 'age', 'health', 'hobby', 'phobia', 'baggage', 'fact1', 'fact2'];
    const alreadyRevealed = player.revealedCharacteristics || [];
    const availableCharacteristics = allCharacteristics.filter(char => 
        !alreadyRevealed.includes(char) && player.characteristics[char]
    );
    
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

function triggerRevengeCard(eliminatedPlayer) {
    const revengeCard = eliminatedPlayer.actionCards?.find(card => 
        card.name === "Месть" && card.usesLeft > 0
    );
    
    if (revengeCard) {
        console.log(`⚔️ ${eliminatedPlayer.name} has Revenge card!`);
        
        const availableTargets = gameRoom.players.filter(p => p.isAlive && p.id !== eliminatedPlayer.id);
        
        io.to(eliminatedPlayer.id).emit('revenge-card-triggered', {
            playerName: eliminatedPlayer.name,
            cardName: revengeCard.name,
            targets: availableTargets.map(p => ({ id: p.id, name: p.name }))
        });
        
        setTimeout(() => {
            if (revengeCard.usesLeft > 0) {
                console.log(`⚔️ ${eliminatedPlayer.name} revenge timeout`);
                io.to('game-room').emit('revenge-timeout', {
                    playerName: eliminatedPlayer.name
                });
            }
        }, 30000);
    }
}

// === ИГРОВЫЕ ФАЗЫ ===

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
    
    const randomStory = stories[Math.floor(Math.random() * stories.length)];
    
    io.to('game-room').emit('phase-changed', {
        gamePhase: gameRoom.gamePhase,
        timeLeft: gameRoom.timeLeft,
        players: gameRoom.players,
        currentTurnPlayer: gameRoom.currentTurnPlayer,
        currentRound: gameRoom.currentRound,
        story: randomStory
    });
    
    startGameTimer();
}

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

function startVotingPhase() {
    console.log('🗳️ Starting voting phase');
    
    gameRoom.gamePhase = 'voting';
    gameRoom.timeLeft = 120;
    gameRoom.votingResults = {};
    gameRoom.totalVotes = 0;
    
    gameRoom.players.forEach(player => {
        player.hasVoted = false;
        player.votedFor = null;
        player.votes = 0;
    });
    
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
    
    const isSecondVoting = gameRoom.justificationQueue && gameRoom.justificationQueue.length > 0;
    
    if (playersWithMaxVotes.length === 1) {
        playersWithMaxVotes[0].isAlive = false;
        triggerRevengeCard(playersWithMaxVotes[0]);
        showResults();
    } else if (playersWithMaxVotes.length >= 2 && playersWithMaxVotes.length <= 3) {
        if (isSecondVoting) {
            console.log('🤝 Second voting tie - no elimination this round, double elimination next round');
            gameRoom.eliminateTopVotersNextRound = true;
            gameRoom.justificationQueue = [];
            showResults();
        } else {
            startJustificationPhase();
        }
    } else if (playersWithMaxVotes.length >= 4) {
        console.log('🤝 Large tie (4+ players) - no elimination');
        showResults();
    } else {
        showResults();
    }
}

function startJustificationPhase() {
    console.log('⚖️ Starting justification phase');
    
    let maxVotes = 0;
    const alivePlayers = gameRoom.players.filter(p => p.isAlive);
    
    alivePlayers.forEach(player => {
        if (player.votes > maxVotes) {
            maxVotes = player.votes;
        }
    });
    
    const playersToJustify = alivePlayers.filter(p => 
        p.votes === maxVotes && maxVotes > 0
    );
    
    console.log(`⚖️ Max votes: ${maxVotes}, Players with max votes:`, playersToJustify.map(p => `${p.name}(${p.votes})`));
    
    if (playersToJustify.length === 0) {
        console.log('⚖️ No votes - proceeding to next round');
        nextRound();
        return;
    }
    
    if (playersToJustify.length === 1) {
        const eliminatedPlayer = playersToJustify[0];
        eliminatedPlayer.isAlive = false;
        triggerRevengeCard(eliminatedPlayer);
        console.log('💀 Single player eliminated:', eliminatedPlayer.name);
        showResults();
        return;
    }
    
    console.log(`⚖️ Multiple players tied with ${maxVotes} votes - starting justifications`);
    
    gameRoom.gamePhase = 'justification';
    gameRoom.justificationQueue = [...playersToJustify];
    gameRoom.currentJustifyingPlayer = gameRoom.justificationQueue[0].id;
    gameRoom.timeLeft = 60;
    
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

function startSecondVoting() {
    console.log('🗳️ Starting second voting after justifications');
    
    gameRoom.gamePhase = 'voting';
    gameRoom.timeLeft = 90;
    gameRoom.votingResults = {};
    
    gameRoom.players.forEach(player => {
        player.hasVoted = false;
        player.votedFor = null;
        player.votes = 0;
    });
    
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
    
    console.log(`📊 Results: Max votes: ${maxVotes}, Players with max votes: ${playersWithMaxVotes.length}`);
    console.log(`📊 Eliminate top voters next round: ${gameRoom.eliminateTopVotersNextRound}`);
    
    let eliminatedPlayers = [];
    let resultMessage = '';
    
    if (gameRoom.eliminateTopVotersNextRound) {
        const sortedByVotes = [...alivePlayers].sort((a, b) => (b.votes || 0) - (a.votes || 0));
        const playersWithVotes = sortedByVotes.filter(p => (p.votes || 0) > 0);
        
        if (playersWithVotes.length >= 2) {
            eliminatedPlayers = playersWithVotes.slice(0, 2);
        } else if (playersWithVotes.length === 1) {
            eliminatedPlayers = [playersWithVotes[0]];
        }
        
        eliminatedPlayers.forEach(player => {
            player.isAlive = false;
            triggerRevengeCard(player);
        });
        
        resultMessage = eliminatedPlayers.length > 0 
            ? `Двойное исключение: ${eliminatedPlayers.map(p => p.name).join(', ')}`
            : 'Никто не был исключен';
        
        gameRoom.eliminateTopVotersNextRound = false; // Reset the flag
    } else {
        // Handle normal elimination
        if (playersWithMaxVotes.length === 1) {
            eliminatedPlayers = playersWithMaxVotes;
            eliminatedPlayers.forEach(player => {
                player.isAlive = false;
                triggerRevengeCard(player);
            });
            resultMessage = `Исключен: ${eliminatedPlayers[0].name}`;
        } else if (playersWithMaxVotes.length > 1) {
            resultMessage = `Ничья между: ${playersWithMaxVotes.map(p => p.name).join(', ')}`;
        } else {
            resultMessage = 'Никто не получил голосов';
        }
    }
    
    // Emit the results
    io.to('game-room').emit('round-results', {
        eliminatedPlayers: eliminatedPlayers.map(p => ({ id: p.id, name: p.name })),
        resultMessage: resultMessage,
        players: gameRoom.players,
        currentRound: gameRoom.currentRound
    });
    
    // Continue with next round or end game
    setTimeout(() => {
        const aliveCount = gameRoom.players.filter(p => p.isAlive).length;
        if (aliveCount <= 1 || gameRoom.currentRound >= gameRoom.maxRounds) {
            endGame();
        } else {
            nextRound();
        }
    }, 5000);
}

function endGame() {
    console.log('🏁 Ending game');
    
    gameRoom.gameState = 'finished';
    gameRoom.players.forEach(player => {
        player.isAlive = true;
        player.votes = 0;
        player.votedFor = null;
        player.hasVoted = false;
        player.cardsRevealedThisRound = 0;
        player.revealedCharacteristics = [];
        player.actionCards = player.actionCards.map(card => ({ ...card, usesLeft: 1 }));
    });
    
    io.to('game-room').emit('game-ended', {
        players: gameRoom.players
    });
}

// === СОКЕТЫ ===

io.on('connection', (socket) => {
    console.log('🔌 New client connected:', socket.id);
    
    socket.on('join-game', (playerName) => {
        console.log(`👤 ${playerName} (${socket.id}) joined the game`);
        
        if (gameRoom.players.length >= gameRoom.maxPlayers) {
            socket.emit('game-full', { 
                message: 'Игра полна, попробуйте позже.' 
            });
            return;
        }
        
        const newPlayer = {
            id: socket.id,
            name: playerName,
            isAlive: true,
            votes: 0,
            votedFor: null,
            hasVoted: false,
            cardsRevealedThisRound: 0,
            revealedCharacteristics: [],
            actionCards: actionCards.map(card => ({ ...card })),
            characteristics: generateCharacteristics()
        };
        
        gameRoom.players.push(newPlayer);
        
        socket.join('game-room');
        
        io.to('game-room').emit('player-joined', {
            player: newPlayer,
            players: gameRoom.players
        });
        
        console.log('🛠️ Game room state:', gameRoom);
        
        if (gameRoom.players.length === gameRoom.maxPlayers) {
            console.log('🚀 Starting game - all players joined');
            startRevelationPhase();
        }
    });
    
    socket.on('disconnect', () => {
        console.log('❌ Client disconnected:', socket.id);
        
        const disconnectedPlayer = gameRoom.players.find(p => p.id === socket.id);
        if (disconnectedPlayer) {
            disconnectedPlayer.isAlive = false;
            triggerRevengeCard(disconnectedPlayer);
            
            io.to('game-room').emit('player-left', {
                playerId: socket.id,
                players: gameRoom.players
            });
        }
    });
    
    socket.on('reveal-characteristic', (characteristic) => {
        const player = gameRoom.players.find(p => p.id === socket.id);
        
        if (!player || !player.isAlive) return;
        
        if (player.revealedCharacteristics.includes(characteristic)) {
            return; // Already revealed
        }
        
        player.revealedCharacteristics.push(characteristic);
        player.cardsRevealedThisRound++;
        
        console.log(`🔍 ${player.name} revealed ${characteristic}: ${player.characteristics[characteristic]}`);
        
        io.to('game-room').emit('characteristic-revealed', {
            playerId: player.id,
            playerName: player.name,
            characteristic: characteristic,
            value: player.characteristics[characteristic],
            players: gameRoom.players,
            cardsRevealedThisRound: player.cardsRevealedThisRound,
            requiredCards: getRequiredCardsForRound(gameRoom.currentRound)
        });
        
        const allRevealed = gameRoom.players.every(p => p.revealedCharacteristics.length > 0 || !p.isAlive);
        if (allRevealed) {
            console.log('✅ All players revealed their characteristics');
            startDiscussionPhase();
        }
    });
    
    socket.on('start-vote', (targetPlayerId) => {
        const player = gameRoom.players.find(p => p.id === socket.id);
        
        if (!player || !player.isAlive) return;
        
        if (player.hasVoted) {
            return; // Already voted
        }
        
        player.votedFor = targetPlayerId;
        player.votes = 1;
        player.hasVoted = true;
        
        const targetPlayer = gameRoom.players.find(p => p.id === targetPlayerId);
        if (targetPlayer) {
            targetPlayer.votes = (targetPlayer.votes || 0) + 1;
        }
        
        console.log(`🗳️ ${player.name} voted for ${targetPlayerId}`);
        
        const alivePlayers = gameRoom.players.filter(p => p.isAlive);
        const allVoted = alivePlayers.every(p => p.hasVoted);
        
        if (allVoted) {
            console.log('✅ All players have voted');
            processVotingResults();
        }
    });
    
    socket.on('justification-response', (justification) => {
        const player = gameRoom.players.find(p => p.id === socket.id);
        
        if (!player || !player.isAlive) return;
        
        console.log(`⚖️ ${player.name} justified their vote: ${justification}`);
        
        io.to('game-room').emit('justification-submitted', {
            playerId: player.id,
            playerName: player.name,
            justification: justification
        });
    });
    
    socket.on('skip-discussion', () => {
        const player = gameRoom.players.find(p => p.id === socket.id);
        
        if (!player || !player.isAlive) return;
        
        player.skipVote = true;
        gameRoom.skipDiscussionVotes.push(player.id);
        
        console.log(`⏭️ ${player.name} skipped the discussion`);
        
        const alivePlayers = gameRoom.players.filter(p => p.isAlive);
        const allSkipped = alivePlayers.every(p => p.skipVote);
        
        if (allSkipped) {
            console.log('✅ All players skipped the discussion');
            startVotingPhase();
        }
    });
    
    socket.on('activate-card', (cardName) => {
        const player = gameRoom.players.find(p => p.id === socket.id);
        
        if (!player || !player.isAlive) return;
        
        const card = player.actionCards.find(c => c.name === cardName && c.usesLeft > 0);
        
        if (card) {
            card.usesLeft--;
            
            console.log(`🎴 ${player.name} activated card: ${cardName}`);
            
            io.to('game-room').emit('card-activated', {
                playerId: player.id,
                playerName: player.name,
                cardName: cardName
            });
        }
    });
});

server.listen(3000, () => {
    console.log('🌐 Server is running on http://localhost:3000');
});
