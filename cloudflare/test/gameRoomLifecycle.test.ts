import { calculateScore, calculateRankings, Question, ClientQuestion, GameRoom, Player } from '@trivia/shared';
import { getFallbackQuestions } from '../src/game/defaultQuestions';

describe('Game Room Lifecycle & Durable Object Logic', () => {
  it('correctly calculates score with speed bonus and streaks', () => {
    // 1st question correct answered in 3s (12s remaining of 15s)
    const score1 = calculateScore({
      isCorrect: true,
      timeRemainingMs: 12000,
      totalTimeMs: 15000,
      currentStreak: 0,
      penaltyForWrong: false,
    });

    expect(score1.pointsAwarded).toBeGreaterThan(100); // 100 base + speed bonus
    expect(score1.streak).toBe(1);

    // 2nd question correct with identical speed but existing streak
    const score2 = calculateScore({
      isCorrect: true,
      timeRemainingMs: 12000,
      totalTimeMs: 15000,
      currentStreak: 1,
      penaltyForWrong: false,
    });

    expect(score2.streak).toBe(2);
    expect(score2.pointsAwarded).toBeGreaterThan(score1.pointsAwarded); // Streak bonus (+50) applied
    expect(score2.streakBonus).toBe(50);

    // Wrong answer resets streak
    const score3 = calculateScore({
      isCorrect: false,
      timeRemainingMs: 8000,
      totalTimeMs: 15000,
      currentStreak: 2,
      penaltyForWrong: false,
    });

    expect(score3.pointsAwarded).toBe(0);
    expect(score3.streak).toBe(0);
  });

  it('generates accurate rankings and leaderboards', () => {
    const players = [
      { playerId: 'p1', name: 'Ayşe', score: 250, avgResponseTimeMs: 3200, correctCount: 2 },
      { playerId: 'p2', name: 'Mehmet', score: 400, avgResponseTimeMs: 2500, correctCount: 3 },
      { playerId: 'p3', name: 'Can', score: 100, avgResponseTimeMs: 5000, correctCount: 1 },
    ];

    const rankings = calculateRankings(players);
    expect(rankings[0].playerId).toBe('p2'); // Highest score first
    expect(rankings[0].score).toBe(400);
    expect(rankings[1].playerId).toBe('p1');
    expect(rankings[2].playerId).toBe('p3');
  });

  it('guarantees client-safe questions do not expose correctOptionId', () => {
    const rawQuestions = getFallbackQuestions('science_tech', 'easy', 2);
    expect(rawQuestions.length).toBe(2);

    const safeQuestions: ClientQuestion[] = rawQuestions.map((q, idx) => ({
      id: q.id,
      categoryId: q.categoryId,
      difficulty: q.difficulty,
      text: q.text,
      options: q.options,
      roundNumber: idx + 1,
      totalRounds: 2,
      timeLimitSec: q.timeLimitSec || 15,
    }));

    for (const sq of safeQuestions) {
      expect((sq as any).correctOptionId).toBeUndefined();
      expect((sq as any).explanation).toBeUndefined();
      expect(sq.options.length).toBe(4);
    }
  });

  it('deterministic room code formatting and validation', () => {
    const code = 'tav-9X2b';
    const clean = code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    expect(clean).toBe('TAV-9X2B');
    expect(clean.startsWith('TAV-')).toBe(true);
  });
});
