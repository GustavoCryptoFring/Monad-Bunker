const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

console.log('🚀 Starting server...');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Статические файлы
app.use(express.static(path.join(__dirname)));
console.log('📁 Static files configured');

// Главная страница
app.get('/', (req, res) => {
    console.log('📄 Serving index.html');
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Socket.IO логика
const rooms = new Map();

io.on('connection', (socket) => {
    console.log('✅ User connected:', socket.id);
    
    socket.on('create-room', (data) => {
        console.log('🎯 Create room request:', data);
        
        try {
            const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            const room = {
                code: roomCode,
                host: socket.id,
                players: [{
                    id: socket.id,
                    name: data.playerName,
                    isHost: true
                }],
                gameState: 'waiting',
                maxPlayers: 8
            };
            
            rooms.set(roomCode, room);
            socket.join(roomCode);
            
            console.log('✅ Room created successfully:', roomCode);
            
            socket.emit('room-created', {
                roomCode: roomCode,
                players: room.players,
                isHost: true
            });
            
        } catch (error) {
            console.error('❌ Error creating room:', error);
            socket.emit('error', 'Ошибка создания комнаты');
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
        
        room.players.push({
            id: socket.id,
            name: data.playerName,
            isHost: false
        });
        
        socket.join(data.roomCode);
        
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
    
    socket.on('disconnect', () => {
        console.log('❌ User disconnected:', socket.id);
        
        for (const [roomCode, room] of rooms.entries()) {
            const playerIndex = room.players.findIndex(p => p.id === socket.id);
            if (playerIndex !== -1) {
                room.players.splice(playerIndex, 1);
                
                if (room.players.length === 0) {
                    rooms.delete(roomCode);
                } else {
                    io.to(roomCode).emit('player-left', {
                        players: room.players
                    });
                }
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Server running on port ${PORT}`);
});