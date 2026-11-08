import { Env } from './env';
import { GameRoomDO } from './durable-objects/GameRoom';
import { MatchmakerDO } from './durable-objects/Matchmaker';
import { sanitizeRoomCode } from './websocket/validation';
import { verifyJwt } from './auth/authenticate';

export { GameRoomDO, MatchmakerDO };
const avatarUploadWindows = new Map<string, number[]>();
const AVATAR_UPLOAD_LIMIT = 10;
const AVATAR_UPLOAD_WINDOW_MS = 60_000;
const MAX_AVATAR_REQUEST_BYTES = 5 * 1024 * 1024;

async function readJsonLimited(request: Request, maxBytes: number): Promise<any | null> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(merged));
  } catch {
    return null;
  }
}

function allowAvatarUpload(userId: string): boolean {
  const now = Date.now();
  const recent = (avatarUploadWindows.get(userId) || []).filter((time) => now - time < AVATAR_UPLOAD_WINDOW_MS);
  if (recent.length >= AVATAR_UPLOAD_LIMIT) return false;
  recent.push(now);
  avatarUploadWindows.set(userId, recent);
  if (avatarUploadWindows.size > 5000) {
    for (const [id, times] of avatarUploadWindows) {
      if (!times.some((time) => now - time < AVATAR_UPLOAD_WINDOW_MS)) avatarUploadWindows.delete(id);
    }
  }
  return true;
}


function generateSecureRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return 'TAV-' + Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('');
}

const ALLOWED_ORIGINS = new Set([
  'https://gmae-taupe.vercel.app',
  'https://tavriko-app.vercel.app',
  'https://tavriko-game.vercel.app',
  'https://tavriko-tavriko.vercel.app',
  'https://tavriko-git-main-tavriko.vercel.app',
]);

function isAllowedOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    if (parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)) return true;
    if (parsed.protocol !== 'https:') return false;
    // Do not trust every tavriko-*.vercel.app deployment: preview aliases
    // may be created by untrusted contributors or become dangling subdomains.
    return ALLOWED_ORIGINS.has(origin);
  } catch {
    return false;
  }
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin');
  const headers: Record<string, string> = {
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-internal-secret, x-telegram-bot-api-secret-token',
    'Access-Control-Max-Age': '86400',
  };
  if (origin && isAllowedOrigin(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      const origin = request.headers.get('Origin');
      if (origin && !isAllowedOrigin(origin)) return new Response('Origin not allowed', { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(request) });
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
            ...corsHeaders(request),
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
          const authHeader = request.headers.get('Authorization') || '';
          const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
          const auth = await verifyJwt(bearer, env.JWT_SECRET);
          if (!auth.isValid || !auth.user || auth.user.isGuest) {
            return new Response(JSON.stringify({ error: 'Oturum doğrulaması gerekli.' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders(request) } });
          }
          const contentLength = Number(request.headers.get('Content-Length') || 0);
          if (contentLength > MAX_AVATAR_REQUEST_BYTES) {
            return new Response(JSON.stringify({ error: 'Görsel isteği çok büyük.' }), { status: 413, headers: { 'Content-Type': 'application/json', ...corsHeaders(request) } });
          }
          if (!allowAvatarUpload(auth.user.id)) {
            return new Response(JSON.stringify({ error: 'Çok sık görsel yükleniyor. Lütfen daha sonra tekrar deneyin.' }), { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders(request) } });
          }
          const bodyJson: any = await readJsonLimited(request, MAX_AVATAR_REQUEST_BYTES);
          if (!bodyJson) {
            return new Response(JSON.stringify({ error: 'Geçersiz veya çok büyük görsel isteği.' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(request) } });
          }
          let rawData = bodyJson?.image || bodyJson?.avatar;
          if (bodyJson?.userId && bodyJson.userId !== auth.user.id) {
            return new Response(JSON.stringify({ error: 'Kullanıcı kimliği uyuşmuyor.' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders(request) } });
          }
          if (!rawData || typeof rawData !== 'string' || rawData.length > 4 * 1024 * 1024) {
            return new Response(JSON.stringify({ error: 'Geçersiz veya çok büyük görsel verisi.' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(request) } });
          }

          if (rawData.startsWith('data:')) {
            const match = rawData.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
            if (!match) return new Response(JSON.stringify({ error: 'Yalnızca JPEG, PNG veya WebP görselleri kabul edilir.' }), { status: 415, headers: { 'Content-Type': 'application/json', ...corsHeaders(request) } });
            rawData = match[2];
          }
          if (!/^[A-Za-z0-9+/]+={0,2}$/.test(rawData)) {
            return new Response(JSON.stringify({ error: 'Geçersiz base64 görsel verisi.' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders(request) } });
          }

          const binary = Uint8Array.from(atob(rawData), (c) => c.charCodeAt(0));
          const isJpeg = binary[0] === 0xff && binary[1] === 0xd8 && binary[2] === 0xff;
          const isPng = binary.length >= 8 && binary[0] === 0x89 && binary[1] === 0x50 && binary[2] === 0x4e && binary[3] === 0x47;
          const isWebp = binary.length >= 12 && String.fromCharCode(...binary.slice(0, 4)) === 'RIFF' && String.fromCharCode(...binary.slice(8, 12)) === 'WEBP';
          if (!isJpeg && !isPng && !isWebp) {
            return new Response(JSON.stringify({ error: 'Dosya içeriği geçerli bir görsel değil.' }), { status: 415, headers: { 'Content-Type': 'application/json', ...corsHeaders(request) } });
          }
          const contentType = isJpeg ? 'image/jpeg' : isPng ? 'image/png' : 'image/webp';
          const extension = isJpeg ? 'jpg' : isPng ? 'png' : 'webp';
          const userId = auth.user.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
          const fileKey = `avatar_${userId}_${Date.now()}.${extension}`;

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
                ...corsHeaders(request),
              },
            }
          );
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message || 'R2 yükleme hatası' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
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
          for (const [key, value] of Object.entries(corsHeaders(request))) headers.set(key, value);
          return new Response(object.body, { headers });
        }
      }
      return new Response('Avatar bulunamadı', { status: 404, headers: corsHeaders(request) });
    }

    // ============================================================================
    // Telegram Webhook Edge Gateway (Cloudflare 24/7 Edge Dispatcher)
    // ============================================================================
    if (
      url.pathname === '/telegram/webhook' ||
      url.pathname === '/api/telegram/webhook'
    ) {
      if (request.method === 'POST') {
        const expectedSecret = env.TELEGRAM_WEBHOOK_SECRET || '';
        const suppliedSecret = request.headers.get('x-telegram-bot-api-secret-token') || '';
        if (expectedSecret.length < 32) {
          return new Response(JSON.stringify({ ok: false, error: 'Webhook secret yapılandırılmamış.' }), { status: 503, headers: { 'Content-Type': 'application/json', ...corsHeaders(request) } });
        }
        if (suppliedSecret.length !== expectedSecret.length) {
          return new Response(JSON.stringify({ ok: false, error: 'Yetkisiz webhook isteği.' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders(request) } });
        }
        let secretMismatch = 0;
        for (let i = 0; i < expectedSecret.length; i++) {
          secretMismatch |= expectedSecret.charCodeAt(i) ^ suppliedSecret.charCodeAt(i);
        }
        if (secretMismatch !== 0) {
          return new Response(JSON.stringify({ ok: false, error: 'Yetkisiz webhook isteği.' }), { status: 401 });
        }

        const backendBase = env.BACKEND_API_URL || 'https://tavriko-app.vercel.app';
        const targetUrl = `${backendBase.replace(/\/+$/, '')}/api/telegram/webhook`;

        try {
          const bodyText = await request.text();
          let parsedUpdate: any = null;
          try {
            parsedUpdate = JSON.parse(bodyText);
          } catch {}

          // Background asynchronous dispatch to Vercel so Telegram gets an instant 200 OK
          ctx.waitUntil(
            fetch(targetUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-forwarded-for': request.headers.get('cf-connecting-ip') || '127.0.0.1',
                'x-cf-source': 'cloudflare-worker-edge',
                'x-telegram-bot-api-secret-token': suppliedSecret,
              },
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
              headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
            }
          );
        } catch (err: any) {
          return new Response(JSON.stringify({ ok: false, error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
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
          headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
        }
      );
    }

    // Webhook setup is managed by the authenticated backend admin route.
    // Do not accept Telegram bot tokens in public query strings.

    const isWs = request.headers.get('Upgrade')?.toLowerCase() === 'websocket';
    const requestOrigin = request.headers.get('Origin');
    if (isWs && requestOrigin && !isAllowedOrigin(requestOrigin)) return new Response('Origin not allowed', { status: 403 });

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
        roomCode = generateSecureRoomCode();
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
      headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
    });
  },
};
