import { Env } from './env';
import { GameRoomDO } from './durable-objects/GameRoom';
import { MatchmakerDO } from './durable-objects/Matchmaker';
import { sanitizeRoomCode } from './websocket/validation';
import { verifyJwt } from './auth/authenticate';
import * as Sentry from '@sentry/cloudflare';

export { GameRoomDO, MatchmakerDO };

const worker: ExportedHandler<Env> = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-internal-secret',
        },
      });
    }

    // Health check & status endpoint
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          service: 'Tavriko Real-time Multiplayer Gateway',
          runtime: 'Cloudflare Workers & Durable Objects',
          timestamp: new Date().toISOString(),
          environment: env.ENVIRONMENT || 'production',
          r2Storage: env.AVATAR_BUCKET ? 'connected' : 'unbound',
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // ============================================================================
    // Cloudflare R2 Avatar Storage & CDN Endpoints
    // ============================================================================
    if (url.pathname === '/api/upload/avatar' || url.pathname === '/upload/avatar') {
      if (request.method === 'POST') {
        try {
          // SECURITY: uploads require an authenticated player (JWT). The previous
          // implementation accepted unauthenticated writes with client-controlled
          // userId and content type.
          const authHeader = request.headers.get('Authorization') || '';
          const bearerToken = authHeader.replace(/^Bearer\s+/i, '');
          if (!bearerToken || !bearerToken.startsWith('ey')) {
            return new Response(JSON.stringify({ error: 'Yetkilendirme başlığı eksik' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
          }
          const auth = await verifyJwt(bearerToken, env.JWT_SECRET);
          if (!auth.isValid || !auth.user) {
            return new Response(JSON.stringify({ error: 'Geçersiz oturum tokeni' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
          }
          // The uploader identity comes from the verified token, never the body.
          const userId = auth.user.id || 'u';

          const bodyJson: any = await request.json().catch(() => ({}));
          let rawData = bodyJson?.image || bodyJson?.avatar;

          if (!rawData || typeof rawData !== 'string') {
            return new Response(JSON.stringify({ error: 'Geçersiz resim verisi' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
          }

          // Content type whitelist: only real images may be stored/served.
          const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
          let contentType = 'image/jpeg';
          if (rawData.startsWith('data:')) {
            const match = rawData.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              if (!ALLOWED_TYPES.has(match[1].toLowerCase())) {
                return new Response(JSON.stringify({ error: 'Desteklenmeyen dosya türü' }), {
                  status: 415,
                  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                });
              }
              contentType = match[1];
              rawData = match[2];
            }
          }

          // Size cap: 2 MB decoded.
          if (rawData.length > 2_800_000) {
            return new Response(JSON.stringify({ error: 'Dosya çok büyük (maks 2MB)' }), {
              status: 413,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            });
          }

          const binary = Uint8Array.from(atob(rawData), (c) => c.charCodeAt(0));
          const fileKey = `avatar_${userId.replace(/[^a-zA-Z0-9_-]/g, '')}_${Date.now()}.jpg`;

          if (env.AVATAR_BUCKET) {
            await env.AVATAR_BUCKET.put(fileKey, binary, {
              httpMetadata: { contentType },
            });
          }

          const origin = url.origin;
          const publicUrl = `${origin}/api/avatar/${fileKey}`;

          return new Response(
            JSON.stringify({
              success: true,
              url: publicUrl,
              key: fileKey,
              storage: env.AVATAR_BUCKET ? 'cloudflare-r2' : 'edge-processed',
            }),
            {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              },
            }
          );
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message || 'R2 yükleme hatası' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        }
      }
    }

    if (url.pathname.startsWith('/api/avatar/')) {
      const fileKey = url.pathname.replace('/api/avatar/', '');
      if (env.AVATAR_BUCKET && fileKey) {
        const object = await env.AVATAR_BUCKET.get(fileKey);
        if (object) {
          const headers = new Headers();
          object.writeHttpMetadata(headers);
          headers.set('etag', object.httpEtag);
          headers.set('Cache-Control', 'public, max-age=31536000, immutable');
          headers.set('Access-Control-Allow-Origin', '*');
          return new Response(object.body, { headers });
        }
      }
      return new Response('Avatar bulunamadı', { status: 404 });
    }

    // ============================================================================
    // Telegram Webhook Edge Gateway (Cloudflare 24/7 Edge Dispatcher)
    // ============================================================================
    if (
      url.pathname === '/telegram/webhook' ||
      url.pathname === '/api/telegram/webhook'
    ) {
      if (request.method === 'POST') {
        const backendBase = env.BACKEND_API_URL || 'https://tavriko-app.vercel.app';
        const targetUrl = `${backendBase.replace(/\/+$/, '')}/api/telegram/webhook`;

        try {
          const bodyText = await request.text();
          let parsedUpdate: any = null;
          try {
            parsedUpdate = JSON.parse(bodyText);
          } catch {}

          // Background asynchronous dispatch to Vercel so Telegram gets an instant 200 OK
          // SECURITY: forward Telegram's secret token (or the configured gateway secret)
          // so the backend can authenticate the forwarded update.
          const forwardHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
            'x-forwarded-for': request.headers.get('cf-connecting-ip') || '127.0.0.1',
            'x-cf-source': 'cloudflare-worker-edge',
          };
          const telegramSecret =
            request.headers.get('x-telegram-bot-api-secret-token') || env.TELEGRAM_WEBHOOK_SECRET;
          if (telegramSecret) {
            forwardHeaders['x-telegram-bot-api-secret-token'] = telegramSecret;
          }
          ctx.waitUntil(
            fetch(targetUrl, {
              method: 'POST',
              headers: forwardHeaders,
              body: bodyText,
            })
              .then(async (res) => {
                const text = await res.text();
                console.log(`[CF -> Vercel Telegram Forward] Status: ${res.status}, response: ${text.slice(0, 100)}`);
              })
              .catch((err) => {
                console.error('[CF -> Vercel Telegram Error]', err.message);
              })
          );

          return new Response(
            JSON.stringify({
              ok: true,
              edge: 'cloudflare-workers',
              update_id: parsedUpdate?.update_id || null,
              forwarded_to: targetUrl,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            }
          );
        } catch (err: any) {
          return new Response(JSON.stringify({ ok: false, error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        }
      }

      // GET info
      return new Response(
        JSON.stringify({
          status: 'ready',
          service: 'Cloudflare Telegram Webhook Edge Gateway',
          webhook_url: `https://${url.host}/telegram/webhook`,
          target_backend: `${env.BACKEND_API_URL || 'https://tavriko-app.vercel.app'}/api/telegram/webhook`,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        }
      );
    }

    // Direct helper to set webhook to this Cloudflare Worker.
    // SECURITY: previously this was an unauthenticated proxy that accepted any bot
    // token in the query string. It now requires the internal service secret header
    // and no longer leaks the token into query-string logs.
    if (url.pathname === '/telegram/set-webhook') {
      const internalSecret = env.INTERNAL_API_SECRET;
      const providedSecret = request.headers.get('x-internal-secret') || '';
      if (!internalSecret || providedSecret !== internalSecret) {
        return new Response(JSON.stringify({ error: 'Yetkisiz erişim' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const bodyJson: any = await request.json().catch(() => ({}));
      const token = String(bodyJson?.token || '');
      if (!token || token.length < 15) {
        return new Response(
          JSON.stringify({ success: false, error: 'Geçerli bir token belirtin (body: {"token": "..."})' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const cfWebhookUrl = `https://${url.host}/telegram/webhook`;
      const tgParams = new URLSearchParams({
        url: cfWebhookUrl,
        drop_pending_updates: 'true',
      });
      if (env.TELEGRAM_WEBHOOK_SECRET) {
        tgParams.set('secret_token', env.TELEGRAM_WEBHOOK_SECRET);
      }
      const tgRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook?${tgParams.toString()}`);
      const data = await tgRes.json();
      return new Response(JSON.stringify({ cloudflare_gateway: cfWebhookUrl, telegram_response: data }), {
        status: tgRes.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const isWs = request.headers.get('Upgrade')?.toLowerCase() === 'websocket';

    // Route: Presence, Social Notification Hub, Public Rooms & Matchmaking
    if (
      url.pathname.startsWith('/ws/matchmaking') ||
      url.pathname.startsWith('/ws/presence') ||
      url.pathname === '/api/presence' ||
      url.pathname === '/presence' ||
      url.pathname === '/api/notify' ||
      url.pathname === '/notify' ||
      url.pathname === '/rooms/public' ||
      url.pathname === '/api/rooms/public' ||
      url.pathname === '/api/trivia/rooms/public' ||
      url.searchParams.get('intent') === 'matchmaking' ||
      url.searchParams.get('intent') === 'presence' ||
      (url.pathname === '/ws' && !url.searchParams.has('roomCode'))
    ) {
      const matchmakerId = env.MATCHMAKER.idFromName('global_matchmaker');
      const matchmakerStub = env.MATCHMAKER.get(matchmakerId);
      return matchmakerStub.fetch(request);
    }

    // Route: Game Room WebSocket (/ws/room/:code or /ws?roomCode=...)
    if (
      url.pathname.startsWith('/ws/room') ||
      url.searchParams.has('roomCode') ||
      url.pathname === '/ws'
    ) {
      let roomCode = url.searchParams.get('roomCode') || '';
      if (!roomCode) {
        const segments = url.pathname.split('/').filter(Boolean);
        if (segments.length >= 2 && segments[0] === 'ws' && segments[1] === 'room' && segments[2]) {
          roomCode = segments[2];
        } else if (segments.length >= 2 && segments[0] === 'room') {
          roomCode = segments[1];
        }
      }

      roomCode = sanitizeRoomCode(roomCode);
      if (!roomCode) {
        // Generate a new code if creating a fresh room
        roomCode = 'TAV-' + Math.random().toString(36).substring(2, 7).toUpperCase();
      }

      const roomId = env.GAME_ROOMS.idFromName(roomCode);
      const roomStub = env.GAME_ROOMS.get(roomId);

      // Pass sanitized roomCode in url searchParams to DO
      url.searchParams.set('roomCode', roomCode);
      const modifiedRequest = new Request(url.toString(), request);

      return roomStub.fetch(modifiedRequest);
    }

    return new Response(JSON.stringify({ error: 'Endpoint bulunamadı' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  },
};

// Sentry hata izleme: wrangler.jsonc içindeki SENTRY_DSN tanımsızsa sessizce kapalı kalır.
export default Sentry.withSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN,
    environment: env.ENVIRONMENT ?? 'production',
    tracesSampleRate: 0.2,
  }),
  worker,
);
