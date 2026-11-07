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

interface PresenceEntry {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  online: boolean;
  inRoom: boolean;
  currentRoomCode?: string;
  lastSeen: number;
  onlineStatusVisible?: boolean;
}

interface PublicRoomEntry {
  code: string;
  name: string;
  host: string;
  hostName: string;
  category: string;
  categoryName: string;
  players: number;
  playerCount: number;
  maxPlayers: number;
  rounds: number;
  totalRounds: number;
  timeSec: number;
  questionTimeSec: number;
  status: 'waiting';
  updatedAt: number;
}

function constantTimeSecretMatch(expected: string | undefined, supplied: string | null): boolean {
  if (!expected || expected.length < 32 || !supplied || supplied.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  return mismatch === 0;
}

export class MatchmakerDO extends DurableObject<Env> {
  private queue: Map<string, QueueEntry> = new Map();
  private presences: Map<string, PresenceEntry> = new Map();
  private publicRooms: Map<string, PublicRoomEntry> = new Map();
  private rateLimiters = new WeakMap<WebSocket, RateLimiter>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    // Restore persisted queue entries & rebuild active socket presences
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

      const storedRooms = await this.ctx.storage.get<Record<string, PublicRoomEntry>>('public_rooms');
      if (storedRooms) {
        for (const [code, room] of Object.entries(storedRooms)) {
          if (room && room.players > 0 && room.players < room.maxPlayers && Date.now() - room.updatedAt < 600000) {
            this.publicRooms.set(code, room);
          }
        }
      }

      // Rebuild presence map from currently hibernated/open WebSockets
      for (const ws of this.ctx.getWebSockets()) {
        try {
          const att = ws.deserializeAttachment() as any;
          if (att && att.playerId) {
            this.presences.set(att.playerId, {
              userId: att.playerId,
              username: att.username || att.playerId,
              displayName: att.displayName || att.username || 'Oyuncu',
              avatarUrl: att.avatarUrl,
              online: true,
              inRoom: Boolean(att.inRoom),
              currentRoomCode: att.currentRoomCode,
              lastSeen: Date.now(),
              onlineStatusVisible: att.onlineStatusVisible !== false,
            });
          }
        } catch {}
      }
    });
  }

  private getOnlinePresenceSnapshot(): PresenceEntry[] {
    const activePlayerIds = new Set<string>();
    for (const ws of this.ctx.getWebSockets()) {
      try {
        const att = ws.deserializeAttachment() as any;
        if (att && att.playerId) {
          activePlayerIds.add(att.playerId);
          if (!this.presences.has(att.playerId)) {
            this.presences.set(att.playerId, {
              userId: att.playerId,
              username: att.username || att.playerId,
              displayName: att.displayName || att.username || 'Oyuncu',
              avatarUrl: att.avatarUrl,
              online: true,
              inRoom: Boolean(att.inRoom),
              currentRoomCode: att.currentRoomCode,
              lastSeen: Date.now(),
              onlineStatusVisible: att.onlineStatusVisible !== false,
            });
          } else {
            const p = this.presences.get(att.playerId)!;
            p.online = true;
          }
        }
      } catch {}
    }

    const result: PresenceEntry[] = [];
    for (const [uid, p] of this.presences.entries()) {
      if (p.onlineStatusVisible === false) continue;
      if (activePlayerIds.has(uid) || (p.online && Date.now() - p.lastSeen < 60000)) {
        result.push({ ...p, online: true });
      }
    }
    return result;
  }

  private broadcastToAll(event: string, payload: unknown): void {
    const msg = encodeWsMessage(event, payload);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(msg);
      } catch {}
    }
  }

  private sendToUser(targetUserId: string, event: string, payload: unknown): number {
    const msg = encodeWsMessage(event, payload);
    const sockets = this.ctx.getWebSockets(`player:${targetUserId}`);
    let sent = 0;
    for (const ws of sockets) {
      try {
        ws.send(msg);
        sent++;
      } catch {}
    }
    return sent;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // HTTP GET/POST /rooms/public or /api/rooms/public -> Live Public Rooms Directory
    if (
      url.pathname === '/rooms/public' ||
      url.pathname === '/api/rooms/public' ||
      url.pathname === '/api/trivia/rooms/public'
    ) {
      if (request.method === 'POST') {
        if (!constantTimeSecretMatch(this.env.INTERNAL_API_SECRET, request.headers.get('x-internal-secret'))) {
          return new Response(JSON.stringify({ error: 'Yetkisiz erişim' }), { status: 403 });
        }
        try {
          const body: any = await request.json();
          const code = String(body?.code || body?.roomCode || '').trim().toUpperCase();
          if (!code) {
            return new Response(
              JSON.stringify({ success: false, error: 'Missing room code' }),
              { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
            );
          }

          const players = Number(body?.players ?? body?.playerCount ?? 0);
          const maxPlayers = Math.max(2, Number(body?.maxPlayers ?? 4));
          const status = String(body?.status || 'lobby');
          const privacy = String(body?.privacy || 'public');

          if (
            body?.action === 'remove' ||
            privacy === 'private' ||
            status !== 'lobby' ||
            players <= 0 ||
            players >= maxPlayers
          ) {
            this.publicRooms.delete(code);
          } else {
            const hostName = String(body?.hostName || body?.host || 'Oyuncu');
            const categoryName = String(body?.categoryName || body?.category || 'Genel Kültür');
            const rounds = Math.max(1, Number(body?.totalRounds ?? body?.rounds ?? 5));
            const timeSec = Math.max(5, Number(body?.questionTimeSec ?? body?.timeSec ?? 15));

            this.publicRooms.set(code, {
              code,
              name: String(body?.name || `${hostName} Odası`),
              host: hostName,
              hostName,
              category: categoryName,
              categoryName,
              players,
              playerCount: players,
              maxPlayers,
              rounds,
              totalRounds: rounds,
              timeSec,
              questionTimeSec: timeSec,
              status: 'waiting',
              updatedAt: Date.now(),
            });
          }

          await this.ctx.storage.put('public_rooms', Object.fromEntries(this.publicRooms));
          return new Response(
            JSON.stringify({ success: true, count: this.publicRooms.size }),
            { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
          );
        } catch (e: any) {
          return new Response(
            JSON.stringify({ success: false, error: e.message }),
            { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
          );
        }
      }

      // GET: prune stale/full/empty rooms and return active waiting rooms
      const now = Date.now();
      let changed = false;
      const activeRooms: PublicRoomEntry[] = [];
      for (const [code, room] of this.publicRooms.entries()) {
        if (!room || room.players <= 0 || room.players >= room.maxPlayers || now - room.updatedAt > 600000) {
          this.publicRooms.delete(code);
          changed = true;
          continue;
        }
        activeRooms.push(room);
      }
      if (changed) {
        this.ctx.waitUntil(this.ctx.storage.put('public_rooms', Object.fromEntries(this.publicRooms)));
      }

      return new Response(
        JSON.stringify({
          success: true,
          count: activeRooms.length,
          rooms: activeRooms,
        }),
        { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // HTTP POST /notify or /api/notify -> Relay real-time event to target user's WebSocket
    if (
      (url.pathname === '/notify' || url.pathname === '/api/notify') &&
      request.method === 'POST'
    ) {
      try {
        const body: any = await request.json();
        const { targetUserId, event, data } = body || {};
        if (!constantTimeSecretMatch(this.env.INTERNAL_API_SECRET, request.headers.get('x-internal-secret'))) {
          return new Response(JSON.stringify({ error: 'Yetkisiz erişim' }), { status: 403 });
        }
        if (targetUserId && event) {
          const delivered = this.sendToUser(targetUserId, event, data);
          return new Response(
            JSON.stringify({ success: true, delivered }),
            { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
          );
        }
        return new Response(
          JSON.stringify({ success: false, error: 'Missing targetUserId or event' }),
          { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        );
      } catch (e: any) {
        return new Response(
          JSON.stringify({ success: false, error: e.message }),
          { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        );
      }
    }

    // HTTP GET /presence or /api/presence -> Return online users snapshot
    if (
      url.pathname === '/presence' ||
      url.pathname === '/api/presence' ||
      url.pathname === '/queue-status' ||
      (request.method === 'GET' && !request.headers.get('Upgrade'))
    ) {
      const onlineList = this.getOnlinePresenceSnapshot();
      return new Response(
        JSON.stringify({
          success: true,
          queuedCount: this.queue.size,
          activeSockets: this.ctx.getWebSockets().length,
          onlineUserIds: onlineList.map((p) => p.userId),
          presences: onlineList,
        }),
        { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
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
    const isMatchmakingIntent =
      url.pathname.startsWith('/ws/matchmaking') ||
      url.searchParams.get('intent') === 'matchmaking';

    let authUser: AuthUser | undefined;
    if (token) {
      const auth = await verifyJwt(token, this.env.JWT_SECRET);
      if (auth.isValid && auth.user) {
        authUser = auth.user;
      }
    }

    if (token && !authUser) {
      return new Response(JSON.stringify({ error: 'Geçersiz oturum' }), { status: 401 });
    }

    if (!authUser) {
      const pid = rawPlayerId || `guest_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      if (!pid.startsWith('guest_') && !pid.startsWith('guest:')) {
        return new Response(JSON.stringify({ error: 'Misafir kimliği geçersiz' }), { status: 401 });
      }
      const name = sanitizeString(rawDisplayName || `Oyuncu ${pid.slice(-4)}`, 30);
      authUser = {
        id: pid,
        username: name.toLowerCase().replace(/\s+/g, '_'),
        displayName: name,
        avatarUrl: rawAvatarUrl || 'av1',
        isGuest: true,
      };
    } else if (rawPlayerId && authUser.id !== rawPlayerId) {
      return new Response(JSON.stringify({ error: 'Kimlik uyuşmazlığı' }), { status: 403 });
    }

    // Accept WebSocket into hibernation
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    const tags = [`player:${authUser.id}`, isMatchmakingIntent ? 'matchmaker' : 'presence'];
    this.ctx.acceptWebSocket(server, tags);

    const onlineStatusVisible = url.searchParams.get('onlineStatusVisible') !== 'false';
    const attachment: QueueEntry & { inRoom?: boolean; currentRoomCode?: string; onlineStatusVisible?: boolean } = {
      matchId: 'match_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      playerId: authUser.id,
      username: authUser.username,
      displayName: authUser.displayName || authUser.username,
      avatarUrl: authUser.avatarUrl,
      mode,
      category,
      difficulty,
      queuedAt: Date.now(),
      status: isMatchmakingIntent ? 'searching' : 'cancelled',
      inRoom: false,
      onlineStatusVisible,
    };
    server.serializeAttachment(attachment);

    // Mark user online in global presence registry and broadcast green dot
    const presenceEntry: PresenceEntry = {
      userId: authUser.id,
      username: authUser.username,
      displayName: authUser.displayName || authUser.username,
      avatarUrl: authUser.avatarUrl,
      online: true,
      inRoom: false,
      lastSeen: Date.now(),
      onlineStatusVisible,
    };
    this.presences.set(authUser.id, presenceEntry);

    // Send full snapshot of currently online users to the newly connected client
    try {
      const snapshot = this.getOnlinePresenceSnapshot();
      server.send(
        encodeWsMessage('presence:snapshot', {
          onlineUserIds: snapshot.map((p) => p.userId),
          presences: snapshot,
        })
      );
    } catch {}

    // Broadcast this user's online status to everyone
    if (onlineStatusVisible) {
      this.broadcastToAll('presence:update', presenceEntry);
      this.broadcastToAll('user:online', { userId: authUser.id, presence: presenceEntry });
    }

    // Only auto-enqueue into 1v1 matchmaking if explicitly requested
    if (isMatchmakingIntent) {
      await this.enqueuePlayer(attachment);
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    let limiter = this.rateLimiters.get(ws);
    if (!limiter) {
      limiter = new RateLimiter(30, 1000);
      this.rateLimiters.set(ws, limiter);
    }
    if (!limiter.check()) {
      ws.send(createWsError('Çok fazla istek gönderildi', 'RATE_LIMITED'));
      return;
    }

    const envelope = decodeWsMessage(message);
    if (!envelope) return;

    const attachment = ws.deserializeAttachment() as (QueueEntry & { inRoom?: boolean; currentRoomCode?: string; onlineStatusVisible?: boolean }) | null;
    if (!attachment || !attachment.playerId) return;

    switch (envelope.event) {
      case SOCKET_EVENTS.FIND_MATCH: {
        const payload = envelope.payload || {};
        const updatedEntry: QueueEntry = {
          ...attachment,
          avatarUrl: payload.avatarUrl || attachment.avatarUrl,
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

      case 'presence:ping':
      case 'presence:update': {
        const payload = envelope.payload || {};
        // A client may update only its own presence; never trust payload.userId.
        const uid = attachment.playerId;
        const isOnline = payload.online !== undefined ? Boolean(payload.online) : true;
        const inRoom = payload.inRoom !== undefined ? Boolean(payload.inRoom) : Boolean(attachment.inRoom);
        const currentRoomCode = payload.currentRoomCode !== undefined ? payload.currentRoomCode : attachment.currentRoomCode;
        const onlineStatusVisible = payload.onlineStatusVisible !== undefined ? Boolean(payload.onlineStatusVisible) : attachment.onlineStatusVisible !== false;

        attachment.inRoom = inRoom;
        attachment.currentRoomCode = currentRoomCode;
        attachment.onlineStatusVisible = onlineStatusVisible;
        ws.serializeAttachment(attachment);

        const updatedPresence: PresenceEntry = {
          userId: uid,
          username: attachment.username,
          displayName: attachment.displayName,
          avatarUrl: attachment.avatarUrl,
          online: isOnline,
          inRoom,
          currentRoomCode,
          lastSeen: Date.now(),
          onlineStatusVisible,
        };
        this.presences.set(uid, updatedPresence);
        if (onlineStatusVisible) {
          this.broadcastToAll('presence:update', updatedPresence);
        } else {
          this.broadcastToAll('presence:update', { userId: uid, online: false, inRoom: false });
        }
        break;
      }

      case 'presence:query': {
        const snapshot = this.getOnlinePresenceSnapshot();
        ws.send(
          encodeWsMessage('presence:snapshot', {
            onlineUserIds: snapshot.map((p) => p.userId),
            presences: snapshot,
          })
        );
        break;
      }

      case 'ping':
        ws.send(JSON.stringify({ event: 'pong', timestamp: Date.now() }));
        break;
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    const attachment = ws.deserializeAttachment() as QueueEntry | null;
    if (attachment && attachment.playerId) {
      await this.dequeuePlayer(attachment.playerId);

      // Check if user still has another open WebSocket before marking offline
      const remainingSockets = this.ctx.getWebSockets(`player:${attachment.playerId}`).filter((s) => s !== ws);
      if (remainingSockets.length === 0) {
        const existing = this.presences.get(attachment.playerId);
        const offlinePresence: PresenceEntry = {
          userId: attachment.playerId,
          username: existing?.username || attachment.username,
          displayName: existing?.displayName || attachment.displayName,
          avatarUrl: existing?.avatarUrl || attachment.avatarUrl,
          online: false,
          inRoom: false,
          currentRoomCode: undefined,
          lastSeen: Date.now(),
        };
        this.presences.set(attachment.playerId, offlinePresence);
        this.broadcastToAll('presence:update', offlinePresence);
        this.broadcastToAll('user:offline', { userId: attachment.playerId, presence: offlinePresence });
      }
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
    const bytes = new Uint8Array(10);
    crypto.getRandomValues(bytes);
    return 'TAV-' + Array.from(bytes, (value) => chars[value % chars.length]).join('');
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
      if (!this.env.INTERNAL_API_SECRET || this.env.INTERNAL_API_SECRET.length < 32) {
        throw new Error('INTERNAL_API_SECRET is not configured');
      }
      await roomStub.fetch('http://internal/create-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-secret': this.env.INTERNAL_API_SECRET },
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
