export const TITLE_LEVELS: Record<string, number> = {
  'Acemi Kaşif': 1, 'Yükselen Yıldız': 3, 'Usta Kaşif': 6,
  'Bilgi Şövalyesi': 10, 'Stratejist': 15, 'Usta Bilgin': 20,
  'Büyük Üstat': 30, 'Efsanevi Deha': 40, 'Evrenin Hakimi': 50,
};

/** Only a known, unlocked title can appear on identity cards. No emoji prefix. */
export function resolveProfileTitle(selected: unknown, level: number, fallback = 'Acemi Kaşif'): string {
  const unlocked = (value: unknown): value is string =>
    typeof value === 'string' && Object.prototype.hasOwnProperty.call(TITLE_LEVELS, value)
    && level >= TITLE_LEVELS[value];
  return unlocked(selected) ? selected : unlocked(fallback) ? fallback : 'Acemi Kaşif';
}
