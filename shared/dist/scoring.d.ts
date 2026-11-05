import { GameRoom, PlayerResult, PlayerScoreSummary, RoundResult, FinalMatchSummary } from './types';
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
/**
 * Shared authoritative helper: applies a player's submitted answer to room state,
 * updating score, streak, response time, and correctAnswersCount (+1 for correct, +0 for wrong).
 */
export declare function applyPlayerRoundAnswer(room: GameRoom, playerId: string, selectedOptionId: string, elapsedMs: number): ScoreCalculationResult & {
    isCorrect: boolean;
};
/**
 * Builds the sorted leaderboard for a GameRoom, preserving each player's correctAnswersCount.
 */
export declare function buildRoomLeaderboard(room: GameRoom): PlayerScoreSummary[];
/**
 * Evaluates the current round of a GameRoom and constructs the authoritative RoundResult payload.
 */
export declare function evaluateRoundResult(room: GameRoom): RoundResult;
/**
 * Finalizes a GameRoom and returns the authoritative FinalMatchSummary.
 */
export declare function buildFinalMatchSummary(room: GameRoom): FinalMatchSummary;
