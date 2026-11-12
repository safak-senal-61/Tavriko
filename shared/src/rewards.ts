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
export const DIFFICULTY_XP_MULTIPLIER: Record<DifficultyLevel, number> = {
  easy: 1,
  medium: 1.25,
  hard: 1.5,
  expert: 2,
};

export const DIFFICULTY_XP_LABEL: Record<DifficultyLevel, string> = {
  easy: 'x1 XP',
  medium: 'x1,25 XP',
  hard: 'x1,5 XP',
  expert: 'x2 XP',
};

export const MAX_MATCH_XP_MULTIPLAYER = 35;
export const MAX_MATCH_XP_SOLO = 50;

export function calculateMatchRewards(input: MatchRewardInput): MatchRewards {
  const total = Math.max(1, Math.round(Number(input.total) || 1));
  const correct = Math.max(0, Math.min(total, Math.round(Number(input.correct) || 0)));
  const won = !!input.won;

  // Hiç doğru cevap yoksa (veya erken çıkışta) hiçbir ödül verilmez
  if (correct === 0) return { xp: 0, coins: 0, seasonXp: 0 };

  if (input.mode === 'solo') {
    const mult = DIFFICULTY_XP_MULTIPLIER[input.difficulty || 'easy'] ?? 1;
    const baseXp = Math.min(25, correct * 4 + (won ? 8 : 0));
    return {
      xp: Math.min(MAX_MATCH_XP_SOLO, Math.round(baseXp * mult)),
      coins: Math.min(8, correct + (won ? 3 : 0)),
      seasonXp: won ? 15 : 5,
    };
  }

  return {
    xp: won ? Math.min(35, correct * 5 + 10) : Math.min(15, correct * 3),
    coins: won ? Math.min(15, correct * 2 + 5) : Math.min(6, correct),
    seasonXp: won ? 25 : 10,
  };
}
