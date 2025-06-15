const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

console.log('🚀 Starting Bunker Game Server...');
console.log('Node version:', process.version);
console.log('Environment:', process.env.NODE_ENV || 'development');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware для статических файлов
app.use(express.static(path.join(__dirname), {
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

console.log('📁 Static files configured from:', __dirname);

// Основные маршруты
app.get('/', (req, res) => {
    console.log('📄 Serving index.html to:', req.ip);
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check для Railway
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        rooms: rooms.size,
        connections: io.engine.clientsCount
    });
});

// API информация
app.get('/api/status', (req, res) => {
    res.json({
        server: 'Bunker Game',
        version: '1.0.0',
        rooms: rooms.size,
        connections: io.engine.clientsCount
    });
});

// Хранилище комнат
const rooms = new Map();

// Socket.IO обработчики
io.on('connection', (socket) => {
    console.log('✅ New player connected:', socket.id);
    
    socket.on('create-room', (data) => {
        console.log('🎯 Creating room for:', data.playerName);
        
        try {
            const roomCode = generateRoomCode();
            const room = {
                code: roomCode,
                host: socket.id,
                players: [{
                    id: socket.id,
                    name: data.playerName,
                    isHost: true,
                    joinedAt: new Date()
                }],
                gameState: 'waiting',
                maxPlayers: 8,
                createdAt: new Date()
            };
            
            rooms.set(roomCode, room);
            socket.join(roomCode);
            
            console.log('✅ Room created:', roomCode, 'by', data.playerName);
            console.log('📊 Total rooms:', rooms.size);
            
            socket.emit('room-created', {
                roomCode: roomCode,
                players: room.players,
                isHost: true
            });
            
        } catch (error) {
            console.error('❌ Error creating room:', error);
            socket.emit('error', 'Не удалось создать комнату');
        }
    });
    
    socket.on('join-room', (data) => {
        console.log('🚪 Player joining room:', data.playerName, 'to', data.roomCode);
        
        try {
            const room = rooms.get(data.roomCode);
            
            if (!room) {
                console.log('❌ Room not found:', data.roomCode);
                socket.emit('error', 'Комната не найдена');
                return;
            }
            
            if (room.players.length >= room.maxPlayers) {
                console.log('❌ Room full:', data.roomCode);
                socket.emit('error', 'Комната заполнена');
                return;
            }
            
            // Проверяем, не присоединился ли игрок уже
            const existingPlayer = room.players.find(p => p.name === data.playerName);
            if (existingPlayer) {
                socket.emit('error', 'Игрок с таким именем уже в комнате');
                return;
            }
            
            room.players.push({
                id: socket.id,
                name: data.playerName,
                isHost: false,
                joinedAt: new Date()
            });
            
            socket.join(data.roomCode);
            
            console.log('✅ Player joined:', data.playerName, 'room:', data.roomCode);
            
            // Уведомляем всех в комнате
            io.to(data.roomCode).emit('player-joined', {
                players: room.players,
                newPlayer: data.playerName
            });
            
            // Подтверждаем подключение игроку
            socket.emit('room-joined', {
                roomCode: data.roomCode,
                players: room.players,
                isHost: false
            });
            
        } catch (error) {
            console.error('❌ Error joining room:', error);
            socket.emit('error', 'Не удалось подключиться к комнате');
        }
    });
    
    socket.on('start-game', (data) => {
        console.log('🎮 Starting game in room:', data.roomCode);
        // Логика начала игры
        const room = rooms.get(data.roomCode);
        if (room && room.host === socket.id) {
            room.gameState = 'playing';
            io.to(data.roomCode).emit('game-started', {
                players: room.players
            });
        }
    });
    
    socket.on('disconnect', () => {
        console.log('❌ Player disconnected:', socket.id);
        
        // Удаляем игрока из всех комнат
        for (const [roomCode, room] of rooms.entries()) {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            
            if (playerIndex !== -1) {
                const playerName = room.players[playerIndex].name;
                const wasHost = room.players[playerIndex].isHost;
                
                room.players.splice(playerIndex, 1);
                
                console.log('🚪 Player left room:', playerName, 'from', roomCode);
                
                if (room.players.length === 0) {
                    // Удаляем пустую комнату
                    rooms.delete(roomCode);
                    console.log('🗑️ Empty room deleted:', roomCode);
                } else {
                    // Назначаем нового хоста если нужно
                    if (wasHost && room.players.length > 0) {
                        room.players[0].isHost = true;
                        room.host = room.players[0].id;
                        console.log('👑 New host assigned:', room.players[0].name);
                    }
                    
                    // Уведомляем остальных игроков
                    io.to(roomCode).emit('player-left', {
                        players: room.players,
                        leftPlayer: playerName
                    });
                }
                break;
            }
        }
    });
    
    socket.on('error', (error) => {
        console.error('🔥 Socket error from', socket.id, ':', error);
    });
});

// Функция генерации кода комнаты
function generateRoomCode() {
    let code;
    do {
        code = Math.random().toString(36).substring(2, 8).toUpperCase();
    } while (rooms.has(code));
    return code;
}

// Очистка старых комнат каждые 30 минут
setInterval(() => {
    const now = new Date();
    const thirtyMinutesAgo = new Date(now - 30 * 60 * 1000);
    
    for (const [roomCode, room] of rooms.entries()) {
        if (room.createdAt < thirtyMinutesAgo && room.players.length === 0) {
            rooms.delete(roomCode);
            console.log('🧹 Cleaned up old room:', roomCode);
        }
    }
}, 30 * 60 * 1000);

// Запуск сервера
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
    console.log(`🌐 Bunker Game Server running on ${HOST}:${PORT}`);
    console.log(`🔗 Local: http://localhost:${PORT}`);
    console.log(`📡 Network: http://${HOST}:${PORT}`);
});

// Обработка ошибок
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        process.exit(1);
    } else {
        console.error('❌ Server error:', error);
    }
});

process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    console.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise);
    console.error('Reason:', reason);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('📴 Received SIGTERM, shutting down gracefully');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

console.log('✅ Server initialization complete');