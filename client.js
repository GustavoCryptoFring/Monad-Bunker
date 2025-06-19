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
    myStartRoundVote: false
};

// Socket.IO подключение
const socket = io({
    transports: ['websocket', 'polling'],
    timeout: 10000,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000
});

// ЕДИНАЯ функция joinGame
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
        alert('Введите ваше имя!');
        return;
    }
    
    if (playerName.length < 2 || playerName.length > 20) {
        alert('Имя должно быть от 2 до 20 символов!');
        return;
    }
    
    if (!socket.connected) {
        console.error('❌ Socket not connected');
        alert('Нет соединения с сервером. Попробуйте перезагрузить страницу.');
        return;
    }
    
    console.log('🎯 Joining game with name:', playerName);
    
    // Блокируем кнопку
    if (joinBtn) {
        joinBtn.disabled = true;
        joinBtn.textContent = 'Подключение...';
    }
    
    socket.emit('join-game', { playerName: playerName });
    
    // Разблокируем через 5 секунд если нет ответа
    setTimeout(() => {
        if (joinBtn && joinBtn.disabled) {
            joinBtn.disabled = false;
            joinBtn.textContent = 'Присоединиться к игре';
        }
    }, 5000);
}

// ЕДИНАЯ инициализация DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('📱 DOM loaded, initializing...');
    
    // Проверяем доступность элементов
    const playerNameInput = document.getElementById('playerNameInput');
    const joinGameBtn = document.getElementById('joinGameBtn');
    
    console.log('🔍 Elements check:');
    console.log('- playerNameInput:', playerNameInput ? '✅' : '❌');
    console.log('- joinGameBtn:', joinGameBtn ? '✅' : '❌');
    
    if (!playerNameInput || !joinGameBtn) {
        console.error('❌ Critical elements missing!');
        return;
    }
    
    // Показываем экран входа
    showLoginScreen();
    
    // Обработчик Enter для поля ввода имени
    playerNameInput.addEventListener('keypress', function(e) {
        console.log('🎯 Key pressed:', e.key);
        if (e.key === 'Enter') {
            e.preventDefault();
            joinGame();
        }
    });
    
    // Обработчик для кнопки присоединения
    joinGameBtn.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('🎯 Join button clicked');
        joinGame();
    });
    
    // Закрытие модальных окон по клику вне области
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
    
    console.log('✅ DOM initialization complete');
});

// === ОБРАБОТЧИКИ СОБЫТИЙ SOCKET.IO ===

socket.on('connect', function() {
    console.log('🌐 Connected to server');
    console.log('🔗 Socket ID:', socket.id);
    
    showLoginScreen();
    
    // Разблокируем кнопку если она заблокирована
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
    
    // Разблокируем кнопку при ошибке
    const joinBtn = document.getElementById('joinGameBtn');
    if (joinBtn) {
        joinBtn.disabled = false;
        joinBtn.textContent = 'Присоединиться к игре';
    }
    
    alert('Ошибка: ' + errorMessage);
});

socket.on('join-confirmed', function(data) {
    console.log('✅ Join confirmed:', data);
    
    // Разблокируем кнопку
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
    gameState.startRoundVotes = 0;
    gameState.myStartRoundVote = false;
    
    // ДОБАВЛЯЕМ: Обновляем историю сразу при старте игры
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
    gameState.scenario = null; // ДОБАВЛЯЕМ: Очищаем сценарий
    showLobbyScreen();
});

socket.on('phase-changed', function(data) {
    console.log('🔄 Phase changed:', data);
    gameState.gamePhase = data.gamePhase;
    gameState.timeLeft = data.timeLeft;
    gameState.players = data.players;
    gameState.currentTurnPlayer = data.currentTurnPlayer || null;
    gameState.currentRound = data.currentRound || gameState.currentRound;
    
    // ДОБАВЛЯЕМ: Получаем сценарий при изменении фазы
    if (data.scenario) {
        gameState.scenario = data.scenario;
        console.log('🎲 Scenario received:', data.scenario.title);
    }
    
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
    console.log('🗳️ Vote update received:', data);
    
    // ИСПРАВЛЯЕМ: Правильно обновляем состояние
    if (data.players) {
        gameState.players = data.players;
    }
    if (data.votingResults) {
        gameState.votingResults = data.votingResults;
    }
    if (data.canChangeVote) {
        gameState.canChangeVote = data.canChangeVote;
    }
    
    // ИСПРАВЛЯЕМ: Принудительно обновляем сетку
    setTimeout(() => {
        updatePlayersGrid();
    }, 100);
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
    
    // Показываем уведомление о втором голосовании
    if (data.isSecondVoting) {
        showNotification('Второе голосование', 'Игроки оправдались. Голосуйте повторно среди них.');
    }
    
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
    
    // ОБНОВЛЯЕМ: Показываем расширенное сообщение о результатах
    if (data.eliminatedPlayers && data.eliminatedPlayers.length > 0) {
        if (data.eliminatedPlayers.length === 1) {
            showNotification('Игрок исключен', `${data.eliminatedPlayers[0]} покидает бункер`);
        } else {
            showNotification('Игроки исключены', `${data.eliminatedPlayers.join(', ')} покидают бункер`);
        }
    } else if (data.resultMessage) {
        // НОВОЕ: Показываем специальное сообщение для ничьи
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
    
    // НОВОЕ: Показываем предупреждение о специальном раунде
    if (data.willEliminateTopVotersThisRound) {
        showNotification('⚠️ Специальный раунд', 'В этом раунде будут исключены 2 игрока с наибольшими голосами!');
    }
    
    updateGameDisplay();
});

// Добавляем обработчик голосования за начало раунда
socket.on('start-round-vote-update', function(data) {
    console.log('🎯 Start round vote update:', data);
    gameState.startRoundVotes = data.votes;
    gameState.myStartRoundVote = data.hasVoted;
    updateRoundActions();
});

// Добавляем обработчики событий карт действий
socket.on('action-card-used', function(data) {
    console.log('✨ Action card used:', data);
    gameState.players = data.players;
    
    updatePlayersGrid();
    
    const message = data.targetId 
        ? `${data.playerName} использовал карту "${data.cardName}"`
        : `${data.playerName} использовал карту "${data.cardName}"`;
    
    showNotification('Карта действия', message);
});

socket.on('detective-result', function(data) {
    console.log('🔍 Detective result:', data);
    
    const message = `Характеристика игрока ${data.targetName}:\n${translateCharacteristic(data.characteristic)}: ${data.value}`;
    showNotification('Результат детектива', message);
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
    console.log('🎮 Game state:', {
        phase: gameState.gamePhase,
        players: gameState.players.length,
        playerId: gameState.playerId
    });
    
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
    
    if (!socket.connected) {
        console.error('❌ Socket not connected');
        showNotification('Ошибка', 'Нет соединения с сервером. Попробуйте перезагрузить страницу.');
        return;
    }
    
    console.log('🎯 Joining game with name:', playerName);
    
    // Блокируем кнопку
    const joinBtn = document.getElementById('joinGameBtn');
    if (joinBtn) {
        joinBtn.disabled = true;
        joinBtn.textContent = 'Подключение...';
    }
    
    socket.emit('join-game', { playerName: playerName });
    
    // Разблокируем через 5 секунд если нет ответа
    setTimeout(() => {
        if (joinBtn && joinBtn.disabled) {
            joinBtn.disabled = false;
            joinBtn.textContent = 'Присоединиться к игре';
        }
    }, 5000);
}

function startRound() {
    if (gameState.myStartRoundVote) {
        showNotification('Голос уже учтен', 'Вы уже проголосовали за начало раунда');
        return;
    }
    
    console.log('🎯 Voting to start round');
    socket.emit('start-round');
}

// ДОБАВЛЯЕМ недостающую функцию startGame
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

// === ФУНКЦИИ ИГРОВОГО ПРОЦЕССА ===

function getRequiredCardsForRound(round) {
    if (round === 1) {
        return 2; // Профессия + 1 карта на выбор
    } else {
        return 1; // 1 карта на выбор
    }
}

// ОБНОВЛЯЕМ функцию updateGameDisplay
function updateGameDisplay() {
    console.log('🎮 Updating game display. Phase:', gameState.gamePhase, 'Players:', gameState.players.length);
    
    // Обновляем информацию о раунде
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
    
   ;
    
    // Остальные обновления
    updateRoundActions();
    updatePlayersGrid();
    updateTimerDisplay();
    
    console.log('✅ Game display updated');
}

// ИСПРАВЛЯЕМ функцию для управления кнопками в верхней части
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
    
    // Скрываем все кнопки по умолчанию
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
            // ИСПРАВЛЯЕМ: Показываем кнопку всем живым игрокам
            if (startRoundBtn && amAlive) {
                startRoundBtn.style.display = 'block';
                hasVisibleButtons = true;
                
                // Обновляем текст кнопки с информацией о голосах
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
    
    // Показываем/скрываем контейнер с кнопками
    roundActions.style.display = hasVisibleButtons ? 'flex' : 'none';
    
    console.log('🎯 Round actions updated. Visible:', hasVisibleButtons);
}

function getGameStatusText() {
    // ДОБАВЛЯЕМ проверку специального режима
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
            const justificationQueue = gameState.players.filter(p => p.id === gameState.currentJustifyingPlayer);
            if (justificationQueue.length > 0) {
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

// ИСПРАВЛЯЕМ функцию updatePlayersGrid
function updatePlayersGrid() {
    console.log('🎮 Updating players grid. Players:', gameState.players.length);
    
    const playersGrid = document.getElementById('playersGrid');
    
    if (!playersGrid) {
        console.error('❌ playersGrid element not found');
        return;
    }

    // ИСПРАВЛЯЕМ: Проверяем есть ли игроки
    if (!gameState.players || gameState.players.length === 0) {
        console.log('⚠️ No players to display');
        playersGrid.innerHTML = '<div style="color: #ecf0f1; text-align: center; padding: 20px;">Нет игроков для отображения</div>';
        playersGrid.style.display = 'grid'; // ИСПРАВЛЯЕМ: grid вместо block
        return;
    }

    // Определяем максимальное количество голосов для подсветки лидеров
    let maxVotes = 0;
    if (gameState.gamePhase === 'voting' || gameState.gamePhase === 'justification' || gameState.gamePhase === 'results') {
        const alivePlayers = gameState.players.filter(p => p.isAlive);
        maxVotes = Math.max(...alivePlayers.map(p => p.votes || 0));
    }
    
    // ИСПРАВЛЯЕМ: Устанавливаем правильные классы и стили
    playersGrid.className = `players-grid players-${gameState.players.length}`;
    playersGrid.style.display = 'grid';
    playersGrid.innerHTML = ''; // Очищаем только после установки стилей
    
    gameState.players.forEach(player => {
        const playerCard = createPlayerCard(player);
        
        // НОВОЕ: Добавляем класс для игроков с максимальным количеством голосов
        if (player.isAlive && (player.votes || 0) === maxVotes && maxVotes > 0) {
            playerCard.classList.add('most-voted');
        }
        
        playersGrid.appendChild(playerCard);
    });
    
    console.log('✅ Players grid updated:', gameState.players.length, 'players');
}

// ИСПРАВЛЯЕМ функцию getVotersForPlayer
function getVotersForPlayer(playerId) {
    if (!gameState.votingResults || !gameState.votingResults[playerId]) {
        return [];
    }
    
    const voterIds = gameState.votingResults[playerId];
    const voterNames = [];
    
    voterIds.forEach(voterId => {
        const voter = gameState.players.find(p => p.id === voterId);
        if (voter) {
            voterNames.push(voter.name);
        }
    });
    
    return voterNames;
}

// ИСПРАВЛЯЕМ обработчик голосования
socket.on('vote-update', function(data) {
    console.log('🗳️ Vote update received:', data);
    
    // ИСПРАВЛЯЕМ: Правильно обновляем состояние
    if (data.players) {
        gameState.players = data.players;
    }
    if (data.votingResults) {
        gameState.votingResults = data.votingResults;
    }
    if (data.canChangeVote) {
        gameState.canChangeVote = data.canChangeVote;
    }
    
    // ИСПРАВЛЯЕМ: Принудительно обновляем сетку
    setTimeout(() => {
        updatePlayersGrid();
    }, 100);
});

// ИСПРАВЛЯЕМ функцию voteForPlayer
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
    
    console.log('🗳️ Sending vote to server');
    
    if (me.hasVoted && gameState.canChangeVote[gameState.playerId]) {
        // Смена голоса
        socket.emit('change-vote', { targetId: playerId });
        gameState.hasChangedVote = true;
    } else {
        // Первичное голосование
        socket.emit('vote-player', { targetId: playerId });
    }
    
    // ИСПРАВЛЯЕМ: Не изменяем состояние локально - ждем ответа сервера
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
    console.log('🎮 Game state:', {
        phase: gameState.gamePhase,
        players: gameState.players.length,
        playerId: gameState.playerId
    });
    
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
    
    if (!socket.connected) {
        console.error('❌ Socket not connected');
        showNotification('Ошибка', 'Нет соединения с сервером. Попробуйте перезагрузить страницу.');
        return;
    }
    
    console.log('🎯 Joining game with name:', playerName);
    
    // Блокируем кнопку
    const joinBtn = document.getElementById('joinGameBtn');
    if (joinBtn) {
        joinBtn.disabled = true;
        joinBtn.textContent = 'Подключение...';
    }
    
    socket.emit('join-game', { playerName: playerName });
    
    // Разблокируем через 5 секунд если нет ответа
    setTimeout(() => {
        if (joinBtn && joinBtn.disabled) {
            joinBtn.disabled = false;
            joinBtn.textContent = 'Присоединиться к игре';
        }
    }, 5000);
}

function startRound() {
    if (gameState.myStartRoundVote) {
        showNotification('Голос уже учтен', 'Вы уже проголосовали за начало раунда');
        return;
    }
    
    console.log('🎯 Voting to start round');
    socket.emit('start-round');
}

// ДОБАВЛЯЕМ недостающую функцию startGame
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

// === ФУНКЦИИ ИГРОВОГО ПРОЦЕССА ===

function getRequiredCardsForRound(round) {
    if (round === 1) {
        return 2; // Профессия + 1 карта на выбор
    } else {
        return 1; // 1 карта на выбор
    }
}

// ОБНОВЛЯЕМ функцию updateGameDisplay
function updateGameDisplay() {
    console.log('🎮 Updating game display. Phase:', gameState.gamePhase, 'Players:', gameState.players.length);
    
    // Обновляем информацию о раунде
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
    
   ;
    
    // Остальные обновления
    updateRoundActions();
    updatePlayersGrid();
    updateTimerDisplay();
    
    console.log('✅ Game display updated');
}

// ИСПРАВЛЯЕМ функцию для управления кнопками в верхней части
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
    
    // Скрываем все кнопки по умолчанию
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
            // ИСПРАВЛЯЕМ: Показываем кнопку всем живым игрокам
            if (startRoundBtn && amAlive) {
                startRoundBtn.style.display = 'block';
                hasVisibleButtons = true;
                
                // Обновляем текст кнопки с информацией о голосах
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
    
    // Показываем/скрываем контейнер с кнопками
    roundActions.style.display = hasVisibleButtons ? 'flex' : 'none';
    
    console.log('🎯 Round actions updated. Visible:', hasVisibleButtons);
}

function getGameStatusText() {
    // ДОБАВЛЯЕМ проверку специального режима
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
            const justificationQueue = gameState.players.filter(p => p.id === gameState.currentJustifyingPlayer);
            if (justificationQueue.length > 0) {
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

// ИСПРАВЛЯЕМ функцию updatePlayersGrid
function updatePlayersGrid() {
    console.log('🎮 Updating players grid. Players:', gameState.players.length);
    
    const playersGrid = document.getElementById('playersGrid');
    
    if (!playersGrid) {
        console.error('❌ playersGrid element not found');
        return;
    }

    // ИСПРАВЛЯЕМ: Проверяем есть ли игроки
    if (!gameState.players || gameState.players.length === 0) {
        console.log('⚠️ No players to display');
        playersGrid.innerHTML = '<div style="color: #ecf0f1; text-align: center; padding: 20px;">Нет игроков для отображения</div>';
        playersGrid.style.display = 'grid'; // ИСПРАВЛЯЕМ: grid вместо block
        return;
    }

    // Определяем максимальное количество голосов для подсветки лидеров
    let maxVotes = 0;
    if (gameState.gamePhase === 'voting' || gameState.gamePhase === 'justification' || gameState.gamePhase === 'results') {
        const alivePlayers = gameState.players.filter(p => p.isAlive);
        maxVotes = Math.max(...alivePlayers.map(p => p.votes || 0));
    }
    
    // ИСПРАВЛЯЕМ: Устанавливаем правильные классы и стили
    playersGrid.className = `players-grid players-${gameState.players.length}`;
    playersGrid.style.display = 'grid';
    playersGrid.innerHTML = ''; // Очищаем только после установки стилей
    
    gameState.players.forEach(player => {
        const playerCard = createPlayerCard(player);
        
        // НОВОЕ: Добавляем класс для игроков с максимальным количеством голосов
        if (player.isAlive && (player.votes || 0) === maxVotes && maxVotes > 0) {
            playerCard.classList.add('most-voted');
        }
        
        playersGrid.appendChild(playerCard);
    });
    
    console.log('✅ Players grid updated:', gameState.players.length, 'players');
}

// ИСПРАВЛЯЕМ функцию getVotersForPlayer
function getVotersForPlayer(playerId) {
    if (!gameState.votingResults || !gameState.votingResults[playerId]) {
        return [];
    }
    
    const voterIds = gameState.votingResults[playerId];
    const voterNames = [];
    
    voterIds.forEach(voterId => {
        const voter = gameState.players.find(p => p.id === voterId);
        if (voter) {
            voterNames.push(voter.name);
        }
    });
    
    return voterNames;
}

// ИСПРАВЛЯЕМ обработчик голосования
socket.on('vote-update', function(data) {
    console.log('🗳️ Vote update received:', data);
    
    // ИСПРАВЛЯЕМ: Правильно обновляем состояние
    if (data.players) {
        gameState.players = data.players;
    }
    if (data.votingResults) {
        gameState.votingResults = data.votingResults;
    }
    if (data.canChangeVote) {
        gameState.canChangeVote = data.canChangeVote;
    }
    
    // ИСПРАВЛЯЕМ: Принудительно обновляем сетку
    setTimeout(() => {
        updatePlayersGrid();
    }, 100);
});

// ИСПРАВЛЯЕМ функцию voteForPlayer
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
    
    console.log('🗳️ Sending vote to server');
    
    if (me.hasVoted && gameState.canChangeVote[gameState.playerId]) {
        // Смена голоса
        socket.emit('change-vote', { targetId: playerId });
        gameState.hasChangedVote = true;
    } else {
        // Первичное голосование
        socket.emit('vote-player', { targetId: playerId });
    }
    
    // ИСПРАВЛЯЕМ: Не изменяем состояние локально - ждем ответа сервера
}