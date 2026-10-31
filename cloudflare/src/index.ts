import { Env } from './env';
import { GameRoomDO } from './durable-objects/GameRoom';
import { MatchmakerDO } from './durable-objects/Matchmaker';
import { sanitizeRoomCode } from './websocket/validation';

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
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    const isWs = request.headers.get('Upgrade')?.toLowerCase() === 'websocket';

    // Route: Matchmaking WebSocket (/ws/matchmaking or /ws?intent=matchmaking)
    if (
      url.pathname.startsWith('/ws/matchmaking') ||
      url.searchParams.get('intent') === 'matchmaking'
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
