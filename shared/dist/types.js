"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateLevelFromXp = calculateLevelFromXp;
exports.getDailyChallengeConfig = getDailyChallengeConfig;
/**
 * Fair, balanced RPG leveling formula:
 * Level 1: 0 - 300 XP (300 XP needed)
 * Level 2: 300 - 750 XP (450 XP needed)
 * Level 3: 750 - 1350 XP (600 XP needed)
 * Level 4: 1350 - 2100 XP (750 XP needed)
 * Level 5: 2100 - 3000 XP (900 XP needed)
 * Level 6: 3000 - 4050 XP (1050 XP needed)
 * Level 7: 4050 - 5250 XP (1200 XP needed)
 * Level 8: 5250 - 6600 XP (1350 XP needed)
 * Level L requires 300 + (L - 1) * 150 XP.
 */
function calculateLevelFromXp(totalXp = 0) {
    const safeXp = Math.max(0, Math.floor(totalXp || 0));
    let level = 1;
    let prevThreshold = 0;
    let neededForNext = 300;
    let currentThreshold = 300;
    while (safeXp >= currentThreshold) {
        level++;
        prevThreshold = currentThreshold;
        neededForNext = 300 + (level - 1) * 150;
        currentThreshold += neededForNext;
    }
    const currentLevelXp = safeXp - prevThreshold;
    const nextLevelXpRequired = neededForNext;
    const progressPct = Math.min(100, Math.max(0, Math.round((currentLevelXp / nextLevelXpRequired) * 100)));
    const rankTitle = level >= 30
        ? 'Efsanevi Deha'
        : level >= 20
            ? 'Usta Bilgin'
            : level >= 15
                ? 'Stratejist'
                : level >= 10
                    ? 'Bilgi Şövalyesi'
                    : level >= 6
                        ? 'Usta Kaşif'
                        : level >= 3
                            ? 'Yükselen Yıldız'
                            : 'Acemi Kaşif';
    return {
        level,
        rankTitle,
        currentLevelXp,
        nextLevelXpRequired,
        progressPct,
        totalXp: safeXp,
    };
}
function getDailyChallengeConfig(streakDay = 1) {
    const safeStreak = Math.max(1, streakDay);
    // Cycle 1 to 7
    const dayNumber = ((safeStreak - 1) % 7) + 1;
    // Progressive difficulty: more questions / higher threshold as days go on
    // Day 1: 5 questions, at least 3 correct
    // Day 2: 5 questions, at least 4 correct
    // Day 3: 6 questions, at least 5 correct
    // Day 4: 7 questions, at least 6 correct
    // Day 5: 8 questions, at least 7 correct
    // Day 6: 9 questions, at least 8 correct
    // Day 7: 10 questions, at least 9 correct (Grand Weekly Finale)
    let totalQuestions = 5;
    let requiredCorrect = 3;
    if (dayNumber === 1) {
        totalQuestions = 5;
        requiredCorrect = 3;
    }
    else if (dayNumber === 2) {
        totalQuestions = 5;
        requiredCorrect = 4;
    }
    else if (dayNumber === 3) {
        totalQuestions = 6;
        requiredCorrect = 5;
    }
    else if (dayNumber === 4) {
        totalQuestions = 7;
        requiredCorrect = 6;
    }
    else if (dayNumber === 5) {
        totalQuestions = 8;
        requiredCorrect = 7;
    }
    else if (dayNumber === 6) {
        totalQuestions = 9;
        requiredCorrect = 8;
    }
    else {
        // Day 7
        totalQuestions = 10;
        requiredCorrect = 9;
    }
    const rewardXp = 50 + dayNumber * 25;
    const rewardCoins = 40 + dayNumber * 20;
    const rewardGems = 5 + dayNumber * 5;
    const rewardChest = dayNumber === 7 ? 'mega_chest' : dayNumber >= 5 ? 'bronze_chest' : undefined;
    return {
        dayNumber,
        totalQuestions,
        requiredCorrect,
        rewardXp,
        rewardCoins,
        rewardGems,
        rewardChest,
        description: `${totalQuestions} soruda en az ${requiredCorrect} doğru yap`,
    };
}
