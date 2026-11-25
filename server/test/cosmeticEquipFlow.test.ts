import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../src/db/prismaClient';

const MIN = 60_000;

function guestService() {
  const record: any = {
    id: 'guest_equip', username: 'guest_equip', displayName: 'Misafir', isGuest: true,
    level: 1, xp: 0, coins: 0, gems: 0, rankTitle: 'Çaylak', rankPoints: 0,
    settings: {},
    inventory: [
      { id: 'frame_a', name: 'Çerçeve A', desc: '', qty: 2, category: 'frame', durationHours: 1 },
      { id: 'frame_b', name: 'Çerçeve B', desc: '', qty: 1, category: 'frame', durationHours: 1 },
    ],
  };
  const svc = Object.create(PrismaService.prototype) as any;
  svc.users = new Map([[record.id, record]]);
  svc.rawClient = { user: { findFirst: vi.fn().mockResolvedValue(null) } };
  svc.savePersistedUsers = vi.fn();
  return { svc: svc as PrismaService, record };
}

afterEach(() => vi.useRealTimers());

describe('süreli kozmetik kuşanma akışı', () => {
  it('takılı eşyaya tekrar kuşan denince kopya harcamaz ve süreyi sıfırlamaz', async () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    const { svc, record } = guestService();
    await svc.useInventoryItem(record.id, 'frame_a');
    expect(record.equippedFrameExpiresAt).toBe(60 * MIN);
    vi.setSystemTime(49 * MIN);
    const again = await svc.useInventoryItem(record.id, 'frame_a');
    expect(again.rewardText).toContain('zaten kuşanılı');
    expect(record.equippedFrameExpiresAt).toBe(60 * MIN);
    expect(record.inventory.find((i: any) => i.id === 'frame_a').qty).toBe(1);
  });

  it('başka eşyaya geçip geri dönünce kalan 11 dakikadan devam eder', async () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    const { svc, record } = guestService();
    await svc.useInventoryItem(record.id, 'frame_a');
    vi.setSystemTime(49 * MIN); // A'nın 11 dk'sı kaldı
    await svc.useInventoryItem(record.id, 'frame_b');
    expect(record.equippedFrame).toBe('frame_b');
    const stashed = record.settings.cosmeticStash.find((e: any) => e.itemId === 'frame_a');
    expect(stashed.remainingMs).toBe(11 * MIN);

    vi.setSystemTime(80 * MIN); // beklerken A'nın süresi azalmaz
    const back = await svc.useInventoryItem(record.id, 'frame_a');
    expect(back.rewardText).toContain('11 dk');
    expect(record.equippedFrame).toBe('frame_a');
    expect(record.equippedFrameExpiresAt).toBe(80 * MIN + 11 * MIN);
    // Yedek A kopyası harcanmadı, B'nin kalan süresi saklandı
    expect(record.inventory.find((i: any) => i.id === 'frame_a').qty).toBe(1);
    expect(record.settings.cosmeticStash.find((e: any) => e.itemId === 'frame_b').remainingMs).toBe(29 * MIN);
  });
});
