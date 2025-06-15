const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Настройка Socket.IO
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

// Статические файлы
app.use(express.static(__dirname));

// Хранилище игровых комнат
const rooms = new Map();

// Генерация кода комнаты
function generateRoomCode() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
}

// Генерация характеристик игрока
function generateCharacter() {
    const professions = [
        'Врач', 'Инженер', 'Учитель', 'Строитель', 'Повар', 'Механик',
        'Программист', 'Ветеринар', 'Юрист', 'Пилот', 'Фермер', 'Художник',
        'Музыкант', 'Полицейский', 'Пожарный', 'Электрик', 'Сантехник', 'Психолог'
    ];

    const healthConditions = [
        'Здоров', 'Астма', 'Диабет', 'Гипертония', 'Аллергия на пыльцу',
        'Близорукость', 'Хроническая усталость', 'Мигрень', 'Артрит',
        'Депрессия', 'Бессонница', 'Сколиоз', 'Варикоз', 'Гастрит'
    ];

    const hobbies = [
        'Чтение', 'Рисование', 'Музыка', 'Спорт', 'Готовка', 'Садоводство',
        'Фотография', 'Путешествия', 'Коллекционирование', 'Танцы',
        'Рыбалка', 'Охота', 'Шахматы', 'Видеоигры', 'Йога', 'Медитация'
    ];

    const phobias = [
        'Арахнофобия (пауки)', 'Клаустрофобия (замкнутые пространства)',
        'Акрофобия (высота)', 'Аквафобия (вода)', 'Социофобия',
        'Агорафобия (толпы)', 'Никтофобия (темнота)', 'Авиафобия (полеты)',
        'Офидиофобия (змеи)', 'Трипанофобия (иглы)', 'Гемофобия (кровь)',
        'Некрофобия (смерть)', 'Автомобилефобия', 'Кинофобия (собаки)'
    ];

    const luggage = [
        'Рюкзак с инструментами', 'Медицинская аптечка', 'Консервы на неделю',
        'Спальный мешок', 'Портативное радио', 'Солнечная батарея',
        'Книга рецептов', 'Семена растений', 'Музыкальный инструмент',
        'Спортивное снаряжение', 'Лекарства', 'Документы', 'Фотоаппарат',
        'Ноутбук', 'Швейная машинка', 'Удочка', 'Палатка', 'Компас'
    ];

    const facts = [
        'Знает несколько языков', 'Имеет водительские права', 'Умеет готовить',
        'Служил в армии', 'Имеет высшее образование', 'Умеет плавать',
        'Знает первую помощь', 'Умеет водить мотоцикл', 'Владеет боевыми искусствами',
        'Имеет опыт выживания', 'Умеет шить', 'Знает электронику',
        'Имеет педагогический опыт', 'Владеет оружием', 'Умеет ремонтировать технику',
        'Знает психологию', 'Имеет лидерские качества', 'Умеет торговаться'
    ];

    const genders = ['Мужчина', 'Женщина'];
    const gender = genders[Math.floor(Math.random() * genders.length)];
    const age = Math.floor(Math.random() * (65 - 18 + 1)) + 18;
    const biology = `${gender}, ${age} лет`;

    const shuffledFacts = [...facts].sort(() => Math.random() - 0.5);

    return {
        'Профессия': professions[Math.floor(Math.random() * professions.length)],
        'Здоровье': healthConditions[Math.floor(Math.random() * healthConditions.length)],
        'Хобби': hobbies[Math.floor(Math.random() * hobbies.length)],
        'Фобия': phobias[Math.floor(Math.random() * phobias.length)],
        'Багаж': luggage[Math.floor(Math.random() * luggage.length)],
        'Факт 1': shuffledFacts[0],
        'Факт 2': shuffledFacts[1],
        'Биология': biology
    };
}

// Карты действий
const actionCards = [
    {
        id: 1,
        name: "Двойной голос",
        description: "Имеет двойную силу голоса при голосовании.",
        type: "voting",
        effect: "double_vote"
    },
    {
        id: 2,
        name: "Старение",
        description: "Может состарить любого игрока на 20 лет при изгнании.",
        type: "elimination",
        effect: "age_player"
    },
    {
        id: 3,
        name: "Лечение/Болезнь",
        description: "Может вылечить себя или ухудшить здоровье другого игрока.",
        type: "instant",
        effect: "health_change"
    },
    {
        id: 4,
        name: "Обмен возрастом",
        description: "Может поменяться возрастом с любым игроком.",
        type: "instant",
        effect: "swap_age"
    },
    {
        id: 5,
        name: "Замена карты",
        description: "Может заменить одну характеристику у другого игрока.",
        type: "instant",
        effect: "replace_card"
    },
    {
        id: 6,
        name: "Обмен здоровьем",
        description: "Может поменяться здоровьем с другим игроком.",
        type: "instant",
        effect: "swap_health"
    },
    {
        id: 7,
        name: "Кража багажа",
        description: "Может украсть багаж у другого игрока.",
        type: "instant",
        effect: "steal_luggage"
    }
];

// Socket.IO обработчики
io.on('connection', (socket) => {
    console.log('Новое подключение:', socket.id);

    // Создание комнаты
    socket.on('createRoom', (data) => {
        const { playerName } = data;
        const roomCode = generateRoomCode();
        
        const room = {
            code: roomCode,
            maxPlayers: 8,
            players: [],
            gameState: {
                phase: 'waiting',
                currentRound: 1,
                currentTurnPlayerId: 0,
                timer: null,
                timeLeft: 0,
                votingResults: {},
                playersWhoVoted: [],
                skipVotes: 0,
                playersToEliminateNextRound: 1
            },
            createdAt: new Date()
        };

        const hostPlayer = {
            id: 0,
            socketId: socket.id,
            name: playerName,
            isHost: true,
            characteristics: null,
            actionCard: null,
            actionCardUsed: false,
            revealedCharacteristics: [],
            eliminated: false,
            votesAgainst: 0,
            revealedThisRound: 0
        };

        room.players.push(hostPlayer);
        rooms.set(roomCode, room);
        
        socket.join(roomCode);
        socket.emit('roomCreated', {
            roomCode,
            playerId: 0,
            isHost: true
        });
        
        io.to(roomCode).emit('roomUpdate', {
            players: room.players,
            maxPlayers: room.maxPlayers
        });

        console.log(`Комната ${roomCode} создана игроком ${playerName}`);
    });

    // Присоединение к комнате
    socket.on('joinRoom', (data) => {
        const { roomCode, playerName } = data;
        const room = rooms.get(roomCode);
        
        if (!room) {
            socket.emit('error', { message: 'Комната не найдена' });
            return;
        }
        
        if (room.players.length >= room.maxPlayers) {
            socket.emit('error', { message: 'Комната заполнена' });
            return;
        }
        
        if (room.gameState.phase !== 'waiting') {
            socket.emit('error', { message: 'Игра уже началась' });
            return;
        }

        const newPlayer = {
            id: room.players.length,
            socketId: socket.id,
            name: playerName,
            isHost: false,
            characteristics: null,
            actionCard: null,
            actionCardUsed: false,
            revealedCharacteristics: [],
            eliminated: false,
            votesAgainst: 0,
            revealedThisRound: 0
        };

        room.players.push(newPlayer);
        socket.join(roomCode);
        
        socket.emit('roomJoined', {
            roomCode,
            playerId: newPlayer.id,
            isHost: false
        });
        
        io.to(roomCode).emit('roomUpdate', {
            players: room.players,
            maxPlayers: room.maxPlayers
        });

        console.log(`Игрок ${playerName} присоединился к комнате ${roomCode}`);
    });

    // Изменение максимального количества игроков
    socket.on('updateMaxPlayers', (data) => {
        const { roomCode, maxPlayers } = data;
        const room = rooms.get(roomCode);
        
        if (!room) return;
        
        const player = room.players.find(p => p.socketId === socket.id);
        if (!player || !player.isHost) return;
        
        room.maxPlayers = maxPlayers;
        io.to(roomCode).emit('roomUpdate', {
            players: room.players,
            maxPlayers: room.maxPlayers
        });
    });

    // Начало игры
    socket.on('startGame', (data) => {
        const { roomCode } = data;
        const room = rooms.get(roomCode);
        
        if (!room) return;
        
        const player = room.players.find(p => p.socketId === socket.id);
        if (!player || !player.isHost) return;
        
        if (room.players.length < 4) {
            socket.emit('error', { message: 'Для начала игры нужно минимум 4 игрока' });
            return;
        }

        // Генерируем характеристики и карты действий для всех игроков
        const shuffledActionCards = [...actionCards].sort(() => Math.random() - 0.5);
        
        room.players.forEach((player, index) => {
            player.characteristics = generateCharacter();
            // 70% шанс получить карту действия
            if (Math.random() < 0.7) {
                player.actionCard = shuffledActionCards[index % shuffledActionCards.length];
            }
            player.revealedThisRound = 0;
        });

        room.gameState.phase = 'playing';
        room.gameState.currentRound = 1;
        room.gameState.currentTurnPlayerId = 0;
        
        io.to(roomCode).emit('gameStarted', {
            gameState: room.gameState
        });
        
        // Отправляем каждому игроку его личные данные
        room.players.forEach(player => {
            io.to(player.socketId).emit('playerData', {
                characteristics: player.characteristics,
                actionCard: player.actionCard
            });
        });
        
        startPlayerTurn(roomCode);
        console.log(`Игра началась в комнате ${roomCode}`);
    });

    // Раскрытие характеристики
    socket.on('revealCharacteristic', (data) => {
        const { roomCode, characteristic } = data;
        const room = rooms.get(roomCode);
        
        if (!room) return;
        
        const player = room.players.find(p => p.socketId === socket.id);
        if (!player || player.eliminated) return;
        
        if (room.gameState.phase !== 'playing') return;
        if (room.gameState.currentTurnPlayerId !== player.id) return;
        if (player.revealedThisRound >= 2) return;
        
        // Проверка правил первого раунда
        if (room.gameState.currentRound === 1 && player.revealedThisRound === 0 && characteristic !== 'Профессия') {
            return;
        }
        
        if (!player.revealedCharacteristics.includes(characteristic)) {
            player.revealedCharacteristics.push(characteristic);
            player.revealedThisRound++;
            
            io.to(roomCode).emit('characteristicRevealed', {
                playerId: player.id,
                characteristic,
                value: player.characteristics[characteristic],
                revealedThisRound: player.revealedThisRound
            });
            
            // Если игрок открыл 2 карты, переходим к следующему
            if (player.revealedThisRound >= 2) {
                clearTimeout(room.gameState.timer);
                setTimeout(() => {
                    room.gameState.currentTurnPlayerId = getNextPlayerId(room);
                    startPlayerTurn(roomCode);
                }, 1000);
            }
        }
    });

    // Голосование за пропуск фазы
    socket.on('voteToSkip', (data) => {
        const { roomCode, phase } = data;
        const room = rooms.get(roomCode);
        
        if (!room) return;
        
        const player = room.players.find(p => p.socketId === socket.id);
        if (!player || player.eliminated) return;
        
        room.gameState.skipVotes++;
        const alivePlayers = room.players.filter(p => !p.eliminated);
        const requiredVotes = Math.ceil(alivePlayers.length / 2);
        
        if (room.gameState.skipVotes >= requiredVotes) {
            clearTimeout(room.gameState.timer);
            
            if (phase === 'discussion') {
                startVoting(roomCode);
            } else if (phase === 'voting') {
                room.gameState.playersToEliminateNextRound *= 2;
                nextRound(roomCode);
            }
        } else {
            io.to(roomCode).emit('skipVoteUpdate', {
                skipVotes: room.gameState.skipVotes,
                requiredVotes
            });
        }
    });

    // Голосование за игрока
    socket.on('voteForPlayer', (data) => {
        const { roomCode, targetId } = data;
        const room = rooms.get(roomCode);
        
        if (!room) return;
        if (room.gameState.phase !== 'voting') return;
        
        const player = room.players.find(p => p.socketId === socket.id);
        if (!player || player.eliminated) return;
        if (room.gameState.playersWhoVoted.includes(player.id)) return;
        
        room.gameState.votingResults[player.id] = targetId;
        room.gameState.playersWhoVoted.push(player.id);
        
        io.to(roomCode).emit('voteUpdate', {
            voterId: player.id,
            targetId,
            playersWhoVoted: room.gameState.playersWhoVoted
        });
        
        // Проверяем, проголосовали ли все
        const alivePlayers = room.players.filter(p => !p.eliminated);
        if (room.gameState.playersWhoVoted.length >= alivePlayers.length) {
            clearTimeout(room.gameState.timer);
            endVoting(roomCode);
        }
    });

    // Использование карты действия
    socket.on('useActionCard', (data) => {
        const { roomCode, targetId, additionalData } = data;
        const room = rooms.get(roomCode);
        
        if (!room) return;
        
        const player = room.players.find(p => p.socketId === socket.id);
        if (!player || player.eliminated || !player.actionCard || player.actionCardUsed) return;
        
        handleActionCard(roomCode, player, targetId, additionalData);
    });

    // Отключение игрока
    socket.on('disconnect', () => {
        console.log('Игрок отключился:', socket.id);
        
        // Находим комнату игрока и удаляем его
        for (const [roomCode, room] of rooms.entries()) {
            const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
            if (playerIndex !== -1) {
                const player = room.players[playerIndex];
                room.players.splice(playerIndex, 1);
                
                if (room.players.length === 0) {
                    // Удаляем пустую комнату
                    rooms.delete(roomCode);
                    console.log(`Комната ${roomCode} удалена (пустая)`);
                } else {
                    // Назначаем нового хоста если текущий отключился
                    if (player.isHost && room.players.length > 0) {
                        room.players[0].isHost = true;
                    }
                    
                    io.to(roomCode).emit('playerDisconnected', {
                        playerId: player.id,
                        playerName: player.name
                    });
                    
                    io.to(roomCode).emit('roomUpdate', {
                        players: room.players,
                        maxPlayers: room.maxPlayers
                    });
                }
                break;
            }
        }
    });
});

// Вспомогательные функции для игровой логики
function startPlayerTurn(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;
    
    const alivePlayers = room.players.filter(p => !p.eliminated);
    const currentPlayer = room.players.find(p => p.id === room.gameState.currentTurnPlayerId);
    
    if (!currentPlayer || currentPlayer.eliminated || currentPlayer.revealedThisRound >= 2) {
        // Переходим к следующему игроку или к обсуждению
        const allRevealed = alivePlayers.every(p => p.revealedThisRound >= 2);
        if (allRevealed) {
            startDiscussion(roomCode);
            return;
        }
        
        room.gameState.currentTurnPlayerId = getNextPlayerId(room);
        startPlayerTurn(roomCode);
        return;
    }
    
    // Запускаем таймер на 60 секунд
    startTimer(roomCode, 60, 'playing');
    
    io.to(roomCode).emit('playerTurnStarted', {
        currentTurnPlayerId: room.gameState.currentTurnPlayerId,
        playerName: currentPlayer.name,
        timeLeft: 60
    });
}

function startDiscussion(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;
    
    room.gameState.phase = 'discussion';
    room.gameState.skipVotes = 0;
    
    // Сброс счетчика раскрытий
    room.players.forEach(p => p.revealedThisRound = 0);
    
    startTimer(roomCode, 300, 'discussion'); // 5 минут
    
    io.to(roomCode).emit('discussionStarted', {
        timeLeft: 300
    });
}

function startVoting(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;
    
    room.gameState.phase = 'voting';
    room.gameState.playersWhoVoted = [];
    room.gameState.votingResults = {};
    room.gameState.skipVotes = 0;
    
    startTimer(roomCode, 60, 'voting'); // 1 минута
    
    io.to(roomCode).emit('votingStarted', {
        timeLeft: 60
    });
}

function endVoting(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;
    
    // Подсчитываем голоса
    const voteCount = {};
    for (const targetId of Object.values(room.gameState.votingResults)) {
        voteCount[targetId] = (voteCount[targetId] || 0) + 1;
    }
    
    // Находим игроков с наибольшим количеством голосов
    const maxVotes = Math.max(...Object.values(voteCount));
    const playersToEliminate = Object.keys(voteCount)
        .filter(id => voteCount[id] === maxVotes)
        .map(id => parseInt(id))
        .slice(0, room.gameState.playersToEliminateNextRound);
    
    // Исключаем игроков
    playersToEliminate.forEach(playerId => {
        const player = room.players.find(p => p.id === playerId);
        if (player) {
            player.eliminated = true;
        }
    });
    
    io.to(roomCode).emit('playersEliminated', {
        eliminatedPlayers: playersToEliminate
    });
    
    room.gameState.playersToEliminateNextRound = 1;
    
    setTimeout(() => {
        nextRound(roomCode);
    }, 3000);
}

function nextRound(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;
    
    room.gameState.currentRound++;
    room.gameState.phase = 'playing';
    room.gameState.currentTurnPlayerId = getNextPlayerId(room);
    
    // Сброс статистики
    room.gameState.votingResults = {};
    room.gameState.playersWhoVoted = [];
    room.players.forEach(p => {
        p.votesAgainst = 0;
        p.revealedThisRound = 0;
    });
    
    const alivePlayers = room.players.filter(p => !p.eliminated);
    if (alivePlayers.length <= 2 || room.gameState.currentRound > 3) {
        endGame(roomCode);
    } else {
        io.to(roomCode).emit('roundStarted', {
            currentRound: room.gameState.currentRound
        });
        startPlayerTurn(roomCode);
    }
}

function endGame(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;
    
    clearTimeout(room.gameState.timer);
    const alivePlayers = room.players.filter(p => !p.eliminated);
    
    io.to(roomCode).emit('gameEnded', {
        survivors: alivePlayers.map(p => ({ id: p.id, name: p.name }))
    });
    
    // Удаляем комнату через 30 секунд
    setTimeout(() => {
        rooms.delete(roomCode);
        console.log(`Комната ${roomCode} удалена после окончания игры`);
    }, 30000);
}

function getNextPlayerId(room) {
    const alivePlayers = room.players.filter(p => !p.eliminated);
    const currentIndex = alivePlayers.findIndex(p => p.id === room.gameState.currentTurnPlayerId);
    const nextIndex = (currentIndex + 1) % alivePlayers.length;
    return alivePlayers[nextIndex].id;
}

function startTimer(roomCode, seconds, phase) {
    const room = rooms.get(roomCode);
    if (!room) return;
    
    clearTimeout(room.gameState.timer);
    room.gameState.timeLeft = seconds;
    
    const timerInterval = setInterval(() => {
        room.gameState.timeLeft--;
        
        io.to(roomCode).emit('timerUpdate', {
            timeLeft: room.gameState.timeLeft,
            phase
        });
        
        if (room.gameState.timeLeft <= 0) {
            clearInterval(timerInterval);
            handleTimerEnd(roomCode, phase);
        }
    }, 1000);
    
    room.gameState.timer = timerInterval;
}

function handleTimerEnd(roomCode, phase) {
    const room = rooms.get(roomCode);
    if (!room) return;
    
    switch (phase) {
        case 'playing':
            room.gameState.currentTurnPlayerId = getNextPlayerId(room);
            startPlayerTurn(roomCode);
            break;
        case 'discussion':
            startVoting(roomCode);
            break;
        case 'voting':
            endVoting(roomCode);
            break;
    }
}

function handleActionCard(roomCode, player, targetId, additionalData) {
    const room = rooms.get(roomCode);
    if (!room) return;
    
    player.actionCardUsed = true;
    
    const target = targetId ? room.players.find(p => p.id === targetId) : null;
    
    switch (player.actionCard.effect) {
        case 'double_vote':
            // Обрабатывается во время голосования
            break;
        case 'age_player':
            if (target) {
                // Добавляем 20 лет к возрасту
                const currentBio = target.characteristics['Биология'];
                const match = currentBio.match(/(Мужчина|Женщина), (\d+) лет/);
                if (match) {
                    const newAge = parseInt(match[2]) + 20;
                    target.characteristics['Биология'] = `${match[1]}, ${newAge} лет`;
                }
            }
            break;
        case 'health_change':
            if (targetId === player.id) {
                // Лечим себя
                player.characteristics['Здоровье'] = 'Здоров';
            } else if (target) {
                // Ухудшаем здоровье другого
                const badConditions = ['Карликовость', 'Аутизм', 'Слепота', 'Глухота', 'Паралич'];
                target.characteristics['Здоровье'] = badConditions[Math.floor(Math.random() * badConditions.length)];
            }
            break;
        // Добавить другие эффекты карт...
    }
    
    io.to(roomCode).emit('actionCardUsed', {
        playerId: player.id,
        cardName: player.actionCard.name,
        targetId,
        effect: player.actionCard.effect
    });
}

// Роуты
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`🌐 Локальный адрес: http://localhost:${PORT}`);
});