console.log('Client.js loading...');

// Объединенное состояние игры из обоих файлов
let gameState = {
    // Из script.js
    players: [],
    currentRound: 1,
    gamePhase: 'login',
    votingResults: {},
    maxRounds: 3,
    currentPlayerName: '',
    currentPlayerId: null,
    roomCode: '',
    isRoomHost: false,
    currentTurnPlayerId: null,
    revealedThisRound: 0,
    timer: null,
    timeLeft: 0,
    playersWhoVoted: [],
    skipVotes: 0,
    playersToEliminateNextRound: 0,
    
    // Из client.js (дополнительные поля)
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

socket.on('room-created', function(data) {
    console.log('Room created:', data);
    gameState.roomCode = data.roomCode;
    gameState.isHost = data.isHost;
    gameState.isRoomHost = data.isHost;
    gameState.players = [];
    
    // Конвертируем данные сервера в формат script.js
    data.players.forEach(player => {
        gameState.players.push({
            id: player.id,
            name: player.name,
            isHost: player.isHost,
            characteristics: {
                profession: null,
                health: null,
                hobby: null,
                phobia: null,
                baggage: null,
                fact: null
            },
            actionCards: [],
            isAlive: true,
            votes: 0,
            hasRevealed: false
        });
    });
    
    showRoomSetup();
});

socket.on('room-joined', function(data) {
    console.log('Room joined:', data);
    gameState.roomCode = data.roomCode;
    gameState.isHost = data.isHost;
    gameState.isRoomHost = data.isHost;
    gameState.players = [];
    
    data.players.forEach(player => {
        gameState.players.push({
            id: player.id,
            name: player.name,
            isHost: player.isHost,
            characteristics: {
                profession: null,
                health: null,
                hobby: null,
                phobia: null,
                baggage: null,
                fact: null
            },
            actionCards: [],
            isAlive: true,
            votes: 0,
            hasRevealed: false
        });
    });
    
    showRoomSetup();
});

socket.on('player-joined', function(data) {
    console.log('Player joined:', data);
    gameState.players = [];
    
    data.players.forEach(player => {
        gameState.players.push({
            id: player.id,
            name: player.name,
            isHost: player.isHost,
            characteristics: {
                profession: null,
                health: null,
                hobby: null,
                phobia: null,
                baggage: null,
                fact: null
            },
            actionCards: [],
            isAlive: true,
            votes: 0,
            hasRevealed: false
        });
    });
    
    updatePlayersList();
});

socket.on('player-left', function(data) {
    console.log('Player left:', data);
    gameState.players = [];
    
    data.players.forEach(player => {
        gameState.players.push({
            id: player.id,
            name: player.name,
            isHost: player.isHost,
            characteristics: {
                profession: null,
                health: null,
                hobby: null,
                phobia: null,
                baggage: null,
                fact: null
            },
            actionCards: [],
            isAlive: true,
            votes: 0,
            hasRevealed: false
        });
    });
    
    updatePlayersList();
});

socket.on('error', function(error) {
    console.error('Server error:', error);
    alert('Ошибка: ' + error);
});

// Все данные игры из script.js (вставьте сюда все массивы из script.js)
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

// Основные функции
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
    socket.emit('join-room', { roomCode, playerName });
}

function showRoomSetup() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('roomSetup').style.display = 'block';
    document.getElementById('roomCode').textContent = gameState.roomCode;
    updatePlayersList();
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

function copyRoomCode() {
    const roomCode = document.getElementById('roomCode').textContent;
    navigator.clipboard.writeText(roomCode).then(() => {
        alert('Код комнаты скопирован: ' + roomCode);
    }).catch(() => {
        const textArea = document.createElement('textarea');
        textArea.value = roomCode;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Код комнаты скопирован: ' + roomCode);
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
    
    // Начинаем игру
    gameState.gamePhase = 'setup';
    gameState.currentRound = 1;
    
    // Раздаем характеристики и карты действий
    distributeCharacteristics();
    distributeActionCards();
    
    // Переходим к игровому экрану
    document.getElementById('roomSetup').style.display = 'none';
    document.getElementById('gameBoard').style.display = 'block';
    
    updateGameDisplay();
    updatePlayersGrid(); // Добавьте эту строку
    startDiscussionPhase();
}

// Функции игровой логики из script.js
function distributeCharacteristics() {
    gameState.players.forEach(player => {
        player.characteristics = {
            profession: getRandomItem(professions),
            health: getRandomItem(healthConditions),
            hobby: getRandomItem(hobbies),
            phobia: getRandomItem(phobias),
            baggage: getRandomItem(baggage),
            fact: getRandomItem(facts)
        };
    });
}

function distributeActionCards() {
    gameState.players.forEach(player => {
        // Каждый игрок получает случайную карту действия
        const randomCard = { ...getRandomItem(actionCards) };
        player.actionCards = [randomCard];
    });
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
    
    // Очищаем старые карточки
    playersGrid.innerHTML = '';
    
    // Удаляем старые классы количества игроков
    playersGrid.className = 'players-grid';
    
    // Добавляем новый класс в зависимости от количества игроков
    const playerCount = gameState.players.length;
    playersGrid.classList.add(`players-${playerCount}`);
    
    console.log(`Setting grid for ${playerCount} players`);
    
    // Создаем карточки игроков
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
    gameState.timeLeft = 180; // 3 минуты на обсуждение
    
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
    gameState.timeLeft = 60; // 1 минута на голосование
    gameState.playersWhoVoted = [];
    
    updateGameDisplay();
    startTimer();
}

function showResults() {
    gameState.gamePhase = 'results';
    // Логика подсчета голосов и исключения игроков
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

// Функции взаимодействия
function revealCharacteristic(playerId) {
    // Логика раскрытия характеристики
    console.log('Revealing characteristic for player:', playerId);
}

function voteForPlayer(playerId) {
    // Логика голосования
    console.log('Voting for player:', playerId);
}

function voteToSkip() {
    // Логика пропуска
    console.log('Voting to skip');
}

function showActionCard() {
    // Показать карты действий
    console.log('Showing action cards');
}

function useActionCard(cardId) {
    // Использовать карту действия
    console.log('Using action card:', cardId);
}

// Заглушки для модальных окон
function closeActionCardModal() {}
function closeTargetSelectionModal() {}
function closeCharacteristicSelectionModal() {}

// Проверка загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded');
    
    const playerNameInput = document.getElementById('playerName');
    console.log('PlayerName input found:', !!playerNameInput);
    
    if (!playerNameInput) {
        console.error('❌ PlayerName input not found in HTML!');
    }
});

console.log('Client.js loaded with full game logic');