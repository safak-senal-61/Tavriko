"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.posthogHealthProbe = posthogHealthProbe;
const shared_1 = require("@trivia/shared");
function posthogHealthProbe(env = process.env) {
    const name = 'PostHog';
    const token = env.EXPO_PUBLIC_POSTHOG_KEY || shared_1.DEFAULT_POSTHOG_PROJECT_TOKEN;
    const host = (env.EXPO_PUBLIC_POSTHOG_HOST || shared_1.DEFAULT_POSTHOG_INGEST_HOST).replace(/\/$/, '');
    if (!/^phc_[A-Za-z0-9_-]+$/.test(token)) {
        return { name, detail: 'Geçerli bir PostHog proje anahtarı yok.', unset: 'unconfigured' };
    }
    const region = host === shared_1.DEFAULT_POSTHOG_INGEST_HOST ? 'us' : host === 'https://eu.i.posthog.com' ? 'eu' : null;
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
            if (!response.ok || !response.headers.get('content-type')?.startsWith('application/json'))
                return false;
            const config = await response.json();
            return typeof config?.analytics?.endpoint === 'string' && config.analytics.endpoint.startsWith('/');
        },
    };
}
