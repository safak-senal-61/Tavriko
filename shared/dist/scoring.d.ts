import { PlayerResult } from './types';
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
export declare const BASE_POINTS = 100;
export declare const MAX_SPEED_BONUS = 50;
export declare const WRONG_ANSWER_PENALTY = 0;
/**
 * Calculates score for a submitted answer based on correctness, speed and streak.
 * Clean, logical scale: 100 base + 0..50 speed bonus + up to +50 streak bonus per correct answer.
 */
export declare function calculateScore(input: ScoreInput): ScoreCalculationResult;
/**
 * Sorts and ranks players deterministically.
 * High score first.
 * If tied, fastest average response time wins.
 */
export declare function calculateRankings(players: PlayerResult[]): PlayerResult[];
