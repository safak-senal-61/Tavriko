"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WRONG_ANSWER_PENALTY = exports.MAX_SPEED_BONUS = exports.BASE_POINTS = void 0;
exports.calculateScore = calculateScore;
exports.calculateRankings = calculateRankings;
exports.BASE_POINTS = 1000;
exports.MAX_SPEED_BONUS = 500;
exports.WRONG_ANSWER_PENALTY = -250;
/**
 * Calculates score for a submitted answer based on correctness, speed and streak.
 */
function calculateScore(input) {
    const { isCorrect, timeRemainingMs, totalTimeMs, currentStreak, penaltyForWrong } = input;
    if (!isCorrect) {
        return {
            pointsAwarded: penaltyForWrong ? exports.WRONG_ANSWER_PENALTY : 0,
            speedBonus: 0,
            streakBonus: 0,
            streak: 0,
        };
    }
    // Calculate speed ratio (clamped between 0 and 1)
    const ratio = Math.max(0, Math.min(1, timeRemainingMs / totalTimeMs));
    const speedBonus = Math.round(ratio * exports.MAX_SPEED_BONUS);
    // Streak bonus: +50 for each streak level up to max +250
    const nextStreak = currentStreak + 1;
    let streakBonus = 0;
    if (nextStreak > 1) {
        streakBonus = Math.min(250, (nextStreak - 1) * 50);
    }
    const pointsAwarded = exports.BASE_POINTS + speedBonus + streakBonus;
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
function calculateRankings(players) {
    return [...players].sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        // Tie breaker: lower average response time wins
        return a.avgResponseTimeMs - b.avgResponseTimeMs;
    });
}
