// ============================================================================
// TAVRIKO — Cosmetic Definitions (Frame / Background / Name Effect)
// ============================================================================
// Süreli (rental) profil kozmetikleri: her profil kozmetiği 30 gün geçerlidir.
// Süre bitince sunucu ve istemci otomatik olarak eşyayı düşürür.
// ----------------------------------------------------------------------------
import type { ItemRarity } from './types';

export const COSMETIC_RENTAL_DAYS = 30;
export const COSMETIC_RENTAL_MS = COSMETIC_RENTAL_DAYS * 24 * 60 * 60 * 1000;

export type CosmeticKind = 'frame' | 'background' | 'name_effect' | 'badge';

/**
 * Herkese açık profil JSON'undan geçerli kozmetikleri çıkarır.
 * expiresAt kontrolü yapar — süresi dolmuşsa null döner.
 */
export function extractProfileCosmetics(profile: {
  equippedFrame?: string;
  equippedBackground?: string;
  equippedNameEffect?: string;
  equippedBadge?: string;
  equippedFrameExpiresAt?: number;
  equippedBackgroundExpiresAt?: number;
  equippedNameEffectExpiresAt?: number;
  equippedBadgeExpiresAt?: number;
}): {
  frame: CosmeticDef | null;
  background: CosmeticDef | null;
  nameEffect: CosmeticDef | null;
  badge: CosmeticDef | null;
} {
  const now = Date.now();
  const frameActive =
    !!profile.equippedFrame &&
    (!profile.equippedFrameExpiresAt || profile.equippedFrameExpiresAt > now);
  const bgActive =
    !!profile.equippedBackground &&
    (!profile.equippedBackgroundExpiresAt || profile.equippedBackgroundExpiresAt > now);
  const nameActive =
    !!profile.equippedNameEffect &&
    (!profile.equippedNameEffectExpiresAt || profile.equippedNameEffectExpiresAt > now);
  const badgeActive =
    !!profile.equippedBadge &&
    (!profile.equippedBadgeExpiresAt || profile.equippedBadgeExpiresAt > now);

  return {
    frame: frameActive ? getFrameDef(profile.equippedFrame) : null,
    background: bgActive ? getBackgroundDef(profile.equippedBackground) : null,
    nameEffect: nameActive ? getNameEffectDef(profile.equippedNameEffect) : null,
    badge: badgeActive ? (getCosmeticDef(profile.equippedBadge) as CosmeticDef | null) : null,
  };
}

export interface CosmeticDef {
  id: string;
  kind: CosmeticKind;
  name: string;
  desc: string;
  rarity: ItemRarity;
  /** Profil kartı üzerinde gözükür */
  visual: {
    /** Çerçeve renkleri — ilk ve ikinci sınır rengi */
    ringColor?: string;
    ringColor2?: string;
    /** Arkaplan renkleri */
    bgColor?: string;
    bgColor2?: string;
    /** İsim rengi / gradyan renkleri */
    nameColor?: string;
    nameColor2?: string;
    /** İsim parıltı efektinin türü */
    nameGlow?: 'gold' | 'fire' | 'ice' | 'rainbow' | 'none';
    /** Animasyon etiketi (CSS'e taşınmaz, sadece bilgi) */
    anim?: 'flame' | 'pulse' | 'shimmer' | 'none';
    icon?: string;
  };
}

// ---------------------------------------------------------------------------
// AVATAR ÇERÇEVELERİ
// ---------------------------------------------------------------------------
export const FRAME_DEFS: CosmeticDef[] = [
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
    visual: { ringColor: '#FFC43D', ringColor2: '#F59E0B', anim: 'shimmer', icon: '👑' },
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
    desc: 'Kutup soğuğunda parlayan buz mavisi kristal halka.',
    rarity: 'epic',
    visual: { ringColor: '#A5F3FC', ringColor2: '#22D3EE', anim: 'shimmer', icon: '❄️' },
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
export const BACKGROUND_DEFS: CosmeticDef[] = [
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
      icon: '👑',
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
];

// ---------------------------------------------------------------------------
// İSİM EFEKTLERİ
// ---------------------------------------------------------------------------
export const NAME_EFFECT_DEFS: CosmeticDef[] = [
  {
    id: 'name_glow_gold',
    kind: 'name_effect',
    name: 'Altın İsim Parıltısı',
    desc: 'Liderlik tablolarında ve odalarda isminiz altın ışıkla parlar.',
    rarity: 'epic',
    visual: { nameColor: '#FFD700', nameGlow: 'gold', anim: 'shimmer', icon: '✨' },
  },
  {
    id: 'name_gradient_fire',
    kind: 'name_effect',
    name: 'Ateş Gradyan İsmi',
    desc: 'İsminizi kızıl lav ve alev gradyanı renkleriyle süsler.',
    rarity: 'legendary',
    visual: { nameColor: '#FF4500', nameColor2: '#FFD700', nameGlow: 'fire', anim: 'flame', icon: '🔥' },
  },
  {
    id: 'name_gradient_ice',
    kind: 'name_effect',
    name: 'Buz Gradyan İsmi',
    desc: 'Buz mavisi kristal gradyanı ile isminizi serinletir.',
    rarity: 'epic',
    visual: { nameColor: '#67E8F9', nameColor2: '#0EA5E9', nameGlow: 'ice', anim: 'shimmer', icon: '❄️' },
  },
  {
    id: 'name_gradient_rainbow',
    kind: 'name_effect',
    name: 'Gökkuşağı Gradyan İsmi',
    desc: 'Yedi renk gökkuşağı gradyanıyla isminizi süsler.',
    rarity: 'mythic',
    visual: {
      nameColor: '#F87171',
      nameColor2: '#A78BFA',
      nameGlow: 'rainbow',
      anim: 'shimmer',
      icon: '🌈',
    },
  },
];

export const COSMETIC_DEFS: CosmeticDef[] = [
  ...FRAME_DEFS,
  ...BACKGROUND_DEFS,
  ...NAME_EFFECT_DEFS,
];

export function getCosmeticDef(id: string | undefined | null): CosmeticDef | null {
  if (!id) return null;
  return COSMETIC_DEFS.find((c) => c.id === id) || null;
}

export function getFrameDef(id: string | undefined | null): CosmeticDef | null {
  const d = getCosmeticDef(id);
  return d && d.kind === 'frame' ? d : null;
}

export function getBackgroundDef(id: string | undefined | null): CosmeticDef | null {
  const d = getCosmeticDef(id);
  return d && d.kind === 'background' ? d : null;
}

export function getNameEffectDef(id: string | undefined | null): CosmeticDef | null {
  const d = getCosmeticDef(id);
  return d && d.kind === 'name_effect' ? d : null;
}

/**
 * Süreli kozmetik süresi dolmuş mu kontrol eder.
 * (expiresAt undefined ise süresiz kabul edilir — sadece sistem kaynaklı kozmetikler)
 */
export function isCosmeticExpired(expiresAt: number | null | undefined): boolean {
  if (expiresAt === null || expiresAt === undefined) return false;
  return Date.now() >= expiresAt;
}
