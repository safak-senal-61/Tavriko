import { Platform } from 'react-native';
import {
  SOCKET_EVENTS,
  ClientQuestion,
  RoundResult,
  FinalMatchSummary,
  GameRoom,
  CustomRoomSettings,
} from '@trivia/shared';
import { getRealtimeWsUrl } from '../config';
import { sanitizeAvatarForUrl } from '../utils/avatarImage';

type EventCallback = (data: any) => void;

interface WsMessageEnvelope<T = any> {
  event: string;
  requestId?: string;
  payload: T;
  timestamp: number;
}

export class SocketService {
  private ws: WebSocket | null = null;
  private currentUrl: string = '';
  private presenceWs: WebSocket | null = null;
  private presenceUrl: string = '';
  private presenceReconnectTimer: any = null;
  private presencePingInterval: any = null;
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
      (this.presenceWs.readyState === WebSocket.OPEN || this.presenceWs.readyState === WebSocket.CONNECTING) &&
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
      this.presenceWs = new WebSocket(url);

      this.presenceWs.onopen = () => {
        if (this.presencePingInterval) clearInterval(this.presencePingInterval);
        this.presencePingInterval = setInterval(() => {
          if (this.presenceWs && this.presenceWs.readyState === WebSocket.OPEN) {
            this.presenceWs.send(
              JSON.stringify({
                event: 'presence:ping',
                payload: {
                  inRoom: Boolean(this.lastSessionContext.roomCode),
                  currentRoomCode: this.lastSessionContext.roomCode,
                },
                timestamp: Date.now(),
              })
            );
          }
        }, 20000);
      };

      this.presenceWs.onmessage = (event: MessageEvent) => {
        this.handleIncomingMessage(event.data);
      };

      this.presenceWs.onclose = () => {
        if (this.presencePingInterval) {
          clearInterval(this.presencePingInterval);
          this.presencePingInterval = null;
        }
        if (!this.isManuallyClosed && this.presenceUrl) {
          clearTimeout(this.presenceReconnectTimer);
          this.presenceReconnectTimer = setTimeout(() => {
            if (!this.isManuallyClosed && this.presenceUrl) {
              this.initPresenceWebSocket(this.presenceUrl);
            }
          }, 3500);
        }
      };
    } catch {}
  }

  private closePresenceInternal(): void {
    if (this.presencePingInterval) {
      clearInterval(this.presencePingInterval);
      this.presencePingInterval = null;
    }
    clearTimeout(this.presenceReconnectTimer);
    if (this.presenceWs) {
      try {
        this.presenceWs.close();
      } catch {}
      this.presenceWs = null;
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

  /** Safe player query: token when authenticated, tiny avatar seed otherwise. */
  private buildPlayerQuery(playerId: string, displayName: string, avatarUrl?: string): string {
    const base = `playerId=${encodeURIComponent(playerId)}&displayName=${encodeURIComponent(displayName)}`;
    if (this.authToken) {
      return `${base}&token=${encodeURIComponent(this.authToken)}`;
    }
    return `${base}&avatarUrl=${encodeURIComponent(sanitizeAvatarForUrl(avatarUrl))}`;
  }

  public isConnected(): boolean {
    return !!(this.ws && this.ws.readyState === (typeof WebSocket !== 'undefined' ? WebSocket.OPEN : 1));
  }

  public connect(url?: string): any {
    this.isManuallyClosed = false;
    const targetUrl = url || getRealtimeWsUrl('/ws');

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      if (this.currentUrl === targetUrl) {
        return this.getSocket();
      }
      // Re-targeting to different URL (e.g. from matchmaking to room)
      this.closeInternal();
    }

    this.currentUrl = targetUrl;
    this.initWebSocket(targetUrl);
    return this.getSocket();
  }

  private initWebSocket(url: string): void {
    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.startPingInterval();
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

      this.ws.onmessage = (event: MessageEvent) => {
        this.handleIncomingMessage(event.data);
      };

      this.ws.onerror = (error: any) => {
        this.emitLocal('error', error);
      };

      this.ws.onclose = (event: CloseEvent) => {
        this.stopPingInterval();
        this.emitLocal('disconnect', { reason: event.reason, code: event.code });

        if (!this.isManuallyClosed && this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 8000);
          this.reconnectAttempts += 1;
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = setTimeout(() => {
            if (!this.isManuallyClosed && this.currentUrl) {
              this.initWebSocket(this.currentUrl);
            }
          }, delay);
        }
      };
    } catch (err: any) {
      console.warn('[SocketService] WebSocket connection failed:', err);
    }
  }

  private handleIncomingMessage(raw: any): void {
    try {
      const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
      const parsed: WsMessageEnvelope = JSON.parse(text);

      if (!parsed || typeof parsed.event !== 'string') return;

      const event = parsed.event;
      let payload = parsed.payload;

      // Update local presence cache from Cloudflare WebSocket
      if (event === 'presence:snapshot' && payload && Array.isArray(payload.presences)) {
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
        } catch (e) {
          console.error(`[SocketService] Error in listener for event ${event}:`, e);
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
      // If connecting, wait briefly
      const checkAndSend = setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          clearInterval(checkAndSend);
          this.ws.send(message);
        } else if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
          clearInterval(checkAndSend);
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
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
  }

  public disconnect(): void {
    this.isManuallyClosed = true;
    this.closeInternal();
    this.closePresenceInternal();
    this.currentUrl = '';
    this.presenceUrl = '';
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
      if (settings.categories && settings.categories.length > 0) queryParts.push(`category=${settings.categories[0]}`);
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

  public joinRoom(roomCode: string, playerId: string, displayName: string, avatarUrl?: string): void {
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

    const targetUrl = getRealtimeWsUrl(
      `/ws/room/${cleanCode}?roomCode=${cleanCode}&${this.buildPlayerQuery(playerId, displayName, avatarUrl)}`
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
    }
  }

  public toggleReady(roomCode: string, playerId: string): void {
    this.sendEnvelope(SOCKET_EVENTS.TOGGLE_READY, { roomCode, playerId });
  }

  public startGame(roomCode: string, playerId: string): void {
    this.sendEnvelope(SOCKET_EVENTS.START_GAME, { roomCode, playerId });
  }

  public submitAnswer(roomCode: string, playerId: string, selectedOptionId: string): void {
    this.sendEnvelope(SOCKET_EVENTS.SUBMIT_ANSWER, {
      roomCode,
      playerId,
      selectedOptionId,
      clientTimestamp: Date.now(),
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

    const targetUrl = getRealtimeWsUrl(
      `/ws/matchmaking?intent=matchmaking&${this.buildPlayerQuery(playerId, displayName, avatarUrl)}&mode=${mode}&category=${category}&difficulty=${difficulty}`
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
