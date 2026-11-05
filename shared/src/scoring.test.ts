import {
  calculateScore,
  calculateRankings,
  applyPlayerRoundAnswer,
  evaluateRoundResult,
} from './scoring';
import { GameRoom, PlayerResult } from './types';

describe('Scoring Logic', () => {
  it('awards 100 base points plus speed bonus for correct answer with full time remaining', () => {
    const result = calculateScore({
      isCorrect: true,
      timeRemainingMs: 15000,
      totalTimeMs: 15000,
      currentStreak: 0,
      penaltyForWrong: false,
    });
    // 100 base + 50 max speed bonus = 150
    expect(result.pointsAwarded).toBe(150);
    expect(result.streak).toBe(1);
    expect(result.speedBonus).toBe(50);
  });

  it('awards partial speed bonus and streak bonus when half the time has elapsed', () => {
    const result = calculateScore({
      isCorrect: true,
      timeRemainingMs: 7500,
      totalTimeMs: 15000,
      currentStreak: 1,
      penaltyForWrong: false,
    });
    // 100 base + 25 speed bonus + 10 streak bonus = 135
    expect(result.pointsAwarded).toBe(135);
    expect(result.streak).toBe(2);
  });

  it('handles wrong answers with 0 points and resets streak (never moves backward)', () => {
    const result = calculateScore({
      isCorrect: false,
      timeRemainingMs: 8000,
      totalTimeMs: 15000,
      currentStreak: 4,
      penaltyForWrong: false,
    });
    expect(result.pointsAwarded).toBe(0);
    expect(result.streak).toBe(0);
  });

  it('awards 0 points for wrong answer even when penaltyForWrong is true', () => {
    const result = calculateScore({
      isCorrect: false,
      timeRemainingMs: 5000,
      totalTimeMs: 15000,
      currentStreak: 2,
      penaltyForWrong: true,
    });
    expect(result.pointsAwarded).toBe(0);
    expect(result.streak).toBe(0);
  });

  it('breaks ties deterministically using average response time in calculateRankings', () => {
    const players: PlayerResult[] = [
      { playerId: 'p1', name: 'Ayşe', score: 250, avgResponseTimeMs: 3200, correctCount: 2 },
      { playerId: 'p2', name: 'Barış', score: 250, avgResponseTimeMs: 2100, correctCount: 2 },
      { playerId: 'p3', name: 'Can', score: 300, avgResponseTimeMs: 4000, correctCount: 3 },
    ];

    const ranked = calculateRankings(players);
    expect(ranked[0].playerId).toBe('p3'); // 300 pts
    expect(ranked[1].playerId).toBe('p2'); // 250 pts, faster (2100ms)
    expect(ranked[2].playerId).toBe('p1'); // 250 pts, slower (3200ms)
  });

  it('unifies round answer application and round result evaluation via applyPlayerRoundAnswer & evaluateRoundResult', () => {
    const room: GameRoom = {
      code: 'ROOM01',
      mode: 'duel',
      hostId: 'p1',
      status: 'question_active',
      category: 'general_culture',
      difficulty: 'medium',
      maxPlayers: 2,
      currentRound: 1,
      totalRounds: 5,
      questionTimeSec: 15,
      penaltyForWrong: false,
      currentQuestion: {
        id: 'q1',
        categoryId: 'general_culture',
        difficulty: 'medium',
        text: 'Test?',
        options: [
          { id: 'a', text: 'A' },
          { id: 'b', text: 'B' },
        ],
        correctOptionId: 'a',
        explanation: 'A doğrudur.',
        language: 'tr',
        contentHash: 'h1',
        reviewStatus: 'published',
        timeLimitSec: 15,
        createdAt: new Date().toISOString(),
      },
      players: {
        p1: {
          id: 'p1',
          username: 'ali',
          displayName: 'Ali',
          score: 0,
          currentStreak: 0,
          isReady: true,
          isHost: true,
          isConnected: true,
          hasAnsweredCurrentRound: false,
          totalResponseTimeMs: 0,
          correctAnswersCount: 0,
        },
        p2: {
          id: 'p2',
          username: 'veli',
          displayName: 'Veli',
          score: 0,
          currentStreak: 0,
          isReady: true,
          isHost: false,
          isConnected: true,
          hasAnsweredCurrentRound: false,
          totalResponseTimeMs: 0,
          correctAnswersCount: 0,
        },
      },
      scores: { p1: 0, p2: 0 },
    };

    const res1 = applyPlayerRoundAnswer(room, 'p1', 'a', 3000);
    const res2 = applyPlayerRoundAnswer(room, 'p2', 'b', 4000);

    expect(res1.isCorrect).toBe(true);
    expect(res2.isCorrect).toBe(false);
    expect(room.players.p1.correctAnswersCount).toBe(1);
    expect(room.players.p2.correctAnswersCount).toBe(0);

    const roundResult = evaluateRoundResult(room);
    expect(room.status).toBe('round_result');
    expect(roundResult.leaderboard[0].playerId).toBe('p1');
    expect(roundResult.leaderboard[0].correctAnswersCount).toBe(1);
    expect(roundResult.leaderboard[1].correctAnswersCount).toBe(0);
  });
});
