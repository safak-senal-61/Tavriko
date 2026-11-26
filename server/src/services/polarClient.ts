import { isIP } from 'node:net';
import type { Request } from 'express';
import { makeWebCorsPolicy } from '../middleware/webCors';

// Web uygulaması Cloudflare'da (ör. tavriko.games), API Vercel'de çalışabilir.
// Oyuncu API'si için izinli her web origin'i checkout başlatabilir.
const playerWebOrigins = makeWebCorsPolicy();

/**
 * Yerel (Expo/capacitor) istekleri `Origin` başlığı göndermez; tarayıcılar
 * cross-origin POST isteklerinde her zaman gönderir. Bu yüzden başlık yoksa
 * isteğin uygulamadan geldiğini kabul ediyoruz. CSRF koruması, tarayıcı
 * isteklerinde origin eşleşmesiyle korunmaya devam eder.
 */
export function clientOriginAllowed(origin: string | undefined, expected: string, path = '/api/social'): boolean {
  return !origin || origin === expected || playerWebOrigins(origin, path);
}

/**
 * Polar, müşterinin ülkesine göre doğru para birimini (TRY) gösterebilmek için
 * `customer_ip_address` bekler. Vercel arkasında gerçek istemci IP'si ilk
 * `x-forwarded-for` değeridir; başka bir proxy zinciri varsa yalnızca geçerli
 * bir IP döndürürüz, aksi halde alanı göndermeyiz.
 */
export function clientIpAddress(req: Request): string | undefined {
  const header = req.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (header && isIP(header)) return header;
  const direct = req.ip || req.socket.remoteAddress;
  if (!direct) return undefined;
  const normalized = direct.startsWith('::ffff:') ? direct.slice('::ffff:'.length) : direct;
  return isIP(normalized) ? normalized : undefined;
}
