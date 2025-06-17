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
                startJustificationPhase();
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
async function autoRevealRemainingCards(player) {
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
        
        // Небольшая задержка между раскрытиями для лучшего UX
        await new Promise(resolve => setTimeout(resolve, 1000));
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
        currentTurnPlayer: gameRoom.currentTurnPlayer,
        maxPlayers: gameRoom.maxPlayers,
        startRoundVotes: gameRoom.startRoundVotes || [] // ДОБАВЛЯЕМ
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
        
        // Подтверждение присоединения - добавляем startRoundVotes
        socket.emit('join-confirmed', {
            playerId: socket.id,
            playerName: data.playerName,
            isHost: newPlayer.isHost,
            maxPlayers: gameRoom.maxPlayers,
            startRoundVotes: gameRoom.startRoundVotes || [] // ДОБАВЛЯЕМ
        });
        
        // Отправляем обновление всем игрокам - добавляем startRoundVotes
        io.to('game-room').emit('player-joined', {
            players: gameRoom.players,
            newPlayer: data.playerName,
            gameState: gameRoom.gameState,
            maxPlayers: gameRoom.maxPlayers,
            startRoundVotes: gameRoom.startRoundVotes || [] // ДОБАВЛЯЕМ
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
            player.revealedCharacteristics = [];
            player.cardsRevealedThisRound = 0;
        });
        
        gameRoom.gameState = 'playing';
        gameRoom.gamePhase = 'preparation';
        gameRoom.currentRound = 1;
        gameRoom.timeLeft = 0;
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
    
    socket.on('vote-skip-discussion', () => {
        console.log('⏭️ Vote to skip discussion from:', socket.id);
        
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
            socket.emit('error', 'Вы уже проголосовали за пропуск!');
            return;
        }
        
        // Добавляем голос
        gameRoom.skipDiscussionVotes.push(socket.id);
        
        const requiredVotes = 2; // Всегда требуется ровно 2 голоса
        const currentVotes = gameRoom.skipDiscussionVotes.length;
        
        console.log(`⏭️ Skip votes: ${currentVotes}/${requiredVotes}`);
        
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
            gameRoom.skipDiscussionVotes = []; // Сбрасываем голоса
            
            // Отправляем уведомление о пропуске
            io.to('game-room').emit('discussion-skipped', {
                gamePhase: 'voting',
                timeLeft: 120,
                players: gameRoom.players
                // УБИРАЕМ notificationSettings
            });
            
            startVotingPhase();
        }
    });
    
    socket.on('reveal-characteristic', (data) => {
        console.log('🔍 Revealing characteristic:', data);
        
        const player = gameRoom.players.find(p => p.id === socket.id);
        
        if (!player || !player.isAlive) {
            socket.emit('error', 'Вы не можете раскрывать характеристики!');
            return;
        }
        
        if (gameRoom.gamePhase !== 'revelation') {
            socket.emit('error', 'Сейчас не фаза раскрытия!');
            return;
        }
        
        if (gameRoom.currentTurnPlayer !== socket.id) {
            socket.emit('error', 'Сейчас не ваш ход!');
            return;
        }
        
        const characteristic = data.characteristic;
        
        if (!player.characteristics || !player.characteristics[characteristic]) {
            socket.emit('error', 'Некорректная характеристика!');
            return;
        }
        
        // Проверяем, не была ли уже раскрыта эта характеристика
        if (player.revealedCharacteristics && player.revealedCharacteristics.includes(characteristic)) {
            socket.emit('error', 'Эта характеристика уже раскрыта!');
            return;
        }
        
        // Проверка правил раскрытия для текущего раунда
        const requiredCards = getRequiredCardsForRound(gameRoom.currentRound);
        const currentlyRevealed = player.cardsRevealedThisRound || 0;
        
        if (currentlyRevealed >= requiredCards) {
            socket.emit('error', 'Вы уже раскрыли максимальное количество карт в этом раунде!');
            return;
        }
        
        // В первом раунде первая карта должна быть профессией
        if (gameRoom.currentRound === 1 && currentlyRevealed === 0 && characteristic !== 'profession') {
            socket.emit('error', 'В первом раунде нужно сначала раскрыть профессию!');
            return;
        }
        
        // Раскрываем характеристику
        if (!player.revealedCharacteristics) {
            player.revealedCharacteristics = [];
        }
        
        player.revealedCharacteristics.push(characteristic);
        player.cardsRevealedThisRound = (player.cardsRevealedThisRound || 0) + 1;
        
        console.log(`✅ ${player.name} revealed ${characteristic}: ${player.characteristics[characteristic]} (${player.cardsRevealedThisRound}/${requiredCards})`);
        
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
        
        // Проверяем, завершил ли игрок раскрытие в этом раунде
        if (player.cardsRevealedThisRound >= requiredCards) {
            player.hasRevealed = true;
            console.log(`✅ ${player.name} finished revealing for round ${gameRoom.currentRound}`);
            
            // Переходим к следующему игроку через 2 секунды
            setTimeout(() => {
                nextPlayerTurn();
            }, 2000);
        } else {
            // Игрок может раскрыть еще одну карту в этом ходу
            console.log(`⏳ ${player.name} can reveal ${requiredCards - player.cardsRevealedThisRound} more cards`);
            
            // Обновляем таймер для продолжения хода
            gameRoom.timeLeft = 60;
            
            // Отправляем обновление таймера
            io.to('game-room').emit('timer-update', {
                timeLeft: gameRoom.timeLeft,
                gamePhase: gameRoom.gamePhase,
                currentTurnPlayer: gameRoom.currentTurnPlayer
            });
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

// УБИРАЕМ ДУБЛИРУЮЩИЙ ОБРАБОТЧИК use-action-card который был вне connection блока
// socket.on('use-action-card', ...) - УДАЛЯЕМ ПОЛНОСТЬЮ

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
    // Очищаем предыдущий таймер
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
        
        // Время истекло
        if (gameRoom.timeLeft <= 0) {
            clearInterval(gameRoom.timer);
            handlePhaseTimeout();
        }
    }, 1000);
}
