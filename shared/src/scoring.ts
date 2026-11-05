import { PlayerResult, PlayerScoreSummary } from './types';

export interface ScoreInput {
  isCorrect: boolean;
  timeRemainingMs: number;
  totalTimeMs: number;
  currentStreak: number;
  penaltyForWrong: boolean;
}

export interface ScoreCalculationResult {
  pointsAwarded: number;
  speedBonus: number;
  streakBonus: number;
  streak: number;
}

export const BASE_POINTS = 100;
export const MAX_SPEED_BONUS = 50;
export const WRONG_ANSWER_PENALTY = 0;

/**
 * Calculates score for a submitted answer based on correctness, speed and streak.
 * Clean, logical scale: 100 base + 0..50 speed bonus + up to +50 streak bonus per correct answer.
 */
export function calculateScore(input: ScoreInput): ScoreCalculationResult {
  const { isCorrect, timeRemainingMs, totalTimeMs, currentStreak } = input;

  if (!isCorrect) {
    return {
      pointsAwarded: 0,
      speedBonus: 0,
      streakBonus: 0,
      streak: 0,
    };
  }

  // Calculate speed ratio (clamped between 0 and 1)
  const ratio = Math.max(0, Math.min(1, timeRemainingMs / Math.max(1, totalTimeMs)));
  const speedBonus = Math.round(ratio * MAX_SPEED_BONUS);

  // Streak bonus: +10 for each streak level after 1, up to max +50
  const nextStreak = currentStreak + 1;
  let streakBonus = 0;
  if (nextStreak > 1) {
    streakBonus = Math.min(50, (nextStreak - 1) * 10);
  }

  const pointsAwarded = BASE_POINTS + speedBonus + streakBonus;

  return {
    pointsAwarded,
    speedBonus,
    streakBonus,
    streak: nextStreak,
  };
}

/**
 * Sorts and ranks players deterministically.
 * High score first.
 * If tied, fastest average response time wins.
 */
export function calculateRankings(players: PlayerResult[]): PlayerResult[] {
  return [...players].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    // Tie breaker: lower average response time wins
    return a.avgResponseTimeMs - b.avgResponseTimeMs;
  });
}
