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

// ---------------------------------------------------------------------------
// Lig Puanı (LP) — TEK DOĞRULUK KAYNAĞI
// ---------------------------------------------------------------------------
// LP yalnızca "dereceli" maçlarda değişir: gerçek bir rakiple oynanan hızlı
// eşleşme / 1v1 düello. Tek kişilik pratik, Keşfet, günlük görev, özel oda ve
// arkadaş düellosu LP'yi DEĞİŞTİRMEZ. Herkes 1000 LP ile başlar, LP 0'ın altına inmez.
export const LEAGUE_START_POINTS = 1000;
export const LP_WIN_BASE = 20;
export const LP_PER_CORRECT_ON_WIN = 2;
export const LP_LOSS = 5;
export const LP_WRONG_ANSWER_PENALTY = 10;
export const LP_MIN_WIN_GAIN = 5;

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
export function calculateLeagueChange(input: LeagueChangeInput): number {
  if (!input.ranked) return 0;
  const total = Math.max(1, Math.round(Number(input.total) || 1));
  const correct = Math.max(0, Math.min(total, Math.round(Number(input.correct) || 0)));
  const wrong = total - correct;
  const won = !!input.won;

  let delta = won ? LP_WIN_BASE + correct * LP_PER_CORRECT_ON_WIN : -LP_LOSS;
  if (input.penaltyForWrong !== false) delta -= wrong * LP_WRONG_ANSWER_PENALTY;
  if (won) delta = Math.max(LP_MIN_WIN_GAIN, delta);
  return delta;
}

/** LP'yi uygular; 0'ın altına inmez. Gerçekte uygulanan değişimi de döndürür. */
export function applyLeagueChange(current: number, delta: number): { points: number; applied: number } {
  const start = Number.isFinite(current) ? Math.max(0, Math.round(current)) : LEAGUE_START_POINTS;
  const points = Math.max(0, start + delta);
  return { points, applied: points - start };
}

/** Bir maçın dereceli sayılıp sayılmayacağı (sunucu ve istemci aynı kuralı kullanır). */
export function isRankedMatch(input: { mode?: string; roomCode?: string; playerIds: string[] }): boolean {
  const modeOk = input.mode === 'duel' || input.mode === 'quick_match' || input.mode === 'ranked_random';
  const ids = input.playerIds || [];
  const hasBot = ids.some((id) => String(id).startsWith('bot_'));
  const friendDuel = String(input.roomCode || '').toUpperCase().startsWith('DUEL-');
  return modeOk && ids.length >= 2 && !hasBot && !friendDuel;
}
