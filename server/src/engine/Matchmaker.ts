import { GameMode, CategoryId, DifficultyLevel } from '@trivia/shared';
import { GameRoomManager } from './GameRoomManager';

export interface MatchmakingRequest {
  socketId: string;
  playerId: string;
  displayName: string;
  avatarUrl?: string;
  mode: GameMode;
  category?: CategoryId;
  difficulty?: DifficultyLevel;
  rating?: number;
  queuedAt: number;
}

export class Matchmaker {
  private queue: MatchmakingRequest[] = [];
  private manager: GameRoomManager;
  private intervalId?: NodeJS.Timeout;
  public onMatchFound?: (roomCode: string, players: MatchmakingRequest[]) => void;

  constructor(manager: GameRoomManager) {
    this.manager = manager;
    this.startLoop();
  }

  public enqueue(req: MatchmakingRequest): void {
    // Remove if already in queue
    this.dequeue(req.playerId);
    this.queue.push(req);
    this.checkMatches();
  }

  public dequeue(playerId: string): void {
    this.queue = this.queue.filter((r) => r.playerId !== playerId);
  }

  private startLoop(): void {
    this.intervalId = setInterval(() => {
      this.checkMatches();
    }, 2000);
  }

  public checkMatches(): void {
    if (this.queue.length < 2) return;

    // For simplicity and speed: pair up any 2 waiting players or group by mode
    const p1 = this.queue.shift();
    const p2 = this.queue.shift();

    if (p1 && p2) {
      const mode = p1.mode || 'quick_match';
      const category = p1.category || 'mixed';
      const difficulty = p1.difficulty || 'medium';

      const room = this.manager.createRoom({
        hostId: p1.playerId,
        hostName: p1.displayName,
        avatarUrl: p1.avatarUrl,
        mode,
        category,
        difficulty,
        totalRounds: 7,
      });

      this.manager.joinRoom(room.code, {
        playerId: p2.playerId,
        displayName: p2.displayName,
        avatarUrl: p2.avatarUrl,
      });

      if (this.onMatchFound) {
        this.onMatchFound(room.code, [p1, p2]);
      }
    }
  }

  public destroy(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    this.queue = [];
  }
}
