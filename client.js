console.log('Client.js loading...');

// Проверяем, на какой странице мы находимся
const IS_ROOM_PAGE = window.IS_ROOM_PAGE || false;
const ROOM_CODE = window.ROOM_CODE || null;

// Объединенное состояние игры
let gameState = {
    players: [],
    currentRound: 1,
    gamePhase: 'login',
    votingResults: {},
    maxRounds: 3,
    currentPlayerName: '',
    currentPlayerId: null,
    roomCode: ROOM_CODE || '',
    isRoomHost: false,
    currentTurnPlayerId: null,
    revealedThisRound: 0,
    timer: null,
    timeLeft: 0,
    playersWhoVoted: [],
    skipVotes: 0,
    playersToEliminateNextRound: 0,
    currentPhase: 'waiting',
    round: 1,
    maxPlayers: 8,
    playerId: '',
    playerName: '',
    isHost: false,
    skipVotes: {
        discussion: new Set(),
        voting: new Set()
    }
};

// Инициализация Socket.IO
const socket = io();

// Socket.IO обработчики
socket.on('connect', function() {
    console.log('✅ Connected to server:', socket.id);
    gameState.playerId = socket.id;
    gameState.currentPlayerId = socket.id;
});

socket.on('disconnect', function() {
    console.log('❌ Disconnected from server');
});

socket.on('connect_error', function(error) {
    console.error('❌ Connection error:', error);
    alert('Не удалось подключиться к серверу');
});

// Обработчик создания комнаты - с перенаправлением
socket.on('room-created', function(data) {
    console.log('Room created:', data);
    
    if (data.redirect && data.roomUrl) {
        // Перенаправляем на поддомен
        alert(`Комната ${data.roomCode} создана! Переходим к комнате...`);
        window.location.href = data.roomUrl;
    } else {
        // Остаемся на текущей странице (мы уже на поддомене)
        gameState.roomCode = data.roomCode;
        gameState.isHost = data.isHost;
        gameState.isRoomHost = data.isHost;
        updatePlayersFromServer(data.players);
        showRoomSetup();
    }
});

socket.on('room-joined', function(data) {
    console.log('Room joined:', data);
    
    if (data.redirect && data.roomUrl) {
        // Перенаправляем на поддомен
        alert(`Присоединяемся к комнате ${data.roomCode}...`);
        window.location.href = data.roomUrl;
    } else {
        // Остаемся на поддомене
        gameState.roomCode = data.roomCode;
        gameState.isHost = data.isHost;
        gameState.isRoomHost = data.isHost;
        updatePlayersFromServer(data.players);
        showRoomSetup();
    }
});

socket.on('player-joined', function(data) {
    console.log('Player joined:', data);
    updatePlayersFromServer(data.players);
    updatePlayersList();
});

socket.on('player-left', function(data) {
    console.log('Player left:', data);
    updatePlayersFromServer(data.players);
    updatePlayersList();
});

socket.on('game-started', function(data) {
    console.log('Game started:', data);
    
    document.getElementById('roomSetup').style.display = 'none';
    document.getElementById('gameBoard').style.display = 'block';
    
    gameState.gamePhase = 'discussion';
    updateGameDisplay();
    updatePlayersGrid();
    startDiscussionPhase();
});

socket.on('error', function(error) {
    console.error('Server error:', error);
    alert('Ошибка: ' + error);
});

// Функции для разных типов страниц
function createRoom() {
    console.log('Creating room...');
    
    const playerName = document.getElementById('playerName').value.trim();
    
    if (!playerName) {
        alert('Пожалуйста, введите ваше имя');
        return;
    }
    
    if (!socket.connected) {
        alert('Нет соединения с сервером');
        return;
    }
    
    gameState.playerName = playerName;
    gameState.currentPlayerName = playerName;
    
    socket.emit('create-room', { playerName });
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

    gameState.playerName = playerName;
    gameState.currentPlayerName = playerName;
    
    socket.emit('join-room', { 
        roomCode, 
        playerName,
        fromMainPage: true  // Указываем, что присоединяемся с главной страницы
    });
}

// Функция для присоединения с поддомена
function joinRoomFromSubdomain(roomCode) {
    const playerName = document.getElementById('playerName').value.trim();
    
    if (!playerName) {
        alert('Пожалуйста, введите ваше имя!');
        return;
    }
    
    gameState.playerName = playerName;
    gameState.currentPlayerName = playerName;
    gameState.roomCode = roomCode;
    
    socket.emit('join-room', { 
        roomCode, 
        playerName,
        fromMainPage: false  // Мы уже на поддомене
    });
}

function showRoomSetup() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('roomSetup').style.display = 'block';
    
    // Показываем настройки только хосту
    if (gameState.isHost) {
        document.getElementById('roomSettings').style.display = 'block';
        document.getElementById('startGameBtn').style.display = 'block';
    }
    
    updatePlayersList();
}

function updatePlayersFromServer(players) {
    gameState.players = [];
    
    players.forEach(player => {
        gameState.players.push({
            id: player.id,
            name: player.name,
            isHost: player.isHost,
            characteristics: generateCharacteristics(),
            actionCards: [getRandomActionCard()],
            isAlive: true,
            votes: 0,
            hasRevealed: false
        });
    });
}

function updatePlayersList() {
    const playersList = document.getElementById('playersList');
    const currentPlayersCount = document.getElementById('currentPlayersCount');
    const maxPlayersCount = document.getElementById('maxPlayersCount');
    
    if (!playersList || !currentPlayersCount) return;
    
    playersList.innerHTML = '';
    
    gameState.players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = player.name + (player.isHost ? ' 👑' : '');
        li.className = player.isHost ? 'host' : '';
        playersList.appendChild(li);
    });
    
    currentPlayersCount.textContent = gameState.players.length;
    if (maxPlayersCount) {
        maxPlayersCount.textContent = gameState.maxPlayers;
    }
    
    const startBtn = document.getElementById('startGameBtn');
    if (startBtn) {
        const canStart = gameState.players.length >= 2 && gameState.isHost;
        startBtn.disabled = !canStart;
        startBtn.textContent = gameState.players.length < 2 ? 
            `Начать игру (минимум 2 игрока)` : 
            `Начать игру (${gameState.players.length}/${gameState.maxPlayers})`;
    }
}

function copyRoomUrl() {
    const roomUrl = window.location.href;
    
    navigator.clipboard.writeText(roomUrl).then(() => {
        alert(`Ссылка на комнату скопирована:\n${roomUrl}`);
    }).catch(() => {
        const textArea = document.createElement('textarea');
        textArea.value = roomUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert(`Ссылка на комнату скопирована:\n${roomUrl}`);
    });
}

function updateMaxPlayers() {
    if (!gameState.isHost) return;
    
    const maxPlayers = parseInt(document.getElementById('maxPlayers').value);
    gameState.maxPlayers = maxPlayers;
    updatePlayersList();
}

function startGame() {
    if (!gameState.isHost) return;
    
    if (gameState.players.length < 2) {
        alert('Для начала игры нужно минимум 2 игрока!');
        return;
    }
    
    socket.emit('start-game', { roomCode: gameState.roomCode });
}

// Данные игры (все массивы остаются те же)
const professions = [
    "Врач", "Учитель", "Инженер", "Повар", "Программист", "Механик",
    "Писатель", "Художник", "Музыкант", "Строитель", "Фермер", "Пилот",
    "Медсестра", "Полицейский", "Пожарный", "Ветеринар", "Переводчик",
    "Дизайнер", "Фотограф", "Журналист", "Психолог", "Бухгалтер"
];

const healthConditions = [
    "Отличное здоровье", "Хорошее здоровье", "Удовлетворительное здоровье",
    "Близорукость", "Дальнозоркость", "Астма", "Аллергия на пыль",
    "Аллергия на животных", "Диабет", "Гипертония", "Артрит",
    "Хроническая усталость", "Мигрени", "Бессонница", "Депрессия",
    "Тревожность", "Боязнь высоты", "Клаустрофобия"
];

const hobbies = [
    "Чтение", "Кулинария", "Садоводство", "Рисование", "Музыка",
    "Спорт", "Танцы", "Фотография", "Путешествия", "Коллекционирование",
    "Рукоделие", "Игры", "Рыбалка", "Охота", "Йога", "Медитация",
    "Волонтерство", "Изучение языков", "Астрономия", "Археология"
];

const phobias = [
    "Боязнь темноты", "Боязнь высоты", "Боязнь замкнутых пространств",
    "Боязнь пауков", "Боязнь змей", "Боязнь собак", "Боязнь воды",
    "Боязнь огня", "Боязнь толпы", "Боязнь публичных выступлений",
    "Боязнь игл", "Боязнь крови", "Боязнь самолетов", "Боязнь лифтов",
    "Боязнь микробов", "Боязнь клоунов", "Боязнь зеркал"
];

const baggage = [
    "Рюкзак с едой", "Аптечка", "Инструменты", "Оружие", "Книги",
    "Семена растений", "Радио", "Фонарик", "Одеяла", "Одежда",
    "Документы", "Деньги", "Украшения", "Лекарства", "Компьютер",
    "Музыкальный инструмент", "Спортивное снаряжение", "Игрушки"
];

const facts = [
    "Был в тюрьме", "Спас чью-то жизнь", "Выиграл в лотерею",
    "Знает 5 языков", "Чемпион по шахматам", "Бывший военный",
    "Имеет двойное гражданство", "Работал в цирке", "Писал книги",
    "Изобрел что-то важное", "Путешествовал по всему миру",
    "Выживал в дикой природе", "Знает боевые искусства",
    "Бывший актер", "Работал спасателем", "Имеет фотографическую память"
];

const actionCards = [
    { id: 1, name: "Целитель", description: "Можете спасти одного игрока от исключения", type: "protective", usesLeft: 1 },
    { id: 2, name: "Детектив", description: "Узнайте одну характеристику любого игрока", type: "investigative", usesLeft: 1 },
    { id: 3, name: "Саботажник", description: "Отмените раскрытие характеристики другого игрока", type: "disruptive", usesLeft: 1 },
    { id: 4, name: "Лидер", description: "Ваш голос считается за два", type: "influential", usesLeft: 1 },
    { id: 5, name: "Шпион", description: "Посмотрите все карты действий других игроков", type: "investigative", usesLeft: 1 },
    { id: 6, name: "Медик", description: "Излечите игрока с плохим здоровьем", type: "supportive", usesLeft: 1 },
    { id: 7, name: "Стратег", description: "Измените порядок голосования", type: "tactical", usesLeft: 1 },
    { id: 8, name: "Дипломат", description: "Предотвратите исключение игрока на один раунд", type: "protective", usesLeft: 1 }
];

// Остальные функции игры остаются те же...
function generateCharacteristics() {
    return {
        profession: getRandomItem(professions),
        health: getRandomItem(healthConditions),
        hobby: getRandomItem(hobbies),
        phobia: getRandomItem(phobias),
        baggage: getRandomItem(baggage),
        fact: getRandomItem(facts)
    };
}

function getRandomActionCard() {
    return { ...getRandomItem(actionCards) };
}

function getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
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
    
    updatePlayersGrid();
}

function getGameStatusText() {
    switch (gameState.gamePhase) {
        case 'setup': return 'Подготовка к игре...';
        case 'discussion': return 'Фаза обсуждения';
        case 'voting': return 'Фаза голосования';
        case 'results': return 'Подведение итогов раунда';
        case 'finished': return 'Игра завершена';
        default: return 'Ожидание...';
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

function updatePlayersGrid() {
    const playersGrid = document.getElementById('playersGrid');
    if (!playersGrid) return;
    
    playersGrid.innerHTML = '';
    playersGrid.className = 'players-grid';
    
    const playerCount = gameState.players.length;
    playersGrid.classList.add(`players-${playerCount}`);
    
    gameState.players.forEach(player => {
        const playerCard = createPlayerCard(player);
        playersGrid.appendChild(playerCard);
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
            ${gameState.gamePhase === 'discussion' && isCurrentPlayer ? 
                `<button class="modal-buttons" onclick="revealCharacteristic('${player.id}')">
                    🔍 Раскрыть характеристику
                </button>` : ''
            }
            ${gameState.gamePhase === 'voting' && !isCurrentPlayer && player.isAlive ? 
                `<div class="vote-section">
                    <button class="vote-player-btn" onclick="voteForPlayer('${player.id}')">
                        📋 Голосовать за исключение
                    </button>
                    <div class="voters-list" id="voters-${player.id}">
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

function startDiscussionPhase() {
    gameState.gamePhase = 'discussion';
    gameState.timeLeft = 180;
    
    updateGameDisplay();
    startTimer();
}

function startTimer() {
    if (gameState.timer) {
        clearInterval(gameState.timer);
    }
    
    gameState.timer = setInterval(() => {
        gameState.timeLeft--;
        updateTimerDisplay();
        
        if (gameState.timeLeft <= 0) {
            clearInterval(gameState.timer);
            nextPhase();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const timerDisplay = document.getElementById('timerDisplay');
    if (timerDisplay) {
        const minutes = Math.floor(gameState.timeLeft / 60);
        const seconds = gameState.timeLeft % 60;
        timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
}

function nextPhase() {
    switch (gameState.gamePhase) {
        case 'discussion':
            startVotingPhase();
            break;
        case 'voting':
            showResults();
            break;
        case 'results':
            nextRound();
            break;
    }
}

function startVotingPhase() {
    gameState.gamePhase = 'voting';
    gameState.timeLeft = 60;
    gameState.playersWhoVoted = [];
    
    updateGameDisplay();
    startTimer();
}

function showResults() {
    gameState.gamePhase = 'results';
    updateGameDisplay();
    
    setTimeout(() => {
        nextRound();
    }, 5000);
}

function nextRound() {
    gameState.currentRound++;
    gameState.revealedThisRound = 0;
    
    if (gameState.currentRound > gameState.maxRounds) {
        endGame();
    } else {
        startDiscussionPhase();
    }
}

function endGame() {
    gameState.gamePhase = 'finished';
    updateGameDisplay();
    alert('Игра завершена!');
}

// Заглушки функций
function revealCharacteristic(playerId) { console.log('Revealing characteristic for player:', playerId); }
function voteForPlayer(playerId) { console.log('Voting for player:', playerId); }
function voteToSkip() { console.log('Voting to skip'); }
function showActionCard() { console.log('Showing action cards'); }
function closeActionCardModal() {}
function closeTargetSelectionModal() {}
function closeCharacteristicSelectionModal() {}

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, IS_ROOM_PAGE:', IS_ROOM_PAGE, 'ROOM_CODE:', ROOM_CODE);
});

console.log('Client.js loaded with subdomain support');