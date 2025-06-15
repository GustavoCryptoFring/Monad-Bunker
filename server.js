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

// Хранилище комнат
const rooms = new Map();

// ГЛАВНАЯ СТРАНИЦА - только основной домен
app.get('/', (req, res) => {
    const host = req.get('host');
    console.log('📄 Request to:', host);
    
    // Проверяем, это основной домен или поддомен
    const subdomain = getSubdomain(host);
    
    if (subdomain && subdomain !== 'www') {
        // Это поддомен комнаты
        const roomCode = subdomain.toUpperCase();
        console.log('🎮 Room subdomain detected:', roomCode);
        
        // Проверяем, существует ли комната
        if (rooms.has(roomCode)) {
            // Отправляем страницу комнаты
            res.send(generateRoomPage(roomCode));
        } else {
            // Комната не найдена
            res.send(generateNotFoundPage(roomCode));
        }
    } else {
        // Основной домен - главная страница
        console.log('🏠 Serving main page');
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});

// API маршруты
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        rooms: rooms.size,
        connections: io.engine.clientsCount
    });
});

app.get('/api/room/:roomCode', (req, res) => {
    const roomCode = req.params.roomCode.toUpperCase();
    const room = rooms.get(roomCode);
    
    if (room) {
        res.json({
            exists: true,
            players: room.players.length,
            maxPlayers: room.maxPlayers,
            gameState: room.gameState
        });
    } else {
        res.json({ exists: false });
    }
});

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
            
            // Создаем URL поддомена
            const host = socket.handshake.headers.host;
            const protocol = socket.handshake.headers['x-forwarded-proto'] || 'http';
            const baseHost = getBaseHost(host);
            const roomUrl = `${protocol}://${roomCode.toLowerCase()}.${baseHost}`;
            
            console.log('🌐 Room URL created:', roomUrl);
            
            socket.emit('room-created', {
                roomCode: roomCode,
                roomUrl: roomUrl,
                players: room.players,
                isHost: true,
                redirect: true
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
        
        if (data.fromMainPage) {
            // Если присоединение с главной страницы - перенаправляем на поддомен
            const host = socket.handshake.headers.host;
            const protocol = socket.handshake.headers['x-forwarded-proto'] || 'http';
            const baseHost = getBaseHost(host);
            const roomUrl = `${protocol}://${data.roomCode.toLowerCase()}.${baseHost}`;
            
            socket.emit('room-joined', {
                roomCode: data.roomCode,
                roomUrl: roomUrl,
                players: room.players,
                isHost: false,
                redirect: true
            });
        } else {
            // Если уже на поддомене - остаемся здесь
            socket.emit('room-joined', {
                roomCode: data.roomCode,
                players: room.players,
                isHost: false,
                redirect: false
            });
        }
    });
    
    socket.on('start-game', (data) => {
        console.log('🎮 Starting game in room:', data.roomCode);
        
        const room = rooms.get(data.roomCode);
        if (room && room.host === socket.id) {
            room.gameState = 'playing';
            
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

// Вспомогательные функции
function getSubdomain(host) {
    if (!host) return null;
    
    const parts = host.split('.');
    if (parts.length <= 2) return null;
    
    return parts[0];
}

function getBaseHost(host) {
    if (!host) return 'localhost:3000';
    
    const parts = host.split('.');
    if (parts.length <= 2) return host;
    
    return parts.slice(1).join('.');
}

function generateRoomCode() {
    let code;
    do {
        code = Math.random().toString(36).substring(2, 8).toUpperCase();
    } while (rooms.has(code));
    return code;
}

function generateRoomPage(roomCode) {
    const room = rooms.get(roomCode);
    
    return `
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

        <!-- Экран входа в комнату -->
        <div class="login-screen" id="loginScreen">
            <h2>Присоединение к комнате ${roomCode}</h2>
            <div class="login-form">
                <label>Ваше имя: 
                    <input type="text" id="playerName" placeholder="Введите ваше имя" maxlength="20">
                </label>
                <button id="joinRoomBtn" class="room-btn" onclick="joinRoomFromSubdomain('${roomCode}')">
                    Войти в комнату
                </button>
                <a href="/" class="room-btn secondary" style="display: inline-block; text-decoration: none; text-align: center; margin-top: 10px;">
                    Вернуться на главную
                </a>
            </div>
        </div>

        <!-- Экран настройки комнаты -->
        <div class="room-setup" id="roomSetup" style="display: none;">
            <h2>Комната ${roomCode}</h2>
            <div class="room-info">
                <p>Код комнаты: <span id="roomCode" class="room-code">${roomCode}</span></p>
                <button id="copyCodeBtn" class="copy-btn" onclick="copyRoomUrl()">Копировать ссылку</button>
            </div>
            <div class="room-settings" id="roomSettings" style="display: none;">
                <label>Количество игроков: 
                    <select id="maxPlayers" onchange="updateMaxPlayers()">
                        <option value="8">8 игроков</option>
                        <option value="6">6 игроков</option>
                        <option value="4">4 игрока</option>
                    </select>
                </label>
            </div>
            <div class="players-waiting" id="playersWaiting">
                <h3>Игроки в комнате (<span id="currentPlayersCount">0</span>/<span id="maxPlayersCount">8</span>):</h3>
                <ul id="playersList"></ul>
            </div>
            <button id="startGameBtn" class="start-game-btn" onclick="startGame()" disabled style="display: none;">Начать игру</button>
        </div>

        <!-- Игровой экран -->
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
            <div class="game-actions">
                <button id="skipPhaseBtn" onclick="voteToSkip()" class="action-btn">⏭️ Пропустить фазу</button>
                <button id="showActionCardsBtn" onclick="showActionCard()" class="action-btn">🃏 Карты действий</button>
            </div>
        </div>

        <!-- Модальные окна -->
        <div id="actionCardModal" class="modal" style="display: none;">
            <div class="modal-content">
                <span class="close" onclick="closeActionCardModal()">&times;</span>
                <h3>Ваши карты действий</h3>
                <div id="actionCardsList"></div>
            </div>
        </div>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        window.ROOM_CODE = '${roomCode}';
        window.IS_ROOM_PAGE = true;
    </script>
    <script src="/client.js"></script>
</body>
</html>`;
}

function generateNotFoundPage(roomCode) {
    return `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Комната не найдена</title>
    <link rel="stylesheet" href="/style.css">
</head>
<body>
    <div class="game-container">
        <div class="error-screen">
            <h1>❌ Комната ${roomCode} не найдена</h1>
            <p>Возможно, комната была удалена или код неверный</p>
            <a href="/" class="room-btn">Вернуться на главную</a>
        </div>
    </div>
</body>
</html>`;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Server running on port ${PORT}`);
});