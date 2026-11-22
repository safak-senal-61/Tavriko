import { DEFAULT_POSTHOG_INGEST_HOST, DEFAULT_POSTHOG_PROJECT_TOKEN } from '@trivia/shared';
import type { Probe } from './opsTelemetry';

export function posthogHealthProbe(env: NodeJS.ProcessEnv = process.env): Probe {
  const name = 'PostHog';
  const token = env.EXPO_PUBLIC_POSTHOG_KEY || DEFAULT_POSTHOG_PROJECT_TOKEN;
  const host = (env.EXPO_PUBLIC_POSTHOG_HOST || DEFAULT_POSTHOG_INGEST_HOST).replace(/\/$/, '');
  if (!/^phc_[A-Za-z0-9_-]+$/.test(token)) {
    return { name, detail: 'Geçerli bir PostHog proje anahtarı yok.', unset: 'unconfigured' };
  }
  const region = host === DEFAULT_POSTHOG_INGEST_HOST ? 'us' : host === 'https://eu.i.posthog.com' ? 'eu' : null;
  if (!region) {
    return { name, detail: 'Özel PostHog adresi bu panelden doğrulanmaz.', unset: 'unknown', optional: true };
  }
  return {
    name,
    detail: 'Proje yapılandırması okunur. Oyuncu verisi gönderilmez; olay alımı ölçülmez.',
    check: async () => {
      const response = await fetch(`https://${region}-assets.i.posthog.com/array/${token}/config`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(2800),
      });
      if (!response.ok || !response.headers.get('content-type')?.startsWith('application/json')) return false;
      const config = await response.json() as { analytics?: { endpoint?: unknown } } | null;
      return typeof config?.analytics?.endpoint === 'string' && config.analytics.endpoint.startsWith('/');
    },
  };
}
