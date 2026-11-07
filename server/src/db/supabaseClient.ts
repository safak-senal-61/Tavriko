import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Question, ReviewStatus } from '@trivia/shared';

export interface SupabaseHealth {
  configured: boolean;
  connected: boolean;
  message: string;
}

const CLOUD_BUCKET = 'tavriko-db';

export class SupabaseService {
  private client: SupabaseClient | null = null;
  private isConfigured: boolean = false;
  private bucketReady: boolean = false;
  private bucketInitPromise: Promise<boolean> | null = null;

  constructor() {
    const url =
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.EXPO_PUBLIC_SUPABASE_URL;
    // Server-side Supabase operations require the secret/service-role key.
    // Never silently fall back to a browser publishable key for admin calls. 
    const key = process.env.SUPABASE_SECRET_KEY;

    if (url && key && !url.includes('placeholder') && !url.includes('your-') && !key.includes('your-')) {
      try {
        this.client = createClient(url, key, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        });
        this.isConfigured = true;
        console.log(`[Supabase] Supabase (${url}) ve Auth/Storage servisi başarıyla yapılandırıldı.`);
      } catch (err: any) {
        console.warn('[Supabase] İstemci başlatılırken hata oluştu, fallback bellek modu devrede:', err.message);
        this.isConfigured = false;
      }
    } else {
      console.log('[Supabase] SUPABASE_URL / SUPABASE_SECRET_KEY tanımlanmadı; yerel veritabanı simülasyon modu devrede.');
      this.isConfigured = false;
    }
  }

  public getClient(): SupabaseClient | null {
    return this.client;
  }

  private async ensureCloudBucket(): Promise<boolean> {
    if (!this.client) return false;
    if (this.bucketReady) return true;
    if (this.bucketInitPromise) return this.bucketInitPromise;
    this.bucketInitPromise = (async () => {
      try {
        const { data: buckets, error: listErr } = await this.client!.storage.listBuckets();
        if (listErr) return false;
        const exists = buckets?.some((b) => b.name === CLOUD_BUCKET);
        if (!exists) {
          await this.client!.storage.createBucket(CLOUD_BUCKET, { public: false });
        }
        this.bucketReady = true;
        return true;
      } catch {
        return false;
      } finally {
        this.bucketInitPromise = null;
      }
    })();
    return this.bucketInitPromise;
  }

  public async checkHealth(): Promise<SupabaseHealth> {
    if (!this.isConfigured || !this.client) {
      return {
        configured: false,
        connected: false,
        message: 'Supabase kimlik bilgileri ortam değişkenlerinde yapılandırılmadı (Yerel DB devrede).',
      };
    }

    try {
      const { data, error } = await this.client.from('categories').select('id').limit(1);
      if (!error) {
        return {
          configured: true,
          connected: true,
          message: 'Supabase PostgreSQL bağlantısı doğrulandı; bu kontrol RLS politikalarını incelemez.',
        };
      }

      // Check Auth + Cloud Storage fallback if SQL tables are not yet migrated
      const bucketOk = await this.ensureCloudBucket();
      if (bucketOk) {
        return {
          configured: true,
          connected: true,
          message: 'Supabase Cloud (rjvbgofzsfescnfohzgu.supabase.co) Auth ve Storage DB senkronizasyonu aktif.',
        };
      }

      return {
        configured: true,
        connected: false,
        message: `Supabase sorgusu başarısız: ${error.message}`,
      };
    } catch (err: any) {
      return {
        configured: true,
        connected: false,
        message: `Bağlantı hatası: ${err.message}`,
      };
    }
  }

  public async syncCloudStore(filename: string, payload: any): Promise<boolean> {
    if (!this.client) return false;
    try {
      await this.ensureCloudBucket();
      const buf = Buffer.from(JSON.stringify(payload, null, 2), 'utf-8');
      const { error } = await this.client.storage
        .from(CLOUD_BUCKET)
        .upload(filename, buf, { upsert: true, contentType: 'application/json' });
      return !error;
    } catch {
      return false;
    }
  }

  public async loadCloudStore<T>(filename: string): Promise<T | null> {
    if (!this.client) return null;
    try {
      await this.ensureCloudBucket();
      const { data, error } = await this.client.storage.from(CLOUD_BUCKET).download(filename);
      if (error || !data) return null;
      const text = await data.text();
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  }

  public async getPublishedQuestions(categoryId: string, difficulty?: string, limit: number = 10): Promise<Question[] | null> {
    if (!this.client) return null;

    try {
      let query = this.client
        .from('questions')
        .select('*')
        .eq('reviewStatus', 'published');

      if (categoryId !== 'mixed') query = query.eq('categoryId', categoryId);
      if (difficulty) query = query.eq('difficulty', difficulty);

      const { data, error } = await query.limit(Math.max(1, Math.min(limit, 50)));
      if (!error && data && data.length > 0) {
        return data.map((row: any) => ({
          id: row.id,
          categoryId: row.categoryId,
          subCategory: row.subCategory,
          difficulty: row.difficulty,
          text: row.text,
          options: row.options,
          correctOptionId: row.correctOptionId,
          explanation: row.explanation,
          sourceOrVerification: row.sourceOrVerification,
          language: row.language,
          contentHash: row.contentHash,
          reviewStatus: row.reviewStatus,
          timeLimitSec: row.timeLimitSec,
          createdAt: row.createdAt,
          reviewedBy: row.reviewedBy,
          reviewedAt: row.reviewedAt,
          rejectionReason: row.rejectionReason,
        }));
      }

      // Legacy private-bucket fallback; it is never exposed to browser clients.
      const cloudQuestions = await this.loadCloudStore<Question[]>('questions_store.json');
      if (cloudQuestions && Array.isArray(cloudQuestions)) {
        return cloudQuestions
          .filter((q) =>
            (q.reviewStatus || 'published') === 'published' &&
            (categoryId === 'mixed' || q.categoryId === categoryId) &&
            (!difficulty || q.difficulty === difficulty)
          )
          .slice(0, Math.max(1, Math.min(limit, 50)));
      }
      return null;
    } catch {
      return null;
    }
  }

  public async insertQuestion(q: Question): Promise<boolean> {
    if (!this.client) return false;
    try {
      const { error } = await this.client.from('questions').insert({
        id: q.id,
        categoryId: q.categoryId,
        subCategory: q.subCategory,
        difficulty: q.difficulty,
        text: q.text,
        options: q.options,
        correctOptionId: q.correctOptionId,
        explanation: q.explanation,
        sourceOrVerification: q.sourceOrVerification,
        language: q.language || 'tr',
        contentHash: q.contentHash,
        reviewStatus: q.reviewStatus || 'pending_review',
        timeLimitSec: q.timeLimitSec || 15,
        createdAt: q.createdAt,
      });
      return !error;
    } catch {
      return false;
    }
  }

  public async updateQuestionStatus(id: string, status: ReviewStatus, reviewedBy: string, reason?: string): Promise<boolean> {
    if (!this.client) return false;
    try {
      const { error } = await this.client
        .from('questions')
        .update({
          reviewStatus: status,
          reviewedBy,
          reviewedAt: new Date().toISOString(),
          rejectionReason: reason || null,
        })
        .eq('id', id);
      return !error;
    } catch {
      return false;
    }
  }

  public async upsertUser(record: any, _allUsersList?: any[]): Promise<boolean> {
    if (!this.client) return false;
    try {
      const stats = record.stats || {};
      const { error } = await this.client.from('users').upsert({
        id: record.id,
        username: record.username,
        email: record.email || null,
        displayName: record.displayName,
        fullName: record.fullName || null,
        countryCode: record.countryCode || null,
        countryName: record.countryName || null,
        phone: record.phone || null,
        birthDate: record.birthDate || null,
        gender: record.gender || null,
        bio: record.bio || null,
        avatarUrl: record.avatarUrl || 'av1',
        passwordHash: record.passwordHash || null,
        googleId: record.googleId || null,
        friendCode: record.friendCode,
        level: record.level ?? 1,
        xp: record.xp ?? 0,
        coins: record.coins ?? 500,
        gems: record.gems ?? 15,
        dailyStreak: record.dailyStreak ?? 1,
        rankTitle: record.rankTitle || 'Acemi Kaşif',
        rankPoints: record.rankPoints ?? 1000,
        totalMatches: stats.totalMatches ?? record.totalMatches ?? 0,
        wins: stats.wins ?? record.wins ?? 0,
        correctAnswers: stats.correctAnswers ?? record.correctAnswers ?? 0,
        totalAnswers: stats.totalAnswers ?? record.totalAnswers ?? 0,
        bestStreak: stats.bestStreak ?? record.bestStreak ?? 0,
        avgResponseTimeMs: stats.avgResponseTimeMs ?? record.avgResponseTimeMs ?? 0,
        categoryMastery: record.categoryMastery || {},
        claimedSeasonTiers: record.claimedSeasonTiers || [1],
        friendIds: record.friendIds || [],
        seasonXp: record.seasonXp ?? 0,
        hasPremiumPass: record.hasPremiumPass ?? false,
        claimedSeasonFreeTiers: record.claimedSeasonFreeTiers || [],
        claimedSeasonPremiumTiers: record.claimedSeasonPremiumTiers || [],
        equippedBackground: record.equippedBackground || null,
        equippedBadge: record.equippedBadge || null,
        equippedFrame: record.equippedFrame || null,
        equippedNameEffect: record.equippedNameEffect || null,
        eventProgress: record.eventProgress || {},
        settings: record.settings || {},
        updatedAt: new Date().toISOString(),
      });

      // Only update metadata for an Auth identity that already exists (e.g. Google).
      // Do not auto-create confirmed Supabase Auth accounts for custom-password users.
      if (record.email) {
        try {
          const { data: listData } = await this.client.auth.admin.listUsers({ perPage: 1000 });
          const existingAuthUser = listData?.users?.find(
            (u) => u.email?.toLowerCase() === record.email.toLowerCase()
          );
          if (existingAuthUser) {
            await this.client.auth.admin.updateUserById(existingAuthUser.id, {
              user_metadata: {
                tavriko_id: record.id,
                username: record.username,
                displayName: record.displayName,
                avatarUrl: record.avatarUrl || 'av1',
              },
            });
          }
        } catch {
          // Auth metadata sync is best-effort; the Tavriko database remains authoritative.
        }
      }

      return !error;
    } catch {
      return false;
    }
  }

  public async findUserByIdentifier(identifier: string): Promise<any | null> {
    if (!this.client) return null;
    try {
      const clean = identifier.trim().toLowerCase();
      const { data, error } = await this.client
        .from('users')
        .select('*')
        .or(`username.eq.${clean},email.eq.${clean}`)
        .limit(1)
        .maybeSingle();
      if (!error && data) return data;

      // Fallback: check Supabase Cloud Storage users_store.json
      const cloudUsers = await this.loadCloudStore<any[]>('users_store.json');
      if (cloudUsers && Array.isArray(cloudUsers)) {
        const found = cloudUsers.find(
          (u) =>
            !u.isGuest &&
            (u.username?.toLowerCase() === clean || u.email?.toLowerCase() === clean)
        );
        if (found) {
          return {
            id: found.id,
            username: found.username,
            email: found.email,
            display_name: found.displayName,
            full_name: found.fullName,
            country_code: found.countryCode,
            country_name: found.countryName,
            phone: found.phone,
            birth_date: found.birthDate,
            gender: found.gender,
            bio: found.bio,
            password_hash: found.passwordHash,
            avatar_url: found.avatarUrl,
            level: found.level,
            xp: found.xp,
            coins: found.coins,
            gems: found.gems,
            rank_title: found.rankTitle,
            rank_points: found.rankPoints,
            stats: found.stats,
          };
        }
      }
      return null;
    } catch {
      return null;
    }
  }
}

export const supabaseService = new SupabaseService();
