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
    currentTurnPlayer: null,
    currentJustifyingPlayer: null,
    canChangeVote: {},
    hasChangedVote: false,
    cardsRevealedThisRound: 0,
    requiredCardsThisRound: 1,
    skipDiscussionVotes: 0,
    mySkipVote: false
};

// Socket.IO подключение
const socket = io();

// === ОБРАБОТЧИКИ СОБЫТИЙ SOCKET.IO ===

socket.on('connect', function() {
    console.log('🌐 Connected to server');
});

socket.on('disconnect', function() {
    console.log('❌ Disconnected from server');
    showNotification('Соединение потеряно', 'Переподключение...');
});

socket.on('error', function(errorMessage) {
    console.error('❌ Server error:', errorMessage);
    showNotification('Ошибка сервера', errorMessage);
});

socket.on('room-state', function(data) {
    console.log('🏠 Room state received:', data);
    gameState.players = data.players || [];
    gameState.serverGameState = data.gameState || 'lobby';
    gameState.gamePhase = data.gamePhase || 'waiting';
    gameState.currentRound = data.currentRound || 1;
    gameState.timeLeft = data.timeLeft || 0;
    gameState.currentTurnPlayer = data.currentTurnPlayer || null;
    
    if (gameState.gamePhase !== 'login') {
        updateGameDisplay();
    }
});

socket.on('join-confirmed', function(data) {
    console.log('✅ Join confirmed:', data);
    gameState.playerId = data.playerId;
    gameState.playerName = data.playerName;
    gameState.isHost = data.isHost;
    gameState.maxPlayers = data.maxPlayers;
    gameState.gamePhase = 'lobby';
    updateGameDisplay();
});

socket.on('player-joined', function(data) {
    console.log('👋 Player joined:', data);
    gameState.players = data.players;
    gameState.maxPlayers = data.maxPlayers;
    updateGameDisplay();
    
    if (data.newPlayer !== gameState.playerName) {
        showNotification('Игрок присоединился', `${data.newPlayer} присоединился к игре`);
    }
});

socket.on('player-left', function(data) {
    console.log('👋 Player left:', data);
    gameState.players = data.players;
    gameState.serverGameState = data.gameState;
    updateGameDisplay();
    
    showNotification('Игрок покинул игру', `${data.leftPlayer} покинул игру`);
});

socket.on('max-players-changed', function(data) {
    console.log('🔧 Max players changed:', data);
    gameState.maxPlayers = data.maxPlayers;
    gameState.players = data.players;
    updateGameDisplay();
});

socket.on('game-started', function(data) {
    console.log('🚀 Game started:', data);
    gameState.players = data.players;
    gameState.serverGameState = data.gameState;
    gameState.gamePhase = data.gamePhase;
    gameState.currentRound = data.currentRound;
    gameState.timeLeft = data.timeLeft;
    updateGameDisplay();
    
    showNotification('Игра началась!', 'Характеристики розданы. Подготовьтесь к первому раунду.');
});

socket.on('phase-changed', function(data) {
    console.log('🔄 Phase changed:', data);
    gameState.gamePhase = data.gamePhase;
    gameState.timeLeft = data.timeLeft;
    gameState.players = data.players;
    gameState.currentTurnPlayer = data.currentTurnPlayer || null;
    gameState.currentRound = data.currentRound || gameState.currentRound;
    
    gameState.requiredCardsThisRound = getRequiredCardsForRound(gameState.currentRound);
    
    if (data.gamePhase !== 'discussion') {
        gameState.skipDiscussionVotes = 0;
        gameState.mySkipVote = false;
    }
    
    if (data.gamePhase !== 'voting') {
        gameState.myVote = null;
        gameState.hasChangedVote = false;
    }
    
    if (data.gamePhase === 'revelation') {
        gameState.cardsRevealedThisRound = 0;
    }
    
    updateGameDisplay();
});

socket.on('characteristic-revealed', function(data) {
    console.log('🔍 Characteristic revealed:', data);
    gameState.players = data.players;
    
    if (data.playerId === gameState.playerId) {
        gameState.cardsRevealedThisRound = data.cardsRevealedThisRound;
        gameState.requiredCardsThisRound = data.requiredCards;
    }
    
    updatePlayersGrid();
});

socket.on('timer-update', function(data) {
    gameState.timeLeft = data.timeLeft;
    gameState.currentTurnPlayer = data.currentTurnPlayer;
    updateTimerDisplay();
    
    if (gameState.gamePhase === 'revelation') {
        updateGameDisplay();
    }
});

socket.on('vote-update', function(data) {
    console.log('🗳️ Vote update:', data);
    gameState.players = data.players;
    gameState.votingResults = data.votingResults;
    gameState.canChangeVote = data.canChangeVote || {};
    updatePlayersGrid();
});

socket.on('justification-started', function(data) {
    console.log('⚖️ Justification started:', data);
    gameState.currentJustifyingPlayer = data.justifyingPlayer?.id;
    gameState.timeLeft = data.timeLeft;
    gameState.players = data.players;
    gameState.gamePhase = 'justification';
    updateGameDisplay();
});

socket.on('second-voting-started', function(data) {
    console.log('🗳️ Second voting started:', data);
    gameState.gamePhase = data.gamePhase;
    gameState.timeLeft = data.timeLeft;
    gameState.players = data.players;
    gameState.canChangeVote = data.canChangeVote || {};
    updateGameDisplay();
});

socket.on('skip-discussion-vote-update', function(data) {
    console.log('⏭️ Skip discussion vote update:', data);
    gameState.skipDiscussionVotes = data.votes;
    gameState.mySkipVote = data.hasVoted;
    updateGameDisplay();
});

socket.on('discussion-skipped', function(data) {
    console.log('⏭️ Discussion skipped:', data);
    gameState.gamePhase = data.gamePhase;
    gameState.timeLeft = data.timeLeft;
    gameState.players = data.players;
    updateGameDisplay();
    showNotification('Обсуждение пропущено', 'Переходим к голосованию');
});

socket.on('round-results', function(data) {
    console.log('📊 Round results:', data);
    gameState.players = data.players;
    gameState.votingResults = data.votingResults;
    updateGameDisplay();
    
    if (data.eliminatedPlayer) {
        showNotification('Игрок исключен', `${data.eliminatedPlayer} покидает бункер`);
    } else {
        showNotification('Ничья', 'Никто не был исключен в этом раунде');
    }
});

socket.on('new-round', function(data) {
    console.log('🔄 New round:', data);
    gameState.currentRound = data.currentRound;
    gameState.gamePhase = data.gamePhase;
    gameState.timeLeft = data.timeLeft;
    gameState.players = data.players;
    updateGameDisplay();
    
    showNotification(`Раунд ${data.currentRound}`, 'Новый раунд начинается!');
});

socket.on('game-ended', function(data) {
    console.log('🏁 Game ended:', data);
    gameState.players = data.players;
    gameState.gamePhase = 'finished';
    updateGameDisplay();
    
    const winners = data.winners.map(p => p.name).join(', ');
    showNotification('Игра завершена', `Победители: ${winners}`);
});

socket.on('game-reset', function(data) {
    console.log('🔄 Game reset:', data);
    gameState.players = data.players;
    gameState.serverGameState = data.gameState;
    gameState.gamePhase = 'lobby';
    gameState.currentRound = 1;
    gameState.timeLeft = 0;
    gameState.currentTurnPlayer = null;
    updateGameDisplay();
    
    showNotification('Игра сброшена', 'Возвращаемся в лобби');
});

socket.on('player-surrendered', function(data) {
    console.log('🏳️ Player surrendered:', data);
    gameState.players = data.players;
    updateGameDisplay();
    showNotification('Игрок сдался', `${data.surrenderedPlayer} покинул игру`);
});

// === ОСНОВНЫЕ ФУНКЦИИ ИГРЫ ===

function joinGame() {
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
    
    console.log('🎯 Joining game with name:', playerName);
    socket.emit('join-game', { playerName: playerName });
}

function startGame() {
    console.log('🚀 Starting game...');
    socket.emit('start-game');
}

function startRound() {
    console.log('🎯 Starting round...');
    socket.emit('start-round');
}

function getRequiredCardsForRound(round) {
    if (round === 1) {
        return 2; // Профессия + 1 карта на выбор
    } else {
        return 1; // 1 карта на выбор
    }
}

function getGameStatusText() {
    switch (gameState.gamePhase) {
        case 'preparation': 
            return 'Подготовка к раунду';
        case 'revelation': 
            const currentPlayer = gameState.players.find(p => p.id === gameState.currentTurnPlayer);
            if (currentPlayer) {
                const isMyTurn = currentPlayer.id === gameState.playerId;
                const requiredCards = getRequiredCardsForRound(gameState.currentRound);
                const revealedCards = currentPlayer.cardsRevealedThisRound || 0;
                
                if (isMyTurn) {
                    if (gameState.currentRound === 1) {
                        if (revealedCards === 0) {
                            return 'Ваш ход: Раскройте профессию';
                        } else if (revealedCards === 1) {
                            return 'Ваш ход: Выберите любую характеристику';
                        } else {
                            return 'Ваш ход завершен';
                        }
                    } else {
                        if (revealedCards === 0) {
                            return 'Ваш ход: Выберите любую характеристику';
                        } else {
                            return 'Ваш ход завершен';
                        }
                    }
                } else {
                    return `Ход игрока: ${currentPlayer.name} (${revealedCards}/${requiredCards})`;
                }
            }
            return 'Раскрытие характеристик';
        case 'discussion': 
            return 'Фаза обсуждения';
        case 'voting': 
            return 'Фаза голосования';
        case 'justification':
            const justifyingPlayer = gameState.players.find(p => p.id === gameState.currentJustifyingPlayer);
            if (justifyingPlayer) {
                const isMyJustification = justifyingPlayer.id === gameState.playerId;
                return `Оправдание: ${isMyJustification ? 'Ваш черед' : justifyingPlayer.name}`;
            }
            return 'Фаза оправдания';
        case 'results': 
            return 'Подведение итогов раунда';
        case 'finished': 
            return 'Игра завершена';
        default: 
            return 'Ожидание начала игры...';
    }
}

function getPhaseDisplayText() {
    const statusText = getGameStatusText();
    
    if (gameState.gamePhase === 'revelation' && gameState.currentTurnPlayer === gameState.playerId) {
        return `<span class="my-turn">${statusText}</span>`;
    }
    
    return statusText;
}

function updateGameDisplay() {
    const gameContainer = document.querySelector('.game-container');
    
    if (gameState.gamePhase === 'login') {
        gameContainer.innerHTML = `
            <div class="login-screen">
                <h2>🎭 Добро пожаловать в Бункер!</h2>
                <div class="login-form">
                    <input type="text" id="playerNameInput" placeholder="Введите ваше имя" maxlength="20" />
                    <button onclick="joinGame()" class="room-btn primary">Присоединиться к игре</button>
                </div>
            </div>
        `;
        
        const nameInput = document.getElementById('playerNameInput');
        if (nameInput) {
            nameInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    joinGame();
                }
            });
            nameInput.focus();
        }
        return;
    }
    
    gameContainer.innerHTML = `
        <div class="game-header">
            <h1>🎭 БУНКЕР</h1>
            <div class="game-info">
                <span class="game-info-item">👥 Игроков: ${gameState.players.length}/${gameState.maxPlayers}</span>
                <span class="game-info-item">🎯 Раунд: ${gameState.currentRound}</span>
                <span class="game-info-item" id="timerDisplay">⏱️ ${Math.floor(gameState.timeLeft / 60)}:${(gameState.timeLeft % 60).toString().padStart(2, '0')}</span>
            </div>
        </div>
        
        <div class="game-status">
            <h2>${getPhaseDisplayText()}</h2>
        </div>
        
        <div class="game-actions">
            ${updateGameActions()}
        </div>
        
        <div class="players-section">
            <h3>Игроки</h3>
            <div id="playersGrid" class="players-grid">
                <!-- Игроки будут добавлены динамически -->
            </div>
        </div>
    `;
    
    updatePlayersGrid();
    updateTimerDisplay();
}

function updateGameActions() {
    if (gameState.gamePhase === 'lobby') {
        let actions = '';
        
        if (gameState.isHost) {
            actions += `
                <button onclick="startGame()" class="room-btn primary">🚀 Начать игру</button>
                <div class="host-controls">
                    <label for="maxPlayersSelect">Максимум игроков:</label>
                    <select id="maxPlayersSelect" onchange="changeMaxPlayers()">
                        <option value="8" ${gameState.maxPlayers === 8 ? 'selected' : ''}>8 игроков</option>
                        <option value="12" ${gameState.maxPlayers === 12 ? 'selected' : ''}>12 игроков</option>
                        <option value="16" ${gameState.maxPlayers === 16 ? 'selected' : ''}>16 игроков</option>
                    </select>
                </div>
            `;
        }
        
        return actions;
    }
    
    if (gameState.gamePhase === 'preparation' && gameState.isHost) {
        return '<button onclick="startRound()" class="room-btn primary">▶️ Начать раунд</button>';
    }
    
    if (gameState.gamePhase === 'discussion') {
        const canSkip = !gameState.mySkipVote;
        const skipText = gameState.mySkipVote ? '✅ Проголосовано за пропуск' : '⏭️ Пропустить обсуждение';
        const skipClass = gameState.mySkipVote ? 'room-btn voted-skip' : 'room-btn secondary';
        
        return `
            <button onclick="voteToSkipDiscussion()" class="${skipClass}" ${!canSkip ? 'disabled' : ''}>
                ${skipText}
            </button>
            ${gameState.skipDiscussionVotes > 0 ? `
                <div class="skip-votes-info">
                    Голосов за пропуск: ${gameState.skipDiscussionVotes}/2
                </div>
            ` : ''}
        `;
    }
    
    if (gameState.gamePhase === 'justification') {
        const justifyingPlayer = gameState.players.find(p => p.id === gameState.currentJustifyingPlayer);
        if (justifyingPlayer && justifyingPlayer.id === gameState.playerId) {
            return `
                <div class="justification-actions">
                    <button onclick="finishJustification()" class="room-btn primary">✅ Завершить оправдание</button>
                    <button onclick="surrender()" class="room-btn danger">🏳️ Сдаться</button>
                </div>
            `;
        }
    }
    
    return '';
}

function updateTimerDisplay() {
    const timerElement = document.getElementById('timerDisplay');
    if (timerElement && gameState.timeLeft >= 0) {
        const minutes = Math.floor(gameState.timeLeft / 60);
        const seconds = gameState.timeLeft % 60;
        timerElement.textContent = `⏱️ ${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

function updatePlayersGrid() {
    const playersGrid = document.getElementById('playersGrid');
    
    if (!playersGrid) {
        console.error('❌ playersGrid element not found');
        return;
    }
    
    playersGrid.innerHTML = '';
    playersGrid.className = `players-grid players-${gameState.players.length}`;
    
    gameState.players.forEach(player => {
        const playerCard = createPlayerCard(player);
        playersGrid.appendChild(playerCard);
    });
    
    console.log('🎮 Players grid updated:', gameState.players.length, 'players');
}

function createPlayerCard(player) {
    const card = document.createElement('div');
    const isCurrentPlayer = player.id === gameState.playerId;
    const isCurrentTurn = player.id === gameState.currentTurnPlayer;
    const isJustifying = player.id === gameState.currentJustifyingPlayer;
    
    card.className = `player-card ${player.isAlive ? '' : 'eliminated'} ${isCurrentPlayer ? 'current-player' : ''} ${isCurrentTurn ? 'current-turn' : ''} ${isJustifying ? 'justifying' : ''}`;
    
    const characteristicOrder = ['profession', 'health', 'hobby', 'phobia', 'baggage', 'fact1', 'fact2'];
    
    let turnInfo = '';
    if (isCurrentTurn && gameState.gamePhase === 'revelation') {
        const requiredCards = getRequiredCardsForRound(gameState.currentRound);
        const revealedCards = player.cardsRevealedThisRound || 0;
        
        if (gameState.currentRound === 1) {
            if (revealedCards === 0) {
                turnInfo = '<div class="turn-info">📋 Раскройте профессию</div>';
            } else if (revealedCards === 1) {
                turnInfo = '<div class="turn-info">🎯 Выберите любую характеристику</div>';
            }
        } else {
            if (revealedCards === 0) {
                turnInfo = '<div class="turn-info">🎯 Выберите любую характеристику</div>';
            }
        }
    }
    
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
                    ${isJustifying ? '<div class="player-status justifying">🎤 Оправдывается</div>' : ''}
                    ${turnInfo}
                </div>
            </div>
        </div>
        
        <div class="characteristics">
            ${characteristicOrder.map(key => {
                if (!player.characteristics || !player.characteristics[key]) return '';
                
                const isRevealed = player.revealedCharacteristics && player.revealedCharacteristics.includes(key);
                const isOwnCard = isCurrentPlayer;
                
                let canReveal = false;
                if (isCurrentPlayer && isCurrentTurn && !isRevealed && gameState.gamePhase === 'revelation') {
                    const requiredCards = getRequiredCardsForRound(gameState.currentRound);
                    const revealedCards = player.cardsRevealedThisRound || 0;
                    
                    if (revealedCards < requiredCards) {
                        if (gameState.currentRound === 1) {
                            if (revealedCards === 0 && key === 'profession') {
                                canReveal = true;
                            } else if (revealedCards === 1 && key !== 'profession') {
                                canReveal = true;
                            }
                        } else {
                            canReveal = true;
                        }
                    }
                }
                
                return `<div class="characteristic ${isRevealed ? 'revealed' : (isOwnCard ? 'own-hidden' : 'hidden')} ${canReveal ? 'clickable' : ''}" 
                    ${canReveal ? `onclick="confirmRevealCharacteristic('${key}')"` : ''}>
                    <span class="characteristic-name">${translateCharacteristic(key)}:</span>
                    <span class="characteristic-value ${isOwnCard && !isRevealed ? 'own-characteristic' : ''}">
                        ${isRevealed ? player.characteristics[key] : (isOwnCard ? player.characteristics[key] : '???')}
                    </span>
                </div>`;
            }).join('')}
        </div>
        
        <div class="player-actions">
            ${gameState.gamePhase === 'voting' && !isCurrentPlayer && player.isAlive ? 
                getVotingButtons(player) : ''
            }
        </div>
    `;
    
    return card;
}

function confirmRevealCharacteristic(characteristic) {
    const player = gameState.players.find(p => p.id === gameState.playerId);
    if (!player || !player.characteristics) return;
    
    if (gameState.gamePhase !== 'revelation') {
        console.log('❌ Not revelation phase');
        return;
    }
    
    if (gameState.currentTurnPlayer !== gameState.playerId) {
        console.log('❌ Not my turn');
        return;
    }
    
    if (player.revealedCharacteristics && player.revealedCharacteristics.includes(characteristic)) {
        console.log('❌ Already revealed');
        return;
    }
    
    const requiredCards = getRequiredCardsForRound(gameState.currentRound);
    const revealedCards = player.cardsRevealedThisRound || 0;
    
    if (revealedCards >= requiredCards) {
        showNotification('Ошибка', 'Вы уже раскрыли максимальное количество карт в этом раунде!');
        return;
    }
    
    if (gameState.currentRound === 1 && revealedCards === 0 && characteristic !== 'profession') {
        showNotification('Ошибка', 'В первом раунде нужно сначала раскрыть профессию!');
        return;
    }
    
    const characteristicName = translateCharacteristic(characteristic);
    const characteristicValue = player.characteristics[characteristic];
    
    let progressInfo = '';
    if (gameState.currentRound === 1) {
        if (revealedCards === 0) {
            progressInfo = '(Обязательная карта: Профессия)';
        } else if (revealedCards === 1) {
            progressInfo = '(Карта на выбор)';
        }
    } else {
        progressInfo = '(Карта на выбор)';
    }
    
    document.getElementById('confirmCharacteristicName').textContent = characteristicName;
    document.getElementById('confirmCharacteristicValue').textContent = characteristicValue;
    
    const progressElement = document.getElementById('revealProgress');
    if (progressElement) {
        progressElement.textContent = progressInfo;
    }
    
    document.getElementById('confirmRevealModal').style.display = 'flex';
    window.characteristicToReveal = characteristic;
}

function confirmReveal() {
    if (window.characteristicToReveal) {
        console.log('🔍 Revealing characteristic:', window.characteristicToReveal);
        socket.emit('reveal-characteristic', { characteristic: window.characteristicToReveal });
        document.getElementById('confirmRevealModal').style.display = 'none';
        window.characteristicToReveal = null;
    }
}

function cancelReveal() {
    document.getElementById('confirmRevealModal').style.display = 'none';
    window.characteristicToReveal = null;
}

function translateCharacteristic(key) {
    const translations = {
        'profession': 'Профессия',
        'health': 'Здоровье',
        'hobby': 'Хобби',
        'phobia': 'Фобия',
        'baggage': 'Багаж',
        'fact1': 'Факт 1',
        'fact2': 'Факт 2'
    };
    
    return translations[key] || key;
}

function getVotingButtons(player) {
    const me = gameState.players.find(p => p.id === gameState.playerId);
    if (!me || !me.isAlive) return '';
    
    const hasVoted = me.hasVoted;
    const votedFor = me.votedFor;
    const canChange = gameState.canChangeVote[gameState.playerId] && !gameState.hasChangedVote;
    
    let buttonText = 'Голосовать';
    let buttonClass = 'vote-player-btn';
    let isDisabled = false;
    
    if (hasVoted) {
        if (votedFor === player.id) {
            if (canChange) {
                buttonText = 'Изменить голос';
                buttonClass = 'vote-player-btn change-vote';
                isDisabled = true;
            } else {
                buttonText = '✅ Проголосовано';
                buttonClass = 'vote-player-btn voted';
                isDisabled = true;
            }
        } else {
            if (canChange) {
                buttonText = 'Изменить на этого';
                buttonClass = 'vote-player-btn change-vote';
            } else {
                buttonText = 'Голосовать';
                buttonClass = 'vote-player-btn';
                isDisabled = true;
            }
        }
    }
    
    return `
        <div class="vote-section">
            <button class="${buttonClass}" 
                    onclick="voteForPlayer('${player.id}')" 
                    ${isDisabled ? 'disabled' : ''}>
                ${buttonText}
            </button>
        </div>
    `;
}

function voteForPlayer(targetId) {
    const me = gameState.players.find(p => p.id === gameState.playerId);
    if (!me || !me.isAlive) return;
    
    if (gameState.gamePhase !== 'voting') {
        showNotification('Ошибка', 'Сейчас не время для голосования!');
        return;
    }
    
    if (me.hasVoted && !gameState.canChangeVote[gameState.playerId]) {
        showNotification('Ошибка', 'Вы уже проголосовали!');
        return;
    }
    
    if (me.hasVoted && gameState.canChangeVote[gameState.playerId]) {
        console.log('🔄 Changing vote to:', targetId);
        socket.emit('change-vote', { targetId: targetId });
        gameState.hasChangedVote = true;
    } else {
        console.log('🗳️ Voting for:', targetId);
        socket.emit('vote-player', { targetId: targetId });
    }
}

function finishJustification() {
    console.log('✅ Finishing justification...');
    socket.emit('finish-justification');
}

function surrender() {
    if (confirm('Вы уверены, что хотите сдаться и покинуть игру?')) {
        console.log('🏳️ Surrendering...');
        socket.emit('surrender');
    }
}

function changeMaxPlayers() {
    const select = document.getElementById('maxPlayersSelect');
    const newMaxPlayers = parseInt(select.value);
    
    console.log('🔧 Changing max players to:', newMaxPlayers);
    socket.emit('change-max-players', { maxPlayers: newMaxPlayers });
}

function voteToSkipDiscussion() {
    if (gameState.gamePhase !== 'discussion') {
        showNotification('Ошибка', 'Сейчас не фаза обсуждения');
        return;
    }
    
    if (gameState.mySkipVote) {
        showNotification('Ошибка', 'Вы уже проголосовали за пропуск');
        return;
    }
    
    console.log('⏭️ Voting to skip discussion...');
    socket.emit('vote-skip-discussion');
}

function showNotification(title, message) {
    const modal = document.getElementById('notificationModal');
    const titleElement = document.getElementById('notificationTitle');
    const messageElement = document.getElementById('notificationMessage');
    
    if (modal && titleElement && messageElement) {
        titleElement.textContent = title;
        messageElement.textContent = message;
        modal.style.display = 'flex';
    } else {
        alert(`${title}: ${message}`);
    }
}

function closeNotificationModal() {
    const modal = document.getElementById('notificationModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

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

// НОВЫЕ обработчики для пропуска обсуждения
socket.on('skip-discussion-vote-update', function(data) {
    console.log('⏭️ Skip discussion vote update:', data);
    gameState.skipDiscussionVotes = data.votes;
    gameState.mySkipVote = data.hasVoted;
    updateGameActions();
});

socket.on('discussion-skipped', function(data) {
    console.log('⏭️ Discussion skipped:', data);
    gameState.gamePhase = data.gamePhase;
    gameState.timeLeft = data.timeLeft;
    gameState.players = data.players;
    gameState.skipDiscussionVotes = 0;
    gameState.mySkipVote = false;
    updateGameDisplay();
    showNotification('Обсуждение пропущено', 'Достаточно игроков проголосовало за пропуск обсуждения');
});

// ИСПРАВЛЕНО: сброс состояния голосования при смене фазы
socket.on('phase-changed', function(data) {
    console.log('🔄 Phase changed:', data);
    gameState.gamePhase = data.gamePhase;
    gameState.timeLeft = data.timeLeft;
    gameState.players = data.players;
    gameState.currentTurnPlayer = data.currentTurnPlayer || null;
    
    // ДОБАВЛЕНО: сброс голосования за пропуск при смене фазы
    if (data.gamePhase !== 'discussion') {
        gameState.skipDiscussionVotes = 0;
        gameState.mySkipVote = false;
    }
    
    // ДОБАВЛЕНО: сброс голосования за игроков при смене фазы
    if (data.gamePhase !== 'voting') {
        gameState.myVote = null;
        gameState.hasChangedVote = false;
    }
    
    updateGameDisplay();
});

// НОВЫЕ обработчики для фазы оправданий
socket.on('justification-started', function(data) {
    console.log('⚖️ Justification started:', data);
    gameState.gamePhase = 'justification';
    gameState.currentJustifyingPlayer = data.justifyingPlayer.id;
    gameState.timeLeft = data.timeLeft;
    gameState.players = data.players;
    updateGameDisplay();
    
    const isMyJustification = data.justifyingPlayer.id === gameState.playerId;
    const message = isMyJustification ? 
        'Ваше время для оправдания! У вас есть 2 минуты.' : 
        `${data.justifyingPlayer.name} оправдывается. Оставшихся в очереди: ${data.remainingQueue}`;
    
    showNotification('Фаза оправдания', message);
});

socket.on('second-voting-started', function(data) {
    console.log('🗳️ Second voting started:', data);
    gameState.gamePhase = data.gamePhase;
    gameState.timeLeft = data.timeLeft;
    gameState.players = data.players;
    gameState.canChangeVote = data.canChangeVote;
    gameState.hasChangedVote = false;
    updateGameDisplay();
    
    showNotification('Повторное голосование', 'Голоса остались прежними. Вы можете один раз сменить свой голос.');
});

socket.on('player-surrendered', function(data) {
    console.log('🏳️ Player surrendered:', data);
    gameState.players = data.players;
    updatePlayersGrid();
    
    const isMe = data.surrenderedPlayer === gameState.playerName;
    const message = isMe ? 'Вы сдались и покинули игру.' : `${data.surrenderedPlayer} сдался и покинул игру.`;
    
    showNotification('Игрок сдался', message);
});

function updateTimerDisplay() {
    const timerElement = document.getElementById('timerDisplay');
    if (timerElement && gameState.timeLeft >= 0) {
        const minutes = Math.floor(gameState.timeLeft / 60);
        const seconds = gameState.timeLeft % 60;
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

function updatePlayersGrid() {
    const playersGrid = document.getElementById('playersGrid');
    
    if (!playersGrid) {
        console.error('❌ playersGrid element not found');
        return;
    }
    
    // Очищаем сетку
    playersGrid.innerHTML = '';
    
    // Добавляем класс для адаптивной сетки
    playersGrid.className = `players-grid players-${gameState.players.length}`;
    
    // Создаем карточки игроков
    gameState.players.forEach(player => {
        const playerCard = createPlayerCard(player);
        playersGrid.appendChild(playerCard);
    });
    
    console.log('🎮 Players grid updated:', gameState.players.length, 'players');
}

// НОВАЯ функция для голосования за пропуск обсуждения
function voteToSkipDiscussion() {
    if (gameState.gamePhase !== 'discussion') {
        showNotification('Ошибка', 'Сейчас не фаза обсуждения');
        return;
    }
    
    if (gameState.mySkipVote) {
        showNotification('Ошибка', 'Вы уже проголосовали за пропуск');
        return;
    }
    
    console.log('⏭️ Voting to skip discussion...');
    socket.emit('vote-skip-discussion');
}

// Функция для показа уведомлений
function showNotification(title, message) {
    const modal = document.getElementById('notificationModal');
    const titleElement = document.getElementById('notificationTitle');
    const messageElement = document.getElementById('notificationMessage');
    
    if (modal && titleElement && messageElement) {
        titleElement.textContent = title;
        messageElement.textContent = message;
        modal.style.display = 'flex';
    } else {
        // Fallback: используем alert если модальное окно не найдено
        alert(`${title}: ${message}`);
    }
}

function closeNotificationModal() {
    const modal = document.getElementById('notificationModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// ДОБАВЛЯЕМ недостающие обработчики для раскрытия характеристик
socket.on('reveal-characteristic', function(data) {
    console.log('🔍 Revealing characteristic:', data);
    
    const player = gameState.players.find(p => p.id === gameState.playerId);
    if (!player) return;
    
    // Проверяем, что это наш ход
    if (gameState.currentTurnPlayer !== gameState.playerId) {
        showNotification('Ошибка', 'Сейчас не ваш ход!');
        return;
    }
    
    if (gameState.gamePhase !== 'revelation') {
        showNotification('Ошибка', 'Сейчас не фаза раскрытия!');
        return;
    }
    
    // Отправляем характеристику на сервер
    socket.emit('reveal-characteristic', data);
});

// ИСПРАВЛЯЕМ обработчик обновления таймера
socket.on('timer-update', function(data) {
    gameState.timeLeft = data.timeLeft;
    gameState.currentTurnPlayer = data.currentTurnPlayer;
    updateTimerDisplay();
    
    // Обновляем отображение хода игрока
    if (gameState.gamePhase === 'revelation') {
        updateGameDisplay();
    }
});

// ОБНОВЛЯЕМ обработчик смены фазы
socket.on('phase-changed', function(data) {
    console.log('🔄 Phase changed:', data);
    gameState.gamePhase = data.gamePhase;
    gameState.timeLeft = data.timeLeft;
    gameState.players = data.players;
    gameState.currentTurnPlayer = data.currentTurnPlayer || null;
    
    // ДОБАВЛЕНО: сброс голосования за пропуск при смене фазы
    if (data.gamePhase !== 'discussion') {
        gameState.skipDiscussionVotes = 0;
        gameState.mySkipVote = false;
    }
    
    // ДОБАВЛЕНО: сброс голосования за игроков при смене фазы
    if (data.gamePhase !== 'voting') {
        gameState.myVote = null;
        gameState.hasChangedVote = false;
    }
    
    updateGameDisplay();
});