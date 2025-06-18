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
    currentStory: null,
    isSecondVoting: false
};

// Socket.IO подключение
const socket = io({
    transports: ['websocket', 'polling'],
    timeout: 10000,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000
});

// === ОСНОВНЫЕ ФУНКЦИИ ===

function joinGame() {
    console.log('🎯 joinGame function called');
    
    const nameInput = document.getElementById('playerNameInput');
    const joinBtn = document.getElementById('joinGameBtn');
    
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
    
    console.log('🎯 Joining game with name:', playerName);
    
    if (joinBtn) {
        joinBtn.disabled = true;
        joinBtn.textContent = 'Подключение...';
    }
    
    socket.emit('join-game', { playerName: playerName });
    
    setTimeout(() => {
        if (joinBtn && joinBtn.disabled) {
            joinBtn.disabled = false;
            joinBtn.textContent = 'Присоединиться к игре';
        }
    }, 5000);
}

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

function startRound() {
    if (gameState.myStartRoundVote) {
        showNotification('Голос уже учтен', 'Вы уже проголосовали за начало раунда');
        return;
    }
    
    console.log('🎯 Voting to start round');
    socket.emit('start-round');
}

function changeMaxPlayers() {
    const select = document.getElementById('maxPlayersSelect');
    const newMaxPlayers = parseInt(select.value);
    
    console.log('🔧 Changing max players to:', newMaxPlayers);
    socket.emit('change-max-players', { maxPlayers: newMaxPlayers });
}

function getRequiredCardsForRound(round) {
    if (round === 1) {
        return 2; // Профессия + 1 карта на выбор
    } else {
        return 1; // 1 карта на выбор
    }
}

function voteForPlayer(playerId) {
    console.log('🗳️ Voting for player:', playerId);
    
    if (gameState.gamePhase !== 'voting') {
        showNotification('Ошибка', 'Сейчас не время для голосования!');
        return;
    }
    
    const me = gameState.players.find(p => p.id === gameState.playerId);
    if (!me || !me.isAlive) {
        showNotification('Ошибка', 'Вы не можете голосовать!');
        return;
    }
    
    if (me.hasVoted && !gameState.canChangeVote[gameState.playerId]) {
        showNotification('Ошибка', 'Вы уже проголосовали!');
        return;
    }
    
    if (me.hasVoted && gameState.canChangeVote[gameState.playerId] && gameState.isSecondVoting) {
        socket.emit('change-vote', { targetId: playerId });
        gameState.hasChangedVote = true;
    } else {
        socket.emit('vote-player', { targetId: playerId });
    }
}

function voteToSkipDiscussion() {
    console.log('⏭️ Voting to skip discussion');
    socket.emit('vote-skip-discussion');
}

function finishJustification() {
    console.log('✅ Finishing justification');
    socket.emit('finish-justification');
}

function surrender() {
    if (confirm('Вы уверены, что хотите сдаться? Это действие нельзя отменить.')) {
        console.log('🏳️ Surrendering');
        socket.emit('surrender');
    }
}

function confirmRevealCharacteristic(characteristic) {
    const me = gameState.players.find(p => p.id === gameState.playerId);
    if (!me || !me.characteristics || !me.characteristics[characteristic]) {
        return;
    }
    
    document.getElementById('confirmCharacteristicName').textContent = translateCharacteristic(characteristic);
    document.getElementById('confirmCharacteristicValue').textContent = me.characteristics[characteristic];
    
    const requiredCards = getRequiredCardsForRound(gameState.currentRound);
    const revealedCards = me.cardsRevealedThisRound || 0;
    const progressElement = document.getElementById('revealProgress');
    
    if (progressElement) {
        progressElement.textContent = `Карт раскрыто в этом раунде: ${revealedCards}/${requiredCards}`;
    }
    
    window.currentCharacteristic = characteristic;
    document.getElementById('confirmRevealModal').style.display = 'flex';
}

function confirmReveal() {
    if (window.currentCharacteristic) {
        socket.emit('reveal-characteristic', { characteristic: window.currentCharacteristic });
        document.getElementById('confirmRevealModal').style.display = 'none';
        window.currentCharacteristic = null;
    }
}

function cancelReveal() {
    document.getElementById('confirmRevealModal').style.display = 'none';
    window.currentCharacteristic = null;
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

function showNotification(title, message) {
    document.getElementById('notificationTitle').textContent = title;
    document.getElementById('notificationMessage').textContent = message;
    document.getElementById('notificationModal').style.display = 'flex';
}

function closeNotificationModal() {
    document.getElementById('notificationModal').style.display = 'none';
}

// === ФУНКЦИИ ОТОБРАЖЕНИЯ ===

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

function showLoginScreen() {
    console.log('📱 Showing login screen');
    showScreen('loginScreen');
    
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
    console.log('🎮 Game state:', {
        phase: gameState.gamePhase,
        players: gameState.players.length,
        playerId: gameState.playerId
    });
    
    showScreen('gameScreen');
    updateGameDisplay();
}

function updateLobbyDisplay() {
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
    
    if (playersList) {
        playersList.innerHTML = '';
        gameState.players.forEach(player => {
            const li = document.createElement('li');
            li.className = player.isHost ? 'host' : '';
            li.textContent = `${player.name}${player.isHost ? ' (Хост)' : ''}`;
            playersList.appendChild(li);
        });
    }
    
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

function updateGameDisplay() {
    console.log('🎮 Updating game display. Phase:', gameState.gamePhase, 'Players:', gameState.players.length);
    
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
    
    // Обновляем историю
    if (gameState.currentStory) {
        const storyText = document.getElementById('storyText');
        if (storyText) {
            storyText.textContent = gameState.currentStory;
        }
    }
    
    updateRoundActions();
    updatePlayersGrid();
    updateTimerDisplay();
    
    console.log('✅ Game display updated');
}

function updateRoundActions() {
    console.log('🎯 Updating round actions. Phase:', gameState.gamePhase, 'My ID:', gameState.playerId);
    
    const roundActions = document.getElementById('roundActions');
    const startRoundBtn = document.getElementById('startRoundBtn');
    const skipDiscussionBtn = document.getElementById('skipDiscussionBtn');
    const finishJustificationBtn = document.getElementById('finishJustificationBtn');
    const surrenderBtn = document.getElementById('surrenderBtn');
    
    if (!roundActions) {
        console.error('❌ roundActions element not found');
        return;
    }
    
    if (startRoundBtn) startRoundBtn.style.display = 'none';
    if (skipDiscussionBtn) skipDiscussionBtn.style.display = 'none';
    if (finishJustificationBtn) finishJustificationBtn.style.display = 'none';
    if (surrenderBtn) surrenderBtn.style.display = 'none';
    
    const isMyTurn = gameState.currentTurnPlayer === gameState.playerId;
    const isMyJustification = gameState.currentJustifyingPlayer === gameState.playerId;
    const alivePlayers = gameState.players.filter(p => p.isAlive);
    const amAlive = alivePlayers.some(p => p.id === gameState.playerId);
    
    let hasVisibleButtons = false;
    
    console.log('🎯 Phase check:', {
        phase: gameState.gamePhase,
        amAlive: amAlive,
        playerId: gameState.playerId,
        alivePlayers: alivePlayers.length
    });
    
    switch (gameState.gamePhase) {
        case 'preparation':
            if (startRoundBtn && amAlive) {
                startRoundBtn.style.display = 'block';
                hasVisibleButtons = true;
                
                const requiredVotes = 2;
                const currentVotes = gameState.startRoundVotes || 0;
                
                if (gameState.myStartRoundVote) {
                    startRoundBtn.textContent = `🎯 Проголосовали (${currentVotes}/${requiredVotes})`;
                    startRoundBtn.disabled = true;
                    startRoundBtn.classList.add('voted-skip');
                } else {
                    startRoundBtn.textContent = `🚀 Начать раунд (${currentVotes}/${requiredVotes})`;
                    startRoundBtn.disabled = false;
                    startRoundBtn.classList.remove('voted-skip');
                }
                
                console.log('✅ Start round button shown');
            }
            break;
            
        case 'discussion':
            if (skipDiscussionBtn && amAlive) {
                skipDiscussionBtn.style.display = 'block';
                hasVisibleButtons = true;
                
                const skipVotesCount = document.getElementById('skipVotesCount');
                if (skipVotesCount) {
                    skipVotesCount.textContent = gameState.skipDiscussionVotes || 0;
                }
                
                if (gameState.mySkipVote) {
                    skipDiscussionBtn.classList.add('voted-skip');
                    skipDiscussionBtn.disabled = true;
                } else {
                    skipDiscussionBtn.classList.remove('voted-skip');
                    skipDiscussionBtn.disabled = false;
                }
            }
            break;
            
        case 'justification':
            if (isMyJustification) {
                if (finishJustificationBtn) {
                    finishJustificationBtn.style.display = 'block';
                    hasVisibleButtons = true;
                }
                if (surrenderBtn) {
                    surrenderBtn.style.display = 'block';
                    hasVisibleButtons = true;
                }
            }
            break;
    }
    
    roundActions.style.display = hasVisibleButtons ? 'flex' : 'none';
    
    console.log('🎯 Round actions updated. Visible:', hasVisibleButtons);
}

function getGameStatusText() {
    const isSpecialRound = gameState.players.some(p => p.willEliminateTopVotersThisRound);
    const specialPrefix = isSpecialRound ? '⚠️ СПЕЦИАЛЬНЫЙ РАУНД: ' : '';
    
    switch (gameState.gamePhase) {
        case 'preparation': 
            return specialPrefix + 'Подготовка к раунду';
        case 'revelation': 
            const currentPlayer = gameState.players.find(p => p.id === gameState.currentTurnPlayer);
            if (currentPlayer) {
                const isMyTurn = currentPlayer.id === gameState.playerId;
                const requiredCards = getRequiredCardsForRound(gameState.currentRound);
                const revealedCards = currentPlayer.cardsRevealedThisRound || 0;
                
                if (isMyTurn) {
                    if (gameState.currentRound === 1) {
                        if (revealedCards === 0) {
                            return specialPrefix + 'Ваш ход: Раскройте профессию';
                        } else if (revealedCards === 1) {
                            return specialPrefix + 'Ваш ход: Выберите любую характеристику';
                        } else {
                            return specialPrefix + 'Ваш ход завершен';
                        }
                    } else {
                        if (revealedCards === 0) {
                            return specialPrefix + 'Ваш ход: Выберите любую характеристику';
                        } else {
                            return specialPrefix + 'Ваш ход завершен';
                        }
                    }
                } else {
                    return specialPrefix + `Ход игрока: ${currentPlayer.name}`;
                }
            }
            return specialPrefix + 'Раскрытие характеристик';
        case 'discussion': 
            return specialPrefix + 'Фаза обсуждения';
        case 'voting': 
            if (gameState.isSecondVoting) {
                return specialPrefix + 'Повторное голосование';
            }
            return specialPrefix + 'Фаза голосования';
        case 'justification':
            const justifyingPlayer = gameState.players.find(p => p.id === gameState.currentJustifyingPlayer);
            if (justifyingPlayer) {
                const isMyJustification = justifyingPlayer.id === gameState.playerId;
                return specialPrefix + `Оправдание: ${isMyJustification ? 'Ваш черед' : justifyingPlayer.name}`;
            }
            return specialPrefix + 'Фаза оправдания';
        case 'results': 
            return specialPrefix + 'Подведение итогов раунда';
        case 'finished': 
            return 'Игра завершена';
        default: 
            return 'Ожидание начала игры...';
    }
}

function getPhaseDisplayText() {
    const statusText = getGameStatusText();
    
    if (gameState.gamePhase === 'revelation' && gameState.currentTurnPlayer === gameState.playerId) {
        return `${statusText}`;
    }
    
    return statusText;
}

function updateTimerDisplay() {
    const timerElement = document.getElementById('timerDisplay');
    if (timerElement && gameState.timeLeft >= 0) {
        const minutes = Math.floor(gameState.timeLeft / 60);
        const seconds = gameState.timeLeft % 60;
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

function updatePlayersGrid() {
    console.log('🎮 Updating players grid. Players:', gameState.players.length);
    
    const playersGrid = document.getElementById('playersGrid');
    
    if (!playersGrid) {
        console.error('❌ playersGrid element not found');
        return;
    }

    if (!gameState.players || gameState.players.length === 0) {
        console.log('⚠️ No players to display');
        playersGrid.innerHTML = '<div style="color: #ecf0f1; text-align: center; padding: 20px;">Нет игроков для отображения</div>';
        playersGrid.style.display = 'block';
        return;
    }

    let maxVotes = 0;
    if (gameState.gamePhase === 'voting' || gameState.gamePhase === 'justification' || gameState.gamePhase === 'results') {
        const alivePlayers = gameState.players.filter(p => p.isAlive);
        maxVotes = Math.max(...alivePlayers.map(p => p.votes || 0));
    }
    
    playersGrid.innerHTML = '';
    playersGrid.className = `players-grid players-${gameState.players.length}`;
    playersGrid.style.display = 'grid';
    
    gameState.players.forEach(player => {
        const playerCard = createPlayerCard(player);
        
        if (player.isAlive && (player.votes || 0) === maxVotes && maxVotes > 0) {
            playerCard.classList.add('most-voted');
        }
        
        playersGrid.appendChild(playerCard);
    });
    
    console.log('✅ Players grid updated:', gameState.players.length, 'players');
}

function createPlayerCard(player) {
    const card = document.createElement('div');
    const isCurrentPlayer = player.id === gameState.playerId;
    const isCurrentTurn = player.id === gameState.currentTurnPlayer;
    const isJustifying = player.id === gameState.currentJustifyingPlayer;
    
    const hasDoubleVote = player.activeEffects && player.activeEffects.doubleVote;
    
    card.className = `player-card ${player.isAlive ? '' : 'eliminated'} ${isCurrentPlayer ? 'current-player' : ''} ${isCurrentTurn ? 'current-turn' : ''} ${isJustifying ? 'justifying' : ''} ${hasDoubleVote ? 'double-vote' : ''}`;
    
    const characteristicOrder = ['profession', 'health', 'hobby', 'phobia', 'baggage', 'fact1', 'fact2'];
    
    let turnInfo = '';
    if (isCurrentTurn && gameState.gamePhase === 'revelation' && isCurrentPlayer) {
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

    let votingInfo = '';
    if (gameState.gamePhase === 'voting' || gameState.gamePhase === 'justification' || gameState.gamePhase === 'results') {
        const votesForPlayer = player.votes || 0;
        if (votesForPlayer > 0) {
            const votersForThisPlayer = getVotersForPlayer(player.id);
            votingInfo = `
                <div class="voting-info">
                    <div class="votes-count">Голосов: ${votesForPlayer}</div>
                    ${votersForThisPlayer.length > 0 ? `
                        <div class="voters-list">
                            Проголосовали: ${votersForThisPlayer.join(', ')}
                        </div>
                    ` : ''}
                </div>
            `;
        } else if (player.isAlive) {
            votingInfo = '<div class="voting-info"><div class="votes-count">Голосов: 0</div></div>';
        }
        
        if (player.isAlive && player.hasVoted && player.votedFor) {
            const votedForPlayer = gameState.players.find(p => p.id === player.votedFor);
            if (votedForPlayer) {
                votingInfo += `
                    <div class="voted-for-info">
                        ${isCurrentPlayer ? 'Вы проголосовали' : player.name + ' проголосовал'} за: 
                        <strong class="voted-target">${votedForPlayer.name}</strong>
                    </div>
                `;
            }
        } else if (player.isAlive && gameState.gamePhase === 'voting') {
            votingInfo += `
                <div class="voted-for-info not-voted">
                    ${isCurrentPlayer ? 'Вы еще не проголосовали' : player.name + ' еще не проголосовал'}
                </div>
            `;
        }
    }

    let actionCardIndicator = '';
    if (player.actionCards && player.actionCards.length > 0) {
        const actionCard = player.actionCards[0];
        const canUse = actionCard.usesLeft > 0;
        const isOwner = isCurrentPlayer;
        
        const indicatorClass = `action-card-indicator ${!canUse ? 'used' : ''} ${!isOwner ? 'not-owner' : ''}`;
        const clickHandler = isOwner && canUse ? `onclick="showActionCard('${actionCard.id}')"` : '';
        
        actionCardIndicator = `
            <div class="${indicatorClass}" ${clickHandler} title="${actionCard.name}">
            </div>
        `;
    }
    
    card.innerHTML = `
        <div class="player-header">
            <div class="player-info">
                <div class="player-avatar-container">
                    <div class="player-avatar ${player.isAlive ? '' : 'eliminated-avatar'}">
                        ${player.name.charAt(0).toUpperCase()}
                    </div>
                    ${actionCardIndicator}
                    ${hasDoubleVote ? '<div class="double-vote-indicator">🗳️×2</div>' : ''}
                </div>
                <div>
                    <div class="player-name ${player.isAlive ? '' : 'eliminated-name'}">
                        ${player.name}${player.isHost ? ' 👑' : ''}
                    </div>
                    ${isCurrentPlayer ? '<div class="player-status current">ВЫ</div>' : ''}
                    ${isCurrentTurn ? '<div class="player-status turn">Ваш ход!</div>' : ''}
                    ${isJustifying ? '<div class="player-status justifying">🎤 Оправдывается</div>' : ''}
                    ${turnInfo}
                    ${votingInfo}
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
                </div>`;}
            ).join('')}
        </div>
        
        <div class="player-actions">
            ${gameState.gamePhase === 'voting' && !isCurrentPlayer && player.isAlive ? 
                getVotingButtons(player) : ''
            }
        </div>
    `;
    
    return card;
}

function getVotersForPlayer(playerId) {
    if (!gameState.votingResults || !gameState.votingResults[playerId]) {
        return [];
    }
    
    return gameState.votingResults[playerId].map(voterId => {
        const voter = gameState.players.find(p => p.id === voterId);
        return voter ? voter.name : 'Неизвестный';
    });
}

function getVotingButtons(player) {
    const me = gameState.players.find(p => p.id === gameState.playerId);
    if (!me || !me.isAlive) return '';
    
    const hasVoted = me.hasVoted;
    const votedFor = me.votedFor;
    const canChange = gameState.canChangeVote[gameState.playerId] && !gameState.hasChangedVote && gameState.isSecondVoting;
    
    let buttonText = 'Голосовать';
    let buttonClass = 'vote-player-btn';
    let isDisabled = false;
    
    if (hasVoted) {
        if (votedFor === player.id) {
            if (canChange) {
                buttonText = 'Изменить голос';
                buttonClass = 'vote-player-btn change-vote';
                isDisabled = false;
            } else {
                buttonText = '✅ Проголосовано';
                buttonClass = 'vote-player-btn voted';
                isDisabled = true;
            }
        } else {
            if (canChange) {
                buttonText = 'Изменить на этого';
                buttonClass = 'vote-player-btn change-vote';
                isDisabled = false;
            } else {
                buttonText = 'Голосовать';
                buttonClass = 'vote-player-btn';
                isDisabled = true;
            }
        }
    }

    const currentVotes = player.votes || 0;
    if (currentVotes > 0) {
        buttonText += ` (${currentVotes})`;
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

// === ОБРАБОТЧИКИ СОБЫТИЙ SOCKET.IO ===

socket.on('connect', function() {
    console.log('🌐 Connected to server');
    console.log('🔗 Socket ID:', socket.id);
    
    showLoginScreen();
    
    const joinBtn = document.getElementById('joinGameBtn');
    if (joinBtn && joinBtn.disabled) {
        joinBtn.disabled = false;
        joinBtn.textContent = 'Присоединиться к игре';
    }
});

socket.on('connect_error', function(error) {
    console.error('❌ Connection error:', error);
    showNotification('Ошибка', 'Ошибка подключения к серверу. Проверьте интернет-соединение.');
});

socket.on('disconnect', function(reason) {
    console.log('❌ Disconnected from server:', reason);
    showNotification('Соединение', 'Соединение потеряно. Попытка переподключения...');
});

socket.on('error', function(errorMessage) {
    console.error('❌ Server error:', errorMessage);
    
    const joinBtn = document.getElementById('joinGameBtn');
    if (joinBtn) {
        joinBtn.disabled = false;
        joinBtn.textContent = 'Присоединиться к игре';
    }
    
    showNotification('Ошибка', errorMessage);
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
    gameState.players = data.players;
    gameState.gamePhase = 'lobby';
    showLobbyScreen();
});

socket.on('player-joined', function(data) {
    console.log('👋 Player joined:', data);
    gameState.players = data.players;
    gameState.maxPlayers = data.maxPlayers;
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
    gameState.currentStory = data.story;
    
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
    gameState.currentStory = null;
    gameState.isSecondVoting = false;
    showLobbyScreen();
});

socket.on('phase-changed', function(data) {
    console.log('🔄 Phase changed:', data);
    gameState.gamePhase = data.gamePhase;
    gameState.timeLeft = data.timeLeft;
    gameState.players = data.players;
    gameState.currentTurnPlayer = data.currentTurnPlayer || null;
    gameState.currentRound = data.currentRound || gameState.currentRound;
    gameState.isSecondVoting = data.isSecondVoting || false;
    
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
    gameState.isSecondVoting = data.isSecondVoting || false;
    
    if (data.isSecondVoting) {
        showNotification('Второе голосование', 'Игроки оправдались. Голосуйте повторно среди них.');
    }
    
    updateGameDisplay();
});

socket.on('skip-discussion-vote-update', function(data) {
    console.log('⏭️ Skip discussion vote update:', data);
    gameState.skipDiscussionVotes = data.votes;
    gameState.mySkipVote = data.hasVoted;
    
    updateRoundActions();
});

socket.on('discussion-skipped', function(data) {
    console.log('⏭️ Discussion skipped:', data);
    gameState.gamePhase = data.gamePhase;
    gameState.timeLeft = data.timeLeft;
    gameState.players = data.players;
    gameState.skipDiscussionVotes = 0;
    gameState.mySkipVote = false;
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
    } else if (data.resultMessage) {
        if (data.willEliminateTopVotersNextRound) {
            showNotification('⚠️ Специальный раунд', data.resultMessage);
        } else {
            showNotification('Результат раунда', data.resultMessage);
        }
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
    gameState.startRoundVotes = 0;
    gameState.myStartRoundVote = false;
    
    if (data.willEliminateTopVotersThisRound) {
        showNotification('⚠️ Специальный раунд', 'В этом раунде будут исключены 2 игрока с наибольшими голосами!');
    }
    
    updateGameDisplay();
});

socket.on('start-round-vote-update', function(data) {
    console.log('🎯 Start round vote update:', data);
    gameState.startRoundVotes = data.votes;
    gameState.myStartRoundVote = data.hasVoted;
    updateRoundActions();
});

socket.on('game-ended', function(data) {
    console.log('🏁 Game ended:', data);
    
    let message = 'Игра завершена!\n\nПобедители:\n';
    data.winners.forEach(winner => {
        message += `• ${winner.name}\n`;
    });
    
    showNotification('Игра завершена', message);
});

// === ИНИЦИАЛИЗАЦИЯ ===

document.addEventListener('DOMContentLoaded', function() {
    console.log('📱 DOM loaded, initializing...');
    
    showLoginScreen();
    
    const playerNameInput = document.getElementById('playerNameInput');
    if (playerNameInput) {
        playerNameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                joinGame();
            }
        });
    }
    
    const joinGameBtn = document.getElementById('joinGameBtn');
    if (joinGameBtn) {
        joinGameBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('🎯 Join button clicked');
            joinGame();
        });
    }
    
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
});

console.log('🎮 Bunker Game Client Loaded');