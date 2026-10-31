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
  matchId: string;
  playerId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  mode: GameMode;
  category: CategoryId;
  difficulty: DifficultyLevel;
  queuedAt: number;
  status: 'searching' | 'matched' | 'cancelled';
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
      matchId: 'match_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      playerId: authUser.id,
      username: authUser.username,
      displayName: authUser.displayName || authUser.username,
      avatarUrl: authUser.avatarUrl,
      mode,
      category,
      difficulty,
      queuedAt: Date.now(),
      status: 'searching',
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
          matchId: 'match_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          mode: payload.mode || attachment.mode || 'duel',
          category: payload.category || attachment.category || 'general_culture',
          difficulty: payload.difficulty || attachment.difficulty || 'medium',
          queuedAt: Date.now(),
          status: 'searching',
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

  // Periodic alarm: strictly 7 seconds real human player search window, then fallback to bot
  async alarm(): Promise<void> {
    const now = Date.now();
    const MATCH_TIMEOUT_MS = 7000; // Exact 7-second search window

    for (const [playerId, entry] of Array.from(this.queue.entries())) {
      if (entry.status !== 'searching') continue;

      // 1. Try matching with another real human player in queue first
      const match = this.findMatchingCandidate(entry);
      if (match) {
        await this.createMatch(entry, match);
        continue;
      }

      // 2. If 7 seconds have elapsed and still no human player, create a bot match
      if (now - entry.queuedAt >= MATCH_TIMEOUT_MS) {
        await this.createBotMatch(entry);
      }
    }

    // Schedule next check for any remaining entries in queue
    if (this.queue.size > 0) {
      let nextWakeupMs = 1500;
      for (const entry of this.queue.values()) {
        if (entry.status === 'searching') {
          const remaining = Math.max(200, MATCH_TIMEOUT_MS - (now - entry.queuedAt));
          if (remaining < nextWakeupMs) nextWakeupMs = remaining;
        }
      }
      await this.ctx.storage.setAlarm(Date.now() + nextWakeupMs);
    }
  }

  private async enqueuePlayer(entry: QueueEntry): Promise<void> {
    entry.status = 'searching';
    entry.queuedAt = Date.now();

    // Cancel existing entry if same player was already queued
    const existing = this.queue.get(entry.playerId);
    if (existing) {
      existing.status = 'cancelled';
    }

    // Check if an immediate real human candidate is available
    const opponent = this.findMatchingCandidate(entry);
    if (opponent) {
      await this.createMatch(entry, opponent);
      return;
    }

    this.queue.set(entry.playerId, entry);
    await this.persistQueue();

    // Schedule alarm to wake up at exactly 7 seconds
    await this.ctx.storage.setAlarm(Date.now() + 7000);
  }

  private async dequeuePlayer(playerId: string): Promise<void> {
    const entry = this.queue.get(playerId);
    if (entry) {
      entry.status = 'cancelled';
      this.queue.delete(playerId);
      await this.persistQueue();
    }
  }

  private findMatchingCandidate(current: QueueEntry): QueueEntry | null {
    for (const [id, candidate] of this.queue.entries()) {
      if (id === current.playerId) continue;
      if (candidate.status !== 'searching') continue;

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

  private async setupRoomInGameRoomDO(
    roomCode: string,
    mode: GameMode,
    category: CategoryId,
    difficulty: DifficultyLevel,
    players: Array<{
      id: string;
      username: string;
      displayName: string;
      avatarUrl?: string;
      isBot?: boolean;
    }>
  ): Promise<void> {
    try {
      const roomId = this.env.GAME_ROOMS.idFromName(roomCode);
      const roomStub = this.env.GAME_ROOMS.get(roomId);
      await roomStub.fetch('http://internal/create-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode,
          mode: mode || 'duel',
          category: category || 'general_culture',
          difficulty: difficulty || 'medium',
          players,
        }),
      });
    } catch (err) {
      console.error('[MatchmakerDO] setupRoomInGameRoomDO error:', err);
    }
  }

  private async createMatch(playerA: QueueEntry, playerB: QueueEntry): Promise<void> {
    // Atomic status check - if either is not searching, abort match
    if (playerA.status !== 'searching' || playerB.status !== 'searching') return;
    playerA.status = 'matched';
    playerB.status = 'matched';

    this.queue.delete(playerA.playerId);
    this.queue.delete(playerB.playerId);
    await this.persistQueue();

    const roomCode = this.generateRoomCode();
    const matchId = playerA.matchId;

    // Pre-create room in GameRoomDO with BOTH real human players
    await this.setupRoomInGameRoomDO(
      roomCode,
      playerA.mode,
      playerA.category,
      playerA.difficulty,
      [
        {
          id: playerA.playerId,
          username: playerA.username,
          displayName: playerA.displayName,
          avatarUrl: playerA.avatarUrl,
          isBot: false,
        },
        {
          id: playerB.playerId,
          username: playerB.username,
          displayName: playerB.displayName,
          avatarUrl: playerB.avatarUrl,
          isBot: false,
        },
      ]
    );

    const socketsA = this.ctx.getWebSockets(`player:${playerA.playerId}`);
    const socketsB = this.ctx.getWebSockets(`player:${playerB.playerId}`);

    const matchFoundPayloadA = {
      matchId,
      roomCode,
      mode: playerA.mode,
      category: playerA.category,
      difficulty: playerA.difficulty,
      opponent: {
        id: playerB.playerId,
        username: playerB.username,
        displayName: playerB.displayName,
        avatarUrl: playerB.avatarUrl,
        isBot: false,
      },
    };

    const matchFoundPayloadB = {
      matchId,
      roomCode,
      mode: playerB.mode,
      category: playerB.category,
      difficulty: playerB.difficulty,
      opponent: {
        id: playerA.playerId,
        username: playerA.username,
        displayName: playerA.displayName,
        avatarUrl: playerA.avatarUrl,
        isBot: false,
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
    // Atomic status check - if not searching, abort bot creation!
    if (player.status !== 'searching') return;
    player.status = 'matched';

    this.queue.delete(player.playerId);
    await this.persistQueue();

    const roomCode = this.generateRoomCode();
    const matchId = player.matchId;

    const botProfiles = [
      { id: 'bot_atlas', name: 'AtlasBot', avatar: 'av3' },
      { id: 'bot_zeka', name: 'ZekaKüpü', avatar: 'av2' },
      { id: 'bot_bilge', name: 'BilgeRobot', avatar: 'av4' },
      { id: 'bot_firtina', name: 'Quiz Fırtınası', avatar: 'av5' },
      { id: 'bot_cevap', name: 'Hızlı Cevap', avatar: 'av6' },
    ];
    const chosenBot = botProfiles[Math.floor(Math.random() * botProfiles.length)];
    const uniqueBotId = `${chosenBot.id}_${Math.random().toString(36).substring(2, 6)}`;

    // Pre-create room in GameRoomDO with BOTH human player and bot player!
    await this.setupRoomInGameRoomDO(
      roomCode,
      player.mode,
      player.category,
      player.difficulty,
      [
        {
          id: player.playerId,
          username: player.username,
          displayName: player.displayName,
          avatarUrl: player.avatarUrl,
          isBot: false,
        },
        {
          id: uniqueBotId,
          username: chosenBot.name.toLowerCase(),
          displayName: chosenBot.name,
          avatarUrl: chosenBot.avatar,
          isBot: true,
        },
      ]
    );

    const matchFoundPayload = {
      matchId,
      roomCode,
      mode: player.mode,
      category: player.category,
      difficulty: player.difficulty,
      opponent: {
        id: uniqueBotId,
        username: chosenBot.name.toLowerCase(),
        displayName: chosenBot.name,
        avatarUrl: chosenBot.avatar,
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
