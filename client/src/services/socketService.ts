import { Platform } from 'react-native';
import {
  SOCKET_EVENTS,
  ClientQuestion,
  RoundResult,
  FinalMatchSummary,
  GameRoom,
} from '@trivia/shared';
import { getRealtimeWsUrl } from '../config';

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
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectTimer: any = null;
  private pingInterval: any = null;
  private isManuallyClosed: boolean = false;

  // Track session details for automatic recovery
  private lastSessionContext: {
    roomCode?: string;
    playerId?: string;
    displayName?: string;
    avatarUrl?: string;
    isMatchmaking?: boolean;
    token?: string;
  } = {};

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

  private sendEnvelope(event: string, payload: any = {}): void {
    const envelope: WsMessageEnvelope = {
      event,
      requestId: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      payload,
      timestamp: Date.now(),
    };

    const message = JSON.stringify(envelope);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(message);
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
    this.currentUrl = '';
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
  public joinRoom(roomCode: string, playerId: string, displayName: string, avatarUrl?: string): void {
    const cleanCode = roomCode.trim().toUpperCase();
    this.lastSessionContext = {
      roomCode: cleanCode,
      playerId,
      displayName,
      avatarUrl,
      isMatchmaking: false,
    };

    const targetUrl = getRealtimeWsUrl(
      `/ws/room/${cleanCode}?roomCode=${cleanCode}&playerId=${encodeURIComponent(playerId)}&displayName=${encodeURIComponent(displayName)}&avatarUrl=${encodeURIComponent(avatarUrl || 'av1')}`
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
      `/ws/matchmaking?intent=matchmaking&playerId=${encodeURIComponent(playerId)}&displayName=${encodeURIComponent(displayName)}&avatarUrl=${encodeURIComponent(avatarUrl || 'av1')}&mode=${mode}&category=${category}&difficulty=${difficulty}`
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

  public sendEmote(roomCode: string, playerId: string, emote: string): void {
    this.sendEnvelope(SOCKET_EVENTS.SEND_EMOTE, { roomCode, playerId, emote });
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
