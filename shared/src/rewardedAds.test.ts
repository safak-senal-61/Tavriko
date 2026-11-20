import { describe, expect, it } from 'vitest';
import {
  getRewardedAdStatus,
  REWARDED_AD_COINS,
  REWARDED_AD_COOLDOWN_SEC,
  REWARDED_AD_DAILY_LIMIT,
} from './rewards';

const NOW = Date.UTC(2026, 10, 20, 12, 0, 0);
const TODAY = '2026-11-20';

describe('getRewardedAdStatus', () => {
  it('gives the full daily allowance with no prior state', () => {
    expect(getRewardedAdStatus(undefined, NOW)).toEqual({
      coinsPerAd: REWARDED_AD_COINS,
      dailyLimit: REWARDED_AD_DAILY_LIMIT,
      remainingToday: REWARDED_AD_DAILY_LIMIT,
      cooldownSec: 0,
    });
  });

  it('counts only today and resets on a new UTC day', () => {
    expect(getRewardedAdStatus({ date: TODAY, count: 2, lastAt: 0 }, NOW).remainingToday).toBe(REWARDED_AD_DAILY_LIMIT - 2);
    expect(getRewardedAdStatus({ date: '2026-11-19', count: 99, lastAt: 0 }, NOW).remainingToday).toBe(REWARDED_AD_DAILY_LIMIT);
  });

  it('never goes below zero remaining', () => {
    expect(getRewardedAdStatus({ date: TODAY, count: 999, lastAt: 0 }, NOW).remainingToday).toBe(0);
  });

  it('applies the cooldown after the last reward', () => {
    expect(getRewardedAdStatus({ date: TODAY, count: 1, lastAt: NOW - 10_000 }, NOW).cooldownSec).toBe(REWARDED_AD_COOLDOWN_SEC - 10);
    expect(getRewardedAdStatus({ date: TODAY, count: 1, lastAt: NOW - REWARDED_AD_COOLDOWN_SEC * 1000 }, NOW).cooldownSec).toBe(0);
  });
});
