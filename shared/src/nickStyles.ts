// ============================================================================
// TAVRIKO — Animated Nick Cosmetics: merkezi stil kayıt defteri
// ============================================================================
// Her nick paketi tek bir `NickStyleDef` nesnesidir. Mağaza ürünü, envanter
// kozmetiği, profil kozmetik tanımı ve istemcideki NickRenderer katmanları bu
// listeden türetilir. Yeni paket eklemek için:
//   1. Aşağıdaki NICK_STYLES dizisine `name_` önekli yeni bir kayıt ekleyin.
//   2. `fill` / `particles` alanlarında mevcut efekt türlerinden birini seçin
//      (istemci: client/src/components/nick/*). Yeni bir efekt türü gerekiyorsa
//      NickFill / NickParticles birleşimine ekleyip renderer'da karşılığını yazın.
// `styleId` aynı zamanda envanter/mağaza ürün kimliği ve users.equippedNameEffect
// değeridir; mevcut kimlikler değiştirilmemelidir (kullanıcı verisi korunur).
// ----------------------------------------------------------------------------

export type NickRarity = 'rare' | 'epic' | 'legendary' | 'mythic';

export const NICK_RARITY_ORDER: NickRarity[] = ['rare', 'epic', 'legendary', 'mythic'];

export const NICK_RARITY_LABELS: Record<NickRarity, string> = {
  rare: 'Nadir',
  epic: 'Epik',
  legendary: 'Efsanevi',
  mythic: 'Mitik',
};

export const NICK_RARITY_COLORS: Record<NickRarity, { main: string; soft: string }> = {
  rare: { main: '#3B82F6', soft: 'rgba(59,130,246,0.18)' },
  epic: { main: '#A855F7', soft: 'rgba(168,85,247,0.18)' },
  legendary: { main: '#F59E0B', soft: 'rgba(245,158,11,0.18)' },
  mythic: { main: '#FF416C', soft: 'rgba(255,65,108,0.18)' },
};

/**
 * Metin dolgu efekti. İstemci tam kalitede bunları Skia shader'ı olarak,
 * hafif kalitede renk döngüsü + parıltı olarak çizer.
 */
export type NickFill =
  | 'neon' // iki renk arası akan gradyan + güçlü dış parıltı
  | 'metal' // metalik bantlar + hareketli ışık yansıması
  | 'holo' // gökkuşağı holografik yansıma (açıya göre renk kayması)
  | 'flame' // aşağıdan yukarı titreşen alev gradyanı
  | 'frost' // buz kristali dokusu + soğuk parıltı
  | 'nebula' // galaksi bulutu + yıldız noktaları
  | 'prism' // elmas faset yansımaları ve ışık kırılması
  | 'glitch' // RGB kayması ve kısa titreşimler
  | 'rainbow' // sürekli kayan gökkuşağı
  | 'shadow' // karanlık aura, mor-siyah gölge
  | 'gradient'; // klasik akan gradyan (eski efektler)

/** Metnin çevresindeki parçacık / Lottie katmanı */
export type NickParticles = 'sparkle' | 'embers' | 'electric' | 'stardust' | 'snow' | 'none';

export interface NickStyleDef {
  /** = mağaza ürün id'si = envanter itemId = users.equippedNameEffect */
  styleId: string;
  name: string;
  desc: string;
  rarity: NickRarity;
  /** 1 saatlik temel fiyat (elmas). Süre çarpanı mağazada uygulanır. */
  price: number;
  /** Mağaza vitrini sırası (küçük önce) */
  order: number;
  /** 'pack' = Animated Nick paketleri, 'classic' = eski isim efektleri */
  collection: 'pack' | 'classic';
  badge?: string;
  icon: string;
  palette: {
    /** Düz metin rengi (efekt kapalıyken) */
    base: string;
    /** Dolgu gradyan durakları */
    colors: string[];
    /** Dış parıltı rengi */
    glow: string;
    /** Önizleme plakası arka planı (üst → alt) */
    plate: [string, string];
  };
  fill: NickFill;
  motion: {
    /** Tam döngü süresi (ms) */
    periodMs: number;
    /** Parıltı yarıçapı (dp, yazı boyuna göre ölçeklenir) */
    glow: number;
    /** 0..1 parıltı nefes alma miktarı */
    pulse: number;
  };
  particles: { kind: NickParticles; colors: string[] };
}

export const NICK_STYLES: NickStyleDef[] = [
  {
    styleId: 'name_neon',
    name: 'Neon Nick',
    desc: 'Mavi-mor neon tüp ışığı: sürekli parlayan, nefes alan siber glow.',
    rarity: 'rare',
    price: 30,
    order: 10,
    collection: 'pack',
    badge: 'YENİ',
    icon: '💠',
    palette: { base: '#7DD3FC', colors: ['#38BDF8', '#818CF8', '#C084FC', '#38BDF8'], glow: '#6366F1', plate: ['#0B1030', '#1E1B4B'] },
    fill: 'neon',
    motion: { periodMs: 3200, glow: 10, pulse: 0.55 },
    particles: { kind: 'none', colors: [] },
  },
  {
    styleId: 'name_glow_gold',
    name: 'Gold Nick',
    desc: 'Metalik altın yüzey ve üzerinden kayan canlı ışık yansıması.',
    rarity: 'epic',
    price: 45,
    order: 20,
    collection: 'pack',
    icon: '✨',
    palette: { base: '#FFD700', colors: ['#7A4E0B', '#FFD36B', '#FFF4C2', '#E0A526', '#8A5A12'], glow: '#F5B301', plate: ['#1C1204', '#3B2608'] },
    fill: 'metal',
    motion: { periodMs: 2600, glow: 6, pulse: 0.2 },
    particles: { kind: 'sparkle', colors: ['#FFF4C2', '#FFD36B'] },
  },
  {
    styleId: 'name_holographic',
    name: 'Holographic Nick',
    desc: 'Gökkuşağı renk geçişleri ve açıya göre değişen holografik yansıma.',
    rarity: 'legendary',
    price: 80,
    order: 30,
    collection: 'pack',
    badge: 'YENİ',
    icon: '🪩',
    palette: { base: '#E0E7FF', colors: ['#A5F3FC', '#F0ABFC', '#FDE68A', '#86EFAC', '#A5B4FC'], glow: '#C4B5FD', plate: ['#101326', '#2A2350'] },
    fill: 'holo',
    motion: { periodMs: 4200, glow: 7, pulse: 0.25 },
    particles: { kind: 'sparkle', colors: ['#FFFFFF', '#F0ABFC', '#A5F3FC'] },
  },
  {
    styleId: 'name_gradient_fire',
    name: 'Fire Nick',
    desc: 'Hareketli alev dolgusu, turuncu-kırmızı ışık ve yükselen kıvılcımlar.',
    rarity: 'legendary',
    price: 75,
    order: 40,
    collection: 'pack',
    icon: '🔥',
    palette: { base: '#FF7A1A', colors: ['#7F1D1D', '#EF4444', '#F97316', '#FDBA74', '#FFF1C1'], glow: '#F97316', plate: ['#1A0603', '#3D0F06'] },
    fill: 'flame',
    motion: { periodMs: 1600, glow: 9, pulse: 0.45 },
    particles: { kind: 'embers', colors: ['#FDBA74', '#F97316', '#FDE68A'] },
  },
  {
    styleId: 'name_gradient_ice',
    name: 'Ice Nick',
    desc: 'Buz kristali dokusu, soğuk mavi parıltı ve yavaşça yayılan donma efekti.',
    rarity: 'epic',
    price: 50,
    order: 50,
    collection: 'pack',
    icon: '❄️',
    palette: { base: '#A5F3FC', colors: ['#0EA5E9', '#7DD3FC', '#E0F2FE', '#FFFFFF', '#38BDF8'], glow: '#38BDF8', plate: ['#03141F', '#0B2E44'] },
    fill: 'frost',
    motion: { periodMs: 5200, glow: 7, pulse: 0.3 },
    particles: { kind: 'snow', colors: ['#E0F2FE', '#BAE6FD'] },
  },
  {
    styleId: 'name_galaxy',
    name: 'Galaxy Nick',
    desc: 'Nebula renkleriyle dolu harfler, yanıp sönen yıldızlar ve kozmik toz.',
    rarity: 'legendary',
    price: 80,
    order: 60,
    collection: 'pack',
    badge: 'YENİ',
    icon: '🌌',
    palette: { base: '#C4B5FD', colors: ['#1E1B4B', '#6D28D9', '#DB2777', '#22D3EE', '#312E81'], glow: '#8B5CF6', plate: ['#05031A', '#1B0F3D'] },
    fill: 'nebula',
    motion: { periodMs: 7000, glow: 8, pulse: 0.3 },
    particles: { kind: 'stardust', colors: ['#FFFFFF', '#C4B5FD', '#67E8F9'] },
  },
  {
    styleId: 'name_inferno',
    name: 'Inferno',
    desc: 'Harfleri saran yoğun alev çekirdeği ve yoğun ateş parçacıkları.',
    rarity: 'mythic',
    price: 110,
    order: 70,
    collection: 'pack',
    badge: 'YENİ',
    icon: '☄️',
    palette: { base: '#FF4D1A', colors: ['#450A0A', '#B91C1C', '#EA580C', '#FACC15', '#FFFBEB'], glow: '#DC2626', plate: ['#120201', '#360A03'] },
    fill: 'flame',
    motion: { periodMs: 1100, glow: 13, pulse: 0.6 },
    particles: { kind: 'embers', colors: ['#FACC15', '#EA580C', '#FFFBEB', '#EF4444'] },
  },
  {
    styleId: 'name_diamond',
    name: 'Diamond',
    desc: 'Elmas faset yansımaları, ışık kırılmaları ve keskin pırıltılar.',
    rarity: 'mythic',
    price: 120,
    order: 80,
    collection: 'pack',
    badge: 'YENİ',
    icon: '💎',
    palette: { base: '#E0F7FF', colors: ['#BAE6FD', '#FFFFFF', '#C7D2FE', '#99F6E4', '#FFFFFF'], glow: '#7DD3FC', plate: ['#06121F', '#16304A'] },
    fill: 'prism',
    motion: { periodMs: 3000, glow: 6, pulse: 0.25 },
    particles: { kind: 'sparkle', colors: ['#FFFFFF', '#BAE6FD', '#C7D2FE'] },
  },
  {
    styleId: 'name_royal_gold',
    name: 'Royal Gold',
    desc: 'Kraliyet altını ve şarap kırmızısı ışık geçişleriyle lüks taç görünümü.',
    rarity: 'legendary',
    price: 85,
    order: 90,
    collection: 'pack',
    badge: 'YENİ',
    icon: '👑',
    palette: { base: '#FACC15', colors: ['#5B1A1A', '#C2410C', '#FDE68A', '#FFFBEB', '#CA8A04', '#7C2D12'], glow: '#EAB308', plate: ['#1A0710', '#3F1222'] },
    fill: 'metal',
    motion: { periodMs: 3600, glow: 8, pulse: 0.3 },
    particles: { kind: 'sparkle', colors: ['#FDE68A', '#FFFFFF', '#FCA5A5'] },
  },
  {
    styleId: 'name_glitch',
    name: 'Glitch',
    desc: 'Dijital bozulma, RGB kanal kayması ve kısa elektrik titreşimleri.',
    rarity: 'epic',
    price: 55,
    order: 100,
    collection: 'pack',
    badge: 'YENİ',
    icon: '📺',
    palette: { base: '#E5E7EB', colors: ['#F8FAFC', '#22D3EE', '#F43F5E'], glow: '#22D3EE', plate: ['#05070A', '#111827'] },
    fill: 'glitch',
    motion: { periodMs: 2400, glow: 4, pulse: 0.15 },
    particles: { kind: 'electric', colors: ['#22D3EE', '#F43F5E'] },
  },
  {
    styleId: 'name_gradient_rainbow',
    name: 'Rainbow',
    desc: 'Harfler boyunca sürekli kayan, hiç durmayan gökkuşağı renkleri.',
    rarity: 'mythic',
    price: 90,
    order: 110,
    collection: 'pack',
    icon: '🌈',
    palette: { base: '#F87171', colors: ['#FF5A5F', '#FFB020', '#FDE047', '#4ADE80', '#38BDF8', '#A78BFA', '#FF5A5F'], glow: '#F472B6', plate: ['#120A1F', '#24123A'] },
    fill: 'rainbow',
    motion: { periodMs: 3000, glow: 7, pulse: 0.2 },
    particles: { kind: 'none', colors: [] },
  },
  {
    styleId: 'name_void_shadow',
    name: 'Shadow',
    desc: 'Karanlık aura, mor-siyah gölge dalgası ve gizemli parıltı.',
    rarity: 'legendary',
    price: 70,
    order: 120,
    collection: 'pack',
    icon: '🌑',
    palette: { base: '#A78BFA', colors: ['#0B0618', '#4C1D95', '#A78BFA', '#2E1065'], glow: '#7C3AED', plate: ['#030108', '#140A26'] },
    fill: 'shadow',
    motion: { periodMs: 4800, glow: 14, pulse: 0.5 },
    particles: { kind: 'stardust', colors: ['#A78BFA', '#4C1D95'] },
  },

  // --- Klasik isim efektleri (mevcut satın alımlar korunur) ---
  {
    styleId: 'name_emerald_vine',
    name: 'Zümrüt Sarmaşık İsmi',
    desc: 'Işıldayan zümrüt yeşili yapraklarla isminizi süsler.',
    rarity: 'rare',
    price: 30,
    order: 200,
    collection: 'classic',
    badge: 'SÜRELİ',
    icon: '🌿',
    palette: { base: '#6EE7B7', colors: ['#6EE7B7', '#34D399', '#A7F3D0', '#059669'], glow: '#10B981', plate: ['#03140D', '#0B2E20'] },
    fill: 'gradient',
    motion: { periodMs: 4200, glow: 7, pulse: 0.3 },
    particles: { kind: 'none', colors: [] },
  },
  {
    styleId: 'name_toxic_slime',
    name: 'Toksik Slime İsmi',
    desc: 'Asit yeşili ve moru karışan radyoaktif slime parıltısı.',
    rarity: 'epic',
    price: 55,
    order: 210,
    collection: 'classic',
    badge: 'SÜRELİ',
    icon: '☢️',
    palette: { base: '#A3E635', colors: ['#A3E635', '#7C3AED', '#84CC16', '#7C3AED'], glow: '#84CC16', plate: ['#0B1404', '#1F0B3D'] },
    fill: 'gradient',
    motion: { periodMs: 2600, glow: 9, pulse: 0.4 },
    particles: { kind: 'none', colors: [] },
  },
  {
    styleId: 'name_candy_heart',
    name: 'Şeker Pembe İsmi',
    desc: 'Pembe şeker kalp gradyanıyla tatlı bir parıltı.',
    rarity: 'epic',
    price: 55,
    order: 220,
    collection: 'classic',
    badge: 'SÜRELİ',
    icon: '🍬',
    palette: { base: '#F9A8D4', colors: ['#F9A8D4', '#EC4899', '#FBCFE8', '#EC4899'], glow: '#EC4899', plate: ['#1F0614', '#3B0B27'] },
    fill: 'gradient',
    motion: { periodMs: 3000, glow: 7, pulse: 0.3 },
    particles: { kind: 'none', colors: [] },
  },
  {
    styleId: 'name_plasma_bolt',
    name: 'Plazma Yıldırımı İsmi',
    desc: 'Elektrik mavisi plazma yıldırımlarıyla isminizi çarpar.',
    rarity: 'mythic',
    price: 90,
    order: 230,
    collection: 'classic',
    badge: 'SÜRELİ',
    icon: '⚡',
    palette: { base: '#67E8F9', colors: ['#67E8F9', '#D946EF', '#22D3EE', '#D946EF'], glow: '#D946EF', plate: ['#060A1F', '#22093A'] },
    fill: 'neon',
    motion: { periodMs: 2000, glow: 10, pulse: 0.5 },
    particles: { kind: 'electric', colors: ['#67E8F9', '#D946EF'] },
  },
];

const NICK_STYLE_MAP: Record<string, NickStyleDef> = Object.fromEntries(
  NICK_STYLES.map((s) => [s.styleId, s]),
);

/** styleId → tanım (bilinmeyen / boş id için null) */
export function getNickStyle(styleId: string | null | undefined): NickStyleDef | null {
  if (!styleId) return null;
  return NICK_STYLE_MAP[styleId] ?? NICK_STYLE_MAP[styleId.toLowerCase()] ?? null;
}

/** Animated Nick paketleri (vitrin sırasıyla) */
export const NICK_PACKS: NickStyleDef[] = NICK_STYLES.filter((s) => s.collection === 'pack').sort((a, b) => a.order - b.order);

/** Kullanıcının nick efekti kalite tercihi (users.settings.nickEffects) */
export type NickEffectsPreference = 'auto' | 'full' | 'lite' | 'off';

export const NICK_EFFECT_PREFERENCE_LABELS: Record<NickEffectsPreference, string> = {
  auto: 'Otomatik',
  full: 'Tam',
  lite: 'Hafif',
  off: 'Kapalı',
};

/**
 * Bir kullanıcının nick stili için görüntüleme durumu.
 * locked: sahip değil · owned: envanterde (kuşanılabilir) · active: şu an kuşanılı
 */
export type NickOwnership = 'locked' | 'owned' | 'active';

export function nickOwnership(
  styleId: string,
  user: {
    equippedNameEffect?: string;
    equippedNameEffectExpiresAt?: number;
    inventory?: { id: string; qty: number }[];
  } | null | undefined,
  now = Date.now(),
): NickOwnership {
  if (!user) return 'locked';
  if (
    user.equippedNameEffect === styleId &&
    (!user.equippedNameEffectExpiresAt || user.equippedNameEffectExpiresAt > now)
  ) {
    return 'active';
  }
  if (user.inventory?.some((i) => i.id === styleId && i.qty > 0)) return 'owned';
  return 'locked';
}
