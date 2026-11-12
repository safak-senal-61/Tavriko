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
 * Sunucudaki /categories uç noktasından canlı soru sayılarını okur.
 * Keşfet ekranı ve özel oda kategori seçici aynı kaynağı kullanır; böylece
 * sayılar her yerde birebir aynı olur.
 */
export async function fetchCategoryCounts(base: string): Promise<CategoryCounts> {
  const res = await fetch(`${base}/categories`);
  const data: CategoryInfo[] = await res.json();
  if (!Array.isArray(data)) throw new Error('Kategori sayıları alınamadı');
  const counts: CategoryCounts = { main: {}, sub: {} };
  for (const c of data) {
    if (!c || !c.id) continue;
    counts.main[c.id] = c.totalQuestions ?? 0;
    for (const sc of c.subCategories || []) {
      if (sc && sc.name) counts.sub[subCountKey(c.id, sc.name)] = sc.questionCount ?? 0;
    }
  }
  return counts;
}
