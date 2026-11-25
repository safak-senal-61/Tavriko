export type NickRarity = 'rare' | 'epic' | 'legendary' | 'mythic';
export declare const NICK_RARITY_ORDER: NickRarity[];
export declare const NICK_RARITY_LABELS: Record<NickRarity, string>;
export declare const NICK_RARITY_COLORS: Record<NickRarity, {
    main: string;
    soft: string;
}>;
/**
 * Metin dolgu efekti. İstemci tam kalitede bunları Skia shader'ı olarak,
 * hafif kalitede renk döngüsü + parıltı olarak çizer.
 */
export type NickFill = 'neon' | 'metal' | 'holo' | 'flame' | 'frost' | 'nebula' | 'prism' | 'glitch' | 'rainbow' | 'shadow' | 'gradient';
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
    particles: {
        kind: NickParticles;
        colors: string[];
    };
}
export declare const NICK_STYLES: NickStyleDef[];
/** styleId → tanım (bilinmeyen / boş id için null) */
export declare function getNickStyle(styleId: string | null | undefined): NickStyleDef | null;
/** Animated Nick paketleri (vitrin sırasıyla) */
export declare const NICK_PACKS: NickStyleDef[];
/** Kullanıcının nick efekti kalite tercihi (users.settings.nickEffects) */
export type NickEffectsPreference = 'auto' | 'full' | 'lite' | 'off';
export declare const NICK_EFFECT_PREFERENCE_LABELS: Record<NickEffectsPreference, string>;
/**
 * Bir kullanıcının nick stili için görüntüleme durumu.
 * locked: sahip değil · owned: envanterde (kuşanılabilir) · active: şu an kuşanılı
 */
export type NickOwnership = 'locked' | 'owned' | 'active';
export declare function nickOwnership(styleId: string, user: {
    equippedNameEffect?: string;
    equippedNameEffectExpiresAt?: number;
    inventory?: {
        id: string;
        qty: number;
    }[];
} | null | undefined, now?: number): NickOwnership;
