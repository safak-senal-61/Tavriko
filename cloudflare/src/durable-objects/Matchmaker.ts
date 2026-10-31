import { DurableObject } from 'cloudflare:workers';
import {
  GameMode,
  CategoryId,
  DifficultyLevel,
  SOCKET_EVENTS,
} from '@trivia/shared';
import { Env } from '../env';
import { encodeWsMessage, decodeWsMessage, createWsError, WsMessage } from '../websocket/protocol';
import { sanitizeString, RateLimiter } from '../websocket/validation';
import { verifyJwt, AuthUser } from '../auth/authenticate';

interface QueueEntry {
  playerId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  mode: GameMode;
  category: CategoryId;
  difficulty: DifficultyLevel;
  queuedAt: number;
}

export class MatchmakerDO extends DurableObject<Env> {
  private queue: Map<string, QueueEntry> = new Map();
  private rateLimiters = new WeakMap<WebSocket, RateLimiter>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    // Restore persisted queue entries from storage
    this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<Record<string, QueueEntry>>('match_queue');
      if (stored) {
        for (const [id, entry] of Object.entries(stored)) {
          // Drop stale entries older than 2 minutes
          if (Date.now() - entry.queuedAt < 120000) {
            this.queue.set(id, entry);
          }
        }
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/queue-status' || request.method === 'GET' && !request.headers.get('Upgrade')) {
      return new Response(
        JSON.stringify({
          queuedCount: this.queue.size,
          activeSockets: this.ctx.getWebSockets().length,
          entries: Array.from(this.queue.values()).map((e) => ({
            playerId: e.playerId,
            mode: e.mode,
            category: e.category,
            difficulty: e.difficulty,
            waitTimeMs: Date.now() - e.queuedAt,
          })),
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket Upgrade for Matchmaker', { status: 426 });
    }

    const authHeader = request.headers.get('Authorization');
    const bearerToken = authHeader?.replace(/^Bearer\s+/i, '');
    const queryToken = url.searchParams.get('token');
    const token = bearerToken || queryToken;

    const rawPlayerId = url.searchParams.get('playerId');
    const rawDisplayName = url.searchParams.get('displayName');
    const rawAvatarUrl = url.searchParams.get('avatarUrl');
    const mode = (url.searchParams.get('mode') as GameMode) || 'duel';
    const category = (url.searchParams.get('category') as CategoryId) || 'general_culture';
    const difficulty = (url.searchParams.get('difficulty') as DifficultyLevel) || 'medium';

    let authUser: AuthUser | undefined;
    if (token) {
      const auth = await verifyJwt(token, this.env.JWT_SECRET);
      if (auth.isValid && auth.user) {
        authUser = auth.user;
      }
    }

    if (!authUser) {
      const pid = rawPlayerId || `guest_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const name = sanitizeString(rawDisplayName || `Oyuncu ${pid.slice(-4)}`, 30);
      authUser = {
        id: pid,
        username: name.toLowerCase().replace(/\s+/g, '_'),
        displayName: name,
        avatarUrl: rawAvatarUrl || 'av1',
        isGuest: true,
      };
    }

    // Accept WebSocket into hibernation
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    const tags = [`player:${authUser.id}`, 'matchmaker'];
    this.ctx.acceptWebSocket(server, tags);

    const attachment: QueueEntry = {
      playerId: authUser.id,
      username: authUser.username,
      displayName: authUser.displayName || authUser.username,
      avatarUrl: authUser.avatarUrl,
      mode,
      category,
      difficulty,
      queuedAt: Date.now(),
    };
    server.serializeAttachment(attachment);

    // Auto-enqueue the player upon connection
    await this.enqueuePlayer(attachment);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    let limiter = this.rateLimiters.get(ws);
    if (!limiter) {
      limiter = new RateLimiter(15, 1000);
      this.rateLimiters.set(ws, limiter);
    }
    if (!limiter.check()) {
      ws.send(createWsError('Çok fazla istek gönderildi', 'RATE_LIMITED'));
      return;
    }

    const envelope = decodeWsMessage(message);
    if (!envelope) return;

    const attachment = ws.deserializeAttachment() as QueueEntry | null;
    if (!attachment || !attachment.playerId) return;

    switch (envelope.event) {
      case SOCKET_EVENTS.FIND_MATCH: {
        const payload = envelope.payload || {};
        const updatedEntry: QueueEntry = {
          ...attachment,
          mode: payload.mode || attachment.mode || 'duel',
          category: payload.category || attachment.category || 'general_culture',
          difficulty: payload.difficulty || attachment.difficulty || 'medium',
          queuedAt: Date.now(),
        };
        ws.serializeAttachment(updatedEntry);
        await this.enqueuePlayer(updatedEntry);
        break;
      }

      case SOCKET_EVENTS.CANCEL_MATCH:
        await this.dequeuePlayer(attachment.playerId);
        ws.send(encodeWsMessage(SOCKET_EVENTS.CANCEL_MATCH, { success: true }));
        break;

      case 'ping':
        ws.send(JSON.stringify({ event: 'pong', timestamp: Date.now() }));
        break;
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    const attachment = ws.deserializeAttachment() as QueueEntry | null;
    if (attachment && attachment.playerId) {
      await this.dequeuePlayer(attachment.playerId);
    }
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.warn('[MatchmakerDO] WebSocket error:', error);
  }

  // Periodic alarm to check for match timeouts and pair with smart bots
  async alarm(): Promise<void> {
    const now = Date.now();
    const botTimeoutMs = 5000; // After 5 seconds, match with a bot

    for (const [playerId, entry] of Array.from(this.queue.entries())) {
      // Find another waiting human player
      const match = this.findMatchingCandidate(entry);
      if (match) {
        await this.createMatch(entry, match);
        continue;
      }

      // Check if entry waited long enough for bot rival
      if (now - entry.queuedAt >= botTimeoutMs) {
        await this.createBotMatch(entry);
      }
    }

    // If queue is not empty, schedule next alarm
    if (this.queue.size > 0) {
      await this.ctx.storage.setAlarm(Date.now() + 2000);
    }
  }

  private async enqueuePlayer(entry: QueueEntry): Promise<void> {
    // Check if an immediate human match is available
    const opponent = this.findMatchingCandidate(entry);
    if (opponent) {
      await this.createMatch(entry, opponent);
      return;
    }

    this.queue.set(entry.playerId, entry);
    await this.persistQueue();

    // Schedule alarm to verify matches or trigger bot fallback
    await this.ctx.storage.setAlarm(Date.now() + 2500);
  }

  private async dequeuePlayer(playerId: string): Promise<void> {
    if (this.queue.has(playerId)) {
      this.queue.delete(playerId);
      await this.persistQueue();
    }
  }

  private findMatchingCandidate(current: QueueEntry): QueueEntry | null {
    for (const [id, candidate] of this.queue.entries()) {
      if (id === current.playerId) continue;

      // Mode matching
      if (candidate.mode !== current.mode) continue;

      // Category match (or mixed allowed)
      const catMatch =
        candidate.category === current.category ||
        candidate.category === 'mixed' ||
        current.category === 'mixed';
      if (!catMatch) continue;

      return candidate;
    }
    return null;
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'TAV-';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  private async createMatch(playerA: QueueEntry, playerB: QueueEntry): Promise<void> {
    this.queue.delete(playerA.playerId);
    this.queue.delete(playerB.playerId);
    await this.persistQueue();

    const roomCode = this.generateRoomCode();
    const socketsA = this.ctx.getWebSockets(`player:${playerA.playerId}`);
    const socketsB = this.ctx.getWebSockets(`player:${playerB.playerId}`);

    const matchFoundPayloadA = {
      roomCode,
      mode: playerA.mode,
      category: playerA.category,
      difficulty: playerA.difficulty,
      opponent: {
        id: playerB.playerId,
        username: playerB.username,
        displayName: playerB.displayName,
        avatarUrl: playerB.avatarUrl,
      },
    };

    const matchFoundPayloadB = {
      roomCode,
      mode: playerB.mode,
      category: playerB.category,
      difficulty: playerB.difficulty,
      opponent: {
        id: playerA.playerId,
        username: playerA.username,
        displayName: playerA.displayName,
        avatarUrl: playerA.avatarUrl,
      },
    };

    for (const ws of socketsA) {
      try {
        ws.send(encodeWsMessage(SOCKET_EVENTS.MATCH_FOUND, matchFoundPayloadA));
      } catch {}
    }

    for (const ws of socketsB) {
      try {
        ws.send(encodeWsMessage(SOCKET_EVENTS.MATCH_FOUND, matchFoundPayloadB));
      } catch {}
    }
  }

  private async createBotMatch(player: QueueEntry): Promise<void> {
    this.queue.delete(player.playerId);
    await this.persistQueue();

    const roomCode = this.generateRoomCode();
    const botNames = ['AtlasBot', 'ZekaKüpü', 'BilgeRobot', 'GalaksiŞampiyonu', 'KuantumZihin'];
    const chosenName = botNames[Math.floor(Math.random() * botNames.length)];
    const botId = `bot_${Math.random().toString(36).substring(2, 7)}`;

    const matchFoundPayload = {
      roomCode,
      mode: player.mode,
      category: player.category,
      difficulty: player.difficulty,
      opponent: {
        id: botId,
        username: chosenName.toLowerCase(),
        displayName: chosenName,
        avatarUrl: 'av3',
        isBot: true,
      },
    };

    const sockets = this.ctx.getWebSockets(`player:${player.playerId}`);
    for (const ws of sockets) {
      try {
        ws.send(encodeWsMessage(SOCKET_EVENTS.MATCH_FOUND, matchFoundPayload));
      } catch {}
    }
  }

  private async persistQueue(): Promise<void> {
    const plain: Record<string, QueueEntry> = {};
    for (const [id, entry] of this.queue.entries()) {
      plain[id] = entry;
    }
    await this.ctx.storage.put('match_queue', plain);
  }
}
