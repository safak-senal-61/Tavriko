const baseOrigins = new Set([
  'https://tavriko-app.vercel.app',
  'http://localhost:8080',
  'http://localhost:8081',
  'http://localhost:19006',
  'http://localhost:3000',
]);

// Only routes used by players on the separate web frontend. In particular this
// does not grant the new origins access to admin, fleet, cron or internal APIs.
const playerApi = /^\/api\/(?:auth|categories|questions|trivia|rooms|social|referrals|push|support|legal|health|player\/duel-funnel)(?:\/|$)/;

export function makeWebCorsPolicy(configured = process.env.TAVRIKO_WEB_ORIGINS ?? '') {
  const webOrigins = new Set<string>();
  for (const entry of configured.split(',')) {
    const origin = entry.trim();
    try {
      const url = new URL(origin);
      if (url.protocol === 'https:' && !url.hostname.includes('*') &&
          (origin === url.origin || origin === `${url.origin}/`)) {
        webOrigins.add(url.origin);
      }
    } catch {
      // Ignore empty or invalid entries. Do not accept wildcard or suffix matches.
    }
  }
  return (origin: string | undefined, path: string): boolean =>
    !origin || baseOrigins.has(origin) || (webOrigins.has(origin) && playerApi.test(path));
}
