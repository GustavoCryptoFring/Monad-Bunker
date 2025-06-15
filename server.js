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
    maxPlayers: 12,
    gamePhase: 'waiting', // waiting, discussion, voting, results
    currentRound: 1,
    maxRounds: 3,
    timer: null,
    timeLeft: 0,
    votingResults: {},
    revealedThisRound: 0
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
        timeLeft: gameRoom.timeLeft
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
            characteristics: null, // Будут созданы при старте игры
            actionCards: []
        };
        
        gameRoom.players.push(newPlayer);
        socket.join('game-room');
        
        console.log('✅ Player joined:', data.playerName, 'Total players:', gameRoom.players.length);
        
        // Отправляем обновление всем игрокам
        io.to('game-room').emit('player-joined', {
            players: gameRoom.players,
            newPlayer: data.playerName,
            gameState: gameRoom.gameState,
            maxPlayers: gameRoom.maxPlayers // ДОБАВИЛИ maxPlayers
        });
        
        // Подтверждение присоединения
        socket.emit('join-confirmed', {
            playerId: socket.id,
            playerName: data.playerName,
            isHost: newPlayer.isHost,
            maxPlayers: gameRoom.maxPlayers // ДОБАВИЛИ maxPlayers
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
        });
        
        gameRoom.gameState = 'playing';
        gameRoom.gamePhase = 'discussion';
        gameRoom.currentRound = 1;
        gameRoom.timeLeft = 180; // 3 минуты на обсуждение
        
        console.log('🚀 Game started! Players:', gameRoom.players.length);
        
        // Запускаем таймер
        startGameTimer();
        
        // Уведомляем всех игроков о начале игры
        io.to('game-room').emit('game-started', {
            players: gameRoom.players,
            gameState: gameRoom.gameState,
            gamePhase: gameRoom.gamePhase,
            currentRound: gameRoom.currentRound,
            timeLeft: gameRoom.timeLeft
        });
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
        
        // Записываем голос
        if (!gameRoom.votingResults[data.targetId]) {
            gameRoom.votingResults[data.targetId] = [];
        }
        
        // Удаляем предыдущий голос этого игрока
        Object.keys(gameRoom.votingResults).forEach(targetId => {
            gameRoom.votingResults[targetId] = gameRoom.votingResults[targetId].filter(
                voterId => voterId !== voter.id
            );
        });
        
        // Добавляем новый голос
        gameRoom.votingResults[data.targetId].push(voter.id);
        
        // Обновляем счетчики голосов
        gameRoom.players.forEach(player => {
            player.votes = gameRoom.votingResults[player.id] ? gameRoom.votingResults[player.id].length : 0;
        });
        
        // Отправляем обновление голосования
        io.to('game-room').emit('vote-update', {
            players: gameRoom.players,
            votingResults: gameRoom.votingResults
        });
    });
    
    socket.on('reveal-characteristic', (data) => {
        console.log('🔍 Reveal characteristic:', data);
        
        if (gameRoom.gamePhase !== 'discussion') {
            socket.emit('error', 'Раскрывать характеристики можно только в фазе обсуждения!');
            return;
        }
        
        const player = gameRoom.players.find(p => p.id === socket.id);
        
        if (!player || !player.isAlive) {
            socket.emit('error', 'Вы не можете раскрыть характеристику!');
            return;
        }
        
        if (player.hasRevealed) {
            socket.emit('error', 'Вы уже раскрыли характеристику в этом раунде!');
            return;
        }
        
        player.hasRevealed = true;
        gameRoom.revealedThisRound++;
        
        // Отправляем обновление всем игрокам
        io.to('game-room').emit('characteristic-revealed', {
            playerId: player.id,
            playerName: player.name,
            characteristic: data.characteristic,
            value: player.characteristics[data.characteristic],
            players: gameRoom.players
        });
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

// Функции управления игрой
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
                gamePhase: gameRoom.gamePhase
            });
        }
        
        if (gameRoom.timeLeft <= 0) {
            clearInterval(gameRoom.timer);
            nextPhase();
        }
    }, 1000);
}

function nextPhase() {
    console.log('⏭️ Moving to next phase from:', gameRoom.gamePhase);
    
    switch (gameRoom.gamePhase) {
        case 'discussion':
            startVotingPhase();
            break;
        case 'voting':
            showResults();
            break;
        case 'results':
            nextRound();
            break;
    }
}

function startVotingPhase() {
    gameRoom.gamePhase = 'voting';
    gameRoom.timeLeft = 60; // 1 минута на голосование
    gameRoom.votingResults = {};
    
    // Сбрасываем голоса
    gameRoom.players.forEach(player => {
        player.votes = 0;
    });
    
    console.log('🗳️ Starting voting phase');
    
    startGameTimer();
    
    io.to('game-room').emit('phase-changed', {
        gamePhase: gameRoom.gamePhase,
        timeLeft: gameRoom.timeLeft,
        players: gameRoom.players
    });
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
    });
    
    gameRoom.revealedThisRound = 0;
    
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
    gameRoom.gamePhase = 'discussion';
    gameRoom.timeLeft = 180;
    
    console.log('🔄 Starting round:', gameRoom.currentRound);
    
    startGameTimer();
    
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
    
    io.to('game-room').emit('game-reset', {
        players: gameRoom.players,
        gameState: gameRoom.gameState
    });
}

// Вспомогательные функции для генерации данных
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
    "Изобрел что-то важное", "Путешествовал по всему миру"
];

const actionCards = [
    { id: 1, name: "Целитель", description: "Можете спасти одного игрока от исключения", type: "protective", usesLeft: 1 },
    { id: 2, name: "Детектив", description: "Узнайте одну характеристику любого игрока", type: "investigative", usesLeft: 1 },
    { id: 3, name: "Саботажник", description: "Отмените раскрытие характеристики другого игрока", type: "disruptive", usesLeft: 1 },
    { id: 4, name: "Лидер", description: "Ваш голос считается за два", type: "influential", usesLeft: 1 }
];

function generateCharacteristics() {
    return {
        profession: getRandomItem(professions),
        health: getRandomItem(healthConditions),
        hobby: getRandomItem(hobbies),
        phobia: getRandomItem(phobias),
        baggage: getRandomItem(baggage),
        fact: getRandomItem(facts)
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