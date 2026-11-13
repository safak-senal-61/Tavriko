import type { ItemRarity } from './types';
export declare const COSMETIC_RENTAL_HOURS = 1;
export declare const COSMETIC_RENTAL_MS: number;
export type CosmeticKind = 'frame' | 'background' | 'name_effect' | 'badge';
/**
 * Herkese açık profil JSON'undan geçerli kozmetikleri çıkarır.
 * expiresAt kontrolü yapar — süresi dolmuşsa null döner.
 */
export declare function extractProfileCosmetics(profile: {
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
};
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
        nameGlow?: 'gold' | 'fire' | 'ice' | 'rainbow' | 'emerald' | 'toxic' | 'candy' | 'shadow' | 'plasma' | 'none';
        /** Animasyon etiketi (CSS'e taşınmaz, sadece bilgi) */
        anim?: 'flame' | 'pulse' | 'shimmer' | 'none';
        icon?: string;
        /**
         * Pro/VIP temaları: yalnızca arka plan değil, uygulama arayüzünün bazı
         * yerlerini (üst parlama, alt ışık küreleri, vurgu rengi) süresi boyunca
         * değiştirir. Süre bitince arayüz otomatik eski haline döner.
         */
        ui?: {
            /** Ana vurgu rengi (parlama halkaları, çerçeve parıltıları) */
            accent: string;
            /** İkincil vurgu rengi */
            accent2: string;
            /** Arka plan üst katman tonu */
            bgTint: string;
        };
    };
}
export declare const FRAME_DEFS: CosmeticDef[];
export declare const BACKGROUND_DEFS: CosmeticDef[];
export declare const NAME_EFFECT_DEFS: CosmeticDef[];
export declare const BADGE_DEFS: CosmeticDef[];
export declare const COSMETIC_DEFS: CosmeticDef[];
export declare function getCosmeticDef(id: string | undefined | null): CosmeticDef | null;
export declare function getFrameDef(id: string | undefined | null): CosmeticDef | null;
export declare function getBackgroundDef(id: string | undefined | null): CosmeticDef | null;
export declare function getNameEffectDef(id: string | undefined | null): CosmeticDef | null;
export declare function getBadgeDef(id: string | undefined | null): CosmeticDef | null;
/**
 * Süreli kozmetik süresi dolmuş mu kontrol eder.
 * (expiresAt undefined ise süresiz kabul edilir — sadece sistem kaynaklı kozmetikler)
 */
export declare function isCosmeticExpired(expiresAt: number | null | undefined): boolean;
