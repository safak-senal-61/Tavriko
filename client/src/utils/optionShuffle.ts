/**
 * Oyuncuya özel şık sırası
 * -----------------------
 * Çok oyunculu odalarda her oyuncunun ekranında şıklar farklı sırada görünür;
 * "doğru cevap" konumu oyuncudan oyuncuya değişir. Cevaplar sunucuya şık ID'si
 * ile gönderildiği ve istemci de geri bildirimi ID üzerinden gösterdiği için
 * sıranın değiştirilmesi değerlendirmeyi etkilemez.
 *
 * Karıştırma deterministiktir: tohum (oyuncu ID + soru) aynı olduğu sürece
 * aynı oyuncu aynı soruyu hep aynı sırada görür; böylece bağlantı kopup
 * yeniden bağlanınca şıklar yer değiştirmez. Farklı oyuncular farklı tohumlar
 * aldığı için sıraları birbirinden bağımsız olur.
 */

/** Mulberry32 — küçük ve hızlı deterministik PRNG. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a ile dize -> 32 bit tohum. */
function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Şıkları oyuncuya özel sırada döndürür.
 * @param options   Karıştırılacak şıklar (orijinal dizi değişmez).
 * @param playerKey Oyuncuyu ayırt eden anahtar (kullanıcı ID'si).
 * @param questionKey Soruyu ayırt eden anahtar (soru ID + tur gibi).
 */
export function shuffleOptionsForPlayer<T extends { id: string }>(
  options: T[],
  playerKey: string,
  questionKey: string
): T[] {
  if (!Array.isArray(options) || options.length < 2) {
    return Array.isArray(options) ? options.slice() : [];
  }
  const rng = mulberry32(hashString(`${playerKey}::${questionKey}`));
  const shuffled = options.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = tmp;
  }
  // Karıştırma tesadüfen orijinal sırayla aynıysa ilk iki şıkkın yerini
  // değiştir; böylece sıra "değişmemiş" durumda kalmaz.
  if (shuffled.length > 1 && shuffled.every((opt, i) => opt.id === options[i].id)) {
    const first = shuffled[0];
    shuffled[0] = shuffled[1];
    shuffled[1] = first;
  }
  return shuffled;
}
