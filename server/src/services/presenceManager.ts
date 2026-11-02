import { EventEmitter } from 'events';

export interface UserPresence {
  userId: string;
  online: boolean;
  inRoom: boolean;
  currentRoomCode?: string;
  status: string;
  lastSeen: number;
}

export class PresenceManager extends EventEmitter {
  private static instance: PresenceManager;

  // Map of userId -> Set of active socket connections (can be WebSocket or Socket.IO)
  private userSockets: Map<string, Set<any>> = new Map();
  // Map of userId -> current room code if inside a multiplayer room
  private userRooms: Map<string, string> = new Map();
  // Map of userId -> last active timestamp
  private userLastSeen: Map<string, number> = new Map();

  private constructor() {
    super();
  }

  public static getInstance(): PresenceManager {
    if (!PresenceManager.instance) {
      PresenceManager.instance = new PresenceManager();
    }
    return PresenceManager.instance;
  }

  public registerSocket(userId: string, socket: any): void {
    if (!userId) return;

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    const sockets = this.userSockets.get(userId)!;
    const wasOffline = sockets.size === 0;
    sockets.add(socket);
    this.userLastSeen.set(userId, Date.now());

    if (wasOffline) {
      const presence = this.getUserPresence(userId);
      this.broadcast('user:online', { userId, presence });
      this.broadcast('presence:update', presence);
    }
  }

  public unregisterSocket(userId: string, socket: any): void {
    if (!userId) return;

    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(socket);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
        this.userRooms.delete(userId);
        this.userLastSeen.set(userId, 0);

        const presence: UserPresence = {
          userId,
          online: false,
          inRoom: false,
          status: 'Çevrimdışı',
          lastSeen: 0,
        };
        this.broadcast('user:offline', { userId, presence });
        this.broadcast('presence:update', presence);
      }
    }
  }

  public setUserRoom(userId: string, roomCode: string | null): void {
    if (!userId) return;

    if (roomCode) {
      this.userRooms.set(userId, roomCode);
    } else {
      this.userRooms.delete(userId);
    }
    this.userLastSeen.set(userId, Date.now());

    const presence = this.getUserPresence(userId);
    this.broadcast('presence:update', presence);
  }

  public getUserRoom(userId: string): string | undefined {
    return this.userRooms.get(userId);
  }

  public isOnline(userId: string): boolean {
    const sockets = this.userSockets.get(userId);
    if (sockets && sockets.size > 0) return true;

    // Check recent heartbeat within last 45 seconds (only if lastSeen > 0)
    const lastSeen = this.userLastSeen.get(userId) || 0;
    return lastSeen > 0 && Date.now() - lastSeen < 45000;
  }

  public touchUser(userId: string): void {
    if (!userId) return;
    const wasOffline = !this.isOnline(userId);
    this.userLastSeen.set(userId, Date.now());

    if (wasOffline) {
      const presence = this.getUserPresence(userId);
      this.broadcast('user:online', { userId, presence });
      this.broadcast('presence:update', presence);
    }
  }

  public getUserPresence(userId: string): UserPresence {
    const online = this.isOnline(userId);
    const roomCode = this.userRooms.get(userId);
    const inRoom = !!roomCode;

    let status = 'Çevrimdışı';
    if (inRoom && roomCode) {
      status = `Oda: #${roomCode} · Lobide`;
    } else if (online) {
      status = 'Çevrimiçi';
    }

    return {
      userId,
      online,
      inRoom,
      currentRoomCode: roomCode || undefined,
      status,
      lastSeen: this.userLastSeen.get(userId) || Date.now(),
    };
  }

  public getAllPresences(): Record<string, UserPresence> {
    const presences: Record<string, UserPresence> = {};
    for (const userId of this.userSockets.keys()) {
      presences[userId] = this.getUserPresence(userId);
    }
    return presences;
  }

  /**
   * Broadcast message to ALL connected WebSocket/Socket.IO clients
   */
  public broadcast(event: string, payload: any): void {
    const message = JSON.stringify({ event, payload, timestamp: Date.now() });

    for (const [userId, sockets] of this.userSockets.entries()) {
      for (const socket of sockets) {
        try {
          if (typeof socket.send === 'function' && socket.readyState === 1) {
            // Standard WebSocket (readyState OPEN = 1)
            socket.send(message);
          } else if (typeof socket.emit === 'function') {
            // Socket.IO
            socket.emit(event, payload);
          }
        } catch (err) {
          // Socket might have closed
        }
      }
    }
  }

  /**
   * Send notification or event to a specific user's connected devices
   */
  public notifyUser(userId: string, event: string, payload: any): boolean {
    const sockets = this.userSockets.get(userId);
    if (!sockets || sockets.size === 0) return false;

    const message = JSON.stringify({ event, payload, timestamp: Date.now() });
    let delivered = false;

    for (const socket of sockets) {
      try {
        if (typeof socket.send === 'function' && socket.readyState === 1) {
          socket.send(message);
          delivered = true;
        } else if (typeof socket.emit === 'function') {
          socket.emit(event, payload);
          delivered = true;
        }
      } catch (err) {
        // Socket closed
      }
    }
    return delivered;
  }
}

export const presenceManager = PresenceManager.getInstance();
