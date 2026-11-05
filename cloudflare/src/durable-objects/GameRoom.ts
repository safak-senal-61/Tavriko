import { DurableObject } from 'cloudflare:workers';
import {
  GameRoom,
  Player,
  Question,
  ClientQuestion,
  GameMode,
  CategoryId,
  DifficultyLevel,
  calculateScore,
  calculateRankings,
  RoundResult,
  FinalMatchSummary,
  PlayerScoreSummary,
  SOCKET_EVENTS,
} from '@trivia/shared';
import { Env } from '../env';
import { encodeWsMessage, decodeWsMessage, createWsError, WsMessage } from '../websocket/protocol';
import { sanitizeString, sanitizeRoomCode, RateLimiter } from '../websocket/validation';
import { ApiService } from '../services/apiService';
import { verifyJwt, AuthUser } from '../auth/authenticate';

interface WsAttachment {
  playerId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  isHost: boolean;
}

type AlarmType = 'countdown' | 'round_end' | 'intermission' | 'reconnect_grace';

interface AlarmContext {
  type: AlarmType;
  roundNumber?: number;
  disconnectedPlayerId?: string;
}

export class GameRoomDO extends DurableObject<Env> {
  private room: GameRoom | null = null;
  private questions: Question[] = [];
  private alarmContext: AlarmContext | null = null;
  private apiService: ApiService;
  private rateLimiters = new WeakMap<WebSocket, RateLimiter>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.apiService = new ApiService(env.BACKEND_API_URL, env.INTERNAL_API_SECRET);

    // Restore state from persistent SQLite storage
    this.ctx.blockConcurrencyWhile(async () => {
      const storedRoom = await this.ctx.storage.get<GameRoom>('room');
      const storedQuestions = await this.ctx.storage.get<Question[]>('questions');
      const storedAlarm = await this.ctx.storage.get<AlarmContext>('alarmContext');

      if (storedRoom) this.room = storedRoom;
      if (storedQuestions) this.questions = storedQuestions;
      if (storedAlarm) this.alarmContext = storedAlarm;

      // Eski kayıtlardan kalan botları özel odalardan temizle
      await this.pruneBotsInCustomRoom();
    });
  }

  // --- WebSocket Upgrade & Request Handling ---
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Health / Inspection endpoint
    if (url.pathname === '/info' || request.method === 'GET' && !request.headers.get('Upgrade')) {
      return new Response(
        JSON.stringify({
          roomCode: this.room?.code,
          status: this.room?.status || 'uninitialized',
          playersCount: this.room ? Object.keys(this.room.players).length : 0,
          connectedCount: this.ctx.getWebSockets().length,
          currentRound: this.room?.currentRound || 0,
          totalRounds: this.room?.totalRounds || 0,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (request.method === 'POST' && (url.pathname === '/create-match' || url.pathname.endsWith('/create-match'))) {
      const data = (await request.json()) as any;
      const roomCode = sanitizeRoomCode(data.roomCode || url.searchParams.get('roomCode') || '');
      this.room = {
        code: roomCode,
        mode: data.mode || 'duel',
        hostId: data.players?.[0]?.id || 'host',
        status: 'lobby',
        category: data.category || 'general_culture',
        difficulty: data.difficulty || 'medium',
        maxPlayers: 2,
        currentRound: 0,
        totalRounds: 5,
        questionTimeSec: 15,
        penaltyForWrong: false,
        players: {},
        scores: {},
      };
      if (Array.isArray(data.players)) {
        // Özel/kendi odalarında roller SADECE gerçek katılımcılardır — bot asla eklenmez!
        const allowsBots = this.room.mode === 'duel' || this.room.mode === 'quick_match';
        const acceptedPlayers = allowsBots ? data.players : data.players.filter((p: any) => !p.isBot && !String(p.id || '').startsWith('bot_'));
      // Override'a gerek yok: gerçek oyuncular WebSocket katılımıyla eklenir, botlar tamamen yok sayılır
      data.players = acceptedPlayers;
        for (const p of data.players) {
          this.room.players[p.id] = {
            id: p.id,
            username: p.username || p.displayName,
            displayName: p.displayName,
            avatarUrl: p.avatarUrl || 'av1',
            score: 0,
            currentStreak: 0,
            isReady: true,
            isHost: p.id === data.players[0].id,
            isConnected: !p.isBot,
            hasAnsweredCurrentRound: false,
            totalResponseTimeMs: 0,
            correctAnswersCount: 0,
            isBot: !!p.isBot,
          };
          this.room.scores[p.id] = 0;
        }
      }
      const questions = await this.apiService.fetchRoomQuestions(
        this.room.category,
        this.room.difficulty,
        5
      );
      this.questions = questions || [];
      this.room.totalRounds = this.questions.length;
      await this.persist();
      await this.ctx.storage.put('questions', this.questions);
      return new Response(JSON.stringify({ success: true, room: this.getSanitizedRoom() }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket Upgrade', { status: 426 });
    }

    // Authentication & Identification
    const authHeader = request.headers.get('Authorization');
    const bearerToken = authHeader?.replace(/^Bearer\s+/i, '');
    const queryToken = url.searchParams.get('token');
    const token = bearerToken || queryToken;

    const rawPlayerId = url.searchParams.get('playerId');
    const rawDisplayName = url.searchParams.get('displayName');
    const rawAvatarUrl = url.searchParams.get('avatarUrl');
    const rawRoomCode = (url.searchParams.get('roomCode') || url.pathname.split('/').pop() || '').toUpperCase();
    const mode = (url.searchParams.get('mode') as GameMode) || 'friends_private';
    const category = (url.searchParams.get('category') as CategoryId) || 'general_culture';
    const difficulty = (url.searchParams.get('difficulty') as DifficultyLevel) || 'medium';

    let authUser: AuthUser | undefined;

    if (token) {
      const authResult = await verifyJwt(token, this.env.JWT_SECRET);
      if (authResult.isValid && authResult.user) {
        authUser = authResult.user;
      }
    }

    // Support guests or query-based identity if token was not strictly provided
    if (!authUser) {
      const pid = rawPlayerId || `guest_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const name = sanitizeString(rawDisplayName || `Misafir ${pid.slice(-4)}`, 30);
      authUser = {
        id: pid,
        username: name.toLowerCase().replace(/\s+/g, '_'),
        displayName: name,
        avatarUrl: rawAvatarUrl || 'av1',
        isGuest: true,
      };
    }

    // Initialize room if not already created
    if (!this.room) {
      const qpMaxPlayers = parseInt(url.searchParams.get('maxPlayers') || '', 10);
      const qpTotalRounds = parseInt(url.searchParams.get('totalRounds') || '', 10);
      const qpQuestionTime = parseInt(url.searchParams.get('questionTimeSec') || '', 10);
      const qpPenalty = url.searchParams.get('penaltyForWrong') === 'true';

      this.room = {
        code: rawRoomCode || 'TAV-' + Math.random().toString(36).substring(2, 7).toUpperCase(),
        mode,
        hostId: authUser.id,
        status: 'lobby',
        category,
        difficulty,
        maxPlayers: qpMaxPlayers > 0 ? qpMaxPlayers : (mode === 'duel' ? 2 : 8),
        currentRound: 0,
        totalRounds: qpTotalRounds > 0 ? qpTotalRounds : 5,
        questionTimeSec: qpQuestionTime > 0 ? qpQuestionTime : 15,
        penaltyForWrong: qpPenalty,
        players: {},
        scores: {},
      };
    }

    const roomCode = this.room.code;
    const isHost = this.room.hostId === authUser.id || Object.keys(this.room.players).length === 0;
    if (isHost) {
      this.room.hostId = authUser.id;
    }

    const isReconnecting = !!this.room.players[authUser.id];

    if (!isReconnecting) {
      // Check room full
      const playerCount = Object.keys(this.room.players).length;
      if (playerCount >= this.room.maxPlayers && !this.room.players[authUser.id]) {
        return new Response(
          JSON.stringify({ error: 'Oda dolu veya katılım kabul etmiyor' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }

      let team: 'red' | 'blue' | undefined;
      if (this.room.mode === 'team_battle') {
        const redCount = Object.values(this.room.players).filter((p) => p.team === 'red').length;
        const blueCount = Object.values(this.room.players).filter((p) => p.team === 'blue').length;
        team = redCount <= blueCount ? 'red' : 'blue';
      }

      const newPlayer: Player = {
        id: authUser.id,
        username: authUser.username,
        displayName: authUser.displayName || authUser.username,
        avatarUrl: authUser.avatarUrl || 'av1',
        score: 0,
        currentStreak: 0,
        isReady: isHost, // Host is ready by default
        isHost,
        team,
        isConnected: true,
        hasAnsweredCurrentRound: false,
        totalResponseTimeMs: 0,
        correctAnswersCount: 0,
      };

      this.room.players[authUser.id] = newPlayer;
      this.room.scores[authUser.id] = 0;
    } else {
      // Reconnection
      const existing = this.room.players[authUser.id];
      existing.isConnected = true;
      if (authUser.displayName) existing.displayName = authUser.displayName;
      if (authUser.avatarUrl) existing.avatarUrl = authUser.avatarUrl;
    }

    await this.persist();

    // Close and prune any existing websockets for this player to prevent multiple active connections
    const existingPlayerSockets = this.ctx.getWebSockets(`player:${authUser.id}`);
    for (const oldWs of existingPlayerSockets) {
      try {
        oldWs.close(1000, 'Replaced by new connection');
      } catch {}
    }

    // Accept WebSocket pair with Hibernation
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    const tags = [`player:${authUser.id}`, `room:${roomCode}`];
    this.ctx.acceptWebSocket(server, tags);

    const attachment: WsAttachment = {
      playerId: authUser.id,
      username: authUser.username,
      displayName: authUser.displayName || authUser.username,
      avatarUrl: authUser.avatarUrl,
      isHost,
    };
    server.serializeAttachment(attachment);

    // Broadcast update to room
    if (isReconnecting) {
      this.broadcast(SOCKET_EVENTS.PLAYER_RECONNECTED, {
        playerId: authUser.id,
        username: authUser.username,
      });
    }

    this.broadcastStateSync();

    // In 1v1 duel or quick match, auto-start countdown when all expected human players have connected
    if (this.room.mode === 'duel' || this.room.mode === 'quick_match') {
      const humanPlayers = Object.values(this.room.players).filter((p) => !p.isBot);
      const connectedHumans = humanPlayers.filter((p) => p.isConnected);
      if (humanPlayers.length > 0 && connectedHumans.length >= humanPlayers.length && this.room.status === 'lobby') {
        await this.autoStartDuel();
      }
    }

    // If game is in progress and round is active, send current question to the reconnected player
    if (this.room.status === 'question_active' && this.room.currentQuestion) {
      const clientQ = this.getClientQuestion();
      if (clientQ) {
        server.send(encodeWsMessage(SOCKET_EVENTS.QUESTION_START, clientQ));
      }
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  // --- WebSocket Hibernation Event Handlers ---
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    let limiter = this.rateLimiters.get(ws);
    if (!limiter) {
      limiter = new RateLimiter(20, 1000);
      this.rateLimiters.set(ws, limiter);
    }
    if (!limiter.check()) {
      ws.send(createWsError('Çok fazla istek gönderildi, lütfen yavaşlayın', 'RATE_LIMITED'));
      return;
    }

    const envelope = decodeWsMessage(message);
    if (!envelope) {
      ws.send(createWsError('Geçersiz mesaj formatı', 'INVALID_MESSAGE'));
      return;
    }

    const attachment = ws.deserializeAttachment() as WsAttachment | null;
    if (!attachment || !attachment.playerId) {
      ws.send(createWsError('Kimlik doğrulanamadı', 'UNAUTHORIZED', envelope.requestId));
      return;
    }

    const playerId = attachment.playerId;

    try {
      switch (envelope.event) {
        case SOCKET_EVENTS.JOIN_ROOM:
          this.handleJoinRoom(ws, playerId, envelope);
          break;

        case SOCKET_EVENTS.LEAVE_ROOM:
          await this.handleLeaveRoom(ws, playerId, envelope);
          break;

        case SOCKET_EVENTS.TOGGLE_READY:
          await this.handleToggleReady(playerId, envelope);
          break;

        case SOCKET_EVENTS.START_GAME:
          await this.handleStartGame(ws, playerId, envelope);
          break;

        case SOCKET_EVENTS.KICK_PLAYER:
          await this.handleKickPlayer(ws, playerId, envelope);
          break;

        case SOCKET_EVENTS.UPDATE_ROOM_SETTINGS:
          await this.handleUpdateRoomSettings(ws, playerId, envelope);
          break;

        case SOCKET_EVENTS.SUBMIT_ANSWER:
          await this.handleSubmitAnswer(ws, playerId, envelope);
          break;

        case SOCKET_EVENTS.SEND_EMOTE:
          this.handleSendEmote(playerId, envelope);
          break;

        case SOCKET_EVENTS.LOBBY_CHAT:
          this.handleLobbyChat(playerId, envelope);
          break;

        case 'ping':
          ws.send(JSON.stringify({ event: 'pong', timestamp: Date.now() }));
          break;

        default:
          // Unhandled event
          break;
      }
    } catch (err: any) {
      ws.send(createWsError(err?.message || 'Sunucu hatası', 'SERVER_ERROR', envelope.requestId));
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    const attachment = ws.deserializeAttachment() as WsAttachment | null;
    if (!attachment || !this.room) return;

    const playerId = attachment.playerId;
    const player = this.room.players[playerId];
    if (player) {
      // Check if there are other active websockets for this player
      const otherSockets = this.ctx.getWebSockets(`player:${playerId}`).filter((s) => s !== ws);
      if (otherSockets.length > 0) {
        return;
      }

      player.isConnected = false;
      const gracePeriodSec = this.env.RECONNECTION_GRACE_SEC || 60;

      this.broadcast(SOCKET_EVENTS.PLAYER_DISCONNECTED, {
        playerId,
        username: player.username,
        gracePeriodSec,
      });

      await this.persist();

      // If active game, schedule alarm for grace period expiration
      if (this.room.status === 'question_active' || this.room.status === 'round_result') {
        const connectedRemaining = Object.values(this.room.players).filter((p) => p.isConnected);
        if (connectedRemaining.length <= 1 && this.room.mode === 'duel') {
          await this.scheduleAlarm('reconnect_grace', gracePeriodSec * 1000, {
            disconnectedPlayerId: playerId,
          });
        }
      }
    }
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    console.warn(`[GameRoomDO] WebSocket error on room ${this.room?.code}:`, error);
  }

  // --- Authoritative Alarm Handler ---
  async alarm(): Promise<void> {
    if (!this.room || !this.alarmContext) return;

    const ctx = this.alarmContext;
    this.alarmContext = null;
    await this.ctx.storage.delete('alarmContext');

    switch (ctx.type) {
      case 'countdown':
        await this.beginQuestionRound(1);
        break;

      case 'round_end':
        await this.endCurrentRound();
        break;

      case 'intermission':
        if (this.room.currentRound >= this.room.totalRounds) {
          await this.finishGame();
        } else {
          await this.beginQuestionRound(this.room.currentRound + 1);
        }
        break;

      case 'reconnect_grace':
        // If player still disconnected after grace period, declare game over
        if (ctx.disconnectedPlayerId && this.room.players[ctx.disconnectedPlayerId]) {
          const p = this.room.players[ctx.disconnectedPlayerId];
          if (!p.isConnected && this.room.status !== 'game_over') {
            await this.finishGame();
          }
        }
        break;
    }
  }

  // --- Core Game Flow Methods ---
  private async handleJoinRoom(ws: WebSocket, playerId: string, envelope: WsMessage): Promise<void> {
    if (!this.room) return;
    // The WebSocket handshake URL only carries a short placeholder for big
    // data-URI avatars; refresh the real value from the JOIN_ROOM envelope so
    // lobby/guest opponents still see the custom profile photo
    const payloadAvatar = (envelope as any)?.payload?.avatarUrl;
    const roomPlayer = this.room.players[playerId];
    if (roomPlayer && typeof payloadAvatar === 'string' && payloadAvatar && roomPlayer.avatarUrl !== payloadAvatar) {
      roomPlayer.avatarUrl = payloadAvatar;
      await this.persist();
    }
    this.broadcastStateSync();

    // In 1v1 duel or quick match, auto-start countdown when all expected human players have connected
    if (this.room.mode === 'duel' || this.room.mode === 'quick_match') {
      const humanPlayers = Object.values(this.room.players).filter((p) => !p.isBot);
      const connectedHumans = humanPlayers.filter((p) => p.isConnected);
      if (humanPlayers.length > 0 && connectedHumans.length >= humanPlayers.length && this.room.status === 'lobby') {
        await this.autoStartDuel();
      }
    }
  }

  private async handleLeaveRoom(ws: WebSocket, playerId: string, envelope: WsMessage): Promise<void> {
    if (!this.room) return;

    const player = this.room.players[playerId];
    if (player) {
      delete this.room.players[playerId];
      delete this.room.scores[playerId];

      this.broadcast(SOCKET_EVENTS.PLAYER_DISCONNECTED, {
        playerId,
        username: player.username,
        isLeaving: true,
      });

      const remainingPlayers = Object.values(this.room.players);
      const connectedRemaining = remainingPlayers.filter((p) => p.isConnected);

      // If room is now empty, cancel all alarms and end game
      if (connectedRemaining.length === 0) {
        this.room.status = 'game_over';
        await this.ctx.storage.deleteAlarm();
        this.alarmContext = null;
        await this.ctx.storage.delete('alarmContext');
      } else if (this.room.status === 'question_active' || this.room.status === 'round_result') {
        // If 1v1 mode and only 1 player remains, finish game immediately
        if (remainingPlayers.length <= 1) {
          await this.finishGame();
        } else {
          this.broadcastStateSync();
        }
      } else {
        // In lobby, reassign host if host left
        if (this.room.hostId === playerId && remainingPlayers.length > 0) {
          this.room.hostId = remainingPlayers[0].id;
          remainingPlayers[0].isHost = true;
        }
        this.broadcastStateSync();
      }

      await this.persist();
    }

    try {
      ws.close(1000, 'Left room');
    } catch {}
  }

  private async handleToggleReady(playerId: string, envelope: WsMessage): Promise<void> {
    if (!this.room || this.room.status !== 'lobby') return;
    const player = this.room.players[playerId];
    if (!player) return;

    player.isReady = !player.isReady;
    await this.persist();
    this.broadcastStateSync();
  }

  private async handleStartGame(ws: WebSocket, playerId: string, envelope: WsMessage): Promise<void> {
    if (!this.room) return;

    // Özel odada oyuna başlarken bot varsa uçur (yalnızca gerçek katılımcılar kalır)
    await this.pruneBotsInCustomRoom();

    if (this.room.hostId !== playerId) {
      ws.send(createWsError('Yalnızca oda kurucusu oyunu başlatabilir', 'FORBIDDEN', envelope.requestId));
      return;
    }

    if (this.room.status !== 'lobby') {
      ws.send(createWsError('Oyun zaten başladı', 'INVALID_STATE', envelope.requestId));
      return;
    }

    // Fetch authoritative questions from backend or defaults
    const questions = await this.apiService.fetchRoomQuestions(
      this.room.category,
      this.room.difficulty,
      this.room.totalRounds || 5
    );

    if (!questions || questions.length === 0) {
      ws.send(createWsError('Sorular yüklenemedi, lütfen tekrar deneyin', 'QUESTIONS_ERROR', envelope.requestId));
      return;
    }

    this.questions = questions;
    this.room.totalRounds = questions.length;
    this.room.currentRound = 0;
    this.room.status = 'countdown';

    const countdownSec = this.env.COUNTDOWN_DURATION_SEC || 3;

    await this.persist();
    await this.ctx.storage.put('questions', this.questions);

    // Broadcast countdown start to all clients
    this.broadcast(SOCKET_EVENTS.ROOM_STATE_SYNC, { room: this.getSanitizedRoom() });
    this.broadcast(SOCKET_EVENTS.COUNTDOWN_TICK, { secondsRemaining: countdownSec });

    // Set alarm for when countdown finishes
    await this.scheduleAlarm('countdown', countdownSec * 1000);
  }

  private async handleKickPlayer(ws: WebSocket, playerId: string, envelope: WsMessage): Promise<void> {
    if (!this.room) return;
    if (this.room.hostId !== playerId) {
      ws.send(createWsError('Yalnızca oda kurucusu oyuncu atabilir', 'FORBIDDEN', envelope.requestId));
      return;
    }
    const targetPlayerId = String(envelope.payload?.targetPlayerId || '');
    if (!targetPlayerId || targetPlayerId === playerId) {
      ws.send(createWsError('Geçersiz oyuncu seçimi', 'BAD_REQUEST', envelope.requestId));
      return;
    }
    delete this.room.players[targetPlayerId];
    delete this.room.scores[targetPlayerId];
    await this.persist();
    this.broadcastStateSync();
  }

  private async handleUpdateRoomSettings(ws: WebSocket, playerId: string, envelope: WsMessage): Promise<void> {
    if (!this.room) return;
    if (this.room.hostId !== playerId) {
      ws.send(createWsError('Yalnızca oda kurucusu ayarları değiştirebilir', 'FORBIDDEN', envelope.requestId));
      return;
    }
    if (this.room.status !== 'lobby') {
      ws.send(createWsError('Oyun devam ederken ayar değiştirilemez', 'INVALID_STATE', envelope.requestId));
      return;
    }
    const s = envelope.payload?.settings || {};
    if (s.maxPlayers) this.room.maxPlayers = Number(s.maxPlayers);
    if (s.totalRounds) this.room.totalRounds = Number(s.totalRounds);
    if (s.questionTimeSec) this.room.questionTimeSec = Number(s.questionTimeSec);
    if (s.difficulty) this.room.difficulty = s.difficulty;
    if (s.category) this.room.category = s.category;
    if (s.categories) this.room.categories = s.categories;
    if (s.mixedCategories !== undefined) this.room.mixedCategories = !!s.mixedCategories;
    if (s.penaltyForWrong !== undefined) this.room.penaltyForWrong = !!s.penaltyForWrong;
    await this.persist();
    this.broadcastStateSync();
  }

  private async beginQuestionRound(roundNum: number): Promise<void> {
    if (!this.room || roundNum > this.questions.length) {
      await this.finishGame();
      return;
    }

    this.room.currentRound = roundNum;
    const question = this.questions[roundNum - 1];
    this.room.currentQuestion = question;
    this.room.status = 'question_active';
    this.room.roundStartedAt = Date.now();

    // Reset round states
    Object.values(this.room.players).forEach((p) => {
      p.hasAnsweredCurrentRound = false;
      p.lastAnswerTimeMs = 0;
      p.lastSelectedOptionId = undefined;
      p.lastAnswerIsCorrect = undefined;
      p.lastPointsAwarded = 0;
      p.lastSpeedBonus = 0;
    });

    await this.persist();

    const clientQuestion = this.getClientQuestion();
    if (clientQuestion) {
      this.broadcast(SOCKET_EVENTS.QUESTION_START, clientQuestion);
    }

    // Set round timeout alarm
    const questionSec = question.timeLimitSec || this.room.questionTimeSec || 15;
    await this.scheduleAlarm('round_end', questionSec * 1000, { roundNumber: roundNum });

    // Schedule realistic bot answers for any bot in the room
    Object.values(this.room.players).forEach((p) => {
      if (p.isBot || p.id.startsWith('bot_')) {
        this.scheduleBotAnswer(p.id, question, roundNum);
      }
    });
  }

  private async handleSubmitAnswer(ws: WebSocket, playerId: string, envelope: WsMessage): Promise<void> {
    if (!this.room || this.room.status !== 'question_active' || !this.room.currentQuestion) {
      ws.send(createWsError('Soru aktif değil veya süre doldu', 'ROUND_INACTIVE', envelope.requestId));
      return;
    }

    const player = this.room.players[playerId];
    if (!player) {
      ws.send(createWsError('Oyuncu bulunamadı', 'NOT_FOUND', envelope.requestId));
      return;
    }

    if (player.hasAnsweredCurrentRound) {
      ws.send(createWsError('Bu soruya zaten yanıt verdiniz', 'ALREADY_ANSWERED', envelope.requestId));
      return;
    }

    const selectedOptionId = String(envelope.payload?.selectedOptionId || '');
    if (!selectedOptionId) {
      ws.send(createWsError('Cevap şıkkı zorunludur', 'BAD_REQUEST', envelope.requestId));
      return;
    }

    const now = Date.now();
    const roundStartedAt = this.room.roundStartedAt || now;
    const totalTimeMs = (this.room.currentQuestion.timeLimitSec || this.room.questionTimeSec || 15) * 1000;
    const elapsedMs = Math.max(0, now - roundStartedAt);

    // Expiration check with 600ms grace for network latency
    if (elapsedMs > totalTimeMs + 600) {
      player.hasAnsweredCurrentRound = true;
      ws.send(createWsError('Soru süresi doldu', 'TIME_EXPIRED', envelope.requestId));
      return;
    }

    await this.processPlayerAnswer(playerId, selectedOptionId, elapsedMs);
  }

  private async processPlayerAnswer(
    playerId: string,
    selectedOptionId: string,
    elapsedMs: number
  ): Promise<void> {
    if (!this.room || this.room.status !== 'question_active' || !this.room.currentQuestion) return;
    const player = this.room.players[playerId];
    if (!player || player.hasAnsweredCurrentRound) return;

    const totalTimeMs = (this.room.currentQuestion.timeLimitSec || this.room.questionTimeSec || 15) * 1000;
    const timeRemainingMs = Math.max(0, totalTimeMs - elapsedMs);

    const isCorrect = selectedOptionId === this.room.currentQuestion.correctOptionId;

    const scoreResult = calculateScore({
      isCorrect,
      timeRemainingMs,
      totalTimeMs,
      currentStreak: player.currentStreak,
      penaltyForWrong: this.room.penaltyForWrong,
    });

    player.hasAnsweredCurrentRound = true;
    player.lastAnswerTimeMs = elapsedMs;
    player.lastSelectedOptionId = selectedOptionId;
    player.lastAnswerIsCorrect = isCorrect;
    player.lastPointsAwarded = scoreResult.pointsAwarded;
    player.lastSpeedBonus = scoreResult.speedBonus;
    player.totalResponseTimeMs += elapsedMs;
    player.score += scoreResult.pointsAwarded;
    player.currentStreak = scoreResult.streak;
    if (isCorrect) {
      player.correctAnswersCount += 1;
    }
    this.room.scores[playerId] = player.score;

    await this.persist();

    // Broadcast that player answered (without revealing correctness)
    this.broadcast(SOCKET_EVENTS.PLAYER_ANSWERED, { playerId, streak: player.currentStreak });

    // Check if ALL participants in the room have answered
    const allParticipants = Object.values(this.room.players);
    const allAnswered =
      allParticipants.length > 0 &&
      allParticipants.every((p) => p.hasAnsweredCurrentRound);

    if (allAnswered) {
      // Early trigger for round end ONLY when EVERY player has answered
      await this.scheduleAlarm('round_end', 450, { roundNumber: this.room.currentRound });
    }
  }

  private scheduleBotAnswer(botId: string, question: Question, roundNum: number): void {
    const minThink = 2200;
    const maxThink = 5500;
    const thinkTimeMs = Math.floor(minThink + Math.random() * (maxThink - minThink));

    const accuracy = this.room?.difficulty === 'easy' ? 0.85 : this.room?.difficulty === 'hard' ? 0.55 : 0.72;
    const isCorrect = Math.random() < accuracy;
    let selectedOptionId = question.correctOptionId;
    if (!isCorrect) {
      const wrongOptions = question.options.filter((o) => o.id !== question.correctOptionId);
      if (wrongOptions.length > 0) {
        selectedOptionId = wrongOptions[Math.floor(Math.random() * wrongOptions.length)].id;
      }
    }

    setTimeout(async () => {
      if (
        this.room &&
        this.room.status === 'question_active' &&
        this.room.currentRound === roundNum &&
        this.room.players[botId] &&
        !this.room.players[botId].hasAnsweredCurrentRound
      ) {
        await this.processPlayerAnswer(botId, selectedOptionId, thinkTimeMs);
      }
    }, thinkTimeMs);
  }

  private async autoStartDuel(): Promise<void> {
    if (!this.room || this.room.status !== 'lobby') return;

    if (!this.questions || this.questions.length === 0) {
      const questions = await this.apiService.fetchRoomQuestions(
        this.room.category,
        this.room.difficulty,
        this.room.totalRounds || 5
      );
      this.questions = questions || [];
      this.room.totalRounds = this.questions.length;
      await this.ctx.storage.put('questions', this.questions);
    }

    this.room.status = 'countdown';
    this.room.currentRound = 0;
    const countdownSec = 3;

    await this.persist();
    this.broadcastStateSync();
    this.broadcast(SOCKET_EVENTS.COUNTDOWN_TICK, { secondsRemaining: countdownSec });

    await this.scheduleAlarm('countdown', countdownSec * 1000);
  }

  private async endCurrentRound(): Promise<void> {
    if (!this.room || !this.room.currentQuestion) return;

    this.room.status = 'round_result';

    const playerAnswers: RoundResult['playerAnswers'] = {};
    Object.values(this.room.players).forEach((p) => {
      playerAnswers[p.id] = {
        selectedOptionId: p.lastSelectedOptionId || '',
        isCorrect: !!p.lastAnswerIsCorrect,
        pointsEarned: p.lastPointsAwarded || 0,
        speedBonus: p.lastSpeedBonus || 0,
        streak: p.currentStreak,
        timeMs: p.lastAnswerTimeMs || 0,
      };
    });

    const leaderboard: PlayerScoreSummary[] = this.calculateLeaderboard();

    const roundResult: RoundResult = {
      roundNumber: this.room.currentRound,
      correctOptionId: this.room.currentQuestion.correctOptionId,
      explanation: this.room.currentQuestion.explanation,
      playerAnswers,
      leaderboard,
    };

    await this.persist();

    // Broadcast updated room state (correctAnswersCount & scores) and round results
    this.broadcastStateSync();
    this.broadcast(SOCKET_EVENTS.ROUND_RESULT, roundResult);

    // Schedule fast intermission alarm for seamless round progression
    const intermissionSec = this.env.ROUND_INTERMISSION_SEC ? Number(this.env.ROUND_INTERMISSION_SEC) : 1.5;
    await this.scheduleAlarm('intermission', intermissionSec * 1000);
  }

  private async finishGame(): Promise<void> {
    if (!this.room) return;

    this.room.status = 'game_over';
    const rankings = this.calculateLeaderboard();

    let teamScores: FinalMatchSummary['teamScores'];
    if (this.room.mode === 'team_battle') {
      let redTotal = 0;
      let blueTotal = 0;
      Object.values(this.room.players).forEach((p) => {
        if (p.team === 'red') redTotal += p.score;
        if (p.team === 'blue') blueTotal += p.score;
      });
      teamScores = {
        red: redTotal,
        blue: blueTotal,
        winner: redTotal > blueTotal ? 'red' : blueTotal > redTotal ? 'blue' : 'tie',
      };
    }

    const summary: FinalMatchSummary = {
      roomCode: this.room.code,
      mode: this.room.mode,
      totalRounds: this.room.totalRounds,
      podium: {
        first: rankings[0],
        second: rankings[1],
        third: rankings[2],
      },
      rankings,
      teamScores,
    };

    await this.persist();

    // Broadcast Game Over summary
    this.broadcast(SOCKET_EVENTS.GAME_OVER, summary);

    // Asynchronously submit match results to PostgreSQL backend
    this.ctx.waitUntil(this.apiService.submitMatchResults(summary));
  }

  private handleSendEmote(playerId: string, envelope: WsMessage): void {
    const emote = sanitizeString(envelope.payload?.emote || '👏', 10);
    const id = envelope.payload?.id || `emote_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.broadcast(SOCKET_EVENTS.EMOTE_RECEIVED, {
      id,
      playerId,
      emote,
      roomCode: this.room?.code,
    });
  }

  private handleLobbyChat(playerId: string, envelope: WsMessage): void {
    const rawText = envelope.payload?.text || '';
    const text = sanitizeString(rawText, 100);
    if (!text.trim()) return;
    const player = this.room?.players?.[playerId];
    const payload = {
      id: envelope.payload?.id || `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      roomCode: this.room?.code,
      playerId,
      displayName: player?.displayName || envelope.payload?.displayName || 'Oyuncu',
      avatarUrl: player?.avatarUrl || envelope.payload?.avatarUrl,
      text,
      timestamp: Date.now(),
    };
    this.broadcast(SOCKET_EVENTS.LOBBY_MESSAGE, payload);
  }

  // --- Helper Methods ---

  /**
   * Özel odalar (friends_private / custom / team_battle) SADECE gerçek katılımcıları içerir.
   * İçine sızmış ya da eski kayıttan kalmış bir bot varsa tamamen çıkarılır.
   */
  private async pruneBotsInCustomRoom(): Promise<boolean> {
    if (!this.room) return false;
    if (this.room.mode === 'duel' || this.room.mode === 'quick_match') return false;
    const botIds = Object.values(this.room.players)
      .filter((p) => p.isBot || p.id.startsWith('bot_') || p.id.startsWith('rival_bot_'))
      .map((p) => p.id);
    if (botIds.length === 0) return false;
    for (const botId of botIds) {
      delete this.room.players[botId];
      delete this.room.scores[botId];
    }
    // Bot kaldırıldıktan sonra kimsenin kalıcı host haline gelmemesi gerçeği: host gerçeklere geçer
    if (!this.room.players[this.room.hostId]) {
      const firstHuman = Object.values(this.room.players).find((p) => !p.isBot);
      if (firstHuman) {
        this.room.hostId = firstHuman.id;
        firstHuman.isHost = true;
      }
    }
    await this.persist();
    this.broadcastStateSync();
    return true;
  }

  private calculateLeaderboard(): PlayerScoreSummary[] {
    if (!this.room) return [];
    const playersArray = Object.values(this.room.players);
    const sorted = calculateRankings(
      playersArray.map((p) => ({
        playerId: p.id,
        name: p.displayName,
        score: p.score,
        avgResponseTimeMs:
          p.correctAnswersCount > 0
            ? Math.round(p.totalResponseTimeMs / (p.correctAnswersCount || 1))
            : 999999,
        correctCount: p.correctAnswersCount,
      }))
    );

    return sorted.map((res, index) => {
      const p = this.room!.players[res.playerId];
      return {
        playerId: p.id,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        score: p.score,
        rank: index + 1,
        streak: p.currentStreak,
        team: p.team,
        isHost: !!p.isHost,
        correctAnswersCount: p.correctAnswersCount,
      };
    });
  }

  private getClientQuestion(): ClientQuestion | null {
    if (!this.room || !this.room.currentQuestion) return null;
    const q = this.room.currentQuestion;
    return {
      id: q.id,
      categoryId: q.categoryId,
      difficulty: q.difficulty,
      text: q.text,
      options: q.options,
      roundNumber: this.room.currentRound,
      totalRounds: this.room.totalRounds,
      timeLimitSec: q.timeLimitSec || this.room.questionTimeSec || 15,
    };
  }

  private getSanitizedRoom(): GameRoom {
    if (!this.room) throw new Error('Room not found');
    const clone = { ...this.room };
    if (clone.currentQuestion && clone.status !== 'round_result' && clone.status !== 'game_over') {
      // Omit correctOptionId and explanation
      const { correctOptionId, explanation, ...safeQ } = clone.currentQuestion;
      clone.currentQuestion = safeQ as Question;
    }
    return clone;
  }

  private broadcastStateSync(): void {
    if (!this.room) return;
    this.broadcast(SOCKET_EVENTS.ROOM_STATE_SYNC, { room: this.getSanitizedRoom() });
  }

  private broadcast(event: string, payload: any): void {
    const raw = encodeWsMessage(event, payload);
    const sockets = this.ctx.getWebSockets();
    const sentPlayerIds = new Set<string>();

    for (const ws of sockets) {
      try {
        const attachment = ws.deserializeAttachment() as WsAttachment | null;
        if (attachment?.playerId) {
          if (sentPlayerIds.has(attachment.playerId)) {
            // Already sent to this player via another active socket; close duplicate
            try { ws.close(1000, 'Duplicate socket pruned'); } catch {}
            continue;
          }
          sentPlayerIds.add(attachment.playerId);
        }
        ws.send(raw);
      } catch {
        // Socket dead
      }
    }
  }

  private async scheduleAlarm(type: AlarmType, delayMs: number, extra?: Partial<AlarmContext>): Promise<void> {
    this.alarmContext = { type, ...extra };
    await this.ctx.storage.put('alarmContext', this.alarmContext);
    await this.ctx.storage.setAlarm(Date.now() + Math.max(100, delayMs));
  }

  private async persist(): Promise<void> {
    if (this.room) {
      await this.ctx.storage.put('room', this.room);
    }
  }
}
