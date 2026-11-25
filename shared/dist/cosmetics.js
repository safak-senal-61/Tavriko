"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COSMETIC_DEFS = exports.BADGE_DEFS = exports.NAME_EFFECT_DEFS = exports.BACKGROUND_DEFS = exports.FRAME_DEFS = exports.COSMETIC_RENTAL_MS = exports.COSMETIC_RENTAL_HOURS = void 0;
exports.extractProfileCosmetics = extractProfileCosmetics;
exports.getCosmeticDef = getCosmeticDef;
exports.getFrameDef = getFrameDef;
exports.getBackgroundDef = getBackgroundDef;
exports.getNameEffectDef = getNameEffectDef;
exports.getBadgeDef = getBadgeDef;
exports.isCosmeticExpired = isCosmeticExpired;
const nickStyles_1 = require("./nickStyles");
exports.COSMETIC_RENTAL_HOURS = 1;
exports.COSMETIC_RENTAL_MS = exports.COSMETIC_RENTAL_HOURS * 60 * 60 * 1000;
/**
 * Herkese açık profil JSON'undan geçerli kozmetikleri çıkarır.
 * expiresAt kontrolü yapar — süresi dolmuşsa null döner.
 */
function extractProfileCosmetics(profile) {
    const now = Date.now();
    const frameActive = !!profile.equippedFrame &&
        (!profile.equippedFrameExpiresAt || profile.equippedFrameExpiresAt > now);
    const bgActive = !!profile.equippedBackground &&
        (!profile.equippedBackgroundExpiresAt || profile.equippedBackgroundExpiresAt > now);
    const nameActive = !!profile.equippedNameEffect &&
        (!profile.equippedNameEffectExpiresAt || profile.equippedNameEffectExpiresAt > now);
    const badgeActive = !!profile.equippedBadge &&
        (!profile.equippedBadgeExpiresAt || profile.equippedBadgeExpiresAt > now);
    return {
        frame: frameActive ? getFrameDef(profile.equippedFrame) : null,
        background: bgActive ? getBackgroundDef(profile.equippedBackground) : null,
        nameEffect: nameActive ? getNameEffectDef(profile.equippedNameEffect) : null,
        badge: badgeActive ? getCosmeticDef(profile.equippedBadge) : null,
    };
}
// ---------------------------------------------------------------------------
// AVATAR ÇERÇEVELERİ
// ---------------------------------------------------------------------------
exports.FRAME_DEFS = [
    {
        id: 'frame_neon',
        kind: 'frame',
        name: 'Siber Neon Çerçeve',
        desc: 'Göz alıcı neon mavi ve pembe siber ışık halkası.',
        rarity: 'epic',
        visual: { ringColor: '#38BDF8', ringColor2: '#F472B6', anim: 'pulse', icon: '💠' },
    },
    {
        id: 'frame_gold',
        kind: 'frame',
        name: 'Kraliyet Altın Çerçeve',
        desc: '24 ayar parıldayan kraliyet altın halkası.',
        rarity: 'legendary',
        visual: { ringColor: '#FFC43D', ringColor2: '#F59E0B', anim: 'shimmer', icon: '✦' },
    },
    {
        id: 'frame_flame',
        kind: 'frame',
        name: 'Alev Çerçevesi',
        desc: 'Her maçta rakiplerinize meydan okuyan mitolojik alev halkası.',
        rarity: 'mythic',
        visual: { ringColor: '#F97316', ringColor2: '#EF4444', anim: 'flame', icon: '🔥' },
    },
    {
        id: 'frame_ice',
        kind: 'frame',
        name: 'Buz Kristal Çerçeve',
        desc: 'Buz mavisi ve mor kristallerden oluşan ışıltılı halka.',
        rarity: 'epic',
        visual: { ringColor: '#A5F3FC', ringColor2: '#22D3EE', anim: 'shimmer', icon: '❄️' },
    },
    {
        id: 'frame_dragon_phoenix',
        kind: 'frame',
        name: 'Ejderha ve Anka Çerçevesi',
        desc: 'Kadim ejderha ve alevden ankanın çevrelediği işlemeli halka.',
        rarity: 'mythic',
        visual: { ringColor: '#FFAC57', ringColor2: '#C9402D', anim: 'flame' },
    },
    {
        id: 'frame_steampunk',
        kind: 'frame',
        name: 'Buhar Zırhı Çerçevesi',
        desc: 'Pirinç dişliler, zırhlı kanatlar ve mavi ışıklarla işlenmiş halka.',
        rarity: 'legendary',
        visual: { ringColor: '#D7AC64', ringColor2: '#78BAFF', anim: 'pulse' },
    },
    {
        id: 'frame_emerald',
        kind: 'frame',
        name: 'Zümrüt Orman Çerçevesi',
        desc: 'Tropik ormandan ilham alan zümrüt yeşili halka.',
        rarity: 'rare',
        visual: { ringColor: '#34D399', ringColor2: '#10B981', anim: 'pulse', icon: '🌿' },
    },
    {
        id: 'frame_violet',
        kind: 'frame',
        name: 'Menekşe Astral Çerçeve',
        desc: 'Gece gökyüzünü andıran mor-menekşe astral ışık.',
        rarity: 'epic',
        visual: { ringColor: '#A78BFA', ringColor2: '#8B5CF6', anim: 'pulse', icon: '🌀' },
    },
];
// ---------------------------------------------------------------------------
// PROFİL ARKA PLANLARI
// ---------------------------------------------------------------------------
exports.BACKGROUND_DEFS = [
    {
        id: 'bg_nebula',
        kind: 'background',
        name: 'Nebula Profil Arka Planı',
        desc: 'Derin uzay ve mor galaksi temalı profil arka planı.',
        rarity: 'legendary',
        visual: {
            bgColor: '#2E1065',
            bgColor2: '#7C3AED',
            anim: 'shimmer',
            icon: '🌌',
        },
    },
    {
        id: 'bg_royal_purple',
        kind: 'background',
        name: 'Kraliyet Moru Teması',
        desc: 'Altın yıldızlı kraliyet kadifesi arka plan.',
        rarity: 'mythic',
        visual: {
            bgColor: '#1E0E45',
            bgColor2: '#4C1D95',
            anim: 'pulse',
            icon: '✦',
        },
    },
    {
        id: 'bg_sunset',
        kind: 'background',
        name: 'Gün Batımı Teması',
        desc: 'Sıcak turuncu-mor gün batımı profil arka planı.',
        rarity: 'epic',
        visual: {
            bgColor: '#7C2D12',
            bgColor2: '#C2410C',
            anim: 'shimmer',
            icon: '🌅',
        },
    },
    {
        id: 'bg_forest',
        kind: 'background',
        name: 'Orman Sabahı Teması',
        desc: 'Yeşil ve amber orman sabahı profil arka planı.',
        rarity: 'rare',
        visual: {
            bgColor: '#14532D',
            bgColor2: '#166534',
            anim: 'pulse',
            icon: '🌳',
        },
    },
    {
        id: 'bg_night_city',
        kind: 'background',
        name: 'Gece Şehri Teması',
        desc: 'Neon panelli gece şehri profil arka planı.',
        rarity: 'epic',
        visual: {
            bgColor: '#0F172A',
            bgColor2: '#1E293B',
            anim: 'shimmer',
            icon: '🌃',
        },
    },
    // --- YENİ: Pro/VIP Temaları (arayüzü de değiştirir) ---
    {
        id: 'bg_pro_gold',
        kind: 'background',
        name: 'Pro Altın Kraliyet Teması',
        desc: 'Altın yağmuru ve kraliyet parıltısı: profilin ve uygulamanın tamamı 1 saat boyunca altın kraliyet temasına bürünür.',
        rarity: 'mythic',
        visual: {
            bgColor: '#3B2105',
            bgColor2: '#B8860B',
            anim: 'shimmer',
            icon: '✦',
            ui: { accent: '#FFC43D', accent2: '#FFE27A', bgTint: 'rgba(255, 196, 61, 0.10)' },
        },
    },
    {
        id: 'bg_vip_neon',
        kind: 'background',
        name: 'VIP Neon Teması',
        desc: 'Siberpunk neon şehir: mor-cyan neon ışıklarla profil ve uygulama arayüzü 1 saat boyunca VIP moduna geçer.',
        rarity: 'legendary',
        visual: {
            bgColor: '#12002E',
            bgColor2: '#7C3AED',
            anim: 'pulse',
            icon: '💜',
            ui: { accent: '#D946EF', accent2: '#22D3EE', bgTint: 'rgba(217, 70, 239, 0.08)' },
        },
    },
    {
        id: 'bg_galaxy_vip',
        kind: 'background',
        name: 'Galaksi VIP Teması',
        desc: 'Yıldız tozu ve nebula: tüm uygulama arayüzü 1 saat boyunca derin galaksi moru-kuvars VIP temasına döner.',
        rarity: 'mythic',
        visual: {
            bgColor: '#0B0330',
            bgColor2: '#6D28D9',
            anim: 'shimmer',
            icon: '🌌',
            ui: { accent: '#8B5CF6', accent2: '#67E8F9', bgTint: 'rgba(139, 92, 246, 0.09)' },
        },
    },
];
// ---------------------------------------------------------------------------
// İSİM EFEKTLERİ — Animated Nick paketlerinden türetilir (bkz. nickStyles.ts)
// ---------------------------------------------------------------------------
exports.NAME_EFFECT_DEFS = nickStyles_1.NICK_STYLES.map((s) => ({
    id: s.styleId,
    kind: 'name_effect',
    name: s.name,
    desc: s.desc,
    rarity: s.rarity,
    visual: {
        nameColor: s.palette.base,
        nameColor2: s.palette.colors[1] ?? s.palette.base,
        anim: 'shimmer',
        icon: s.icon,
    },
}));
// ---------------------------------------------------------------------------
// ROZETLER (görev ödülleri ve daha önce dağıtılan rozetler)
// ---------------------------------------------------------------------------
exports.BADGE_DEFS = [
    {
        id: 'badge_trivia_master',
        kind: 'badge',
        name: 'Bilgi Efendisi Rozeti',
        desc: 'Prestijli altın bilgi şövalyesi mührü.',
        rarity: 'epic',
        visual: { icon: '🛡️' },
    },
    {
        id: 'badge_speed_demon',
        kind: 'badge',
        name: 'Hız Canavarı Rozeti',
        desc: 'Refleks ustalarına özel turkuaz hız mührü. 1 saat geçerlidir.',
        rarity: 'epic',
        visual: { icon: '⚡' },
    },
    {
        id: 'badge_champion',
        kind: 'badge',
        name: 'Şampiyon Kupası Rozeti',
        desc: 'Zirvedeki oyuncuların kızıl-altın şampiyonluk mührü. 1 saat geçerlidir.',
        rarity: 'legendary',
        visual: { icon: '🏆' },
    },
    {
        id: 'badge_night_owl',
        kind: 'badge',
        name: 'Gece Kuşu Rozeti',
        desc: 'Ay ve yıldızlı gece mavisi mühür. 1 saat geçerlidir.',
        rarity: 'rare',
        visual: { icon: '🌙' },
    },
    {
        id: 'badge_veteran',
        kind: 'badge',
        name: 'Kıdemli Oyuncu Rozeti',
        desc: 'Bronz-vintage kıdem madalyası.',
        rarity: 'rare',
        visual: { icon: '🎖️' },
    },
    {
        id: 'badge_genius',
        kind: 'badge',
        name: 'Dahi Beyin Rozeti',
        desc: 'Sinaps parıltılı turkuaz-beyaz dahi mührü.',
        rarity: 'epic',
        visual: { icon: '🧠' },
    },
    {
        id: 'badge_social_player',
        kind: 'badge',
        name: 'Sosyal Oyuncu Rozeti',
        desc: 'Tavriko’da karşılıklı arkadaşlıklar kuranlara özel.',
        rarity: 'rare',
        visual: { icon: '🤝' },
    },
    {
        id: 'badge_consistent_player',
        kind: 'badge',
        name: 'İstikrarlı Oyuncu Rozeti',
        desc: 'Farklı günlerde arenaya geri dönenlere özel.',
        rarity: 'rare',
        visual: { icon: '📅' },
    },
    {
        id: 'badge_season_1_champ',
        kind: 'badge',
        name: 'Sezon 1 Şampiyonu Rozeti',
        desc: 'Sezon 1’i tamamlayanların efsanevi mührü. 1 saat geçerlidir.',
        rarity: 'legendary',
        visual: { icon: '✦' },
    },
];
exports.COSMETIC_DEFS = [
    ...exports.FRAME_DEFS,
    ...exports.BACKGROUND_DEFS,
    ...exports.NAME_EFFECT_DEFS,
    ...exports.BADGE_DEFS,
];
function getCosmeticDef(id) {
    if (!id)
        return null;
    return exports.COSMETIC_DEFS.find((c) => c.id === id) || null;
}
function getFrameDef(id) {
    const d = getCosmeticDef(id);
    return d && d.kind === 'frame' ? d : null;
}
function getBackgroundDef(id) {
    const d = getCosmeticDef(id);
    return d && d.kind === 'background' ? d : null;
}
function getNameEffectDef(id) {
    const d = getCosmeticDef(id);
    return d && d.kind === 'name_effect' ? d : null;
}
function getBadgeDef(id) {
    const d = getCosmeticDef(id);
    return d && d.kind === 'badge' ? d : null;
}
/**
 * Süreli kozmetik süresi dolmuş mu kontrol eder.
 * (expiresAt undefined ise süresiz kabul edilir — sadece sistem kaynaklı kozmetikler)
 */
function isCosmeticExpired(expiresAt) {
    if (expiresAt === null || expiresAt === undefined)
        return false;
    return Date.now() >= expiresAt;
}
