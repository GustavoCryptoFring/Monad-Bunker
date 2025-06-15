let gameState = {
    players: [],
    currentRound: 1,
    gamePhase: 'login', // login, room-setup, waiting, playing, discussion, voting, ended
    votingResults: {},
    maxRounds: 3,
    currentPlayerName: '',
    currentPlayerId: null,
    roomCode: '',
    maxPlayers: 8,
    isRoomHost: false,
    currentTurnPlayerId: null,
    revealedThisRound: 0,
    timer: null,
    timeLeft: 0,
    playersWhoVoted: [],
    skipVotes: 0,
    playersToEliminateNextRound: 0
};

// Список имен для NPC (если нужны боты)
const npcNames = [
    'Александр', 'Мария', 'Дмитрий', 'Анна', 'Максим', 'Елена', 'Андрей', 'Ольга',
    'Сергей', 'Наталья', 'Владимир', 'Татьяна', 'Алексей', 'Ирина', 'Михаил', 'Светлана'
];

// Карты действий
const actionCards = [
    {
        id: 'double_vote',
        name: 'Двойной голос',
        description: 'Имеет двойную силу голоса при голосовании',
        usage: 'voting',
        target: 'self'
    },
    {
        id: 'age_curse',
        name: 'Проклятие старости',
        description: 'Может состарить любого игрока на 20 лет при изгнании',
        usage: 'elimination',
        target: 'other'
    },
    {
        id: 'health_manipulation',
        name: 'Манипуляция здоровьем',
        description: 'Может вылечить себя или ухудшить здоровье другого',
        usage: 'anytime',
        target: 'any'
    },
    {
        id: 'age_swap',
        name: 'Обмен возрастом',
        description: 'Может поменяться возрастом с любым игроком',
        usage: 'anytime',
        target: 'other'
    },
    {
        id: 'card_replacement',
        name: 'Замена карточки',
        description: 'Может заменить одну карточку у другого игрока',
        usage: 'anytime',
        target: 'other'
    },
    {
        id: 'health_swap',
        name: 'Обмен здоровьем',
        description: 'Может поменяться здоровьем с другим игроком',
        usage: 'anytime',
        target: 'other'
    },
    {
        id: 'steal_baggage',
        name: 'Кража багажа',
        description: 'Может украсть багаж у другого игрока',
        usage: 'anytime',
        target: 'other'
    }
];

const negativeHealthConditions = [
    'Карликовость', 'Аутизм', 'Слепота', 'Паралич ног', 'Немота', 
    'Глухота', 'Эпилепсия', 'Шизофрения', 'Деменция', 'Рак'
];

function generateRoomCode() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
}

function createRoom() {
    const playerName = document.getElementById('playerName').value.trim();
    if (!playerName) {
        alert('Пожалуйста, введите ваше имя!');
        return;
    }

    gameState.currentPlayerName = playerName;
    gameState.roomCode = generateRoomCode();
    gameState.isRoomHost = true;
    gameState.gamePhase = 'room-setup';
    
    // Создаем первого игрока (хоста)
    gameState.players = [{
        id: 0,
        name: playerName,
        isHost: true,
        characteristics: null,
        revealedCharacteristics: [],
        eliminated: false,
        votesAgainst: 0,
        revealedThisRound: 0,
        actionCard: null,
        actionCardUsed: false
    }];
    gameState.currentPlayerId = 0;

    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('roomSetup').style.display = 'block';
    
    updateRoomDisplay();
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

    gameState.currentPlayerName = playerName;
    gameState.roomCode = roomCode;
    gameState.isRoomHost = false;
    gameState.gamePhase = 'waiting';
    
    simulateJoinExistingRoom(playerName);
}

function simulateJoinExistingRoom(playerName) {
    gameState.maxPlayers = 8;
    gameState.players = [
        { id: 0, name: 'Хост комнаты', isHost: true, characteristics: null, revealedCharacteristics: [], eliminated: false, votesAgainst: 0, revealedThisRound: 0, actionCard: null, actionCardUsed: false },
        { id: 1, name: playerName, isHost: false, characteristics: null, revealedCharacteristics: [], eliminated: false, votesAgainst: 0, revealedThisRound: 0, actionCard: null, actionCardUsed: false }
    ];
    gameState.currentPlayerId = 1;

    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('roomSetup').style.display = 'block';
    
    updateRoomDisplay();
}

function updateRoomDisplay() {
    document.getElementById('roomCode').textContent = gameState.roomCode;
    document.getElementById('currentPlayersCount').textContent = gameState.players.length;
    document.getElementById('maxPlayersCount').textContent = gameState.maxPlayers;
    
    const playersList = document.getElementById('playersList');
    playersList.innerHTML = gameState.players.map(player => 
        `<li class="${player.isHost ? 'host' : ''}">${player.name} ${player.isHost ? '(Хост)' : ''}</li>`
    ).join('');
    
    const startBtn = document.getElementById('startGameBtn');
    const canStart = gameState.isRoomHost && gameState.players.length >= 4;
    startBtn.disabled = !canStart;
    startBtn.textContent = gameState.players.length < 4 ? 
        `Начать игру (минимум 4 игрока)` : 
        `Начать игру (${gameState.players.length}/${gameState.maxPlayers})`;
}

function copyRoomCode() {
    navigator.clipboard.writeText(gameState.roomCode).then(() => {
        alert('Код комнаты скопирован в буфер обмена!');
    }).catch(() => {
        const textArea = document.createElement('textarea');
        textArea.value = gameState.roomCode;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Код комнаты скопирован!');
    });
}

function updateMaxPlayers() {
    if (!gameState.isRoomHost) return;
    
    const newMax = parseInt(document.getElementById('maxPlayers').value);
    gameState.maxPlayers = newMax;
    updateRoomDisplay();
}

function generateCharacter() {
    const professions = [
        'Врач', 'Инженер', 'Учитель', 'Строитель', 'Повар', 'Механик',
        'Программист', 'Ветеринар', 'Юрист', 'Пилот', 'Фермер', 'Художник',
        'Музыкант', 'Полицейский', 'Пожарный', 'Электрик', 'Сантехник', 'Психолог'
    ];

    const healthConditions = [
        'Здоров', 'Астма', 'Диабет', 'Гипертония', 'Аллергия на пыльцу',
        'Близорукость', 'Хроническая усталость', 'Мигрень', 'Артрит',
        'Депрессия', 'Бессонница', 'Сколиоз', 'Варикоз', 'Гастрит'
    ];

    const hobbies = [
        'Чтение', 'Рисование', 'Музыка', 'Спорт', 'Готовка', 'Садоводство',
        'Фотография', 'Путешествия', 'Коллекционирование', 'Танцы',
        'Рыбалка', 'Охота', 'Шахматы', 'Видеоигры', 'Йога', 'Медитация'
    ];

    const phobias = [
        'Арахнофобия (пауки)', 'Клаустрофобия (замкнутые пространства)',
        'Акрофобия (высота)', 'Аквафобия (вода)', 'Социофобия',
        'Агорафобия (толпы)', 'Никтофобия (темнота)', 'Авиафобия (полеты)',
        'Офидиофобия (змеи)', 'Трипанофобия (иглы)', 'Гемофобия (кровь)',
        'Некрофобия (смерть)', 'Автомобилефобия', 'Кинофобия (собаки)'
    ];

    const luggage = [
        'Рюкзак с инструментами', 'Медицинская аптечка', 'Консервы на неделю',
        'Спальный мешок', 'Портативное радио', 'Солнечная батарея',
        'Книга рецептов', 'Семена растений', 'Музыкальный инструмент',
        'Спортивное снаряжение', 'Лекарства', 'Документы', 'Фотоаппарат',
        'Ноутбук', 'Швейная машинка', 'Удочка', 'Палатка', 'Компас'
    ];

    const facts = [
        'Знает несколько языков', 'Имеет водительские права', 'Умеет готовить',
        'Служил в армии', 'Имеет высшее образование', 'Умеет плавать',
        'Знает первую помощь', 'Умеет водить мотоцикл', 'Владеет боевыми искусствами',
        'Имеет опыт выживания', 'Умеет шить', 'Знает электронику',
        'Имеет педагогический опыт', 'Владеет оружием', 'Умеет ремонтировать технику',
        'Знает психологию', 'Имеет лидерские качества', 'Умеет торговаться'
    ];

    const genders = ['Мужчина', 'Женщина'];
    const gender = genders[Math.floor(Math.random() * genders.length)];
    const age = Math.floor(Math.random() * (105 - 18 + 1)) + 18;
    const biology = `${gender}, ${age} лет`;

    const shuffledFacts = [...facts].sort(() => Math.random() - 0.5);

    return {
        'Профессия': professions[Math.floor(Math.random() * professions.length)],
        'Здоровье': healthConditions[Math.floor(Math.random() * healthConditions.length)],
        'Хобби': hobbies[Math.floor(Math.random() * hobbies.length)],
        'Фобия': phobias[Math.floor(Math.random() * phobias.length)],
        'Багаж': luggage[Math.floor(Math.random() * luggage.length)],
        'Факт 1': shuffledFacts[0],
        'Факт 2': shuffledFacts[1],
        'Биология': biology
    };
}

function assignActionCards() {
    // 70% игроков получают карты действий
    const playersToReceiveCards = Math.floor(gameState.players.length * 0.7);
    const shuffledPlayers = [...gameState.players].sort(() => Math.random() - 0.5);
    const shuffledActionCards = [...actionCards].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < playersToReceiveCards && i < shuffledPlayers.length; i++) {
        shuffledPlayers[i].actionCard = shuffledActionCards[i % shuffledActionCards.length];
        shuffledPlayers[i].actionCardUsed = false;
    }
}

function startGame() {
    if (!gameState.isRoomHost) return;
    if (gameState.players.length < 4) {
        alert('Для начала игры нужно минимум 4 игрока!');
        return;
    }

    gameState.players.forEach(player => {
        player.characteristics = generateCharacter();
        player.revealedThisRound = 0;
    });

    // Раздаем карты действий
    assignActionCards();

    gameState.currentRound = 1;
    gameState.gamePhase = 'playing';
    gameState.votingResults = {};
    gameState.currentTurnPlayerId = 0;
    gameState.playersToEliminateNextRound = 1;

    document.getElementById('roomSetup').style.display = 'none';
    document.getElementById('gameBoard').style.display = 'block';

    startPlayerTurn();
}

function showActionCard(playerId) {
    if (gameState.currentPlayerId !== playerId) return;
    
    const player = gameState.players.find(p => p.id === playerId);
    if (!player || !player.actionCard || player.actionCardUsed) return;

    const modal = document.getElementById('actionCardModal');
    document.getElementById('actionCardName').textContent = player.actionCard.name;
    document.getElementById('actionCardDescription').textContent = player.actionCard.description;
    
    const useBtn = document.getElementById('useActionCardBtn');
    const canUse = canUseActionCard(player.actionCard);
    
    useBtn.disabled = !canUse;
    useBtn.onclick = () => useActionCard(playerId);
    
    if (!canUse) {
        const reason = getActionCardUsageReason(player.actionCard);
        document.getElementById('actionCardDescription').textContent += `\n\n${reason}`;
    }
    
    modal.style.display = 'block';
}

function canUseActionCard(actionCard) {
    switch (actionCard.usage) {
        case 'voting':
            return gameState.gamePhase === 'voting';
        case 'elimination':
            return false; // Используется автоматически при изгнании
        case 'anytime':
            return gameState.gamePhase === 'playing' || gameState.gamePhase === 'discussion';
        default:
            return false;
    }
}

function getActionCardUsageReason(actionCard) {
    switch (actionCard.usage) {
        case 'voting':
            return 'Можно использовать только во время голосования';
        case 'elimination':
            return 'Используется автоматически при изгнании';
        case 'anytime':
            return gameState.gamePhase === 'voting' ? 'Нельзя использовать во время голосования' : '';
        default:
            return 'Карта недоступна';
    }
}

function useActionCard(playerId) {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player || !player.actionCard || player.actionCardUsed) return;

    const actionCard = player.actionCard;
    closeActionCardModal();

    switch (actionCard.id) {
        case 'double_vote':
            useDoubleVote(playerId);
            break;
        case 'health_manipulation':
            showHealthManipulationOptions(playerId);
            break;
        case 'age_swap':
            showAgeSwapOptions(playerId);
            break;
        case 'card_replacement':
            showCardReplacementOptions(playerId);
            break;
        case 'health_swap':
            showHealthSwapOptions(playerId);
            break;
        case 'steal_baggage':
            showStealBaggageOptions(playerId);
            break;
    }
}

function useDoubleVote(playerId) {
    const player = gameState.players.find(p => p.id === playerId);
    player.actionCardUsed = true;
    player.doubleVote = true;
    alert('Двойной голос активирован! Ваш голос будет засчитан дважды.');
    updatePlayersDisplay();
}

function showHealthManipulationOptions(playerId) {
    const modal = document.getElementById('targetSelectionModal');
    const title = document.getElementById('targetSelectionTitle');
    const options = document.getElementById('targetSelectionOptions');
    
    title.textContent = 'Манипуляция здоровьем';
    
    let optionsHtml = '<button onclick="healSelf(' + playerId + ')">Вылечить себя</button>';
    
    const alivePlayers = gameState.players.filter(p => !p.eliminated && p.id !== playerId);
    alivePlayers.forEach(player => {
        optionsHtml += `<button onclick="harmPlayer(${playerId}, ${player.id})">${player.name} - ухудшить здоровье</button>`;
    });
    
    options.innerHTML = optionsHtml;
    modal.style.display = 'block';
}

function healSelf(playerId) {
    const player = gameState.players.find(p => p.id === playerId);
    player.characteristics['Здоровье'] = 'Здоров';
    player.actionCardUsed = true;
    
    closeTargetSelectionModal();
    alert('Вы полностью излечились!');
    updatePlayersDisplay();
}

function harmPlayer(userId, targetId) {
    const user = gameState.players.find(p => p.id === userId);
    const target = gameState.players.find(p => p.id === targetId);
    
    const randomCondition = negativeHealthConditions[Math.floor(Math.random() * negativeHealthConditions.length)];
    target.characteristics['Здоровье'] = randomCondition;
    user.actionCardUsed = true;
    
    closeTargetSelectionModal();
    alert(`Здоровье игрока ${target.name} ухудшено!`);
    updatePlayersDisplay();
}

function showAgeSwapOptions(playerId) {
    const modal = document.getElementById('targetSelectionModal');
    const title = document.getElementById('targetSelectionTitle');
    const options = document.getElementById('targetSelectionOptions');
    
    title.textContent = 'Обмен возрастом';
    
    let optionsHtml = '';
    const alivePlayers = gameState.players.filter(p => 
        !p.eliminated && 
        p.id !== playerId && 
        p.revealedCharacteristics.includes('Биология')
    );
    
    if (alivePlayers.length === 0) {
        optionsHtml = '<p>Нет игроков с раскрытым возрастом</p>';
    } else {
        alivePlayers.forEach(player => {
            optionsHtml += `<button onclick="swapAge(${playerId}, ${player.id})">${player.name} - ${player.characteristics['Биология']}</button>`;
        });
    }
    
    options.innerHTML = optionsHtml;
    modal.style.display = 'block';
}

function swapAge(userId, targetId) {
    const user = gameState.players.find(p => p.id === userId);
    const target = gameState.players.find(p => p.id === targetId);
    
    // Извлекаем возраст из биологии
    const userBio = user.characteristics['Биология'];
    const targetBio = target.characteristics['Биология'];
    
    const userAge = userBio.match(/(\d+) лет/)[1];
    const targetAge = targetBio.match(/(\d+) лет/)[1];
    
    const userGender = userBio.split(',')[0];
    const targetGender = targetBio.split(',')[0];
    
    user.characteristics['Биология'] = `${userGender}, ${targetAge} лет`;
    target.characteristics['Биология'] = `${targetGender}, ${userAge} лет`;
    
    user.actionCardUsed = true;
    
    closeTargetSelectionModal();
    alert(`Вы поменялись возрастом с игроком ${target.name}!`);
    updatePlayersDisplay();
}

function showCardReplacementOptions(playerId) {
    const modal = document.getElementById('targetSelectionModal');
    const title = document.getElementById('targetSelectionTitle');
    const options = document.getElementById('targetSelectionOptions');
    
    title.textContent = 'Замена карточки';
    
    let optionsHtml = '';
    const alivePlayers = gameState.players.filter(p => !p.eliminated && p.id !== playerId);
    
    alivePlayers.forEach(player => {
        optionsHtml += `<button onclick="showCharacteristicSelection(${playerId}, ${player.id})">${player.name}</button>`;
    });
    
    options.innerHTML = optionsHtml;
    modal.style.display = 'block';
}

function showCharacteristicSelection(userId, targetId) {
    const modal = document.getElementById('characteristicSelectionModal');
    const title = document.getElementById('characteristicSelectionTitle');
    const options = document.getElementById('characteristicSelectionOptions');
    
    const target = gameState.players.find(p => p.id === targetId);
    title.textContent = `Выберите характеристику игрока ${target.name}`;
    
    const characteristics = ['Профессия', 'Здоровье', 'Хобби', 'Фобия', 'Багаж', 'Факт 1', 'Факт 2'];
    let optionsHtml = '';
    
    characteristics.forEach(char => {
        optionsHtml += `<button onclick="replaceCharacteristic(${userId}, ${targetId}, '${char}')">${char}</button>`;
    });
    
    options.innerHTML = optionsHtml;
    modal.style.display = 'block';
}

function replaceCharacteristic(userId, targetId, characteristic) {
    const user = gameState.players.find(p => p.id === userId);
    const target = gameState.players.find(p => p.id === targetId);
    
    // Генерируем новую случайную характеристику
    const newCharacteristics = generateCharacter();
    target.characteristics[characteristic] = newCharacteristics[characteristic];
    
    user.actionCardUsed = true;
    
    closeCharacteristicSelectionModal();
    alert(`Характеристика "${characteristic}" игрока ${target.name} была заменена!`);
    updatePlayersDisplay();
}

function showHealthSwapOptions(playerId) {
    const modal = document.getElementById('targetSelectionModal');
    const title = document.getElementById('targetSelectionTitle');
    const options = document.getElementById('targetSelectionOptions');
    
    title.textContent = 'Обмен здоровьем';
    
    let optionsHtml = '';
    const alivePlayers = gameState.players.filter(p => 
        !p.eliminated && 
        p.id !== playerId && 
        p.revealedCharacteristics.includes('Здоровье')
    );
    
    if (alivePlayers.length === 0) {
        optionsHtml = '<p>Нет игроков с раскрытым здоровьем</p>';
    } else {
        alivePlayers.forEach(player => {
            optionsHtml += `<button onclick="swapHealth(${playerId}, ${player.id})">${player.name} - ${player.characteristics['Здоровье']}</button>`;
        });
    }
    
    options.innerHTML = optionsHtml;
    modal.style.display = 'block';
}

function swapHealth(userId, targetId) {
    const user = gameState.players.find(p => p.id === userId);
    const target = gameState.players.find(p => p.id === targetId);
    
    const temp = user.characteristics['Здоровье'];
    user.characteristics['Здоровье'] = target.characteristics['Здоровье'];
    target.characteristics['Здоровье'] = temp;
    
    user.actionCardUsed = true;
    
    closeTargetSelectionModal();
    alert(`Вы поменялись здоровьем с игроком ${target.name}!`);
    updatePlayersDisplay();
}

function showStealBaggageOptions(playerId) {
    const modal = document.getElementById('targetSelectionModal');
    const title = document.getElementById('targetSelectionTitle');
    const options = document.getElementById('targetSelectionOptions');
    
    title.textContent = 'Кража багажа';
    
    let optionsHtml = '';
    const alivePlayers = gameState.players.filter(p => !p.eliminated && p.id !== playerId);
    
    alivePlayers.forEach(player => {
        optionsHtml += `<button onclick="stealBaggage(${playerId}, ${player.id})">${player.name}</button>`;
    });
    
    options.innerHTML = optionsHtml;
    modal.style.display = 'block';
}

function stealBaggage(userId, targetId) {
    const user = gameState.players.find(p => p.id === userId);
    const target = gameState.players.find(p => p.id === targetId);
    
    // Добавляем багаж жертвы к багажу пользователя
    const stolenBaggage = target.characteristics['Багаж'];
    user.characteristics['Багаж'] += `, ${stolenBaggage}`;
    target.characteristics['Багаж'] = 'Нет багажа';
    
    user.actionCardUsed = true;
    
    closeTargetSelectionModal();
    alert(`Вы украли багаж у игрока ${target.name}!`);
    updatePlayersDisplay();
}

function closeActionCardModal() {
    document.getElementById('actionCardModal').style.display = 'none';
}

function closeTargetSelectionModal() {
    document.getElementById('targetSelectionModal').style.display = 'none';
}

function closeCharacteristicSelectionModal() {
    document.getElementById('characteristicSelectionModal').style.display = 'none';
}

// Добавляем обработчики для закрытия модальных окон по клику на фон
document.addEventListener('click', function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
});

// Добавляем обработчик для закрытия модальных окон по клавише Escape
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (modal.style.display === 'block') {
                modal.style.display = 'none';
            }
        });
    }
});

function createPlayerCard(player) {
    const isCurrentPlayer = gameState.currentPlayerId === player.id;
    const isCurrentTurn = gameState.currentTurnPlayerId === player.id && gameState.gamePhase === 'playing';
    const canInteract = isCurrentPlayer && !player.eliminated && isCurrentTurn;
    const isVotingPhase = gameState.gamePhase === 'voting';
    const hasVoted = gameState.playersWhoVoted.includes(player.id);
    
    return `
        <div class="player-card ${player.eliminated ? 'eliminated' : ''} ${isCurrentPlayer ? 'current-player' : ''} ${isCurrentTurn ? 'current-turn' : ''}" 
             data-player-id="${player.id}">
            <div class="player-header">
                <div class="player-info">
                    <div class="player-avatar-container">
                        <div class="player-avatar ${player.eliminated ? 'eliminated-avatar' : ''}">
                            ${getPlayerEmoji(player.id)}
                        </div>
                        ${player.actionCard ? `
                            <div class="action-card-indicator ${player.actionCardUsed ? 'used' : 'active'}" 
                                 onclick="${isCurrentPlayer ? `showActionCard(${player.id})` : ''}"
                                 title="${isCurrentPlayer ? player.actionCard.name : 'У игрока есть карта действия'}">
                                ⭐
                            </div>
                        ` : ''}
                        ${isVotingPhase && !player.eliminated ? `
                            <div class="vote-section">
                                <button class="vote-player-btn" onclick="voteForPlayer(${player.id})" 
                                        ${hasVoted ? 'disabled' : ''}>
                                    VOTE
                                </button>
                                <div class="voters-list">
                                    ${getVotersForPlayer(player.id)}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    <div>
                        <div class="player-name ${player.eliminated ? 'eliminated-name' : ''}">${player.name}</div>
                        <div class="player-biology">
                            <span onclick="${canInteract ? `revealCharacteristic(${player.id}, 'Биология')` : ''}" 
                                  class="biology-info ${player.revealedCharacteristics.includes('Биология') ? 'revealed' : ''} ${canInteract ? 'clickable' : ''}">
                                ${getCharacteristicDisplay(player, 'Биология', isCurrentPlayer)}
                            </span>
                        </div>
                        ${player.eliminated ? '<div class="eliminated-status">ИСКЛЮЧЕН</div>' : ''}
                        ${isCurrentPlayer ? '<div class="player-status current">ВЫ</div>' : ''}
                        ${isCurrentTurn ? '<div class="player-status turn">ВАШ ХОД</div>' : ''}
                    </div>
                </div>
            </div>
            <ul class="characteristics">
                ${['Профессия', 'Здоровье', 'Хобби', 'Фобия', 'Багаж', 'Факт 1', 'Факт 2'].map(char => `
                    <li class="characteristic ${player.revealedCharacteristics.includes(char) ? 'revealed' : ''} ${isCurrentPlayer && !player.revealedCharacteristics.includes(char) ? 'own-hidden' : ''}" 
                        onclick="${canInteract && canRevealCharacteristic(player, char) ? `revealCharacteristic(${player.id}, '${char}')` : ''}">
                        <span class="characteristic-name">${char}</span>
                        <span class="characteristic-value">
                            ${getCharacteristicDisplay(player, char, isCurrentPlayer)}
                        </span>
                    </li>
                `).join('')}
            </ul>
            ${player.votesAgainst > 0 ? `<div class="votes-against">Голосов против: ${player.votesAgainst}</div>` : ''}
        </div>
    `;
}

function getCharacteristicDisplay(player, characteristic, isCurrentPlayer) {
    // Если характеристика раскрыта для всех - показываем всем
    if (player.revealedCharacteristics.includes(characteristic)) {
        return player.characteristics[characteristic];
    }
    
    // Если это текущий игрок - показываем ему его характеристики
    if (isCurrentPlayer && player.characteristics) {
        return `<span class="own-characteristic">${player.characteristics[characteristic]}</span>`;
    }
    
    // Для других игроков показываем заглушки
    if (characteristic === 'Биология') {
        return 'GA - ???';
    }
    return '???';
}

function voteForPlayer(targetId) {
    if (gameState.gamePhase !== 'voting') return;
    if (gameState.playersWhoVoted.includes(gameState.currentPlayerId)) return;
    
    const voter = gameState.players.find(p => p.id === gameState.currentPlayerId);
    const multiplier = voter.doubleVote ? 2 : 1;
    
    gameState.votingResults[gameState.currentPlayerId] = targetId;
    gameState.playersWhoVoted.push(gameState.currentPlayerId);
    
    // Считаем голоса с учетом двойного голосования
    const target = gameState.players.find(p => p.id === targetId);
    target.votesAgainst = (target.votesAgainst || 0) + multiplier;
    
    if (voter.doubleVote) {
        voter.doubleVote = false; // Используем двойной голос
        alert('Ваш двойной голос засчитан!');
    }
    
    updatePlayersDisplay();
    
    // Проверяем, проголосовали ли все
    const alivePlayers = gameState.players.filter(p => !p.eliminated);
    if (gameState.playersWhoVoted.length >= alivePlayers.length) {
        clearInterval(gameState.timer);
        endVoting();
    }
}

function startPlayerTurn() {
    const alivePlayers = gameState.players.filter(p => !p.eliminated);
    
    if (gameState.currentTurnPlayerId >= gameState.players.length || 
        gameState.players[gameState.currentTurnPlayerId].eliminated) {
        // Переходим к следующему живому игроку
        let nextPlayer = (gameState.currentTurnPlayerId + 1) % gameState.players.length;
        while (nextPlayer !== gameState.currentTurnPlayerId && gameState.players[nextPlayer].eliminated) {
            nextPlayer = (nextPlayer + 1) % gameState.players.length;
        }
        
        if (nextPlayer === gameState.currentTurnPlayerId || 
            alivePlayers.every(p => p.revealedThisRound >= 2)) {
            // Все игроки открыли карты, переходим к обсуждению
            startDiscussion();
            return;
        }
        
        gameState.currentTurnPlayerId = nextPlayer;
    }

    const currentPlayer = gameState.players[gameState.currentTurnPlayerId];
    if (currentPlayer.revealedThisRound >= 2) {
        // Игрок уже открыл максимум карт, переходим к следующему
        gameState.currentTurnPlayerId = (gameState.currentTurnPlayerId + 1) % gameState.players.length;
        startPlayerTurn();
        return;
    }

    // Запускаем таймер на 1 минуту для текущего игрока
    startTimer(60, `Ход игрока ${currentPlayer.name}`);
    updatePlayersDisplay();
    updateGameStatus(`Ход игрока ${currentPlayer.name}. Осталось открыть: ${2 - currentPlayer.revealedThisRound} карт`);
}

function startTimer(seconds, phase) {
    clearInterval(gameState.timer);
    gameState.timeLeft = seconds;
    
    const timerDisplay = document.getElementById('timerDisplay');
    const phaseDisplay = document.getElementById('phaseDisplay');
    
    if (timerDisplay) timerDisplay.textContent = formatTime(seconds);
    if (phaseDisplay) phaseDisplay.textContent = phase;
    
    gameState.timer = setInterval(() => {
        gameState.timeLeft--;
        if (timerDisplay) timerDisplay.textContent = formatTime(gameState.timeLeft);
        
        if (gameState.timeLeft <= 0) {
            clearInterval(gameState.timer);
            handleTimerEnd();
        }
    }, 1000);
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function handleTimerEnd() {
    switch (gameState.gamePhase) {
        case 'playing':
            // Время игрока закончилось, переходим к следующему
            gameState.currentTurnPlayerId = (gameState.currentTurnPlayerId + 1) % gameState.players.length;
            startPlayerTurn();
            break;
        case 'discussion':
            // Обсуждение закончилось, переходим к голосованию
            startVoting();
            break;
        case 'voting':
            // Голосование закончилось принудительно
            endVoting();
            break;
    }
}

function startDiscussion() {
    gameState.gamePhase = 'discussion';
    gameState.skipVotes = 0;
    
    // Сброс счетчика раскрытий для следующего раунда
    gameState.players.forEach(p => p.revealedThisRound = 0);
    
    updateGameStatus('Фаза обсуждения. Обсудите, кого исключить из бункера.');
    startTimer(300, 'Обсуждение'); // 5 минут
    
    // Показываем кнопку пропуска
    const skipBtn = document.getElementById('skipDiscussionBtn');
    if (skipBtn) {
        skipBtn.style.display = 'block';
        skipBtn.onclick = () => voteToSkip('discussion');
    }
    
    updatePlayersDisplay();
}

function startVoting() {
    gameState.gamePhase = 'voting';
    gameState.playersWhoVoted = [];
    gameState.votingResults = {};
    gameState.skipVotes = 0;
    
    const alivePlayers = gameState.players.filter(p => !p.eliminated);
    if (alivePlayers.length <= gameState.playersToEliminateNextRound) {
        endGame();
        return;
    }
    
    updateGameStatus('Фаза голосования. Выберите игроков для исключения.');
    startTimer(60, 'Голосование'); // 1 минута
    
    // Показываем кнопку пропуска
    const skipBtn = document.getElementById('skipVotingBtn');
    if (skipBtn) {
        skipBtn.style.display = 'block';
        skipBtn.onclick = () => voteToSkip('voting');
    }
    
    updatePlayersDisplay();
}

function voteToSkip(phase) {
    gameState.skipVotes++;
    const alivePlayers = gameState.players.filter(p => !p.eliminated);
    const requiredVotes = Math.ceil(alivePlayers.length / 2);
    
    if (gameState.skipVotes >= requiredVotes) {
        clearInterval(gameState.timer);
        
        if (phase === 'discussion') {
            startVoting();
        } else if (phase === 'voting') {
            // Пропускаем голосование, но удваиваем количество исключений
            gameState.playersToEliminateNextRound *= 2;
            nextRound();
        }
    } else {
        updateGameStatus(`Голосов за пропуск: ${gameState.skipVotes}/${requiredVotes}`);
    }
}

function canRevealCharacteristic(player, characteristic) {
    if (gameState.gamePhase !== 'playing') return false;
    if (player.revealedThisRound >= 2) return false;
    
    // В первом раунде обязательно должна быть профессия
    if (gameState.currentRound === 1 && player.revealedThisRound === 0 && characteristic !== 'Профессия') {
        return false;
    }
    
    return true;
}

function getVotersForPlayer(playerId) {
    const voters = [];
    for (const [voterId, targetId] of Object.entries(gameState.votingResults)) {
        if (parseInt(targetId) === playerId) {
            const voter = gameState.players.find(p => p.id === parseInt(voterId));
            if (voter) voters.push(voter.name);
        }
    }
    return voters.join(', ');
}

function getPlayerEmoji(id) {
    const emojis = ['👨‍💼', '👩‍💼', '👨‍⚕️', '👩‍⚕️', '👨‍🔧', '👩‍🔧', '👨‍🎨', '👩‍🎨', '👨‍🚀', '👩‍🚀', '👨‍🏫', '👩‍🏫', '👨‍💻', '👩‍💻', '👨‍🍳', '👩‍🍳'];
    return emojis[id % emojis.length];
}

function revealCharacteristic(playerId, characteristic) {
    if (gameState.currentPlayerId !== playerId) return;
    if (gameState.gamePhase !== 'playing') return;
    if (gameState.currentTurnPlayerId !== playerId) return;
    
    const player = gameState.players.find(p => p.id === playerId);
    if (!player || player.eliminated) return;
    
    if (!canRevealCharacteristic(player, characteristic)) return;

    const validCharacteristics = ['Профессия', 'Здоровье', 'Хобби', 'Фобия', 'Багаж', 'Факт 1', 'Факт 2', 'Биология'];
    
    if (validCharacteristics.includes(characteristic)) {
        if (!player.revealedCharacteristics.includes(characteristic)) {
            player.revealedCharacteristics.push(characteristic);
            player.revealedThisRound++;
            
            // Если игрок открыл 2 карты, переходим к следующему
            if (player.revealedThisRound >= 2) {
                clearInterval(gameState.timer);
                gameState.currentTurnPlayerId = (gameState.currentTurnPlayerId + 1) % gameState.players.length;
                setTimeout(startPlayerTurn, 1000);
            }
            
            updatePlayersDisplay();
        }
    }
}

function updatePlayersDisplay() {
    const playersGrid = document.getElementById('playersGrid');
    const playerCount = gameState.players.length;
    
    playersGrid.className = `players-grid players-${playerCount}`;
    playersGrid.innerHTML = gameState.players.map(player => createPlayerCard(player)).join('');
}

function updateRoundInfo() {
    document.getElementById('currentRound').textContent = gameState.currentRound;
}

function updateGameStatus(status) {
    document.getElementById('gameStatus').textContent = status;
}

function endVoting() {
    // Подсчитываем голоса
    const voteCount = {};
    for (const targetId of Object.values(gameState.votingResults)) {
        voteCount[targetId] = (voteCount[targetId] || 0) + 1;
    }
    
    // Находим игроков с наибольшим количеством голосов
    const maxVotes = Math.max(...Object.values(voteCount));
    const playersToEliminate = Object.keys(voteCount)
        .filter(id => voteCount[id] === maxVotes)
        .map(id => parseInt(id))
        .slice(0, gameState.playersToEliminateNextRound);
    
    // Проверяем карты действий игроков, которые исключаются
    playersToEliminate.forEach(playerId => {
        const player = gameState.players.find(p => p.id === playerId);
        if (player && player.actionCard && player.actionCard.id === 'age_curse' && !player.actionCardUsed) {
            // Активируем проклятие старости
            showAgeCurseOptions(playerId);
        }
        if (player) {
            player.eliminated = true;
        }
    });
    
    // Скрываем кнопки пропуска
    const skipBtns = document.querySelectorAll('[id*="skip"]');
    skipBtns.forEach(btn => btn.style.display = 'none');
    
    gameState.playersToEliminateNextRound = 1; // Сброс на 1 для следующих раундов
    
    nextRound();
}

function showAgeCurseOptions(playerId) {
    const modal = document.getElementById('targetSelectionModal');
    const title = document.getElementById('targetSelectionTitle');
    const options = document.getElementById('targetSelectionOptions');
    
    title.textContent = 'Проклятие старости - выберите жертву';
    
    let optionsHtml = '';
    const alivePlayers = gameState.players.filter(p => !p.eliminated && p.id !== playerId);
    
    alivePlayers.forEach(player => {
        optionsHtml += `<button onclick="applyAgeCurse(${playerId}, ${player.id})">${player.name}</button>`;
    });
    
    options.innerHTML = optionsHtml;
    modal.style.display = 'block';
}

function applyAgeCurse(userId, targetId) {
    const user = gameState.players.find(p => p.id === userId);
    const target = gameState.players.find(p => p.id === targetId);
    
    // Добавляем 20 лет к возрасту цели
    const currentBio = target.characteristics['Биология'];
    if (target.revealedCharacteristics.includes('Биология')) {
        const age = parseInt(currentBio.match(/(\d+) лет/)[1]);
        const gender = currentBio.split(',')[0];
        target.characteristics['Биология'] = `${gender}, ${age + 20} лет`;
    } else {
        // Если возраст скрыт, просто добавляем к скрытому значению
        const hiddenAge = parseInt(currentBio.match(/(\d+) лет/)[1]) + 20;
        const gender = currentBio.split(',')[0];
        target.characteristics['Биология'] = `${gender}, ${hiddenAge} лет`;
    }
    
    user.actionCardUsed = true;
    
    closeTargetSelectionModal();
    alert(`${target.name} постарел на 20 лет!`);
    updatePlayersDisplay();
}

function nextRound() {
    gameState.currentRound++;
    gameState.gamePhase = 'playing';
    gameState.currentTurnPlayerId = 0;
    
    // Сброс статистики голосования
    gameState.votingResults = {};
    gameState.playersWhoVoted = [];
    gameState.players.forEach(p => {
        p.votesAgainst = 0;
        p.revealedThisRound = 0;
        p.doubleVote = false;
    });
    
    updatePlayersDisplay();
    updateRoundInfo();
    
    const alivePlayers = gameState.players.filter(p => !p.eliminated);
    if (alivePlayers.length <= 2 || gameState.currentRound > gameState.maxRounds) {
        endGame();
    } else {
        startPlayerTurn();
    }
}

function endGame() {
    clearInterval(gameState.timer);
    const alivePlayers = gameState.players.filter(p => !p.eliminated);
    alert(`Игра окончена! Выжившие игроки: ${alivePlayers.map(p => p.name).join(', ')}`);
    
    // Возврат к начальному экрану
    document.getElementById('gameBoard').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'block';
    
    // Сброс состояния
    gameState = {
        players: [],
        currentRound: 1,
        gamePhase: 'login',
        votingResults: {},
        maxRounds: 3,
        currentPlayerName: '',
        currentPlayerId: null,
        roomCode: '',
        maxPlayers: 8,
        isRoomHost: false,
        currentTurnPlayerId: null,
        revealedThisRound: 0,
        timer: null,
        timeLeft: 0,
        playersWhoVoted: [],
        skipVotes: 0,
        playersToEliminateNextRound: 0
    };
}

// Симуляция добавления новых игроков (для демонстрации)
function simulatePlayerJoin() {
    if (gameState.players.length >= gameState.maxPlayers) return;
    
    const newPlayer = {
        id: gameState.players.length,
        name: npcNames[Math.floor(Math.random() * npcNames.length)],
        isHost: false,
        characteristics: null,
        revealedCharacteristics: [],
        eliminated: false,
        votesAgainst: 0,
        revealedThisRound: 0,
        actionCard: null,
        actionCardUsed: false
    };
    
    gameState.players.push(newPlayer);
    updateRoomDisplay();
}

// ИСПРАВЛЕНИЕ: Убеждаемся, что обработчики событий правильно привязаны
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, adding event listeners...');
    
    const createRoomBtn = document.getElementById('createRoomBtn');
    const joinRoomBtn = document.getElementById('joinRoomBtn');
    const copyCodeBtn = document.getElementById('copyCodeBtn');
    const maxPlayersSelect = document.getElementById('maxPlayers');
    const startGameBtn = document.getElementById('startGameBtn');
    
    if (createRoomBtn) {
        createRoomBtn.addEventListener('click', createRoom);
        console.log('Create room button listener added');
    } else {
        console.error('Create room button not found!');
    }
    
    if (joinRoomBtn) {
        joinRoomBtn.addEventListener('click', joinRoom);
        console.log('Join room button listener added');
    } else {
        console.error('Join room button not found!');
    }
    
    if (copyCodeBtn) {
        copyCodeBtn.addEventListener('click', copyRoomCode);
    }
    
    if (maxPlayersSelect) {
        maxPlayersSelect.addEventListener('change', updateMaxPlayers);
    }
    
    if (startGameBtn) {
        startGameBtn.addEventListener('click', startGame);
    }
    
    // Симуляция: добавляем игроков каждые 3 секунды для демонстрации
    setInterval(() => {
        if (gameState.gamePhase === 'room-setup' && Math.random() > 0.7) {
            simulatePlayerJoin();
        }
    }, 3000);
});

// ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА: Добавляем обработчики прямо в HTML для отладки
window.createRoom = createRoom;
window.joinRoom = joinRoom;
window.copyRoomCode = copyRoomCode;
window.updateMaxPlayers = updateMaxPlayers;
window.startGame = startGame;
window.revealCharacteristic = revealCharacteristic;
window.voteForPlayer = voteForPlayer;
window.voteToSkip = voteToSkip;
window.showActionCard = showActionCard;
window.useActionCard = useActionCard;
window.closeActionCardModal = closeActionCardModal;
window.closeTargetSelectionModal = closeTargetSelectionModal;
window.closeCharacteristicSelectionModal = closeCharacteristicSelectionModal;
window.healSelf = healSelf;
window.harmPlayer = harmPlayer;
window.swapAge = swapAge;
window.showCharacteristicSelection = showCharacteristicSelection;
window.replaceCharacteristic = replaceCharacteristic;
window.swapHealth = swapHealth;
window.stealBaggage = stealBaggage;
window.applyAgeCurse = applyAgeCurse;