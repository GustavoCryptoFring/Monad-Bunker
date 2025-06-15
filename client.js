// Определяем URL для Socket.IO
const socketUrl = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000' 
    : `https://${window.location.hostname}`;

// Подключение к Socket.IO через API endpoint
const socket = io({
    path: '/api/socket.js',
    transports: ['websocket', 'polling']
});

let gameState = {
    players: [],
    currentPlayerId: null,
    roomCode: '',
    isRoomHost: false,
    gamePhase: 'login'
};

socket.on('connect', () => {
    console.log('Подключено!');
});

socket.on('roomCreated', (data) => {
    gameState.roomCode = data.roomCode;
    gameState.currentPlayerId = data.playerId;
    gameState.isRoomHost = data.isHost;
    alert(`Комната создана! Код: ${data.roomCode}`);
    
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('roomSetup').style.display = 'block';
    document.getElementById('roomCode').textContent = data.roomCode;
});

socket.on('error', (data) => {
    alert(`Ошибка: ${data.message}`);
});

function createRoom() {
    const playerName = document.getElementById('playerName').value.trim();
    if (!playerName) {
        alert('Введите имя!');
        return;
    }
    socket.emit('createRoom', { playerName });
}

function joinRoom() {
    const playerName = document.getElementById('playerName').value.trim();
    const roomCode = document.getElementById('roomCodeInput').value.trim();
    
    if (!playerName || !roomCode) {
        alert('Введите имя и код комнаты!');
        return;
    }
    
    socket.emit('joinRoom', { playerName, roomCode });
}

// Остальные функции...
window.createRoom = createRoom;
window.joinRoom = joinRoom;