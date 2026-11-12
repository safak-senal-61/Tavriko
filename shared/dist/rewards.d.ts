import type { DifficultyLevel } from './types';
/**
 * Maç ödülleri için TEK DOĞRULUK KAYNAĞI.
 * Sunucu ödülü bu fonksiyonla hesaplayıp hesaba yazar; istemci de sonuç ekranında
 * aynı fonksiyonu (veya sunucunun döndürdüğü değeri) gösterir. Böylece ekranda yazan
 * XP ile çubuğa yansıyan XP her zaman aynıdır.
 *
 * Ekonomi bilinçli olarak mütevazıdır: seviye 1 için 500 XP gerekir.
 */
export type MatchRewardMode = 'solo' | 'multiplayer';
export interface MatchRewardInput {
    correct: number;
    total: number;
    won: boolean;
    /** solo: Keşfet / tek kişilik pratik. multiplayer: 1v1, özel oda, arkadaşla düello vb. */
    mode?: MatchRewardMode;
    /** Yalnızca solo modda XP çarpanı olarak uygulanır */
    difficulty?: DifficultyLevel;
}
export interface MatchRewards {
    xp: number;
    coins: number;
    seasonXp: number;
}
/** Zorluk çarpanları (Zorluk seçim ekranındaki etiketlerle birebir aynı) */
export declare const DIFFICULTY_XP_MULTIPLIER: Record<DifficultyLevel, number>;
export declare const DIFFICULTY_XP_LABEL: Record<DifficultyLevel, string>;
export declare const MAX_MATCH_XP_MULTIPLAYER = 35;
export declare const MAX_MATCH_XP_SOLO = 50;
export declare function calculateMatchRewards(input: MatchRewardInput): MatchRewards;
export declare const LEAGUE_START_POINTS = 1000;
export declare const LP_WIN_BASE = 20;
export declare const LP_PER_CORRECT_ON_WIN = 2;
export declare const LP_LOSS = 5;
export declare const LP_WRONG_ANSWER_PENALTY = 10;
export declare const LP_MIN_WIN_GAIN = 5;
export interface LeagueChangeInput {
    correct: number;
    total: number;
    won: boolean;
    /** Dereceli maç mı? false ise LP değişmez. */
    ranked?: boolean;
    /** Ayarlar > "Yanlış Cevap Puan Kesintisi" açık mı? */
    penaltyForWrong?: boolean;
}
/**
 * Bir maç sonunda LP değişimini (negatif olabilir) döndürür.
 * - Galibiyet: +20 LP, her doğru cevap için +2 LP
 * - Mağlubiyet: -5 LP
 * - Ceza açıksa her yanlış / boş cevap için -10 LP
 * - Galibiyetin net kazancı hiçbir zaman +5 LP'nin altına düşmez
 */
export declare function calculateLeagueChange(input: LeagueChangeInput): number;
/** LP'yi uygular; 0'ın altına inmez. Gerçekte uygulanan değişimi de döndürür. */
export declare function applyLeagueChange(current: number, delta: number): {
    points: number;
    applied: number;
};
/** Bir maçın dereceli sayılıp sayılmayacağı (sunucu ve istemci aynı kuralı kullanır). */
export declare function isRankedMatch(input: {
    mode?: string;
    roomCode?: string;
    playerIds: string[];
}): boolean;
