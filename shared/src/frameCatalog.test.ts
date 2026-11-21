import { describe, expect, it } from 'vitest';
import { getFrameDef } from './cosmetics';
import { SHOP_CATALOG, isCosmeticProduct, shopPriceForDuration } from './types';

const frames = {
  frame_neon: 60,
  frame_gold: 90,
  frame_flame: 150,
  frame_dragon_phoenix: 150,
  frame_steampunk: 90,
  frame_ice: 55,
};

describe('shop frame collection', () => {
  it.each(Object.entries(frames))('%s has a purchasable and equipable frame grant', (id, price) => {
    const listings = SHOP_CATALOG.filter(product => product.id === id);
    expect(listings).toHaveLength(1);
    const [product] = listings;
    const frame = getFrameDef(id);
    expect(frame).not.toBeNull();
    expect(product).toMatchObject({ category: 'frames', currency: 'gems', price, name: frame?.name, rarity: frame?.rarity });
    expect(product.grantItems).toEqual([expect.objectContaining({ id, qty: 1, category: 'frame', rarity: frame?.rarity })]);
    expect(isCosmeticProduct(product)).toBe(true);
    expect(shopPriceForDuration(product, '1h')).toBe(price);
  });
});
