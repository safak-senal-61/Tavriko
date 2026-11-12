import { CDN_MANIFEST } from '../generated/cdnManifest';

/**
 * Tüm görseller, ses efektleri ve müzik Cloudflare CDN'inden (tavriko-cdn Worker) çekilir.
 * Kaynak dosyalar client/assets altındadır; `npm run deploy:cdn` ile yayınlanır.
 * Farklı bir adres için EXPO_PUBLIC_CDN_URL tanımlanabilir.
 */
export const CDN_BASE: string = (
  process.env.EXPO_PUBLIC_CDN_URL || 'https://tavriko-cdn.uncertainidentity8.workers.dev'
).replace(/\/+$/, '');

/** `images/profile/a.png` gibi assets-göreli yol için tam CDN adresi (içerik özetiyle önbellek yenileme). */
export function cdnUrl(path: string): string {
  const clean = path.replace(/^\/+/, '');
  const entry = CDN_MANIFEST[clean];
  return `${CDN_BASE}/${clean}${entry ? `?v=${entry[2]}` : ''}`;
}

export interface CdnImageSource {
  uri: string;
  width?: number;
  height?: number;
}

/** React Native `Image source` değeri; bilinen boyutları ekleyerek yerleşimin kaymasını önler. */
export function cdnImage(path: string): CdnImageSource {
  const clean = path.replace(/^\/+/, '');
  const entry = CDN_MANIFEST[clean];
  const source: CdnImageSource = { uri: cdnUrl(clean) };
  if (entry && entry[0] > 0 && entry[1] > 0) {
    source.width = entry[0];
    source.height = entry[1];
  }
  return source;
}
