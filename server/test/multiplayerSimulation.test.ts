import { createApp } from '../src/server';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { SOCKET_EVENTS, ClientQuestion, RoundResult } from '@trivia/shared';
import { Server } from 'http';

describe('Real-Time Multi-Client Multiplayer Simulation', () => {
  let server: Server;
  let serverPort: number;
  let teardown: () => void;

  let clientA: ClientSocketType;
  let clientB: ClientSocketType;
  let clientC: ClientSocketType;

  beforeAll((done) => {
    const created = createApp();
    teardown = created.close;
    server = created.httpServer.listen(0, () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        serverPort = addr.port;
      }
      done();
    });
  });

  afterAll((done) => {
    if (clientA) clientA.disconnect();
    if (clientB) clientB.disconnect();
    if (clientC) clientC.disconnect();
    teardown();
    server.close(done);
  });

  it('orchestrates 3 live players through room creation, synchronization, authoritative answer submission, and score ranking', (done) => {
    const url = `http://localhost:${serverPort}`;
    clientA = ClientSocket(url);
    clientB = ClientSocket(url);
    clientC = ClientSocket(url);

    const roomCode = 'MATCH1';

    // Step 1: Client A joins as host
    clientA.emit(SOCKET_EVENTS.JOIN_ROOM, {
      roomCode,
      playerId: 'player_a',
      displayName: 'Ahmet (Fast)',
    });

    // Step 2: Client B and C join
    setTimeout(() => {
      clientB.emit(SOCKET_EVENTS.JOIN_ROOM, {
        roomCode,
        playerId: 'player_b',
        displayName: 'Barış (Medium)',
      });

      clientC.emit(SOCKET_EVENTS.JOIN_ROOM, {
        roomCode,
        playerId: 'player_c',
        displayName: 'Can (Wrong)',
      });
    }, 50);

    // Step 3: Wait for state sync and toggle ready
    setTimeout(() => {
      clientB.emit(SOCKET_EVENTS.TOGGLE_READY, { roomCode, playerId: 'player_b' });
      clientC.emit(SOCKET_EVENTS.TOGGLE_READY, { roomCode, playerId: 'player_c' });
    }, 120);

    // Step 4: Host starts game
    setTimeout(() => {
      clientA.emit(SOCKET_EVENTS.START_GAME, { roomCode, playerId: 'player_a' });
    }, 200);

    // Listen for question delivery on Client A
    clientA.on(SOCKET_EVENTS.QUESTION_START, (question: ClientQuestion) => {
      expect(question.text).toBeDefined();
      expect(question.options).toHaveLength(4);
      expect((question as any).correctOptionId).toBeUndefined();

      // Client A answers immediately with opt_b
      clientA.emit(SOCKET_EVENTS.SUBMIT_ANSWER, {
        roomCode,
        playerId: 'player_a',
        selectedOptionId: 'opt_b',
        clientTimestamp: Date.now(),
      });

      // Client B answers after small delay with opt_b
      setTimeout(() => {
        clientB.emit(SOCKET_EVENTS.SUBMIT_ANSWER, {
          roomCode,
          playerId: 'player_b',
          selectedOptionId: 'opt_b',
          clientTimestamp: Date.now(),
        });
      }, 50);

      // Client C answers with wrong option opt_a
      setTimeout(() => {
        clientC.emit(SOCKET_EVENTS.SUBMIT_ANSWER, {
          roomCode,
          playerId: 'player_c',
          selectedOptionId: 'opt_a',
          clientTimestamp: Date.now(),
        });
      }, 80);
    });

    // Listen for round result broadcast
    clientA.on(SOCKET_EVENTS.ROUND_RESULT, (result: RoundResult) => {
      expect(result.correctOptionId).toBeDefined();
      expect(result.leaderboard).toBeDefined();
      expect(result.leaderboard.length).toBe(3);

      const [rank1, rank2, rank3] = result.leaderboard;

      // Player A answered faster than Player B -> Rank 1
      expect(rank1.playerId).toBe('player_a');
      expect(rank1.score).toBeGreaterThan(0);

      // Player B answered correct but later -> Rank 2
      expect(rank2.playerId).toBe('player_b');
      expect(rank1.score).toBeGreaterThanOrEqual(rank2.score);

      // Player C answered wrong -> Rank 3 with 0 points
      expect(rank3.playerId).toBe('player_c');
      expect(rank3.score).toBe(0);

      done();
    });
  }, 10000);

  it('handles client disconnection and continues match without crashing the room', (done) => {
    clientA.on(SOCKET_EVENTS.PLAYER_DISCONNECTED, (data: { playerId: string }) => {
      expect(data.playerId).toBe('player_c');
      done();
    });

    // Client C disconnects
    clientC.disconnect();
  });
});
