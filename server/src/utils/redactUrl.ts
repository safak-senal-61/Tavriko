/** Kayıtlara yazılmadan önce değeri gizlenecek alan adları. */
export const SENSITIVE_KEYS = /pass|token|secret|authorization|otp|code|cookie/i;

/**
 * SECURITY: istek adresindeki gizli sorgu değerlerini (ör. Google Play RTDN
 * `?token=`) kayıt satırına yazmadan önce `[REDACTED]` ile değiştirir.
 */
export function redactUrlForLog(url: string): string {
  const q = url.indexOf('?');
  if (q < 0) return url;
  const parts = url.slice(q + 1).split('&').map((pair) => {
    const eq = pair.indexOf('=');
    if (eq < 0) return pair;
    const rawKey = pair.slice(0, eq);
    let key = rawKey;
    try { key = decodeURIComponent(rawKey.replace(/\+/g, ' ')); } catch { /* keep raw */ }
    return SENSITIVE_KEYS.test(key) ? `${rawKey}=[REDACTED]` : pair;
  });
  return `${url.slice(0, q)}?${parts.join('&')}`;
}
