const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

console.log('🚀 Starting Bunker Game Server...');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Статические файлы
app.use(express.static(__dirname));

// Только главная страница
app.get('/', (req, res) => {
    console.log('📄 Serving main page');
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        rooms: rooms.size,
        connections: io.engine.clientsCount
    });
});

// Хранилище комнат
const rooms = new Map();

// Socket.IO логика
io.on('connection', (socket) => {
    console.log('✅ User connected:', socket.id);
    
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
            
            console.log('✅ Room created:', roomCode);
            
            // Отправляем данные комнаты БЕЗ перенаправления
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
        console.log('🚪 Join room request:', data);
        
        const room = rooms.get(data.roomCode);
        
        if (!room) {
            socket.emit('error', 'Комната не найдена');
            return;
        }
        
        if (room.players.length >= room.maxPlayers) {
            socket.emit('error', 'Комната заполнена');
            return;
        }
        
        // Проверяем дубликаты имен
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
        
        console.log('✅ Player joined:', data.playerName, 'to room:', data.roomCode);
        
        io.to(data.roomCode).emit('player-joined', {
            players: room.players,
            newPlayer: data.playerName
        });
        
        socket.emit('room-joined', {
            roomCode: data.roomCode,
            players: room.players,
            isHost: false
        });
    });
    
    socket.on('start-game', (data) => {
        console.log('🎮 Starting game in room:', data.roomCode);
        
        const room = rooms.get(data.roomCode);
        if (room && room.host === socket.id) {
            room.gameState = 'playing';
            
            // Отправляем всем игрокам в комнате сигнал начала игры
            io.to(data.roomCode).emit('game-started', {
                players: room.players,
                gameState: room.gameState
            });
        }
    });
    
    socket.on('disconnect', () => {
        console.log('❌ User disconnected:', socket.id);
        
        for (const [roomCode, room] of rooms.entries()) {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            
            if (playerIndex !== -1) {
                const playerName = room.players[playerIndex].name;
                const wasHost = room.players[playerIndex].isHost;
                
                room.players.splice(playerIndex, 1);
                
                if (room.players.length === 0) {
                    rooms.delete(roomCode);
                    console.log('🗑️ Empty room deleted:', roomCode);
                } else {
                    if (wasHost && room.players.length > 0) {
                        room.players[0].isHost = true;
                        room.host = room.players[0].id;
                    }
                    
                    io.to(roomCode).emit('player-left', {
                        players: room.players,
                        leftPlayer: playerName
                    });
                }
                break;
            }
        }
    });
});

function generateRoomCode() {
    let code;
    do {
        code = Math.random().toString(36).substring(2, 8).toUpperCase();
    } while (rooms.has(code));
    return code;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Server running on port ${PORT}`);
});