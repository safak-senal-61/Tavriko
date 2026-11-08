import request from 'supertest';
import { createApp } from '../src/server';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { SOCKET_EVENTS, ClientQuestion, RoundResult } from '@trivia/shared';
import { QUESTION_BANK } from '../src/db/questionsData';
import { db } from '../src/db/prismaClient';
import { Server } from 'http';

describe('Real-Time Multi-Client Multiplayer Simulation', () => {
  let server: Server;
  let serverPort: number;
  let teardown: () => void;
  let playerAId: string;
  let playerBId: string;
  let playerCId: string;
  let playerAToken: string;
  let playerBToken: string;
  let playerCToken: string;

  let clientA: ClientSocketType;
  let clientB: ClientSocketType;
  let clientC: ClientSocketType;

  beforeAll(async () => {
    const created = createApp();
    teardown = created.close;
    const guests = await Promise.all([
      request(created.app).post('/api/auth/guest').send({ displayName: 'Ahmet (Fast)' }),
      request(created.app).post('/api/auth/guest').send({ displayName: 'Barış (Medium)' }),
      request(created.app).post('/api/auth/guest').send({ displayName: 'Can (Wrong)' }),
    ]);
    for (const guest of guests) expect(guest.status).toBe(200);
    [playerAId, playerBId, playerCId] = guests.map((guest) => guest.body.user.id);
    [playerAToken, playerBToken, playerCToken] = guests.map((guest) => guest.body.token);

    server = created.httpServer;
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') serverPort = addr.port;
        resolve();
      });
    });
  });

  afterAll((done) => {
    if (clientA) clientA.disconnect();
    if (clientB) clientB.disconnect();
    if (clientC) clientC.disconnect();
    teardown();
    server.close(done);
  });

  it('orchestrates 3 authenticated guest players through room creation, synchronization, authoritative answers and score ranking', (done) => {
    const url = `http://localhost:${serverPort}`;
    clientA = ClientSocket(url, { auth: { token: playerAToken } });
    clientB = ClientSocket(url, { auth: { token: playerBToken } });
    clientC = ClientSocket(url, { auth: { token: playerCToken } });

    const roomCode = 'MATCH1';

    clientA.emit(SOCKET_EVENTS.JOIN_ROOM, {
      roomCode,
      playerId: playerAId,
      displayName: 'Ahmet (Fast)',
    });

    setTimeout(() => {
      clientB.emit(SOCKET_EVENTS.JOIN_ROOM, {
        roomCode,
        playerId: playerBId,
        displayName: 'Barış (Medium)',
      });
      clientC.emit(SOCKET_EVENTS.JOIN_ROOM, {
        roomCode,
        playerId: playerCId,
        displayName: 'Can (Wrong)',
      });
    }, 50);

    setTimeout(() => {
      clientB.emit(SOCKET_EVENTS.TOGGLE_READY, { roomCode, playerId: playerBId });
      clientC.emit(SOCKET_EVENTS.TOGGLE_READY, { roomCode, playerId: playerCId });
    }, 120);

    setTimeout(() => {
      clientA.emit(SOCKET_EVENTS.START_GAME, { roomCode, playerId: playerAId });
    }, 200);

    clientA.on(SOCKET_EVENTS.QUESTION_START, (question: ClientQuestion) => {
      expect(question.text).toBeDefined();
      expect(question.options).toHaveLength(4);
      expect((question as any).correctOptionId).toBeUndefined();

      const bankQ = db.getQuestionById(question.id) || QUESTION_BANK.find((q) => q.id === question.id);
      const correctId = bankQ ? bankQ.correctOptionId : 'opt_b';
      const wrongId = question.options.find((o) => o.id !== correctId)?.id || 'opt_d';

      clientA.emit(SOCKET_EVENTS.SUBMIT_ANSWER, {
        roomCode,
        playerId: playerAId,
        selectedOptionId: correctId,
        clientTimestamp: Date.now(),
      });

      setTimeout(() => {
        clientB.emit(SOCKET_EVENTS.SUBMIT_ANSWER, {
          roomCode,
          playerId: playerBId,
          selectedOptionId: correctId,
          clientTimestamp: Date.now(),
        });
      }, 50);

      setTimeout(() => {
        clientC.emit(SOCKET_EVENTS.SUBMIT_ANSWER, {
          roomCode,
          playerId: playerCId,
          selectedOptionId: wrongId,
          clientTimestamp: Date.now(),
        });
      }, 80);
    });

    clientA.on(SOCKET_EVENTS.ROUND_RESULT, (result: RoundResult) => {
      expect(result.correctOptionId).toBeDefined();
      expect(result.leaderboard).toBeDefined();
      expect(result.leaderboard.length).toBe(3);

      const [rank1, rank2, rank3] = result.leaderboard;
      expect(rank1.playerId).toBe(playerAId);
      expect(rank1.score).toBeGreaterThan(0);
      expect(rank2.playerId).toBe(playerBId);
      expect(rank1.score).toBeGreaterThanOrEqual(rank2.score);
      expect(rank3.playerId).toBe(playerCId);
      expect(rank3.score).toBe(0);
      done();
    });
  }, 10000);

  it('handles client disconnection and continues match without crashing the room', (done) => {
    clientA.on(SOCKET_EVENTS.PLAYER_DISCONNECTED, (data: { playerId: string }) => {
      expect(data.playerId).toBe(playerCId);
      done();
    });
    clientC.disconnect();
  });
});
