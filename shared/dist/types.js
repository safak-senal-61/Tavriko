"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EVENT_DEFINITIONS = exports.SHOP_CATALOG = exports.SEASON_1_TIERS = void 0;
exports.getXpRequiredForLevel = getXpRequiredForLevel;
exports.calculateLevelFromXp = calculateLevelFromXp;
exports.generateSeason1Tiers = generateSeason1Tiers;
exports.getDailyChallengeConfig = getDailyChallengeConfig;
/**
 * Steep, balanced RPG leveling curve designed for longevity:
 * - Level 1: 500 XP
 * - Level 2: 800 XP
 * - Level 3: 1,200 XP
 * - Level 4: 1,700 XP
 * - Level 5: 2,300 XP
 * - Level 6..10: Progressive +1,200 XP per level (reach ~8,300 XP at Level 10)
 * - Level 11..20: Noticeably harder, +2,200 XP per level (~30,000 XP per level at Level 20)
 * - Level 21..30: Serious dedication, +5,000 XP per level (~80,000 XP at Level 30)
 * - Level 31+: Veteran players only, +12,000 XP per level
 */
function getXpRequiredForLevel(level) {
    if (level <= 1)
        return 500;
    if (level === 2)
        return 800;
    if (level === 3)
        return 1200;
    if (level === 4)
        return 1700;
    if (level === 5)
        return 2300;
    if (level <= 10) {
        return 2300 + (level - 5) * 1200;
    }
    if (level <= 20) {
        return 8300 + (level - 10) * 2200;
    }
    if (level <= 30) {
        return 30300 + (level - 20) * 5000;
    }
    return 80300 + (level - 30) * 12000;
}
function calculateLevelFromXp(totalXp = 0) {
    const safeXp = Math.max(0, Math.floor(totalXp || 0));
    let level = 1;
    let prevThreshold = 0;
    let neededForNext = getXpRequiredForLevel(1);
    let currentThreshold = neededForNext;
    while (safeXp >= currentThreshold && level < 100) {
        level++;
        prevThreshold = currentThreshold;
        neededForNext = getXpRequiredForLevel(level);
        currentThreshold += neededForNext;
    }
    const currentLevelXp = safeXp - prevThreshold;
    const nextLevelXpRequired = neededForNext;
    const progressPct = Math.min(100, Math.max(0, Math.round((currentLevelXp / nextLevelXpRequired) * 100)));
    const rankTitle = level >= 50
        ? 'Evrenin Hakimi'
        : level >= 40
            ? 'Efsanevi Deha'
            : level >= 30
                ? 'Büyük Üstat'
                : level >= 20
                    ? 'Usta Bilgin'
                    : level >= 15
                        ? 'Stratejist'
                        : level >= 10
                            ? 'Bilgi Şövalyesi'
                            : level >= 6
                                ? 'Usta Kaşif'
                                : level >= 3
                                    ? 'Yükselen Yıldız'
                                    : 'Acemi Kaşif';
    return {
        level,
        rankTitle,
        currentLevelXp,
        nextLevelXpRequired,
        progressPct,
        totalXp: safeXp,
    };
}
// Helper generating 50 rich, balanced tiers for Season 1
function generateSeason1Tiers() {
    const tiers = [];
    for (let i = 1; i <= 50; i++) {
        const requiredSeasonXp = i * 400; // Tier 1: 400 XP ... Tier 50: 20,000 XP
        // Free Track Rewards
        let freeReward;
        if (i === 1) {
            freeReward = { type: 'coin', amount: 500, title: '500 Altın', rarity: 'common' };
        }
        else if (i === 5) {
            freeReward = { type: 'chest', amount: 1, title: 'Ahşap Sandık', itemId: 'chest_wood', rarity: 'common' };
        }
        else if (i === 10) {
            freeReward = { type: 'key', amount: 1, title: 'Gümüş Anahtar', itemId: 'key_silver', rarity: 'rare' };
        }
        else if (i === 15) {
            freeReward = { type: 'gem', amount: 30, title: '30 Elmas', rarity: 'rare' };
        }
        else if (i === 20) {
            freeReward = { type: 'chest', amount: 1, title: 'Gümüş Sandık', itemId: 'chest_silver', rarity: 'rare' };
        }
        else if (i === 25) {
            freeReward = { type: 'key', amount: 1, title: 'Altın Anahtar', itemId: 'key_gold', rarity: 'epic' };
        }
        else if (i === 30) {
            freeReward = { type: 'booster', amount: 1, title: '2x XP (1 Saat)', itemId: 'booster_xp_2x_1h', rarity: 'rare' };
        }
        else if (i === 35) {
            freeReward = { type: 'chest', amount: 1, title: 'Altın Sandık', itemId: 'chest_gold', rarity: 'epic' };
        }
        else if (i === 40) {
            freeReward = { type: 'gem', amount: 80, title: '80 Elmas', rarity: 'epic' };
        }
        else if (i === 45) {
            freeReward = { type: 'key', amount: 1, title: 'Altın Anahtar', itemId: 'key_gold', rarity: 'epic' };
        }
        else if (i === 50) {
            freeReward = { type: 'badge', amount: 1, title: 'Sezon 1 Şampiyonu Rozeti', itemId: 'badge_season_1_champ', rarity: 'legendary' };
        }
        else if (i % 5 === 0) {
            freeReward = { type: 'gem', amount: 15 + Math.floor(i / 2), title: `${15 + Math.floor(i / 2)} Elmas`, rarity: 'rare' };
        }
        else if (i % 2 === 0) {
            freeReward = { type: 'coin', amount: 300 + i * 25, title: `${300 + i * 25} Altın`, rarity: 'common' };
        }
        else {
            freeReward = { type: 'gem', amount: 5 + Math.floor(i / 5), title: `${5 + Math.floor(i / 5)} Elmas`, rarity: 'common' };
        }
        // Premium Pass Track Rewards (3x-5x value + exclusive cosmetics)
        let premiumReward;
        if (i === 1) {
            premiumReward = { type: 'frame', amount: 1, title: 'Sezon 1 Neon Çerçeve', itemId: 'frame_neon', rarity: 'epic' };
        }
        else if (i === 5) {
            premiumReward = { type: 'chest', amount: 1, title: 'Altın Sandık', itemId: 'chest_gold', rarity: 'epic' };
        }
        else if (i === 10) {
            premiumReward = { type: 'name_effect', amount: 1, title: 'Altın İsim Parıltısı', itemId: 'name_glow_gold', rarity: 'epic' };
        }
        else if (i === 15) {
            premiumReward = { type: 'gem', amount: 100, title: '100 Elmas', rarity: 'epic' };
        }
        else if (i === 20) {
            premiumReward = { type: 'frame', amount: 1, title: 'Kraliyet Altın Çerçeve', itemId: 'frame_gold', rarity: 'legendary' };
        }
        else if (i === 25) {
            premiumReward = { type: 'key', amount: 1, title: 'Elmas Anahtar', itemId: 'key_diamond', rarity: 'legendary' };
        }
        else if (i === 30) {
            premiumReward = { type: 'background', amount: 1, title: 'Nebula Profil Arka Planı', itemId: 'bg_nebula', rarity: 'legendary' };
        }
        else if (i === 35) {
            premiumReward = { type: 'chest', amount: 1, title: 'Elmas Sandık', itemId: 'chest_diamond', rarity: 'legendary' };
        }
        else if (i === 40) {
            premiumReward = { type: 'name_effect', amount: 1, title: 'Ateş Gradyan İsim', itemId: 'name_gradient_fire', rarity: 'legendary' };
        }
        else if (i === 45) {
            premiumReward = { type: 'chest', amount: 1, title: 'Efsanevi Sandık', itemId: 'chest_legendary', rarity: 'mythic' };
        }
        else if (i === 50) {
            premiumReward = { type: 'frame', amount: 1, title: 'Alev Çerçevesi (Mitolojik)', itemId: 'frame_flame', rarity: 'mythic' };
        }
        else if (i % 4 === 0) {
            premiumReward = { type: 'key', amount: 1, title: 'Altın Anahtar', itemId: 'key_gold', rarity: 'epic' };
        }
        else if (i % 2 === 0) {
            premiumReward = { type: 'gem', amount: 35 + i * 2, title: `${35 + i * 2} Elmas`, rarity: 'rare' };
        }
        else {
            premiumReward = { type: 'coin', amount: 1200 + i * 60, title: `${1200 + i * 60} Altın`, rarity: 'rare' };
        }
        tiers.push({
            tier: i,
            requiredSeasonXp,
            freeReward,
            premiumReward,
        });
    }
    return tiers;
}
exports.SEASON_1_TIERS = generateSeason1Tiers();
exports.SHOP_CATALOG = [
    // --- Featured ---
    {
        id: 'pack_season_premium_pass',
        name: 'Sezon 1 Premium Pass',
        desc: '50 kademelik mitolojik ve efsanevi ödül yolunun kilidini hemen açar!',
        category: 'featured',
        price: 250,
        currency: 'gems',
        rarity: 'mythic',
        badge: 'EN POPÜLER',
        grantPremiumPass: true,
    },
    {
        id: 'pack_starter',
        name: 'Başlangıç Paketi',
        desc: '2.000 Altın, 100 Elmas, 1x Altın Sandık ve 1x Altın Anahtar!',
        category: 'featured',
        price: 59.99,
        currency: 'try',
        rarity: 'epic',
        badge: '%70 İNDİRİM',
        grantCoins: 2000,
        grantGems: 100,
        grantItems: [
            { id: 'chest_gold', name: 'Altın Sandık', desc: 'Altın anahtar ile açılır', qty: 1, category: 'chest', rarity: 'epic' },
            { id: 'key_gold', name: 'Altın Anahtar', desc: 'Altın sandıkları açar', qty: 1, category: 'key', rarity: 'epic' },
        ],
    },
    {
        id: 'pack_mega_bundle',
        name: 'Efsanevi Kaşif Paketi',
        desc: '1x Efsanevi Sandık, 2x Elmas Anahtar, 10.000 Altın ve Alev Çerçevesi!',
        category: 'featured',
        price: 199.99,
        currency: 'try',
        rarity: 'mythic',
        badge: 'MEGA FIRSAT',
        grantCoins: 10000,
        grantItems: [
            { id: 'chest_legendary', name: 'Efsanevi Sandık', desc: 'Elmas anahtar ile açılır', qty: 1, category: 'chest', rarity: 'mythic' },
            { id: 'key_diamond', name: 'Elmas Anahtar', desc: 'Efsanevi sandıkları açar', qty: 2, category: 'key', rarity: 'legendary' },
            { id: 'frame_flame', name: 'Alev Çerçevesi', desc: 'Profilinize ateşli alev efekti ekler', qty: 1, category: 'frame', rarity: 'mythic' },
        ],
    },
    // --- Diamonds (Real Money) ---
    {
        id: 'gems_100',
        name: '100 Elmas',
        desc: 'Hızlı kozmetik ve anahtar alımı için ideal başlangıç',
        category: 'diamonds',
        price: 39.99,
        currency: 'try',
        rarity: 'common',
        grantGems: 100,
    },
    {
        id: 'gems_300',
        name: '330 Elmas',
        desc: '300 + 30 Bonus Elmas!',
        category: 'diamonds',
        price: 99.99,
        currency: 'try',
        rarity: 'rare',
        bonusText: '+30 BONUS',
        grantGems: 330,
    },
    {
        id: 'gems_600',
        name: '700 Elmas',
        desc: '600 + 100 Bonus Elmas!',
        category: 'diamonds',
        price: 189.99,
        currency: 'try',
        rarity: 'epic',
        bonusText: '+100 BONUS',
        grantGems: 700,
    },
    {
        id: 'gems_1500',
        name: '1.850 Elmas',
        desc: '1.500 + 350 Büyük Bonus Elmas!',
        category: 'diamonds',
        price: 449.99,
        currency: 'try',
        rarity: 'legendary',
        bonusText: '+350 BONUS',
        badge: 'EN AVANTAJLI',
        grantGems: 1850,
    },
    // --- Gold (Diamonds) ---
    {
        id: 'coins_1000',
        name: '1.000 Altın',
        desc: 'Oda kurma ve sandık alımları için altın kesesi',
        category: 'gold',
        price: 10,
        currency: 'gems',
        rarity: 'common',
        grantCoins: 1000,
    },
    {
        id: 'coins_3000',
        name: '3.500 Altın',
        desc: '3.000 + 500 Bonus Altın!',
        category: 'gold',
        price: 30,
        currency: 'gems',
        rarity: 'rare',
        bonusText: '+500 BONUS',
        grantCoins: 3500,
    },
    {
        id: 'coins_10000',
        name: '12.000 Altın',
        desc: '10.000 + 2.000 Bonus Altın!',
        category: 'gold',
        price: 90,
        currency: 'gems',
        rarity: 'epic',
        bonusText: '+2.000 BONUS',
        grantCoins: 12000,
    },
    {
        id: 'coins_30000',
        name: '40.000 Altın',
        desc: '30.000 + 10.000 Devasa Altın Hazinesi!',
        category: 'gold',
        price: 250,
        currency: 'gems',
        rarity: 'legendary',
        bonusText: '+10.000 BONUS',
        grantCoins: 40000,
    },
    // --- Chests ---
    {
        id: 'chest_wood',
        name: 'Ahşap Sandık',
        desc: 'Gümüş anahtar ile açılır. 200-400 Altın ve sürpriz eşyalar içerir.',
        category: 'chests',
        price: 150,
        currency: 'coins',
        rarity: 'common',
        grantItems: [{ id: 'chest_wood', name: 'Ahşap Sandık', desc: 'Gümüş anahtar ile açılır', qty: 1, category: 'chest', rarity: 'common' }],
    },
    {
        id: 'chest_silver',
        name: 'Gümüş Sandık',
        desc: 'Gümüş anahtar ile açılır. 500-1.200 Altın ve 15-30 Elmas içerir.',
        category: 'chests',
        price: 450,
        currency: 'coins',
        rarity: 'rare',
        grantItems: [{ id: 'chest_silver', name: 'Gümüş Sandık', desc: 'Gümüş anahtar ile açılır', qty: 1, category: 'chest', rarity: 'rare' }],
    },
    {
        id: 'chest_gold',
        name: 'Altın Sandık',
        desc: 'Altın anahtar ile açılır. 1.500-3.000 Altın, 40-80 Elmas ve kozmetik şansı.',
        category: 'chests',
        price: 1200,
        currency: 'coins',
        rarity: 'epic',
        grantItems: [{ id: 'chest_gold', name: 'Altın Sandık', desc: 'Altın anahtar ile açılır', qty: 1, category: 'chest', rarity: 'epic' }],
    },
    {
        id: 'chest_legendary',
        name: 'Efsanevi Sandık',
        desc: 'Elmas anahtar ile açılır. Garantili destansı/efsanevi kozmetik ve büyük ödül!',
        category: 'chests',
        price: 120,
        currency: 'gems',
        rarity: 'mythic',
        badge: 'MİTOLOJİK',
        grantItems: [{ id: 'chest_legendary', name: 'Efsanevi Sandık', desc: 'Elmas anahtar ile açılır', qty: 1, category: 'chest', rarity: 'mythic' }],
    },
    // --- Keys ---
    {
        id: 'key_silver',
        name: 'Gümüş Anahtar',
        desc: 'Ahşap ve Gümüş sandıkları açmak için kullanılır.',
        category: 'keys',
        price: 200,
        currency: 'coins',
        rarity: 'rare',
        grantItems: [{ id: 'key_silver', name: 'Gümüş Anahtar', desc: 'Sandıkları açar', qty: 1, category: 'key', rarity: 'rare' }],
    },
    {
        id: 'key_gold',
        name: 'Altın Anahtar',
        desc: 'Altın ve Sezon sandıklarının kilitlerini açar.',
        category: 'keys',
        price: 500,
        currency: 'coins',
        rarity: 'epic',
        grantItems: [{ id: 'key_gold', name: 'Altın Anahtar', desc: 'Altın sandıkları açar', qty: 1, category: 'key', rarity: 'epic' }],
    },
    {
        id: 'key_diamond',
        name: 'Elmas Anahtar',
        desc: 'Efsanevi ve Mitolojik sandıkları açan en nadir anahtar.',
        category: 'keys',
        price: 45,
        currency: 'gems',
        rarity: 'legendary',
        grantItems: [{ id: 'key_diamond', name: 'Elmas Anahtar', desc: 'Efsanevi sandıkları açar', qty: 1, category: 'key', rarity: 'legendary' }],
    },
    // --- Frames ---
    {
        id: 'frame_neon',
        name: 'Siber Neon Çerçeve',
        desc: 'Avatarınıza göz alıcı neon mavi ve pembe siber ışık efekti verir.',
        category: 'frames',
        price: 60,
        currency: 'gems',
        rarity: 'epic',
        grantItems: [{ id: 'frame_neon', name: 'Siber Neon Çerçeve', desc: 'Neon avatar çerçevesi', qty: 1, category: 'frame', rarity: 'epic' }],
    },
    {
        id: 'frame_gold',
        name: 'Kraliyet Altın Çerçeve',
        desc: 'Kraliyet saraylarına layık 24 ayar parıldayan altın çerçeve.',
        category: 'frames',
        price: 90,
        currency: 'gems',
        rarity: 'legendary',
        grantItems: [{ id: 'frame_gold', name: 'Kraliyet Altın Çerçeve', desc: 'Altın profil çerçevesi', qty: 1, category: 'frame', rarity: 'legendary' }],
    },
    {
        id: 'frame_flame',
        name: 'Alev Çerçevesi',
        desc: 'Her maçta rakiplerinize meydan okuyan mitolojik alev animasyonu.',
        category: 'frames',
        price: 150,
        currency: 'gems',
        rarity: 'mythic',
        badge: 'ÖZEL',
        grantItems: [{ id: 'frame_flame', name: 'Alev Çerçevesi', desc: 'Ateşli profil çerçevesi', qty: 1, category: 'frame', rarity: 'mythic' }],
    },
    // --- Badges ---
    {
        id: 'badge_trivia_master',
        name: 'Bilgi Efendisi Rozeti',
        desc: 'Profilinizde yer alacak prestijli altın bilgi şövalyesi mührü.',
        category: 'badges',
        price: 50,
        currency: 'gems',
        rarity: 'epic',
        badge: '1 SAAT',
        grantItems: [{ id: 'badge_trivia_master', name: 'Bilgi Efendisi Rozeti', desc: 'Prestijli bilgi rozeti', qty: 1, category: 'badge', rarity: 'epic' }],
    },
    {
        id: 'badge_speed_demon',
        name: 'Hız Canavarı Rozeti',
        desc: 'Saniyenin altında cevap veren refleks ustalarına özel rozet.',
        category: 'badges',
        price: 50,
        currency: 'gems',
        rarity: 'epic',
        badge: '1 SAAT',
        grantItems: [{ id: 'badge_speed_demon', name: 'Hız Canavarı Rozeti', desc: 'Hızlı refleks rozeti', qty: 1, category: 'badge', rarity: 'epic' }],
    },
    {
        id: 'badge_champion',
        name: 'Şampiyon Kupası Rozeti',
        desc: 'Kupa ile taçlanmış, zirvedeki oyuncuların kızıl-altın şampiyonluk mührü.',
        category: 'badges',
        price: 65,
        currency: 'gems',
        rarity: 'legendary',
        badge: '1 SAAT',
        grantItems: [{ id: 'badge_champion', name: 'Şampiyon Kupası Rozeti', desc: 'Şampiyonluk rozeti', qty: 1, category: 'badge', rarity: 'legendary' }],
    },
    {
        id: 'badge_night_owl',
        name: 'Gece Kuşu Rozeti',
        desc: 'Gece yarısı maçları sevenlere özel, ay ve yıldızlı gece mavisi mühür.',
        category: 'badges',
        price: 40,
        currency: 'gems',
        rarity: 'rare',
        badge: '1 SAAT',
        grantItems: [{ id: 'badge_night_owl', name: 'Gece Kuşu Rozeti', desc: 'Gece kuşu rozeti', qty: 1, category: 'badge', rarity: 'rare' }],
    },
    {
        id: 'badge_veteran',
        name: 'Kıdemli Oyuncu Rozeti',
        desc: 'Yıllara meydan okuyan oyunculara verilmiş bronz-vintage madalya.',
        category: 'badges',
        price: 35,
        currency: 'gems',
        rarity: 'rare',
        badge: '1 SAAT',
        grantItems: [{ id: 'badge_veteran', name: 'Kıdemli Oyuncu Rozeti', desc: 'Kıdemli oyuncu rozeti', qty: 1, category: 'badge', rarity: 'rare' }],
    },
    {
        id: 'badge_genius',
        name: 'Dahi Beyin Rozeti',
        desc: 'Zeka küpü oyuncular için sinaps parıltılı turkuaz-beyaz dahi mührü.',
        category: 'badges',
        price: 55,
        currency: 'gems',
        rarity: 'epic',
        badge: '1 SAAT',
        grantItems: [{ id: 'badge_genius', name: 'Dahi Beyin Rozeti', desc: 'Dahi beyin rozeti', qty: 1, category: 'badge', rarity: 'epic' }],
    },
    // --- Name Effects ---
    {
        id: 'name_glow_gold',
        name: 'Altın İsim Parıltısı',
        desc: 'Liderlik tablolarında ve odalarda isminizi altın sarısı ışıltıyla parlatır.',
        category: 'name_effects',
        price: 45,
        currency: 'gems',
        rarity: 'epic',
        grantItems: [{ id: 'name_glow_gold', name: 'Altın İsim Parıltısı', desc: 'Altın isim efekti', qty: 1, category: 'name_effect', rarity: 'epic' }],
    },
    {
        id: 'name_gradient_fire',
        name: 'Ateş Gradyan İsmi',
        desc: 'İsminizi kızıl lav ve alev gradyan renkleriyle süsler.',
        category: 'name_effects',
        price: 75,
        currency: 'gems',
        rarity: 'legendary',
        grantItems: [{ id: 'name_gradient_fire', name: 'Ateş Gradyan İsmi', desc: 'Ateşli isim efekti', qty: 1, category: 'name_effect', rarity: 'legendary' }],
    },
    // --- Boosters ---
    {
        id: 'booster_xp_2x_1h',
        name: '2x XP Güçlendirici (1 Saat)',
        desc: '1 saat boyunca oynadığınız tüm maçlarda 2 kat XP kazandırır.',
        category: 'boosters',
        price: 25,
        currency: 'gems',
        rarity: 'rare',
        grantItems: [{ id: 'booster_xp_2x_1h', name: '2x XP Güçlendirici (1 Saat)', desc: '1 saat 2x XP', qty: 1, category: 'booster', rarity: 'rare' }],
    },
    {
        id: 'booster_xp_2x_24h',
        name: '2x XP Güçlendirici (24 Saat)',
        desc: 'Tam 24 saat boyunca tüm oyunlarda iki kat seviye XP kazancı sağlar.',
        category: 'boosters',
        price: 70,
        currency: 'gems',
        rarity: 'epic',
        badge: 'GÜNLÜK',
        grantItems: [{ id: 'booster_xp_2x_24h', name: '2x XP Güçlendirici (24 Saat)', desc: '24 saat 2x XP', qty: 1, category: 'booster', rarity: 'epic' }],
    },
    // --- Backgrounds ---
    {
        id: 'bg_nebula',
        name: 'Nebula Profil Arka Planı',
        desc: 'Profil sayfanıza derin uzay ve mor galaksi teması uygular.',
        category: 'backgrounds',
        price: 75,
        currency: 'gems',
        rarity: 'legendary',
        grantItems: [{ id: 'bg_nebula', name: 'Nebula Profil Arka Planı', desc: 'Kozmik profil teması', qty: 1, category: 'background', rarity: 'legendary' }],
    },
    {
        id: 'bg_royal_purple',
        name: 'Kraliyet Moru Teması',
        desc: 'Altın yıldızlar ve kraliyet kadifesi profil arka planı.',
        category: 'backgrounds',
        price: 110,
        currency: 'gems',
        rarity: 'mythic',
        grantItems: [{ id: 'bg_royal_purple', name: 'Kraliyet Moru Teması', desc: 'Kraliyet profil teması', qty: 1, category: 'background', rarity: 'mythic' }],
    },
    // --- YENİ: Süreli (30 gün) Kozmetik Koleksiyonu ---
    // NOT: Profil kozmetikleri 30 gün sonra otomatik düşer.
    {
        id: 'frame_ice',
        name: 'Buz Kristal Çerçeve',
        desc: 'Kutup soğuğunda parlayan buz mavisi kristal halka. 1 saat geçerlidir.',
        category: 'frames',
        price: 55,
        currency: 'gems',
        rarity: 'epic',
        badge: '1 SAAT',
        grantItems: [{ id: 'frame_ice', name: 'Buz Kristal Çerçeve', desc: '1 saat süreli buz çerçevesi', qty: 1, category: 'frame', rarity: 'epic' }],
    },
    {
        id: 'frame_emerald',
        name: 'Zümrüt Orman Çerçevesi',
        desc: 'Tropik ormandan ilham alan zümrüt yeşili halka. 1 saat geçerlidir.',
        category: 'frames',
        price: 40,
        currency: 'gems',
        rarity: 'rare',
        badge: '1 SAAT',
        grantItems: [{ id: 'frame_emerald', name: 'Zümrüt Orman Çerçevesi', desc: '1 saat süreli zümrüt çerçevesi', qty: 1, category: 'frame', rarity: 'rare' }],
    },
    {
        id: 'frame_violet',
        name: 'Menekşe Astral Çerçeve',
        desc: 'Gece gökyüzünü andıran mor-menekşe astral ışık. 1 saat geçerlidir.',
        category: 'frames',
        price: 60,
        currency: 'gems',
        rarity: 'epic',
        badge: '1 SAAT',
        grantItems: [{ id: 'frame_violet', name: 'Menekşe Astral Çerçeve', desc: '1 saat süreli menekşe çerçevesi', qty: 1, category: 'frame', rarity: 'epic' }],
    },
    {
        id: 'bg_sunset',
        name: 'Gün Batımı Teması',
        desc: 'Sıcak turuncu-mor gün batımı profil arka planı. 1 saat geçerlidir.',
        category: 'backgrounds',
        price: 65,
        currency: 'gems',
        rarity: 'epic',
        badge: '1 SAAT',
        grantItems: [{ id: 'bg_sunset', name: 'Gün Batımı Teması', desc: '1 saat süreli gün batımı arka planı', qty: 1, category: 'background', rarity: 'epic' }],
    },
    {
        id: 'bg_forest',
        name: 'Orman Sabahı Teması',
        desc: 'Yeşil ve amber orman sabahı profil arka planı. 1 saat geçerlidir.',
        category: 'backgrounds',
        price: 50,
        currency: 'gems',
        rarity: 'rare',
        badge: '1 SAAT',
        grantItems: [{ id: 'bg_forest', name: 'Orman Sabahı Teması', desc: '1 saat süreli orman arka planı', qty: 1, category: 'background', rarity: 'rare' }],
    },
    {
        id: 'bg_night_city',
        name: 'Gece Şehri Teması',
        desc: 'Neon panelli gece şehri profil arka planı. 1 saat geçerlidir.',
        category: 'backgrounds',
        price: 70,
        currency: 'gems',
        rarity: 'epic',
        badge: '1 SAAT',
        grantItems: [{ id: 'bg_night_city', name: 'Gece Şehri Teması', desc: '1 saat süreli gece şehri arka planı', qty: 1, category: 'background', rarity: 'epic' }],
    },
    {
        id: 'bg_aurora',
        name: 'Kutup Işıkları Teması',
        desc: 'Gökyüzünde dans eden yeşil-mavi kutup ışıkları arka planı. 1 saat geçerlidir.',
        category: 'backgrounds',
        price: 80,
        currency: 'gems',
        rarity: 'legendary',
        badge: '1 SAAT',
        grantItems: [{ id: 'bg_aurora', name: 'Kutup Işıkları Teması', desc: '1 saat süreli kutup ışıkları arka planı', qty: 1, category: 'background', rarity: 'legendary' }],
    },
    {
        id: 'bg_volcano',
        name: 'Volkan Gecesi Teması',
        desc: 'Kızıl lav akışları ve kor parçacıklarıyla volkanik gece arka planı. 1 saat geçerlidir.',
        category: 'backgrounds',
        price: 85,
        currency: 'gems',
        rarity: 'legendary',
        badge: '1 SAAT',
        grantItems: [{ id: 'bg_volcano', name: 'Volkan Gecesi Teması', desc: '1 saat süreli volkan arka planı', qty: 1, category: 'background', rarity: 'legendary' }],
    },
    {
        id: 'name_gradient_ice',
        name: 'Buz Gradyan İsmi',
        desc: 'Buz mavisi kristal gradyanı ile isminizi serinletir. 1 saat geçerlidir.',
        category: 'name_effects',
        price: 50,
        currency: 'gems',
        rarity: 'epic',
        badge: '1 SAAT',
        grantItems: [{ id: 'name_gradient_ice', name: 'Buz Gradyan İsmi', desc: '1 saat süreli buz isim efekti', qty: 1, category: 'name_effect', rarity: 'epic' }],
    },
    {
        id: 'name_gradient_rainbow',
        name: 'Gökkuşağı Gradyan İsmi',
        desc: 'Yedi renk gökkuşağı gradyanıyla isminizi süsler. 1 saat geçerlidir.',
        category: 'name_effects',
        price: 90,
        currency: 'gems',
        rarity: 'mythic',
        badge: '1 SAAT',
        grantItems: [{ id: 'name_gradient_rainbow', name: 'Gökkuşağı Gradyan İsmi', desc: '1 saat süreli gökkuşağı isim efekti', qty: 1, category: 'name_effect', rarity: 'mythic' }],
    },
    // --- YENİ: Farklı tarzlarda isim efektleri (1 saatlik) ---
    {
        id: 'name_emerald_vine',
        name: 'Zümrüt Sarmaşık İsmi',
        desc: 'Işıldayan zümrüt yeşili yapraklarla isminizi süsler. 1 saat geçerlidir.',
        category: 'name_effects',
        price: 30,
        currency: 'gems',
        rarity: 'rare',
        badge: '1 SAAT',
        grantItems: [{ id: 'name_emerald_vine', name: 'Zümrüt Sarmaşık İsmi', desc: '1 saat süreli zümrüt isim efekti', qty: 1, category: 'name_effect', rarity: 'rare' }],
    },
    {
        id: 'name_toxic_slime',
        name: 'Toksik Slime İsmi',
        desc: 'Asit yeşili ve moru karışan radyoaktif slime parıltısı. 1 saat geçerlidir.',
        category: 'name_effects',
        price: 55,
        currency: 'gems',
        rarity: 'epic',
        badge: '1 SAAT',
        grantItems: [{ id: 'name_toxic_slime', name: 'Toksik Slime İsmi', desc: '1 saat süreli toksik isim efekti', qty: 1, category: 'name_effect', rarity: 'epic' }],
    },
    {
        id: 'name_candy_heart',
        name: 'Şeker Pembe İsmi',
        desc: 'Pembe şeker kalp gradyanıyla tatlı bir parıltı. 1 saat geçerlidir.',
        category: 'name_effects',
        price: 55,
        currency: 'gems',
        rarity: 'epic',
        badge: '1 SAAT',
        grantItems: [{ id: 'name_candy_heart', name: 'Şeker Pembe İsmi', desc: '1 saat süreli şeker isim efekti', qty: 1, category: 'name_effect', rarity: 'epic' }],
    },
    {
        id: 'name_void_shadow',
        name: 'Boşluk Gölgesi İsmi',
        desc: 'Karanlık evrenin derin mor gölgesiyle isminizi gizemli kılar. 1 saat geçerlidir.',
        category: 'name_effects',
        price: 70,
        currency: 'gems',
        rarity: 'legendary',
        badge: '1 SAAT',
        grantItems: [{ id: 'name_void_shadow', name: 'Boşluk Gölgesi İsmi', desc: '1 saat süreli boşluk isim efekti', qty: 1, category: 'name_effect', rarity: 'legendary' }],
    },
    {
        id: 'name_plasma_bolt',
        name: 'Plazma Yıldırımı İsmi',
        desc: 'Elektrik mavisi plazma yıldırımlarıyla isminizi çarpar. 1 saat geçerlidir.',
        category: 'name_effects',
        price: 90,
        currency: 'gems',
        rarity: 'mythic',
        badge: '1 SAAT',
        grantItems: [{ id: 'name_plasma_bolt', name: 'Plazma Yıldırımı İsmi', desc: '1 saat süreli plazma isim efekti', qty: 1, category: 'name_effect', rarity: 'mythic' }],
    },
    // --- YENİ: Çalışan farklı güçlendirici iksirler ---
    {
        id: 'booster_xp_3x_1h',
        name: '3x XP İksiri (1 Saat)',
        desc: '1 saat boyunca oynadığın tüm maçlarda 3 kat XP kazanırsın.',
        category: 'boosters',
        price: 45,
        currency: 'gems',
        rarity: 'epic',
        badge: 'YENİ',
        grantItems: [{ id: 'booster_xp_3x_1h', name: '3x XP İksiri (1 Saat)', desc: '1 saat 3x XP', qty: 1, category: 'booster', rarity: 'epic' }],
    },
    {
        id: 'booster_coin_2x_1h',
        name: '2x Altın İksiri (1 Saat)',
        desc: '1 saat boyunca maçlardan kazanığın tüm Altın 2 katına çıkar.',
        category: 'boosters',
        price: 35,
        currency: 'gems',
        rarity: 'rare',
        badge: 'YENİ',
        grantItems: [{ id: 'booster_coin_2x_1h', name: '2x Altın İksiri (1 Saat)', desc: '1 saat 2x Altın', qty: 1, category: 'booster', rarity: 'rare' }],
    },
    {
        id: 'booster_coin_2x_24h',
        name: '2x Altın İksiri (24 Saat)',
        desc: 'Tam 24 saat boyunca maçlardan kazanığın tüm Altın 2 katına çıkar.',
        category: 'boosters',
        price: 95,
        currency: 'gems',
        rarity: 'legendary',
        badge: 'YENİ',
        grantItems: [{ id: 'booster_coin_2x_24h', name: '2x Altın İksiri (24 Saat)', desc: '24 saat 2x Altın', qty: 1, category: 'booster', rarity: 'legendary' }],
    },
    // --- YENİ: Pro/VIP arayüz temaları (uygulamanın tamamını değiştirir, 1 saatlik) ---
    {
        id: 'bg_pro_gold',
        name: 'Pro Altın Kraliyet Teması',
        desc: 'Altın yağmuru ve kraliyet parıltısı: profilin ve uygulamanın tamamı 1 saat boyunca altın kraliyet temasına bürünür.',
        category: 'backgrounds',
        price: 130,
        currency: 'gems',
        rarity: 'mythic',
        badge: 'PRO',
        grantItems: [{ id: 'bg_pro_gold', name: 'Pro Altın Kraliyet Teması', desc: '1 saat süreli altın kraliyet arayüz teması', qty: 1, category: 'background', rarity: 'mythic' }],
    },
    {
        id: 'bg_vip_neon',
        name: 'VIP Neon Teması',
        desc: 'Siberpunk neon şehir: mor-cyan neon ışıklarla profil ve uygulama arayüzü 1 saat boyunca VIP moduna geçer.',
        category: 'backgrounds',
        price: 100,
        currency: 'gems',
        rarity: 'legendary',
        badge: 'VIP',
        grantItems: [{ id: 'bg_vip_neon', name: 'VIP Neon Teması', desc: '1 saat süreli neon VIP arayüz teması', qty: 1, category: 'background', rarity: 'legendary' }],
    },
    {
        id: 'bg_galaxy_vip',
        name: 'Galaksi VIP Teması',
        desc: 'Yıldız tozu ve nebula: tüm uygulama arayüzü 1 saat boyunca derin galaksi moru-kuvars VIP temasına döner.',
        category: 'backgrounds',
        price: 120,
        currency: 'gems',
        rarity: 'mythic',
        badge: 'VIP',
        grantItems: [{ id: 'bg_galaxy_vip', name: 'Galaksi VIP Teması', desc: '1 saat süreli galaksi VIP arayüz teması', qty: 1, category: 'background', rarity: 'mythic' }],
    },
];
exports.EVENT_DEFINITIONS = [
    // --- Daily Events ---
    {
        id: 'daily_5_matches',
        type: 'daily',
        title: 'Günün Savaşçısı',
        desc: 'Günün herhangi bir modunda 5 maç tamamla',
        targetCount: 5,
        metric: 'matches_played',
        rewardCoins: 350,
        rewardGems: 10,
        rewardXp: 40,
        rewardSeasonXp: 60,
        endsInHours: 24,
    },
    {
        id: 'daily_10_correct',
        type: 'daily',
        title: 'Hızlı Zihin',
        desc: 'Toplam 10 soruya doğru cevap ver',
        targetCount: 10,
        metric: 'correct_answers',
        rewardCoins: 250,
        rewardGems: 15,
        rewardXp: 40,
        rewardSeasonXp: 50,
        endsInHours: 24,
    },
    {
        id: 'daily_3_wins',
        type: 'daily',
        title: 'Galibiyet Serisi',
        desc: 'Bugün en az 3 maç kazan',
        targetCount: 3,
        metric: 'wins',
        rewardCoins: 500,
        rewardGems: 20,
        rewardXp: 60,
        rewardSeasonXp: 80,
        rewardItem: { id: 'chest_wood', name: 'Ahşap Sandık', desc: 'Gümüş anahtar ile açılır', qty: 1, category: 'chest', rarity: 'common' },
        endsInHours: 24,
    },
    {
        id: 'daily_streak_5',
        type: 'daily',
        title: 'Kusursuz Seri',
        desc: 'Arka arkaya 5 doğru cevap ver',
        targetCount: 5,
        metric: 'streak',
        rewardCoins: 400,
        rewardGems: 20,
        rewardXp: 60,
        rewardSeasonXp: 70,
        rewardItem: { id: 'key_silver', name: 'Gümüş Anahtar', desc: 'Sandıkları açar', qty: 1, category: 'key', rarity: 'rare' },
        endsInHours: 24,
    },
    // --- Weekly Events ---
    {
        id: 'weekly_league_cup',
        type: 'weekly',
        title: 'Haftalık Lig Kupası',
        desc: 'Haftalık Pro Lig mücadelesinde 15 maç tamamla',
        targetCount: 15,
        metric: 'matches_played',
        rewardCoins: 2000,
        rewardGems: 50,
        rewardXp: 150,
        rewardSeasonXp: 200,
        rewardItem: { id: 'chest_silver', name: 'Gümüş Sandık', desc: 'Gümüş anahtar ile açılır', qty: 1, category: 'chest', rarity: 'rare' },
        endsInHours: 168,
    },
    {
        id: 'weekly_100_correct',
        type: 'weekly',
        title: 'Bilgi Maratonu 100',
        desc: 'Hafta boyunca 100 soruya doğru cevap ver',
        targetCount: 100,
        metric: 'correct_answers',
        rewardCoins: 3000,
        rewardGems: 80,
        rewardXp: 200,
        rewardSeasonXp: 300,
        rewardItem: { id: 'key_gold', name: 'Altın Anahtar', desc: 'Altın sandıkları açar', qty: 1, category: 'key', rarity: 'epic' },
        endsInHours: 168,
    },
    {
        id: 'weekly_20_wins',
        type: 'weekly',
        title: 'Haftalık Zirve',
        desc: 'Hafta boyunca 20 maç kazanarak gücünü göster',
        targetCount: 20,
        metric: 'wins',
        rewardCoins: 4500,
        rewardGems: 120,
        rewardXp: 250,
        rewardSeasonXp: 400,
        rewardItem: { id: 'chest_gold', name: 'Altın Sandık', desc: 'Altın anahtar ile açılır', qty: 1, category: 'chest', rarity: 'epic' },
        endsInHours: 168,
    },
    // --- Special Events ---
    {
        id: 'special_treasure_hunt',
        type: 'special',
        title: 'Büyük Hazine Avı',
        desc: 'Özel etkinlikte toplam 10 galibiyet elde ederek efsanevi hazineyi aç!',
        targetCount: 10,
        metric: 'wins',
        rewardCoins: 5000,
        rewardGems: 150,
        rewardXp: 300,
        rewardSeasonXp: 500,
        rewardItem: { id: 'chest_legendary', name: 'Efsanevi Sandık', desc: 'Elmas anahtar ile açılır', qty: 1, category: 'chest', rarity: 'mythic' },
        endsInHours: 72,
    },
    {
        id: 'special_weekend_cup',
        type: 'special',
        title: 'Hafta Sonu Kupası',
        desc: 'Hafta sonu boyunca 25 maç tamamlayarak Elmas Anahtarı kap!',
        targetCount: 25,
        metric: 'matches_played',
        rewardCoins: 4000,
        rewardGems: 100,
        rewardXp: 250,
        rewardSeasonXp: 350,
        rewardItem: { id: 'key_diamond', name: 'Elmas Anahtar', desc: 'Efsanevi sandıkları açar', qty: 1, category: 'key', rarity: 'legendary' },
        endsInHours: 48,
    },
];
function getDailyChallengeConfig(streakDay = 1) {
    const safeStreak = Math.max(1, streakDay);
    const dayNumber = ((safeStreak - 1) % 7) + 1;
    let totalQuestions = 5;
    let requiredCorrect = 3;
    if (dayNumber === 1) {
        totalQuestions = 5;
        requiredCorrect = 3;
    }
    else if (dayNumber === 2) {
        totalQuestions = 5;
        requiredCorrect = 4;
    }
    else if (dayNumber === 3) {
        totalQuestions = 6;
        requiredCorrect = 5;
    }
    else if (dayNumber === 4) {
        totalQuestions = 7;
        requiredCorrect = 6;
    }
    else if (dayNumber === 5) {
        totalQuestions = 8;
        requiredCorrect = 7;
    }
    else if (dayNumber === 6) {
        totalQuestions = 9;
        requiredCorrect = 8;
    }
    else {
        totalQuestions = 10;
        requiredCorrect = 9;
    }
    // Mütevazı XP: 40..100 (seviye 1 için 500 XP gerekir)
    const rewardXp = 30 + dayNumber * 10;
    const rewardCoins = 40 + dayNumber * 20;
    const rewardGems = 5 + dayNumber * 5;
    // Hediye kutusu yalnızca 7 günlük serinin tamamlanmasında verilir (boş yere görünmez)
    const rewardChest = dayNumber === 7 ? 'gift_box' : undefined;
    return {
        dayNumber,
        totalQuestions,
        requiredCorrect,
        rewardXp,
        rewardCoins,
        rewardGems,
        rewardChest,
        description: `${totalQuestions} soruda en az ${requiredCorrect} doğru yap`,
    };
}
