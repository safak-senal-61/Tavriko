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

export const BASE_POINTS = 1000;
export const MAX_SPEED_BONUS = 500;
export const WRONG_ANSWER_PENALTY = -250;

/**
 * Calculates score for a submitted answer based on correctness, speed and streak.
 */
export function calculateScore(input: ScoreInput): ScoreCalculationResult {
  const { isCorrect, timeRemainingMs, totalTimeMs, currentStreak, penaltyForWrong } = input;

  if (!isCorrect) {
    return {
      pointsAwarded: penaltyForWrong ? WRONG_ANSWER_PENALTY : 0,
      speedBonus: 0,
      streakBonus: 0,
      streak: 0,
    };
  }

  // Calculate speed ratio (clamped between 0 and 1)
  const ratio = Math.max(0, Math.min(1, timeRemainingMs / totalTimeMs));
  const speedBonus = Math.round(ratio * MAX_SPEED_BONUS);

  // Streak bonus: +50 for each streak level up to max +250
  const nextStreak = currentStreak + 1;
  let streakBonus = 0;
  if (nextStreak > 1) {
    streakBonus = Math.min(250, (nextStreak - 1) * 50);
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
