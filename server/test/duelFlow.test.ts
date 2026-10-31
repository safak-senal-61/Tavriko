import { GameRoomManager } from '../src/engine/GameRoomManager';
import { Matchmaker } from '../src/engine/Matchmaker';
import { QUESTION_BANK } from '../src/db/questionsData';
import { Question } from '@trivia/shared';

describe('1v1 Live Duel & Guest Matchmaking System', () => {
  let roomManager: GameRoomManager;
  let matchmaker: Matchmaker;

  beforeEach(() => {
    roomManager = new GameRoomManager((cat, diff, count) => {
      return QUESTION_BANK.slice(0, count);
    });
    matchmaker = new Matchmaker(roomManager);
  });

  afterEach(() => {
    matchmaker.destroy();
    roomManager.cleanupAll();
  });

  it('pairs two guest players in 1v1 duel mode and assigns opponent details', (done) => {
    let matchFoundCalled = false;

    matchmaker.onMatchFound = (roomCode, players) => {
      matchFoundCalled = true;
      expect(players.length).toBe(2);

      const p1 = players[0];
      const p2 = players[1];

      expect(p1.playerId).toBe('guest_player_1');
      expect(p1.displayName).toBe('Misafir Aslan');
      expect(p2.playerId).toBe('guest_player_2');
      expect(p2.displayName).toBe('Misafir Kartal');

      const room = roomManager.getRoom(roomCode);
      expect(room).toBeDefined();
      expect(room?.mode).toBe('duel');
      expect(room?.totalRounds).toBe(5);
      expect(room?.maxPlayers).toBe(2);
      expect(Object.keys(room!.players).length).toBe(2);

      done();
    };

    // Guest 1 joins queue
    matchmaker.enqueue({
      socketId: 'sock_1',
      playerId: 'guest_player_1',
      displayName: 'Misafir Aslan',
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=guest1',
      mode: 'duel',
      category: 'general_culture',
      difficulty: 'medium',
      queuedAt: Date.now(),
    });

    // Guest 2 joins queue
    matchmaker.enqueue({
      socketId: 'sock_2',
      playerId: 'guest_player_2',
      displayName: 'Misafir Kartal',
      avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=guest2',
      mode: 'duel',
      category: 'general_culture',
      difficulty: 'medium',
      queuedAt: Date.now(),
    });
  });

  it('runs an authoritative 1v1 round with synchronized answers and score updates', () => {
    const room = roomManager.createRoom({
      code: 'DUEL01',
      hostId: 'guest_1',
      hostName: 'Misafir 1',
      mode: 'duel',
      category: 'general_culture',
      difficulty: 'medium',
      totalRounds: 5,
      maxPlayers: 2,
    });

    roomManager.joinRoom('DUEL01', {
      playerId: 'guest_2',
      displayName: 'Misafir 2',
    });

    const started = roomManager.startGame('DUEL01', 'guest_1');
    expect(started).toBe(true);

    const activeRoom = roomManager.getRoom('DUEL01');
    expect(activeRoom?.status).toBe('question_active');
    expect(activeRoom?.currentQuestion).toBeDefined();

    const correctId = activeRoom!.currentQuestion!.correctOptionId;
    const wrongId = activeRoom!.currentQuestion!.options.find((o) => o.id !== correctId)!.id;

    // Player 1 answers correctly and fast
    const res1 = roomManager.submitAnswer('DUEL01', 'guest_1', correctId, Date.now());
    expect(res1.accepted).toBe(true);
    expect(res1.isCorrect).toBe(true);
    expect(res1.pointsAwarded).toBeGreaterThan(100);

    // Player 2 answers incorrectly
    const res2 = roomManager.submitAnswer('DUEL01', 'guest_2', wrongId, Date.now());
    expect(res2.accepted).toBe(true);
    expect(res2.isCorrect).toBe(false);

    // Check leaderboard reflects Player 1 leading
    const leaderboard = roomManager.getLeaderboard('DUEL01');
    expect(leaderboard[0].playerId).toBe('guest_1');
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[1].playerId).toBe('guest_2');
    expect(leaderboard[1].rank).toBe(2);
  });

  it('pairs with intelligent rival bot if player waits over 6 seconds', (done) => {
    matchmaker.onMatchFound = (roomCode, players) => {
      expect(players.length).toBe(2);
      expect(players[0].playerId).toBe('guest_solo');
      expect(players[1].playerId.startsWith('rival_bot_')).toBe(true);

      const room = roomManager.getRoom(roomCode);
      expect(room).toBeDefined();
      expect(room?.mode).toBe('duel');
      done();
    };

    // Queue simulated with queuedAt in the past (7 seconds ago)
    matchmaker.enqueue({
      socketId: 'sock_solo',
      playerId: 'guest_solo',
      displayName: 'Yalnız Oyuncu',
      mode: 'duel',
      queuedAt: Date.now() - 7000,
    });
  });
});
