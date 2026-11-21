import type { CategoryInfo } from '@trivia/shared';

export interface CategoryCounts {
  /** Ana kategori id -> yayındaki soru sayısı */
  main: Record<string, number>;
  /** "<kategoriId>::<alt kategori adı küçük harf>" -> yayındaki soru sayısı */
  sub: Record<string, number>;
}

export const subCountKey = (categoryId: string, subName: string): string =>
  `${categoryId}::${subName.trim().toLowerCase()}`;

/**
 * Sunucudaki /categories yanıtından canlı soru sayılarını çıkarır.
 * Keşfet ekranı ve özel oda kategori seçici aynı kaynağı kullanır; böylece
 * sayılar her yerde birebir aynı olur.
 */
export function categoryCounts(data: CategoryInfo[]): CategoryCounts {
  const counts: CategoryCounts = { main: {}, sub: {} };
  for (const c of data) {
    if (!c || !c.id) continue;
    if (typeof c.totalQuestions === 'number') counts.main[c.id] = c.totalQuestions;
    for (const sc of c.subCategories || []) {
      if (sc?.name && typeof sc.questionCount === 'number') counts.sub[subCountKey(c.id, sc.name)] = sc.questionCount;
    }
  }
  return counts;
}
