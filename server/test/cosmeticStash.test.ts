import { describe, expect, it } from 'vitest';
import { nextForSlot, readStash, slotOfItem, stashActive, takeFromStash } from '../src/services/cosmeticStash';

const MIN = 60_000;

describe('cosmetic stash', () => {
  it('keeps the remaining time of a replaced frame (1h frame used 5 min -> 55 min kept)', () => {
    const now = 1_000_000;
    const stash = stashActive([], { itemId: 'frame_a', expiresAt: now + 55 * MIN, name: 'Çerçeve A' }, now);
    expect(stash).toEqual([expect.objectContaining({ slot: 'frame', itemId: 'frame_a', remainingMs: 55 * MIN })]);
  });

  it('ignores expired and permanent equips', () => {
    expect(stashActive([], { itemId: 'frame_a', expiresAt: 10 }, 20)).toEqual([]);
    expect(stashActive([], { itemId: 'badge_a', expiresAt: undefined }, 20)).toEqual([]);
    expect(stashActive([], { itemId: 'unknown_a', expiresAt: 100 }, 20)).toEqual([]);
  });

  it('adds up time when the same item is stashed twice', () => {
    const a = stashActive([], { itemId: 'bg_x', expiresAt: 110 * MIN }, 100 * MIN);
    const b = stashActive(a, { itemId: 'bg_x', expiresAt: 125 * MIN }, 100 * MIN);
    expect(b).toHaveLength(1);
    expect(b[0].remainingMs).toBe(35 * MIN);
  });

  it('serves the oldest stashed item of a slot next and can take one out', () => {
    let s = stashActive([], { itemId: 'frame_a', expiresAt: 60 * MIN }, 0);
    s = stashActive(s, { itemId: 'frame_b', expiresAt: 90 * MIN }, 10);
    s = stashActive(s, { itemId: 'name_c', expiresAt: 90 * MIN }, 20);
    expect(nextForSlot(s, 'frame')?.itemId).toBe('frame_a');
    expect(nextForSlot(s, 'badge')).toBeNull();
    const taken = takeFromStash(s, 'frame_a')!;
    expect(taken.rest.map(e => e.itemId)).toEqual(['frame_b', 'name_c']);
    expect(takeFromStash(s, 'frame_zzz')).toBeNull();
  });

  it('maps ids to slots and drops malformed stored entries', () => {
    expect(['frame_x', 'bg_x', 'name_x', 'badge_x', 'coin'].map(slotOfItem)).toEqual(['frame', 'background', 'nameEffect', 'badge', null]);
    expect(readStash({ cosmeticStash: [{ itemId: 'frame_a', slot: 'frame', remainingMs: 5, name: 'a', storedAt: 1 }, { itemId: 1 }, null] } as any)).toHaveLength(1);
  });
});
