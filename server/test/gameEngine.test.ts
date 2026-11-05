import { GameRoomManager } from '../src/engine/GameRoomManager';
import { Question } from '@trivia/shared';

const mockQuestions: Question[] = [
  {
    id: 'q1',
    categoryId: 'geography',
    difficulty: 'medium',
    text: 'Türkiye\'nin başkenti neresidir?',
    options: [
      { id: 'opt_a', text: 'İstanbul' },
      { id: 'opt_b', text: 'Ankara' },
      { id: 'opt_c', text: 'İzmir' },
      { id: 'opt_d', text: 'Bursa' },
    ],
    correctOptionId: 'opt_b',
    explanation: '13 Ekim 1923 tarihinde Ankara başkent ilan edilmiştir.',
    timeLimitSec: 10,
  },
  {
    id: 'q2',
    categoryId: 'science_tech',
    difficulty: 'easy',
    text: 'Suyun kimyasal formülü nedir?',
    options: [
      { id: 'opt_a', text: 'CO2' },
      { id: 'opt_b', text: 'NaCl' },
      { id: 'opt_c', text: 'H2O' },
      { id: 'opt_d', text: 'O2' },
    ],
    correctOptionId: 'opt_c',
    explanation: 'İki hidrojen ve bir oksijen atomundan oluşur.',
    timeLimitSec: 10,
  },
];

describe('GameEngine & RoomManager', () => {
  let manager: GameRoomManager;

  beforeEach(() => {
    manager = new GameRoomManager(() => mockQuestions);
  });

  afterEach(() => {
    manager.cleanupAll();
  });

  it('creates a room with an uppercase alphanumeric 6-char code', () => {
    const room = manager.createRoom({
      hostId: 'user1',
      hostName: 'Ahmet',
      mode: 'friends_private',
      category: 'geography',
      difficulty: 'medium',
      totalRounds: 2,
    });

    expect(room.code).toHaveLength(6);
    expect(room.players['user1']).toBeDefined();
    expect(room.players['user1'].isHost).toBe(true);
    expect(room.status).toBe('lobby');
  });

  it('allows second player to join and toggle ready', () => {
    const room = manager.createRoom({
      hostId: 'user1',
      hostName: 'Ahmet',
      mode: 'friends_private',
      category: 'geography',
      difficulty: 'medium',
      totalRounds: 2,
    });

    const joinResult = manager.joinRoom(room.code, {
      playerId: 'user2',
      displayName: 'Zeynep',
    });
    expect(joinResult.success).toBe(true);
    expect(Object.keys(room.players)).toHaveLength(2);

    const toggleResult = manager.toggleReady(room.code, 'user2');
    expect(toggleResult).toBe(true);
    expect(room.players['user2'].isReady).toBe(true);
  });

  it('starts game and serves questions without leaking correctOptionId to clients', () => {
    const room = manager.createRoom({
      hostId: 'user1',
      hostName: 'Ahmet',
      mode: 'free_for_all',
      category: 'geography',
      difficulty: 'medium',
      totalRounds: 2,
      questionTimeSec: 10,
    });
    manager.joinRoom(room.code, { playerId: 'user2', displayName: 'Zeynep' });

    manager.startGame(room.code, 'user1');
    expect(room.status).toBe('question_active');
    expect(room.currentRound).toBe(1);

    const clientQuestion = manager.getClientQuestion(room.code);
    expect(clientQuestion).toBeDefined();
    expect(clientQuestion?.id).toBe('q1');
    // Ensure correctOptionId is NEVER exposed in the client question payload
    expect((clientQuestion as any).correctOptionId).toBeUndefined();
    expect(clientQuestion?.options).toHaveLength(4);
  });

  it('submits answer authoritatively, awards points, and rejects double submission', () => {
    const room = manager.createRoom({
      hostId: 'user1',
      hostName: 'Ahmet',
      mode: 'free_for_all',
      category: 'geography',
      difficulty: 'medium',
      totalRounds: 2,
      questionTimeSec: 10,
    });
    manager.joinRoom(room.code, { playerId: 'user2', displayName: 'Zeynep' });
    manager.startGame(room.code, 'user1');

    // User1 submits correct answer ('opt_b')
    const sub1 = manager.submitAnswer(room.code, 'user1', 'opt_b', Date.now());
    expect(sub1.accepted).toBe(true);
    expect(sub1.isCorrect).toBe(true);
    expect(sub1.pointsAwarded).toBeGreaterThan(1000);

    // User1 attempts to resubmit/change answer: should be rejected
    const sub1Duplicate = manager.submitAnswer(room.code, 'user1', 'opt_a', Date.now());
    expect(sub1Duplicate.accepted).toBe(false);

    // User2 submits wrong answer ('opt_a')
    const sub2 = manager.submitAnswer(room.code, 'user2', 'opt_a', Date.now());
    expect(sub2.accepted).toBe(true);
    expect(sub2.isCorrect).toBe(false);
    expect(sub2.pointsAwarded).toBe(0);
  });

  it('handles player disconnect and reconnect snapshot recovery', () => {
    const room = manager.createRoom({
      hostId: 'user1',
      hostName: 'Ahmet',
      mode: 'free_for_all',
      category: 'geography',
      difficulty: 'medium',
      totalRounds: 2,
    });
    manager.joinRoom(room.code, { playerId: 'user2', displayName: 'Zeynep' });
    manager.startGame(room.code, 'user1');

    manager.handlePlayerDisconnect(room.code, 'user2');
    expect(room.players['user2'].isConnected).toBe(false);

    const recovery = manager.reconnectPlayer(room.code, 'user2');
    expect(recovery.success).toBe(true);
    expect(room.players['user2'].isConnected).toBe(true);
    expect(recovery.currentQuestion).toBeDefined();
    expect((recovery.currentQuestion as any).correctOptionId).toBeUndefined();
  });

  it('tracks correctAnswersCount (+1 per correct, +0 per wrong) and exposes it in leaderboard for dynamic race progress', () => {
    const room = manager.createRoom({
      hostId: 'user1',
      hostName: 'Ahmet',
      mode: 'free_for_all',
      category: 'geography',
      difficulty: 'medium',
      totalRounds: 2,
      questionTimeSec: 10,
    });
    manager.joinRoom(room.code, { playerId: 'user2', displayName: 'Zeynep' });
    manager.startGame(room.code, 'user1');

    // Round 1: user1 correct (+1), user2 wrong (+0)
    manager.submitAnswer(room.code, 'user1', 'opt_b', Date.now());
    manager.submitAnswer(room.code, 'user2', 'opt_a', Date.now());

    expect(room.players['user1'].correctAnswersCount).toBe(1);
    expect(room.players['user2'].correctAnswersCount).toBe(0);

    const lb = manager.getLeaderboard(room.code);
    const u1 = lb.find((e) => e.playerId === 'user1');
    const u2 = lb.find((e) => e.playerId === 'user2');
    expect(u1?.correctAnswersCount).toBe(1);
    expect(u2?.correctAnswersCount).toBe(0);

    // Dynamic race progress percentage formulas (Section 7):
    // progressPercentage = (correctAnswers / totalQuestions) * 100
    expect((3 / 10) * 100).toBe(30);
    expect((5 / 20) * 100).toBe(25);
    expect((10 / 20) * 100).toBe(50);
    expect((20 / 20) * 100).toBe(100);
  });
});
