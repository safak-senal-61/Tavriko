import { calculateScore, calculateRankings } from './scoring';
import { PlayerResult } from './types';

describe('Scoring Logic', () => {
  it('awards 1000 base points plus speed bonus for correct answer with full time remaining', () => {
    // 15 seconds total, answered immediately (15s remaining)
    const result = calculateScore({
      isCorrect: true,
      timeRemainingMs: 15000,
      totalTimeMs: 15000,
      currentStreak: 0,
      penaltyForWrong: false,
    });
    // 1000 base + 500 max speed bonus = 1500
    expect(result.pointsAwarded).toBe(1500);
    expect(result.streak).toBe(1);
    expect(result.speedBonus).toBe(500);
  });

  it('awards partial speed bonus when half the time has elapsed', () => {
    const result = calculateScore({
      isCorrect: true,
      timeRemainingMs: 7500,
      totalTimeMs: 15000,
      currentStreak: 1,
      penaltyForWrong: false,
    });
    // 1000 base + 250 speed bonus + 50 streak bonus = 1300
    expect(result.pointsAwarded).toBe(1300);
    expect(result.streak).toBe(2);
  });

  it('handles wrong answers with 0 points when penalty is false, resets streak', () => {
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

  it('deducts 250 points for wrong answer when penalty is true', () => {
    const result = calculateScore({
      isCorrect: false,
      timeRemainingMs: 5000,
      totalTimeMs: 15000,
      currentStreak: 2,
      penaltyForWrong: true,
    });
    expect(result.pointsAwarded).toBe(-250);
    expect(result.streak).toBe(0);
  });

  it('breaks ties deterministically using average response time in calculateRankings', () => {
    const players: PlayerResult[] = [
      { playerId: 'p1', name: 'Ayşe', score: 2500, avgResponseTimeMs: 3200, correctCount: 2 },
      { playerId: 'p2', name: 'Barış', score: 2500, avgResponseTimeMs: 2100, correctCount: 2 },
      { playerId: 'p3', name: 'Can', score: 3000, avgResponseTimeMs: 4000, correctCount: 3 },
    ];

    const ranked = calculateRankings(players);
    expect(ranked[0].playerId).toBe('p3'); // 3000 pts
    expect(ranked[1].playerId).toBe('p2'); // 2500 pts, faster (2100ms)
    expect(ranked[2].playerId).toBe('p1'); // 2500 pts, slower (3200ms)
  });
});
