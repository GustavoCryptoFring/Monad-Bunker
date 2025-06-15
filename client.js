console.log('🎮 Bunker Game Client Loading...');

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
    maxPlayers: 12 // ДОБАВИЛИ maxPlayers
};

// Инициализация Socket.IO
const socket = io();

// === SOCKET ОБРАБОТЧИКИ ===
socket.on('connect', function() {
    console.log('✅ Connected to server:', socket.id);
    gameState.playerId = socket.id;
    updatePlayerCount();
});

socket.on('disconnect', function() {
    console.log('❌ Disconnected from server');
    showNotification('Отключение', 'Соединение с сервером потеряно');
});

socket.on('room-state', function(data) {
    console.log('📊 Room state received:', data);
    updateGameState(data);
});

socket.on('join-confirmed', function(data) {
    console.log('✅ Join confirmed:', data);
    gameState.playerId = data.playerId;
    gameState.playerName = data.playerName;
    gameState.isHost = data.isHost;
    gameState.maxPlayers = data.maxPlayers || 12; // ДОБАВИЛИ maxPlayers
    showLobbyScreen();
});

socket.on('player-joined', function(data) {
    console.log('👋 Player joined:', data);
    gameState.players = data.players;
    if (data.maxPlayers) {
        gameState.maxPlayers = data.maxPlayers; // ОБНОВЛЯЕМ maxPlayers
    }
    updatePlayersDisplay();
    updatePlayerCount();
});

// НОВЫЙ обработчик изменения максимального количества игроков
socket.on('max-players-changed', function(data) {
    console.log('🔧 Max players changed:', data);
    gameState.maxPlayers = data.maxPlayers;
    gameState.players = data.players;
    updatePlayersDisplay();
    updateMaxPlayersSelector();
});

socket.on('player-left', function(data) {
    console.log('👋 Player left:', data);
    gameState.players = data.players;
    gameState.serverGameState = data.gameState;
    updatePlayersDisplay();
    updatePlayerCount();
    
    // Проверяем, стали ли мы хостом
    const me = gameState.players.find(p => p.id === gameState.playerId);
    if (me) {
        gameState.isHost = me.isHost;
        updateHostControls();
    }
});

socket.on('game-started', function(data) {
    console.log('🚀 Game started:', data);
    gameState.players = data.players;
    gameState.serverGameState = data.gameState;
    gameState.gamePhase = data.gamePhase || 'discussion';
    gameState.currentRound = data.currentRound;
    gameState.timeLeft = data.timeLeft;
    showGameScreen();
});

socket.on('phase-changed', function(data) {
    console.log('🔄 Phase changed:', data);
    gameState.gamePhase = data.gamePhase;
    gameState.timeLeft = data.timeLeft;
    gameState.players = data.players;
    updateGameDisplay();
});

socket.on('timer-update', function(data) {
    gameState.timeLeft = data.timeLeft;
    updateTimerDisplay();
});

socket.on('vote-update', function(data) {
    console.log('🗳️ Vote update:', data);
    gameState.players = data.players;
    gameState.votingResults = data.votingResults;
    updatePlayersGrid();
});

socket.on('characteristic-revealed', function(data) {
    console.log('🔍 Characteristic revealed:', data);
    gameState.players = data.players;
    updatePlayersGrid();
    showNotification('Характеристика раскрыта', 
        `${data.playerName} раскрыл: ${translateCharacteristic(data.characteristic)} - ${data.value}`);
});

socket.on('round-results', function(data) {
    console.log('📊 Round results:', data);
    gameState.players = data.players;
    
    if (data.eliminatedPlayer) {
        showNotification('Игрок исключен', `${data.eliminatedPlayer} был исключен из бункера!`);
    } else {
        showNotification('Результаты голосования', 'Никто не был исключен в этом раунде');
    }
    
    updatePlayersGrid();
});

socket.on('new-round', function(data) {
    console.log('🔄 New round:', data);
    gameState.currentRound = data.currentRound;
    gameState.gamePhase = data.gamePhase;
    gameState.timeLeft = data.timeLeft;
    gameState.players = data.players;
    gameState.myVote = null;
    updateGameDisplay();
});

socket.on('game-ended', function(data) {
    console.log('🏁 Game ended:', data);
    gameState.players = data.players;
    showResultsScreen(data.winners);
});

socket.on('game-reset', function(data) {
    console.log('🔄 Game reset:', data);
    gameState.players = data.players;
    gameState.serverGameState = data.gameState;
    gameState.gamePhase = 'lobby';
    gameState.currentRound = 1;
    gameState.myVote = null;
    showLobbyScreen();
});

socket.on('error', function(error) {
    console.error('❌ Server error:', error);
    showNotification('Ошибка', error);
});

// === ОСНОВНЫЕ ФУНКЦИИ ===
function joinGame() {
    const playerName = document.getElementById('playerNameInput').value.trim();
    
    if (!playerName) {
        showNotification('Ошибка', 'Пожалуйста, введите ваше имя');
        return;
    }
    
    if (playerName.length < 2) {
        showNotification('Ошибка', 'Имя должно содержать минимум 2 символа');
        return;
    }
    
    if (!socket.connected) {
        showNotification('Ошибка', 'Нет соединения с сервером');
        return;
    }
    
    console.log('🎯 Joining game as:', playerName);
    socket.emit('join-game', { playerName });
}

function startGame() {
    if (!gameState.isHost) {
        showNotification('Ошибка', 'Только хост может начать игру');
        return;
    }
    
    socket.emit('start-game');
}

// Функции для отображения экранов
function showLobbyScreen() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('lobbyScreen').style.display = 'block';
    document.getElementById('gameScreen').style.display = 'none';
    document.getElementById('resultsScreen').style.display = 'none';
    
    updatePlayersDisplay();
    updatePlayerCount();
    updateHostControls();
}

function showGameScreen() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('lobbyScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'block';
    document.getElementById('resultsScreen').style.display = 'none';
    
    updateGameDisplay();
    updatePlayersGrid();
}

function showResultsScreen(winners) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('lobbyScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'none';
    document.getElementById('resultsScreen').style.display = 'block';
    
    const winnersList = document.getElementById('winnersList');
    winnersList.innerHTML = '';
    
    winners.forEach(winner => {
        const li = document.createElement('li');
        li.textContent = winner.name;
        li.className = 'host'; // Используем стиль хоста для выделения
        winnersList.appendChild(li);
    });
}

// Функции для обновления отображения
function updateGameState(data) {
    gameState.players = data.players || [];
    gameState.serverGameState = data.gameState;
    gameState.gamePhase = data.gamePhase;
    gameState.currentRound = data.currentRound || 1;
    gameState.timeLeft = data.timeLeft || 0;
    
    updatePlayerCount();
    
    if (gameState.players.length > 0) {
        const me = gameState.players.find(p => p.id === gameState.playerId);
        if (me) {
            gameState.isHost = me.isHost;
        }
    }
}

function updatePlayersDisplay() {
    const playersList = document.getElementById('playersList');
    const currentPlayersCount = document.getElementById('currentPlayersCount');
    const maxPlayersCount = document.getElementById('maxPlayersCount');
    
    if (playersList) {
        playersList.innerHTML = '';
        
        gameState.players.forEach(player => {
            const li = document.createElement('li');
            li.textContent = player.name + (player.isHost ? ' 👑' : '');
            li.className = player.isHost ? 'host' : '';
            playersList.appendChild(li);
        });
    }
    
    if (currentPlayersCount) {
        currentPlayersCount.textContent = gameState.players.length;
    }
    
    if (maxPlayersCount) {
        maxPlayersCount.textContent = gameState.maxPlayers || 12;
    }
    
    updateHostControls(); // ВАЖНО: обновляем контролы хоста
}

function updatePlayerCount() {
    const playerCountElement = document.getElementById('playerCount');
    if (playerCountElement) {
        playerCountElement.textContent = gameState.players.length;
    }
}

function updateHostControls() {
    const startBtn = document.getElementById('startGameBtn');
    const waitingInfo = document.getElementById('waitingInfo');
    const maxPlayersSelector = document.getElementById('maxPlayersSelector');
    
    if (gameState.isHost) {
        if (startBtn) {
            startBtn.style.display = 'block';
            // ИСПРАВЛЕНО: кнопка активна при >= 2 игроков
            startBtn.disabled = gameState.players.length < 2;
            startBtn.textContent = gameState.players.length < 2 ? 
                'Начать игру (минимум 2 игрока)' : 
                `Начать игру (${gameState.players.length}/${gameState.maxPlayers || 12})`;
        }
        if (waitingInfo) {
            waitingInfo.style.display = 'none';
        }
        if (maxPlayersSelector) {
            maxPlayersSelector.style.display = 'block';
        }
    } else {
        if (startBtn) {
            startBtn.style.display = 'none';
        }
        if (waitingInfo) {
            waitingInfo.style.display = 'block';
        }
        if (maxPlayersSelector) {
            maxPlayersSelector.style.display = 'none';
        }
    }
}

// НОВАЯ функция изменения максимального количества игроков
function changeMaxPlayers() {
    const selector = document.getElementById('maxPlayersSelect');
    const maxPlayers = parseInt(selector.value);
    
    console.log('🔧 Changing max players to:', maxPlayers);
    socket.emit('change-max-players', { maxPlayers });
}

function updateMaxPlayersSelector() {
    const selector = document.getElementById('maxPlayersSelect');
    if (selector && gameState.maxPlayers) {
        selector.value = gameState.maxPlayers;
    }
}

function updateGameDisplay() {
    const currentRoundElement = document.getElementById('currentRound');
    const gameStatusElement = document.getElementById('gameStatus');
    const phaseDisplayElement = document.getElementById('phaseDisplay');
    
    if (currentRoundElement) {
        currentRoundElement.textContent = gameState.currentRound;
    }
    
    if (gameStatusElement) {
        gameStatusElement.textContent = getGameStatusText();
    }
    
    if (phaseDisplayElement) {
        phaseDisplayElement.textContent = getPhaseDisplayText();
    }
    
    updateTimerDisplay();
    updatePlayersGrid();
}

function getGameStatusText() {
    switch (gameState.gamePhase) {
        case 'discussion': return 'Фаза обсуждения';
        case 'voting': return 'Фаза голосования';
        case 'results': return 'Подведение итогов раунда';
        case 'finished': return 'Игра завершена';
        default: return 'Ожидание начала игры...';
    }
}

function getPhaseDisplayText() {
    switch (gameState.gamePhase) {
        case 'discussion': return 'ОБСУЖДЕНИЕ';
        case 'voting': return 'ГОЛОСОВАНИЕ';
        case 'results': return 'РЕЗУЛЬТАТЫ';
        default: return 'ПОДГОТОВКА';
    }
}

function updateTimerDisplay() {
    const timerDisplay = document.getElementById('timerDisplay');
    if (timerDisplay && gameState.timeLeft > 0) {
        const minutes = Math.floor(gameState.timeLeft / 60);
        const seconds = gameState.timeLeft % 60;
        timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

function updatePlayersGrid() {
    const playersGrid = document.getElementById('playersGrid');
    if (!playersGrid) return;
    
    playersGrid.innerHTML = '';
    playersGrid.className = 'players-grid';
    
    const playerCount = gameState.players.length;
    playersGrid.classList.add(`players-${playerCount}`);
    
    gameState.players.forEach(player => {
        if (player.characteristics) {
            const playerCard = createPlayerCard(player);
            playersGrid.appendChild(playerCard);
        }
    });
}

function createPlayerCard(player) {
    const card = document.createElement('div');
    const isCurrentPlayer = player.id === gameState.playerId;
    
    card.className = `player-card ${player.isAlive ? '' : 'eliminated'} ${isCurrentPlayer ? 'current-player' : ''}`;
    
    card.innerHTML = `
        <div class="player-header">
            <div class="player-info">
                <div class="player-avatar-container">
                    <div class="player-avatar ${player.isAlive ? '' : 'eliminated-avatar'}">
                        ${player.name.charAt(0).toUpperCase()}
                    </div>
                </div>
                <div>
                    <div class="player-name ${player.isAlive ? '' : 'eliminated-name'}">
                        ${player.name}${player.isHost ? ' 👑' : ''}
                    </div>
                    ${isCurrentPlayer ? '<div class="player-status current">Вы</div>' : ''}
                </div>
            </div>
        </div>
        
        <div class="characteristics">
            ${Object.entries(player.characteristics).map(([key, value]) => {
                const isRevealed = player.hasRevealed || key === 'profession';
                const isOwnCard = isCurrentPlayer;
                
                return `<div class="characteristic ${isRevealed ? 'revealed' : (isOwnCard ? 'own-hidden' : 'hidden')}">
                    <span class="characteristic-name">${translateCharacteristic(key)}:</span>
                    <span class="characteristic-value ${isOwnCard && !isRevealed ? 'own-characteristic' : ''}">
                        ${isRevealed ? value : (isOwnCard ? value : '???')}
                    </span>
                </div>`;
            }).join('')}
        </div>
        
        <div class="player-actions">
            ${gameState.gamePhase === 'discussion' && isCurrentPlayer && !player.hasRevealed ? 
                `<button class="room-btn" onclick="openCharacteristicModal()">
                    🔍 Раскрыть характеристику
                </button>` : ''
            }
            ${gameState.gamePhase === 'voting' && !isCurrentPlayer && player.isAlive ? 
                `<div class="vote-section">
                    <button class="vote-player-btn ${gameState.myVote === player.id ? 'voted' : ''}" onclick="voteForPlayer('${player.id}')">
                        ${gameState.myVote === player.id ? '✅ Проголосовано' : '📋 Голосовать'}
                    </button>
                    <div class="voters-list">
                        Голосов: ${player.votes || 0}
                    </div>
                </div>` : ''
            }
        </div>
    `;
    
    return card;
}

function translateCharacteristic(key) {
    const translations = {
        profession: 'Профессия',
        health: 'Здоровье',
        hobby: 'Хобби',
        phobia: 'Фобия',
        baggage: 'Багаж',
        fact: 'Факт'
    };
    return translations[key] || key;
}

// Функции взаимодействия
function openCharacteristicModal() {
    const player = gameState.players.find(p => p.id === gameState.playerId);
    if (!player || !player.characteristics) return;
    
    const modal = document.getElementById('characteristicModal');
    const options = document.getElementById('characteristicOptions');
    
    options.innerHTML = '';
    
    Object.keys(player.characteristics).forEach(key => {
        if (key !== 'profession') { // Профессия всегда видна
            const button = document.createElement('button');
            button.className = 'room-btn';
            button.textContent = `${translateCharacteristic(key)}: ${player.characteristics[key]}`;
            button.onclick = () => revealCharacteristic(key);
            options.appendChild(button);
        }
    });
    
    modal.style.display = 'flex';
}

function closeCharacteristicModal() {
    document.getElementById('characteristicModal').style.display = 'none';
}

function revealCharacteristic(characteristic) {
    socket.emit('reveal-characteristic', { characteristic });
    closeCharacteristicModal();
}

function voteForPlayer(playerId) {
    if (gameState.gamePhase !== 'voting') return;
    
    gameState.myVote = playerId;
    socket.emit('vote-player', { targetId: playerId });
    updatePlayersGrid();
}

function showNotification(title, message) {
    document.getElementById('notificationTitle').textContent = title;
    document.getElementById('notificationMessage').textContent = message;
    document.getElementById('notificationModal').style.display = 'flex';
}

function closeNotificationModal() {
    document.getElementById('notificationModal').style.display = 'none';
}

// Заглушки для дополнительных функций
function voteToSkip() {
    console.log('Vote to skip phase');
}

function showActionCard() {
    console.log('Show action cards');
}

// Обработчик нажатия Enter в поле ввода имени
document.addEventListener('DOMContentLoaded', function() {
    const playerNameInput = document.getElementById('playerNameInput');
    if (playerNameInput) {
        playerNameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                joinGame();
            }
        });
    }
});

console.log('🎮 Bunker Game Client Loaded');