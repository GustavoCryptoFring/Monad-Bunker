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
    startRoundVotes: 0,      // ДОБАВЛЯЕМ: количество голосов за начало раунда
    myStartRoundVote: false  // ДОБАВЛЯЕМ: проголосовал ли я за начало раунда
};

// Socket.IO подключение
const socket = io({
    transports: ['websocket', 'polling'], // Добавляем fallback транспорты
    timeout: 10000, // Таймаут подключения 10 секунд
    reconnection: true, // Автоматическое переподключение
    reconnectionAttempts: 10, // Максимум попыток
    reconnectionDelay: 1000 // Задержка между попытками
});

// === ОБРАБОТЧИКИ СОБЫТИЙ SOCKET.IO ===

socket.on('connect', function() {
    console.log('🌐 Connected to server');
    console.log('🔗 Socket ID:', socket.id);
    
    // При подключении показываем экран входа
    showLoginScreen();
    
    // Скрываем сообщение о потере соединения если оно есть
    const connectionError = document.getElementById('connectionError');
    if (connectionError) {
        connectionError.style.display = 'none';
    }
});

socket.on('connect_error', function(error) {
    console.error('❌ Connection error:', error);
    showConnectionError('Ошибка подключения к серверу. Проверьте интернет-соединение.');
});

socket.on('disconnect', function(reason) {
    console.log('❌ Disconnected from server:', reason);
    showConnectionError('Соединение потеряно. Попытка переподключения...');
});

socket.on('reconnect', function(attemptNumber) {
    console.log('🔄 Reconnected after', attemptNumber, 'attempts');
    showNotification('Подключение восстановлено', 'Соединение с сервером восстановлено');
});

socket.on('reconnect_error', function(error) {
    console.error('❌ Reconnection error:', error);
    showConnectionError('Не удается восстановить соединение. Перезагрузите страницу.');
});

socket.on('room-state', function(data) {
    console.log('🏠 Room state received:', data);
    gameState.players = data.players || [];
    gameState.serverGameState = data.gameState || 'lobby';
    gameState.gamePhase = data.gamePhase || 'waiting';
    gameState.currentRound = data.currentRound || 1;
    gameState.timeLeft = data.timeLeft || 0;
    gameState.currentTurnPlayer = data.currentTurnPlayer || null;
    gameState.maxPlayers = data.maxPlayers || 8;
    gameState.startRoundVotes = data.startRoundVotes || 0; // ДОБАВЛЯЕМ
    
    // Если мы уже в игре, показываем соответствующий экран
    if (gameState.playerId && gameState.serverGameState === 'lobby') {
        showLobbyScreen();
    } else if (gameState.playerId && gameState.serverGameState === 'playing') {
        showGameScreen();
    }
});

socket.on('join-confirmed', function(data) {
    console.log('✅ Join confirmed:', data);
    
    // ДОБАВЛЕНО: Разблокируем кнопку
    const joinBtn = document.getElementById('joinGameBtn');
    if (joinBtn) {
        joinBtn.disabled = false;
        joinBtn.textContent = 'Присоединиться к игре';
    }
    
    gameState.playerId = data.playerId;
    gameState.playerName = data.playerName;
    gameState.isHost = data.isHost;
    gameState.maxPlayers = data.maxPlayers;
    gameState.startRoundVotes = data.startRoundVotes || 0; // ДОБАВЛЯЕМ
    gameState.gamePhase = 'lobby';
    showLobbyScreen();
});

socket.on('player-joined', function(data) {
    console.log('👋 Player joined:', data);
    gameState.players = data.players;
    gameState.maxPlayers = data.maxPlayers;
    gameState.startRoundVotes = data.startRoundVotes || 0; // ДОБАВЛЯЕМ
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
    gameState.startRoundVotes = 0;      // ДОБАВЛЯЕМ: сброс голосов
    gameState.myStartRoundVote = false; // ДОБАВЛЯЕМ: сброс моего голоса
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
    showLobbyScreen();
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
    
    // ОБНОВЛЯЕМ кнопку в верхней части
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
    gameState.startRoundVotes = 0;      // ДОБАВЛЯЕМ: сброс голосов
    gameState.myStartRoundVote = false; // ДОБАВЛЯЕМ: сброс моего голоса
    updateGameDisplay();
});

socket.on('game-ended', function(data) {
    console.log('🏁 Game ended:', data);
    gameState.players = data.players;
    gameState.gamePhase = 'finished';
    updateGameDisplay();
    
    const winners = data.winners.map(p => p.name).join(', ');
    showNotification('Игра завершена', `Победители: ${winners}`);
});

socket.on('player-surrendered', function(data) {
    console.log('🏳️ Player surrendered:', data);
    gameState.players = data.players;
    updatePlayersGrid();
    
    const isMe = data.surrenderedPlayer === gameState.playerName;
    const message = isMe ? 'Вы сдались и покинули игру.' : `${data.surrenderedPlayer} сдался и покинул игру.`;
    
    showNotification('Игрок сдался', message);
});

// Добавляем обработчик голосования за начало раунда
socket.on('start-round-vote-update', function(data) {
    console.log('🎯 Start round vote update:', data);
    gameState.startRoundVotes = data.votes;
    gameState.myStartRoundVote = data.hasVoted;
    updateRoundActions();
});

// === ФУНКЦИИ ОТОБРАЖЕНИЯ ЭКРАНОВ ===

function showScreen(screenId) {
    // Скрываем все экраны
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
        screen.style.display = 'none';
    });
    
    // Показываем нужный экран
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.style.display = 'block';
    }
}

function showLoginScreen() {
    console.log('📱 Showing login screen');
    showScreen('loginScreen');
    
    // Устанавливаем фокус на поле ввода имени
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

function showResultsScreen() {
    console.log('📱 Showing results screen');
    showScreen('resultsScreen');
}

// === ФУНКЦИИ ОБНОВЛЕНИЯ ЛОББИ ===

function updateLobbyDisplay() {
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
            
            // ОБНОВЛЯЕМ текст кнопки
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
    
    // Обновляем селектор максимального количества игроков
    const maxPlayersSelect = document.getElementById('maxPlayersSelect');
    if (maxPlayersSelect) {
        maxPlayersSelect.value = gameState.maxPlayers;
    }
}

// === ФУНКЦИИ ОТОБРАЖЕНИЯ ЭКРАНОВ ===

function showScreen(screenId) {
    // Скрываем все экраны
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
        screen.style.display = 'none';
    });
    
    // Показываем нужный экран
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.style.display = 'block';
    }
}

function showLoginScreen() {
    console.log('📱 Showing login screen');
    showScreen('loginScreen');
    
    // Устанавливаем фокус на поле ввода имени
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

function showResultsScreen() {
    console.log('📱 Showing results screen');
    showScreen('resultsScreen');
}

// === ФУНКЦИИ ОБНОВЛЕНИЯ ЛОББИ ===

function updateLobbyDisplay() {
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
            
            // ОБНОВЛЯЕМ текст кнопки
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
    
    // Обновляем селектор максимального количества игроков
    const maxPlayersSelect = document.getElementById('maxPlayersSelect');
    if (maxPlayersSelect) {
        maxPlayersSelect.value = gameState.maxPlayers;
    }
}

// === ОСНОВНЫЕ ФУНКЦИИ ИГРЫ ===

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
    
    // ДОБАВЛЕНО: Проверка подключения к сокету
    if (!socket.connected) {
        console.error('❌ Socket not connected');
        showNotification('Ошибка', 'Нет соединения с сервером. Попробуйте перезагрузить страницу.');
        return;
    }
    
    console.log('🎯 Joining game with name:', playerName);
    socket.emit('join-game', { playerName: playerName });
    
    // ДОБАВЛЕНО: Блокируем кнопку на время запроса
    const joinBtn = document.getElementById('joinGameBtn');
    if (joinBtn) {
        joinBtn.disabled = true;
        joinBtn.textContent = 'Подключение...';
        
        // Разблокируем через 5 секунд если нет ответа
        setTimeout(() => {
            if (joinBtn.disabled) {
                joinBtn.disabled = false;
                joinBtn.textContent = 'Присоединиться к игре';
            }
        }, 5000);
    }
}

function startGame() {
    console.log('🚀 Starting game...');
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

// === ФУНКЦИИ ИГРОВОГО ПРОЦЕССА ===

function getRequiredCardsForRound(round) {
    if (round === 1) {
        return 2; // Профессия + 1 карта на выбор
    } else {
        return 1; // 1 карта на выбор
    }
}

function updateGameDisplay() {
    // Обновляем информацию о раунде
    const currentRoundElement = document.getElementById('currentRound');
    const gameStatusElement = document.getElementById('gameStatus');
    const phaseDisplayElement = document.getElementById('phaseDisplay');
    const roundActionsElement = document.getElementById('roundActions');
    
    if (currentRoundElement) {
        currentRoundElement.textContent = gameState.currentRound;
    }
    
    if (gameStatusElement) {
        gameStatusElement.textContent = getGameStatusText();
    }
    
    if (phaseDisplayElement) {
        phaseDisplayElement.textContent = getPhaseDisplayText();
    }
    
    // ОБНОВЛЯЕМ отображение кнопок в верхней части
    updateRoundActions();
    
    updatePlayersGrid();
    updateTimerDisplay();
}

// НОВАЯ функция для управления кнопками в верхней части
function updateRoundActions() {
    const roundActions = document.getElementById('roundActions');
    const startRoundBtn = document.getElementById('startRoundBtn');
    const skipDiscussionBtn = document.getElementById('skipDiscussionBtn');
    const finishJustificationBtn = document.getElementById('finishJustificationBtn');
    const surrenderBtn = document.getElementById('surrenderBtn');
    
    if (!roundActions) return;
    
    // Скрываем все кнопки по умолчанию
    if (startRoundBtn) startRoundBtn.style.display = 'none';
    if (skipDiscussionBtn) skipDiscussionBtn.style.display = 'none';
    if (finishJustificationBtn) finishJustificationBtn.style.display = 'none';
    if (surrenderBtn) surrenderBtn.style.display = 'none';
    
    const isMyTurn = gameState.currentTurnPlayer === gameState.playerId;
    const isMyJustification = gameState.currentJustifyingPlayer === gameState.playerId;
    const alivePlayers = gameState.players.filter(p => p.isAlive);
    
    let hasVisibleButtons = false;
    
    switch (gameState.gamePhase) {
        case 'preparation':
            // ИЗМЕНЕНО: Показываем кнопку всем живым игрокам
            if (startRoundBtn && alivePlayers.some(p => p.id === gameState.playerId)) {
                startRoundBtn.style.display = 'block';
                hasVisibleButtons = true;
                
                // Обновляем текст кнопки с информацией о голосах
                const requiredVotes = 2;
                const currentVotes = gameState.startRoundVotes || 0;
                
                if (gameState.myStartRoundVote) {
                    startRoundBtn.textContent = `🎯 Проголосовали (${currentVotes}/${requiredVotes})`;
                    startRoundBtn.disabled = true;
                    startRoundBtn.classList.add('voted-skip'); // Используем тот же стиль что и для пропуска
                } else {
                    startRoundBtn.textContent = `🚀 Начать раунд (${currentVotes}/${requiredVotes})`;
                    startRoundBtn.disabled = false;
                    startRoundBtn.classList.remove('voted-skip');
                }
            }
            break;
            
        case 'discussion':
            if (skipDiscussionBtn && alivePlayers.some(p => p.id === gameState.playerId)) {
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
    
    // Показываем/скрываем контейнер с кнопками
    roundActions.style.display = hasVisibleButtons ? 'flex' : 'none';
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
                    // ИСПРАВЛЕНО: Убираем детальную информацию для других игроков
                    return `Ход игрока: ${currentPlayer.name}`;
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
    const playersGrid = document.getElementById('playersGrid');
    
    if (!playersGrid) {
        console.error('❌ playersGrid element not found');
        return;
    }

    // Определяем максимальное количество голосов для подсветки лидеров
    let maxVotes = 0;
    if (gameState.gamePhase === 'voting' || gameState.gamePhase === 'justification' || gameState.gamePhase === 'results') {
        const alivePlayers = gameState.players.filter(p => p.isAlive);
        maxVotes = Math.max(...alivePlayers.map(p => p.votes || 0));
    }
    
    playersGrid.innerHTML = '';
    playersGrid.className = `players-grid players-${gameState.players.length}`;
    
    gameState.players.forEach(player => {
        const playerCard = createPlayerCard(player);
        
        // НОВОЕ: Добавляем класс для игроков с максимальным количеством голосов
        if (player.isAlive && (player.votes || 0) === maxVotes && maxVotes > 0) {
            playerCard.classList.add('most-voted');
        }
        
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
    
    // ИСПРАВЛЕНО: Показываем подсказки только для текущего игрока
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

    // НОВОЕ: Отображение информации о голосовании
    let votingInfo = '';
    if (gameState.gamePhase === 'voting' || gameState.gamePhase === 'justification' || gameState.gamePhase === 'results') {
        // Показываем количество голосов за этого игрока
        const votesForPlayer = player.votes || 0;
        if (votesForPlayer > 0) {
            // Получаем список тех, кто проголосовал за этого игрока
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
        
        // Показываем за кого проголосовал этот игрок
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
                    ${votingInfo}
                </div>
            </div>
        </div>
        
        <div class="characteristics">
            ${characteristicOrder.map(key => {
                if (!player.characteristics || !player.characteristics[key]) return '';
                
                const isRevealed = player.revealedCharacteristics && player.revealedCharacteristics.includes(key);
                const isOwnCard = isCurrentPlayer;
                
                // ИСПРАВЛЕНО: Возможность раскрытия только для текущего игрока в его ход
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

// НОВАЯ ФУНКЦИЯ: Получаем список игроков, проголосовавших за конкретного игрока
function getVotersForPlayer(playerId) {
    if (!gameState.votingResults || !gameState.votingResults[playerId]) {
        return [];
    }
    
    return gameState.votingResults[playerId].map(voterId => {
        const voter = gameState.players.find(p => p.id === voterId);
        return voter ? voter.name : 'Неизвестный';
    });
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
                isDisabled = false; // ИСПРАВЛЕНО: разрешаем смену голоса
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

    // НОВОЕ: Добавляем информацию о текущих голосах в кнопку
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

// УБИРАЕМ дублирование других функций - оставляем только первые версии

// === ИНИЦИАЛИЗАЦИЯ ===

document.addEventListener('DOMContentLoaded', function() {
    console.log('📱 DOM loaded, initializing...');
    
    // Показываем экран входа при загрузке
    showLoginScreen();
    
    // Добавляем обработчик Enter для поля ввода имени
    const playerNameInput = document.getElementById('playerNameInput');
    if (playerNameInput) {
        playerNameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault(); // ДОБАВЛЕНО: предотвращаем стандартное поведение
                joinGame();
            }
        });
    }
    
    // ДОБАВЛЕНО: Обработчик для кнопки присоединения
    const joinGameBtn = document.getElementById('joinGameBtn');
    if (joinGameBtn) {
        joinGameBtn.addEventListener('click', function(e) {
            e.preventDefault(); // Предотвращаем стандартное поведение
            console.log('🎯 Join button clicked');
            joinGame();
        });
    }
});

console.log('🎮 Bunker Game Client Loaded');