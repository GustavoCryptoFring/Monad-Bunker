// Подключение к Socket.IO (автоматически определит адрес)
const socket = io();

let gameState = {
    players: [],
    currentRound: 1,
    gamePhase: 'login',
    votingResults: {},
    maxRounds: 3,
    currentPlayerName: '',
    currentPlayerId: null,
    roomCode: '',
    maxPlayers: 8,
    isRoomHost: false,
    currentTurnPlayerId: null,
    timeLeft: 0,
    playersWhoVoted: [],
    skipVotes: 0,
    myCharacteristics: null,
    myActionCard: null
};

// Обработчики событий от сервера
socket.on('connect', () => {
    console.log('✅ Подключено к серверу');
});

socket.on('connect_error', (error) => {
    console.error('❌ Ошибка подключения:', error);
    alert('Ошибка подключения к серверу. Попробуйте обновить страницу.');
});

socket.on('roomCreated', (data) => {
    gameState.roomCode = data.roomCode;
    gameState.currentPlayerId = data.playerId;
    gameState.isRoomHost = data.isHost;
    gameState.gamePhase = 'room-setup';
    
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('roomSetup').style.display = 'block';
    
    updateRoomDisplay();
    
    alert(`🎉 Комната создана!\nКод: ${data.roomCode}`);
});

socket.on('roomJoined', (data) => {
    gameState.roomCode = data.roomCode;
    gameState.currentPlayerId = data.playerId;
    gameState.isRoomHost = data.isHost;
    gameState.gamePhase = 'room-setup';
    
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('roomSetup').style.display = 'block';
    
    updateRoomDisplay();
});

socket.on('roomUpdate', (data) => {
    gameState.players = data.players;
    gameState.maxPlayers = data.maxPlayers;
    updateRoomDisplay();
});

socket.on('gameStarted', (data) => {
    gameState.gamePhase = 'playing';
    gameState.currentRound = data.gameState.currentRound;
    
    document.getElementById('roomSetup').style.display = 'none';
    document.getElementById('gameBoard').style.display = 'block';
    
    updateRoundInfo();
    updatePlayersDisplay();
});

socket.on('playerData', (data) => {
    gameState.myCharacteristics = data.characteristics;
    gameState.myActionCard = data.actionCard;
    updatePlayersDisplay();
});

socket.on('error', (data) => {
    alert(`❌ Ошибка: ${data.message}`);
});

// Функции интерфейса
function createRoom() {
    const playerName = document.getElementById('playerName').value.trim();
    if (!playerName) {
        alert('Пожалуйста, введите ваше имя!');
        return;
    }
    gameState.currentPlayerName = playerName;
    socket.emit('createRoom', { playerName });
}

function joinRoom() {
    const playerName = document.getElementById('playerName').value.trim();
    const roomCode = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    
    if (!playerName) {
        alert('Пожалуйста, введите ваше имя!');
        return;
    }
    
    if (!roomCode) {
        alert('Пожалуйста, введите код комнаты!');
        return;
    }

    gameState.currentPlayerName = playerName;
    socket.emit('joinRoom', { roomCode, playerName });
}

// Остальные функции из вашего script.js...
function updateRoomDisplay() {
    document.getElementById('roomCode').textContent = gameState.roomCode;
    document.getElementById('currentPlayersCount').textContent = gameState.players.length;
    document.getElementById('maxPlayersCount').textContent = gameState.maxPlayers;
    
    const playersList = document.getElementById('playersList');
    playersList.innerHTML = gameState.players.map(player => 
        `<li class="${player.isHost ? 'host' : ''}">${player.name} ${player.isHost ? '(Хост)' : ''}</li>`
    ).join('');
    
    const startBtn = document.getElementById('startGameBtn');
    const canStart = gameState.isRoomHost && gameState.players.length >= 4;
    startBtn.disabled = !canStart;
    startBtn.textContent = gameState.players.length < 4 ? 
        `Начать игру (минимум 4 игрока)` : 
        `Начать игру (${gameState.players.length}/${gameState.maxPlayers})`;
}

function copyRoomCode() {
    navigator.clipboard.writeText(gameState.roomCode).then(() => {
        alert('Код комнаты скопирован в буфер обмена!');
    }).catch(() => {
        const textArea = document.createElement('textarea');
        textArea.value = gameState.roomCode;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Код комнаты скопирован!');
    });
}

// Глобальные функции для совместимости
window.createRoom = createRoom;
window.joinRoom = joinRoom;
window.copyRoomCode = copyRoomCode;

// Добавьте остальные функции из вашего script.js...