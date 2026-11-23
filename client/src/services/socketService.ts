import { Platform } from 'react-native';
import {
  SOCKET_EVENTS,
  ClientQuestion,
  RoundResult,
  FinalMatchSummary,
  GameRoom,
  CustomRoomSettings,
  JokerEffect,
  JokerId,
} from '@trivia/shared';
import * as Sentry from '@sentry/react-native';
import { getRealtimeWsUrl } from '../config';
import { sanitizeAvatarForUrl } from '../utils/avatarImage';
import { getBotFallbackMs } from './analytics';

type EventCallback = (data: any) => void;

/**
 * Sentry breadcrumb'ları: WS bağlanma/kopma/yeniden bağlanma anları hata
 * izlerinin yanında görünür — "oyundan atılıyorum" şikayetlerinde bağlantı
 * geçmişi kritik ipucu. SDK kapalıysa çağrılar sessizce yok sayılır.
 */
function leaveWsBreadcrumb(message: string, level: 'info' | 'error' | 'warning' = 'info'): void {
  try {
    Sentry.addBreadcrumb({ category: 'ws', message, level });
  } catch {
    // Sentry erişilemiyorsa oyun akışını etkileme
  }
}

interface WsMessageEnvelope<T = any> {
  event: string;
  requestId?: string;
  payload: T;
  timestamp: number;
}

type JokerRequest = {
  roomCode: string;
  playerId: string;
  question: ClientQuestion;
  jokerId: JokerId;
  sentTo?: WebSocket;
  sends: number;
  busyRetries: number;
  finish: (error?: Error, effect?: JokerEffect) => void;
};
const jokerRoundEnded = () => new Error('Bu soru artık aktif değil. Jokeri sonraki soruda kullanabilirsin.');

export class SocketService {
  private ws: WebSocket | null = null;
  private currentUrl: string = '';
  private presenceWs: WebSocket | null = null;
  private presenceUrl: string = '';
  private presenceReconnectTimer: any = null;
  private presencePingInterval: any = null;
  private presenceLastMessageAt = 0;
  private onlineUsers: Map<string, { online: boolean; inRoom?: boolean; currentRoomCode?: string }> = new Map();
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectTimer: any = null;
  private pingInterval: any = null;
  private isManuallyClosed: boolean = false;
  // Optional JWT auth token: when present it is sent as ?token= to the realtime
  // DOs (they resolve displayName/avatar from it) instead of giant avatarUrl
  // query values that can break the WebSocket upgrade
  private authToken: string | null = null;
  private jokerRequests = new Map<string, JokerRequest>();
  private roomQuestion?: ClientQuestion;

  // Track session details for automatic recovery
  private lastSessionContext: {
    roomCode?: string;
    playerId?: string;
    displayName?: string;
    avatarUrl?: string;
    isMatchmaking?: boolean;
    token?: string;
  } = {};

  /** Pass the logged-in user's JWT so realtime DOs authenticate with it. */
  public setAuthToken(token: string | null | undefined): void {
    const clean = token && !token.startsWith('mock') && !token.startsWith('guest_local') ? token : null;
    if (this.authToken !== clean) {
      this.cancelRoomJokers();
      this.authToken = clean;
    }
  }

  /** Connect persistent Cloudflare Presence & Notification Hub WebSocket */
  public connectPresence(playerId: string, displayName: string, avatarUrl?: string): void {
    if (!playerId) return;
    const targetUrl = getRealtimeWsUrl(
      `/ws/presence?intent=presence&${this.buildPlayerQuery(playerId, displayName, avatarUrl)}`
    );

    if (
      this.presenceWs &&
      (this.presenceWs.readyState === WebSocket.CONNECTING ||
        (this.presenceWs.readyState === WebSocket.OPEN && Date.now() - this.presenceLastMessageAt < 50_000)) &&
      this.presenceUrl === targetUrl
    ) {
      return;
    }

    this.closePresenceInternal();
    this.presenceUrl = targetUrl;
    this.initPresenceWebSocket(targetUrl);
  }

  private initPresenceWebSocket(url: string): void {
    try {
      const ws = new WebSocket(url);
      this.presenceWs = ws;

      const ping = () => {
        if (ws !== this.presenceWs || ws.readyState !== WebSocket.OPEN) return;
        if (Date.now() - this.presenceLastMessageAt >= 50_000) {
          ws.close();
          return;
        }
        this.sendPresenceEnvelope('presence:ping', {
          inRoom: Boolean(this.lastSessionContext.roomCode),
          currentRoomCode: this.lastSessionContext.roomCode,
        });
      };

      ws.onopen = () => {
        if (ws !== this.presenceWs) return;
        this.presenceLastMessageAt = Date.now();
        ping();
        this.presencePingInterval = setInterval(ping, 20_000);
        this.emitLocal('presence:connected', undefined);
      };

      ws.onmessage = (event: MessageEvent) => {
        if (ws !== this.presenceWs) return;
        this.presenceLastMessageAt = Date.now();
        this.handleIncomingMessage(event.data);
      };

      ws.onclose = () => {
        if (ws !== this.presenceWs) return;
        this.closePresenceInternal();
        this.schedulePresenceReconnect(url);
      };
    } catch {
      this.schedulePresenceReconnect(url);
    }
  }

  private schedulePresenceReconnect(url: string): void {
    clearTimeout(this.presenceReconnectTimer);
    this.presenceReconnectTimer = setTimeout(() => {
      if (this.presenceUrl === url && !this.presenceWs) this.initPresenceWebSocket(url);
    }, 3500);
  }

  private closePresenceInternal(): void {
    if (this.presencePingInterval) {
      clearInterval(this.presencePingInterval);
      this.presencePingInterval = null;
    }
    clearTimeout(this.presenceReconnectTimer);
    if (this.presenceWs) {
      const ws = this.presenceWs;
      this.presenceWs = null;
      try {
        ws.close();
      } catch {}
    }
  }

  public isUserOnline(userId: string): boolean {
    return Boolean(this.onlineUsers.get(userId)?.online);
  }

  public getUserPresence(userId: string): { online: boolean; inRoom?: boolean; currentRoomCode?: string } | undefined {
    return this.onlineUsers.get(userId);
  }

  public requestPresenceSnapshot(): void {
    this.sendPresenceEnvelope('presence:query', {});
  }

  public notifyUserRealtime(targetUserId: string, targetEvent: string, data: any): void {
    this.sendPresenceEnvelope('social:notify', { targetUserId, targetEvent, data });
  }

  public sendPresenceEnvelope(event: string, payload: any = {}): void {
    const message = JSON.stringify({
      event,
      requestId: `preq_${Date.now()}`,
      payload,
      timestamp: Date.now(),
    });
    if (this.presenceWs && this.presenceWs.readyState === WebSocket.OPEN) {
      this.presenceWs.send(message);
    } else if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    }
  }

  /** Safe player query: bounded avatar (no local/base64 photos) and token if available. */
  private buildPlayerQuery(playerId: string, displayName: string, avatarUrl?: string): string {
    const base = `playerId=${encodeURIComponent(playerId)}&displayName=${encodeURIComponent(displayName)}&avatarUrl=${encodeURIComponent(sanitizeAvatarForUrl(avatarUrl))}`;
    return this.authToken ? `${base}&token=${encodeURIComponent(this.authToken)}` : base;
  }

  public isConnected(): boolean {
    return !!(this.ws && this.ws.readyState === (typeof WebSocket !== 'undefined' ? WebSocket.OPEN : 1));
  }

  public isPresenceConnected(): boolean {
    return !!(this.presenceWs && this.presenceWs.readyState === (typeof WebSocket !== 'undefined' ? WebSocket.OPEN : 1));
  }

  /**
   * İnternet geri döndüğünde güvenli yeniden bağlanma: manuel kapatılmadıysa ve
   * son URL biliniyorsa aynı oturuma (oda / matchmaking / presence) döner.
   * `connect()` çağırmak yerine bu kullanılır ki hedef URL bozulmasın.
   */
  public ensureConnected(): void {
    if (this.isManuallyClosed || !this.currentUrl) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.reconnectAttempts = 0;
    this.initWebSocket(this.currentUrl);
  }

  public connect(url?: string): any {
    this.isManuallyClosed = false;
    const targetUrl = url || getRealtimeWsUrl('/ws');

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      if (this.currentUrl === targetUrl) {
        return this.getSocket();
      }
    }
    if (this.currentUrl && this.currentUrl !== targetUrl) {
      this.closeInternal();
    }

    this.currentUrl = targetUrl;
    this.initWebSocket(targetUrl);
    return this.getSocket();
  }

  private initWebSocket(url: string): void {
    clearTimeout(this.reconnectTimer);
    this.roomQuestion = undefined;
    try {
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        if (this.ws !== ws) return;
        const wasReconnect = this.reconnectAttempts > 0;
        this.reconnectAttempts = 0;
        this.startPingInterval();
        leaveWsBreadcrumb(wasReconnect ? 'WS yeniden bağlandı' : 'WS bağlandı');
        this.emitLocal('connect', {});

        // If reconnecting to a room, automatically send room:join
        if (this.lastSessionContext.roomCode && this.lastSessionContext.playerId) {
          this.sendEnvelope(SOCKET_EVENTS.JOIN_ROOM, {
            roomCode: this.lastSessionContext.roomCode,
            playerId: this.lastSessionContext.playerId,
            displayName: this.lastSessionContext.displayName,
            avatarUrl: this.lastSessionContext.avatarUrl,
          });
        }
      };

      ws.onmessage = (event: MessageEvent) => {
        if (this.ws === ws) this.handleIncomingMessage(event.data, ws);
      };

      ws.onerror = (error: any) => {
        if (this.ws === ws) this.emitLocal('error', error);
      };

      ws.onclose = (event: CloseEvent) => {
        if (this.ws !== ws) return;
        this.roomQuestion = undefined;
        this.stopPingInterval();
        leaveWsBreadcrumb(
          `WS koptu (kod: ${event.code}${event.reason ? ', neden: ' + event.reason : ''}${this.isManuallyClosed ? ', manuel' : ''})`,
          this.isManuallyClosed ? 'info' : 'error',
        );
        this.emitLocal('disconnect', { reason: event.reason, code: event.code });

        if (!this.isManuallyClosed && this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = this.jokerRequests.size && this.reconnectAttempts === 0
            ? 0 : Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 8000);
          this.reconnectAttempts += 1;
          leaveWsBreadcrumb(`WS yeniden bağlanıyor (deneme: ${this.reconnectAttempts}, bekleme: ${delay}ms)`, 'warning');
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(() => {
            if (this.ws === ws && !this.isManuallyClosed && this.currentUrl) {
              this.initWebSocket(this.currentUrl);
            }
          }, delay);
        }
      };
    } catch (err: any) {
      console.warn('[SocketService] WebSocket connection failed:', err);
    }
  }

  private handleIncomingMessage(raw: any, gameSocket?: WebSocket): void {
    try {
      const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
      const parsed: WsMessageEnvelope = JSON.parse(text);

      if (!parsed || typeof parsed.event !== 'string') return;

      const event = parsed.event;
      let payload = parsed.payload;
      const jokerRequest = gameSocket && parsed.requestId ? this.jokerRequests.get(parsed.requestId) : undefined;
      if (jokerRequest && event === SOCKET_EVENTS.ERROR) {
        if (payload?.message === 'Joker isteği işleniyor.' && jokerRequest.busyRetries < 4) {
          // The previous socket might have committed the same operation but
          // not sent its result yet. Retry that same round receipt, not a new use.
          const id = parsed.requestId!;
          const attempt = ++jokerRequest.busyRetries;
          setTimeout(() => {
            if (this.ws !== gameSocket || this.jokerRequests.get(id) !== jokerRequest) return;
            this.flushRoomJoker(id, jokerRequest, true);
          }, 200 * attempt);
        } else jokerRequest.finish(new Error(payload?.message || 'Joker kullanılamadı.'));
        return;
      }
      if (jokerRequest && event === SOCKET_EVENTS.JOKER_RESULT) {
        if (Array.isArray(payload?.eliminated)) jokerRequest.finish(undefined, payload);
        else jokerRequest.finish(new Error('Joker sonucu alınamadı.'));
        return;
      }

      // Update local presence cache from Cloudflare WebSocket
      if (event === 'presence:snapshot' && payload && Array.isArray(payload.presences)) {
        this.onlineUsers.clear();
        for (const p of payload.presences) {
          if (p && p.userId) {
            this.onlineUsers.set(p.userId, {
              online: Boolean(p.online),
              inRoom: Boolean(p.inRoom),
              currentRoomCode: p.currentRoomCode,
            });
          }
        }
      } else if (event === 'presence:update' && payload && payload.userId) {
        this.onlineUsers.set(payload.userId, {
          online: Boolean(payload.online),
          inRoom: Boolean(payload.inRoom),
          currentRoomCode: payload.currentRoomCode,
        });
      } else if (event === 'user:online' && payload) {
        const uid = payload.userId || payload.presence?.userId;
        if (uid) {
          this.onlineUsers.set(uid, {
            online: true,
            inRoom: Boolean(payload.presence?.inRoom),
            currentRoomCode: payload.presence?.currentRoomCode,
          });
        }
      } else if (event === 'user:offline' && payload) {
        const uid = payload.userId || payload.presence?.userId;
        if (uid) {
          this.onlineUsers.set(uid, { online: false, inRoom: false });
        }
      }

      // Unpack room if wrapped in payload
      if (event === SOCKET_EVENTS.ROOM_STATE_SYNC && payload && payload.room) {
        payload = payload.room;
      }

      if (gameSocket && this.lastSessionContext.roomCode) {
        if (event === SOCKET_EVENTS.QUESTION_START) {
          this.roomQuestion = payload;
          this.jokerRequests.forEach((request, id) => this.flushRoomJoker(id, request));
        } else if (event === SOCKET_EVENTS.ROUND_RESULT || event === SOCKET_EVENTS.GAME_OVER ||
          (event === SOCKET_EVENTS.ROOM_STATE_SYNC && payload?.code === this.lastSessionContext.roomCode &&
            (payload.status === 'round_result' || payload.status === 'finished' || payload.status === 'game_over'))) {
          this.cancelRoomJokers();
        }
      }
      this.emitLocal(event, payload);
    } catch (err) {
      // Ignore non-json or ping frames
    }
  }

  private emitLocal(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(data);
        } catch {
          console.error('[SocketService] WebSocket event listener failed.');
        }
      });
    }
  }

  public updatePresence(userId: string, online: boolean): void {
    this.sendPresenceEnvelope('presence:update', { userId, online, timestamp: Date.now() });
  }

  public sendEnvelope(event: string, payload: any = {}): void {
    const envelope: WsMessageEnvelope = {
      event,
      requestId: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      payload,
      timestamp: Date.now(),
    };

    const message = JSON.stringify(envelope);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    } else if (
      (event.startsWith('presence:') || event.startsWith('social:')) &&
      this.presenceWs &&
      this.presenceWs.readyState === WebSocket.OPEN
    ) {
      this.presenceWs.send(message);
    } else {
      const socket = this.ws;
      if (!socket || socket.readyState !== WebSocket.CONNECTING) return;
      // Never send a queued action for the previous room through a new socket.
      const checkAndSend = setInterval(() => {
        if (this.ws !== socket || socket.readyState === WebSocket.CLOSED) {
          clearInterval(checkAndSend);
        } else if (socket.readyState === WebSocket.OPEN) {
          clearInterval(checkAndSend);
          socket.send(message);
        }
      }, 100);
      setTimeout(() => clearInterval(checkAndSend), 3000);
    }
  }

  private startPingInterval(): void {
    this.stopPingInterval();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ event: 'ping', timestamp: Date.now() }));
      }
    }, 25000);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private closeInternal(): void {
    this.stopPingInterval();
    clearTimeout(this.reconnectTimer);
    this.cancelRoomJokers();
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      try {
        ws.close();
      } catch {}
    }
  }

  public disconnect(): void {
    this.isManuallyClosed = true;
    this.closeInternal();
    this.closePresenceInternal();
    this.currentUrl = '';
    this.presenceUrl = '';
    this.onlineUsers.clear();
    this.lastSessionContext = {};
  }

  public getSocket(): any {
    return {
      connected: this.ws?.readyState === WebSocket.OPEN,
      on: (event: string, callback: EventCallback) => this.on(event, callback),
      off: (event: string, callback: EventCallback) => this.off(event, callback),
      emit: (event: string, payload: any) => this.sendEnvelope(event, payload),
    };
  }

  public on(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  public off(event: string, callback: EventCallback): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  // --- Public Domain Actions ---
  public createRoom(
    roomCode: string,
    playerId: string,
    displayName: string,
    avatarUrl?: string,
    settings?: CustomRoomSettings
  ): void {
    const cleanCode = roomCode.trim().toUpperCase();
    this.lastSessionContext = {
      roomCode: cleanCode,
      playerId,
      displayName,
      avatarUrl,
      isMatchmaking: false,
    };

    this.sendPresenceEnvelope('presence:update', {
      userId: playerId,
      online: true,
      inRoom: true,
      currentRoomCode: cleanCode,
    });

    const queryParts = [
      `roomCode=${cleanCode}`,
      this.buildPlayerQuery(playerId, displayName, avatarUrl),
      `isHost=true`,
    ];
    if (settings) {
      if (settings.maxPlayers) queryParts.push(`maxPlayers=${settings.maxPlayers}`);
      if (settings.totalRounds) queryParts.push(`totalRounds=${settings.totalRounds}`);
      if (settings.questionTimeSec) queryParts.push(`questionTimeSec=${settings.questionTimeSec}`);
      if (settings.penaltyForWrong !== undefined) queryParts.push(`penaltyForWrong=${settings.penaltyForWrong}`);
      if (settings.difficulty) queryParts.push(`difficulty=${settings.difficulty}`);
      if (settings.privacy) queryParts.push(`privacy=${settings.privacy}`);
      if (settings.password) queryParts.push(`password=${encodeURIComponent(settings.password)}`);
      if (settings.mixedCategories) queryParts.push('category=mixed');
      else if (settings.categories && settings.categories.length > 0) queryParts.push(`category=${settings.categories[0]}`);
      if (settings.subCategory) queryParts.push(`subCategory=${encodeURIComponent(settings.subCategory)}`);
    }

    const targetUrl = getRealtimeWsUrl(`/ws/room/${cleanCode}?${queryParts.join('&')}`);

    this.connect(targetUrl);
    this.sendEnvelope(SOCKET_EVENTS.CREATE_ROOM, {
      roomCode: cleanCode,
      playerId,
      displayName,
      avatarUrl,
      settings,
    });
  }

  public kickPlayer(roomCode: string, hostId: string, targetPlayerId: string): void {
    this.sendEnvelope(SOCKET_EVENTS.KICK_PLAYER, {
      roomCode: roomCode.trim().toUpperCase(),
      hostId,
      targetPlayerId,
    });
  }

  public updateRoomSettings(roomCode: string, hostId: string, settings: Partial<CustomRoomSettings>): void {
    this.sendEnvelope(SOCKET_EVENTS.UPDATE_ROOM_SETTINGS, {
      roomCode: roomCode.trim().toUpperCase(),
      hostId,
      settings,
    });
  }

  public joinRoom(roomCode: string, playerId: string, displayName: string, avatarUrl?: string, password?: string): void {
    const cleanCode = roomCode.trim().toUpperCase();
    this.lastSessionContext = {
      roomCode: cleanCode,
      playerId,
      displayName,
      avatarUrl,
      isMatchmaking: false,
    };

    this.sendPresenceEnvelope('presence:update', {
      userId: playerId,
      online: true,
      inRoom: true,
      currentRoomCode: cleanCode,
    });

    const passQuery = password ? `&password=${encodeURIComponent(password)}` : '';
    const targetUrl = getRealtimeWsUrl(
      `/ws/room/${cleanCode}?roomCode=${cleanCode}&${this.buildPlayerQuery(playerId, displayName, avatarUrl)}${passQuery}`
    );

    // Switch connection if not connected to this specific room DO
    if (!this.ws || this.currentUrl !== targetUrl || this.ws.readyState !== WebSocket.OPEN) {
      this.connect(targetUrl);
    } else {
      this.sendEnvelope(SOCKET_EVENTS.JOIN_ROOM, {
        roomCode: cleanCode,
        playerId,
        displayName,
        avatarUrl,
        password,
      });
    }
  }

  public leaveRoom(roomCode: string, playerId: string): void {
    const cleanCode = roomCode.trim().toUpperCase();
    this.sendEnvelope(SOCKET_EVENTS.LEAVE_ROOM, { roomCode: cleanCode, playerId });
    this.sendPresenceEnvelope('presence:update', {
      userId: playerId,
      online: true,
      inRoom: false,
      currentRoomCode: undefined,
    });
    if (this.lastSessionContext.roomCode === cleanCode) {
      delete this.lastSessionContext.roomCode;
      this.cancelRoomJokers();
    }
  }

  public toggleReady(roomCode: string, playerId: string): void {
    this.sendEnvelope(SOCKET_EVENTS.TOGGLE_READY, { roomCode, playerId });
  }

  public startGame(roomCode: string, playerId: string): void {
    this.sendEnvelope(SOCKET_EVENTS.START_GAME, { roomCode, playerId });
  }

  public submitAnswer(roomCode: string, playerId: string, selectedOptionId: string, roundNumber: number, questionId?: string): void {
    this.sendEnvelope(SOCKET_EVENTS.SUBMIT_ANSWER, {
      roomCode,
      playerId,
      selectedOptionId,
      roundNumber,
      questionId,
      clientTimestamp: Date.now(),
    });
  }

  private cancelRoomJokers(): void {
    this.roomQuestion = undefined;
    this.jokerRequests.forEach(request => request.finish(jokerRoundEnded()));
  }

  private flushRoomJoker(id: string, request: JokerRequest, busyRetry = false): void {
    const ws = this.ws;
    const current = this.roomQuestion;
    const original = request.question;
    if (this.lastSessionContext.roomCode !== request.roomCode || this.lastSessionContext.playerId !== request.playerId) {
      request.finish(jokerRoundEnded()); return;
    }
    if (!ws || ws.readyState !== WebSocket.OPEN || !current) return;
    const sameRound = current.jokerRoundStartedAt === original.jokerRoundStartedAt &&
      current.roundNumber === original.roundNumber;
    if (sameRound && current.jokerEffect && (current.id === original.id || request.sends > 0)) {
      request.finish(undefined, current.jokerEffect); return;
    }
    if (!sameRound || current.id !== original.id || current.timeRemainingMs === 0) {
      request.finish(jokerRoundEnded()); return;
    }
    if (!busyRetry && request.sentTo === ws) return;
    if (!busyRetry && request.sends >= 2) return;
    try {
      ws.send(JSON.stringify({
        event: SOCKET_EVENTS.USE_JOKER,
        requestId: id,
        timestamp: Date.now(),
        payload: { jokerId: request.jokerId, questionId: original.id, roundNumber: original.roundNumber, startedAt: original.jokerRoundStartedAt },
      }));
      if (!busyRetry) request.sends++;
      request.sentTo = ws;
    } catch {
      this.roomQuestion = undefined;
      try { ws.close(); } catch {}
    }
  }

  public useRoomJoker(roomCode: string, playerId: string, question: ClientQuestion, jokerId: JokerId): Promise<JokerEffect> {
    if (this.isManuallyClosed || this.lastSessionContext.playerId !== playerId ||
        this.lastSessionContext.roomCode !== roomCode || !question.jokerRoundStartedAt) {
      return Promise.reject(jokerRoundEnded());
    }
    const requestId = `joker_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return new Promise((resolve, reject) => {
      const finish = (error?: Error, effect?: JokerEffect) => {
        clearTimeout(timeout);
        this.jokerRequests.delete(requestId);
        if (effect && !error) resolve(effect);
        else reject(error ?? new Error('Joker sonucu alınamadı.'));
      };
      const timeout = setTimeout(() => finish(new Error('Joker için zamanında sunucu onayı alınamadı.')), 5000);
      const request: JokerRequest = { roomCode, playerId, question, jokerId, sends: 0, busyRetries: 0, finish };
      this.jokerRequests.set(requestId, request);
      this.flushRoomJoker(requestId, request);
      this.ensureConnected();
    });
  }

  public findMatch(
    playerId: string,
    displayName: string,
    avatarUrl?: string,
    mode: string = 'duel',
    category: string = 'general_culture',
    difficulty: string = 'medium'
  ): void {
    this.lastSessionContext = {
      playerId,
      displayName,
      avatarUrl,
      isMatchmaking: true,
    };

    // PostHog feature flag: bot'a düşme süresi (varsayılan 7sn) — canlıda A/B test edilebilir
    const botFallbackMs = getBotFallbackMs();

    const targetUrl = getRealtimeWsUrl(
      `/ws/matchmaking?intent=matchmaking&${this.buildPlayerQuery(playerId, displayName, avatarUrl)}&mode=${mode}&category=${category}&difficulty=${difficulty}&botFallbackMs=${botFallbackMs}`
    );

    this.connect(targetUrl);

    // Wait until open to send explicit event as well
    this.sendEnvelope(SOCKET_EVENTS.FIND_MATCH, {
      playerId,
      displayName,
      avatarUrl,
      mode,
      category,
      difficulty,
      botFallbackMs,
    });
  }

  public cancelMatch(playerId: string): void {
    this.sendEnvelope(SOCKET_EVENTS.CANCEL_MATCH, { playerId });
    this.lastSessionContext.isMatchmaking = false;
  }

  public sendEmote(roomCode: string, playerId: string, emote: string, id?: string): void {
    this.sendEnvelope(SOCKET_EVENTS.SEND_EMOTE, {
      id: id || `emote_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      roomCode,
      playerId,
      emote,
    });
  }

  public onEmoteReceived(callback: (data: { roomCode: string; playerId: string; emote: string; id?: string }) => void): () => void {
    return this.on(SOCKET_EVENTS.EMOTE_RECEIVED, callback);
  }

  public sendLobbyChat(
    roomCode: string,
    playerId: string,
    displayName: string,
    text: string,
    avatarUrl?: string,
    id?: string
  ): void {
    this.sendEnvelope(SOCKET_EVENTS.LOBBY_CHAT, {
      id: id || `chat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      roomCode,
      playerId,
      displayName,
      text,
      avatarUrl,
    });
  }

  public onLobbyMessage(
    callback: (data: {
      id: string;
      roomCode: string;
      playerId: string;
      displayName: string;
      avatarUrl?: string;
      text: string;
      timestamp: number;
    }) => void
  ): () => void {
    return this.on(SOCKET_EVENTS.LOBBY_MESSAGE, callback);
  }

  public getPublicRooms(): void {
    this.sendEnvelope(SOCKET_EVENTS.GET_PUBLIC_ROOMS, {});
  }

  public onPublicRoomsUpdate(callback: (rooms: any[]) => void): () => void {
    return this.on(SOCKET_EVENTS.PUBLIC_ROOMS_UPDATE, callback);
  }

  // --- Subscriptions with Auto-Unsubscribe returns ---
  public onStateSync(callback: (room: GameRoom) => void): () => void {
    return this.on(SOCKET_EVENTS.ROOM_STATE_SYNC, callback);
  }

  public onQuestionStart(callback: (question: ClientQuestion) => void): () => void {
    return this.on(SOCKET_EVENTS.QUESTION_START, callback);
  }

  public onRoundResult(callback: (result: RoundResult) => void): () => void {
    return this.on(SOCKET_EVENTS.ROUND_RESULT, callback);
  }

  public onJokerRetry(callback: (retry: { roundNumber: number; hint: string }) => void): () => void {
    return this.on(SOCKET_EVENTS.JOKER_RETRY, callback);
  }

  public onGameOver(callback: (summary: FinalMatchSummary) => void): () => void {
    return this.on(SOCKET_EVENTS.GAME_OVER, callback);
  }

  public onMatchFound(callback: (data: { roomCode: string; opponent?: any }) => void): () => void {
    return this.on(SOCKET_EVENTS.MATCH_FOUND, callback);
  }

  public onPlayerAnswered(callback: (data: { playerId: string; streak?: number }) => void): () => void {
    return this.on(SOCKET_EVENTS.PLAYER_ANSWERED, callback);
  }
}

export const socketService = new SocketService();
