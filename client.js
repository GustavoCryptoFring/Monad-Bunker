console.log('🎮 Multi-Room Bunker Game Client Loading...');

// Состояние игры
let gameState = {
    playerId: null,
    playerName: '',
    isHost: false,
    players: [],
    gamePhase: 'login',
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
    currentRoom: null,
    roomType: 'default',
    roomId: null
};

// === URL УПРАВЛЕНИЕ ===

function parseRoomFromURL() {
    const hash = window.location.hash.substring(1); // убираем #
    const path = window.location.pathname;
    
    console.log('🔍 Parsing URL - path:', path, 'hash:', hash);
    
    if (path.includes('/game/')) {
        const roomPath = path.split('/game/')[1];
        const roomType = roomPath.split('/')[0] || 'default';
        return {
            roomType: roomType,
            roomId: hash || generateRoomId()
        };
    }
    
    return {
        roomType: 'default',
        roomId: hash || 'main'
    };
}

function generateRoomId() {
    return Math.random().toString(36).substring(2, 8).toLowerCase();
}

function updateURL(roomType, roomId) {
    const newPath = `/game/${roomType}`;
    const newHash = `#${roomId}`;
    const newUrl = newPath + newHash;
    
    console.log('🔄 Updating URL to:', newUrl);
    window.history.pushState({}, '', newUrl);
    
    // Обновляем состояние
    gameState.roomType = roomType;
    gameState.roomId = roomId;
}

function getCurrentRoomInfo() {
    return parseRoomFromURL();
}

// Socket.IO подключение
const socket = io({
    transports: ['websocket', 'polling'],
    timeout: 10000,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000
});

// === ОБРАБОТЧИКИ СОБЫТИЙ SOCKET.IO ===

socket.on('connect', function() {
    console.log('🌐 Connected to server');
    console.log('🔗 Socket ID:', socket.id);
    
    // Парсим комнату из URL при подключении
    const roomInfo = getCurrentRoomInfo();
    gameState.roomType = roomInfo.roomType;
    gameState.roomId = roomInfo.roomId;
    
    console.log('🏠 Current room info:', roomInfo);
    
    showLoginScreen();
    
    const joinBtn = document.getElementById('joinGameBtn');
    if (joinBtn && joinBtn.disabled) {
        joinBtn.disabled = false;
        joinBtn.textContent = 'Присоединиться к игре';
    }
});

socket.on('connect_error', function(error) {
    console.error('❌ Connection error:', error);
    alert('Ошибка подключения к серверу. Проверьте интернет-соединение.');
});

socket.on('disconnect', function(reason) {
    console.log('❌ Disconnected from server:', reason);
    alert('Соединение потеряно. Попытка переподключения...');
});

socket.on('error', function(errorMessage) {
    console.error('❌ Server error:', errorMessage);
    
    const joinBtn = document.getElementById('joinGameBtn');
    if (joinBtn) {
        joinBtn.disabled = false;
        joinBtn.textContent = 'Присоединиться к игре';
    }
    
    alert('Ошибка: ' + errorMessage);
});

socket.on('join-confirmed', function(data) {
    console.log('✅ Join confirmed:', data);
    
    const joinBtn = document.getElementById('joinGameBtn');
    if (joinBtn) {
        joinBtn.disabled = false;
        joinBtn.textContent = 'Присоединиться к игре';
    }
    
    gameState.playerId = data.playerId;
    gameState.playerName = data.playerName;
    gameState.isHost = data.isHost;
    gameState.maxPlayers = data.maxPlayers;
    gameState.startRoundVotes = data.startRoundVotes || 0;
    gameState.gamePhase = 'lobby';
    gameState.currentRoom = data.roomId;
    
    // Обновляем URL если нужно
    const roomInfo = getCurrentRoomInfo();
    updateURL(roomInfo.roomType, roomInfo.roomId);
    
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
    updateLobbyDisplay();
});

socket.on('max-players-changed', function(data) {
    console.log('🔧 Max players changed:', data);
    gameState.maxPlayers = data.maxPlayers;
    gameState.players = data.players;
    updateLobbyDisplay();
});

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
        gameState.scenario = data.story;
    }
    
    showGameScreen();
    updateGameDisplay();
});

socket.on('characteristic-revealed', function(data) {
    console.log('🔍 Characteristic revealed:', data);
    gameState.players = data.players;
    updateGameDisplay();
    
    showNotification('Характеристика раскрыта', 
        `${data.playerName} раскрыл(а) ${getCharacteristicName(data.characteristic)}: ${data.value}`);
});

socket.on('phase-changed', function(data) {
    console.log('🔄 Phase changed:', data);
    gameState.gamePhase = data.gamePhase;
    gameState.timeLeft = data.timeLeft;
    gameState.players = data.players;
    gameState.currentTurnPlayer = data.currentTurnPlayer;
    gameState.currentRound = data.currentRound;
    updateGameDisplay();
});

socket.on('timer-update', function(data) {
    gameState.timeLeft = data.timeLeft;
    gameState.currentTurnPlayer = data.currentTurnPlayer;
    updateTimer();
});

socket.on('vote-update', function(data) {
    console.log('🗳️ Vote update:', data);
    gameState.players = data.players;
    gameState.votingResults = data.votingResults;
    gameState.canChangeVote = data.canChangeVote;
    updateGameDisplay();
});

socket.on('round-results', function(data) {
    console.log('📊 Round results:', data);
    gameState.players = data.players;
    gameState.votingResults = data.votingResults;
    updateGameDisplay();
    
    if (data.eliminatedPlayers && data.eliminatedPlayers.length > 0) {
        if (data.eliminatedPlayers.length === 1) {
            showNotification('Игрок исключен', `${data.eliminatedPlayers[0]} покидает бункер`);
        } else {
            showNotification('Игроки исключены', `${data.eliminatedPlayers.join(', ')} покидают бункер`);
        }
    } else {
        showNotification('Результаты раунда', data.resultMessage || 'Никто не исключен');
    }
});

socket.on('new-round', function(data) {
    console.log('🔄 New round:', data);
    gameState.currentRound = data.currentRound;
    gameState.gamePhase = data.gamePhase;
    gameState.timeLeft = data.timeLeft;
    gameState.players = data.players;
    gameState.startRoundVotes = 0;
    gameState.myStartRoundVote = false;
    updateGameDisplay();
    
    showNotification('Новый раунд', `Раунд ${data.currentRound} начинается!`);
});

socket.on('game-ended', function(data) {
    console.log('🏁 Game ended:', data);
    gameState.players = data.players;
    
    const winnerNames = data.winners.map(w => w.name).join(', ');
    showNotification('Игра окончена!', `Победители: ${winnerNames}`);
    
    setTimeout(() => {
        showLobbyScreen();
    }, 5000);
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

socket.on('start-round-vote-update', function(data) {
    console.log('🎯 Start round vote update:', data);
    gameState.startRoundVotes = data.votes;
    gameState.myStartRoundVote = data.hasVoted;
    updateActionButtons();
});

socket.on('skip-discussion-vote-update', function(data) {
    console.log('⏭️ Skip discussion vote update:', data);
    gameState.skipDiscussionVotes = data.votes;
    gameState.mySkipVote = data.hasVoted;
    updateActionButtons();
});

// === ФУНКЦИИ ИГРЫ ===

function joinGame() {
    console.log('🎯 joinGame function called');
    
    const nameInput = document.getElementById('playerNameInput');
    if (!nameInput) {
        console.error('❌ Name input not found');
        return;
    }
    
    const playerName = nameInput.value.trim();
    console.log('🎯 Player name:', playerName);
    
    if (!playerName) {
        showNotification('Ошибка', 'Введите ваше имя!');
        return;
    }
    
    if (playerName.length < 2 || playerName.length > 20) {
        showNotification('Ошибка', 'Имя должно быть от 2 до 20 символов!');
        return;
    }
    
    if (!socket.connected) {
        console.error('❌ Socket not connected');
        showNotification('Ошибка', 'Нет соединения с сервером. Попробуйте перезагрузить страницу.');
        return;
    }
    
    // Получаем информацию о комнате из URL
    const roomInfo = getCurrentRoomInfo();
    
    console.log('🎯 Joining room:', roomInfo, 'with name:', playerName);
    
    // Блокируем кнопку
    const joinBtn = document.getElementById('joinGameBtn');
    if (joinBtn) {
        joinBtn.disabled = true;
        joinBtn.textContent = 'Подключение...';
    }
    
    // Отправляем запрос на присоединение к комнате
    socket.emit('join-room', {
        roomId: roomInfo.roomId,
        roomType: roomInfo.roomType,
        playerName: playerName
    });
    
    // Разблокируем через 5 секунд если нет ответа
    setTimeout(() => {
        if (joinBtn && joinBtn.disabled) {
            joinBtn.disabled = false;
            joinBtn.textContent = 'Присоединиться к игре';
        }
    }, 5000);
}

function createNewRoom() {
    const newRoomId = generateRoomId();
    const roomType = 'game';
    
    console.log('🏠 Creating new room:', roomType, newRoomId);
    
    updateURL(roomType, newRoomId);
    
    // Показываем URL для приглашения друзей
    const inviteUrl = window.location.href;
    showNotification('Комната создана!', `Пригласите друзей по ссылке: ${inviteUrl}`);
    
    // Обновляем интерфейс входа
    const roomDisplay = document.getElementById('roomIdDisplay');
    if (roomDisplay) {
        roomDisplay.textContent = `Комната: ${newRoomId}`;
    }
}

function showRoomInviteLink() {
    const currentUrl = window.location.href;
    
    // Копируем в буфер обмена если возможно
    if (navigator.clipboard) {
        navigator.clipboard.writeText(currentUrl).then(() => {
            showNotification('Ссылка скопирована', 'Ссылка для приглашения скопирована в буфер обмена');
        }).catch(() => {
            showNotification('Ссылка для приглашения', currentUrl);
        });
    } else {
        showNotification('Ссылка для приглашения', currentUrl);
    }
}

function startGame() {
    console.log('🚀 Starting game');
    socket.emit('start-game');
}

function changeMaxPlayers() {
    const select = document.getElementById('maxPlayersSelect');
    if (!select) return;
    
    const newMaxPlayers = parseInt(select.value);
    console.log('🔧 Changing max players to:', newMaxPlayers);
    
    socket.emit('change-max-players', { maxPlayers: newMaxPlayers });
}

function revealCharacteristic(characteristic) {
    console.log('🔍 Revealing characteristic:', characteristic);
    socket.emit('reveal-characteristic', { characteristic: characteristic });
}

function votePlayer(playerId) {
    console.log('🗳️ Voting for player:', playerId);
    socket.emit('vote-player', { targetId: playerId });
}

function voteStartRound() {
    console.log('🎯 Voting to start round');
    socket.emit('start-round');
}

function voteSkipDiscussion() {
    console.log('⏭️ Voting to skip discussion');
    socket.emit('vote-skip-discussion');
}

// === ФУНКЦИИ ИНТЕРФЕЙСА ===

function showLoginScreen() {
    console.log('📱 Showing login screen');
    
    hideAllScreens();
    
    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) {
        loginScreen.style.display = 'flex';
        
        // Показываем информацию о текущей комнате
        const roomInfo = getCurrentRoomInfo();
        const roomDisplay = document.getElementById('roomIdDisplay');
        if (roomDisplay) {
            roomDisplay.textContent = `Комната: ${roomInfo.roomId}`;
        }
        
        // Добавляем кнопки управления комнатой
        addRoomControls();
    }
}

function addRoomControls() {
    const loginScreen = document.getElementById('loginScreen');
    if (!loginScreen) return;
    
    // Проверяем, не добавлены ли уже кнопки
    if (loginScreen.querySelector('.room-controls')) return;
    
    const roomControls = document.createElement('div');
    roomControls.className = 'room-controls';
    roomControls.style.marginTop = '20px';
    roomControls.style.textAlign = 'center';
    
    roomControls.innerHTML = `
        <button id="createRoomBtn" class="room-btn" style="margin: 5px; padding: 10px 15px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer;">Создать новую комнату</button>
        <button id="inviteLinkBtn" class="room-btn" style="margin: 5px; padding: 10px 15px; background: #2196F3; color: white; border: none; border-radius: 5px; cursor: pointer;">Получить ссылку приглашения</button>
        <div id="roomIdDisplay" class="room-info" style="margin-top: 10px; font-size: 14px; color: #666;">Комната: ${gameState.roomId || 'загрузка...'}</div>
    `;
    
    loginScreen.appendChild(roomControls);
    
    // Добавляем обработчики
    const createRoomBtn = document.getElementById('createRoomBtn');
    if (createRoomBtn) {
        createRoomBtn.addEventListener('click', createNewRoom);
    }
    
    const inviteLinkBtn = document.getElementById('inviteLinkBtn');
    if (inviteLinkBtn) {
        inviteLinkBtn.addEventListener('click', showRoomInviteLink);
    }
}

function showLobbyScreen() {
    console.log('🏠 Showing lobby screen');
    
    hideAllScreens();
    
    const lobbyScreen = document.getElementById('lobbyScreen');
    if (lobbyScreen) {
        lobbyScreen.style.display = 'block';
        updateLobbyDisplay();
    }
}

function showGameScreen() {
    console.log('🎮 Showing game screen');
    
    hideAllScreens();
    
    const gameScreen = document.getElementById('gameScreen');
    if (gameScreen) {
        gameScreen.style.display = 'block';
        updateGameDisplay();
    }
}

function hideAllScreens() {
    const screens = ['loginScreen', 'lobbyScreen', 'gameScreen'];
    screens.forEach(screenId => {
        const screen = document.getElementById(screenId);
        if (screen) {
            screen.style.display = 'none';
        }
    });
}

function updateLobbyDisplay() {
    const playersList = document.getElementById('playersList');
    const playersCount = document.getElementById('playersCount');
    const maxPlayersSelect = document.getElementById('maxPlayersSelect');
    const startGameBtn = document.getElementById('startGameBtn');
    
    if (playersList) {
        playersList.innerHTML = '';
        gameState.players.forEach(player => {
            const li = document.createElement('li');
            li.className = 'player-item';
            li.innerHTML = `
                <span class="player-name">${player.name}</span>
                ${player.isHost ? '<span class="host-badge">👑 Хост</span>' : ''}
                ${player.id === gameState.playerId ? '<span class="you-badge">ВЫ</span>' : ''}
            `;
            playersList.appendChild(li);
        });
    }
    
    if (playersCount) {
        playersCount.textContent = `${gameState.players.length}/${gameState.maxPlayers}`;
    }
    
    if (maxPlayersSelect && gameState.isHost) {
        maxPlayersSelect.style.display = 'block';
        maxPlayersSelect.value = gameState.maxPlayers;
    } else if (maxPlayersSelect) {
        maxPlayersSelect.style.display = 'none';
    }
    
    if (startGameBtn) {
        startGameBtn.style.display = gameState.isHost ? 'block' : 'none';
        startGameBtn.disabled = gameState.players.length < 2;
    }
}

function updateGameDisplay() {
    updateTimer();
    updatePlayersDisplay();
    updateCharacteristics();
    updatePhaseDisplay();
    updateActionButtons();
    updateScenario();
}

function updateTimer() {
    const timerElement = document.getElementById('timer');
    if (timerElement && gameState.timeLeft > 0) {
        const minutes = Math.floor(gameState.timeLeft / 60);
        const seconds = gameState.timeLeft % 60;
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

function updatePlayersDisplay() {
    const gamePlayersList = document.getElementById('gamePlayersList');
    if (!gamePlayersList) return;
    
    gamePlayersList.innerHTML = '';
    
    gameState.players.forEach(player => {
        const li = document.createElement('li');
        li.className = `game-player-item ${!player.isAlive ? 'eliminated' : ''}`;
        
        let statusBadges = '';
        if (player.isHost) statusBadges += '<span class="host-badge">👑</span>';
        if (player.id === gameState.playerId) statusBadges += '<span class="you-badge">ВЫ</span>';
        if (!player.isAlive) statusBadges += '<span class="eliminated-badge">💀</span>';
        if (player.id === gameState.currentTurnPlayer) statusBadges += '<span class="turn-badge">🎯</span>';
        
        li.innerHTML = `
            <div class="player-info">
                <span class="player-name">${player.name}</span>
                ${statusBadges}
            </div>
            <div class="player-characteristics">
                ${getPlayerCharacteristicsHTML(player)}
            </div>
            ${gameState.gamePhase === 'voting' && player.isAlive && player.id !== gameState.playerId ? 
                `<button class="vote-btn" onclick="votePlayer('${player.id}')">Голосовать</button>` : ''}
        `;
        
        gamePlayersList.appendChild(li);
    });
}

function getPlayerCharacteristicsHTML(player) {
    if (!player.revealedCharacteristics || player.revealedCharacteristics.length === 0) {
        return '<span class="no-characteristics">Характеристики не раскрыты</span>';
    }
    
    return player.revealedCharacteristics.map(char => {
        const value = player.characteristics[char];
        const name = getCharacteristicName(char);
        return `<div class="characteristic"><strong>${name}:</strong> ${value}</div>`;
    }).join('');
}

function getCharacteristicName(characteristic) {
    const names = {
        'profession': 'Профессия',
        'health': 'Здоровье',
        'hobby': 'Хобби',
        'phobia': 'Фобия',
        'baggage': 'Багаж',
        'fact1': 'Факт 1',
        'fact2': 'Факт 2'
    };
    return names[characteristic] || characteristic;
}

function updateCharacteristics() {
    const characteristicsContainer = document.getElementById('characteristicsContainer');
    if (!characteristicsContainer) return;
    
    const myPlayer = gameState.players.find(p => p.id === gameState.playerId);
    if (!myPlayer || !myPlayer.characteristics) {
        characteristicsContainer.innerHTML = '<p>Характеристики не загружены</p>';
        return;
    }
    
    const characteristics = myPlayer.characteristics;
    const revealed = myPlayer.revealedCharacteristics || [];
    
    characteristicsContainer.innerHTML = `
        <div class="my-characteristics">
            <h3>Ваши характеристики:</h3>
            ${Object.entries(characteristics).map(([key, value]) => {
                const isRevealed = revealed.includes(key);
                const name = getCharacteristicName(key);
                return `
                    <div class="characteristic-card ${isRevealed ? 'revealed' : 'hidden'}">
                        <div class="characteristic-name">${name}</div>
                        <div class="characteristic-value">${value}</div>
                        ${!isRevealed && gameState.gamePhase === 'revelation' && gameState.currentTurnPlayer === gameState.playerId ? 
                            `<button class="reveal-btn" onclick="revealCharacteristic('${key}')">Раскрыть</button>` : ''}
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function updatePhaseDisplay() {
    const phaseElement = document.getElementById('currentPhase');
    const roundElement = document.getElementById('currentRound');
    
    if (phaseElement) {
        const phaseNames = {
            'preparation': 'Подготовка к раунду',
            'revelation': 'Раскрытие характеристик',
            'discussion': 'Обсуждение',
            'voting': 'Голосование',
            'justification': 'Оправдания',
            'results': 'Результаты раунда'
        };
        phaseElement.textContent = phaseNames[gameState.gamePhase] || gameState.gamePhase;
    }
    
    if (roundElement) {
        roundElement.textContent = `Раунд ${gameState.currentRound}`;
    }
}

function updateActionButtons() {
    const actionsContainer = document.getElementById('actionsContainer');
    if (!actionsContainer) return;
    
    let html = '';
    
    switch (gameState.gamePhase) {
        case 'preparation':
            if (!gameState.myStartRoundVote) {
                html = '<button class="action-btn" onclick="voteStartRound()">Готов к раунду</button>';
            } else {
                html = '<p>Вы проголосовали за начало раунда. Ожидание других игроков...</p>';
            }
            break;
            
        case 'revelation':
            if (gameState.currentTurnPlayer === gameState.playerId) {
                html = '<p>Ваш ход! Выберите характеристику для раскрытия.</p>';
            } else {
                const currentPlayer = gameState.players.find(p => p.id === gameState.currentTurnPlayer);
                html = `<p>Ход игрока: ${currentPlayer ? currentPlayer.name : 'неизвестно'}</p>`;
            }
            break;
            
        case 'discussion':
            if (!gameState.mySkipVote) {
                html = '<button class="action-btn" onclick="voteSkipDiscussion()">Пропустить обсуждение</button>';
            } else {
                html = '<p>Вы проголосовали за пропуск обсуждения.</p>';
            }
            break;
            
        case 'voting':
            html = '<p>Голосуйте за игрока, которого хотите исключить из бункера.</p>';
            break;
            
        default:
            html = '<p>Ожидание...</p>';
    }
    
    actionsContainer.innerHTML = html;
}

function updateScenario() {
    const scenarioElement = document.getElementById('scenarioText');
    if (scenarioElement && gameState.scenario) {
        scenarioElement.textContent = gameState.scenario;
    }
}

function showNotification(title, message) {
    console.log(`📢 ${title}: ${message}`);
    
    // Простое уведомление через alert, можно заменить на более красивое
    alert(`${title}\n\n${message}`);
}

// === ИНИЦИАЛИЗАЦИЯ ===

document.addEventListener('DOMContentLoaded', function() {
    console.log('📱 DOM loaded, initializing...');
    
    // Показываем экран входа при загрузке
    showLoginScreen();
    
    // Обработчик Enter для поля ввода имени
    const playerNameInput = document.getElementById('playerNameInput');
    if (playerNameInput) {
        playerNameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                joinGame();
            }
        });
    }
    
    // Обработчик для кнопки присоединения
    const joinGameBtn = document.getElementById('joinGameBtn');
    if (joinGameBtn) {
        joinGameBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🎯 Join button clicked');
            joinGame();
        });
    }
    
    // Обработчик для кнопки начала игры
    const startGameBtn = document.getElementById('startGameBtn');
    if (startGameBtn) {
        startGameBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🚀 Start game button clicked');
            startGame();
        });
    }
    
    // Обработчик для изменения максимального количества игроков
    const maxPlayersSelect = document.getElementById('maxPlayersSelect');
    if (maxPlayersSelect) {
        maxPlayersSelect.addEventListener('change', changeMaxPlayers);
    }
    
    // Закрытие модальных окон по клику вне области
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
    
    // Обработчик изменения URL (кнопка назад/вперед браузера)
    window.addEventListener('popstate', function() {
        const roomInfo = getCurrentRoomInfo();
        gameState.roomType = roomInfo.roomType;
        gameState.roomId = roomInfo.roomId;
        
        // Обновляем отображение комнаты
        const roomDisplay = document.getElementById('roomIdDisplay');
        if (roomDisplay) {
            roomDisplay.textContent = `Комната: ${roomInfo.roomId}`;
        }
    });
    
    console.log('✅ DOM initialization complete');
});

console.log('✅ Multi-Room Client loaded successfully');