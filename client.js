console.log('🎮 Bunker Game Client Loading...');

// Состояние игры
let gameState = {
    playerId: null,
    playerName: '',
    isHost: false,
    players: [],
    gamePhase: 'main',
    serverGameState: 'lobby',
    currentRound: 1,
    timeLeft: 0,
    votingResults: {},
    myVote: null,
    timer: null,
    maxPlayers: 8,
    currentTurnPlayer: null,
    currentJustifyingPlayer: null,
    canChangeVote: {},
    hasChangedVote: false,
    cardsRevealedThisRound: 0,
    requiredCardsThisRound: 1,
    skipDiscussionVotes: 0,
    mySkipVote: false,
    startRoundVotes: 0,
    myStartRoundVote: false,
    roomCode: null,
    roomLink: null
};

// Socket.IO подключение
const socket = io({
    transports: ['websocket', 'polling'],
    timeout: 10000,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000
});

// === ФУНКЦИИ УПРАВЛЕНИЯ КОМНАТАМИ ===

function createGame() {
    console.log('🆕 Creating new game');
    
    const nameInput = document.getElementById('playerNameInput');
    const playerName = nameInput.value.trim();
    
    if (!playerName) {
        showNotification('Ошибка', 'Введите ваше имя!');
        return;
    }
    
    if (playerName.length < 2 || playerName.length > 20) {
        showNotification('Ошибка', 'Имя должно быть от 2 до 20 символов!');
        return;
    }
    
    if (!socket.connected) {
        showNotification('Ошибка', 'Нет соединения с сервером. Попробуйте перезагрузить страницу.');
        return;
    }
    
    // Блокируем кнопку
    const createBtn = document.getElementById('createGameBtn');
    if (createBtn) {
        createBtn.disabled = true;
        createBtn.textContent = 'Создание игры...';
    }
    
    socket.emit('create-room', { playerName: playerName });
}

function joinGame() {
    console.log('🚪 Joining existing game');
    
    const nameInput = document.getElementById('playerNameInput');
    const roomCodeInput = document.getElementById('roomCodeInput');
    
    const playerName = nameInput.value.trim();
    const roomCode = roomCodeInput.value.trim().toUpperCase();
    
    if (!playerName) {
        showNotification('Ошибка', 'Введите ваше имя!');
        return;
    }
    
    if (playerName.length < 2 || playerName.length > 20) {
        showNotification('Ошибка', 'Имя должно быть от 2 до 20 символов!');
        return;
    }
    
    if (!roomCode || roomCode.length !== 6) {
        showNotification('Ошибка', 'Введите код комнаты (6 символов)!');
        return;
    }
    
    if (!socket.connected) {
        showNotification('Ошибка', 'Нет соединения с сервером. Попробуйте перезагрузить страницу.');
        return;
    }
    
    // Блокируем кнопку
    const joinBtn = document.getElementById('joinGameBtn');
    if (joinBtn) {
        joinBtn.disabled = true;
        joinBtn.textContent = 'Подключение...';
    }
    
    socket.emit('join-room', { 
        playerName: playerName,
        roomCode: roomCode 
    });
}

function leaveRoom() {
    console.log('🚪 Leaving room');
    
    if (confirm('Вы уверены, что хотите покинуть комнату?')) {
        socket.emit('leave-room');
        
        // Сбрасываем состояние
        gameState.roomCode = null;
        gameState.roomLink = null;
        gameState.players = [];
        gameState.isHost = false;
        
        // Возвращаемся на главный экран
        showMainScreen();
        
        // Обновляем URL
        window.history.pushState({}, '', '/');
    }
}

function copyRoomCode() {
    if (gameState.roomCode) {
        navigator.clipboard.writeText(gameState.roomCode).then(() => {
            showNotification('Скопировано', 'Код комнаты скопирован в буфер обмена!');
        }).catch(() => {
            // Fallback для старых браузеров
            const textArea = document.createElement('textarea');
            textArea.value = gameState.roomCode;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showNotification('Скопировано', 'Код комнаты скопирован!');
        });
    }
}

function copyRoomLink() {
    if (gameState.roomLink) {
        navigator.clipboard.writeText(gameState.roomLink).then(() => {
            showNotification('Скопировано', 'Ссылка на комнату скопирована в буфер обмена!');
        }).catch(() => {
            // Fallback для старых браузеров
            const textArea = document.createElement('textarea');
            textArea.value = gameState.roomLink;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showNotification('Скопировано', 'Ссылка скопирована!');
        });
    }
}

// === ОБРАБОТЧИКИ СОБЫТИЙ SOCKET.IO ===

socket.on('connect', function() {
    console.log('🌐 Connected to server');
    console.log('🔗 Socket ID:', socket.id);
    
    // Проверяем URL для автоматического присоединения к комнате
    const path = window.location.pathname;
    const roomCodeFromUrl = path.substring(1); // Убираем первый слеш
    
    if (roomCodeFromUrl && roomCodeFromUrl.length === 6) {
        // Если в URL есть код комнаты, показываем главный экран с предзаполненным кодом
        showMainScreen();
        const roomCodeInput = document.getElementById('roomCodeInput');
        if (roomCodeInput) {
            roomCodeInput.value = roomCodeFromUrl.toUpperCase();
        }
    } else {
        showMainScreen();
    }
    
    // Разблокируем кнопки если они заблокированы
    const createBtn = document.getElementById('createGameBtn');
    const joinBtn = document.getElementById('joinGameBtn');
    
    if (createBtn && createBtn.disabled) {
        createBtn.disabled = false;
        createBtn.textContent = '🆕 Создать новую игру';
    }
    
    if (joinBtn && joinBtn.disabled) {
        joinBtn.disabled = false;
        joinBtn.textContent = '🚪 Присоединиться';
    }
});

socket.on('connect_error', function(error) {
    console.error('❌ Connection error:', error);
    showNotification('Ошибка', 'Ошибка подключения к серверу. Проверьте интернет-соединение.');
});

socket.on('disconnect', function(reason) {
    console.log('❌ Disconnected from server:', reason);
    showNotification('Соединение потеряно', 'Попытка переподключения...');
});

socket.on('error', function(errorMessage) {
    console.error('❌ Server error:', errorMessage);
    
    // Разблокируем кнопки при ошибке
    const createBtn = document.getElementById('createGameBtn');
    const joinBtn = document.getElementById('joinGameBtn');
    
    if (createBtn) {
        createBtn.disabled = false;
        createBtn.textContent = '🆕 Создать новую игру';
    }
    
    if (joinBtn) {
        joinBtn.disabled = false;
        joinBtn.textContent = '🚪 Присоединиться';
    }
    
    showNotification('Ошибка', errorMessage);
});

// Обработчики событий комнат
socket.on('room-created', function(data) {
    console.log('✅ Room created:', data);
    
    gameState.playerId = data.playerId;
    gameState.playerName = data.playerName;
    gameState.isHost = true;
    gameState.roomCode = data.roomCode;
    gameState.roomLink = data.roomLink;
    gameState.maxPlayers = data.maxPlayers;
    gameState.players = data.players;
    gameState.gamePhase = 'lobby';
    
    // Обновляем URL
    window.history.pushState({}, '', `/${data.roomCode}`);
    
    showLobbyScreen();
});

socket.on('room-joined', function(data) {
    console.log('✅ Room joined:', data);
    
    gameState.playerId = data.playerId;
    gameState.playerName = data.playerName;
    gameState.isHost = data.isHost;
    gameState.roomCode = data.roomCode;
    gameState.roomLink = data.roomLink;
    gameState.maxPlayers = data.maxPlayers;
    gameState.players = data.players;
    gameState.gamePhase = 'lobby';
    
    // Обновляем URL если он отличается
    if (window.location.pathname !== `/${data.roomCode}`) {
        window.history.pushState({}, '', `/${data.roomCode}`);
    }
    
    showLobbyScreen();
});

socket.on('player-joined', function(data) {
    console.log('👋 Player joined:', data);
    gameState.players = data.players;
    gameState.maxPlayers = data.maxPlayers;
    gameState.startRoundVotes = data.startRoundVotes || 0;
    updateLobbyDisplay();
});

socket.on('player-left', function(data) {
    console.log('👋 Player left:', data);
    gameState.players = data.players;
    gameState.serverGameState = data.gameState;
    
    // Если мы стали хостом
    if (data.newHost === gameState.playerId) {
        gameState.isHost = true;
    }
    
    updateLobbyDisplay();
});

// Остальные обработчики остаются такими же, как в оригинале
// (game-started, phase-changed, characteristic-revealed, и т.д.)

// === ФУНКЦИИ ОТОБРАЖЕНИЯ ЭКРАНОВ ===

function showScreen(screenId) {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
        screen.style.display = 'none';
    });
    
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.style.display = 'block';
    }
}

function showMainScreen() {
    console.log('📱 Showing main screen');
    showScreen('mainScreen');
    
    const nameInput = document.getElementById('playerNameInput');
    if (nameInput) {
        nameInput.focus();
    }
}

function showLobbyScreen() {
    console.log('📱 Showing lobby screen');
    showScreen('lobbyScreen');
    updateLobbyDisplay();
}

function showGameScreen() {
    console.log('📱 Showing game screen');
    showScreen('gameScreen');
    updateGameDisplay();
}

function updateLobbyDisplay() {
    // Обновляем код комнаты
    const roomCodeDisplay = document.getElementById('roomCodeDisplay');
    const roomLinkDisplay = document.getElementById('roomLinkDisplay');
    
    if (roomCodeDisplay && gameState.roomCode) {
        roomCodeDisplay.textContent = gameState.roomCode;
    }
    
    if (roomLinkDisplay && gameState.roomLink) {
        roomLinkDisplay.textContent = gameState.roomLink;
    }
    
    // Обновляем счетчик игроков
    const currentPlayersCount = document.getElementById('currentPlayersCount');
    const maxPlayersCount = document.getElementById('maxPlayersCount');
    const playersList = document.getElementById('playersList');
    const startGameBtn = document.getElementById('startGameBtn');
    const waitingInfo = document.getElementById('waitingInfo');
    const maxPlayersSelector = document.getElementById('maxPlayersSelector');
    
    if (currentPlayersCount) {
        currentPlayersCount.textContent = gameState.players.length;
    }
    
    if (maxPlayersCount) {
        maxPlayersCount.textContent = gameState.maxPlayers;
    }
    
    // Обновляем список игроков
    if (playersList) {
        playersList.innerHTML = '';
        gameState.players.forEach(player => {
            const li = document.createElement('li');
            li.className = player.isHost ? 'host' : '';
            li.textContent = `${player.name}${player.isHost ? ' (Хост)' : ''}`;
            playersList.appendChild(li);
        });
    }
    
    // Показываем/скрываем кнопки и селекторы
    if (gameState.isHost) {
        if (startGameBtn) {
            startGameBtn.style.display = 'block';
            startGameBtn.disabled = gameState.players.length < 2;
            
            if (gameState.players.length < 2) {
                startGameBtn.textContent = 'Начать игру (минимум 2 игрока)';
            } else {
                startGameBtn.textContent = 'Начать игру';
            }
        }
        if (waitingInfo) {
            waitingInfo.style.display = 'none';
        }
        if (maxPlayersSelector) {
            maxPlayersSelector.style.display = 'block';
        }
    } else {
        if (startGameBtn) {
            startGameBtn.style.display = 'none';
        }
        if (waitingInfo) {
            waitingInfo.style.display = 'block';
        }
        if (maxPlayersSelector) {
            maxPlayersSelector.style.display = 'none';
        }
    }
    
    const maxPlayersSelect = document.getElementById('maxPlayersSelect');
    if (maxPlayersSelect) {
        maxPlayersSelect.value = gameState.maxPlayers;
    }
}

// === ИНИЦИАЛИЗАЦИЯ ===

document.addEventListener('DOMContentLoaded', function() {
    console.log('📱 DOM loaded, initializing...');
    
    // Показываем главный экран при загрузке
    showMainScreen();
    
    // Обработчики для главного экрана
    const playerNameInput = document.getElementById('playerNameInput');
    const roomCodeInput = document.getElementById('roomCodeInput');
    const createGameBtn = document.getElementById('createGameBtn');
    const joinGameBtn = document.getElementById('joinGameBtn');
    
    if (playerNameInput) {
        playerNameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                // Если есть код комнаты, присоединяемся, иначе создаем
                const roomCode = roomCodeInput ? roomCodeInput.value.trim() : '';
                if (roomCode) {
                    joinGame();
                } else {
                    createGame();
                }
            }
        });
    }
    
    if (roomCodeInput) {
        roomCodeInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                joinGame();
            }
        });
        
        // Автоматическое преобразование в верхний регистр
        roomCodeInput.addEventListener('input', function(e) {
            e.target.value = e.target.value.toUpperCase();
        });
    }
    
    if (createGameBtn) {
        createGameBtn.addEventListener('click', createGame);
    }
    
    if (joinGameBtn) {
        joinGameBtn.addEventListener('click', joinGame);
    }
    
    // Остальные обработчики остаются такими же
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
});

// Остальные функции остаются такими же, как в оригинальном файле
// (startGame, changeMaxPlayers, updateGameDisplay, и т.д.)

// === ОСНОВНЫЕ ФУНКЦИИ ИГРЫ (остаются без изменений) ===

function startGame() {
    console.log('🚀 Start game requested');
    
    if (!gameState.isHost) {
        showNotification('Ошибка', 'Только хост может начать игру!');
        return;
    }
    
    if (gameState.players.length < 2) {
        showNotification('Ошибка', 'Для начала игры нужно минимум 2 игрока!');
        return;
    }
    
    socket.emit('start-game');
}

function changeMaxPlayers() {
    const select = document.getElementById('maxPlayersSelect');
    const newMaxPlayers = parseInt(select.value);
    
    console.log('🔧 Changing max players to:', newMaxPlayers);
    socket.emit('change-max-players', { maxPlayers: newMaxPlayers });
}

// Добавляем обработчики игровых событий (копируем из оригинала)
socket.on('game-started', function(data) {
    console.log('🚀 Game started:', data);
    gameState.players = data.players;
    gameState.serverGameState = data.gameState;
    gameState.gamePhase = data.gamePhase;
    gameState.currentRound = data.currentRound;
    gameState.timeLeft = data.timeLeft;
    gameState.startRoundVotes = 0;
    gameState.myStartRoundVote = false;
    
    if (data.story) {
        const storyText = document.getElementById('storyText');
        if (storyText) {
            storyText.textContent = data.story;
        }
    }
    
    showGameScreen();
});

socket.on('game-reset', function(data) {
    console.log('🔄 Game reset:', data);
    gameState.players = data.players;
    gameState.serverGameState = data.gameState;
    gameState.gamePhase = 'lobby';
    gameState.currentRound = 1;
    gameState.timeLeft = 0;
    gameState.currentTurnPlayer = null;
    gameState.scenario = null;
    showLobbyScreen();
});

// Остальные игровые обработчики копируем из оригинального client.js

function showNotification(title, message) {
    document.getElementById('notificationTitle').textContent = title;
    document.getElementById('notificationMessage').textContent = message;
    document.getElementById('notificationModal').style.display = 'flex';
}

function closeNotificationModal() {
    document.getElementById('notificationModal').style.display = 'none';
}

console.log('🎮 Bunker Game Client Loaded');