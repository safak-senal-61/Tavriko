import { getBadgeDef } from './cosmetics';
import type { InventoryItem, ItemRarity } from './types';

export type GameplayMetric = 'matches' | 'friends' | 'correct' | 'perfect' | 'days';
export type GameplayMetrics = Record<GameplayMetric, number>;
export type GameplayReward = {
  item: InventoryItem;
  key?: InventoryItem;
  metric: GameplayMetric;
  target: number;
  task: string;
};
export type GameplayRewardStatus = { id: string; current: number; claimed: boolean };

const silverKey: InventoryItem = { id: 'key_silver', name: 'Gümüş Anahtar', desc: 'Ahşap ve gümüş sandıkları açar.', qty: 1, category: 'key', rarity: 'rare' };
const goldKey: InventoryItem = { id: 'key_gold', name: 'Altın Anahtar', desc: 'Altın sandıkları açar.', qty: 1, category: 'key', rarity: 'epic' };
const diamondKey: InventoryItem = { id: 'key_diamond', name: 'Elmas Anahtar', desc: 'Efsanevi ve elmas sandıkları açar.', qty: 1, category: 'key', rarity: 'legendary' };
const chest = (id: string, name: string, rarity: ItemRarity, target: number, key: InventoryItem): GameplayReward => ({
  item: { id, name, rarity, qty: 1, category: 'chest', desc: `${key.name} ile açılır.` },
  key, metric: 'matches', target, task: `${target} geçerli maç tamamla.`,
});
const badge = (id: string, metric: GameplayMetric, target: number, task: string): GameplayReward => {
  const def = getBadgeDef(id);
  if (!def) throw new Error(`Missing gameplay badge definition: ${id}`);
  return { item: { id, name: def.name, rarity: def.rarity, qty: 1, category: 'badge', desc: 'Kalıcı görev rozeti.' }, metric, target, task };
};

export const GAMEPLAY_REWARDS: readonly GameplayReward[] = [
  chest('chest_wood', 'Ahşap Sandık', 'common', 3, silverKey),
  chest('chest_silver', 'Gümüş Sandık', 'rare', 10, silverKey),
  chest('chest_gold', 'Altın Sandık', 'epic', 25, goldKey),
  chest('chest_legendary', 'Efsanevi Sandık', 'mythic', 50, diamondKey),
  badge('badge_social_player', 'friends', 1, 'Bir arkadaşlık isteği karşılıklı kabul edilsin.'),
  badge('badge_veteran', 'matches', 10, '10 geçerli maç tamamla.'),
  badge('badge_trivia_master', 'correct', 50, 'Geçerli maçlarda toplam 50 doğru cevap ver.'),
  badge('badge_consistent_player', 'days', 3, '3 farklı günde geçerli maç tamamla.'),
  badge('badge_genius', 'perfect', 3, '3 maçta tüm soruları doğru cevapla.'),
];

export function gameplayRewardStatuses(metrics: GameplayMetrics, claimedIds: readonly string[]): GameplayRewardStatus[] {
  const claimed = new Set(claimedIds);
  return GAMEPLAY_REWARDS.map(({ item, metric, target }) => ({
    id: item.id,
    current: claimed.has(item.id) ? target : Math.min(target, Math.max(0, metrics[metric])),
    claimed: claimed.has(item.id),
  }));
}

export function isPermanentGameplayBadge(id: string, durationHours: number | undefined): boolean {
  return durationHours === 0 && GAMEPLAY_REWARDS.some(({ item }) => item.id === id && item.category === 'badge');
}

export type ChestOpening = { rarity: ItemRarity; key?: InventoryItem; alternateKeyIds?: readonly string[] };
const chestOpenings: Record<string, ChestOpening> = {
  chest: { rarity: 'common', key: silverKey, alternateKeyIds: ['key_master', 'key'] },
  chest_wood: { rarity: 'common', key: silverKey, alternateKeyIds: ['key_master'] },
  chest_silver: { rarity: 'rare', key: silverKey, alternateKeyIds: ['key_master'] },
  chest_gold: { rarity: 'epic', key: goldKey, alternateKeyIds: ['key_master'] },
  chest_diamond: { rarity: 'mythic', key: diamondKey, alternateKeyIds: ['key_master'] },
  chest_legendary: { rarity: 'mythic', key: diamondKey, alternateKeyIds: ['key_master'] },
  mega_chest: { rarity: 'common', key: silverKey, alternateKeyIds: ['key_master'] },
  gift: { rarity: 'epic' },
  gift_box: { rarity: 'epic' },
};

export function getChestOpening(id: string): ChestOpening | undefined {
  return Object.hasOwn(chestOpenings, id) ? chestOpenings[id] : undefined;
}
