"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSocketHandlers = setupSocketHandlers;
const shared_1 = require("@trivia/shared");
const prismaClient_1 = require("../db/prismaClient");
const presenceManager_1 = require("../services/presenceManager");
const errorMonitor_1 = require("../utils/errorMonitor");
const node_crypto_1 = require("node:crypto");
const adminAccountOperations_1 = require("../services/adminAccountOperations");
const playerAccess_1 = require("../services/playerAccess");
const playerAnalytics_1 = require("../services/playerAnalytics");
function setupSocketHandlers(io, roomManager, matchmaker) {
    // Wire up room manager callbacks to broadcast to rooms
    roomManager.onRoundStart = (roomCode, question) => {
        io.to(roomCode).emit(shared_1.SOCKET_EVENTS.QUESTION_START, question);
        // If there is an active simulated bot player in this room, trigger realistic response
        const room = roomManager.getRoom(roomCode);
        if (room) {
            const botPlayer = Object.values(room.players).find((p) => p.isBot || p.id.startsWith('rival_bot_') || p.id.startsWith('bot_'));
            if (botPlayer && !botPlayer.hasAnsweredCurrentRound) {
                // Fast, realistic response delay between 1000ms and 2500ms
                const responseDelay = Math.floor(1000 + Math.random() * 1500);
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
    roomManager.onGameOver = (roomCode, summary, rewardCompletedPlayerIds) => {
        io.to(roomCode).emit(shared_1.SOCKET_EVENTS.GAME_OVER, summary);
        const verifiedPlayerIds = [...(io.sockets.adapter.rooms.get(roomCode) ?? [])].map(id => io.sockets.sockets.get(id)?.data.playerId)
            .filter((id) => typeof id === 'string');
        const category = roomManager.getRoom(roomCode)?.category;
        // Yerel Socket.IO modunda da sonuç sunucuda (istemciden bağımsız) kaydedilir
        void (async () => {
            await prismaClient_1.db.recordFinalMatch(summary);
            if (process.env.DATABASE_URL || process.env.DIRECT_URL) {
                await (0, playerAnalytics_1.recordCompletedPlayers)(prismaClient_1.db.rawClient, { ...summary, matchId: (0, node_crypto_1.randomUUID)(), verifiedPlayerIds, rewardCompletedPlayerIds, category });
            }
        })().catch(error => console.error('Match persistence failed', error));
    };
    roomManager.onStateSync = (roomCode, room) => {
        io.to(roomCode).emit(shared_1.SOCKET_EVENTS.ROOM_STATE_SYNC, room);
    };
    matchmaker.onMatchFound = (roomCode, players) => {
        (0, errorMonitor_1.addBreadcrumb)(`Eşleşme bulundu: ${roomCode}`, 'matchmaking', {
            roomCode,
            playerCount: players.length,
            matchedWith: players[1]?.playerId?.startsWith('bot_') || players[1]?.playerId?.startsWith('rival_bot_') ? 'bot' : 'human',
            queueSeconds: players[0]?.queuedAt ? Number(((Date.now() - players[0].queuedAt) / 1000).toFixed(1)) : undefined,
        });
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
    io.use((socket, next) => {
        if (!(0, adminAccountOperations_1.restrictionsEnabled)()) {
            next();
            return;
        }
        const playerId = (0, playerAccess_1.socketIdentity)(socket.handshake.auth?.token, socket.handshake.query.playerId);
        if (!playerId) {
            next(new Error('Oyuncu oturumu gerekli.'));
            return;
        }
        void (0, playerAccess_1.checkPlayerAccess)(playerId).then(access => {
            if (access !== 'allowed') {
                next(new Error(access));
                return;
            }
            socket.data.playerId = playerId;
            next();
        });
    });
    io.on('connection', (socket) => {
        const initialPlayerId = (socket.data.playerId || socket.handshake.query.playerId);
        if ((0, adminAccountOperations_1.restrictionsEnabled)()) {
            let checkedAt = 0;
            let check;
            socket.use((packet, next) => {
                const data = packet[1];
                if (data && ((data.playerId != null && data.playerId !== initialPlayerId) || (data.hostId != null && data.hostId !== initialPlayerId))) {
                    next(new Error('Oyuncu kimliği eşleşmiyor.'));
                    return;
                }
                if (!check || Date.now() - checkedAt >= 10_000) {
                    checkedAt = Date.now();
                    check = (0, playerAccess_1.checkPlayerAccess)(initialPlayerId);
                }
                void check.then(access => {
                    if (access === 'allowed')
                        next();
                    else
                        socket.disconnect(true);
                });
            });
        }
        (0, errorMonitor_1.addBreadcrumb)('WS bağlandı (Socket.IO)', 'ws', {
            socketId: socket.id,
            playerId: initialPlayerId || undefined,
        });
        if (initialPlayerId) {
            socketMeta.set(socket.id, { playerId: initialPlayerId });
            presenceManager_1.presenceManager.registerSocket(initialPlayerId, socket);
            socket.emit('presence:sync', { presences: presenceManager_1.presenceManager.getAllPresences() });
        }
        socket.on('presence:register', (data) => {
            if (data?.playerId) {
                socketMeta.set(socket.id, { playerId: data.playerId });
                presenceManager_1.presenceManager.registerSocket(data.playerId, socket);
                socket.emit('presence:sync', { presences: presenceManager_1.presenceManager.getAllPresences() });
            }
        });
        socket.on('presence:ping', (data) => {
            if (data?.playerId) {
                presenceManager_1.presenceManager.touchUser(data.playerId);
            }
        });
        socket.on(shared_1.SOCKET_EVENTS.JOIN_ROOM, (data) => {
            const { roomCode, playerId, displayName, avatarUrl } = data;
            socketMeta.set(socket.id, { playerId, roomCode });
            socket.join(roomCode);
            presenceManager_1.presenceManager.registerSocket(playerId, socket);
            presenceManager_1.presenceManager.setUserRoom(playerId, roomCode);
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
                (0, errorMonitor_1.addBreadcrumb)(`Odaya yeniden bağlandı: ${roomCode}`, 'ws', {
                    roomCode,
                    playerId,
                    status: existingRoom.status,
                });
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
        socket.on(shared_1.SOCKET_EVENTS.LEAVE_ROOM, (data) => {
            const { roomCode, playerId } = data;
            socket.leave(roomCode);
            presenceManager_1.presenceManager.setUserRoom(playerId, null);
            roomManager.handlePlayerDisconnect(roomCode, playerId);
            const room = roomManager.getRoom(roomCode);
            if (room) {
                delete room.players[playerId];
                delete room.scores[playerId];
                io.to(roomCode).emit(shared_1.SOCKET_EVENTS.PLAYER_DISCONNECTED, { playerId, isLeaving: true });
                io.to(roomCode).emit(shared_1.SOCKET_EVENTS.ROOM_STATE_SYNC, room);
            }
            socketMeta.delete(socket.id);
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
            const room = roomManager.getRoom(data.roomCode);
            if (!room) {
                socket.emit(shared_1.SOCKET_EVENTS.ERROR, { message: 'Oda bulunamadı' });
                return;
            }
            if (room.hostId !== data.playerId) {
                socket.emit(shared_1.SOCKET_EVENTS.ERROR, { message: 'Yalnızca oda sahibi oyunu başlatabilir!' });
                return;
            }
            if (Object.keys(room.players).length < 2) {
                socket.emit(shared_1.SOCKET_EVENTS.ERROR, { message: 'Oyunu başlatmak için en az 2 oyuncu gereklidir!' });
                return;
            }
            const started = roomManager.startGame(data.roomCode, data.playerId);
            if (started) {
                io.to(data.roomCode).emit(shared_1.SOCKET_EVENTS.ROOM_STATE_SYNC, room);
            }
            else {
                socket.emit(shared_1.SOCKET_EVENTS.ERROR, { message: 'Oyun başlatılamadı' });
            }
        });
        socket.on(shared_1.SOCKET_EVENTS.KICK_PLAYER, (data) => {
            const result = roomManager.kickPlayer(data.roomCode, data.hostId, data.targetPlayerId);
            if (result.success) {
                const room = roomManager.getRoom(data.roomCode);
                if (room) {
                    io.to(data.roomCode).emit(shared_1.SOCKET_EVENTS.ROOM_STATE_SYNC, room);
                }
            }
            else {
                socket.emit(shared_1.SOCKET_EVENTS.ERROR, { message: result.error || 'Oyuncu atılamadı' });
            }
        });
        socket.on(shared_1.SOCKET_EVENTS.UPDATE_ROOM_SETTINGS, (data) => {
            const result = roomManager.updateRoomSettings(data.roomCode, data.hostId, data.settings);
            if (result.success) {
                const room = roomManager.getRoom(data.roomCode);
                if (room) {
                    io.to(data.roomCode).emit(shared_1.SOCKET_EVENTS.ROOM_STATE_SYNC, room);
                }
            }
            else {
                socket.emit(shared_1.SOCKET_EVENTS.ERROR, { message: result.error || 'Ayarlar güncellenemedi' });
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
            // Eşleşme başlamadan kalıcı soru havuzunu (Supabase/Telegram soruları) geri yükle
            prismaClient_1.db.ensureQuestionsRestored().catch(() => { });
            (0, errorMonitor_1.addBreadcrumb)('Eşleşme kuyruğuna girdi', 'matchmaking', {
                playerId: data.playerId,
                mode: data.mode || 'duel',
                category: data.category || 'mixed',
                difficulty: data.difficulty || 'medium',
            });
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
        socket.on(shared_1.SOCKET_EVENTS.CREATE_ROOM, (data) => {
            const { roomCode, playerId, displayName, avatarUrl, settings } = data;
            socketMeta.set(socket.id, { playerId, roomCode });
            socket.join(roomCode);
            presenceManager_1.presenceManager.registerSocket(playerId, socket);
            presenceManager_1.presenceManager.setUserRoom(playerId, roomCode);
            const room = roomManager.createRoom({
                code: roomCode,
                hostId: playerId,
                hostName: displayName,
                avatarUrl,
                category: settings?.mixedCategories ? 'mixed' : (settings?.categories?.[0] || 'general_culture'),
                subCategory: typeof settings?.subCategory === 'string' ? settings.subCategory : undefined,
                difficulty: settings?.difficulty || 'medium',
                maxPlayers: settings?.maxPlayers || 4,
                totalRounds: settings?.totalRounds || 7,
                questionTimeSec: settings?.questionTimeSec || 20,
                penaltyForWrong: settings?.penaltyForWrong ?? true,
                privacy: settings?.privacy || 'public',
            });
            io.to(roomCode).emit(shared_1.SOCKET_EVENTS.ROOM_STATE_SYNC, room);
            io.emit(shared_1.SOCKET_EVENTS.PUBLIC_ROOMS_UPDATE, roomManager.getPublicRooms());
        });
        socket.on(shared_1.SOCKET_EVENTS.GET_PUBLIC_ROOMS, () => {
            socket.emit(shared_1.SOCKET_EVENTS.PUBLIC_ROOMS_UPDATE, roomManager.getPublicRooms());
        });
        socket.on(shared_1.SOCKET_EVENTS.SEND_EMOTE, (data) => {
            if (!data || !(0, shared_1.isLobbyReaction)(data.emote) || !socket.rooms.has(data.roomCode) ||
                !roomManager.getRoom(data.roomCode)?.players[initialPlayerId])
                return;
            io.to(data.roomCode).emit(shared_1.SOCKET_EVENTS.EMOTE_RECEIVED, {
                roomCode: data.roomCode,
                playerId: initialPlayerId,
                emote: data.emote,
                id: (0, node_crypto_1.randomUUID)(),
            });
        });
        socket.on(shared_1.SOCKET_EVENTS.LOBBY_CHAT, (data) => {
            if (!data || !(0, shared_1.isLobbyQuickMessage)(data.text) || !socket.rooms.has(data.roomCode))
                return;
            const player = roomManager.getRoom(data.roomCode)?.players[initialPlayerId];
            if (!player)
                return;
            const payload = {
                id: (0, node_crypto_1.randomUUID)(),
                roomCode: data.roomCode,
                playerId: initialPlayerId,
                displayName: player.displayName,
                avatarUrl: player.avatarUrl,
                text: data.text,
                timestamp: Date.now(),
            };
            // Broadcast to all sockets in that room (EPHEMERAL, no DB save)
            io.to(data.roomCode).emit(shared_1.SOCKET_EVENTS.LOBBY_MESSAGE, payload);
        });
        socket.on('disconnect', () => {
            const meta = socketMeta.get(socket.id);
            (0, errorMonitor_1.addBreadcrumb)('WS koptu (Socket.IO)', 'ws', {
                socketId: socket.id,
                playerId: meta?.playerId,
                roomCode: meta?.roomCode,
            });
            if (meta) {
                if (meta.playerId) {
                    presenceManager_1.presenceManager.unregisterSocket(meta.playerId, socket);
                }
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
