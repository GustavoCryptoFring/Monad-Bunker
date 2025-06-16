const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

console.log('🚀 Starting Single Room Bunker Game Server...');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Статические файлы
app.use(express.static(__dirname));

// Главная страница
app.get('/', (req, res) => {
    console.log('📄 Serving main page');
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API для здоровья сервера
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        players: gameRoom.players.length,
        gameState: gameRoom.gameState,
        connections: io.engine.clientsCount
    });
});

// Единая игровая комната для всех
const gameRoom = {
    players: [],
    gameState: 'lobby', // lobby, playing, finished
    maxPlayers: 8, // ИЗМЕНЕНО: по умолчанию 8 игроков
    gamePhase: 'waiting', // waiting, preparation, revelation, discussion, voting, results
    currentRound: 1,
    maxRounds: 3,
    timer: null,
    timeLeft: 0,
    votingResults: {},
    revealedThisRound: 0,
    currentTurnPlayer: null, // Для фазы раскрытия
    playersWhoRevealed: [], // Кто уже раскрыл в этом раунде
    totalVotes: 0 // Для досрочного завершения голосования
};

// Socket.IO логика
io.on('connection', (socket) => {
    console.log('✅ User connected:', socket.id);
    
    // Отправляем текущее состояние комнаты новому подключению
    socket.emit('room-state', {
        players: gameRoom.players,
        gameState: gameRoom.gameState,
        gamePhase: gameRoom.gamePhase,
        currentRound: gameRoom.currentRound,
        timeLeft: gameRoom.timeLeft,
        currentTurnPlayer: gameRoom.currentTurnPlayer
    });
    
    socket.on('join-game', (data) => {
        console.log('🎯 Player joining:', data.playerName);
        
        // Проверяем, не превышен ли лимит игроков
        if (gameRoom.players.length >= gameRoom.maxPlayers) {
            socket.emit('error', 'Игра заполнена! Максимум игроков: ' + gameRoom.maxPlayers);
            return;
        }
        
        // Проверяем, не занято ли имя
        const existingPlayer = gameRoom.players.find(p => p.name === data.playerName);
        if (existingPlayer) {
            socket.emit('error', 'Игрок с таким именем уже в игре! Выберите другое имя.');
            return;
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
            revealedCharacteristics: [], // ДОБАВИЛИ массив раскрытых характеристик
            characteristics: null, // Будут созданы при старте игры
            actionCards: [],
            hasVoted: false // Отслеживаем голосование
        };
        
        gameRoom.players.push(newPlayer);
        socket.join('game-room');
        
        console.log('✅ Player joined:', data.playerName, 'Total players:', gameRoom.players.length);
        
        // Отправляем обновление всем игрокам
        io.to('game-room').emit('player-joined', {
            players: gameRoom.players,
            newPlayer: data.playerName,
            gameState: gameRoom.gameState,
            maxPlayers: gameRoom.maxPlayers
        });
        
        // Подтверждение присоединения
        socket.emit('join-confirmed', {
            playerId: socket.id,
            playerName: data.playerName,
            isHost: newPlayer.isHost,
            maxPlayers: gameRoom.maxPlayers
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
        
        // Генерируем характеристики для всех игроков
        gameRoom.players.forEach(player => {
            player.characteristics = generateCharacteristics();
            player.actionCards = [getRandomActionCard()];
            player.hasRevealed = false;
            player.hasVoted = false;
            player.revealedCharacteristics = []; // ДОБАВИЛИ сброс раскрытых характеристик
        });
        
        gameRoom.gameState = 'playing';
        gameRoom.gamePhase = 'preparation';
        gameRoom.currentRound = 1;
        gameRoom.timeLeft = 0; // Таймер не идет в фазе подготовки
        gameRoom.playersWhoRevealed = [];
        gameRoom.currentTurnPlayer = null;
        
        console.log('🚀 Game started! Players:', gameRoom.players.length);
        
        // Уведомляем всех игроков о начале игры
        io.to('game-room').emit('game-started', {
            players: gameRoom.players,
            gameState: gameRoom.gameState,
            gamePhase: gameRoom.gamePhase,
            currentRound: gameRoom.currentRound,
            timeLeft: gameRoom.timeLeft
        });
    });
    
    // НОВЫЙ обработчик для начала раунда
    socket.on('start-round', () => {
        console.log('🎯 Round start requested by:', socket.id);
        
        const player = gameRoom.players.find(p => p.id === socket.id);
        
        if (!player || !player.isHost) {
            socket.emit('error', 'Только хост может начать раунд!');
            return;
        }
        
        if (gameRoom.gamePhase !== 'preparation') {
            socket.emit('error', 'Раунд уже начался!');
            return;
        }
        
        startRevelationPhase();
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
        
        // Записываем голос
        if (!gameRoom.votingResults[data.targetId]) {
            gameRoom.votingResults[data.targetId] = [];
        }
        
        gameRoom.votingResults[data.targetId].push(voter.id);
        voter.hasVoted = true;
        
        // Обновляем счетчики голосов
        gameRoom.players.forEach(player => {
            player.votes = gameRoom.votingResults[player.id] ? gameRoom.votingResults[player.id].length : 0;
        });
        
        // Считаем общее количество голосов
        const alivePlayers = gameRoom.players.filter(p => p.isAlive);
        const votedPlayers = alivePlayers.filter(p => p.hasVoted);
        
        console.log(`📊 Votes: ${votedPlayers.length}/${alivePlayers.length}`);
        
        // Отправляем обновление голосования
        io.to('game-room').emit('vote-update', {
            players: gameRoom.players,
            votingResults: gameRoom.votingResults,
            votedCount: votedPlayers.length,
            totalPlayers: alivePlayers.length
        });
        
        // Если все проголосовали - завершаем голосование досрочно
        if (votedPlayers.length >= alivePlayers.length) {
            console.log('✅ All players voted - ending voting phase early');
            clearInterval(gameRoom.timer);
            showResults();
        }
    });
    
    socket.on('reveal-characteristic', (data) => {
        console.log('🔍 Reveal characteristic:', data);
        
        if (gameRoom.gamePhase !== 'revelation') {
            socket.emit('error', 'Сейчас не время для раскрытия характеристик!');
            return;
        }
        
        const player = gameRoom.players.find(p => p.id === socket.id);
        
        if (!player || !player.isAlive) {
            socket.emit('error', 'Вы не можете раскрыть характеристику!');
            return;
        }
        
        if (gameRoom.currentTurnPlayer !== player.id) {
            socket.emit('error', 'Сейчас не ваш ход!');
            return;
        }
        
        if (!player.revealedCharacteristics) {
            player.revealedCharacteristics = [];
        }
        
        const revealedCount = player.revealedCharacteristics.length;
        const isProfessionRevealed = player.revealedCharacteristics.includes('profession');
        
        // НОВАЯ ЛОГИКА ВАЛИДАЦИИ
        if (gameRoom.currentRound === 1) {
            // Первый раунд: профессия + 1 любая
            if (revealedCount === 0 && data.characteristic !== 'profession') {
                socket.emit('error', 'В первом раунде сначала нужно раскрыть профессию!');
                return;
            }
            if (revealedCount === 1 && data.characteristic === 'profession') {
                socket.emit('error', 'Профессия уже раскрыта! Выберите другую характеристику.');
                return;
            }
            if (revealedCount >= 2) {
                socket.emit('error', 'В первом раунде можно раскрыть только 2 характеристики!');
                return;
            }
        } else {
            // Последующие раунды: по 1 характеристике
            if (revealedCount >= gameRoom.currentRound + 1) { // +1 потому что в первом раунде 2 характеристики
                socket.emit('error', 'В этом раунде вы уже раскрыли характеристику!');
                return;
            }
        }
        
        // Проверяем, не раскрыта ли уже эта характеристика
        if (player.revealedCharacteristics.includes(data.characteristic)) {
            socket.emit('error', 'Эта характеристика уже раскрыта!');
            return;
        }
        
        // Раскрываем характеристику
        player.revealedCharacteristics.push(data.characteristic);
        
        // Проверяем, завершил ли игрок раскрытие для этого раунда
        const expectedReveals = gameRoom.currentRound === 1 ? 2 : gameRoom.currentRound + 1;
        if (player.revealedCharacteristics.length >= expectedReveals) {
            player.hasRevealed = true;
            gameRoom.playersWhoRevealed.push(player.id);
        }
        
        // Отправляем обновление всем игрокам
        io.to('game-room').emit('characteristic-revealed', {
            playerId: player.id,
            playerName: player.name,
            characteristic: data.characteristic,
            value: player.characteristics[data.characteristic],
            players: gameRoom.players
        });
        
        // Если игрок завершил раскрытие, переходим к следующему
        if (player.hasRevealed) {
            clearInterval(gameRoom.timer);
            setTimeout(() => {
                nextPlayerTurn();
            }, 2000);
        }
    });
    
    socket.on('disconnect', () => {
        console.log('❌ User disconnected:', socket.id);
        
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
            io.to('game-room').emit('player-left', {
                leftPlayer: player.name,
                players: gameRoom.players,
                gameState: gameRoom.gameState
            });
        }
    });
    
    socket.on('change-max-players', (data) => {
        console.log('🔧 Changing max players to:', data.maxPlayers);
        
        const player = gameRoom.players.find(p => p.id === socket.id);
        
        if (!player || !player.isHost) {
            socket.emit('error', 'Только хост может изменить количество игроков!');
            return;
        }
        
        if (gameRoom.gameState !== 'lobby') {
            socket.emit('error', 'Нельзя изменить количество игроков во время игры!');
            return;
        }
        
        const newMaxPlayers = parseInt(data.maxPlayers);
        if (![8, 12, 16].includes(newMaxPlayers)) {
            socket.emit('error', 'Недопустимое количество игроков!');
            return;
        }
        
        // Проверяем, что текущее количество игроков не превышает новый лимит
        if (gameRoom.players.length > newMaxPlayers) {
            socket.emit('error', `Сейчас в игре ${gameRoom.players.length} игроков. Нельзя установить лимит ${newMaxPlayers}.`);
            return;
        }
        
        gameRoom.maxPlayers = newMaxPlayers;
        
        // Уведомляем всех игроков об изменении
        io.to('game-room').emit('max-players-changed', {
            maxPlayers: gameRoom.maxPlayers,
            players: gameRoom.players
        });
    });
});

// === НОВЫЕ ФУНКЦИИ УПРАВЛЕНИЯ ФАЗАМИ ===

function startRevelationPhase() {
    console.log('🔍 Starting revelation phase');
    
    gameRoom.gamePhase = 'revelation';
    gameRoom.playersWhoRevealed = [];
    
    // Сбрасываем состояние раскрытия для всех игроков
    gameRoom.players.forEach(player => {
        player.hasRevealed = false;
    });
    
    // Начинаем с первого живого игрока
    const alivePlayers = gameRoom.players.filter(p => p.isAlive);
    if (alivePlayers.length > 0) {
        gameRoom.currentTurnPlayer = alivePlayers[0].id;
        startPlayerTurn();
    }
}

function startPlayerTurn() {
    gameRoom.timeLeft = 60; // 1 минута на игрока
    
    startGameTimer();
    
    // ИСПРАВЛЕНО: отправляем правильные данные о ходе
    io.to('game-room').emit('phase-changed', {
        gamePhase: gameRoom.gamePhase,
        currentTurnPlayer: gameRoom.currentTurnPlayer, // ВАЖНО: передаем текущего игрока
        timeLeft: gameRoom.timeLeft,
        players: gameRoom.players
    });
    
    console.log(`🎯 Player turn: ${gameRoom.currentTurnPlayer}, time: ${gameRoom.timeLeft}s`);
}

function nextPlayerTurn() {
    const alivePlayers = gameRoom.players.filter(p => p.isAlive);
    const currentIndex = alivePlayers.findIndex(p => p.id === gameRoom.currentTurnPlayer);
    
    if (currentIndex === -1) {
        startDiscussionPhase();
        return;
    }
    
    const nextIndex = currentIndex + 1;
    
    if (nextIndex >= alivePlayers.length) {
        // Проверяем, все ли игроки завершили раскрытие
        const allRevealed = alivePlayers.every(player => player.hasRevealed);
        
        if (allRevealed) {
            // Все игроки раскрыли - переходим к обсуждению
            startDiscussionPhase();
        } else {
            // Возвращаемся к первому игроку, который еще не завершил
            const nextPlayer = alivePlayers.find(p => !p.hasRevealed);
            if (nextPlayer) {
                gameRoom.currentTurnPlayer = nextPlayer.id;
                console.log(`🔄 Continuing with player: ${nextPlayer.name}`);
                startPlayerTurn();
            } else {
                startDiscussionPhase();
            }
        }
    } else {
        // Следующий игрок
        gameRoom.currentTurnPlayer = alivePlayers[nextIndex].id;
        console.log(`➡️ Next player: ${alivePlayers[nextIndex].name}`);
        startPlayerTurn();
    }
}

function startDiscussionPhase() {
    console.log('💬 Starting discussion phase');
    
    gameRoom.gamePhase = 'discussion';
    gameRoom.timeLeft = 300; // 5 минут на обсуждение
    gameRoom.currentTurnPlayer = null; // ВАЖНО: убираем текущего игрока
    
    startGameTimer();
    
    io.to('game-room').emit('phase-changed', {
        gamePhase: gameRoom.gamePhase,
        timeLeft: gameRoom.timeLeft,
        currentTurnPlayer: null, // ВАЖНО: передаем null
        players: gameRoom.players
    });
}

function startVotingPhase() {
    gameRoom.gamePhase = 'voting';
    gameRoom.timeLeft = 120; // 2 минуты на голосование
    gameRoom.votingResults = {};
    gameRoom.totalVotes = 0;
    
    // Сбрасываем голоса
    gameRoom.players.forEach(player => {
        player.votes = 0;
        player.hasVoted = false;
    });
    
    console.log('🗳️ Starting voting phase');
    
    startGameTimer();
    
    io.to('game-room').emit('phase-changed', {
        gamePhase: gameRoom.gamePhase,
        timeLeft: gameRoom.timeLeft,
        players: gameRoom.players
    });
}

function startGameTimer() {
    if (gameRoom.timer) {
        clearInterval(gameRoom.timer);
    }
    
    gameRoom.timer = setInterval(() => {
        gameRoom.timeLeft--;
        
        // Отправляем обновление таймера каждые 10 секунд или в последние 10 секунд
        if (gameRoom.timeLeft % 10 === 0 || gameRoom.timeLeft <= 10) {
            io.to('game-room').emit('timer-update', {
                timeLeft: gameRoom.timeLeft,
                gamePhase: gameRoom.gamePhase,
                currentTurnPlayer: gameRoom.currentTurnPlayer
            });
        }
        
        if (gameRoom.timeLeft <= 0) {
            clearInterval(gameRoom.timer);
            handlePhaseTimeout();
        }
    }, 1000);
}

function handlePhaseTimeout() {
    console.log('⏰ Phase timeout:', gameRoom.gamePhase);
    
    switch (gameRoom.gamePhase) {
        case 'revelation':
            // Пропускаем ход игрока
            nextPlayerTurn();
            break;
        case 'discussion':
            startVotingPhase();
            break;
        case 'voting':
            showResults();
            break;
    }
}

function showResults() {
    gameRoom.gamePhase = 'results';
    
    // Определяем игрока с наибольшим количеством голосов
    let maxVotes = 0;
    let eliminatedPlayer = null;
    
    gameRoom.players.forEach(player => {
        if (player.isAlive && player.votes > maxVotes) {
            maxVotes = player.votes;
            eliminatedPlayer = player;
        }
    });
    
    if (eliminatedPlayer && maxVotes > 0) {
        eliminatedPlayer.isAlive = false;
        console.log('💀 Player eliminated:', eliminatedPlayer.name);
    }
    
    // Сбрасываем состояние раунда
    gameRoom.players.forEach(player => {
        player.hasRevealed = false;
        player.votes = 0;
        player.hasVoted = false;
        // НЕ сбрасываем revealedCharacteristics - они остаются на всю игру
    });
    
    gameRoom.revealedThisRound = 0;
    gameRoom.currentTurnPlayer = null;
    
    io.to('game-room').emit('round-results', {
        eliminatedPlayer: eliminatedPlayer ? eliminatedPlayer.name : null,
        players: gameRoom.players,
        votingResults: gameRoom.votingResults
    });
    
    // Через 5 секунд переходим к следующему раунду
    setTimeout(() => {
        nextRound();
    }, 5000);
}

function nextRound() {
    gameRoom.currentRound++;
    
    // Проверяем условия окончания игры
    const alivePlayers = gameRoom.players.filter(p => p.isAlive);
    
    if (alivePlayers.length <= 1 || gameRoom.currentRound > gameRoom.maxRounds) {
        endGame();
        return;
    }
    
    // Начинаем новый раунд
    gameRoom.gamePhase = 'preparation';
    gameRoom.timeLeft = 0;
    gameRoom.currentTurnPlayer = null;
    
    console.log('🔄 Starting round:', gameRoom.currentRound);
    
    io.to('game-room').emit('new-round', {
        currentRound: gameRoom.currentRound,
        gamePhase: gameRoom.gamePhase,
        timeLeft: gameRoom.timeLeft,
        players: gameRoom.players
    });
}

function endGame() {
    gameRoom.gameState = 'finished';
    gameRoom.gamePhase = 'finished';
    
    if (gameRoom.timer) {
        clearInterval(gameRoom.timer);
    }
    
    const alivePlayers = gameRoom.players.filter(p => p.isAlive);
    
    console.log('🏁 Game ended. Winners:', alivePlayers.map(p => p.name));
    
    io.to('game-room').emit('game-ended', {
        winners: alivePlayers,
        players: gameRoom.players
    });
    
    // Через 10 секунд сбрасываем игру
    setTimeout(() => {
        resetGame();
    }, 10000);
}

function resetGame() {
    console.log('🔄 Resetting game...');
    
    if (gameRoom.timer) {
        clearInterval(gameRoom.timer);
    }
    
    // Оставляем игроков, но сбрасываем игровое состояние
    gameRoom.players.forEach(player => {
        player.isAlive = true;
        player.votes = 0;
        player.hasRevealed = false;
        player.hasVoted = false;
        player.revealedCharacteristics = []; // СБРАСЫВАЕМ при новой игре
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
    
    io.to('game-room').emit('game-reset', {
        players: gameRoom.players,
        gameState: gameRoom.gameState
    });
}

// Вспомогательные функции для генерации данных (остаются прежними)
const professions = [
    "Врач", "Учитель", "Инженер", "Повар", "Программист", "Механик",
    "Писатель", "Художник", "Музыкант", "Строитель", "Фермер", "Пилот",
    "Медсестра", "Полицейский", "Пожарный", "Ветеринар", "Переводчик",
    "Дизайнер", "Фотограф", "Журналист", "Психолог", "Бухгалтер"
];

const healthConditions = [
    "Отличное здоровье", "Хорошее здоровье", "Удовлетворительное здоровье",
    "Близорукость", "Дальнозоркость", "Астма", "Аллергия на пыль",
    "Аллергия на животных", "Диабет", "Гипертония", "Артрит",
    "Хроническая усталость", "Мигрени", "Бессонница", "Депрессия"
];

const hobbies = [
    "Чтение", "Кулинария", "Садоводство", "Рисование", "Музыка",
    "Спорт", "Танцы", "Фотография", "Путешествия", "Коллекционирование",
    "Рукоделие", "Игры", "Рыбалка", "Охота", "Йога", "Медитация"
];

const phobias = [
    "Боязнь темноты", "Боязнь высоты", "Боязнь замкнутых пространств",
    "Боязнь пауков", "Боязнь змей", "Боязнь собак", "Боязнь воды",
    "Боязнь огня", "Боязнь толпы", "Боязнь публичных выступлений"
];

const baggage = [
    "Рюкзак с едой", "Аптечка", "Инструменты", "Оружие", "Книги",
    "Семена растений", "Радио", "Фонарик", "Одеяла", "Одежда",
    "Документы", "Деньги", "Украшения", "Лекарства", "Компьютер"
];

const facts = [
    "Был в тюрьме", "Спас чью-то жизнь", "Выиграл в лотерею",
    "Знает 5 языков", "Чемпион по шахматам", "Бывший военный",
    "Имеет двойное гражданство", "Работал в цирке", "Писал книги",
    "Изобрел что-то важное", "Путешествовал по всему миру",
    "Выжил в авиакатастрофе", "Встречал знаменитость", "Умеет читать мысли",
    "Владеет недвижимостью", "Участвовал в реалити-шоу", "Говорит на 3+ языках",
    "Имеет татуировку", "Боится темноты", "Коллекционирует что-то редкое",
    "Работал в другой стране", "Имеет необычное хобби", "Был на телевидении"
];

const actionCards = [
    { id: 1, name: "Целитель", description: "Можете спасти одного игрока от исключения", type: "protective", usesLeft: 1 },
    { id: 2, name: "Детектив", description: "Узнайте одну характеристику любого игрока", type: "investigative", usesLeft: 1 },
    { id: 3, name: "Саботажник", description: "Отмените раскрытие характеристики другого игрока", type: "disruptive", usesLeft: 1 },
    { id: 4, name: "Лидер", description: "Ваш голос считается за два", type: "influential", usesLeft: 1 }
];

function generateCharacteristics() {
    const availableFacts = [...facts]; // Копия массива
    const fact1 = getRandomItem(availableFacts);
    
    // Удаляем выбранный факт из доступных
    const fact1Index = availableFacts.indexOf(fact1);
    availableFacts.splice(fact1Index, 1);
    
    const fact2 = getRandomItem(availableFacts);
    
    return {
        profession: getRandomItem(professions),
        health: getRandomItem(healthConditions),
        hobby: getRandomItem(hobbies),
        phobia: getRandomItem(phobias),
        baggage: getRandomItem(baggage),
        fact1: fact1,
        fact2: fact2
    };
}

function getRandomActionCard() {
    return { ...getRandomItem(actionCards) };
}

function getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Single Room Bunker Game running on port ${PORT}`);
});