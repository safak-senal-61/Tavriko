import { io, Socket } from 'socket.io-client';
import { Platform } from 'react-native';
import { SOCKET_EVENTS, ClientQuestion, RoundResult, FinalMatchSummary, GameRoom } from '@trivia/shared';
import { getSocketBaseUrl } from '../config';

export class SocketService {
  private socket: Socket | null = null;
  private serverUrl: string = getSocketBaseUrl();
  public connect(url?: string): Socket {
    if (url) this.serverUrl = url;
    if (this.socket && this.socket.connected) {
      return this.socket;
    }
    this.socket = io(this.serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    return this.socket;
  }
  public getSocket(): Socket | null {
    return this.socket;
  }
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
  public joinRoom(roomCode: string, playerId: string, displayName: string, avatarUrl?: string): void {
    this.socket?.emit(SOCKET_EVENTS.JOIN_ROOM, { roomCode, playerId, displayName, avatarUrl });
  }
  public toggleReady(roomCode: string, playerId: string): void {
    this.socket?.emit(SOCKET_EVENTS.TOGGLE_READY, { roomCode, playerId });
  }
  public startGame(roomCode: string, playerId: string): void {
    this.socket?.emit(SOCKET_EVENTS.START_GAME, { roomCode, playerId });
  }
  public submitAnswer(roomCode: string, playerId: string, selectedOptionId: string): void {
    this.socket?.emit(SOCKET_EVENTS.SUBMIT_ANSWER, {
      roomCode,
      playerId,
      selectedOptionId,
      clientTimestamp: Date.now(),
    });
  }
  public findMatch(playerId: string, displayName: string, avatarUrl?: string, mode?: any, category?: any): void {
    this.socket?.emit(SOCKET_EVENTS.FIND_MATCH, {
      playerId,
      displayName,
      avatarUrl,
      mode,
      category,
    });
  }
  public cancelMatch(playerId: string): void {
    this.socket?.emit(SOCKET_EVENTS.CANCEL_MATCH, { playerId });
  }
  public sendEmote(roomCode: string, playerId: string, emote: string): void {
    this.socket?.emit(SOCKET_EVENTS.SEND_EMOTE, { roomCode, playerId, emote });
  }
  // Listener subscriptions
  public onStateSync(callback: (room: GameRoom) => void): () => void {
    this.socket?.on(SOCKET_EVENTS.ROOM_STATE_SYNC, callback);
    return () => this.socket?.off(SOCKET_EVENTS.ROOM_STATE_SYNC, callback);
  }
  public onQuestionStart(callback: (question: ClientQuestion) => void): () => void {
    this.socket?.on(SOCKET_EVENTS.QUESTION_START, callback);
    return () => this.socket?.off(SOCKET_EVENTS.QUESTION_START, callback);
  }
  public onRoundResult(callback: (result: RoundResult) => void): () => void {
    this.socket?.on(SOCKET_EVENTS.ROUND_RESULT, callback);
    return () => this.socket?.off(SOCKET_EVENTS.ROUND_RESULT, callback);
  }
  public onGameOver(callback: (summary: FinalMatchSummary) => void): () => void {
    this.socket?.on(SOCKET_EVENTS.GAME_OVER, callback);
    return () => this.socket?.off(SOCKET_EVENTS.GAME_OVER, callback);
  }
  public onMatchFound(callback: (data: { roomCode: string; opponent?: any }) => void): () => void {
    this.socket?.on(SOCKET_EVENTS.MATCH_FOUND, callback);
    return () => this.socket?.off(SOCKET_EVENTS.MATCH_FOUND, callback);
  }
  public onPlayerAnswered(callback: (data: { playerId: string; streak?: number }) => void): () => void {
    this.socket?.on(SOCKET_EVENTS.PLAYER_ANSWERED, callback);
    return () => this.socket?.off(SOCKET_EVENTS.PLAYER_ANSWERED, callback);
  }
}
export const socketService = new SocketService();