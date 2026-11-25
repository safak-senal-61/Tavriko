import { describe, expect, it } from 'vitest';
import { getCosmeticDef, getNameEffectDef } from './cosmetics';
import { NICK_PACKS, NICK_RARITY_ORDER, NICK_STYLES, getNickStyle, nickOwnership } from './nickStyles';
import { SHOP_CATALOG, isCosmeticProduct, shopPriceForDuration } from './types';

/** Daha önce satılmış isim efekti kimlikleri: kullanıcı verisi için asla kaldırılmamalı. */
const LEGACY_IDS = [
  'name_glow_gold', 'name_gradient_fire', 'name_gradient_ice', 'name_gradient_rainbow',
  'name_emerald_vine', 'name_toxic_slime', 'name_candy_heart', 'name_void_shadow', 'name_plasma_bolt',
];

const PACK_NAMES = [
  'Neon Nick', 'Gold Nick', 'Holographic Nick', 'Fire Nick', 'Ice Nick', 'Galaxy Nick',
  'Inferno', 'Diamond', 'Royal Gold', 'Glitch', 'Rainbow', 'Shadow',
];

describe('animated nick style registry', () => {
  it('contains all twelve packs in showcase order', () => {
    expect(NICK_PACKS.map((p) => p.name)).toEqual(PACK_NAMES);
  });

  it('uses unique name_ ids that the server maps to the name effect slot', () => {
    const ids = NICK_STYLES.map((s) => s.styleId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith('name_')).toBe(true);
  });

  it('keeps every legacy name effect id resolvable', () => {
    for (const id of LEGACY_IDS) {
      expect(getNickStyle(id)).not.toBeNull();
      expect(getNameEffectDef(id)?.kind).toBe('name_effect');
    }
  });

  it('gives every pack a supported rarity and a distinct visual identity', () => {
    const signatures = new Set<string>();
    for (const pack of NICK_PACKS) {
      expect(NICK_RARITY_ORDER).toContain(pack.rarity);
      expect(pack.palette.colors.length).toBeGreaterThanOrEqual(2);
      for (const c of [pack.palette.base, pack.palette.glow, ...pack.palette.colors, ...pack.palette.plate]) {
        expect(c).toMatch(/^#[0-9A-F]{6}$/i);
      }
      signatures.add(`${pack.fill}|${pack.palette.colors.join(',')}`);
    }
    expect(signatures.size).toBe(NICK_PACKS.length);
    for (const rarity of NICK_RARITY_ORDER) expect(NICK_PACKS.some((p) => p.rarity === rarity)).toBe(true);
  });

  it.each(NICK_STYLES.map((s) => [s.styleId, s] as const))('%s is sold once as a timed cosmetic', (id, style) => {
    const listings = SHOP_CATALOG.filter((p) => p.id === id);
    expect(listings).toHaveLength(1);
    const [product] = listings;
    expect(product).toMatchObject({ category: 'name_effects', currency: 'gems', price: style.price, rarity: style.rarity, name: style.name });
    expect(product.grantItems).toEqual([expect.objectContaining({ id, qty: 1, category: 'name_effect', rarity: style.rarity })]);
    expect(isCosmeticProduct(product)).toBe(true);
    expect(shopPriceForDuration(product, '1h')).toBe(style.price);
    expect(getCosmeticDef(id)?.name).toBe(style.name);
  });

  it('derives locked, owned and active states', () => {
    const now = 1_000_000;
    expect(nickOwnership('name_neon', null, now)).toBe('locked');
    expect(nickOwnership('name_neon', { inventory: [{ id: 'name_neon', qty: 1 }] }, now)).toBe('owned');
    expect(nickOwnership('name_neon', { equippedNameEffect: 'name_neon', equippedNameEffectExpiresAt: now + 1 }, now)).toBe('active');
    expect(nickOwnership('name_neon', { equippedNameEffect: 'name_neon', equippedNameEffectExpiresAt: now - 1 }, now)).toBe('locked');
  });
});
