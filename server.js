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

// Единая игровая комната для всех
const gameRoom = {
    players: [],
    gameState: 'lobby', // lobby, playing, finished
    maxPlayers: 8, // ИЗМЕНЕНО: по умолчанию 8 игроков
    gamePhase: 'waiting', // waiting, preparation, revelation, discussion, voting, results, justification
    currentRound: 1,
    maxRounds: 3,
    timer: null,
    timeLeft: 0,
    votingResults: {},
    revealedThisRound: 0,
    currentTurnPlayer: null, // Для фазы раскрытия
    playersWhoRevealed: [], // Кто уже раскрыл в этом раунде
    totalVotes: 0, // Для досрочного завершения голосования
    skipDiscussionVotes: [], // ДОБАВЛЕНО: голоса за пропуск обсуждения
    // НОВЫЕ ПОЛЯ ДЛЯ ОПРАВДАНИЙ
    justificationQueue: [], // Очередь игроков на оправдание
    currentJustifyingPlayer: null, // Текущий оправдывающийся игрок
    justificationPhase: 1, // Номер фазы оправдания (может быть несколько раундов)
    canChangeVote: {}, // Отслеживание возможности смены голоса для каждого игрока
    // НОВЫЕ НАСТРОЙКИ УВЕДОМЛЕНИЙ
    notificationSettings: {
        gameStart: false,
        discussionSkipped: false,
        newRound: false,
        playerJoined: false  // ДОБАВЛЯЕМ НОВУЮ НАСТРОЙКУ
    }
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
        notificationSettings: gameRoom.notificationSettings // НОВОЕ
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
        
        // Подтверждение присоединения - ОБЯЗАТЕЛЬНО с maxPlayers
        socket.emit('join-confirmed', {
            playerId: socket.id,
            playerName: data.playerName,
            isHost: newPlayer.isHost,
            maxPlayers: gameRoom.maxPlayers,
            notificationSettings: gameRoom.notificationSettings // НОВОЕ
        });
        
        // Отправляем обновление всем игрокам
        io.to('game-room').emit('player-joined', {
            players: gameRoom.players,
            newPlayer: data.playerName,
            gameState: gameRoom.gameState,
            maxPlayers: gameRoom.maxPlayers,
            notificationSettings: gameRoom.notificationSettings // НОВОЕ
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
        voter.votedFor = data.targetId;
        
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
        
        // Если все проголосовали - переходим к оправданиям
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
                players: gameRoom.players,
                notificationSettings: gameRoom.notificationSettings // НОВОЕ
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
});

// === ФУНКЦИИ УПРАВЛЕНИЯ ФАЗАМИ ===

function getRequiredCardsForRound(round) {
    if (round === 1) {
        return 2; // Профессия + 1 карта на выбор
    } else {
        return 1; // 1 карта на выбор
    }
}

function startRevelationPhase() {
    console.log('🔍 Starting revelation phase for round:', gameRoom.currentRound);
    
    gameRoom.gamePhase = 'revelation';
    gameRoom.playersWhoRevealed = [];
    
    // Сбрасываем состояние раскрытия для всех игроков ТОЛЬКО для текущего раунда
    gameRoom.players.forEach(player => {
        player.hasRevealed = false;
        player.cardsRevealedThisRound = 0;
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
    
    // Отправляем правильные данные о ходе
    io.to('game-room').emit('phase-changed', {
        gamePhase: gameRoom.gamePhase,
        currentTurnPlayer: gameRoom.currentTurnPlayer,
        timeLeft: gameRoom.timeLeft,
        players: gameRoom.players,
        currentRound: gameRoom.currentRound
    });
    
    console.log(`🎯 Player turn: ${gameRoom.currentTurnPlayer}, time: ${gameRoom.timeLeft}s, round: ${gameRoom.currentRound}`);
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
        // Проверяем завершение раунда по новым правилам
        const allPlayersFinished = alivePlayers.every(player => {
            const requiredCards = getRequiredCardsForRound(gameRoom.currentRound);
            return (player.cardsRevealedThisRound || 0) >= requiredCards;
        });
        
        if (allPlayersFinished) {
            // Все игроки завершили раскрытие - переходим к обсуждению
            console.log('✅ All players finished revealing for round', gameRoom.currentRound);
            startDiscussionPhase();
        } else {
            // Возвращаемся к первому игроку, который еще не завершил
            const nextPlayer = alivePlayers.find(player => {
                const requiredCards = getRequiredCardsForRound(gameRoom.currentRound);
                return (player.cardsRevealedThisRound || 0) < requiredCards;
            });
            
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
    gameRoom.currentTurnPlayer = null;
    gameRoom.skipDiscussionVotes = [];
    
    startGameTimer();
    
    io.to('game-room').emit('phase-changed', {
        gamePhase: gameRoom.gamePhase,
        timeLeft: gameRoom.timeLeft,
        currentTurnPlayer: null,
        players: gameRoom.players
    });
}

function startJustificationPhase() {
    console.log('⚖️ Starting justification phase');
    
    // Определяем игроков с максимальным количеством голосов
    const alivePlayers = gameRoom.players.filter(p => p.isAlive);
    let maxVotes = 0;
    
    alivePlayers.forEach(player => {
        if (player.votes > maxVotes) {
            maxVotes = player.votes;
        }
    });
    
    // Если никто не получил голосов или максимум голосов = 0
    if (maxVotes === 0) {
        console.log('📊 No votes - proceeding to next round');
        nextRound();
        return;
    }
    
    // Находим всех игроков с максимальным количеством голосов
    const playersToJustify = alivePlayers.filter(player => player.votes === maxVotes);
    
    console.log(`⚖️ Players to justify (${maxVotes} votes):`, playersToJustify.map(p => p.name));
    
    if (playersToJustify.length === 0) {
        nextRound();
        return;
    }
    
    gameRoom.gamePhase = 'justification';
    gameRoom.justificationQueue = [...playersToJustify];
    gameRoom.currentJustifyingPlayer = null;
    
    // Даем всем возможность сменить голос в следующем голосовании
    gameRoom.players.forEach(player => {
        if (player.isAlive) {
            gameRoom.canChangeVote[player.id] = true;
        }
    });
    
    // Начинаем первое оправдание
    nextJustification();
}

function nextJustification() {
    if (gameRoom.justificationQueue.length === 0) {
        // Все оправдались - показываем результаты
        console.log('✅ All justifications completed - showing results');
        showResults();
        return;
    }
    
    const nextPlayer = gameRoom.justificationQueue.shift();
    gameRoom.currentJustifyingPlayer = nextPlayer.id;
    gameRoom.timeLeft = 120; // 2 минуты на оправдание
    
    console.log(`⚖️ Justification turn: ${nextPlayer.name}`);
    
    startGameTimer();
    
    io.to('game-room').emit('justification-started', {
        justifyingPlayer: nextPlayer,
        timeLeft: gameRoom.timeLeft,
        remainingQueue: gameRoom.justificationQueue.length,
        players: gameRoom.players
    });
}

function startSecondVoting() {
    console.log('🗳️ Starting second voting phase');
    
    gameRoom.gamePhase = 'voting';
    gameRoom.timeLeft = 120; // 2 минуты на повторное голосование
    
    // НЕ сбрасываем голоса - они остаются
    // НЕ сбрасываем hasVoted - игроки уже голосовали
    
    startGameTimer();
    
    io.to('game-room').emit('second-voting-started', {
        gamePhase: gameRoom.gamePhase,
        timeLeft: gameRoom.timeLeft,
        players: gameRoom.players,
        canChangeVote: gameRoom.canChangeVote
    });
}

function startVotingPhase() {
    gameRoom.gamePhase = 'voting';
    gameRoom.timeLeft = 120; // 2 минуты на голосование
    gameRoom.votingResults = {};
    gameRoom.totalVotes = 0;
    gameRoom.skipDiscussionVotes = [];
    gameRoom.justificationQueue = [];
    gameRoom.currentJustifyingPlayer = null;
    gameRoom.canChangeVote = {};
    
    // Сбрасываем голоса
    gameRoom.players.forEach(player => {
        player.votes = 0;
        player.hasVoted = false;
        player.votedFor = null;
    });
    
    console.log('🗳️ Starting voting phase');
    
    startGameTimer();
    
    io.to('game-room').emit('phase-changed', {
        gamePhase: gameRoom.gamePhase,
        timeLeft: gameRoom.timeLeft,
        players: gameRoom.players
    });
}

// ИСПРАВЛЯЕМ обработчик timeout - добавляем недостающие переходы
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
    
    // Проверяем на ничью
    const playersWithMaxVotes = gameRoom.players.filter(p => p.isAlive && p.votes === maxVotes);
    
    if (playersWithMaxVotes.length > 1) {
        // Ничья - никого не исключаем
        eliminatedPlayer = null;
        console.log('🤝 Tie vote - no elimination');
    } else if (eliminatedPlayer && maxVotes > 0) {
        eliminatedPlayer.isAlive = false;
        console.log('💀 Player eliminated:', eliminatedPlayer.name);
    }
    
    // Сбрасываем состояние раунда
    gameRoom.players.forEach(player => {
        player.hasRevealed = false;
        player.votes = 0;
        player.hasVoted = false;
        player.votedFor = null;
        player.cardsRevealedThisRound = 0;
        // НЕ сбрасываем revealedCharacteristics - они остаются на всю игру
    });
    
    gameRoom.votingResults = {};
    gameRoom.revealedThisRound = 0;
    gameRoom.currentTurnPlayer = null;
    gameRoom.justificationQueue = [];
    gameRoom.currentJustifyingPlayer = null;
    gameRoom.canChangeVote = {};
    
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
    
    // Игра заканчивается когда остается 2 или меньше игроков
    if (alivePlayers.length <= 2 || gameRoom.currentRound > gameRoom.maxRounds) {
        endGame();
        return;
    }
    
    // Начинаем новый раунд
    gameRoom.gamePhase = 'preparation';
    gameRoom.timeLeft = 0;
    gameRoom.currentTurnPlayer = null;
    
    console.log('🔄 Starting round:', gameRoom.currentRound, 'Alive players:', alivePlayers.length);
    
    io.to('game-room').emit('new-round', {
        currentRound: gameRoom.currentRound,
        gamePhase: gameRoom.gamePhase,
        timeLeft: gameRoom.timeLeft,
        players: gameRoom.players,
        notificationSettings: gameRoom.notificationSettings // НОВОЕ
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
    // СБРАСЫВАЕМ НАСТРОЙКИ УВЕДОМЛЕНИЙ К ЗНАЧЕНИЯМ ПО УМОЛЧАНИЮ
    gameRoom.notificationSettings = {
        gameStart: false,
        discussionSkipped: false,
        newRound: false,
        playerJoined: false  // ДОБАВЛЯЕМ
    };
    
    io.to('game-room').emit('game-reset', {
        players: gameRoom.players,
        gameState: gameRoom.gameState,
        notificationSettings: gameRoom.notificationSettings // НОВОЕ
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
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
    console.log(`🌐 Single Room Bunker Game running on ${HOST}:${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🎮 Game room initialized with max ${gameRoom.maxPlayers} players`);
    console.log(`⚡ Server ready to accept connections`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

// Обработка ошибок
process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

function startGameTimer() {
    if (gameRoom.timer) {
        clearInterval(gameRoom.timer);
    }
    
    gameRoom.timer = setInterval(() => {
        gameRoom.timeLeft--;
        
        if (gameRoom.timeLeft <= 0) {
            clearInterval(gameRoom.timer);
            handlePhaseTimeout();
        } else {
            // Отправляем обновление таймера каждые 5 секунд или в последние 10 секунд
            if (gameRoom.timeLeft % 5 === 0 || gameRoom.timeLeft <= 10) {
                io.to('game-room').emit('timer-update', {
                    timeLeft: gameRoom.timeLeft,
                    gamePhase: gameRoom.gamePhase,
                    currentTurnPlayer: gameRoom.currentTurnPlayer
                });
            }
        }
    }, 1000);
}