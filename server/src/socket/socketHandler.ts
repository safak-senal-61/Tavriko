import { Server as SocketIOServer, Socket } from 'socket.io';
import { SOCKET_EVENTS, ClientQuestion, RoundResult, FinalMatchSummary, GameRoom } from '@trivia/shared';
import { GameRoomManager } from '../engine/GameRoomManager';
import { Matchmaker } from '../engine/Matchmaker';
import { db } from '../db/prismaClient';
import { presenceManager } from '../services/presenceManager';

export function setupSocketHandlers(
  io: SocketIOServer,
  roomManager: GameRoomManager,
  matchmaker: Matchmaker
) {
  // Wire up room manager callbacks to broadcast to rooms
  roomManager.onRoundStart = (roomCode: string, question: ClientQuestion) => {
    io.to(roomCode).emit(SOCKET_EVENTS.QUESTION_START, question);

    // If there is an active simulated bot player in this room, trigger realistic response
    const room = roomManager.getRoom(roomCode);
    if (room) {
      const botPlayer = Object.values(room.players).find(
        (p) => p.isBot || p.id.startsWith('rival_bot_') || p.id.startsWith('bot_')
      );
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
              io.to(roomCode).emit(SOCKET_EVENTS.PLAYER_ANSWERED, {
                playerId: botPlayer.id,
                streak: res.streak,
              });
            }
          }
        }, responseDelay);
      }
    }
  };

  roomManager.onRoundEnd = (roomCode: string, result: RoundResult) => {
    io.to(roomCode).emit(SOCKET_EVENTS.ROUND_RESULT, result);
  };

  roomManager.onGameOver = (roomCode: string, summary: FinalMatchSummary) => {
    io.to(roomCode).emit(SOCKET_EVENTS.GAME_OVER, summary);
    // Yerel Socket.IO modunda da sonuç sunucuda (istemciden bağımsız) kaydedilir
    void db.recordFinalMatch(summary).catch(() => {});
  };

  roomManager.onStateSync = (roomCode: string, room: GameRoom) => {
    io.to(roomCode).emit(SOCKET_EVENTS.ROOM_STATE_SYNC, room);
  };

  matchmaker.onMatchFound = (roomCode: string, players) => {
    if (players.length >= 2) {
      const p1 = players[0];
      const p2 = players[1];

      // Emit to p1 with p2 as opponent
      io.to(p1.socketId).emit(SOCKET_EVENTS.MATCH_FOUND, {
        roomCode,
        opponent: {
          id: p2.playerId,
          displayName: p2.displayName,
          avatarUrl: p2.avatarUrl,
        },
      });

      // Emit to p2 (if not bot) with p1 as opponent
      if (!p2.socketId.startsWith('bot_')) {
        io.to(p2.socketId).emit(SOCKET_EVENTS.MATCH_FOUND, {
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
  const socketMeta: Map<string, { playerId: string; roomCode?: string }> = new Map();

  io.on('connection', (socket: Socket) => {
    const initialPlayerId = socket.handshake.query.playerId as string;
    if (initialPlayerId) {
      socketMeta.set(socket.id, { playerId: initialPlayerId });
      presenceManager.registerSocket(initialPlayerId, socket);
      socket.emit('presence:sync', { presences: presenceManager.getAllPresences() });
    }

    socket.on('presence:register', (data: { playerId: string }) => {
      if (data?.playerId) {
        socketMeta.set(socket.id, { playerId: data.playerId });
        presenceManager.registerSocket(data.playerId, socket);
        socket.emit('presence:sync', { presences: presenceManager.getAllPresences() });
      }
    });

    socket.on('presence:ping', (data: { playerId: string }) => {
      if (data?.playerId) {
        presenceManager.touchUser(data.playerId);
      }
    });

    socket.on(SOCKET_EVENTS.JOIN_ROOM, (data: { roomCode: string; playerId: string; displayName: string; avatarUrl?: string }) => {
      const { roomCode, playerId, displayName, avatarUrl } = data;
      socketMeta.set(socket.id, { playerId, roomCode });
      socket.join(roomCode);
      presenceManager.registerSocket(playerId, socket);
      presenceManager.setUserRoom(playerId, roomCode);

      let existingRoom = roomManager.getRoom(roomCode);
      if (!existingRoom) {
        // Room does not exist yet; auto-create with requester as host
        existingRoom = roomManager.createRoom({
          code: roomCode,
          hostId: playerId,
          hostName: displayName,
          avatarUrl,
        });
        io.to(roomCode).emit(SOCKET_EVENTS.ROOM_STATE_SYNC, existingRoom);
        return;
      }

      if (existingRoom && existingRoom.players[playerId]) {
        // Reconnecting existing player
        const recovery = roomManager.reconnectPlayer(roomCode, playerId);
        io.to(roomCode).emit(SOCKET_EVENTS.PLAYER_RECONNECTED, { playerId, displayName });
        io.to(roomCode).emit(SOCKET_EVENTS.ROOM_STATE_SYNC, existingRoom);
        if (recovery.currentQuestion) {
          socket.emit(SOCKET_EVENTS.QUESTION_START, recovery.currentQuestion);
        }
      } else {
        const joinResult = roomManager.joinRoom(roomCode, {
          playerId,
          displayName,
          avatarUrl,
        });

        if (joinResult.success && joinResult.room) {
          io.to(roomCode).emit(SOCKET_EVENTS.ROOM_STATE_SYNC, joinResult.room);
        } else {
          socket.emit(SOCKET_EVENTS.ERROR, { message: joinResult.error || 'Odaya katılınamadı' });
        }
      }
    });

    socket.on(SOCKET_EVENTS.LEAVE_ROOM, (data: { roomCode: string; playerId: string }) => {
      const { roomCode, playerId } = data;
      socket.leave(roomCode);
      presenceManager.setUserRoom(playerId, null);
      roomManager.handlePlayerDisconnect(roomCode, playerId);
      const room = roomManager.getRoom(roomCode);
      if (room) {
        delete room.players[playerId];
        delete room.scores[playerId];
        io.to(roomCode).emit(SOCKET_EVENTS.PLAYER_DISCONNECTED, { playerId, isLeaving: true });
        io.to(roomCode).emit(SOCKET_EVENTS.ROOM_STATE_SYNC, room);
      }
      socketMeta.delete(socket.id);
    });

    socket.on(SOCKET_EVENTS.TOGGLE_READY, (data: { roomCode: string; playerId: string }) => {
      const success = roomManager.toggleReady(data.roomCode, data.playerId);
      if (success) {
        const room = roomManager.getRoom(data.roomCode);
        if (room) {
          io.to(data.roomCode).emit(SOCKET_EVENTS.ROOM_STATE_SYNC, room);
        }
      }
    });

    socket.on(SOCKET_EVENTS.START_GAME, (data: { roomCode: string; playerId: string }) => {
      const room = roomManager.getRoom(data.roomCode);
      if (!room) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Oda bulunamadı' });
        return;
      }
      if (room.hostId !== data.playerId) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Yalnızca oda sahibi oyunu başlatabilir!' });
        return;
      }
      if (Object.keys(room.players).length < 2) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Oyunu başlatmak için en az 2 oyuncu gereklidir!' });
        return;
      }
      const started = roomManager.startGame(data.roomCode, data.playerId);
      if (started) {
        io.to(data.roomCode).emit(SOCKET_EVENTS.ROOM_STATE_SYNC, room);
      } else {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Oyun başlatılamadı' });
      }
    });

    socket.on(SOCKET_EVENTS.KICK_PLAYER, (data: { roomCode: string; hostId: string; targetPlayerId: string }) => {
      const result = roomManager.kickPlayer(data.roomCode, data.hostId, data.targetPlayerId);
      if (result.success) {
        const room = roomManager.getRoom(data.roomCode);
        if (room) {
          io.to(data.roomCode).emit(SOCKET_EVENTS.ROOM_STATE_SYNC, room);
        }
      } else {
        socket.emit(SOCKET_EVENTS.ERROR, { message: result.error || 'Oyuncu atılamadı' });
      }
    });

    socket.on(SOCKET_EVENTS.UPDATE_ROOM_SETTINGS, (data: { roomCode: string; hostId: string; settings: any }) => {
      const result = roomManager.updateRoomSettings(data.roomCode, data.hostId, data.settings);
      if (result.success) {
        const room = roomManager.getRoom(data.roomCode);
        if (room) {
          io.to(data.roomCode).emit(SOCKET_EVENTS.ROOM_STATE_SYNC, room);
        }
      } else {
        socket.emit(SOCKET_EVENTS.ERROR, { message: result.error || 'Ayarlar güncellenemedi' });
      }
    });

    socket.on(SOCKET_EVENTS.SUBMIT_ANSWER, (data: {
      roomCode: string;
      playerId: string;
      selectedOptionId: string;
      clientTimestamp?: number;
    }) => {
      const result = roomManager.submitAnswer(
        data.roomCode,
        data.playerId,
        data.selectedOptionId,
        data.clientTimestamp || Date.now()
      );

      if (result.accepted) {
        io.to(data.roomCode).emit(SOCKET_EVENTS.PLAYER_ANSWERED, {
          playerId: data.playerId,
          streak: result.streak,
        });
      }
    });

    socket.on(SOCKET_EVENTS.FIND_MATCH, (data: {
      playerId: string;
      displayName: string;
      avatarUrl?: string;
      mode?: any;
      category?: any;
      difficulty?: any;
    }) => {
      // Eşleşme başlamadan kalıcı soru havuzunu (Supabase/Telegram soruları) geri yükle
      db.ensureQuestionsRestored().catch(() => {});
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

    socket.on(SOCKET_EVENTS.CANCEL_MATCH, (data: { playerId: string }) => {
      matchmaker.dequeue(data.playerId);
    });

    socket.on(SOCKET_EVENTS.CREATE_ROOM, (data: {
      roomCode: string;
      playerId: string;
      displayName: string;
      avatarUrl?: string;
      settings?: any;
    }) => {
      const { roomCode, playerId, displayName, avatarUrl, settings } = data;
      socketMeta.set(socket.id, { playerId, roomCode });
      socket.join(roomCode);
      presenceManager.registerSocket(playerId, socket);
      presenceManager.setUserRoom(playerId, roomCode);

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

      io.to(roomCode).emit(SOCKET_EVENTS.ROOM_STATE_SYNC, room);
      io.emit(SOCKET_EVENTS.PUBLIC_ROOMS_UPDATE, roomManager.getPublicRooms());
    });

    socket.on(SOCKET_EVENTS.GET_PUBLIC_ROOMS, () => {
      socket.emit(SOCKET_EVENTS.PUBLIC_ROOMS_UPDATE, roomManager.getPublicRooms());
    });

    socket.on(SOCKET_EVENTS.SEND_EMOTE, (data: { roomCode: string; playerId: string; emote: string; id?: string }) => {
      io.to(data.roomCode).emit(SOCKET_EVENTS.EMOTE_RECEIVED, {
        ...data,
        id: data.id || `emote_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      });
    });

    socket.on(SOCKET_EVENTS.LOBBY_CHAT, (data: {
      id?: string;
      roomCode: string;
      playerId: string;
      displayName: string;
      avatarUrl?: string;
      text: string;
    }) => {
      if (!data.text || !data.roomCode) return;
      const cleanText = data.text.trim().slice(0, 100);
      if (!cleanText) return;

      const payload = {
        id: data.id || `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        roomCode: data.roomCode,
        playerId: data.playerId,
        displayName: data.displayName || 'Oyuncu',
        avatarUrl: data.avatarUrl,
        text: cleanText,
        timestamp: Date.now(),
      };

      // Broadcast to all sockets in that room (EPHEMERAL, no DB save)
      io.to(data.roomCode).emit(SOCKET_EVENTS.LOBBY_MESSAGE, payload);
    });

    socket.on('disconnect', () => {
      const meta = socketMeta.get(socket.id);
      if (meta) {
        if (meta.playerId) {
          presenceManager.unregisterSocket(meta.playerId, socket);
        }
        matchmaker.dequeue(meta.playerId);
        if (meta.roomCode) {
          roomManager.handlePlayerDisconnect(meta.roomCode, meta.playerId);
          const room = roomManager.getRoom(meta.roomCode);
          if (room) {
            io.to(meta.roomCode).emit(SOCKET_EVENTS.PLAYER_DISCONNECTED, { playerId: meta.playerId });
            io.to(meta.roomCode).emit(SOCKET_EVENTS.ROOM_STATE_SYNC, room);
          }
        }
        socketMeta.delete(socket.id);
      }
    });
  });
}
