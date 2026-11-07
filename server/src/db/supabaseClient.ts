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
    const key =
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

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
        .eq('review_status', 'published');

      if (categoryId !== 'mixed') {
        query = query.eq('category_id', categoryId);
      }
      if (difficulty) {
        query = query.eq('difficulty', difficulty);
      }

      const { data, error } = await query.limit(limit);
      if (!error && data && data.length > 0) {
        return data.map((row: any) => ({
          id: row.id,
          categoryId: row.category_id,
          subCategory: row.sub_category,
          difficulty: row.difficulty,
          text: row.text,
          options: row.options,
          correctOptionId: row.correct_option_id,
          explanation: row.explanation,
          sourceOrVerification: row.source_or_verification,
          language: row.language,
          contentHash: row.content_hash,
          reviewStatus: row.review_status,
          timeLimitSec: row.time_limit_sec,
          createdAt: row.created_at,
          reviewedBy: row.reviewed_by,
          reviewedAt: row.reviewed_at,
          rejectionReason: row.rejection_reason,
          modelMetadata: row.model_metadata,
        }));
      }

      // Fallback to Supabase Cloud Storage questions_store.json
      const cloudQuestions = await this.loadCloudStore<Question[]>('questions_store.json');
      if (cloudQuestions && Array.isArray(cloudQuestions)) {
        return cloudQuestions
          .filter(
            (q) =>
              (q.reviewStatus || 'published') === 'published' &&
              (categoryId === 'mixed' || q.categoryId === categoryId) &&
              (!difficulty || q.difficulty === difficulty)
          )
          .slice(0, limit);
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
        category_id: q.categoryId,
        sub_category: q.subCategory,
        difficulty: q.difficulty,
        text: q.text,
        options: q.options,
        correct_option_id: q.correctOptionId,
        explanation: q.explanation,
        source_or_verification: q.sourceOrVerification,
        language: q.language || 'tr',
        content_hash: q.contentHash,
        review_status: q.reviewStatus || 'pending_review',
        time_limit_sec: q.timeLimitSec || 15,
        model_metadata: q.modelMetadata,
        created_at: q.createdAt,
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
          review_status: status,
          reviewed_by: reviewedBy,
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason || null,
        })
        .eq('id', id);

      if (!error) {
        await this.client.from('review_history').insert({
          question_id: id,
          action: status === 'published' ? 'approve' : 'reject',
          reviewed_by: reviewedBy,
          rejection_reason: reason || null,
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  public async upsertUser(record: any, allUsersList?: any[]): Promise<boolean> {
    if (!this.client) return false;
    try {
      // 1. Try PostgreSQL profiles table if created
      const { error } = await this.client.from('profiles').upsert({
        id: record.id,
        username: record.username,
        display_name: record.displayName,
        email: record.email || null,
        full_name: record.fullName || null,
        country_code: record.countryCode || null,
        country_name: record.countryName || null,
        phone: record.phone || null,
        birth_date: record.birthDate || null,
        gender: record.gender || null,
        bio: record.bio || null,
        avatar_url: record.avatarUrl,
        password_hash: record.passwordHash || null,
        level: record.level,
        xp: record.xp,
        coins: record.coins,
        gems: record.gems ?? 14,
        rank_title: record.rankTitle,
        rank_points: record.rankPoints,
        stats: record.stats,
        updated_at: new Date().toISOString(),
      });

      // 2. Sync to Supabase Auth Admin user_metadata if user has email
      if (record.email) {
        try {
          const { data: listData } = await this.client.auth.admin.listUsers();
          const existingAuthUser = listData?.users?.find(
            (u) => u.email?.toLowerCase() === record.email.toLowerCase()
          );
          const metadata = {
            tavriko_id: record.id,
            username: record.username,
            displayName: record.displayName,
            fullName: record.fullName,
            countryCode: record.countryCode,
            countryName: record.countryName,
            phone: record.phone,
            birthDate: record.birthDate,
            gender: record.gender,
            bio: record.bio,
            avatarUrl: record.avatarUrl,
            level: record.level,
            xp: record.xp,
            coins: record.coins,
            gems: record.gems,
            rankTitle: record.rankTitle,
            rankPoints: record.rankPoints,
            stats: record.stats,
          };

          if (existingAuthUser) {
            await this.client.auth.admin.updateUserById(existingAuthUser.id, {
              user_metadata: metadata,
            });
          } else {
            await this.client.auth.admin.createUser({
              email: record.email,
              email_confirm: true,
              user_metadata: metadata,
            });
          }
        } catch {
          // Ignore auth admin errors
        }
      }

      // 3. Also sync full users list to Supabase Cloud Storage
      if (allUsersList) {
        await this.syncCloudStore('users_store.json', allUsersList);
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
        .from('profiles')
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
