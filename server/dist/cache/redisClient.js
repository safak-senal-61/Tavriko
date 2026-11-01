"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheService = void 0;
const redis_1 = require("@upstash/redis");
class UpstashRedisService {
    client = null;
    // In-memory fallback map if Upstash is offline or not configured
    memExpiry = new Map();
    memLocks = new Set();
    memSeen = new Map();
    memCustom = new Map();
    usingFallback = true;
    constructor() {
        const rawUrl = process.env.UPSTASH_REDIS_REST_URL;
        const rawToken = process.env.UPSTASH_REDIS_REST_TOKEN;
        const url = rawUrl ? rawUrl.trim().replace(/^["']|["']$/g, '') : undefined;
        const token = rawToken ? rawToken.trim().replace(/^["']|["']$/g, '') : undefined;
        if (url && token && !url.includes('placeholder') && !url.includes('your-') && !token.includes('your_')) {
            try {
                this.client = new redis_1.Redis({ url, token });
                this.usingFallback = false;
                console.log('[Upstash Redis] REST bağlantısı başarıyla yapılandırıldı.');
            }
            catch (err) {
                console.warn('[Upstash Redis] Bağlantı kurulum hatası, fallback hafıza modu aktif:', err.message);
                this.usingFallback = true;
            }
        }
        else {
            console.log('[Upstash Redis] UPSTASH_REDIS_REST_URL / TOKEN tanımlanmadı; yüksek hızlı bellek içi simülasyon aktif.');
            this.usingFallback = true;
        }
    }
    isAvailable() {
        return !this.usingFallback && this.client !== null;
    }
    async setQuestionExpiry(sessionId, questionId, expiresAtMs, ttlSec = 60) {
        const key = `expiry:${sessionId}:${questionId}`;
        if (this.client) {
            try {
                await this.client.set(key, expiresAtMs, { ex: ttlSec });
                return;
            }
            catch (err) {
                console.warn('[Upstash Redis] setQuestionExpiry fallback devrede:', err.message);
            }
        }
        this.memExpiry.set(key, expiresAtMs);
        setTimeout(() => this.memExpiry.delete(key), ttlSec * 1000);
    }
    async getQuestionExpiry(sessionId, questionId) {
        const key = `expiry:${sessionId}:${questionId}`;
        if (this.client) {
            try {
                const val = await this.client.get(key);
                if (val !== null && val !== undefined)
                    return Number(val);
            }
            catch (err) {
                console.warn('[Upstash Redis] getQuestionExpiry fallback devrede:', err.message);
            }
        }
        return this.memExpiry.get(key) || null;
    }
    /**
     * Atomic lock: returns TRUE if lock was acquired (first attempt).
     * Returns FALSE if already answered/locked (reject duplicate or race conditions).
     */
    async acquireAnswerLock(sessionId, questionId, playerId) {
        const key = `lock:ans:${sessionId}:${questionId}:${playerId}`;
        if (this.client) {
            try {
                // SET key value NX EX 45
                const res = await this.client.set(key, '1', { nx: true, ex: 45 });
                return res === 'OK';
            }
            catch (err) {
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
    async recordSeenQuestion(playerId, categoryId, questionId) {
        const key = `seen:${playerId}:${categoryId}`;
        if (this.client) {
            try {
                await this.client.sadd(key, questionId);
                await this.client.expire(key, 86400); // 24 saat TTL
                return;
            }
            catch (err) {
                console.warn('[Upstash Redis] recordSeenQuestion fallback devrede:', err.message);
            }
        }
        if (!this.memSeen.has(key)) {
            this.memSeen.set(key, new Set());
        }
        this.memSeen.get(key).add(questionId);
    }
    async getSeenQuestions(playerId, categoryId) {
        const key = `seen:${playerId}:${categoryId}`;
        if (this.client) {
            try {
                const members = await this.client.smembers(key);
                if (Array.isArray(members))
                    return members;
            }
            catch (err) {
                console.warn('[Upstash Redis] getSeenQuestions fallback devrede:', err.message);
            }
        }
        const set = this.memSeen.get(key);
        return set ? Array.from(set) : [];
    }
    async getCustomValue(key) {
        if (this.client) {
            try {
                const val = await this.client.get(key);
                if (val !== null && val !== undefined)
                    return val;
            }
            catch (err) {
                console.warn('[Upstash Redis] getCustomValue fallback devrede:', err.message);
            }
        }
        const val = this.memCustom.get(key);
        return val !== undefined ? val : null;
    }
    async setCustomValue(key, value, ttlSec) {
        if (this.client) {
            try {
                if (ttlSec && ttlSec > 0) {
                    await this.client.set(key, value, { ex: ttlSec });
                }
                else {
                    await this.client.set(key, value);
                }
                return;
            }
            catch (err) {
                console.warn('[Upstash Redis] setCustomValue fallback devrede:', err.message);
            }
        }
        this.memCustom.set(key, value);
        if (ttlSec && ttlSec > 0) {
            setTimeout(() => this.memCustom.delete(key), ttlSec * 1000);
        }
    }
}
exports.cacheService = new UpstashRedisService();
