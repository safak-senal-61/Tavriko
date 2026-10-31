"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSocketHandlers = setupSocketHandlers;
const shared_1 = require("@trivia/shared");
function setupSocketHandlers(io, roomManager, matchmaker) {
    // Wire up room manager callbacks to broadcast to rooms
    roomManager.onRoundStart = (roomCode, question) => {
        io.to(roomCode).emit(shared_1.SOCKET_EVENTS.QUESTION_START, question);
        // If there is an active simulated bot player in this room, trigger realistic response
        const room = roomManager.getRoom(roomCode);
        if (room) {
            const botPlayer = Object.values(room.players).find((p) => p.id.startsWith('rival_bot_'));
            if (botPlayer && !botPlayer.hasAnsweredCurrentRound) {
                // Realistic response delay between 2200ms and 5000ms
                const responseDelay = Math.floor(2200 + Math.random() * 2800);
                // ~80% accuracy chance
                const isBotCorrect = Math.random() < 0.8;
                const currentQ = room.currentQuestion;
                let botOptionId = currentQ?.correctOptionId || 'opt_a';
                if (!isBotCorrect && currentQ) {
                    const distractors = currentQ.options.filter((o) => o.id !== currentQ.correctOptionId);
                    if (distractors.length > 0) {
                        botOptionId = distractors[Math.floor(Math.random() * distractors.length)].id;
                    }
                }
                setTimeout(() => {
                    const checkRoom = roomManager.getRoom(roomCode);
                    if (checkRoom && checkRoom.status === 'question_active') {
                        const res = roomManager.submitAnswer(roomCode, botPlayer.id, botOptionId, Date.now());
                        if (res.accepted) {
                            io.to(roomCode).emit(shared_1.SOCKET_EVENTS.PLAYER_ANSWERED, {
                                playerId: botPlayer.id,
                                streak: res.streak,
                            });
                        }
                    }
                }, responseDelay);
            }
        }
    };
    roomManager.onRoundEnd = (roomCode, result) => {
        io.to(roomCode).emit(shared_1.SOCKET_EVENTS.ROUND_RESULT, result);
    };
    roomManager.onGameOver = (roomCode, summary) => {
        io.to(roomCode).emit(shared_1.SOCKET_EVENTS.GAME_OVER, summary);
    };
    roomManager.onStateSync = (roomCode, room) => {
        io.to(roomCode).emit(shared_1.SOCKET_EVENTS.ROOM_STATE_SYNC, room);
    };
    matchmaker.onMatchFound = (roomCode, players) => {
        if (players.length >= 2) {
            const p1 = players[0];
            const p2 = players[1];
            // Emit to p1 with p2 as opponent
            io.to(p1.socketId).emit(shared_1.SOCKET_EVENTS.MATCH_FOUND, {
                roomCode,
                opponent: {
                    id: p2.playerId,
                    displayName: p2.displayName,
                    avatarUrl: p2.avatarUrl,
                },
            });
            // Emit to p2 (if not bot) with p1 as opponent
            if (!p2.socketId.startsWith('bot_')) {
                io.to(p2.socketId).emit(shared_1.SOCKET_EVENTS.MATCH_FOUND, {
                    roomCode,
                    opponent: {
                        id: p1.playerId,
                        displayName: p1.displayName,
                        avatarUrl: p1.avatarUrl,
                    },
                });
            }
        }
    };
    // Socket connection map: socketId -> { playerId, roomCode }
    const socketMeta = new Map();
    io.on('connection', (socket) => {
        socket.on(shared_1.SOCKET_EVENTS.JOIN_ROOM, (data) => {
            const { roomCode, playerId, displayName, avatarUrl } = data;
            socketMeta.set(socket.id, { playerId, roomCode });
            socket.join(roomCode);
            let existingRoom = roomManager.getRoom(roomCode);
            if (!existingRoom) {
                // Room does not exist yet; auto-create with requester as host
                existingRoom = roomManager.createRoom({
                    code: roomCode,
                    hostId: playerId,
                    hostName: displayName,
                    avatarUrl,
                });
                io.to(roomCode).emit(shared_1.SOCKET_EVENTS.ROOM_STATE_SYNC, existingRoom);
                return;
            }
            if (existingRoom && existingRoom.players[playerId]) {
                // Reconnecting existing player
                const recovery = roomManager.reconnectPlayer(roomCode, playerId);
                io.to(roomCode).emit(shared_1.SOCKET_EVENTS.PLAYER_RECONNECTED, { playerId, displayName });
                io.to(roomCode).emit(shared_1.SOCKET_EVENTS.ROOM_STATE_SYNC, existingRoom);
                if (recovery.currentQuestion) {
                    socket.emit(shared_1.SOCKET_EVENTS.QUESTION_START, recovery.currentQuestion);
                }
            }
            else {
                const joinResult = roomManager.joinRoom(roomCode, {
                    playerId,
                    displayName,
                    avatarUrl,
                });
                if (joinResult.success && joinResult.room) {
                    io.to(roomCode).emit(shared_1.SOCKET_EVENTS.ROOM_STATE_SYNC, joinResult.room);
                }
                else {
                    socket.emit(shared_1.SOCKET_EVENTS.ERROR, { message: joinResult.error || 'Odaya katılınamadı' });
                }
            }
        });
        socket.on(shared_1.SOCKET_EVENTS.TOGGLE_READY, (data) => {
            const success = roomManager.toggleReady(data.roomCode, data.playerId);
            if (success) {
                const room = roomManager.getRoom(data.roomCode);
                if (room) {
                    io.to(data.roomCode).emit(shared_1.SOCKET_EVENTS.ROOM_STATE_SYNC, room);
                }
            }
        });
        socket.on(shared_1.SOCKET_EVENTS.START_GAME, (data) => {
            const started = roomManager.startGame(data.roomCode, data.playerId);
            if (started) {
                const room = roomManager.getRoom(data.roomCode);
                if (room) {
                    io.to(data.roomCode).emit(shared_1.SOCKET_EVENTS.ROOM_STATE_SYNC, room);
                }
            }
            else {
                socket.emit(shared_1.SOCKET_EVENTS.ERROR, { message: 'Oyun başlatılamadı' });
            }
        });
        socket.on(shared_1.SOCKET_EVENTS.SUBMIT_ANSWER, (data) => {
            const result = roomManager.submitAnswer(data.roomCode, data.playerId, data.selectedOptionId, data.clientTimestamp || Date.now());
            if (result.accepted) {
                io.to(data.roomCode).emit(shared_1.SOCKET_EVENTS.PLAYER_ANSWERED, {
                    playerId: data.playerId,
                    streak: result.streak,
                });
            }
        });
        socket.on(shared_1.SOCKET_EVENTS.FIND_MATCH, (data) => {
            matchmaker.enqueue({
                socketId: socket.id,
                playerId: data.playerId,
                displayName: data.displayName,
                avatarUrl: data.avatarUrl,
                mode: data.mode || 'duel',
                category: data.category || 'mixed',
                difficulty: data.difficulty || 'medium',
                queuedAt: Date.now(),
            });
        });
        socket.on(shared_1.SOCKET_EVENTS.CANCEL_MATCH, (data) => {
            matchmaker.dequeue(data.playerId);
        });
        socket.on(shared_1.SOCKET_EVENTS.SEND_EMOTE, (data) => {
            io.to(data.roomCode).emit(shared_1.SOCKET_EVENTS.EMOTE_RECEIVED, data);
        });
        socket.on('disconnect', () => {
            const meta = socketMeta.get(socket.id);
            if (meta) {
                matchmaker.dequeue(meta.playerId);
                if (meta.roomCode) {
                    roomManager.handlePlayerDisconnect(meta.roomCode, meta.playerId);
                    const room = roomManager.getRoom(meta.roomCode);
                    if (room) {
                        io.to(meta.roomCode).emit(shared_1.SOCKET_EVENTS.PLAYER_DISCONNECTED, { playerId: meta.playerId });
                        io.to(meta.roomCode).emit(shared_1.SOCKET_EVENTS.ROOM_STATE_SYNC, room);
                    }
                }
                socketMeta.delete(socket.id);
            }
        });
    });
}
