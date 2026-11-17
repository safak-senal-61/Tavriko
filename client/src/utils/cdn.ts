import { Platform } from 'react-native';
import { CDN_MANIFEST } from '../generated/cdnManifest';
// Mobilde (native) tüm görseller paket içinden yüklenir (bkz. localAssets.ts):
// CDN erişimi ağır/kesintili olsa bile görseller her zaman görünür — web'de
// başlangıç paketi küçük kalsın diye CDN kullanılır.
import { LOCAL_IMAGE_ASSETS } from '../generated/localAssets';

/**
 * Tüm görseller, ses efektleri ve müzik Cloudflare CDN'inden (tavriko-cdn Worker) çekilir.
 * Kaynak dosyalar client/assets altındadır; `npm run deploy:cdn` ile yayınlanır.
 * Farklı bir adres için EXPO_PUBLIC_CDN_URL tanımlanabilir.
 *
 * İSTİSNA — MOBİL (native): görseller CDN yerine derleme sırasında pakete
 * gömülür (require). Böylece 1v1 banner, radar, sezon/etkinlik kartları gibi
 * tüm görseller ağ durumundan bağımsız olarak anında ve garantili görünür.
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

/** Mobilde paket içi require (number) ya da web'de {uri} kaynak — ikisi de `Image source` olarak geçerli. */
export type CdnImage = number | CdnImageSource;

/**
 * React Native `Image source` değeri.
 * - Native: paket içi varlık (require numarası) — boyut bilgisi gerekmez,
 *   Metro varlığı çözer; en hızlı ve garantili yol.
 * - Web: CDN adresi; bilinen boyutlar eklenerek yerleşimin kayması önlenir.
 */
export function cdnImage(path: string): CdnImage {
  const clean = path.replace(/^\/+/, '');
  if (Platform.OS !== 'web') {
    const local = LOCAL_IMAGE_ASSETS[clean];
    if (local !== undefined) return local;
    // Pakette olmayan görsel: CDN'e düş (yeni eklenmiş ama henüz
    // generate-manifest çalıştırılmamış dosyalar için).
  }
  const entry = CDN_MANIFEST[clean];
  const source: CdnImageSource = { uri: cdnUrl(clean) };
  if (entry && entry[0] > 0 && entry[1] > 0) {
    source.width = entry[0];
    source.height = entry[1];
  }
  return source;
}
