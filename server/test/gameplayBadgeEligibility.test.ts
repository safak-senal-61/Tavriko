import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { claimGameplayReward } from '../src/services/gameplayRewards';

const badge = 'badge_social_player';
const owner = 'fixture-registered-player';

function fixture(friendCount: number, alreadyClaimed = false) {
  const create = vi.fn();
  const upsert = vi.fn();
  const tx = {
    $queryRaw: vi.fn().mockResolvedValueOnce([{ id: owner }])
      .mockResolvedValueOnce([{ matches: 0n, correct: 0n, perfect: 0n, days: 0n }]),
    user: { findUnique: vi.fn().mockResolvedValue({ friendIds: ['fixture-friend'] }), count: vi.fn().mockResolvedValue(friendCount) },
    gameplayRewardClaim: { findMany: vi.fn().mockResolvedValue(alreadyClaimed ? [{ rewardId: badge }] : []), create },
    userInventoryItem: { upsert },
  };
  const client = { $transaction: (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx) } as unknown as PrismaClient;
  return { claim: () => claimGameplayReward(client, owner, badge), create, upsert };
}

describe('badge claim thresholds', () => {
  it('rejects the old threshold and accepts the new threshold on the server', async () => {
    const locked = fixture(4);
    await expect(locked.claim()).rejects.toMatchObject({ status: 409 });
    expect(locked.upsert).not.toHaveBeenCalled();
    const ready = fixture(5);
    await expect(ready.claim()).resolves.toMatchObject({ claimedNow: true });
    expect(ready.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ itemId: badge, durationHours: 0 }),
    }));
  });

  it('still reports a legacy claim as completed without issuing a duplicate badge', async () => {
    const previous = fixture(0, true);
    const result = await previous.claim();
    expect(result.claimedNow).toBe(false);
    expect(result.rewards.find(row => row.id === badge)).toMatchObject({ current: 5, claimed: true });
    expect(previous.create).not.toHaveBeenCalled();
    expect(previous.upsert).not.toHaveBeenCalled();
  });
});
