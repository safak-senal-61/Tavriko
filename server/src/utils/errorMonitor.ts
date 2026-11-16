/**
 * GlitchTip / Sentry uyumlu hata izleme (OPTIONAL).
 * @sentry/node paketi kurulu degilse veya SENTRY_DSN yoksa sessizce no-op calisir.
 */

let Sentry: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Sentry = require('@sentry/node');
} catch {
  Sentry = null;
}

let initialized = false;

export function initErrorMonitor() {
  const dsn = process.env.SENTRY_DSN || process.env.GLITCHTIP_DSN;
  if (!dsn || initialized || !Sentry) {
    return initialized;
  }
  try {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      serverName: 'tavriko-server',
      tracesSampleRate: 0.2,
    });
    initialized = true;
    console.log('[errorMonitor] GlitchTip/Sentry icin hata izleme aktif');
  } catch (err) {
    console.warn('[errorMonitor] hata izleme baslatilamadi:', err);
  }
  return initialized;
}

export function captureError(err: unknown) {
  if (initialized && Sentry) {
    try {
      Sentry.captureException(err);
    } catch {
      // ignore
    }
  }
}

/**
 * Sentry breadcrumb: hata izlerinin yanında bağlantı / maç geçmişini gösterir.
 * Sentry kapalıyken veya erişilemezken sessizce no-op çalışır.
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>
) {
  if (!initialized || !Sentry) return;
  try {
    Sentry.addBreadcrumb({
      category,
      message,
      level: 'info',
      data,
      timestamp: Date.now() / 1000,
    });
  } catch {
    // ignore
  }
}

export default { initErrorMonitor, captureError, addBreadcrumb };
