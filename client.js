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
    maxPlayers: 12,
    currentTurnPlayer: null
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
    gameState.maxPlayers = data.maxPlayers || 12;
    showLobbyScreen();
});

socket.on('player-joined', function(data) {
    console.log('👋 Player joined:', data);
    gameState.players = data.players;
    if (data.maxPlayers) {
        gameState.maxPlayers = data.maxPlayers;
    }
    updatePlayersDisplay();
    updatePlayerCount();
});

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
    gameState.gamePhase = data.gamePhase;
    gameState.currentRound = data.currentRound;
    gameState.timeLeft = data.timeLeft;
    showGameScreen();
});

// НОВЫЙ обработчик начала хода игрока
socket.on('player-turn-started', function(data) {
    console.log('🎯 Player turn started:', data);
    gameState.gamePhase = data.gamePhase;
    gameState.currentTurnPlayer = data.currentTurnPlayer;
    gameState.timeLeft = data.timeLeft;
    gameState.players = data.players;
    updateGameDisplay();
});

socket.on('phase-changed', function(data) {
    console.log('🔄 Phase changed:', data);
    gameState.gamePhase = data.gamePhase;
    gameState.timeLeft = data.timeLeft;
    gameState.players = data.players;
    gameState.currentTurnPlayer = data.currentTurnPlayer || null; // ИСПРАВЛЕНО: сохраняем currentTurnPlayer
    updateGameDisplay();
});

socket.on('timer-update', function(data) {
    gameState.timeLeft = data.timeLeft;
    gameState.currentTurnPlayer = data.currentTurnPlayer;
    updateTimerDisplay();
});

socket.on('vote-update', function(data) {
    console.log('🗳️ Vote update:', data);
    gameState.players = data.players;
    gameState.votingResults = data.votingResults;
    updatePlayersGrid();
    
    // Показываем прогресс голосования
    if (data.votedCount !== undefined && data.totalPlayers !== undefined) {
        const voteProgress = document.getElementById('voteProgress');
        if (voteProgress) {
            voteProgress.textContent = `Проголосовало: ${data.votedCount}/${data.totalPlayers}`;
        }
    }
});

socket.on('characteristic-revealed', function(data) {
    console.log('🔍 Characteristic revealed:', data);
    gameState.players = data.players;
    updatePlayersGrid();
    
    // ИСПРАВЛЕНО: показываем правильное имя в уведомлении
    const isMe = data.playerId === gameState.playerId;
    const playerName = isMe ? 'Вы' : data.playerName;
    
    showNotification('Характеристика раскрыта', 
        `${playerName} раскрыл${isMe ? 'и' : ''}: ${translateCharacteristic(data.characteristic)} - ${data.value}`);
});

socket.on('round-results', function(data) {
    console.log('📊 Round results:', data);
    gameState.players = data.players;
    
    if (data.eliminatedPlayer) {
        // ИСПРАВЛЕНО: показываем правильное имя исключенного игрока
        const eliminatedPlayer = gameState.players.find(p => p.name === data.eliminatedPlayer);
        const isMe = eliminatedPlayer && eliminatedPlayer.id === gameState.playerId;
        const displayName = isMe ? 'Вы' : data.eliminatedPlayer;
        
        showNotification('Игрок исключен', `${displayName} ${isMe ? 'были исключены' : 'был исключен'} из бункера!`);
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
    gameState.currentTurnPlayer = null;
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
    gameState.currentTurnPlayer = null;
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

// НОВАЯ функция для начала раунда
function startRound() {
    if (!gameState.isHost) {
        showNotification('Ошибка', 'Только хост может начать раунд');
        return;
    }
    
    // ДОБАВЛЕНО: немедленно скрываем кнопку для лучшего UX
    const roundActionsElement = document.getElementById('roundActions');
    if (roundActionsElement) {
        roundActionsElement.style.display = 'none';
    }
    
    console.log('🚀 Starting round...');
    socket.emit('start-round');
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
        const isMe = winner.id === gameState.playerId;
        
        // ИСПРАВЛЕНО: показываем правильные имена победителей
        li.textContent = isMe ? `${winner.name} (ВЫ)` : winner.name;
        li.className = 'host';
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
    gameState.currentTurnPlayer = data.currentTurnPlayer;
    
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
            const isMe = player.id === gameState.playerId;
            
            // ИСПРАВЛЕНО: показываем только настоящее имя
            li.textContent = `${player.name}${player.isHost ? ' 👑' : ''}`;
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
    
    updateHostControls();
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
    const gameActionsElement = document.getElementById('gameActions');
    
    if (currentRoundElement) {
        currentRoundElement.textContent = gameState.currentRound;
    }
    
    if (gameStatusElement) {
        gameStatusElement.textContent = getGameStatusText();
    }
    
    if (phaseDisplayElement) {
        phaseDisplayElement.textContent = getPhaseDisplayText();
    }
    
    // Обновляем кнопки действий в зависимости от фазы
    if (gameActionsElement) {
        updateGameActions();
    }
    
    updateTimerDisplay();
    updatePlayersGrid();
}

function getGameStatusText() {
    switch (gameState.gamePhase) {
        case 'preparation': 
            return 'Подготовка к раунду';
        case 'revelation': 
            const currentPlayer = gameState.players.find(p => p.id === gameState.currentTurnPlayer);
            if (currentPlayer) {
                const isMyTurn = currentPlayer.id === gameState.playerId;
                return `Ход игрока: ${isMyTurn ? 'Ваш ход' : currentPlayer.name}`;
            }
            return 'Раскрытие характеристик';
        case 'discussion': 
            return 'Фаза обсуждения';
        case 'voting': 
            return 'Фаза голосования';
        case 'results': 
            return 'Подведение итогов раунда';
        case 'finished': 
            return 'Игра завершена';
        default: 
            return 'Ожидание начала игры...';
    }
}

function getPhaseDisplayText() {
    switch (gameState.gamePhase) {
        case 'preparation': return 'ПОДГОТОВКА';
        case 'revelation': return 'РАСКРЫТИЕ';
        case 'discussion': return 'ОБСУЖДЕНИЕ';
        case 'voting': return 'ГОЛОСОВАНИЕ';
        case 'results': return 'РЕЗУЛЬТАТЫ';
        default: return 'ОЖИДАНИЕ';
    }
}

function updateGameActions() {
    const gameActionsElement = document.getElementById('gameActions');
    const roundActionsElement = document.getElementById('roundActions');
    
    // ИСПРАВЛЕНО: управляем кнопкой в верхней части
    if (roundActionsElement) {
        if (gameState.gamePhase === 'preparation' && gameState.isHost) {
            roundActionsElement.style.display = 'block';
        } else {
            roundActionsElement.style.display = 'none';
        }
    }
    
    // Управляем кнопками действий внизу (БЕЗ кнопки начала раунда)
    if (gameState.gamePhase === 'voting') {
        const alivePlayers = gameState.players.filter(p => p.isAlive);
        const votedPlayers = alivePlayers.filter(p => p.hasVoted);
        
        gameActionsElement.innerHTML = `
            <div class="vote-progress">
                <span id="voteProgress">Проголосовало: ${votedPlayers.length}/${alivePlayers.length}</span>
            </div>
        `;
    } else {
        gameActionsElement.innerHTML = `
            <button id="skipPhaseBtn" onclick="voteToSkip()" class="action-btn" disabled>⏭️ Пропустить фазу</button>
            <button id="showActionCardsBtn" onclick="showActionCard()" class="action-btn" disabled>🃏 Карты действий</button>
        `;
    }
}

function updateTimerDisplay() {
    const timerDisplay = document.getElementById('timerDisplay');
    if (timerDisplay) {
        if (gameState.timeLeft > 0) {
            const minutes = Math.floor(gameState.timeLeft / 60);
            const seconds = gameState.timeLeft % 60;
            timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        } else {
            timerDisplay.textContent = '0:00';
        }
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

function getPlayerDisplayName(player, isCurrentPlayer) {
    // Всегда возвращаем настоящее имя игрока
    return player.name;
}

function createPlayerCard(player) {
    const card = document.createElement('div');
    const isCurrentPlayer = player.id === gameState.playerId;
    const isCurrentTurn = player.id === gameState.currentTurnPlayer;
    
    card.className = `player-card ${player.isAlive ? '' : 'eliminated'} ${isCurrentPlayer ? 'current-player' : ''} ${isCurrentTurn ? 'current-turn' : ''}`;
    
    // ИСПРАВЛЕНО: порядок характеристик с двумя фактами внизу
    const characteristicOrder = ['profession', 'health', 'hobby', 'phobia', 'baggage', 'fact1', 'fact2'];
    
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
                    ${isCurrentPlayer ? '<div class="player-status current">ВЫ</div>' : ''}
                    ${isCurrentTurn ? '<div class="player-status turn">Ваш ход!</div>' : ''}
                </div>
            </div>
        </div>
        
        <div class="characteristics">
            ${characteristicOrder.map(key => {
                if (!player.characteristics[key]) return '';
                
                // ИСПРАВЛЕНО: логика раскрытия характеристик
                const isRevealed = player.revealedCharacteristics && player.revealedCharacteristics.includes(key);
                const isOwnCard = isCurrentPlayer;
                const canReveal = isCurrentTurn && !isRevealed && gameState.gamePhase === 'revelation';
                
                return `<div class="characteristic ${isRevealed ? 'revealed' : (isOwnCard ? 'own-hidden' : 'hidden')} ${canReveal ? 'clickable' : ''}" 
                    ${canReveal ? `onclick="confirmRevealCharacteristic('${key}')"` : ''}>
                    <span class="characteristic-name">${translateCharacteristic(key)}:</span>
                    <span class="characteristic-value ${isOwnCard && !isRevealed ? 'own-characteristic' : ''}">
                        ${isRevealed ? player.characteristics[key] : (isOwnCard ? player.characteristics[key] : '???')}
                    </span>
                    ${canReveal ? '<div class="reveal-hint">Нажмите для раскрытия</div>' : ''}
                </div>`;
            }).join('')}
        </div>
        
        <div class="player-actions">
            ${gameState.gamePhase === 'voting' && !isCurrentPlayer && player.isAlive && !player.hasVoted ? 
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
        fact1: 'Факт 1',
        fact2: 'Факт 2'
    };
    return translations[key] || key;
}

// НОВАЯ функция подтверждения раскрытия характеристики
function confirmRevealCharacteristic(characteristic) {
    const player = gameState.players.find(p => p.id === gameState.playerId);
    if (!player || !player.characteristics) return;
    
    const characteristicName = translateCharacteristic(characteristic);
    const characteristicValue = player.characteristics[characteristic];
    
    // Показываем модальное окно подтверждения
    document.getElementById('confirmCharacteristicName').textContent = characteristicName;
    document.getElementById('confirmCharacteristicValue').textContent = characteristicValue;
    document.getElementById('confirmRevealModal').style.display = 'flex';
    
    // Сохраняем характеристику для раскрытия
    window.characteristicToReveal = characteristic;
}

function confirmReveal() {
    if (window.characteristicToReveal) {
        socket.emit('reveal-characteristic', { characteristic: window.characteristicToReveal });
        document.getElementById('confirmRevealModal').style.display = 'none';
        window.characteristicToReveal = null;
    }
}

function cancelReveal() {
    document.getElementById('confirmRevealModal').style.display = 'none';
    window.characteristicToReveal = null;
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

// Функция голосования за игрока
function voteForPlayer(playerId) {
    if (gameState.gamePhase !== 'voting') {
        showNotification('Ошибка', 'Сейчас не время для голосования!');
        return;
    }
    
    if (gameState.myVote) {
        showNotification('Ошибка', 'Вы уже проголосовали!');
        return;
    }
    
    gameState.myVote = playerId;
    socket.emit('vote-player', { targetId: playerId });
    
    // Обновляем отображение кнопки
    updatePlayersGrid();
}

// Заглушки для других функций
function voteToSkip() {
    showNotification('Информация', 'Функция пропуска фазы пока не реализована');
}

function showActionCard() {
    showNotification('Информация', 'Карты действий пока не реализованы');
}

// Функции для модальных окон
function closeCharacteristicModal() {
    document.getElementById('characteristicModal').style.display = 'none';
}

function closeNotificationModal() {
    document.getElementById('notificationModal').style.display = 'none';
}

function showNotification(title, message) {
    document.getElementById('notificationTitle').textContent = title;
    document.getElementById('notificationMessage').textContent = message;
    document.getElementById('notificationModal').style.display = 'flex';
}

console.log('🎮 Bunker Game Client Loaded');