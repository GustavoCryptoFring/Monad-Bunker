const { Server } = require('socket.io');

// Хранилище игровых комнат
const rooms = new Map();

// Функции генерации (перенесите из server.js)
function generateRoomCode() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
}

function generateCharacter() {
    // Ваш код генерации характеристик
    const professions = ['Врач', 'Инженер', 'Учитель', 'Строитель'];
    const healthConditions = ['Здоров', 'Астма', 'Диабет', 'Гипертония'];
    const hobbies = ['Чтение', 'Рисование', 'Музыка', 'Спорт'];
    const phobias = ['Арахнофобия (пауки)', 'Клаустрофобия'];
    const luggage = ['Рюкзак с инструментами', 'Медицинская аптечка'];
    const facts = ['Знает несколько языков', 'Имеет водительские права'];
    
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
        'Факт 1': shuffledFacts[0] || 'Умеет готовить',
        'Факт 2': shuffledFacts[1] || 'Знает психологию',
        'Биология': biology
    };
}

let io;

export default function handler(req, res) {
    if (!res.socket.server.io) {
        console.log('Инициализация Socket.IO сервера...');
        
        io = new Server(res.socket.server, {
            path: '/api/socket.js',
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        
        res.socket.server.io = io;
        
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
            
            // Добавьте остальные обработчики событий...
            
            socket.on('disconnect', () => {
                console.log('Игрок отключился:', socket.id);
            });
        });
    }
    
    res.end();
}