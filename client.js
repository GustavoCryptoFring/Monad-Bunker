const socket = io();

let gameState = {
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
    timeLeft: 0,
    playersWhoVoted: [],
    skipVotes: 0,
    myCharacteristics: null,
    myActionCard: null
};

// Обработчики событий от сервера
socket.on('roomCreated', (data) => {
    gameState.roomCode = data.roomCode;
    gameState.currentPlayerId = data.playerId;
    gameState.isRoomHost = data.isHost;
    gameState.gamePhase = 'room-setup';
    
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('roomSetup').style.display = 'block';
    
    updateRoomDisplay();
    
    // Показываем субдомен для удобства
    alert(`Комната создана!\nСубдомен: ${data.subdomain}\nИли используйте код: ${data.roomCode}`);
});

socket.on('roomJoined', (data) => {
    gameState.roomCode = data.roomCode;
    gameState.currentPlayerId = data.playerId;
    gameState.isRoomHost = data.isHost;
    gameState.gamePhase = 'room-setup';
    
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('roomSetup').style.display = 'block';
    
    updateRoomDisplay();
});

socket.on('roomUpdate', (data) => {
    gameState.players = data.players;
    gameState.maxPlayers = data.maxPlayers;
    updateRoomDisplay();
});

socket.on('gameStarted', (data) => {
    gameState.gamePhase = 'playing';
    gameState.currentRound = data.gameState.currentRound;
    
    document.getElementById('roomSetup').style.display = 'none';
    document.getElementById('gameBoard').style.display = 'block';
    
    updateRoundInfo();
    updatePlayersDisplay();
});

socket.on('playerData', (data) => {
    gameState.myCharacteristics = data.characteristics;
    gameState.myActionCard = data.actionCard;
    updatePlayersDisplay();
});

socket.on('playerTurnStarted', (data) => {
    gameState.currentTurnPlayerId = data.currentTurnPlayerId;
    gameState.timeLeft = data.timeLeft;
    updateGameStatus(`Ход игрока ${data.playerName}`);
    updatePlayersDisplay();
});

socket.on('characteristicRevealed', (data) => {
    const player = gameState.players.find(p => p.id === data.playerId);
    if (player) {
        if (!player.revealedCharacteristics) {
            player.revealedCharacteristics = [];
        }
        if (!player.revealedCharacteristics.includes(data.characteristic)) {
            player.revealedCharacteristics.push(data.characteristic);
        }
        player.revealedThisRound = data.revealedThisRound;
    }
    updatePlayersDisplay();
});

socket.on('discussionStarted', (data) => {
    gameState.gamePhase = 'discussion';
    gameState.timeLeft = data.timeLeft;
    updateGameStatus('Фаза обсуждения');
    document.getElementById('skipDiscussionBtn').style.display = 'block';
    updatePlayersDisplay();
});

socket.on('votingStarted', (data) => {
    gameState.gamePhase = 'voting';
    gameState.timeLeft = data.timeLeft;
    gameState.playersWhoVoted = [];
    updateGameStatus('Фаза голосования');
    document.getElementById('skipVotingBtn').style.display = 'block';
    updatePlayersDisplay();
});

socket.on('voteUpdate', (data) => {
    gameState.playersWhoVoted = data.playersWhoVoted;
    updatePlayersDisplay();
});

socket.on('playersEliminated', (data) => {
    data.eliminatedPlayers.forEach(playerId => {
        const player = gameState.players.find(p => p.id === playerId);
        if (player) {
            player.eliminated = true;
        }
    });
    updatePlayersDisplay();
});

socket.on('roundStarted', (data) => {
    gameState.currentRound = data.currentRound;
    gameState.gamePhase = 'playing';
    updateRoundInfo();
    updatePlayersDisplay();
});

socket.on('gameEnded', (data) => {
    const survivorNames = data.survivors.map(s => s.name).join(', ');
    alert(`Игра окончена!\nВыжившие: ${survivorNames}`);
    
    // Возврат к главному экрану
    setTimeout(() => {
        location.reload();
    }, 5000);
});

socket.on('timerUpdate', (data) => {
    gameState.timeLeft = data.timeLeft;
    updateTimer(data.timeLeft, data.phase);
});

socket.on('skipVoteUpdate', (data) => {
    updateGameStatus(`Голосов за пропуск: ${data.skipVotes}/${data.requiredVotes}`);
});

socket.on('actionCardUsed', (data) => {
    const player = gameState.players.find(p => p.id === data.playerId);
    if (player) {
        player.actionCardUsed = true;
    }
    updatePlayersDisplay();
});

socket.on('playerDisconnected', (data) => {
    alert(`Игрок ${data.playerName} отключился`);
    // Игрок будет удален из списка через roomUpdate
});

socket.on('error', (data) => {
    alert(`Ошибка: ${data.message}`);
});

// Функции интерфейса
function createRoom() {
    const playerName = document.getElementById('playerName').value.trim();
    if (!playerName) {
        alert('Пожалуйста, введите ваше имя!');
        return;
    }
    gameState.currentPlayerName = playerName;
    socket.emit('createRoom', { playerName });
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
    socket.emit('joinRoom', { roomCode, playerName });
}

function updateMaxPlayers() {
    if (!gameState.isRoomHost) return;
    
    const maxPlayers = parseInt(document.getElementById('maxPlayers').value);
    socket.emit('updateMaxPlayers', { 
        roomCode: gameState.roomCode, 
        maxPlayers 
    });
}

function startGame() {
    if (!gameState.isRoomHost) return;
    socket.emit('startGame', { roomCode: gameState.roomCode });
}

function revealCharacteristic(playerId, characteristic) {
    if (gameState.currentPlayerId !== playerId) return;
    socket.emit('revealCharacteristic', { 
        roomCode: gameState.roomCode, 
        characteristic 
    });
}

function voteForPlayer(targetId) {
    socket.emit('voteForPlayer', { 
        roomCode: gameState.roomCode, 
        targetId 
    });
}

function voteToSkip(phase) {
    socket.emit('voteToSkip', { 
        roomCode: gameState.roomCode, 
        phase 
    });
}

function showActionCard(playerId) {
    if (gameState.currentPlayerId !== playerId || !gameState.myActionCard) return;
    
    document.getElementById('actionCardName').textContent = gameState.myActionCard.name;
    document.getElementById('actionCardDescription').textContent = gameState.myActionCard.description;
    document.getElementById('actionCardModal').style.display = 'block';
}

function useActionCard() {
    // Здесь нужна логика выбора цели в зависимости от типа карты
    // Пока просто закрываем модальное окно
    closeActionCardModal();
    
    socket.emit('useActionCard', { 
        roomCode: gameState.roomCode,
        targetId: null,
        additionalData: null
    });
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

// Вспомогательные функции
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

function updatePlayersDisplay() {
    const playersGrid = document.getElementById('playersGrid');
    if (!playersGrid) return;
    
    const playerCount = gameState.players.length;
    playersGrid.className = `players-grid players-${playerCount}`;
    playersGrid.innerHTML = gameState.players.map(player => createPlayerCard(player)).join('');
}

function createPlayerCard(player) {
    const isCurrentPlayer = gameState.currentPlayerId === player.id;
    const isCurrentTurn = gameState.currentTurnPlayerId === player.id && gameState.gamePhase === 'playing';
    const canInteract = isCurrentPlayer && !player.eliminated && isCurrentTurn;
    const isVotingPhase = gameState.gamePhase === 'voting';
    const hasVoted = gameState.playersWhoVoted.includes(gameState.currentPlayerId);
    
    return `
        <div class="player-card ${player.eliminated ? 'eliminated' : ''} ${isCurrentPlayer ? 'current-player' : ''} ${isCurrentTurn ? 'current-turn' : ''}" 
             data-player-id="${player.id}">
            <div class="player-header">
                <div class="player-info">
                    <div class="player-avatar-container">
                        <div class="player-avatar ${player.eliminated ? 'eliminated-avatar' : ''}">
                            ${getPlayerEmoji(player.id)}
                        </div>
                        ${(isCurrentPlayer && gameState.myActionCard) ? `
                            <div class="action-card-indicator ${player.actionCardUsed ? 'used' : 'active'}" 
                                 onclick="showActionCard(${player.id})"
                                 title="${gameState.myActionCard.name}">
                                ⭐
                            </div>
                        ` : (player.actionCard ? `
                            <div class="action-card-indicator ${player.actionCardUsed ? 'used' : 'active'}" 
                                 title="У игрока есть карта действия">
                                ⭐
                            </div>
                        ` : '')}
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
                                  class="biology-info ${player.revealedCharacteristics && player.revealedCharacteristics.includes('Биология') ? 'revealed' : ''} ${canInteract ? 'clickable' : ''}">
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
                    <li class="characteristic ${player.revealedCharacteristics && player.revealedCharacteristics.includes(char) ? 'revealed' : ''} ${isCurrentPlayer && (!player.revealedCharacteristics || !player.revealedCharacteristics.includes(char)) ? 'own-hidden' : ''}" 
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
    if (player.revealedCharacteristics && player.revealedCharacteristics.includes(characteristic)) {
        return `<span class="revealed-value">${player.revealedCharacteristics.includes(characteristic) ? '(известно всем)' : ''}</span>`;
    }
    
    // Если это текущий игрок - показываем ему его характеристики
    if (isCurrentPlayer && gameState.myCharacteristics) {
        return `<span class="own-characteristic">${gameState.myCharacteristics[characteristic]}</span>`;
    }
    
    // Для других игроков показываем заглушки
    if (characteristic === 'Биология') {
        return 'GA - ???';
    }
    return '???';
}

function canRevealCharacteristic(player, characteristic) {
    if (gameState.gamePhase !== 'playing') return false;
    if (player.revealedThisRound >= 2) return false;
    if (player.revealedCharacteristics && player.revealedCharacteristics.includes(characteristic)) return false;
    
    // В первом раунде обязательно должна быть профессия
    if (gameState.currentRound === 1 && player.revealedThisRound === 0 && characteristic !== 'Профессия') {
        return false;
    }
    
    return true;
}

function getVotersForPlayer(playerId) {
    // Эта информация будет приходить от сервера
    return '';
}

function getPlayerEmoji(id) {
    const emojis = ['👨‍💼', '👩‍💼', '👨‍⚕️', '👩‍⚕️', '👨‍🔧', '👩‍🔧', '👨‍🎨', '👩‍🎨', '👨‍🚀', '👩‍🚀', '👨‍🏫', '👩‍🏫', '👨‍💻', '👩‍💻', '👨‍🍳', '👩‍🍳'];
    return emojis[id % emojis.length];
}

function updateRoundInfo() {
    const roundElement = document.getElementById('currentRound');
    if (roundElement) {
        roundElement.textContent = gameState.currentRound;
    }
}

function updateGameStatus(status) {
    const statusElement = document.getElementById('gameStatus');
    if (statusElement) {
        statusElement.textContent = status;
    }
}

function updateTimer(timeLeft, phase) {
    const timerElement = document.getElementById('timerDisplay');
    const phaseElement = document.getElementById('phaseDisplay');
    
    if (timerElement) {
        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        timerElement.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    if (phaseElement) {
        const phaseNames = {
            'playing': 'Раскрытие карт',
            'discussion': 'Обсуждение', 
            'voting': 'Голосование'
        };
        phaseElement.textContent = phaseNames[phase] || phase;
    }
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

// Обработчики закрытия модальных окон
document.addEventListener('click', function(event) {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
});

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

// Глобальные функции для совместимости
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