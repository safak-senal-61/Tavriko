/**
 * Ürün analitiği — PostHog (OPTIONAL).
 * posthog-react-native SDK'ı Expo Go ile uyumlu çalışır.
 * EXPO_PUBLIC_POSTHOG_KEY tanımsızsa veya init başarısız olursa
 * tüm fonksiyonlar sessizce no-op çalışır; uygulama akışı etkilenmez.
 *
 * Event şeması ARAC_PLANI.md §2'de tanımlıdır:
 * match_started, match_completed, question_answered, matchmaking_time,
 * store_purchase, referral_signup, daily_streak_claimed, settings_changed, session_start
 */
import { Platform } from 'react-native';
import PostHog from 'posthog-react-native';

// PostHog istemci anahtarı gizli değildir (Sentry DSN gibi her bundle'da
// görünür), yalnızca olay GÖNDERME izni verir. Ortam değişkeni
// EXPO_PUBLIC_POSTHOG_KEY tanımlıysa o önceliklidir.
const DEFAULT_POSTHOG_KEY = 'phc_qvhJD5HHkCcyteqSLoKaidHPiJ5jgKRpWmvZhp5o7dPE';
const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY || DEFAULT_POSTHOG_KEY;
// Proje US PostHog bulutunda; istenirse EXPO_PUBLIC_POSTHOG_HOST ile değiştirilebilir
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

let client: PostHog | null = null;
let initPromise: Promise<void> | null = null;

/** Eşleşme kuyruğuna girme anı — matchmaking_time hesabı için */
let matchmakingStartedAt: number | null = null;

export function initAnalytics(): Promise<void> {
  if (!POSTHOG_KEY || initPromise) return initPromise ?? Promise.resolve();
  initPromise = (async () => {
    try {
      const ph = new PostHog(POSTHOG_KEY, {
        host: POSTHOG_HOST,
        // Uygulama içi oyun; sayfa görüntüleme otomatik izleme kapalı
        captureAppLifecycleEvents: false,
      });
      await ph.ready();
      client = ph;
    } catch (err) {
      console.warn('[analytics] PostHog başlatılamadı, analitik kapalı:', err);
      client = null;
    }
  })();
  return initPromise;
}

/** Kullanıcı oturum açtığında / kimliği netleştiğinde çağrılır */
export function identifyPlayer(playerId: string, props?: Record<string, any>): void {
  if (!client) return;
  try {
    void client.identify(playerId, props);
  } catch {
    // ignore
  }
}

export function trackEvent(event: string, props?: Record<string, any>): void {
  if (!client) return;
  try {
    client.capture(event, props);
  } catch {
    // ignore
  }
}

export function trackSessionStart(): void {
  trackEvent('session_start', {
    platform: Platform.OS,
    version: process.env.EXPO_PUBLIC_APP_VERSION || 'dev',
  });
}

/** Eşleşme kuyruğuna girme anını kaydet */
export function markMatchmakingStart(): void {
  matchmakingStartedAt = Date.now();
  trackEvent('matchmaking_started');
}

/** Eşleşme bulundu — matchmaking_time (saniye) ile birlikte */
export function trackMatchFound(matchedWith: 'bot' | 'human'): number | undefined {
  let queueSeconds: number | undefined;
  if (matchmakingStartedAt) {
    queueSeconds = Number(((Date.now() - matchmakingStartedAt) / 1000).toFixed(1));
    matchmakingStartedAt = null;
  }
  trackEvent('matchmaking_time', { seconds: queueSeconds, matchedWith });
  return queueSeconds;
}

/**
 * PostHog feature flag oku. Flag yüklenmemişse/yoksa varsayılan döner.
 * Örn: bot'a düşme süresi — 'matchmaking-bot-fallback-sec' (sn)
 */
export function getFeatureFlag(key: string, fallback: number | string | boolean): number | string | boolean {
  if (!client) return fallback;
  try {
    const value = client.getFeatureFlag(key);
    return value === undefined || value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

/** Bot'a düşme süresi (ms) — PostHog flag'i ile canlıda A/B test edilebilir */
export function getBotFallbackMs(): number {
  const seconds = Number(getFeatureFlag('matchmaking-bot-fallback-sec', 7));
  if (!Number.isFinite(seconds) || seconds < 3 || seconds > 30) return 7000;
  return Math.round(seconds * 1000);
}

export default {
  initAnalytics,
  identifyPlayer,
  trackEvent,
  trackSessionStart,
  markMatchmakingStart,
  trackMatchFound,
  getFeatureFlag,
  getBotFallbackMs,
};
