import { CDN_MANIFEST } from '../generated/cdnManifest';

/**
 * Tüm görseller, ses efektleri ve müzik Cloudflare CDN'inden (tavriko-cdn Worker) çekilir.
 * Kaynak dosyalar client/assets altındadır; `npm run deploy:cdn` ile yayınlanır.
 * Farklı bir adres için EXPO_PUBLIC_CDN_URL tanımlanabilir.
 *
 * İşletim sisteminin ağdan önce kullandığı uygulama ikonu ve native splash
 * Expo yapılandırmasında yerel kalır; ekran görselleri pakete girmez.
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

export type CdnImage = CdnImageSource;

/**
 * React Native `Image source` değeri.
 * Mobil ve web için CDN adresi; bilinen boyutlar yerleşim kaymasını önler.
 */
export function cdnImage(path: string): CdnImage {
  const clean = path.replace(/^\/+/, '');
  const entry = CDN_MANIFEST[clean];
  const source: CdnImageSource = { uri: cdnUrl(clean) };
  if (entry && entry[0] > 0 && entry[1] > 0) {
    source.width = entry[0];
    source.height = entry[1];
  }
  return source;
}
