import { describe, expect, it } from 'vitest';
import { GAMEPLAY_REWARDS, gameplayRewardStatuses, getChestOpening, isPermanentGameplayBadge, rewardCompletionPlayers } from './gameplayRewards';
import { SEASON_1_TIERS, SHOP_CATALOG, type GameRoom } from './types';

describe('gameplay rewards', () => {
  it('provides four one-time match milestones, each with a compatible key', () => {
    const chests = GAMEPLAY_REWARDS.filter(r => r.item.category === 'chest');
    expect(chests.map(r => [r.target, r.metric])).toEqual([[8, 'matches'], [20, 'matches'], [45, 'matches'], [90, 'matches']]);
    for (const { item, key } of chests) expect(key?.id).toBe(getChestOpening(item.id)?.key?.id);
    expect(new Set(GAMEPLAY_REWARDS.map(r => r.item.id)).size).toBe(GAMEPLAY_REWARDS.length);
  });

  it('preserves claimed badges and clamps progress to the new targets', () => {
    expect(GAMEPLAY_REWARDS.filter(r => r.item.category === 'badge').map(({ metric, target }) => [metric, target]))
      .toEqual([['friends', 5], ['matches', 50], ['correct', 250], ['days', 14], ['perfect', 15]]);
    const state = gameplayRewardStatuses({ matches: 12, correct: 300, friends: 0, days: 2, perfect: 1 }, ['badge_social_player']);
    expect(Object.fromEntries(state.map(({ id, current }) => [id, current]))).toEqual({
      chest_wood: 8, chest_silver: 12, chest_gold: 12, chest_legendary: 12,
      badge_social_player: 5, badge_veteran: 12, badge_trivia_master: 250, badge_consistent_player: 2, badge_genius: 1,
    });
    expect(state.filter(s => s.claimed).map(s => s.id)).toEqual(['badge_social_player']);
  });

  it('only counts the start-to-finish participants who answered in a normally finished match', () => {
    const active = { isConnected: true, rewardStarted: true, rewardAnswers: 1, correctAnswers: 0 };
    const room = {
      currentRound: 3, totalRounds: 3, status: 'round_result',
      players: {
        played: { ...active, id: 'played' },
        left: { ...active, id: 'left', isConnected: false },
        joinedLate: { ...active, id: 'joinedLate', rewardStarted: false },
        idle: { ...active, id: 'idle', rewardAnswers: 0 },
        bot: { ...active, id: 'bot', isBot: true },
      },
    } as unknown as GameRoom;
    expect(rewardCompletionPlayers(room, true)).toEqual(['played']);
    expect(rewardCompletionPlayers(room, false)).toEqual([]);
    expect(rewardCompletionPlayers({ ...room, currentRound: 2 }, true)).toEqual([]);
    expect(rewardCompletionPlayers({ ...room, status: 'question_active' }, true)).toEqual([]);
  });

  it('requires the explicit permanent marker and keeps legacy boxes and master keys compatible', () => {
    expect(isPermanentGameplayBadge('badge_veteran', 0)).toBe(true);
    expect(isPermanentGameplayBadge('badge_veteran', 24)).toBe(false);
    expect(isPermanentGameplayBadge('badge_veteran', undefined)).toBe(false);
    expect(isPermanentGameplayBadge('badge_speed_demon', 0)).toBe(false);
    expect(getChestOpening('gift_box')?.key).toBeUndefined();
    expect(getChestOpening('chest_diamond')?.key?.id).toBe('key_diamond');
    expect(getChestOpening('chest_gold')?.alternateKeyIds).toContain('key_master');
    expect(getChestOpening('booster_xp_2x_1h')).toBeUndefined();
  });

  it('cannot buy sandık, anahtar or rozet in the shop, including packs and the premium track', () => {
    for (const { id, grantItems } of SHOP_CATALOG) {
      expect(id).not.toMatch(/^(chest|key|badge)(_|$)|^pack_(starter|mega_bundle)$/);
      expect(grantItems?.some(i => ['chest', 'key', 'badge'].includes(i.category)) ?? false).toBe(false);
    }
    expect(SEASON_1_TIERS.some(tier => ['chest', 'key'].includes(tier.freeReward.type))).toBe(false);
    expect(SEASON_1_TIERS.some(tier => ['chest', 'key'].includes(tier.premiumReward.type))).toBe(false);
  });
});
