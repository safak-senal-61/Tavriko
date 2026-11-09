import { getDailyChallengeConfig } from './types';

describe('Daily Challenge Progression', () => {
  it('scales questions and required correct answers smoothly over 7 days', () => {
    const day1 = getDailyChallengeConfig(1);
    expect(day1.dayNumber).toBe(1);
    expect(day1.totalQuestions).toBe(5);
    expect(day1.requiredCorrect).toBe(3);

    const day2 = getDailyChallengeConfig(2);
    expect(day2.dayNumber).toBe(2);
    expect(day2.totalQuestions).toBe(5);
    expect(day2.requiredCorrect).toBe(4);

    const day3 = getDailyChallengeConfig(3);
    expect(day3.dayNumber).toBe(3);
    expect(day3.totalQuestions).toBe(6);
    expect(day3.requiredCorrect).toBe(5);

    const day4 = getDailyChallengeConfig(4);
    expect(day4.dayNumber).toBe(4);
    expect(day4.totalQuestions).toBe(7);
    expect(day4.requiredCorrect).toBe(6);

    const day5 = getDailyChallengeConfig(5);
    expect(day5.dayNumber).toBe(5);
    expect(day5.totalQuestions).toBe(8);
    expect(day5.requiredCorrect).toBe(7);

    const day6 = getDailyChallengeConfig(6);
    expect(day6.dayNumber).toBe(6);
    expect(day6.totalQuestions).toBe(9);
    expect(day6.requiredCorrect).toBe(8);

    const day7 = getDailyChallengeConfig(7);
    expect(day7.dayNumber).toBe(7);
    expect(day7.totalQuestions).toBe(10);
    expect(day7.requiredCorrect).toBe(9);
    expect(day7.rewardChest).toBe('gift_box');

    // Hediye kutusu yalnızca 7. günde verilir, ara günlerde görünmez
    expect(day1.rewardChest).toBeUndefined();
    expect(day5.rewardChest).toBeUndefined();
    expect(day6.rewardChest).toBeUndefined();
  });

  it('cycles back to 1-7 for streaks beyond 7 days', () => {
    const day8 = getDailyChallengeConfig(8);
    expect(day8.dayNumber).toBe(1);

    const day14 = getDailyChallengeConfig(14);
    expect(day14.dayNumber).toBe(7);
    expect(day14.rewardChest).toBe('gift_box');
  });
});
