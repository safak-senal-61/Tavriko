/**
 * Skia nick çiziminde RN satırını glif genişliklerine oturtma (saf mantık,
 * Skia'dan bağımsız → birim test edilebilir).
 */

/** Kerning farkı için kabul edilen en fazla genişlik fazlası (satır genişliğine oran). */
export const NICK_KERNING_TOLERANCE = 0.08;

const ELLIPSIS = '…';

/**
 * Android kesilmiş satırda '…' sonrasına U+FEFF dolgu karakterleri koyar; Skia
 * bunları boş kutu (tofu) olarak çizer. Görünmez/kontrol karakterleri ve
 * sondaki boşluklar atılır.
 */
export function cleanLineText(text: string): string {
  return text.replace(/[\uFEFF\u200B-\u200F\u2060\u00AD\r\n]/g, '').replace(/\s+$/, '');
}

export interface LineFit {
  /** Çizilecek glif sayısı (baştan) */
  count: number;
  /** Sona '…' eklenmeli mi */
  ellipsis: boolean;
  /** Glifler arası ek aralık (negatif = sıkıştırma) */
  squeeze: number;
}

/**
 * @param widths   Satır metninin Skia glif genişlikleri (kerning yok)
 * @param lineWidth RN'nin ölçtüğü satır genişliği (kerning dahil)
 * @param ellW      '…' glif genişliği
 * @param rnEllipsized RN satırı zaten '…' ile bitiyorsa (iOS) true; o glif widths'e dahil edilmemeli
 */
export function fitLine(
  widths: number[],
  letterSpacing: number,
  lineWidth: number,
  ellW: number,
  rnEllipsized = false,
): LineFit {
  const n = widths.length;
  const sum = (k: number) => {
    let s = 0;
    for (let i = 0; i < k; i++) s += widths[i] + letterSpacing;
    return s;
  };
  if (!rnEllipsized) {
    const natural = sum(n) - letterSpacing;
    const over = natural - lineWidth;
    if (over <= 1.5 || n < 2) return { count: n, ellipsis: false, squeeze: 0 };
    // Android/iOS/tarayıcı kerning uygular, Skia glif genişlikleri uygulamaz:
    // küçük fazlalık gerçek bir kesme değildir → harf aralığı sıkıştırılır.
    if (over <= lineWidth * NICK_KERNING_TOLERANCE) return { count: n, ellipsis: false, squeeze: -over / (n - 1) };
  }
  // RN '…' ile kesmiş: aynı genişliğe kadar glif bırak + '…'
  let k = n;
  while (k > 1 && sum(k) + ellW > lineWidth + 1) k--;
  const used = sum(k) + ellW;
  const over = used - lineWidth;
  const squeeze = over > 0 && k > 0 ? -Math.min(over, lineWidth * NICK_KERNING_TOLERANCE) / k : 0;
  return { count: Math.max(1, k), ellipsis: true, squeeze };
}

export function splitRnEllipsis(text: string): { text: string; ellipsized: boolean } {
  const t = cleanLineText(text);
  if (t.endsWith(ELLIPSIS)) return { text: t.slice(0, -1), ellipsized: true };
  return { text: t, ellipsized: false };
}
