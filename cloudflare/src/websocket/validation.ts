export function sanitizeString(val: unknown, maxLength: number = 50): string {
  if (typeof val !== 'string') return '';
  return val
    .trim()
    .replace(/[<>]/g, '')
    .slice(0, maxLength);
}

export function sanitizeRoomCode(val: unknown): string {
  if (typeof val !== 'string') return '';
  return val
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 16);
}

export function isValidPlayerId(id: unknown): boolean {
  if (typeof id !== 'string') return false;
  const trimmed = id.trim();
  return trimmed.length >= 3 && trimmed.length <= 64;
}

export class RateLimiter {
  private timestamps: number[] = [];
  private maxPerWindow: number;
  private windowMs: number;

  constructor(maxPerWindow: number = 15, windowMs: number = 1000) {
    this.maxPerWindow = maxPerWindow;
    this.windowMs = windowMs;
  }

  public check(): boolean {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);
    if (this.timestamps.length >= this.maxPerWindow) {
      return false; // Rate limit exceeded
    }
    this.timestamps.push(now);
    return true;
  }
}
