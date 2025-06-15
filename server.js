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

// Главная страница - выбор имени и создание/вход в комнату
app.get('/', (req, res) => {
    console.log('📄 Serving main page');
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Страница конкретной комнаты по коду
app.get('/:roomCode', (req, res) => {
    const roomCode = req.params.roomCode.toUpperCase();
    
    // Проверяем, что код комнаты состоит из 6 символов
    if (!/^[A-Z0-9]{6}$/.test(roomCode)) {
        return res.redirect('/');
    }
    
    console.log('🎮 Serving room page for:', roomCode);
    
    // Проверяем, существует ли комната
    if (!rooms.has(roomCode)) {
        return res.send(`
            <!DOCTYPE html>
            <html lang="ru">
            <head>
                <meta charset="UTF-8">
                <title>Комната не найдена</title>
                <link rel="stylesheet" href="/style.css">
            </head>
            <body>
                <div class="game-container">
                    <div class="error-screen">
                        <h1>❌ Комната ${roomCode} не найдена</h1>
                        <p>Возможно, комната была удалена или код неверный</p>
                        <button onclick="window.location.href='/'" class="room-btn">
                            Вернуться на главную
                        </button>
                    </div>
                </div>
            </body>
            </html>
        `);
    }
    
    // Отправляем игровую страницу с предустановленным кодом комнаты
    res.send(`
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>🎭 Комната ${roomCode}</title>
            <link rel="stylesheet" href="/style.css">
        </head>
        <body>
            <div class="game-container">
                <header class="game-header">
                    <h1>🎭 КОМНАТА ${roomCode}</h1>
                    <p>Добро пожаловать в игру "Бункер"!</p>
                </header>

                <!-- Экран входа в существующую комнату -->
                <div class="login-screen" id="loginScreen">
                    <h2>Присоединение к комнате ${roomCode}</h2>
                    <div class="login-form">
                        <label>Ваше имя: 
                            <input type="text" id="playerName" placeholder="Введите ваше имя" maxlength="20">
                        </label>
                        <button id="joinRoomBtn" class="room-btn" onclick="joinExistingRoom('${roomCode}')">
                            Войти в комнату
                        </button>
                        <button onclick="window.location.href='/'" class="room-btn secondary">
                            Вернуться на главную
                        </button>
                    </div>
                </div>

                <!-- Остальная разметка как в обычном index.html -->
                <div class="room-setup" id="roomSetup" style="display: none;">
                    <h2>Комната ${roomCode}</h2>
                    <div class="room-info">
                        <p>Код комнаты: <span id="roomCode" class="room-code">${roomCode}</span></p>
                        <button id="copyCodeBtn" class="copy-btn" onclick="copyRoomCode()">Копировать ссылку</button>
                    </div>
                    <div class="players-waiting" id="playersWaiting">
                        <h3>Игроки в комнате (<span id="currentPlayersCount">0</span>/<span id="maxPlayersCount">8</span>):</h3>
                        <ul id="playersList"></ul>
                    </div>
                    <button id="startGameBtn" class="start-game-btn" onclick="startGame()" disabled>Начать игру</button>
                </div>

                <div class="game-board" id="gameBoard" style="display: none;">
                    <div class="game-info">
                        <div class="round-info">
                            <h2>РАУНД <span id="currentRound">1</span></h2>
                            <p id="gameStatus">Ожидание начала игры...</p>
                        </div>
                        <div class="timer-info">
                            <div class="phase-display" id="phaseDisplay">Подготовка</div>
                            <div class="timer-display" id="timerDisplay">0:00</div>
                        </div>
                    </div>
                    <div class="players-grid" id="playersGrid"></div>
                </div>
            </div>

            <script src="/socket.io/socket.io.js"></script>
            <script>
                // Предустановленный код комнаты
                window.ROOM_CODE = '${roomCode}';
            </script>
            <script src="/client.js"></script>
        </body>
        </html>
    `);
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
            
            // Отправляем URL для перенаправления
            socket.emit('room-created', {
                roomCode: roomCode,
                roomUrl: `/${roomCode}`,
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