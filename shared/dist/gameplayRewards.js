"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GAMEPLAY_REWARDS = void 0;
exports.gameplayRewardStatuses = gameplayRewardStatuses;
exports.isPermanentGameplayBadge = isPermanentGameplayBadge;
exports.getChestOpening = getChestOpening;
const cosmetics_1 = require("./cosmetics");
const silverKey = { id: 'key_silver', name: 'Gümüş Anahtar', desc: 'Ahşap ve gümüş sandıkları açar.', qty: 1, category: 'key', rarity: 'rare' };
const goldKey = { id: 'key_gold', name: 'Altın Anahtar', desc: 'Altın sandıkları açar.', qty: 1, category: 'key', rarity: 'epic' };
const diamondKey = { id: 'key_diamond', name: 'Elmas Anahtar', desc: 'Efsanevi ve elmas sandıkları açar.', qty: 1, category: 'key', rarity: 'legendary' };
const chest = (id, name, rarity, target, key) => ({
    item: { id, name, rarity, qty: 1, category: 'chest', desc: `${key.name} ile açılır.` },
    key, metric: 'matches', target, task: `${target} geçerli maç tamamla.`,
});
const badge = (id, metric, target, task) => {
    const def = (0, cosmetics_1.getBadgeDef)(id);
    if (!def)
        throw new Error(`Missing gameplay badge definition: ${id}`);
    return { item: { id, name: def.name, rarity: def.rarity, qty: 1, category: 'badge', desc: 'Kalıcı görev rozeti.' }, metric, target, task };
};
exports.GAMEPLAY_REWARDS = [
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
function gameplayRewardStatuses(metrics, claimedIds) {
    const claimed = new Set(claimedIds);
    return exports.GAMEPLAY_REWARDS.map(({ item, metric, target }) => ({
        id: item.id,
        current: claimed.has(item.id) ? target : Math.min(target, Math.max(0, metrics[metric])),
        claimed: claimed.has(item.id),
    }));
}
function isPermanentGameplayBadge(id, durationHours) {
    return durationHours === 0 && exports.GAMEPLAY_REWARDS.some(({ item }) => item.id === id && item.category === 'badge');
}
const chestOpenings = {
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
function getChestOpening(id) {
    return Object.hasOwn(chestOpenings, id) ? chestOpenings[id] : undefined;
}
