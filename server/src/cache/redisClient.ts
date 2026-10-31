import { Redis } from '@upstash/redis';

export interface CacheService {
  setQuestionExpiry(sessionId: string, questionId: string, expiresAtMs: number, ttlSec?: number): Promise<void>;
  getQuestionExpiry(sessionId: string, questionId: string): Promise<number | null>;
  acquireAnswerLock(sessionId: string, questionId: string, playerId: string): Promise<boolean>;
  recordSeenQuestion(playerId: string, categoryId: string, questionId: string): Promise<void>;
  getSeenQuestions(playerId: string, categoryId: string): Promise<string[]>;
  isAvailable(): boolean;
}

class UpstashRedisService implements CacheService {
  private client: Redis | null = null;
  // In-memory fallback map if Upstash is offline or not configured
  private memExpiry: Map<string, number> = new Map();
  private memLocks: Set<string> = new Set();
  private memSeen: Map<string, Set<string>> = new Map();
  private usingFallback: boolean = true;

  constructor() {
    const rawUrl = process.env.UPSTASH_REDIS_REST_URL;
    const rawToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    const url = rawUrl ? rawUrl.trim().replace(/^["']|["']$/g, '') : undefined;
    const token = rawToken ? rawToken.trim().replace(/^["']|["']$/g, '') : undefined;

    if (url && token && !url.includes('placeholder') && !url.includes('your-') && !token.includes('your_')) {
      try {
        this.client = new Redis({ url, token });
        this.usingFallback = false;
        console.log('[Upstash Redis] REST bağlantısı başarıyla yapılandırıldı.');
      } catch (err: any) {
        console.warn('[Upstash Redis] Bağlantı kurulum hatası, fallback hafıza modu aktif:', err.message);
        this.usingFallback = true;
      }
    } else {
      console.log('[Upstash Redis] UPSTASH_REDIS_REST_URL / TOKEN tanımlanmadı; yüksek hızlı bellek içi simülasyon aktif.');
      this.usingFallback = true;
    }
  }

  public isAvailable(): boolean {
    return !this.usingFallback && this.client !== null;
  }

  public async setQuestionExpiry(sessionId: string, questionId: string, expiresAtMs: number, ttlSec: number = 60): Promise<void> {
    const key = `expiry:${sessionId}:${questionId}`;
    if (this.client) {
      try {
        await this.client.set(key, expiresAtMs, { ex: ttlSec });
        return;
      } catch (err: any) {
        console.warn('[Upstash Redis] setQuestionExpiry fallback devrede:', err.message);
      }
    }
    this.memExpiry.set(key, expiresAtMs);
    setTimeout(() => this.memExpiry.delete(key), ttlSec * 1000);
  }

  public async getQuestionExpiry(sessionId: string, questionId: string): Promise<number | null> {
    const key = `expiry:${sessionId}:${questionId}`;
    if (this.client) {
      try {
        const val = await this.client.get<number>(key);
        if (val !== null && val !== undefined) return Number(val);
      } catch (err: any) {
        console.warn('[Upstash Redis] getQuestionExpiry fallback devrede:', err.message);
      }
    }
    return this.memExpiry.get(key) || null;
  }

  /**
   * Atomic lock: returns TRUE if lock was acquired (first attempt).
   * Returns FALSE if already answered/locked (reject duplicate or race conditions).
   */
  public async acquireAnswerLock(sessionId: string, questionId: string, playerId: string): Promise<boolean> {
    const key = `lock:ans:${sessionId}:${questionId}:${playerId}`;
    if (this.client) {
      try {
        // SET key value NX EX 45
        const res = await this.client.set(key, '1', { nx: true, ex: 45 });
        return res === 'OK';
      } catch (err: any) {
        console.warn('[Upstash Redis] acquireAnswerLock fallback devrede:', err.message);
      }
    }

    if (this.memLocks.has(key)) {
      return false; // Already locked
    }
    this.memLocks.add(key);
    setTimeout(() => this.memLocks.delete(key), 45000);
    return true;
  }

  public async recordSeenQuestion(playerId: string, categoryId: string, questionId: string): Promise<void> {
    const key = `seen:${playerId}:${categoryId}`;
    if (this.client) {
      try {
        await this.client.sadd(key, questionId);
        await this.client.expire(key, 86400); // 24 saat TTL
        return;
      } catch (err: any) {
        console.warn('[Upstash Redis] recordSeenQuestion fallback devrede:', err.message);
      }
    }

    if (!this.memSeen.has(key)) {
      this.memSeen.set(key, new Set());
    }
    this.memSeen.get(key)!.add(questionId);
  }

  public async getSeenQuestions(playerId: string, categoryId: string): Promise<string[]> {
    const key = `seen:${playerId}:${categoryId}`;
    if (this.client) {
      try {
        const members = await this.client.smembers(key);
        if (Array.isArray(members)) return members;
      } catch (err: any) {
        console.warn('[Upstash Redis] getSeenQuestions fallback devrede:', err.message);
      }
    }

    const set = this.memSeen.get(key);
    return set ? Array.from(set) : [];
  }
}

export const cacheService = new UpstashRedisService();
