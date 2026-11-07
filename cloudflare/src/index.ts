import { Env } from './env';
import { GameRoomDO } from './durable-objects/GameRoom';
import { MatchmakerDO } from './durable-objects/Matchmaker';
import { sanitizeRoomCode } from './websocket/validation';
import { verifyJwt } from './auth/authenticate';

export { GameRoomDO, MatchmakerDO };

export default {
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
          const authHeader = request.headers.get('Authorization') || '';
          const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
          const auth = await verifyJwt(bearer, env.JWT_SECRET);
          if (!auth.isValid || !auth.user || auth.user.isGuest) {
            return new Response(JSON.stringify({ error: 'Oturum doğrulaması gerekli.' }), { status: 401 });
          }
          const bodyJson: any = await request.json().catch(() => ({}));
          let rawData = bodyJson?.image || bodyJson?.avatar;
          if (bodyJson?.userId && bodyJson.userId !== auth.user.id) {
            return new Response(JSON.stringify({ error: 'Kullanıcı kimliği uyuşmuyor.' }), { status: 403 });
          }
          if (!rawData || typeof rawData !== 'string' || rawData.length > 4 * 1024 * 1024) {
            return new Response(JSON.stringify({ error: 'Geçersiz veya çok büyük görsel verisi.' }), { status: 400 });
          }

          if (rawData.startsWith('data:')) {
            const match = rawData.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
            if (!match) return new Response(JSON.stringify({ error: 'Yalnızca JPEG, PNG veya WebP görselleri kabul edilir.' }), { status: 415 });
            rawData = match[2];
          }
          if (!/^[A-Za-z0-9+/]+={0,2}$/.test(rawData)) {
            return new Response(JSON.stringify({ error: 'Geçersiz base64 görsel verisi.' }), { status: 400 });
          }

          const binary = Uint8Array.from(atob(rawData), (c) => c.charCodeAt(0));
          const isJpeg = binary[0] === 0xff && binary[1] === 0xd8 && binary[2] === 0xff;
          const isPng = binary.length >= 8 && binary[0] === 0x89 && binary[1] === 0x50 && binary[2] === 0x4e && binary[3] === 0x47;
          const isWebp = binary.length >= 12 && String.fromCharCode(...binary.slice(0, 4)) === 'RIFF' && String.fromCharCode(...binary.slice(8, 12)) === 'WEBP';
          if (!isJpeg && !isPng && !isWebp) {
            return new Response(JSON.stringify({ error: 'Dosya içeriği geçerli bir görsel değil.' }), { status: 415 });
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
          ctx.waitUntil(
            fetch(targetUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-forwarded-for': request.headers.get('cf-connecting-ip') || '127.0.0.1',
                'x-cf-source': 'cloudflare-worker-edge',
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

    // Direct helper to set webhook to this Cloudflare Worker
    if (url.pathname === '/telegram/set-webhook') {
      const token = url.searchParams.get('token') || '';
      if (!token || token.length < 15) {
        return new Response(
          JSON.stringify({ success: false, error: 'Lütfen geçerli bir token belirtin (?token=...)' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const cfWebhookUrl = `https://${url.host}/telegram/webhook`;
      const tgRes = await fetch(
        `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(cfWebhookUrl)}&drop_pending_updates=true`
      );
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
