import { Platform } from 'react-native';

/**
 * Tavriko avatar yardımcıları
 * ---------------------------
 * Profile photo (data URI base64) values can grow to hundreds of KB.
 * They must NEVER end up inside a WebSocket/Generic GET URL query:
 * Cloudflare Workers rejects "HTTP 4xx / 1006 1015-like" oversized upgrade
 * requests, which is exactly the WebSocket connection failure users saw when
 * they set a profile photo.
 *
 * - compressAvatarImageAsync: shrinks picked images to a small JPEG data URI
 *   using a <canvas> on web (the main Tavriko platform).
 * - sanitizeAvatarForUrl: makes sure only tiny, URL-safe values are placed
 *   into query params. Big data URIs are replaced with the short 'custom' seed
 *   (avatars still reach the server via JSON envelopes & the REST profile API).
 */

export const MAX_URL_AVATAR_LENGTH = 256;

/** Cap the picked file size at 256px and re-encode as compact JPEG (web only). */
export const compressAvatarImageAsync = async (
  source: string,
  maxSize = 256,
  quality = 0.62
): Promise<string> => {
  if (!source) return source;
  // Canvas compression only exists in the web runtime
  if (Platform.OS !== 'web' || typeof document === 'undefined' || typeof window === 'undefined') {
    return source;
  }
  if (!source.startsWith('data:') && !source.startsWith('blob:') && !source.startsWith('file:')) {
    // http(s) avatars (dicebear etc.) are already hosted tiny
    return source;
  }

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const width = img.naturalWidth || img.width || maxSize;
        const height = img.naturalHeight || img.height || maxSize;
        const scale = Math.min(1, maxSize / Math.max(width, height));
        const w = Math.max(1, Math.round(width * scale));
        const h = Math.max(1, Math.round(height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(source);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        // Only accept the compressed result if it is actually smaller
        resolve(compressed.length < source.length ? compressed : source);
      } catch {
        resolve(source);
      }
    };
    img.onerror = () => resolve(source);
    img.src = source;
  });
};

/**
 * Returns a short, URL-safe avatar seed for WebSocket query strings.
 * Real/big values are replaced by 'custom' so the connection never fails.
 */
export const sanitizeAvatarForUrl = (avatarUrl?: string | null): string => {
  if (!avatarUrl) return 'av1';
  const value = String(avatarUrl);
  if (/^(data|blob|file):/i.test(value)) return 'custom';
  if (value.length > MAX_URL_AVATAR_LENGTH) return 'custom';
  return value;
};
