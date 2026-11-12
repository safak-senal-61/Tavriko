import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseAdapter } from '../src/db/prismaClient';

describe('Sezon ödülü talebi', () => {
  let db: DatabaseAdapter;
  let userId: string;

  beforeEach(async () => {
    db = new DatabaseAdapter();
    const { user } = await db.createGuest('Sezoncu');
    userId = user.id;
    const record = await (db as any).loadRecord(userId);
    record.seasonXp = 5000;
  });

  it('aynı kademe ödülü ikinci kez alınamaz', async () => {
    const first = await db.claimSeasonTier(userId, 2, 'free');
    expect(first.user.claimedSeasonFreeTiers).toContain(2);
    await expect(db.claimSeasonTier(userId, 2, 'free')).rejects.toThrow();
  });

  it('eşzamanlı iki talepten yalnızca biri başarılı olur', async () => {
    const results = await Promise.allSettled([
      db.claimSeasonTier(userId, 3, 'free'),
      db.claimSeasonTier(userId, 3, 'free'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('henüz ulaşılmamış kademe alınamaz', async () => {
    await expect(db.claimSeasonTier(userId, 50, 'free')).rejects.toThrow();
  });

  it('premium pass olmadan premium ödül alınamaz', async () => {
    await expect(db.claimSeasonTier(userId, 2, 'premium')).rejects.toThrow();
  });
});
