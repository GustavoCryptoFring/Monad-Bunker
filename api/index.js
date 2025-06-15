import { Server } from 'socket.io'

let io
const rooms = new Map()

function generateRoomCode() {
    return Math.random().toString(36).substr(2, 6).toUpperCase()
}

export default function handler(req, res) {
    if (!res.socket.server.io) {
        console.log('Запуск Socket.IO сервера...')
        io = new Server(res.socket.server)
        res.socket.server.io = io
        
        io.on('connection', (socket) => {
            console.log('Подключение:', socket.id)
            
            socket.on('createRoom', (data) => {
                const roomCode = generateRoomCode()
                const room = {
                    code: roomCode,
                    players: [{
                        id: 0,
                        name: data.playerName,
                        socketId: socket.id,
                        isHost: true
                    }]
                }
                rooms.set(roomCode, room)
                socket.join(roomCode)
                socket.emit('roomCreated', { roomCode, playerId: 0, isHost: true })
            })
            
            socket.on('joinRoom', (data) => {
                const room = rooms.get(data.roomCode)
                if (room && room.players.length < 8) {
                    const newPlayer = {
                        id: room.players.length,
                        name: data.playerName,
                        socketId: socket.id,
                        isHost: false
                    }
                    room.players.push(newPlayer)
                    socket.join(data.roomCode)
                    socket.emit('roomJoined', { roomCode: data.roomCode, playerId: newPlayer.id })
                } else {
                    socket.emit('error', { message: 'Комната не найдена или заполнена' })
                }
            })
        })
    }
    res.end()
}