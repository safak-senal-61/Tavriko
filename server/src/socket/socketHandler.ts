import { Server as SocketIOServer, Socket } from 'socket.io';
import { SOCKET_EVENTS, ClientQuestion, RoundResult, FinalMatchSummary, GameRoom } from '@trivia/shared';
import { GameRoomManager } from '../engine/GameRoomManager';
import { Matchmaker } from '../engine/Matchmaker';

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
    socket.on(SOCKET_EVENTS.JOIN_ROOM, (data: { roomCode: string; playerId: string; displayName: string; avatarUrl?: string }) => {
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
      const started = roomManager.startGame(data.roomCode, data.playerId);
      if (started) {
        const room = roomManager.getRoom(data.roomCode);
        if (room) {
          io.to(data.roomCode).emit(SOCKET_EVENTS.ROOM_STATE_SYNC, room);
        }
      } else {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Oyun başlatılamadı' });
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

    socket.on(SOCKET_EVENTS.SEND_EMOTE, (data: { roomCode: string; playerId: string; emote: string }) => {
      io.to(data.roomCode).emit(SOCKET_EVENTS.EMOTE_RECEIVED, data);
    });

    socket.on('disconnect', () => {
      const meta = socketMeta.get(socket.id);
      if (meta) {
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
