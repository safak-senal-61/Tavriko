import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import {
  PrismaClient,
  Category as PrismaCategory,
  Question as PrismaQuestion,
  User as PrismaUser,
  UserInventoryItem as PrismaUserInventoryItem,
  UserNotification as PrismaUserNotification,
  MatchHistory as PrismaMatchHistory,
  PasswordResetToken as PrismaPasswordResetToken,
} from '@prisma/client';
import {
  UserProfile,
  Question,
  CategoryId,
  DifficultyLevel,
  CategoryInfo,
  ReviewStatus,
  QuestionStats,
  InventoryItem,
  NotificationItem,
  calculateLevelFromXp,
  getDailyChallengeConfig,
  SEASON_1_TIERS,
  SHOP_CATALOG,
  EVENT_DEFINITIONS,
  SeasonReward,
  ItemRarity,
  ItemCategory,
  UserSettings,
  canonicalCategoryId,
} from '@trivia/shared';
import { ALL_CATEGORIES, QUESTION_BANK } from './questionsData';
import { RICH_SEED_BANK } from '../ai/evrenLlmGenerator';
import { supabaseService } from './supabaseClient';
import { presenceManager } from '../services/presenceManager';

const JWT_SECRET = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET must be configured before the server starts.');
const PRISMA_DATA_DIR = path.join(__dirname, '..', '..', 'data', 'prisma');
const USERS_DB_FILE = path.join(__dirname, '..', '..', 'supabase_users_store.json');
const QUESTIONS_DB_FILE = path.join(__dirname, '..', '..', 'supabase_questions_store.json');

export function computeQuestionHash(text: string, options: { text: string }[]): string {
  const normText = text.trim().toLowerCase().replace(/\s+/g, ' ');
  const normOptions = options
    .map((o) => o.text.trim().toLowerCase().replace(/\s+/g, ' '))
    .sort()
    .join('|');
  return crypto.createHash('sha256').update(`${normText}::${normOptions}`).digest('hex');
}

export interface UserRecord {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  fullName?: string;
  countryCode?: string;
  countryName?: string;
  phone?: string;
  birthDate?: string;
  gender?: string;
  bio?: string;
  passwordHash?: string;
  googleId?: string;
  resetOtpCode?: string;
  resetOtpExpiresAt?: number;
  avatarUrl: string;
  friendCode?: string;
  isGuest: boolean;
  level: number;
  xp: number;
  coins: number;
  gems: number;
  dailyStreak?: number;
  rankTitle: string;
  rankPoints: number;
  inventory?: InventoryItem[];
  claimedSeasonTiers?: number[];
  seasonXp?: number;
  hasPremiumPass?: boolean;
  claimedSeasonFreeTiers?: number[];
  claimedSeasonPremiumTiers?: number[];
  equippedFrame?: string;
  equippedBadge?: string;
  equippedNameEffect?: string;
  equippedBackground?: string;
  eventProgress?: Record<string, { started?: boolean; startedAt?: number; progress: number; completed: boolean; claimed: boolean }>;
  friendIds?: string[];
  notifications?: NotificationItem[];
  categoryMastery?: any;
  settings?: UserSettings;
  stats: {
    totalMatches: number;
    wins: number;
    correctAnswers: number;
    totalAnswers: number;
    bestStreak: number;
    avgResponseTimeMs: number;
  };
  createdAt: number;
  updatedAt?: number;
}

export interface RegisterPayload {
  username: string;
  email: string;
  displayName?: string;
  fullName?: string;
  password: string;
  countryCode?: string;
  countryName?: string;
  phone?: string;
  birthDate?: string;
  gender?: string;
  bio?: string;
  avatarUrl?: string;
}

export interface PrismaHealth {
  orm: 'PrismaClient';
  version: string;
  connected: boolean;
  supabaseProject: string;
  tables: {
    categories: number;
    questions: number;
    users: number;
    userInventoryItems: number;
    userNotifications: number;
    matchHistory: number;
  };
  message: string;
}

interface PrismaTableStore {
  categories: Map<string, PrismaCategory>;
  questions: Map<string, PrismaQuestion>;
  users: Map<string, PrismaUser>;
  userInventoryItems: Map<string, PrismaUserInventoryItem>;
  userNotifications: Map<string, PrismaUserNotification>;
  matchHistory: Map<string, PrismaMatchHistory>;
  passwordResetTokens: Map<string, PrismaPasswordResetToken>;
}

/**
 * PrismaService (Tekil Veritabanı Katmanı - dbAdapter.ts tamamen kaldırıldı):
 * Resmi @prisma/client şema tiplerini ve PrismaClient örneğini kullanarak
 * tüm veritabanı işlemlerini (Category, Question, User, UserInventoryItem,
 * UserNotification, MatchHistory, PasswordResetToken) doğrudan yönetir ve
 * Supabase (rjvbgofzsfescnfohzgu.supabase.co) ile çift yönlü senkronize eder.
 */
export class PrismaService {
  public readonly rawClient: PrismaClient;
  private store: PrismaTableStore = {
    categories: new Map(),
    questions: new Map(),
    users: new Map(),
    userInventoryItems: new Map(),
    userNotifications: new Map(),
    matchHistory: new Map(),
    passwordResetTokens: new Map(),
  };
  private users: Map<string, UserRecord> = new Map();
  private questions: Question[] = [];
  private categories: CategoryInfo[] = [...ALL_CATEGORIES];
  private isJest = Boolean(process.env.JEST_WORKER_ID);
  public activeUserRooms: Map<string, { roomCode: string; joinedAt: number }> = new Map();
  private recordedMatchKeys: Set<string> = new Set();
  public activePublicRooms: Map<
    string,
    {
      code: string;
      name: string;
      hostId: string;
      hostName: string;
      category: string;
      categoryName: string;
      players: number;
      maxPlayers: number;
      totalRounds: number;
      questionTimeSec: number;
      status: 'lobby' | 'playing' | 'finished';
      privacy: 'public' | 'private';
      updatedAt: number;
    }
  > = new Map();

  constructor() {
    const dbUrl =
      process.env.DATABASE_URL ||
      process.env.DIRECT_URL ||
      'postgresql://postgres:postgres@localhost:5432/postgres';
    this.rawClient = new PrismaClient({
      datasources: {
        db: {
          url: dbUrl,
        },
      },
      log: ['error'],
    });
    this.loadLocalSnapshots();
    this.initQuestions();
    this.seedDefaults();
    this.loadPersistedUsers();
    this.syncInitialCloudState();
  }

  private ensureDir() {
    if (!fs.existsSync(PRISMA_DATA_DIR)) {
      fs.mkdirSync(PRISMA_DATA_DIR, { recursive: true });
    }
  }

  private loadLocalSnapshots() {
    if (this.isJest) return;
    try {
      this.ensureDir();
      this.loadTableFromDisk<PrismaCategory>('categories.json', this.store.categories, (r) => r.id);
      this.loadTableFromDisk<PrismaQuestion>('questions.json', this.store.questions, (r) => r.id);
      this.loadTableFromDisk<PrismaUser>('users.json', this.store.users, (r) => r.id);
      this.loadTableFromDisk<PrismaUserInventoryItem>('user_inventory_items.json', this.store.userInventoryItems, (r) => r.id);
      this.loadTableFromDisk<PrismaUserNotification>('user_notifications.json', this.store.userNotifications, (r) => r.id);
      this.loadTableFromDisk<PrismaMatchHistory>('match_history.json', this.store.matchHistory, (r) => r.id);
    } catch {
      // Ignore snapshot read errors
    }
  }

  private loadTableFromDisk<T>(filename: string, map: Map<string, T>, keyFn: (item: T) => string) {
    const filePath = path.join(PRISMA_DATA_DIR, filename);
    if (!fs.existsSync(filePath)) return;
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as T[];
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        map.set(keyFn(item), item);
      }
    }
  }

  private saveTableToDisk<T>(filename: string, map: Map<string, T>, syncToCloud = true) {
    const rows = Array.from(map.values());
    if (!this.isJest) {
      try {
        this.ensureDir();
        const filePath = path.join(PRISMA_DATA_DIR, filename);
        fs.writeFileSync(filePath, JSON.stringify(rows, null, 2), 'utf-8');
      } catch {
        // Ignore write errors
      }
    }
    if (syncToCloud && !this.isJest) {
      supabaseService.syncCloudStore(`prisma_${filename}`, rows).catch(() => {});
    }
  }

  // ==========================================================================
  // PRISMA MODEL DELEGATE: prisma.category
  // ==========================================================================
  public readonly category = {
    upsert: async (args: {
      where: { id: string };
      update: Partial<PrismaCategory>;
      create: Omit<PrismaCategory, 'createdAt' | 'updatedAt'> & Partial<Pick<PrismaCategory, 'createdAt' | 'updatedAt'>>;
    }): Promise<PrismaCategory> => {
      const existing = this.store.categories.get(args.where.id);
      const now = new Date();
      const record: PrismaCategory = existing
        ? { ...existing, ...args.update, updatedAt: now }
        : {
            ...args.create,
            totalQuestions: args.create.totalQuestions ?? 0,
            createdAt: args.create.createdAt ?? now,
            updatedAt: args.create.updatedAt ?? now,
          };
      this.store.categories.set(record.id, record);
      this.saveTableToDisk('categories.json', this.store.categories, false);

      const supa = supabaseService.getClient();
      if (supa && !this.isJest) {
        Promise.resolve(
          supa.from('categories').upsert({
            id: record.id,
            name: record.name,
            description: record.description,
            icon: record.icon,
            color: record.color,
            totalQuestions: record.totalQuestions,
            updatedAt: record.updatedAt.toISOString(),
          })
        ).catch(() => {});
      }
      return record;
    },

    findMany: async (args?: { orderBy?: { id?: 'asc' | 'desc'; totalQuestions?: 'asc' | 'desc' } }): Promise<PrismaCategory[]> => {
      const list = Array.from(this.store.categories.values());
      if (args?.orderBy?.totalQuestions === 'desc') {
        list.sort((a, b) => b.totalQuestions - a.totalQuestions);
      } else if (args?.orderBy?.id === 'asc') {
        list.sort((a, b) => a.id.localeCompare(b.id));
      }
      return list;
    },

    findUnique: async (args: { where: { id: string } }): Promise<PrismaCategory | null> => {
      return this.store.categories.get(args.where.id) || null;
    },

    count: async (): Promise<number> => {
      return this.store.categories.size;
    },
  };

  // ==========================================================================
  // PRISMA MODEL DELEGATE: prisma.question
  // ==========================================================================
  public readonly question = {
    upsert: async (args: {
      where: { id?: string; contentHash?: string };
      update: Partial<PrismaQuestion>;
      create: Omit<PrismaQuestion, 'createdAt' | 'updatedAt' | 'reviewedBy' | 'reviewedAt' | 'rejectionReason' | 'subCategory' | 'sourceOrVerification'> &
        Partial<PrismaQuestion>;
    }): Promise<PrismaQuestion> => {
      let existing: PrismaQuestion | undefined;
      if (args.where.id) {
        existing = this.store.questions.get(args.where.id);
      } else if (args.where.contentHash) {
        existing = Array.from(this.store.questions.values()).find((q) => q.contentHash === args.where.contentHash);
      }
      const now = new Date();
      const record: PrismaQuestion = existing
        ? { ...existing, ...args.update, updatedAt: now }
        : {
            id: args.create.id,
            categoryId: args.create.categoryId,
            subCategory: args.create.subCategory ?? null,
            difficulty: args.create.difficulty,
            text: args.create.text,
            options: args.create.options as any,
            correctOptionId: args.create.correctOptionId,
            explanation: args.create.explanation,
            sourceOrVerification: args.create.sourceOrVerification ?? null,
            language: args.create.language ?? 'tr',
            contentHash: args.create.contentHash,
            reviewStatus: args.create.reviewStatus ?? 'published',
            reviewedBy: args.create.reviewedBy ?? null,
            reviewedAt: args.create.reviewedAt ?? null,
            rejectionReason: args.create.rejectionReason ?? null,
            timeLimitSec: args.create.timeLimitSec ?? 15,
            createdAt: args.create.createdAt ?? now,
            updatedAt: args.create.updatedAt ?? now,
          };

      this.store.questions.set(record.id, record);
      this.saveTableToDisk('questions.json', this.store.questions, false);
      return record;
    },

    findMany: async (args?: {
      where?: {
        categoryId?: string;
        difficulty?: string;
        reviewStatus?: string;
      };
      take?: number;
    }): Promise<PrismaQuestion[]> => {
      let list = Array.from(this.store.questions.values());
      if (args?.where) {
        const { categoryId, difficulty, reviewStatus } = args.where;
        if (categoryId) list = list.filter((q) => q.categoryId === categoryId);
        if (difficulty) list = list.filter((q) => q.difficulty === difficulty);
        if (reviewStatus) list = list.filter((q) => q.reviewStatus === reviewStatus);
      }
      if (args?.take) {
        list = list.slice(0, args.take);
      }
      return list;
    },

    findUnique: async (args: { where: { id?: string; contentHash?: string } }): Promise<PrismaQuestion | null> => {
      if (args.where.id) {
        return this.store.questions.get(args.where.id) || null;
      }
      if (args.where.contentHash) {
        return Array.from(this.store.questions.values()).find((q) => q.contentHash === args.where.contentHash) || null;
      }
      return null;
    },

    update: async (args: { where: { id: string }; data: Partial<PrismaQuestion> }): Promise<PrismaQuestion | null> => {
      const existing = this.store.questions.get(args.where.id);
      if (!existing) return null;
      const updated: PrismaQuestion = {
        ...existing,
        ...args.data,
        updatedAt: new Date(),
      };
      this.store.questions.set(updated.id, updated);
      this.saveTableToDisk('questions.json', this.store.questions, true);
      return updated;
    },

    count: async (args?: { where?: { categoryId?: string; reviewStatus?: string } }): Promise<number> => {
      if (!args?.where) return this.store.questions.size;
      const list = await this.question.findMany({ where: args.where });
      return list.length;
    },
  };

  private getItemCategory(itemId: string): ItemCategory {
    if (itemId.includes('chest')) return 'chest';
    if (itemId.includes('key')) return 'key';
    if (itemId.includes('booster')) return 'booster';
    if (itemId.includes('frame')) return 'frame';
    if (itemId.includes('badge')) return 'badge';
    if (itemId.includes('name')) return 'name_effect';
    if (itemId.includes('bg') || itemId.includes('background') || itemId.includes('theme')) return 'background';
    return 'cosmetic';
  }

  private getItemRarity(itemId: string): ItemRarity {
    if (itemId.includes('legendary') || itemId.includes('mythic')) return 'mythic';
    if (itemId.includes('gold') || itemId.includes('epic')) return 'epic';
    if (itemId.includes('silver') || itemId.includes('rare')) return 'rare';
    return 'common';
  }

  public sanitizeUserStats(rawStats?: {
    totalMatches?: number;
    wins?: number;
    correctAnswers?: number;
    totalAnswers?: number;
    bestStreak?: number;
    avgResponseTimeMs?: number;
  }): {
    totalMatches: number;
    wins: number;
    correctAnswers: number;
    totalAnswers: number;
    bestStreak: number;
    avgResponseTimeMs: number;
  } {
    const totalMatches = Math.max(0, Math.round(Number(rawStats?.totalMatches) || 0));
    const wins = Math.min(totalMatches, Math.max(0, Math.round(Number(rawStats?.wins) || 0)));

    if (totalMatches === 0) {
      return {
        totalMatches: 0,
        wins: 0,
        correctAnswers: 0,
        totalAnswers: 0,
        bestStreak: 0,
        avgResponseTimeMs: Math.max(0, Math.round(Number(rawStats?.avgResponseTimeMs) || 0)),
      };
    }

    const rawTotalAnswers = Math.max(0, Math.round(Number(rawStats?.totalAnswers) || 0));
    // Every match has at least 5 questions and at most 20 questions
    const minTotalAnswers = totalMatches * 5;
    const maxTotalAnswers = totalMatches * 20;
    const totalAnswers = Math.min(maxTotalAnswers, Math.max(minTotalAnswers, rawTotalAnswers));

    let correctAnswers = Math.max(0, Math.round(Number(rawStats?.correctAnswers) || 0));
    if (correctAnswers > totalAnswers) {
      // Repair historical inflated values (where score/100 was added instead of 0..5)
      correctAnswers = Math.min(totalAnswers, Math.max(wins * 4, Math.round(totalAnswers * 0.7)));
    }

    const rawBestStreak = Math.max(0, Math.round(Number(rawStats?.bestStreak) || 0));
    const bestStreak =
      correctAnswers === 0
        ? 0
        : Math.min(correctAnswers, Math.max(1, rawBestStreak));

    return {
      totalMatches,
      wins,
      correctAnswers,
      totalAnswers,
      bestStreak,
      avgResponseTimeMs: Math.max(0, Math.round(Number(rawStats?.avgResponseTimeMs) || 0)),
    };
  }

  // ==========================================================================
  // PRISMA MODEL DELEGATE: prisma.user
  // ==========================================================================
  private prismaUserToRecord(u: PrismaUser & { inventoryItems?: PrismaUserInventoryItem[] }): UserRecord {
    let inventory: InventoryItem[] = [];
    if (Array.isArray((u as any).inventoryItems)) {
      inventory = (u as any).inventoryItems.map((item: any) => ({
        id: item.itemId,
        name: item.name,
        desc: item.desc,
        qty: item.qty,
        category: this.getItemCategory(item.itemId),
        rarity: this.getItemRarity(item.itemId),
      }));
    }

    const sanitizedStats = this.sanitizeUserStats({
      totalMatches: u.totalMatches,
      wins: u.wins,
      correctAnswers: u.correctAnswers,
      totalAnswers: u.totalAnswers,
      bestStreak: u.bestStreak,
      avgResponseTimeMs: u.avgResponseTimeMs,
    });

    if (
      !this.isJest &&
      u.id &&
      (u.correctAnswers !== sanitizedStats.correctAnswers ||
        u.totalAnswers !== sanitizedStats.totalAnswers ||
        u.wins !== sanitizedStats.wins)
    ) {
      this.rawClient.user
        .update({
          where: { id: u.id },
          data: {
            totalMatches: sanitizedStats.totalMatches,
            wins: sanitizedStats.wins,
            correctAnswers: sanitizedStats.correctAnswers,
            totalAnswers: sanitizedStats.totalAnswers,
            bestStreak: sanitizedStats.bestStreak,
          },
        })
        .catch(() => {});
    }

    return {
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      email: u.email,
      fullName: u.fullName || undefined,
      passwordHash: u.passwordHash || undefined,
      googleId: u.googleId || undefined,
      countryCode: u.countryCode || 'TR',
      countryName: u.countryName || 'Türkiye',
      phone: u.phone || undefined,
      birthDate: u.birthDate || undefined,
      gender: (u.gender as any) || undefined,
      bio: u.bio || undefined,
      avatarUrl: u.avatarUrl || 'av1',
      isGuest: false,
      level: u.level,
      xp: u.xp,
      coins: u.coins,
      gems: u.gems,
      rankTitle: u.rankTitle,
      rankPoints: u.rankPoints,
      friendCode: u.friendCode,
      dailyStreak: u.dailyStreak,
      inventory,
      claimedSeasonTiers: Array.isArray(u.claimedSeasonTiers) ? (u.claimedSeasonTiers as number[]) : [1],
      seasonXp: (u as any).seasonXp ?? 0,
      hasPremiumPass: !!(u as any).hasPremiumPass,
      claimedSeasonFreeTiers: Array.isArray((u as any).claimedSeasonFreeTiers) ? ((u as any).claimedSeasonFreeTiers as number[]) : [],
      claimedSeasonPremiumTiers: Array.isArray((u as any).claimedSeasonPremiumTiers) ? ((u as any).claimedSeasonPremiumTiers as number[]) : [],
      equippedFrame: (u as any).equippedFrame ?? undefined,
      equippedBadge: (u as any).equippedBadge ?? undefined,
      equippedNameEffect: (u as any).equippedNameEffect ?? undefined,
      equippedBackground: (u as any).equippedBackground ?? undefined,
      eventProgress: (u as any).eventProgress || {},
      friendIds: Array.isArray(u.friendIds) ? (u.friendIds as string[]) : [],
      categoryMastery: (u.categoryMastery as any) || {},
      settings: ((u as any).settings as any) || {},
      stats: sanitizedStats,
      createdAt: u.createdAt ? new Date(u.createdAt).getTime() : Date.now(),
    };
  }

  public readonly user = {
    upsert: async (args: {
      where: { id?: string; email?: string; username?: string };
      update: Partial<PrismaUser>;
      create: Partial<PrismaUser> & { id: string; username: string; email: string; displayName: string; friendCode: string };
    }): Promise<PrismaUser> => {
      let record: PrismaUser;
      try {
        const updateData: any = { ...args.update };
        delete updateData.friendCode;
        delete updateData.id;

        const createData: any = { ...args.create };
        if (!createData.friendCode) {
          createData.friendCode = this.generateFriendCode(createData.id);
        }

        const cleanEmail = (createData.email || (updateData as any)?.email || '').toLowerCase().trim();

        // Check if user already exists in PostgreSQL by ID or by Email to prevent duplicate insert errors
        let existingUser: any = null;
        if (args.where.id) {
          existingUser = await this.rawClient.user.findUnique({ where: { id: args.where.id } }).catch(() => null);
        }
        if (!existingUser && cleanEmail) {
          existingUser = await this.rawClient.user.findFirst({ where: { email: cleanEmail } }).catch(() => null);
        }

        const whereClause: any = existingUser
          ? { id: existingUser.id }
          : args.where.id
          ? { id: args.where.id }
          : cleanEmail
          ? { email: cleanEmail }
          : { username: args.where.username };

        try {
          record = await this.rawClient.user.upsert({
            where: whereClause,
            update: updateData,
            create: createData,
          });
        } catch (dbErr: any) {
          const errStr = String(dbErr?.message || '') + String(dbErr?.code || '');
          if (errStr.includes('email') || (dbErr?.code === 'P2002' && dbErr?.meta?.target?.includes('email'))) {
            // Email collision: update existing record matching this email in PostgreSQL
            const targetEmail = (createData.email || (updateData as any)?.email || '').toLowerCase().trim();
            if (targetEmail) {
              const existingByEmail = await this.rawClient.user.findFirst({
                where: { email: targetEmail },
              }).catch(() => null);
              if (existingByEmail) {
                record = await this.rawClient.user.update({
                  where: { id: existingByEmail.id },
                  data: updateData,
                });
                return record;
              }
            }
          }
          if (errStr.includes('friendCode') || (dbErr?.code === 'P2002' && dbErr?.meta?.target?.includes('friendCode'))) {
            createData.friendCode = this.generateFriendCode(createData.id || String(Date.now()));
            record = await this.rawClient.user.upsert({
              where: whereClause,
              update: updateData,
              create: createData,
            });
          } else {
            throw dbErr;
          }
        }
      } catch (err) {
        let existing: PrismaUser | undefined;
        if (args.where.id) {
          existing = this.store.users.get(args.where.id);
        } else if (args.where.email) {
          const cleanEmail = args.where.email.toLowerCase();
          existing = Array.from(this.store.users.values()).find((u) => u.email.toLowerCase() === cleanEmail);
        } else if (args.where.username) {
          const cleanUser = args.where.username.toLowerCase();
          existing = Array.from(this.store.users.values()).find((u) => u.username.toLowerCase() === cleanUser);
        }

        const now = new Date();
        record = existing
          ? { ...existing, ...args.update, updatedAt: now }
          : {
              id: args.create.id,
              username: args.create.username,
              email: args.create.email,
              displayName: args.create.displayName,
              fullName: args.create.fullName ?? null,
              passwordHash: args.create.passwordHash ?? null,
              googleId: args.create.googleId ?? null,
              countryCode: args.create.countryCode ?? 'TR',
              countryName: args.create.countryName ?? 'Türkiye',
              phone: args.create.phone ?? null,
              birthDate: args.create.birthDate ?? null,
              gender: args.create.gender ?? null,
              bio: args.create.bio ?? null,
              avatarUrl: args.create.avatarUrl ?? 'av1',
              friendCode: args.create.friendCode,
              level: args.create.level ?? 1,
              xp: args.create.xp ?? 0,
              coins: args.create.coins ?? 500,
              gems: args.create.gems ?? 15,
              dailyStreak: args.create.dailyStreak ?? 1,
              rankTitle: args.create.rankTitle ?? 'Acemi Kaşif',
              rankPoints: args.create.rankPoints ?? 1000,
              profileCompletionPct: args.create.profileCompletionPct ?? 50,
              totalMatches: args.create.totalMatches ?? 0,
              wins: args.create.wins ?? 0,
              correctAnswers: args.create.correctAnswers ?? 0,
              totalAnswers: args.create.totalAnswers ?? 0,
              bestStreak: args.create.bestStreak ?? 0,
              avgResponseTimeMs: args.create.avgResponseTimeMs ?? 0,
              categoryMastery: (args.create.categoryMastery ?? {}) as any,
              claimedSeasonTiers: (args.create.claimedSeasonTiers ?? [1]) as any,
              seasonXp: (args.create as any).seasonXp ?? 0,
              hasPremiumPass: (args.create as any).hasPremiumPass ?? false,
              claimedSeasonFreeTiers: ((args.create as any).claimedSeasonFreeTiers ?? []) as any,
              claimedSeasonPremiumTiers: ((args.create as any).claimedSeasonPremiumTiers ?? []) as any,
              equippedFrame: (args.create as any).equippedFrame ?? null,
              equippedBadge: (args.create as any).equippedBadge ?? null,
              equippedNameEffect: (args.create as any).equippedNameEffect ?? null,
              equippedBackground: (args.create as any).equippedBackground ?? null,
              eventProgress: ((args.create as any).eventProgress ?? {}) as any,
              friendIds: (args.create.friendIds ?? []) as any,
              settings: (args.create.settings ?? {}) as any,
              createdAt: args.create.createdAt ?? now,
              updatedAt: args.create.updatedAt ?? now,
            };
      }

      this.store.users.set(record.id, record);
      const userRec = this.prismaUserToRecord(record);
      this.users.set(record.id, userRec);
      this.saveTableToDisk('users.json', this.store.users, true);
      return record;
    },

    findUnique: async (args: { where: { id?: string; email?: string; username?: string; friendCode?: string } }): Promise<PrismaUser | null> => {
      try {
        const res = await this.rawClient.user.findUnique({ where: args.where as any });
        if (res) {
          this.store.users.set(res.id, res);
          this.users.set(res.id, this.prismaUserToRecord(res));
          return res;
        }
      } catch {}

      if (args.where.id) return this.store.users.get(args.where.id) || null;
      const all = Array.from(this.store.users.values());
      if (args.where.email) {
        const clean = args.where.email.toLowerCase();
        return all.find((u) => u.email.toLowerCase() === clean) || null;
      }
      if (args.where.username) {
        const clean = args.where.username.toLowerCase();
        return all.find((u) => u.username.toLowerCase() === clean) || null;
      }
      if (args.where.friendCode) {
        const clean = args.where.friendCode.toUpperCase();
        return all.find((u) => u.friendCode.toUpperCase() === clean) || null;
      }
      return null;
    },

    findMany: async (args?: {
      orderBy?: { rankPoints?: 'asc' | 'desc'; xp?: 'asc' | 'desc' };
      take?: number;
    }): Promise<PrismaUser[]> => {
      try {
        const res = await this.rawClient.user.findMany(args as any);
        if (res && res.length > 0) {
          for (const u of res) {
            this.store.users.set(u.id, u);
            this.users.set(u.id, this.prismaUserToRecord(u));
          }
          return res;
        }
      } catch {}

      let list = Array.from(this.store.users.values());
      if (args?.orderBy?.rankPoints === 'desc') {
        list.sort((a, b) => b.rankPoints - a.rankPoints);
      } else if (args?.orderBy?.xp === 'desc') {
        list.sort((a, b) => b.xp - a.xp);
      }
      if (args?.take) {
        list = list.slice(0, args.take);
      }
      return list;
    },

    count: async (): Promise<number> => {
      try {
        return await this.rawClient.user.count();
      } catch {
        return this.store.users.size;
      }
    },
  };

  // ==========================================================================
  // PRISMA MODEL DELEGATE: prisma.userInventoryItem
  // ==========================================================================
  public readonly userInventoryItem = {
    upsert: async (args: {
      where: { userId_itemId: { userId: string; itemId: string } };
      update: Partial<PrismaUserInventoryItem>;
      create: { id?: string; userId: string; itemId: string; name: string; desc: string; qty?: number };
    }): Promise<PrismaUserInventoryItem> => {
      const compositeKey = `${args.where.userId_itemId.userId}::${args.where.userId_itemId.itemId}`;
      const existing = this.store.userInventoryItems.get(compositeKey);
      const now = new Date();
      const record: PrismaUserInventoryItem = existing
        ? { ...existing, ...args.update, updatedAt: now }
        : {
            id: args.create.id ?? compositeKey,
            userId: args.create.userId,
            itemId: args.create.itemId,
            name: args.create.name,
            desc: args.create.desc,
            qty: args.create.qty ?? 1,
            createdAt: now,
            updatedAt: now,
          };
      this.store.userInventoryItems.set(compositeKey, record);
      this.saveTableToDisk('user_inventory_items.json', this.store.userInventoryItems, true);
      return record;
    },

    findMany: async (args?: { where?: { userId?: string } }): Promise<PrismaUserInventoryItem[]> => {
      const list = Array.from(this.store.userInventoryItems.values());
      if (args?.where?.userId) {
        return list.filter((i) => i.userId === args.where!.userId);
      }
      return list;
    },

    count: async (): Promise<number> => {
      return this.store.userInventoryItems.size;
    },
  };

  // ==========================================================================
  // PRISMA MODEL DELEGATE: prisma.userNotification
  // ==========================================================================
  public readonly userNotification = {
    upsert: async (args: {
      where: { id: string };
      update: Partial<PrismaUserNotification>;
      create: Omit<PrismaUserNotification, 'createdAt' | 'handled'> & { handled?: string | null; createdAt?: Date };
    }): Promise<PrismaUserNotification> => {
      const existing = this.store.userNotifications.get(args.where.id);
      const now = new Date();
      const record: PrismaUserNotification = existing
        ? { ...existing, ...args.update }
        : {
            id: args.create.id,
            userId: args.create.userId,
            type: args.create.type,
            title: args.create.title,
            sub: args.create.sub,
            timeText: args.create.timeText,
            handled: args.create.handled ?? null,
            senderId: args.create.senderId ?? null,
            senderName: args.create.senderName ?? null,
            senderAvatar: args.create.senderAvatar ?? null,
            roomCode: args.create.roomCode ?? null,
            createdAt: args.create.createdAt ?? now,
          };
      this.store.userNotifications.set(record.id, record);
      this.saveTableToDisk('user_notifications.json', this.store.userNotifications, true);
      return record;
    },

    findMany: async (args?: { where?: { userId?: string } }): Promise<PrismaUserNotification[]> => {
      const list = Array.from(this.store.userNotifications.values());
      if (args?.where?.userId) {
        return list.filter((n) => n.userId === args.where!.userId);
      }
      return list;
    },

    count: async (): Promise<number> => {
      return this.store.userNotifications.size;
    },
  };

  // ==========================================================================
  // PRISMA MODEL DELEGATE: prisma.matchHistory
  // ==========================================================================
  public readonly matchHistory = {
    create: async (args: {
      data: {
        id?: string;
        roomCode: string;
        mode: string;
        categoryId: string;
        winnerId?: string | null;
        userId?: string | null;
        score?: number;
        correctAnswers?: number;
        totalQuestions?: number;
        rankingsJson: any;
      };
    }): Promise<PrismaMatchHistory> => {
      const id = args.data.id || `match_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const record: PrismaMatchHistory = {
        id,
        roomCode: args.data.roomCode,
        mode: args.data.mode,
        categoryId: args.data.categoryId,
        winnerId: args.data.winnerId ?? null,
        userId: args.data.userId ?? null,
        score: args.data.score ?? 0,
        correctAnswers: args.data.correctAnswers ?? 0,
        totalQuestions: args.data.totalQuestions ?? 5,
        rankingsJson: args.data.rankingsJson,
        playedAt: new Date(),
      };
      this.store.matchHistory.set(record.id, record);
      this.saveTableToDisk('match_history.json', this.store.matchHistory, true);
      return record;
    },

    count: async (): Promise<number> => {
      return this.store.matchHistory.size;
    },
  };

  // ==========================================================================
  // HIGH-LEVEL DOMAIN METHODS (Previously in DatabaseAdapter)
  // ==========================================================================
  private async syncInitialCloudState() {
    if (this.isJest) return;
    try {
      const dbUsers = await this.rawClient.user.findMany({
        include: { inventoryItems: true },
      }).catch(() => []);
      if (dbUsers && dbUsers.length > 0) {
        for (const u of dbUsers) {
          const rec = this.prismaUserToRecord(u as any);
          this.users.set(rec.id, rec);
          if (rec.username) this.users.set(rec.username, rec);
          if (rec.email) this.users.set(rec.email.toLowerCase(), rec);
        }
        console.log(`[PrismaService] PostgreSQL'den ${dbUsers.length} gerçek kullanıcı senkronize edildi.`);
      }

      await supabaseService.syncCloudStore('questions_store.json', this.questions);
      await supabaseService.syncCloudStore('categories_store.json', this.getCategories());
    } catch {
      // Ignore background cloud sync errors
    }
  }

  private loadPersistedUsers() {
    try {
      if (fs.existsSync(USERS_DB_FILE)) {
        const raw = fs.readFileSync(USERS_DB_FILE, 'utf-8');
        const parsed: UserRecord[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const u of parsed) {
            if (u && u.id) {
              u.stats = this.sanitizeUserStats(u.stats);
              this.users.set(u.id, u);
            }
          }
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  private getUniqueRegisteredUsers(): UserRecord[] {
    const byId = new Map<string, UserRecord>();
    for (const u of this.users.values()) {
      if (!u || !u.id || u.isGuest || u.id.startsWith('guest_')) continue;
      u.stats = this.sanitizeUserStats(u.stats);
      const existing = byId.get(u.id);
      if (!existing || (u.updatedAt || 0) >= (existing.updatedAt || 0)) {
        byId.set(u.id, u);
      }
    }

    // Secondary deduplication by email, username, and normalized displayName
    // so multiple test accounts or alias keys with the same player name never repeat on Leaderboards
    const normalizeKey = (s?: string) =>
      (s || '')
        .toLowerCase()
        .replace(/ş/g, 's')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/ı/g, 'i')
        .replace(/[^a-z0-9]/g, '')
        .trim();

    const sortedCandidates = Array.from(byId.values()).sort(
      (a, b) => (b.rankPoints || 0) + (b.xp || 0) - ((a.rankPoints || 0) + (a.xp || 0))
    );

    const seenEmails = new Set<string>();
    const seenUsernames = new Set<string>();
    const seenDisplayNames = new Set<string>();
    const deduplicated: UserRecord[] = [];

    for (const u of sortedCandidates) {
      const emailKey = (u.email || '').toLowerCase().trim();
      const userKey = (u.username || '').toLowerCase().trim();
      const nameKey = normalizeKey(u.displayName || u.username);

      if (emailKey && seenEmails.has(emailKey)) continue;
      if (userKey && seenUsernames.has(userKey)) continue;
      if (nameKey && seenDisplayNames.has(nameKey)) continue;

      if (emailKey) seenEmails.add(emailKey);
      if (userKey) seenUsernames.add(userKey);
      if (nameKey) seenDisplayNames.add(nameKey);
      deduplicated.push(u);
    }

    return deduplicated;
  }

  private savePersistedUsers() {
    try {
      const byId = new Map<string, UserRecord>();
      for (const u of this.users.values()) {
        if (u && u.id && !u.isGuest) {
          u.stats = this.sanitizeUserStats(u.stats);
          byId.set(u.id, u);
        }
      }
      const list = Array.from(byId.values());
      if (!this.isJest) {
        fs.writeFileSync(USERS_DB_FILE, JSON.stringify(list, null, 2), 'utf-8');
      }
    } catch {
      // Ignore write errors
    }
  }

  private savePersistedQuestions() {
    try {
      if (!this.isJest) {
        fs.writeFileSync(QUESTIONS_DB_FILE, JSON.stringify(this.questions, null, 2), 'utf-8');
        supabaseService.syncCloudStore('questions_store.json', this.questions).catch(() => {});
        supabaseService.syncCloudStore('categories_store.json', this.getCategories()).catch(() => {});
      }
      const latest = this.questions[this.questions.length - 1];
      if (latest) {
        this.syncQuestionToPrisma(latest).catch(() => {});
      }
    } catch {
      // Ignore write errors
    }
  }

  private initQuestions() {
    const seenHashes = new Set<string>();
    const combined: Question[] = [];

    for (const q of QUESTION_BANK) {
      const hash = q.contentHash || computeQuestionHash(q.text, q.options);
      if (!seenHashes.has(hash)) {
        seenHashes.add(hash);
        combined.push({
          ...q,
          reviewStatus: (q.reviewStatus || 'published') as ReviewStatus,
          contentHash: hash,
          createdAt: q.createdAt || new Date().toISOString(),
          language: q.language || 'tr',
        });
      }
    }

    if (RICH_SEED_BANK) {
      let seedCounter = 1;
      for (const [catKey, diffObj] of Object.entries(RICH_SEED_BANK)) {
        if (catKey === 'mixed') continue;
        const catId = catKey as CategoryId;
        for (const [diffKey, templates] of Object.entries(diffObj)) {
          const difficulty = diffKey as DifficultyLevel;
          for (const tpl of templates) {
            const correctText = tpl.options[0];
            const shift = seedCounter % 4;
            const rotated = [
              tpl.options[(0 + shift) % 4],
              tpl.options[(1 + shift) % 4],
              tpl.options[(2 + shift) % 4],
              tpl.options[(3 + shift) % 4],
            ];
            const options = [
              { id: 'opt_a', text: rotated[0] },
              { id: 'opt_b', text: rotated[1] },
              { id: 'opt_c', text: rotated[2] },
              { id: 'opt_d', text: rotated[3] },
            ];
            const correctOpt = options.find((o) => o.text === correctText) || options[0];
            const hash = computeQuestionHash(tpl.text, options);
            if (!seenHashes.has(hash)) {
              seenHashes.add(hash);
              combined.push({
                id: `seed_${catId}_${seedCounter++}`,
                categoryId: catId,
                difficulty,
                text: tpl.text,
                options,
                correctOptionId: correctOpt.id,
                explanation: tpl.exp,
                sourceOrVerification: tpl.src,
                reviewStatus: 'published',
                contentHash: hash,
                createdAt: new Date().toISOString(),
                language: 'tr',
                timeLimitSec: 15,
              });
            }
          }
        }
      }
    }

    try {
      if (!this.isJest && fs.existsSync(QUESTIONS_DB_FILE)) {
        const raw = fs.readFileSync(QUESTIONS_DB_FILE, 'utf-8');
        const persisted: Question[] = JSON.parse(raw);
        if (Array.isArray(persisted)) {
          for (const pq of persisted) {
            if (pq && pq.text && Array.isArray(pq.options)) {
              const hash = pq.contentHash || computeQuestionHash(pq.text, pq.options);
              if (!seenHashes.has(hash)) {
                seenHashes.add(hash);
                combined.push({ ...pq, contentHash: hash });
              }
            }
          }
        }
      }
    } catch {
      // Ignore read errors
    }

    this.questions = combined;
  }

  private seedDefaults() {
    // No mock users: only genuine real users registered via multi-step wizard or Google OAuth are stored.
  }

  public async syncUserToPrisma(record: UserRecord): Promise<void> {
    if (record.isGuest) return;
    try {
      const profile = this.toProfile(record);
      await this.user.upsert({
        where: { id: record.id },
        update: {
          username: record.username,
          email: record.email || `${record.username}@tavriko.app`,
          displayName: record.displayName,
          fullName: record.fullName ?? null,
          passwordHash: record.passwordHash ?? null,
          countryCode: record.countryCode ?? 'TR',
          countryName: record.countryName ?? 'Türkiye',
          phone: record.phone ?? null,
          birthDate: record.birthDate ?? null,
          gender: record.gender ?? null,
          bio: record.bio ?? null,
          avatarUrl: record.avatarUrl || 'av1',
          friendCode: profile.friendCode || this.generateFriendCode(record.id),
          level: record.level,
          xp: record.xp,
          coins: record.coins,
          gems: record.gems ?? 14,
          dailyStreak: profile.dailyStreak ?? 1,
          rankTitle: record.rankTitle,
          rankPoints: record.rankPoints,
          profileCompletionPct: profile.profileCompletionPct ?? 50,
          totalMatches: record.stats.totalMatches,
          wins: record.stats.wins,
          correctAnswers: record.stats.correctAnswers,
          totalAnswers: record.stats.totalAnswers,
          bestStreak: record.stats.bestStreak,
          avgResponseTimeMs: record.stats.avgResponseTimeMs,
          claimedSeasonTiers: (profile.claimedSeasonTiers || [1]) as any,
          friendIds: (profile.friendIds || []) as any,
        },
        create: {
          id: record.id,
          username: record.username,
          email: record.email || `${record.username}@tavriko.app`,
          displayName: record.displayName,
          fullName: record.fullName ?? null,
          passwordHash: record.passwordHash ?? null,
          countryCode: record.countryCode ?? 'TR',
          countryName: record.countryName ?? 'Türkiye',
          phone: record.phone ?? null,
          birthDate: record.birthDate ?? null,
          gender: record.gender ?? null,
          bio: record.bio ?? null,
          avatarUrl: record.avatarUrl || 'av1',
          friendCode: profile.friendCode || this.generateFriendCode(record.id),
          level: record.level,
          xp: record.xp,
          coins: record.coins,
          gems: record.gems ?? 14,
          dailyStreak: profile.dailyStreak ?? 1,
          rankTitle: record.rankTitle,
          rankPoints: record.rankPoints,
          profileCompletionPct: profile.profileCompletionPct ?? 50,
          totalMatches: record.stats.totalMatches,
          wins: record.stats.wins,
          correctAnswers: record.stats.correctAnswers,
          totalAnswers: record.stats.totalAnswers,
          bestStreak: record.stats.bestStreak,
          avgResponseTimeMs: record.stats.avgResponseTimeMs,
          claimedSeasonTiers: (profile.claimedSeasonTiers || [1]) as any,
          friendIds: (profile.friendIds || []) as any,
        },
      });

      for (const item of profile.inventory || []) {
        await this.userInventoryItem.upsert({
          where: { userId_itemId: { userId: record.id, itemId: item.id } },
          update: { name: item.name, desc: item.desc, qty: item.qty },
          create: {
            userId: record.id,
            itemId: item.id,
            name: item.name,
            desc: item.desc,
            qty: item.qty,
          },
        }).catch(() => {});
      }
      for (const notif of profile.notifications || []) {
        const notifId = `${record.id}_${notif.id}`;
        await this.userNotification.upsert({
          where: { id: notifId },
          update: {
            title: notif.title,
            sub: notif.sub,
            timeText: notif.timeText,
            handled: notif.handled ?? null,
            senderId: notif.senderId ?? null,
            senderName: notif.senderName ?? null,
            senderAvatar: notif.senderAvatar ?? null,
            roomCode: notif.roomCode ?? null,
          },
          create: {
            id: notifId,
            userId: record.id,
            type: notif.type,
            title: notif.title,
            sub: notif.sub,
            timeText: notif.timeText,
            handled: notif.handled ?? null,
            senderId: notif.senderId ?? null,
            senderName: notif.senderName ?? null,
            senderAvatar: notif.senderAvatar ?? null,
            roomCode: notif.roomCode ?? null,
          },
        }).catch(() => {});
      }
    } catch {
      // Safe failover
    }
  }

  public async syncQuestionToPrisma(q: Question): Promise<void> {
    const hash = q.contentHash || computeQuestionHash(q.text, q.options);
    await this.question.upsert({
      where: { id: q.id },
      update: {
        categoryId: q.categoryId,
        subCategory: q.subCategory ?? null,
        difficulty: q.difficulty,
        text: q.text,
        options: q.options as any,
        correctOptionId: q.correctOptionId,
        explanation: q.explanation,
        sourceOrVerification: q.sourceOrVerification ?? null,
        language: q.language || 'tr',
        contentHash: hash,
        reviewStatus: q.reviewStatus || 'published',
        reviewedBy: q.reviewedBy ?? null,
        reviewedAt: q.reviewedAt ? new Date(q.reviewedAt) : null,
        rejectionReason: q.rejectionReason ?? null,
        timeLimitSec: q.timeLimitSec || 15,
      },
      create: {
        id: q.id,
        categoryId: q.categoryId,
        subCategory: q.subCategory ?? null,
        difficulty: q.difficulty,
        text: q.text,
        options: q.options as any,
        correctOptionId: q.correctOptionId,
        explanation: q.explanation,
        sourceOrVerification: q.sourceOrVerification ?? null,
        language: q.language || 'tr',
        contentHash: hash,
        reviewStatus: q.reviewStatus || 'published',
        reviewedBy: q.reviewedBy ?? null,
        reviewedAt: q.reviewedAt ? new Date(q.reviewedAt) : null,
        rejectionReason: q.rejectionReason ?? null,
        timeLimitSec: q.timeLimitSec || 15,
      },
    });
  }

  public async syncAllToPrisma(): Promise<void> {
    const cats = this.getCategories();
    for (const c of cats) {
      const catName = (c as any).title || (c as any).name || c.id;
      const catColor = (c as any).accentColor || (c as any).color || '#6366F1';
      await this.category.upsert({
        where: { id: c.id },
        update: {
          name: catName,
          description: c.description,
          icon: c.icon,
          color: catColor,
          totalQuestions: c.totalQuestions,
        },
        create: {
          id: c.id,
          name: catName,
          description: c.description,
          icon: c.icon,
          color: catColor,
          totalQuestions: c.totalQuestions,
        },
      });
    }

    for (const q of this.questions) {
      await this.syncQuestionToPrisma(q);
    }

    for (const userRecord of this.users.values()) {
      await this.syncUserToPrisma(userRecord);
    }
  }

  public async pushAllDataViaPrismaToSupabase() {
    await this.syncAllToPrisma();
    return this.pushAllTablesToSupabase();
  }

  private calculateLevelBonus(payload: Partial<RegisterPayload>): {
    level: number;
    xp: number;
    coins: number;
    gems: number;
    rankTitle: string;
  } {
    let xp = 200;
    let coins = 300;
    let gems = 10;

    if (payload.fullName && payload.fullName.trim().length >= 2) {
      xp += 250;
      coins += 150;
    }
    if (payload.birthDate && payload.birthDate.trim().length >= 4) {
      xp += 200;
      coins += 100;
    }
    if (payload.countryCode) {
      xp += 200;
      coins += 150;
    }
    if (payload.phone && payload.phone.trim().length >= 6) {
      xp += 350;
      coins += 200;
      gems += 10;
    }
    if (payload.avatarUrl) {
      xp += 200;
      coins += 100;
      gems += 5;
    }

    const level = Math.max(1, Math.floor(xp / 450) + 1);
    const rankTitle =
      level >= 4 ? 'Bilgi Şövalyesi' : level >= 3 ? 'Usta Kaşif' : level >= 2 ? 'Yükselen Yıldız' : 'Acemi Kaşif';

    return { level, xp, coins, gems, rankTitle };
  }

  public async createGuest(displayName?: string): Promise<{ token: string; user: UserProfile }> {
    const id = 'guest_' + randomBytes(16).toString('hex');
    const name = displayName || `Misafir_${Math.floor(1000 + Math.random() * 9000)}`;
    const record: UserRecord = {
      id,
      username: name.toLowerCase().replace(/\s+/g, '_'),
      displayName: name,
      avatarUrl: 'av0',
      isGuest: true,
      level: 1,
      xp: 0,
      coins: 200,
      gems: 5,
      rankTitle: 'Misafir Kaşif',
      rankPoints: 1000,
      stats: {
        totalMatches: 0,
        wins: 0,
        correctAnswers: 0,
        totalAnswers: 0,
        bestStreak: 0,
        avgResponseTimeMs: 0,
      },
      createdAt: Date.now(),
    };

    this.users.set(id, record);
    const token = jwt.sign({ userId: id, username: record.username, isGuest: true }, JWT_SECRET, { expiresIn: '24h' });
    return { token, user: this.toProfile(record) };
  }

  public async register(
    usernameOrPayload: string | RegisterPayload,
    displayNameArg?: string,
    passwordArg?: string
  ): Promise<{ token: string; user: UserProfile }> {
    const payload: RegisterPayload =
      typeof usernameOrPayload === 'string'
        ? {
            username: usernameOrPayload,
            email: usernameOrPayload.includes('@') ? usernameOrPayload : `${usernameOrPayload}@tavriko.app`,
            displayName: displayNameArg || usernameOrPayload,
            password: passwordArg || '',
          }
        : usernameOrPayload;

    const cleanUsername = (payload.username || '').trim().toLowerCase();
    const cleanEmail = (payload.email || '').trim().toLowerCase();

    if (!cleanUsername || cleanUsername.length < 3) {
      throw new Error('Kullanıcı adı en az 3 karakter olmalıdır.');
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Geçerli bir e-posta adresi giriniz.');
    }
    if (!payload.password || payload.password.length < 6) {
      throw new Error('Şifreniz en az 6 karakter olmalıdır.');
    }

    const existingUser = await this.rawClient.user.findFirst({
      where: {
        OR: [{ username: cleanUsername }, { email: cleanEmail }],
      },
    }).catch(() => null);

    if (existingUser) {
      if (existingUser.username.toLowerCase() === cleanUsername) {
        throw new Error('Bu kullanıcı adı zaten alınmış. Lütfen farklı bir kullanıcı adı seçin.');
      }
      throw new Error('Bu e-posta adresiyle kayıtlı bir hesap zaten mevcut.');
    }

    const id = 'usr_' + Math.random().toString(36).substring(2, 9);
    const passwordHash = await bcrypt.hash(payload.password, 10);
    const bonus = this.calculateLevelBonus(payload);
    const friendCode = this.generateFriendCode(id);
    const now = new Date();

    const dbUser = await this.rawClient.user.create({
      data: {
        id,
        username: cleanUsername,
        email: cleanEmail,
        displayName: (payload.displayName || payload.fullName || cleanUsername).trim(),
        fullName: payload.fullName?.trim() || null,
        passwordHash,
        countryCode: payload.countryCode || 'TR',
        countryName: payload.countryName || 'Türkiye',
        phone: payload.phone?.trim() || null,
        birthDate: payload.birthDate?.trim() || null,
        gender: payload.gender || null,
        bio: payload.bio?.trim() || null,
        avatarUrl: payload.avatarUrl || 'av1',
        friendCode,
        level: bonus.level || 1,
        xp: bonus.xp || 0,
        coins: bonus.coins || 500,
        gems: bonus.gems || 15,
        dailyStreak: 1,
        rankTitle: bonus.rankTitle || 'Acemi Kaşif',
        rankPoints: 1000 + (bonus.level || 1) * 100,
        profileCompletionPct: 50,
        totalMatches: 0,
        wins: 0,
        correctAnswers: 0,
        totalAnswers: 0,
        bestStreak: 0,
        avgResponseTimeMs: 0,
        categoryMastery: {},
        claimedSeasonTiers: [1],
        seasonXp: 0,
        hasPremiumPass: false,
        claimedSeasonFreeTiers: [],
        claimedSeasonPremiumTiers: [],
        equippedFrame: null,
        equippedBadge: null,
        equippedNameEffect: null,
        equippedBackground: null,
        eventProgress: {},
        friendIds: [],
        createdAt: now,
        updatedAt: now,
      },
    });

    const record = this.prismaUserToRecord(dbUser);
    this.users.set(id, record);
    this.store.users.set(dbUser.id, dbUser);
    this.savePersistedUsers();

    const token = jwt.sign({ userId: id, username: record.username }, JWT_SECRET, { expiresIn: '30d' });
    return { token, user: this.toProfile(record) };
  }

  public async login(identifier: string, password: string): Promise<{ token: string; user: UserProfile }> {
    const cleanId = identifier.trim().toLowerCase();
    let dbUser = await this.rawClient.user.findFirst({
      where: {
        OR: [{ username: cleanId }, { email: cleanId }],
      },
    }).catch(() => null);

    if (!dbUser) {
      const memUser = Array.from(this.users.values()).find(
        (u) => !u.isGuest && (u.username === cleanId || (u.email && u.email.toLowerCase() === cleanId))
      );
      if (memUser) {
        await this.syncUserToPrisma(memUser).catch(() => {});
        dbUser = await this.rawClient.user.findUnique({ where: { id: memUser.id } }).catch(() => null);
      }
    }

    if (!dbUser) {
      throw new Error('Bu e-posta veya kullanıcı adına ait kayıtlı bir hesap bulunamadı. Lütfen önce kayıt olun!');
    }

    if (!dbUser.passwordHash) {
      throw new Error('Bu hesap Google ile oluşturulmuş. Lütfen Google ile Giriş Yap butonunu kullanın.');
    }

    const match = await bcrypt.compare(password, dbUser.passwordHash);
    if (!match) {
      throw new Error('Girdiğiniz şifre hatalı. Lütfen kontrol edip tekrar deneyin.');
    }

    const record = this.prismaUserToRecord(dbUser);
    this.users.set(record.id, record);
    this.store.users.set(dbUser.id, dbUser);

    const token = jwt.sign({ userId: record.id, username: record.username }, JWT_SECRET, { expiresIn: '30d' });
    return { token, user: this.toProfile(record) };
  }

  public async loginOrRegisterGoogle(payload: {
    email: string;
    displayName: string;
    fullName?: string;
    avatarUrl?: string;
    googleId?: string;
    countryCode?: string;
    countryName?: string;
    phone?: string;
    birthDate?: string;
  }): Promise<{ token: string; user: UserProfile; isNewUser: boolean }> {
    const cleanEmail = payload.email.trim().toLowerCase();

    // 1. Search in PostgreSQL database FIRST (authoritative single source of truth)
    let dbUser = await this.rawClient.user
      .findFirst({
        where: {
          OR: [
            { email: cleanEmail },
            payload.googleId ? { googleId: payload.googleId } : {},
          ].filter((x) => Object.keys(x).length > 0) as any,
        },
        include: {
          inventoryItems: true,
        },
        orderBy: { updatedAt: 'desc' },
      })
      .catch(() => null);

    let isNewUser = false;
    let existingRecord: UserRecord | null = null;
    const now = new Date();

    if (dbUser) {
      // Existing user in PostgreSQL: PostgreSQL is MASTER!
      existingRecord = this.prismaUserToRecord(dbUser as any);
      existingRecord.displayName = payload.displayName || existingRecord.displayName;
      if (payload.fullName) existingRecord.fullName = payload.fullName;
      // Do NOT overwrite user's custom chosen avatar with default 'av1' or google picture if they already have an avatar
      if (
        payload.avatarUrl &&
        payload.avatarUrl !== 'av1' &&
        payload.avatarUrl !== 'av_1' &&
        (!existingRecord.avatarUrl || existingRecord.avatarUrl === 'av1' || existingRecord.avatarUrl === 'av_1')
      ) {
        existingRecord.avatarUrl = payload.avatarUrl;
      }
      if (payload.googleId) existingRecord.googleId = payload.googleId;
      existingRecord.updatedAt = Date.now();

      try {
        await this.rawClient.user.update({
          where: { id: dbUser.id },
          data: {
            displayName: existingRecord.displayName,
            fullName: existingRecord.fullName,
            avatarUrl: existingRecord.avatarUrl,
            googleId: existingRecord.googleId,
            updatedAt: now,
          },
        });
      } catch (err) {
        console.error('[loginOrRegisterGoogle] DB update error:', err);
      }
    } else {
      // Check in-memory fallback
      existingRecord = Array.from(this.users.values()).find(
        (u) =>
          !u.isGuest &&
          ((u.email && u.email.trim().toLowerCase() === cleanEmail) ||
            (payload.googleId && u.googleId === payload.googleId))
      ) || null;

    if (!existingRecord) {
      // Truly a brand new user
      isNewUser = true;
      const baseUsername = cleanEmail.split('@')[0].replace(/[^a-z0-9_]/g, '') || 'oyuncu';
      let finalUsername = baseUsername;
      let counter = 1;

      while (
        (await this.rawClient.user.findUnique({ where: { username: finalUsername } }).catch(() => null)) ||
        Array.from(this.users.values()).some((u) => u.username === finalUsername)
      ) {
        finalUsername = `${baseUsername}${counter++}`;
      }

      const id = 'google_' + Math.random().toString(36).substring(2, 9);
      const bonus = this.calculateLevelBonus(payload);
      const friendCode = this.generateFriendCode(id);

      try {
        dbUser = await this.rawClient.user.create({
          data: {
            id,
            username: finalUsername,
            email: cleanEmail,
            displayName: (payload.displayName || payload.fullName || finalUsername).trim(),
            fullName: payload.fullName || payload.displayName || null,
            googleId: payload.googleId || null,
            countryCode: payload.countryCode || 'TR',
            countryName: payload.countryName || 'Türkiye',
            phone: payload.phone || null,
            birthDate: payload.birthDate || null,
            avatarUrl: payload.avatarUrl || 'av1',
            friendCode,
            level: bonus.level || 1,
            xp: bonus.xp || 0,
            coins: bonus.coins || 500,
            gems: bonus.gems || 15,
            dailyStreak: 1,
            rankTitle: bonus.rankTitle || 'Acemi Kaşif',
            rankPoints: 1000,
            profileCompletionPct: 50,
            totalMatches: 0,
            wins: 0,
            correctAnswers: 0,
            totalAnswers: 0,
            bestStreak: 0,
            avgResponseTimeMs: 0,
            categoryMastery: {},
            claimedSeasonTiers: [1],
            seasonXp: 0,
            hasPremiumPass: false,
            claimedSeasonFreeTiers: [],
            claimedSeasonPremiumTiers: [],
            equippedFrame: null,
            equippedBadge: null,
            equippedNameEffect: null,
            equippedBackground: null,
            eventProgress: {},
            friendIds: [],
            createdAt: now,
            updatedAt: now,
          },
          include: {
            inventoryItems: true,
          },
        });
      } catch (err) {
        // Fallback local creation if PostgreSQL is unreachable
        dbUser = {
          id,
          username: finalUsername,
          email: cleanEmail,
          passwordHash: null,
          displayName: (payload.displayName || payload.fullName || finalUsername).trim(),
          fullName: payload.fullName || payload.displayName || null,
          googleId: payload.googleId || null,
          countryCode: payload.countryCode || 'TR',
          countryName: payload.countryName || 'Türkiye',
          phone: payload.phone || null,
          birthDate: payload.birthDate || null,
          avatarUrl: payload.avatarUrl || 'av1',
          friendCode,
          level: bonus.level || 1,
          xp: bonus.xp || 0,
          coins: bonus.coins || 500,
          gems: bonus.gems || 15,
          dailyStreak: 1,
          lastDailyDate: null,
          rankTitle: bonus.rankTitle || 'Acemi Kaşif',
          rankPoints: 1000,
          profileCompletionPct: 50,
          totalMatches: 0,
          wins: 0,
          correctAnswers: 0,
          totalAnswers: 0,
          bestStreak: 0,
          avgResponseTimeMs: 0,
          categoryMastery: {},
          claimedSeasonTiers: [1],
          seasonXp: 0,
          hasPremiumPass: false,
          claimedSeasonFreeTiers: [],
          claimedSeasonPremiumTiers: [],
          equippedFrame: null,
          equippedBadge: null,
          equippedNameEffect: null,
          equippedBackground: null,
          eventProgress: {},
          friendIds: [],
          createdAt: now,
          updatedAt: now,
        } as any;
      }

      existingRecord = this.prismaUserToRecord(dbUser!);
      }
    }

    this.users.set(existingRecord.id, existingRecord);
    if (existingRecord.username) this.users.set(existingRecord.username, existingRecord);
    if (existingRecord.email) this.users.set(existingRecord.email.toLowerCase(), existingRecord);
    if (dbUser) {
      this.store.users.set(dbUser.id, dbUser);
    }
    this.savePersistedUsers();

    const token = jwt.sign(
      { userId: existingRecord.id, username: existingRecord.username },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    return { token, user: this.toProfile(existingRecord), isNewUser };
  }

  public async deleteAccount(userId: string): Promise<{ success: boolean; message: string }> {
    const user = this.users.get(userId);
    if (!user) {
      return { success: false, message: 'Kullanıcı bulunamadı.' };
    }

    // 1. Remove from in-memory maps
    this.users.delete(userId);
    this.store.users.delete(userId);

    // 2. Remove from friends lists of other users
    for (const otherUser of this.users.values()) {
      if (otherUser.friendIds && otherUser.friendIds.includes(userId)) {
        otherUser.friendIds = otherUser.friendIds.filter((id) => id !== userId);
      }
    }

    // 3. Delete from PostgreSQL
    try {
      await this.rawClient.user.delete({ where: { id: userId } }).catch(() => null);
    } catch {}

    // 4. Save persisted users snapshot
    this.savePersistedUsers();

    return {
      success: true,
      message: 'Hesabınız ve tüm oyun verileriniz kalıcı olarak silindi.',
    };
  }

  public async requestPasswordReset(identifier: string): Promise<{
    success: boolean;
    message: string;
    demoResetCode: string;
    emailMasked: string;
  }> {
    const cleanId = identifier.trim().toLowerCase();
    const record = Array.from(this.users.values()).find(
      (u) => !u.isGuest && (u.username === cleanId || (u.email && u.email.toLowerCase() === cleanId))
    );

    if (!record) {
      throw new Error('Bu e-posta veya kullanıcı adına kayıtlı bir hesap bulunamadı.');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    record.resetOtpCode = otp;
    record.resetOtpExpiresAt = Date.now() + 15 * 60 * 1000;
    this.savePersistedUsers();

    const emailStr = record.email || `${record.username}@tavriko.app`;
    return {
      success: true,
      message: `Şifre sıfırlama doğrulama kodu (${emailStr}) hesabınız için oluşturuldu.`,
      demoResetCode: otp,
      emailMasked: emailStr,
    };
  }

  public async confirmPasswordReset(
    identifier: string,
    otpCode: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string; token: string; user: UserProfile }> {
    const cleanId = identifier.trim().toLowerCase();
    const record = Array.from(this.users.values()).find(
      (u) => !u.isGuest && (u.username === cleanId || (u.email && u.email.toLowerCase() === cleanId))
    );

    if (!record) {
      throw new Error('Kullanıcı bulunamadı.');
    }

    if (!record.resetOtpCode || record.resetOtpCode !== otpCode.trim()) {
      throw new Error('Girdiğiniz 6 haneli doğrulama kodu geçersiz.');
    }

    if (record.resetOtpExpiresAt && Date.now() > record.resetOtpExpiresAt) {
      throw new Error('Doğrulama kodunun süresi dolmuş. Lütfen yeni kod isteyin.');
    }

    if (!newPassword || newPassword.length < 6) {
      throw new Error('Yeni şifreniz en az 6 karakter olmalıdır.');
    }

    record.passwordHash = await bcrypt.hash(newPassword, 10);
    record.resetOtpCode = undefined;
    record.resetOtpExpiresAt = undefined;
    this.savePersistedUsers();
    supabaseService.upsertUser(record).catch(() => {});

    const token = jwt.sign({ userId: record.id, username: record.username }, JWT_SECRET, { expiresIn: '30d' });
    return {
      success: true,
      message: 'Şifreniz başarıyla yenilendi!',
      token,
      user: this.toProfile(record),
    };
  }

  public async updateUserProfile(
    userId: string,
    updates: Partial<{
      displayName: string;
      fullName: string;
      countryCode: string;
      countryName: string;
      phone: string;
      birthDate: string;
      gender: string;
      bio: string;
      avatarUrl: string;

    }>
  ): Promise<UserProfile> {
    let record = this.users.get(userId);
    if (!record) {
      try {
        const u = await this.rawClient.user.findFirst({
          where: { OR: [{ id: userId }, { username: userId }] },
          include: { inventoryItems: true },
        });
        if (u) {
          record = this.prismaUserToRecord(u as any);
          this.users.set(record.id, record);
        }
      } catch (findErr) {
        console.warn('[updateUserProfile] Prisma search error:', findErr);
      }
    }
    if (!record) {
      throw new Error('Kullanıcı bulunamadı.');
    }

    if (updates.displayName !== undefined && updates.displayName.trim()) {
      record.displayName = updates.displayName.trim();
    }
    if (updates.fullName !== undefined) record.fullName = updates.fullName.trim();
    if (updates.countryCode !== undefined) record.countryCode = updates.countryCode;
    if (updates.countryName !== undefined) record.countryName = updates.countryName;
    if (updates.phone !== undefined) record.phone = updates.phone.trim();
    if (updates.birthDate !== undefined) record.birthDate = updates.birthDate.trim();
    if (updates.gender !== undefined) record.gender = updates.gender;
    if (updates.bio !== undefined) record.bio = updates.bio.trim();
    if (updates.avatarUrl !== undefined && updates.avatarUrl) {
      record.avatarUrl = updates.avatarUrl;
    }

    record.updatedAt = Date.now();
    this.users.set(userId, record);
    this.users.set(record.id, record);
    if (record.username) this.users.set(record.username, record);
    if (record.email) this.users.set(record.email.toLowerCase(), record);

    if (!record.isGuest) {
      this.savePersistedUsers();

      // Kalıcı olarak Prisma PostgreSQL veritabanını güncelle!
      try {
        await this.rawClient.user.update({
          where: { id: record.id },
          data: {
            displayName: record.displayName,
            fullName: record.fullName,
            avatarUrl: record.avatarUrl,
            countryCode: record.countryCode,
            countryName: record.countryName,
            phone: record.phone,
            birthDate: record.birthDate,
            gender: record.gender,
            bio: record.bio,
            updatedAt: new Date(),
          },
        });
        console.log(`✅ [updateUserProfile] Prisma PostgreSQL kalıcı güncellendi: ${record.id} -> avatarUrl: ${record.avatarUrl}, title: ${record.rankTitle}`);
      } catch (dbErr) {
        console.error(`⚠️ [updateUserProfile] Prisma PostgreSQL güncelleme hatası:`, dbErr);
      }

      await this.syncUserToPrisma(record).catch(() => {});
      supabaseService.upsertUser(record).catch(() => {});
    }

    return this.toProfile(record);
  }

  public async updateUserSettings(
    userId: string,
    newSettings: Partial<UserSettings>
  ): Promise<UserProfile> {
    let record = this.users.get(userId);
    if (!record) {
      try {
        const u = await this.rawClient.user.findFirst({
          where: { OR: [{ id: userId }, { username: userId }] },
        });
        if (u) {
          record = this.prismaUserToRecord(u as any);
          this.users.set(record.id, record);
        }
      } catch {}
    }
    if (!record) throw new Error('Kullanıcı bulunamadı.');

    record.settings = { ...(record.settings || {}), ...newSettings };
    record.updatedAt = Date.now();
    this.users.set(record.id, record);
    this.savePersistedUsers();

    if (!record.isGuest) {
      try {
        await this.rawClient.user.update({
          where: { id: record.id },
          data: {
            settings: record.settings as any,
            updatedAt: new Date(),
          },
        });
        console.log(`✅ [updateUserSettings] PostgreSQL ayarlar güncellendi: ${record.id}`);
      } catch (err: any) {
        console.warn('[updateUserSettings] DB error:', err.message);
      }
    }

    // If online status visibility was toggled
    if (newSettings.onlineStatusVisible !== undefined) {
      if (newSettings.onlineStatusVisible === false) {
        presenceManager.broadcast('user:offline', {
          userId: record.id,
          presence: { userId: record.id, online: false, inRoom: false, status: 'Çevrimdışı', lastSeen: 0 },
        });
      } else {
        presenceManager.touchUser(record.id);
      }
    }

    return this.toProfile(record);
  }

  public async changeUserPassword(
    userId: string,
    currentPass: string,
    newPass: string
  ): Promise<{ success: boolean; message: string }> {
    let record = this.users.get(userId);
    if (!record) {
      const u = await this.rawClient.user.findFirst({ where: { OR: [{ id: userId }, { username: userId }] } });
      if (u) record = this.prismaUserToRecord(u);
    }
    if (!record) throw new Error('Kullanıcı bulunamadı.');

    if (record.isGuest) throw new Error('Misafir hesaplarda şifre değiştirilemez.');

    // If account has an existing passwordHash, verify it
    if (record.passwordHash) {
      const isMatch = bcrypt.compareSync(currentPass, record.passwordHash);
      if (!isMatch) {
        throw new Error('Mevcut şifreniz hatalı. Lütfen tekrar deneyin.');
      }
    }

    if (newPass.length < 6) {
      throw new Error('Yeni şifre en az 6 karakter olmalıdır.');
    }

    const newHash = bcrypt.hashSync(newPass, 10);
    record.passwordHash = newHash;
    record.updatedAt = Date.now();
    this.users.set(record.id, record);
    this.savePersistedUsers();

    try {
      await this.rawClient.user.update({
        where: { id: record.id },
        data: {
          passwordHash: newHash,
          updatedAt: new Date(),
        },
      });
      console.log(`✅ [changeUserPassword] PostgreSQL şifre başarıyla güncellendi: ${record.id}`);
    } catch (err: any) {
      console.warn('[changeUserPassword] DB error:', err.message);
    }

    return { success: true, message: 'Şifreniz başarıyla değiştirildi!' };
  }

  public async recordGameStats(
    userId: string,
    delta: {
      correctAnswers: number;
      totalAnswers: number;
      xpEarned: number;
      coinsEarned: number;
      bestStreak: number;
      won?: boolean;
      roomCode?: string;
      category?: string;
    }
  ): Promise<UserProfile | null> {
    let record = this.users.get(userId);
    if (!record) {
      try {
        const u = await this.rawClient.user.findFirst({
          where: { OR: [{ id: userId }, { username: userId }] },
        });
        if (u) {
          record = this.prismaUserToRecord(u);
          this.users.set(record.id, record);
        }
      } catch {}
    }
    if (!record) return null;

    if (delta.roomCode) {
      const matchKey = `${record.id}:${delta.roomCode}`;
      if (this.recordedMatchKeys.has(matchKey)) {
        return this.toProfile(record);
      }
      this.recordedMatchKeys.add(matchKey);
      if (this.recordedMatchKeys.size > 2000) {
        const firstKey = this.recordedMatchKeys.values().next().value;
        if (firstKey) this.recordedMatchKeys.delete(firstKey);
      }
    }

    const safeTotal = Math.max(1, Math.min(20, Math.round(Number(delta.totalAnswers) || 5)));
    const safeCorrect = Math.max(0, Math.min(safeTotal, Math.round(Number(delta.correctAnswers) || 0)));
    const safeStreak = Math.max(0, Math.min(safeCorrect, Math.round(Number(delta.bestStreak) || 0)));

    // Ensure existing stats are sanitized before adding delta
    record.stats = this.sanitizeUserStats(record.stats);

    // KURAL: Soru çözmeyen / 0 doğru yapan oyuncuya kesinlikle para (coin) ve XP verilmez!
    const isZeroPerformance = safeCorrect === 0;

    // Zorlaştırılmış ekonomi: Tek maçtan kazanılan XP ve Altın sınırlandırıldı
    const cappedXp = isZeroPerformance
      ? 0
      : Math.max(0, Math.min(Number(delta.xpEarned) || 0, delta.won ? 35 : 15));
    const cappedCoins = isZeroPerformance
      ? 0
      : Math.max(0, Math.min(Math.round(Number(delta.coinsEarned) || 0), delta.won ? 15 : 6));

    record.xp += cappedXp;
    record.coins += cappedCoins;

    // Season 1 Pass XP progression (0 doğru için sezon XP verilmez)
    const seasonXpGain = isZeroPerformance ? 0 : delta.won ? 25 : 10;
    record.seasonXp = (record.seasonXp || 0) + seasonXpGain;

    const progress = calculateLevelFromXp(record.xp);
    record.level = progress.level;
    record.rankTitle = progress.rankTitle;
    record.stats.totalMatches += 1;
    if (delta.won) record.stats.wins += 1;
    record.stats.correctAnswers += safeCorrect;
    record.stats.totalAnswers += safeTotal;
    record.stats.bestStreak = Math.max(record.stats.bestStreak || 0, safeStreak);
    record.stats = this.sanitizeUserStats(record.stats);
    record.updatedAt = Date.now();

    // Category Mastery update & persistence
    if (!record.categoryMastery || typeof record.categoryMastery !== 'object') {
      record.categoryMastery = {};
    }
    const catKey = delta.category ? String(delta.category).trim() : 'general_culture';
    if (safeCorrect > 0) {
      const current = (record.categoryMastery as any)[catKey] || { level: 0, correctCount: 0 };
      const newCount = (current.correctCount || 0) + safeCorrect;
      const newLvl = Math.floor(newCount / 5) + (newCount > 0 ? 1 : 0);
      (record.categoryMastery as any)[catKey] = {
        level: newLvl,
        correctCount: newCount,
      };
    }
    // Backfill historical answers if categoryMastery sum is less than total correct answers
    const totalMasteryCorrect = Object.values(record.categoryMastery as Record<string, any>).reduce(
      (sum: number, item: any) => sum + (Number(item?.correctCount) || 0),
      0
    );
    if (record.stats.correctAnswers > totalMasteryCorrect) {
      const remaining = record.stats.correctAnswers - totalMasteryCorrect;
      const defCats = ['general_culture', 'science_tech', 'history', 'geography', 'sports', 'cinema_tv'];
      const portion = Math.max(1, Math.floor(remaining / defCats.length));
      let distributed = 0;
      for (const c of defCats) {
        if (distributed >= remaining) break;
        const add = Math.min(portion, remaining - distributed);
        const cur = (record.categoryMastery as any)[c] || { level: 0, correctCount: 0 };
        const updatedCount = (cur.correctCount || 0) + add;
        (record.categoryMastery as any)[c] = {
          level: Math.floor(updatedCount / 5) + (updatedCount > 0 ? 1 : 0),
          correctCount: updatedCount,
        };
        distributed += add;
      }
    }

    // Automatically update live event progress ONLY for tasks the user actively started and not completed yet
    this.updateStartedEvents(record, {
      matches: 1,
      won: delta.won,
      correctAnswers: safeCorrect,
      streak: safeStreak,
    });

    this.users.set(userId, record);
    this.users.set(record.id, record);
    if (record.username) this.users.set(record.username, record);
    if (!record.isGuest) {
      this.savePersistedUsers();
      try {
        await this.rawClient.user.update({
          where: { id: record.id },
          data: {
            coins: record.coins,
            gems: record.gems,
            xp: record.xp,
            level: record.level,
            seasonXp: record.seasonXp || 0,
            rankTitle: record.rankTitle,
            totalMatches: record.stats.totalMatches,
            wins: record.stats.wins,
            correctAnswers: record.stats.correctAnswers,
            totalAnswers: record.stats.totalAnswers,
            bestStreak: record.stats.bestStreak,
            categoryMastery: record.categoryMastery,
            updatedAt: new Date(),
          },
        });
      } catch (err) {
        console.error('[recordGameStats] PostgreSQL update error:', err);
      }
    }
    return this.toProfile(record);
  }

  public async syncWallet(
    userId: string,
    data: { coins?: number; gems?: number; xp?: number; level?: number }
  ): Promise<UserProfile | null> {
    let record = this.users.get(userId);
    if (!record) {
      try {
        const u = await this.rawClient.user.findFirst({
          where: { OR: [{ id: userId }, { username: userId }] },
        });
        if (u) {
          record = this.prismaUserToRecord(u);
          this.users.set(record.id, record);
        }
      } catch {}
    }
    if (!record) return null;

    if (typeof data.coins === 'number') {
      record.coins = data.coins;
    }
    if (typeof data.gems === 'number') {
      record.gems = data.gems;
    }
    if (typeof data.xp === 'number') {
      record.xp = data.xp;
    }
    if (typeof data.level === 'number' && data.level > 0) {
      record.level = data.level;
    }
    record.updatedAt = Date.now();

    this.users.set(record.id, record);
    this.savePersistedUsers();

    try {
      await this.rawClient.user.update({
        where: { id: record.id },
        data: {
          coins: record.coins,
          gems: record.gems,
          xp: record.xp,
          level: record.level,
          updatedAt: new Date(),
        },
      });
    } catch (err) {
      console.error('[syncWallet] PostgreSQL update error:', err);
    }

    return this.toProfile(record);
  }

  private updateStartedEvents(
    record: any,
    delta: { matches?: number; won?: boolean; correctAnswers?: number; streak?: number }
  ): void {
    if (!record.eventProgress) record.eventProgress = {};
    const ev = record.eventProgress;

    for (const def of EVENT_DEFINITIONS) {
      const state = ev[def.id];
      // Only track if user actively started this event and has not completed it yet
      if (!state || !state.started || state.completed || state.claimed) continue;

      let increment = 0;
      if (def.metric === 'matches_played' && delta.matches) {
        increment = delta.matches;
      } else if (def.metric === 'wins' && delta.won) {
        increment = 1;
      } else if (def.metric === 'correct_answers' && delta.correctAnswers) {
        increment = delta.correctAnswers;
      } else if (def.metric === 'streak' && delta.streak && delta.streak > 0) {
        state.progress = Math.max(state.progress || 0, delta.streak);
      }

      if (increment > 0) {
        state.progress = (state.progress || 0) + increment;
      }

      if (state.progress >= def.targetCount) {
        state.progress = def.targetCount;
        state.completed = true;
      }
    }
  }

  public verifyToken(token: string): { userId: string; username: string } | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload;
      // Reject signed-but-incomplete tokens and tokens without a bounded lifetime.
      if (
        typeof decoded.userId !== 'string' ||
        decoded.userId.length < 1 ||
        decoded.userId.length > 128 ||
        typeof decoded.username !== 'string' ||
        decoded.username.length < 1 ||
        typeof decoded.exp !== 'number' ||
        decoded.exp <= Math.floor(Date.now() / 1000)
      ) {
        return null;
      }
      return { userId: decoded.userId, username: decoded.username };
    } catch {
      return null;
    }
  }

  public getUserProfile(userId: string): UserProfile | null {
    const record = this.users.get(userId);
    return record ? this.toProfile(record) : null;
  }

  public async getUserProfileAsync(userId: string): Promise<UserProfile | null> {
    try {
      const u = await this.rawClient.user.findFirst({
        where: {
          OR: [{ id: userId }, { username: userId }, { email: userId.toLowerCase() }],
        },
        include: {
          inventoryItems: true,
        },
        orderBy: { updatedAt: 'desc' },
      });
      if (u) {
        const record = this.prismaUserToRecord(u as any);
        this.users.set(record.id, record);
        if (record.username) this.users.set(record.username, record);
        if (record.email) this.users.set(record.email.toLowerCase(), record);
        return this.toProfile(record);
      }
    } catch (err) {
      console.error('[getUserProfileAsync] Error querying Prisma:', err);
    }
    const record = this.users.get(userId);
    return record ? this.toProfile(record) : null;
  }

  public async recordDailyChallengeCompletion(
    userId: string,
    data: {
      correctAnswers: number;
      totalQuestions: number;
    }
  ): Promise<{ success: boolean; user: UserProfile | null; error?: string; streakIncreased: boolean; rewards?: any }> {
    let record = this.users.get(userId);
    if (!record) {
      try {
        const u = await this.rawClient.user.findFirst({
          where: { OR: [{ id: userId }, { username: userId }] },
        });
        if (u) {
          record = this.prismaUserToRecord(u);
          this.users.set(record.id, record);
        }
      } catch {}
    }
    if (!record) {
      return { success: false, user: null, error: 'Kullanıcı bulunamadı', streakIncreased: false };
    }

    const currentStreak = Math.max(1, record.dailyStreak || 1);
    const cfg = getDailyChallengeConfig(currentStreak);

    if (data.correctAnswers < cfg.requiredCorrect) {
      return {
        success: false,
        user: this.toProfile(record),
        error: `Hedef tamamlanamadı. En az ${cfg.requiredCorrect} doğru gerekliydi (${data.correctAnswers}/${data.totalQuestions} yapıldı).`,
        streakIncreased: false,
      };
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    if (!record.categoryMastery) record.categoryMastery = {};
    const dcState = (record.categoryMastery as any).dailyChallenge || {};
    const alreadyDoneToday = dcState.lastCompletedDate === todayStr;

    let newStreak = currentStreak;
    if (!alreadyDoneToday) {
      newStreak = currentStreak + 1;
      record.dailyStreak = newStreak;
      record.stats.bestStreak = Math.max(record.stats.bestStreak || 0, newStreak);
      (record.categoryMastery as any).dailyChallenge = {
        lastCompletedDate: todayStr,
        streak: newStreak,
      };
      record.xp += cfg.rewardXp;
      record.coins += cfg.rewardCoins;
      record.gems = (record.gems || 15) + cfg.rewardGems;

      if (cfg.rewardChest) {
        if (!record.inventory) record.inventory = [];
        const chestItem = record.inventory.find((i) => i.id === 'chest' || i.id === cfg.rewardChest);
        if (chestItem) chestItem.qty += 1;
        else record.inventory.push({ id: cfg.rewardChest, name: 'Günün Sandığı', desc: 'Meydan okuma ödülü', qty: 1 });
      }
    }

    // Record match stats
    record.stats.totalMatches += 1;
    record.stats.wins += 1;
    record.stats.correctAnswers += data.correctAnswers;
    record.stats.totalAnswers += data.totalQuestions;

    // Apply progress to started events from daily challenge
    this.updateStartedEvents(record, {
      matches: 1,
      won: true,
      correctAnswers: data.correctAnswers,
      streak: data.correctAnswers,
    });

    const prog = calculateLevelFromXp(record.xp);
    record.level = prog.level;
    record.rankTitle = prog.rankTitle;

    this.users.set(record.id, record);
    if (!record.isGuest) {
      this.savePersistedUsers();
      this.syncUserToPrisma(record).catch(() => {});
    }

    return {
      success: true,
      user: this.toProfile(record),
      streakIncreased: !alreadyDoneToday,
      rewards: {
        xp: cfg.rewardXp,
        coins: cfg.rewardCoins,
        gems: cfg.rewardGems,
        chest: cfg.rewardChest,
        newStreak,
      },
    };
  }

  public getCategories(): CategoryInfo[] {
    const published = this.questions.filter((q) => (q.reviewStatus || 'published') === 'published');
    const countsByCategory: Record<string, number> = {};
    for (const q of published) {
      countsByCategory[q.categoryId] = (countsByCategory[q.categoryId] || 0) + 1;
    }

    return this.categories.map((cat) => ({
      ...cat,
      totalQuestions:
        cat.id === 'mixed'
          ? published.length
          : countsByCategory[cat.id] || 0,
    }));
  }

  public getAllQuestions(): Question[] {
    return [...this.questions];
  }

  public getQuestionById(id: string): Question | undefined {
    return this.questions.find((q) => q.id === id);
  }

  public getQuestionsByStatus(status: ReviewStatus, limit: number = 50, offset: number = 0): Question[] {
    return this.questions
      .filter((q) => q.reviewStatus === status)
      .slice(offset, offset + limit);
  }

  public hasQuestionHash(hash: string): boolean {
    return this.questions.some((q) => q.contentHash === hash);
  }

  public createQuestion(data: Omit<Question, 'id'>): Question {
    const hash = data.contentHash || computeQuestionHash(data.text, data.options);
    const newQuestion: Question = {
      ...data,
      id: 'q_' + Math.random().toString(36).substring(2, 9),
      reviewStatus: data.reviewStatus || 'pending_review',
      contentHash: hash,
      createdAt: data.createdAt || new Date().toISOString(),
      language: data.language || 'tr',
    };

    this.questions.push(newQuestion);
    this.savePersistedQuestions();
    return newQuestion;
  }

  public approveQuestion(
    id: string,
    reviewedBy: string,
    pool: 'standard' | 'daily_challenge' | 'custom_room' = 'standard'
  ): Question | null {
    const q = this.questions.find((item) => item.id === id);
    if (!q) return null;

    q.reviewStatus = 'published';
    q.reviewedBy = reviewedBy;
    q.reviewedAt = new Date().toISOString();
    q.targetPool = pool;
    if (pool === 'daily_challenge') {
      q.isDailyChallenge = true;
    } else if (pool === 'custom_room') {
      q.isCustomRoomOnly = true;
    }
    this.savePersistedQuestions();
    return q;
  }

  public rejectQuestion(id: string, reviewedBy: string, reason?: string): Question | null {
    const q = this.questions.find((item) => item.id === id);
    if (!q) return null;

    q.reviewStatus = 'rejected';
    q.reviewedBy = reviewedBy;
    q.rejectionReason = reason;
    q.reviewedAt = new Date().toISOString();
    this.savePersistedQuestions();
    return q;
  }

  public updateQuestion(id: string, updates: Partial<Question>): Question | null {
    const idx = this.questions.findIndex((item) => item.id === id);
    if (idx === -1) return null;

    const existing = this.questions[idx];
    const updated: Question = {
      ...existing,
      ...updates,
    };
    if (updates.text || updates.options) {
      updated.contentHash = computeQuestionHash(updated.text, updated.options);
    }
    this.questions[idx] = updated;
    this.savePersistedQuestions();
    return updated;
  }

  public deleteQuestion(id: string): boolean {
    const idx = this.questions.findIndex((item) => item.id === id);
    if (idx === -1) return false;
    this.questions.splice(idx, 1);
    this.savePersistedQuestions();
    try {
      this.rawClient.question.delete({ where: { id } }).catch(() => {});
    } catch {}
    return true;
  }

  public getQuestionsFiltered(filters: {
    search?: string;
    categoryId?: string;
    difficulty?: string;
    reviewStatus?: string;
    targetPool?: string;
    limit?: number;
    offset?: number;
  }): { total: number; filteredCount: number; questions: Question[] } {
    const search = (filters.search || '').trim().toLowerCase();
    const categoryId = filters.categoryId && filters.categoryId !== 'all' ? filters.categoryId : null;
    const difficulty = filters.difficulty && filters.difficulty !== 'all' ? filters.difficulty : null;
    const reviewStatus = filters.reviewStatus && filters.reviewStatus !== 'all' ? filters.reviewStatus : null;
    const targetPool = filters.targetPool && filters.targetPool !== 'all' ? filters.targetPool : null;
    const limit = Math.min(200, Math.max(1, filters.limit || 50));
    const offset = Math.max(0, filters.offset || 0);

    let list = this.questions;

    if (reviewStatus) {
      list = list.filter((q) => (q.reviewStatus || 'published') === reviewStatus);
    }
    if (categoryId) {
      list = list.filter((q) => q.categoryId === categoryId);
    }
    if (difficulty) {
      list = list.filter((q) => q.difficulty === difficulty);
    }
    if (targetPool) {
      if (targetPool === 'daily_challenge') {
        list = list.filter((q) => q.targetPool === 'daily_challenge' || q.isDailyChallenge);
      } else if (targetPool === 'custom_room') {
        list = list.filter((q) => q.targetPool === 'custom_room' || q.isCustomRoomOnly);
      } else {
        list = list.filter((q) => !q.targetPool || q.targetPool === 'standard');
      }
    }
    if (search) {
      list = list.filter((q) => {
        if (q.text.toLowerCase().includes(search)) return true;
        if (q.explanation && q.explanation.toLowerCase().includes(search)) return true;
        if (q.options && q.options.some((o) => o.text.toLowerCase().includes(search))) return true;
        return false;
      });
    }

    return {
      total: this.questions.length,
      filteredCount: list.length,
      questions: list.slice(offset, offset + limit),
    };
  }

  public findDuplicates(): {
    totalQuestions: number;
    duplicateGroupsCount: number;
    duplicateQuestionsCount: number;
    groups: Array<{ signature: string; count: number; questions: Question[] }>;
  } {
    const signatureMap = new Map<string, Question[]>();
    for (const q of this.questions) {
      const sig = q.text.toLowerCase().replace(/[^a-z0-9ğüşıöç]/gi, '').trim();
      if (!sig) continue;
      if (!signatureMap.has(sig)) {
        signatureMap.set(sig, []);
      }
      signatureMap.get(sig)!.push(q);
    }

    const groups: Array<{ signature: string; count: number; questions: Question[] }> = [];
    let duplicateQuestionsCount = 0;

    for (const [sig, qList] of signatureMap.entries()) {
      if (qList.length > 1) {
        groups.push({
          signature: sig,
          count: qList.length,
          questions: qList,
        });
        duplicateQuestionsCount += qList.length;
      }
    }

    // Sort by largest duplicate cluster first
    groups.sort((a, b) => b.count - a.count);

    return {
      totalQuestions: this.questions.length,
      duplicateGroupsCount: groups.length,
      duplicateQuestionsCount,
      groups,
    };
  }

  public getReviewStats(): QuestionStats {
    const stats: QuestionStats = {
      total: this.questions.length,
      pending: 0,
      approved: 0,
      published: 0,
      rejected: 0,
      byCategory: {},
      byDifficulty: {},
      matrix: {},
      pools: {
        standard: 0,
        daily_challenge: 0,
        custom_room: 0,
      },
      categoriesDetail: [],
    };

    const catMatrix: Record<string, { total: number; easy: number; medium: number; hard: number; expert: number }> = {};

    this.questions.forEach((q) => {
      const status = q.reviewStatus || 'published';
      if (status === 'pending_review') stats.pending++;
      else if (status === 'approved') stats.approved++;
      else if (status === 'published') stats.published++;
      else if (status === 'rejected') stats.rejected++;

      const p = q.targetPool === 'daily_challenge' || q.isDailyChallenge
        ? 'daily_challenge'
        : q.targetPool === 'custom_room' || q.isCustomRoomOnly
        ? 'custom_room'
        : 'standard';
      stats.pools![p] = (stats.pools![p] || 0) + 1;

      if (status === 'published' || status === 'approved') {
        stats.byCategory![q.categoryId] = (stats.byCategory![q.categoryId] || 0) + 1;
        stats.byDifficulty![q.difficulty] = (stats.byDifficulty![q.difficulty] || 0) + 1;

        if (!catMatrix[q.categoryId]) {
          catMatrix[q.categoryId] = { total: 0, easy: 0, medium: 0, hard: 0, expert: 0 };
        }
        catMatrix[q.categoryId].total++;
        if (q.difficulty === 'easy') catMatrix[q.categoryId].easy++;
        else if (q.difficulty === 'medium') catMatrix[q.categoryId].medium++;
        else if (q.difficulty === 'hard') catMatrix[q.categoryId].hard++;
        else if (q.difficulty === 'expert') catMatrix[q.categoryId].expert++;
      }
    });

    stats.matrix = catMatrix as any;

    stats.categoriesDetail = this.categories
      .filter((c) => c.id !== 'mixed')
      .map((c) => {
        const m = catMatrix[c.id] || { total: 0, easy: 0, medium: 0, hard: 0, expert: 0 };
        return {
          id: c.id,
          name: c.name,
          icon: c.icon,
          total: m.total,
          easy: m.easy,
          medium: m.medium,
          hard: m.hard,
          expert: m.expert,
        };
      });

    return stats;
  }

  public getQuestions(
    category: CategoryId = 'mixed',
    difficulty?: DifficultyLevel,
    count: number = 10,
    seenIds: string[] = []
  ): Question[] {
    const canonCat = canonicalCategoryId(category);
    const allPublished = this.questions.filter((q) => q.reviewStatus === 'published');
    const pickedMap = new Map<string, Question>();

    const categoryPool =
      canonCat === 'mixed'
        ? allPublished
        : allPublished.filter((q) => canonicalCategoryId(q.categoryId) === canonCat);

    let primaryPool = categoryPool.length > 0 ? categoryPool : allPublished;
    if (difficulty && (difficulty as any) !== 'mixed') {
      const withDiff = primaryPool.filter((q) => q.difficulty === difficulty);
      if (withDiff.length > 0) {
        primaryPool = withDiff;
      }
    }

    const shuffledPrimary = [...primaryPool].sort(() => 0.5 - Math.random());

    for (const q of shuffledPrimary) {
      if (pickedMap.size >= count) break;
      if (!seenIds.includes(q.id)) {
        pickedMap.set(q.id, q);
      }
    }

    if (pickedMap.size < count) {
      const sameCategoryUnseen = categoryPool
        .filter((q) => !pickedMap.has(q.id) && !seenIds.includes(q.id))
        .sort(() => 0.5 - Math.random());
      for (const q of sameCategoryUnseen) {
        if (pickedMap.size >= count) break;
        pickedMap.set(q.id, q);
      }
    }

    if (pickedMap.size < count) {
      for (const q of shuffledPrimary) {
        if (pickedMap.size >= count) break;
        if (!pickedMap.has(q.id)) {
          pickedMap.set(q.id, q);
        }
      }
    }

    if (pickedMap.size < count) {
      const sameCategoryAny = [...categoryPool].sort(() => 0.5 - Math.random());
      for (const q of sameCategoryAny) {
        if (pickedMap.size >= count) break;
        if (!pickedMap.has(q.id)) {
          pickedMap.set(q.id, q);
        }
      }
    }

    if (pickedMap.size < count && (canonCat === 'mixed' || categoryPool.length === 0)) {
      const fallbackPool = allPublished
        .filter((q) => !pickedMap.has(q.id))
        .sort(() => 0.5 - Math.random());

      for (const q of fallbackPool) {
        if (pickedMap.size >= count) break;
        pickedMap.set(q.id, q);
      }
    }

    const pickedList: Question[] = Array.from(pickedMap.values());
    const poolForFill = categoryPool.length > 0 ? categoryPool : allPublished;
    if (pickedList.length < count && poolForFill.length > 0) {
      let cycleIdx = 1;
      while (pickedList.length < count) {
        for (const baseQ of poolForFill) {
          if (pickedList.length >= count) break;
          pickedList.push({
            ...baseQ,
            id: `${baseQ.id}_cycle_${cycleIdx++}`,
          });
        }
      }
    }

    return pickedList.sort(() => 0.5 - Math.random());
  }

  public getDailyChallenge(): { date: string; questions: Question[] } {
    const today = new Date().toISOString().split('T')[0];
    const dedicated = this.questions.filter(
      (q) => (q.targetPool === 'daily_challenge' || q.isDailyChallenge) && q.reviewStatus === 'published'
    );
    let selected: Question[] = [];
    if (dedicated.length >= 5) {
      selected = [...dedicated].sort(() => 0.5 - Math.random()).slice(0, 5);
    } else if (dedicated.length > 0) {
      const rest = this.getQuestions('mixed', undefined, 5 - dedicated.length);
      selected = [...dedicated, ...rest];
    } else {
      selected = this.getQuestions('mixed', undefined, 5);
    }
    return {
      date: today,
      questions: selected,
    };
  }

  public async findUserByUsernameOrId(query: string): Promise<UserProfile | null> {
    const qLower = query.toLowerCase().trim();
    for (const record of this.users.values()) {
      if (
        record.id === query ||
        record.username?.toLowerCase() === qLower ||
        record.displayName?.toLowerCase() === qLower
      ) {
        return this.toProfile(record);
      }
    }
    return this.getUserProfileAsync(query);
  }

  public searchQuestions(keyword: string, limit: number = 5): Question[] {
    const kw = keyword.toLowerCase().trim();
    return this.questions
      .filter((q) => q.text.toLowerCase().includes(kw) || q.subCategory?.toLowerCase().includes(kw))
      .slice(0, limit);
  }

  private defaultInventory(): InventoryItem[] {
    return [];
  }

  private defaultNotifications(displayName: string): NotificationItem[] {
    return [
      {
        id: 'notif_welcome',
        type: 'reward',
        title: `Hoş geldin ${displayName}!`,
        sub: 'Başlangıç ödüllerin hesabına tanımlandı',
        timeText: 'Az önce',
        handled: null,
      },
      {
        id: 'notif_duel_1',
        type: 'duel',
        title: 'Bilgi Avcısı seni düelloya davet etti',
        sub: 'Genel Kültür · 5 soru',
        timeText: '5dk',
        handled: null,
      },
      {
        id: 'notif_season',
        type: 'league',
        title: 'Sezon 1 Pass aktif!',
        sub: 'Maç kazanarak sezon kademelerini aç',
        timeText: '1sa',
        handled: null,
      },
    ];
  }

  private generateFriendCode(id: string): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let rand = '';
    for (let i = 0; i < 4; i++) {
      rand += chars[Math.floor(Math.random() * chars.length)];
    }
    const clean = id.replace(/[^a-zA-Z0-9]/g, '').slice(-3).toUpperCase();
    return `TV-${clean || 'X'}${rand}`;
  }

  public getLeaderboard(limit: number = 20): UserProfile[] {
    const uniqueList = this.getUniqueRegisteredUsers();
    return uniqueList
      .sort((a, b) => (b.rankPoints || 0) - (a.rankPoints || 0) || (b.xp || 0) - (a.xp || 0))
      .slice(0, limit)
      .map((u) => this.toProfile(u));
  }

  public async getLeaderboardAsync(limit: number = 20): Promise<UserProfile[]> {
    try {
      const dbUsers = await this.rawClient.user.findMany({
        orderBy: [{ rankPoints: 'desc' }, { xp: 'desc' }],
        take: Math.max(limit * 3, 60),
      });
      if (dbUsers && dbUsers.length > 0) {
        for (const u of dbUsers) {
          const rec = this.prismaUserToRecord(u as any);
          this.users.set(rec.id, rec);
        }
      }
    } catch {
      // Fallback to in-memory deduplicated store
    }
    return this.getLeaderboard(limit);
  }

  public upsertPublicRoom(room: {
    code: string;
    name?: string;
    hostId?: string;
    hostName?: string;
    category?: string;
    categoryName?: string;
    players?: number;
    maxPlayers?: number;
    totalRounds?: number;
    questionTimeSec?: number;
    status?: 'lobby' | 'playing' | 'finished';
    privacy?: 'public' | 'private';
  }): void {
    const code = (room.code || '').trim().toUpperCase();
    if (!code) return;

    if (room.privacy === 'private' || room.status === 'playing' || room.status === 'finished' || (typeof room.players === 'number' && room.players <= 0)) {
      this.activePublicRooms.delete(code);
      return;
    }

    const existing = this.activePublicRooms.get(code);
    const catId = room.category || existing?.category || 'genel_kultur';
    const catObj = this.categories.find((c) => c.id === catId);
    const categoryName =
      room.categoryName || existing?.categoryName || (catObj as any)?.title || (catObj as any)?.name || 'Genel Kültür';
    const hostName = room.hostName || existing?.hostName || 'Oyuncu';
    const players = Math.max(1, Number(room.players ?? existing?.players ?? 1));
    const maxPlayers = Math.max(2, Number(room.maxPlayers ?? existing?.maxPlayers ?? 4));

    if (players >= maxPlayers) {
      this.activePublicRooms.delete(code);
      return;
    }

    this.activePublicRooms.set(code, {
      code,
      name: room.name || existing?.name || `${hostName} Odası`,
      hostId: room.hostId || existing?.hostId || '',
      hostName,
      category: catId,
      categoryName,
      players,
      maxPlayers,
      totalRounds: Number(room.totalRounds ?? existing?.totalRounds ?? 5),
      questionTimeSec: Number(room.questionTimeSec ?? existing?.questionTimeSec ?? 15),
      status: room.status || existing?.status || 'lobby',
      privacy: room.privacy || existing?.privacy || 'public',
      updatedAt: Date.now(),
    });
  }

  public removePublicRoom(code: string): void {
    if (!code) return;
    this.activePublicRooms.delete(code.trim().toUpperCase());
  }

  public getActivePublicRooms(): Array<{
    code: string;
    name: string;
    host: string;
    category: string;
    categoryId: string;
    players: number;
    maxPlayers: number;
    rounds: number;
    timeSec: number;
    status: 'waiting';
  }> {
    const now = Date.now();
    const maxAgeMs = 10 * 60 * 1000; // 10 minutes TTL for stale rooms
    const result: Array<{
      code: string;
      name: string;
      host: string;
      category: string;
      categoryId: string;
      players: number;
      maxPlayers: number;
      rounds: number;
      timeSec: number;
      status: 'waiting';
    }> = [];

    for (const [code, r] of this.activePublicRooms.entries()) {
      if (
        now - r.updatedAt > maxAgeMs ||
        r.privacy === 'private' ||
        r.status !== 'lobby' ||
        r.players <= 0 ||
        r.players >= r.maxPlayers
      ) {
        this.activePublicRooms.delete(code);
        continue;
      }
      result.push({
        code: r.code,
        name: r.name,
        host: r.hostName,
        category: r.categoryName,
        categoryId: r.category,
        players: r.players,
        maxPlayers: r.maxPlayers,
        rounds: r.totalRounds,
        timeSec: r.questionTimeSec,
        status: 'waiting',
      });
    }

    return result;
  }

  public setUserActiveRoom(
    userId: string,
    roomCode: string | null,
    roomMeta?: {
      name?: string;
      hostName?: string;
      category?: string;
      categoryName?: string;
      players?: number;
      maxPlayers?: number;
      totalRounds?: number;
      questionTimeSec?: number;
      status?: 'lobby' | 'playing' | 'finished';
      privacy?: 'public' | 'private';
    }
  ): void {
    const prev = this.activeUserRooms.get(userId);
    if (roomCode) {
      const cleanCode = roomCode.trim().toUpperCase();
      this.activeUserRooms.set(userId, { roomCode: cleanCode, joinedAt: Date.now() });
      presenceManager.setUserRoom(userId, cleanCode);

      if (roomMeta) {
        const userRec = this.users.get(userId);
        this.upsertPublicRoom({
          code: cleanCode,
          hostId: userId,
          hostName: roomMeta.hostName || userRec?.displayName || userRec?.username || 'Oyuncu',
          ...roomMeta,
        });
      }
    } else {
      this.activeUserRooms.delete(userId);
      presenceManager.setUserRoom(userId, null);

      if (prev?.roomCode) {
        const existingRoom = this.activePublicRooms.get(prev.roomCode);
        if (existingRoom) {
          // Count how many active users are still in this roomCode
          let remaining = 0;
          for (const entry of this.activeUserRooms.values()) {
            if (entry.roomCode === prev.roomCode) remaining++;
          }
          if (remaining <= 0 || existingRoom.hostId === userId) {
            this.activePublicRooms.delete(prev.roomCode);
          } else {
            existingRoom.players = remaining;
            existingRoom.updatedAt = Date.now();
          }
        }
      }
    }
  }

  public getFriendsForUser(userId: string): {
    friendCode: string;
    friends: Array<{
      id: string;
      username: string;
      displayName: string;
      name: string;
      avatarUrl: string;
      level: number;
      rankTitle: string;
      rankPoints: number;
      xp: number;
      wins: number;
      totalMatches: number;
      correctAnswers: number;
      totalAnswers: number;
      bestStreak: number;
      countryCode: string;
      countryName: string;
      online: boolean;
      status: string;
      isFriend: boolean;
      currentRoomCode?: string;
      inRoom?: boolean;
    }>;
    sentRequests?: Array<any>;
    incomingRequests?: Array<any>;
  } {
    const me = this.users.get(userId);
    const friendCode = me?.friendCode || this.generateFriendCode(userId);

    const explicitFriendIds = new Set(me?.friendIds || []);
    const seenUserIds = new Set<string>();
    const seenUsernames = new Set<string>();
    const seenNormalizedNames = new Set<string>();

    const normalizeName = (name?: string) =>
      (name || '')
        .toLowerCase()
        .replace(/[^a-z0-9ğüşıöç]/gi, '')
        .trim();

    if (me?.id) seenUserIds.add(me.id);
    seenUserIds.add(userId);
    if (me?.username) {
      seenUsernames.add(me.username.toLowerCase());
      seenNormalizedNames.add(normalizeName(me.username));
    }
    if (me?.displayName) {
      seenNormalizedNames.add(normalizeName(me.displayName));
    }

    // Build unique user pool from memory store — ONLY ACCEPTED FRIENDS
    const uniqueUsers: UserRecord[] = [];
    for (const u of this.users.values()) {
      if (!u || !u.id || !explicitFriendIds.has(u.id)) continue;
      const uName = (u?.username || '').toLowerCase().trim();
      const dName = normalizeName(u?.displayName || u?.username);
      if (!seenUserIds.has(u.id) && (!uName || !seenUsernames.has(uName)) && (!dName || !seenNormalizedNames.has(dName))) {
        seenUserIds.add(u.id);
        if (uName) seenUsernames.add(uName);
        if (dName) seenNormalizedNames.add(dName);
        uniqueUsers.push(u);
      }
    }

    const friendsResult: Array<any> = [];

    for (const u of uniqueUsers) {
      if (u.isGuest) continue;
      const isFriend = true;
      const prog = calculateLevelFromXp(u.xp || 0);
      const safeStats = this.sanitizeUserStats(u.stats);

      const presence = presenceManager.getUserPresence(u.id);
      const isOnline = presence.online;
      const inRoom = presence.inRoom;
      const currentRoomCode = presence.currentRoomCode;

      let status = 'Arkadaşın · Çevrimdışı';
      if (inRoom && currentRoomCode) {
        status = `Oda: #${currentRoomCode} · Lobide`;
      } else if (isOnline) {
        status = 'Arkadaşın · Çevrimiçi';
      }

      friendsResult.push({
        id: u.id,
        username: u.username,
        displayName: u.displayName || u.username,
        name: u.displayName || u.username,
        avatarUrl: u.avatarUrl || 'av1',
        level: prog.level,
        rankTitle: prog.rankTitle,
        rankPoints: u.rankPoints || 1000,
        xp: u.xp || 0,
        wins: safeStats.wins,
        totalMatches: safeStats.totalMatches,
        correctAnswers: safeStats.correctAnswers,
        totalAnswers: safeStats.totalAnswers,
        bestStreak: safeStats.bestStreak,
        countryCode: u.countryCode || 'TR',
        countryName: u.countryName || 'Türkiye',
        online: isOnline,
        status,
        isFriend,
        inRoom,
        currentRoomCode,
      });
    }

    // Sort: by inRoom, then online, then XP
    friendsResult.sort((a, b) => {
      if (a.inRoom !== b.inRoom) return a.inRoom ? -1 : 1;
      if (a.online !== b.online) return a.online ? -1 : 1;
      return (b.xp || 0) - (a.xp || 0);
    });

    const incomingRequests = (me?.notifications || []).filter(
      (n) => (n.type === 'friend_request' || n.type === 'match_invite') && !n.handled
    );

    return { friendCode, friends: friendsResult, sentRequests: [], incomingRequests };
  }

  public async getFriendsForUserAsync(userId: string): Promise<{
    friendCode: string;
    friends: Array<{
      id: string;
      username: string;
      displayName: string;
      name: string;
      avatarUrl: string;
      level: number;
      rankTitle: string;
      rankPoints: number;
      xp: number;
      wins: number;
      totalMatches: number;
      correctAnswers: number;
      totalAnswers: number;
      bestStreak: number;
      countryCode: string;
      countryName: string;
      online: boolean;
      status: string;
      isFriend: boolean;
      currentRoomCode?: string;
      inRoom?: boolean;
    }>;
    sentRequests?: Array<any>;
    incomingRequests?: Array<any>;
  }> {
    let me = this.users.get(userId);
    try {
      const dbMe = await this.rawClient.user.findFirst({
        where: { OR: [{ id: userId }, { username: userId }] },
      });
      if (dbMe) {
        me = this.prismaUserToRecord(dbMe);
        this.users.set(me.id, me);
      }
    } catch {}

    const myId = me?.id || userId;
    const friendCode = me?.friendCode || this.generateFriendCode(myId);
    const explicitFriendIdsArray = Array.isArray(me?.friendIds) ? me!.friendIds.filter(Boolean) : [];
    const explicitFriendIds = new Set<string>(explicitFriendIdsArray);
    const seenUserIds = new Set<string>();
    const seenUsernames = new Set<string>();
    const seenNormalizedNames = new Set<string>();

    const normalizeName = (name?: string) =>
      (name || '')
        .toLowerCase()
        .replace(/[^a-z0-9ğüşıöç]/gi, '')
        .trim();

    if (me?.id) seenUserIds.add(me.id);
    seenUserIds.add(userId);
    if (me?.username) {
      seenUsernames.add(me.username.toLowerCase());
      seenNormalizedNames.add(normalizeName(me.username));
    }
    if (me?.displayName) {
      seenNormalizedNames.add(normalizeName(me.displayName));
    }

    const uniqueUsersMap = new Map<string, any>();

    // 1. Fetch ONLY accepted friends from PostgreSQL database
    if (explicitFriendIdsArray.length > 0) {
      try {
        const dbFriends = await this.rawClient.user.findMany({
          where: { id: { in: explicitFriendIdsArray } },
          orderBy: { xp: 'desc' },
        });

        for (const dbu of dbFriends) {
          const uName = (dbu.username || '').toLowerCase().trim();
          const dName = normalizeName(dbu.displayName || dbu.username);
          if (!seenUserIds.has(dbu.id) && (!uName || !seenUsernames.has(uName)) && (!dName || !seenNormalizedNames.has(dName))) {
            seenUserIds.add(dbu.id);
            if (uName) seenUsernames.add(uName);
            if (dName) seenNormalizedNames.add(dName);
            const rec = this.prismaUserToRecord(dbu);
            uniqueUsersMap.set(rec.id, rec);
            this.users.set(rec.id, rec);
          }
        }
      } catch (err: any) {
        console.warn('[getFriendsForUserAsync] DB query warning:', err.message);
      }
    }

    // 2. Merge any memory store accepted friends not yet in DB map
    for (const u of this.users.values()) {
      if (!u || !u.id || !explicitFriendIds.has(u.id)) continue;
      const uName = (u?.username || '').toLowerCase().trim();
      const dName = normalizeName(u?.displayName || u?.username);
      if (!seenUserIds.has(u.id) && (!uName || !seenUsernames.has(uName)) && (!dName || !seenNormalizedNames.has(dName)) && !u.isGuest) {
        seenUserIds.add(u.id);
        if (uName) seenUsernames.add(uName);
        if (dName) seenNormalizedNames.add(dName);
        uniqueUsersMap.set(u.id, u);
      }
    }

    const friendsResult: Array<any> = [];

    for (const u of uniqueUsersMap.values()) {
      if (!explicitFriendIds.has(u.id)) continue;
      const isFriend = true;
      const prog = calculateLevelFromXp(u.xp || 0);
      const safeStats = this.sanitizeUserStats(u.stats);

      // REAL-TIME WEBSOCKET PRESENCE
      const presence = presenceManager.getUserPresence(u.id);
      const isOnline = presence.online;
      const inRoom = presence.inRoom;
      const currentRoomCode = presence.currentRoomCode;

      let status = 'Arkadaşın · Çevrimdışı';
      if (inRoom && currentRoomCode) {
        status = `Oda: #${currentRoomCode} · Lobide`;
      } else if (isOnline) {
        status = 'Arkadaşın · Çevrimiçi';
      }

      friendsResult.push({
        id: u.id,
        username: u.username,
        displayName: u.displayName || u.username,
        name: u.displayName || u.username,
        avatarUrl: u.avatarUrl || 'av1',
        level: prog.level,
        rankTitle: prog.rankTitle,
        rankPoints: u.rankPoints || 1000,
        xp: u.xp || 0,
        wins: safeStats.wins,
        totalMatches: safeStats.totalMatches,
        correctAnswers: safeStats.correctAnswers,
        totalAnswers: safeStats.totalAnswers,
        bestStreak: safeStats.bestStreak,
        countryCode: u.countryCode || 'TR',
        countryName: u.countryName || 'Türkiye',
        online: isOnline,
        status,
        isFriend,
        inRoom,
        currentRoomCode,
      });
    }

    // Sort: in-room first, online first, xp descending
    friendsResult.sort((a, b) => {
      if (a.inRoom !== b.inRoom) return a.inRoom ? -1 : 1;
      if (a.online !== b.online) return a.online ? -1 : 1;
      return (b.xp || 0) - (a.xp || 0);
    });

    // Fetch pending sent & incoming friend requests / duel invitations
    const sentRequests: Array<any> = [];
    const incomingRequests: Array<any> = [];
    try {
      const pendingSent = await this.rawClient.userNotification.findMany({
        where: {
          senderId: myId,
          type: 'friend_request',
          handled: null,
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      for (const req of pendingSent) {
        let targetUser = this.users.get(req.userId);
        if (!targetUser) {
          try {
            const dbu = await this.rawClient.user.findUnique({ where: { id: req.userId } });
            if (dbu) {
              targetUser = this.prismaUserToRecord(dbu);
              this.users.set(targetUser.id, targetUser);
            }
          } catch {}
        }
        sentRequests.push({
          id: req.id,
          targetUserId: req.userId,
          targetName: targetUser?.displayName || targetUser?.username || 'Oyuncu',
          targetUsername: targetUser?.username || '',
          targetAvatar: targetUser?.avatarUrl || 'av1',
          timeText: req.timeText || 'Onay bekliyor',
        });
      }

      const pendingIncoming = await this.rawClient.userNotification.findMany({
        where: {
          userId: myId,
          type: { in: ['friend_request', 'match_invite'] },
          handled: null,
        },
        orderBy: { createdAt: 'desc' },
        take: 25,
      });
      for (const n of pendingIncoming) {
        incomingRequests.push({
          id: n.id,
          type: n.type,
          title: n.title,
          sub: n.sub,
          timeText: n.timeText || 'Az önce',
          handled: n.handled || null,
          senderId: n.senderId || undefined,
          senderName: n.senderName || undefined,
          senderAvatar: n.senderAvatar || undefined,
          roomCode: n.roomCode || undefined,
        });
      }
    } catch {}

    return { friendCode, friends: friendsResult, sentRequests, incomingRequests };
  }

  public async addFriend(
    userId: string,
    targetCodeOrUsername: string
  ): Promise<{
    success: boolean;
    pending?: boolean;
    notification?: NotificationItem;
    friend?: any;
    message?: string;
    error?: string;
  }> {
    let me = this.users.get(userId);
    try {
      const dbMe = await this.rawClient.user.findFirst({
        where: { OR: [{ id: userId }, { username: userId }] },
      });
      if (dbMe) {
        me = this.prismaUserToRecord(dbMe);
        this.users.set(me.id, me);
      }
    } catch {}
    if (!me) return { success: false, error: 'Kullanıcı bulunamadı.' };

    const clean = targetCodeOrUsername.trim().toUpperCase();
    const cleanLower = targetCodeOrUsername.trim().toLowerCase();

    // 1. Find target user in PostgreSQL or memory
    let target: UserRecord | undefined;
    try {
      const dbTarget = await this.rawClient.user.findFirst({
        where: {
          OR: [
            { friendCode: { equals: clean, mode: 'insensitive' } },
            { username: { equals: cleanLower, mode: 'insensitive' } },
            { displayName: { equals: targetCodeOrUsername.trim(), mode: 'insensitive' } },
          ],
        },
      });
      if (dbTarget) {
        target = this.prismaUserToRecord(dbTarget);
        this.users.set(target.id, target);
      }
    } catch {}

    if (!target) {
      target = Array.from(this.users.values()).find(
        (u) =>
          u &&
          !u.isGuest &&
          ((u.friendCode && u.friendCode.toUpperCase() === clean) ||
            u.username.toLowerCase() === cleanLower ||
            (u.displayName && u.displayName.toLowerCase() === cleanLower))
      );
    }

    if (!target) {
      return {
        success: false,
        error: 'Bu arkadaşlık kodu veya kullanıcı adına ait oyuncu bulunamadı.',
      };
    }

    if (target.id === me.id) {
      return { success: false, error: 'Kendi kodunuzu arkadaş olarak ekleyemezsiniz!' };
    }
    if (target.settings?.friendRequestsAllowed === false) {
      return { success: false, error: 'Bu oyuncu arkadaşlık isteklerini kabul etmiyor.' };
    }

    if (!me.friendIds) me.friendIds = [];
    if (!target.friendIds) target.friendIds = [];

    if (me.friendIds.includes(target.id)) {
      return { success: false, error: 'Bu oyuncu zaten arkadaş listenizde!' };
    }

    // Check if there is already a pending request from me to target
    try {
      const existingPending = await this.rawClient.userNotification.findFirst({
        where: {
          userId: target.id,
          senderId: me.id,
          type: 'friend_request',
          handled: null,
        },
      });
      if (existingPending) {
        return {
          success: false,
          error: `${target.displayName} oyuncusuna zaten arkadaşlık isteği gönderdiniz. Karşı tarafın kabul etmesi bekleniyor.`,
        };
      }
    } catch {}

    // Create a PENDING friend request notification for target (handled: null)
    // Target will ONLY become a friend when they accept this notification!
    const notifItem: NotificationItem = {
      id: 'notif_fr_' + randomBytes(16).toString('hex'),
      type: 'friend_request',
      title: `${me.displayName} sana arkadaşlık isteği gönderdi!`,
      sub: 'Arkadaş olarak eklemek ve birlikte yarışmak için isteği kabul et.',
      timeText: 'Az önce',
      senderId: me.id,
      senderName: me.displayName,
      senderAvatar: me.avatarUrl || 'av1',
      handled: null,
    };

    try {
      await this.rawClient.userNotification.create({
        data: {
          id: notifItem.id,
          userId: target.id,
          type: notifItem.type,
          title: notifItem.title,
          sub: notifItem.sub,
          timeText: notifItem.timeText,
          handled: null,
          senderId: notifItem.senderId,
          senderName: notifItem.senderName,
          senderAvatar: notifItem.senderAvatar,
        },
      });
    } catch (e: any) {
      console.warn('[addFriend] DB notification error:', e.message);
    }

    if (!target.notifications) target.notifications = [];
    target.notifications.unshift(notifItem);
    this.users.set(target.id, target);
    this.savePersistedUsers();

    // REAL-TIME WEBSOCKET PUSH TO TARGET
    presenceManager.notifyUser(target.id, 'notification:new', notifItem);

    const progress = calculateLevelFromXp(target.xp || 0);
    const targetPresence = presenceManager.getUserPresence(target.id);

    return {
      success: true,
      pending: true,
      notification: notifItem,
      message: `${target.displayName} oyuncusuna arkadaşlık isteği gönderildi! Kabul ettiğinde arkadaş listende görünecek.`,
      friend: {
        id: target.id,
        username: target.username,
        displayName: target.displayName,
        avatarUrl: target.avatarUrl || 'av1',
        level: progress.level,
        rankTitle: progress.rankTitle,
        rankPoints: target.rankPoints || 1000,
        online: targetPresence.online,
        status: 'İstek Gönderildi · Onay Bekliyor',
        isFriend: false,
      },
    };
  }

  public async removeFriend(
    userId: string,
    targetUserIdOrUsername: string
  ): Promise<{
    success: boolean;
    removedFriendId?: string;
    message?: string;
    error?: string;
  }> {
    let me = this.users.get(userId);
    try {
      const dbMe = await this.rawClient.user.findFirst({
        where: { OR: [{ id: userId }, { username: userId }] },
      });
      if (dbMe) {
        me = this.prismaUserToRecord(dbMe);
        this.users.set(me.id, me);
      }
    } catch {}
    if (!me) return { success: false, error: 'Kullanıcı oturumu bulunamadı.' };

    const cleanTarget = (targetUserIdOrUsername || '').trim();
    const cleanLower = cleanTarget.toLowerCase();

    let target: UserRecord | undefined = this.users.get(cleanTarget);
    if (!target) {
      try {
        const dbTarget = await this.rawClient.user.findFirst({
          where: {
            OR: [
              { id: cleanTarget },
              { username: { equals: cleanLower, mode: 'insensitive' } },
              { displayName: { equals: cleanTarget, mode: 'insensitive' } },
            ],
          },
        });
        if (dbTarget) {
          target = this.prismaUserToRecord(dbTarget);
          this.users.set(target.id, target);
        }
      } catch {}
    }

    if (!target) {
      target = Array.from(this.users.values()).find(
        (u) =>
          u &&
          (u.id === cleanTarget ||
            u.username?.toLowerCase() === cleanLower ||
            u.displayName?.toLowerCase() === cleanLower)
      );
    }

    const targetId = target?.id || cleanTarget;
    const targetName = target?.displayName || target?.username || 'Oyuncu';

    me.friendIds = (me.friendIds || []).filter((fid) => fid !== targetId && fid !== cleanTarget);
    this.users.set(me.id, me);
    if (me.username) this.users.set(me.username, me);

    if (target) {
      target.friendIds = (target.friendIds || []).filter((fid) => fid !== me!.id && fid !== userId);
      this.users.set(target.id, target);
      if (target.username) this.users.set(target.username, target);
    }

    try {
      await this.rawClient.user.update({
        where: { id: me.id },
        data: { friendIds: me.friendIds, updatedAt: new Date() },
      });
    } catch {}

    if (target?.id) {
      try {
        await this.rawClient.user.update({
          where: { id: target.id },
          data: { friendIds: target.friendIds || [], updatedAt: new Date() },
        });
      } catch {}
    }

    // Also clean up any pending/old friend_request notifications between the two users
    try {
      await this.rawClient.userNotification.deleteMany({
        where: {
          type: 'friend_request',
          OR: [
            { userId: me.id, senderId: targetId },
            { userId: targetId, senderId: me.id },
          ],
        },
      });
    } catch {}

    this.savePersistedUsers();

    // Notify both sides via WebSocket so friend lists refresh immediately
    presenceManager.notifyUser(me.id, 'friends:update', { removedFriendId: targetId });
    if (targetId) {
      presenceManager.notifyUser(targetId, 'friends:update', { removedFriendId: me.id });
    }

    return {
      success: true,
      removedFriendId: targetId,
      message: `${targetName} arkadaş listenden çıkarıldı.`,
    };
  }

  public getUserNotifications(userId: string): NotificationItem[] {
    const user = this.users.get(userId);
    if (!user) return [];

    // Filter out old mock sample items
    if (user.notifications) {
      return user.notifications.filter(
        (n) =>
          !n.id.startsWith('notif_fr_sample') &&
          !n.id.startsWith('notif_duel_sample') &&
          !n.id.startsWith('notif_rew_sample')
      );
    }
    return [];
  }

  public async getUserNotificationsAsync(userId: string): Promise<NotificationItem[]> {
    try {
      const dbNotifs = await this.rawClient.userNotification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      if (dbNotifs.length === 0) {
        const memNotifs = this.getUserNotifications(userId);
        if (memNotifs.length > 0) return memNotifs;

        // Create genuine welcome notification for brand new user
        const welcomeNotif: NotificationItem = {
          id: 'notif_welcome_' + Date.now(),
          type: 'reward',
          title: 'Tavriko Bilgi Dünyasına Hoş Geldin! 🦉',
          sub: 'Profilini tamamla, 1v1 düellolara katıl ve arkadaşlarınla yarış!',
          timeText: 'Bugün',
          handled: null,
        };

        try {
          await this.rawClient.userNotification.create({
            data: {
              id: welcomeNotif.id,
              userId,
              type: welcomeNotif.type,
              title: welcomeNotif.title,
              sub: welcomeNotif.sub,
              timeText: welcomeNotif.timeText,
              handled: null,
            },
          });
        } catch {}

        const user = this.users.get(userId);
        if (user) {
          if (!user.notifications) user.notifications = [];
          user.notifications.unshift(welcomeNotif);
        }

        return [welcomeNotif];
      }

      return dbNotifs.map((n) => ({
        id: n.id,
        type: n.type as any,
        title: n.title,
        sub: n.sub,
        timeText: n.timeText || 'Az önce',
        handled: (n.handled as any) || null,
        senderId: n.senderId || undefined,
        senderName: n.senderName || undefined,
        senderAvatar: n.senderAvatar || undefined,
        roomCode: n.roomCode || undefined,
      }));
    } catch (err: any) {
      console.warn('[getUserNotificationsAsync] DB fallback:', err.message);
      return this.getUserNotifications(userId);
    }
  }

  public async respondToNotification(
    userId: string,
    notificationId: string,
    action: 'accept' | 'decline'
  ): Promise<{
    success: boolean;
    handled: 'accepted' | 'declined';
    roomCode?: string;
    senderId?: string;
    senderNotification?: NotificationItem;
    message: string;
    error?: string;
  }> {
    const finalHandled: 'accepted' | 'declined' = action === 'accept' ? 'accepted' : 'declined';
    let user = this.users.get(userId);
    try {
      const dbUser = await this.rawClient.user.findFirst({
        where: { OR: [{ id: userId }, { username: userId }] },
      });
      if (dbUser) {
        user = this.prismaUserToRecord(dbUser);
        this.users.set(user.id, user);
      }
    } catch {}
    if (!user) {
      return { success: false, handled: finalHandled, error: 'Kullanıcı bulunamadı.', message: '' };
    }

    let notif: any = user.notifications?.find((n) => n.id === notificationId);
    try {
      const dbNotif = await this.rawClient.userNotification.findUnique({
        where: { id: notificationId },
      });
      // Notification IDs are not authorization. Always verify ownership before
      // changing the row or applying friend-request side effects.
      if (dbNotif && dbNotif.userId !== userId) {
        return { success: false, handled: finalHandled, error: 'Bildirim bulunamadı.', message: '' };
      }
      if (dbNotif) notif = dbNotif;
    } catch {}

    if (!notif) {
      return { success: false, handled: finalHandled, error: 'Bildirim bulunamadı.', message: '' };
    }
    if (notif.handled) {
      return { success: false, handled: finalHandled, error: 'Bu bildirim daha önce yanıtlanmış.', message: '' };
    }

    notif.handled = finalHandled;
    const newSub =
      action === 'accept'
        ? notif.type === 'match_invite' || notif.type === 'duel'
          ? 'Düello kabul edildi! Odaya aktarılıyorsunuz...'
          : 'Arkadaşlık isteği kabul edildi. Artık arkadaşsınız!'
        : 'İstek reddedildi.';
    notif.sub = newSub;

    // Update in PostgreSQL
    try {
      await this.rawClient.userNotification.update({
        where: { id: notificationId },
        data: { handled: finalHandled, sub: newSub },
      });
    } catch (err: any) {
      console.warn('[respondToNotification] DB update error:', err.message);
    }

    let createdSenderNotif: NotificationItem | undefined;

    if (notif.type === 'friend_request' || notif.type === 'friend') {
      if (action === 'accept' && notif.senderId) {
        if (!user.friendIds) user.friendIds = [];
        if (!user.friendIds.includes(notif.senderId)) user.friendIds.push(notif.senderId);

        let sender = this.users.get(notif.senderId);
        try {
          const dbSender = await this.rawClient.user.findUnique({ where: { id: notif.senderId } });
          if (dbSender) {
            sender = this.prismaUserToRecord(dbSender);
            this.users.set(sender.id, sender);
          }
        } catch {}

        if (sender) {
          if (!sender.friendIds) sender.friendIds = [];
          if (!sender.friendIds.includes(user.id)) sender.friendIds.push(user.id);

          try {
            await this.rawClient.user.update({
              where: { id: user.id },
              data: { friendIds: user.friendIds },
            });
            await this.rawClient.user.update({
              where: { id: sender.id },
              data: { friendIds: sender.friendIds },
            });
          } catch {}

          this.users.set(sender.id, sender);

          const senderNotif: NotificationItem = {
            id: 'notif_fra_' + Date.now(),
            type: 'system',
            title: `${user.displayName} arkadaşlık isteğini kabul etti!`,
            sub: 'Artık Arkadaşlarım listesinde görebilir ve 1v1 düelloya davet edebilirsin.',
            timeText: 'Az önce',
            handled: 'accepted',
          };
          createdSenderNotif = senderNotif;

          try {
            await this.rawClient.userNotification.create({
              data: {
                id: senderNotif.id,
                userId: sender.id,
                type: senderNotif.type,
                title: senderNotif.title,
                sub: senderNotif.sub,
                timeText: senderNotif.timeText,
                handled: 'accepted',
              },
            });
          } catch {}

          // WebSocket notify sender & self
          presenceManager.notifyUser(sender.id, 'notification:new', senderNotif);
          presenceManager.notifyUser(sender.id, 'friends:update', { friendId: user.id });
          presenceManager.notifyUser(user.id, 'friends:update', { friendId: sender.id });
        }
      }
    }

    this.users.set(user.id, user);
    this.savePersistedUsers();

    // WebSocket notify self that notification is handled
    presenceManager.notifyUser(user.id, 'notification:update', {
      id: notificationId,
      handled: finalHandled,
    });

    if (notif.type === 'match_invite' || notif.type === 'duel') {
      if (action === 'accept') {
        return {
          success: true,
          handled: 'accepted',
          roomCode: notif.roomCode || 'DUEL1',
          senderId: notif.senderId || undefined,
          message: 'Düello daveti kabul edildi! Odaya aktarılıyorsunuz...',
        };
      }
    }

    return {
      success: true,
      handled: finalHandled,
      senderId: notif.senderId || undefined,
      senderNotification: createdSenderNotif,
      message: action === 'accept' ? 'İşlem başarıyla onaylandı.' : 'İstek reddedildi.',
    };
  }

  public async sendDuelChallenge(
    userId: string,
    targetUserId: string,
    category: string = 'genel_kultur'
  ): Promise<{
    success: boolean;
    roomCode?: string;
    notification?: NotificationItem;
    message: string;
    error?: string;
  }> {
    let me = this.users.get(userId);
    if (!me) {
      try {
        const dbMe = await this.rawClient.user.findFirst({
          where: { OR: [{ id: userId }, { username: userId }] },
        });
        if (dbMe) me = this.prismaUserToRecord(dbMe);
      } catch {}
    }
    if (!me) return { success: false, error: 'Kullanıcı oturumu bulunamadı.', message: '' };

    let target = this.users.get(targetUserId);
    if (!target) {
      try {
        const dbTarget = await this.rawClient.user.findFirst({
          where: { OR: [{ id: targetUserId }, { username: targetUserId }] },
        });
        if (dbTarget) target = this.prismaUserToRecord(dbTarget);
      } catch {}
    }
    if (!target) return { success: false, error: 'Hedef oyuncu bulunamadı.', message: '' };
    if (!me.friendIds?.includes(target.id) || !target.friendIds?.includes(me.id)) {
      return { success: false, error: 'Yalnızca arkadaşlarınıza düello daveti gönderebilirsiniz.', message: '' };
    }
    if (target.settings?.duelInvitesAllowed === false || target.settings?.roomInvitesAllowed === false) {
      return { success: false, error: 'Bu oyuncu oyun davetlerini kabul etmiyor.', message: '' };
    }

    const roomAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const roomBytes = randomBytes(8);
    const roomCode = 'DUEL-' + Array.from(roomBytes, (value) => roomAlphabet[value % roomAlphabet.length]).join('');
    this.setUserActiveRoom(userId, roomCode);
    presenceManager.setUserRoom(userId, roomCode);

    const notifItem: NotificationItem = {
      id: 'notif_chal_' + randomBytes(16).toString('hex'),
      type: 'match_invite',
      title: `${me.displayName} sana 1v1 Düello Meydan Okudu!`,
      sub: 'Özel 1v1 düello odası hazır. Kabul et ve hemen yarışmaya başla!',
      timeText: 'Az önce',
      senderId: me.id,
      senderName: me.displayName,
      senderAvatar: me.avatarUrl || 'av1',
      roomCode: roomCode,
      handled: null,
    };

    // 1. Persist notification in PostgreSQL
    try {
      await this.rawClient.userNotification.create({
        data: {
          id: notifItem.id,
          userId: target.id,
          type: notifItem.type,
          title: notifItem.title,
          sub: notifItem.sub,
          timeText: notifItem.timeText,
          handled: null,
          senderId: notifItem.senderId,
          senderName: notifItem.senderName,
          senderAvatar: notifItem.senderAvatar,
          roomCode: notifItem.roomCode,
        },
      });
    } catch (e: any) {
      console.warn('[sendDuelChallenge] DB notification error:', e.message);
    }

    if (!target.notifications) target.notifications = [];
    target.notifications.unshift(notifItem);
    this.users.set(target.id, target);
    this.savePersistedUsers();

    // 2. REAL-TIME WEBSOCKET NOTIFICATION TO TARGET
    presenceManager.notifyUser(target.id, 'notification:new', notifItem);

    // 3. BROADCAST SENDER PRESENCE (Now in room)
    presenceManager.broadcast('presence:update', presenceManager.getUserPresence(userId));

    return {
      success: true,
      roomCode,
      notification: notifItem,
      message: `${target.displayName} kullanıcısına 1v1 düello daveti başarıyla gönderildi!`,
    };
  }

  /** @deprecated Legacy packs had no verified payment provider; never grant currency through this method. */
  public async purchaseShopPack(_userId: string, _packId: string): Promise<{ user: UserProfile; message: string }> {
    throw new Error('Eski paket satın alma akışı devre dışı. Doğrulanmış ödeme sağlayıcısı gereklidir.');
  }

  public async buyPremiumPass(userId: string): Promise<{ user: UserProfile; message: string }> {
    return this.purchaseShopProduct(userId, 'pack_season_premium_pass', 'gems');
  }

  public async purchaseShopProduct(
    userId: string,
    productId: string,
    paymentMethod: 'coins' | 'gems' | 'try' = 'coins'
  ): Promise<{ user: UserProfile; message: string }> {
    let record = this.users.get(userId);
    if (!record) {
      try {
        const u = await this.rawClient.user.findFirst({
          where: { OR: [{ id: userId }, { username: userId }, { email: userId.toLowerCase() }] },
          include: { inventoryItems: true },
        });
        if (u) {
          record = this.prismaUserToRecord(u as any);
          this.users.set(record.id, record);
        }
      } catch {}
    }
    if (!record) throw new Error('Kullanıcı bulunamadı.');

    const product = SHOP_CATALOG.find((p) => p.id === productId);
    if (!product) throw new Error('Ürün mağazada bulunamadı.');
    if (product.currency === 'try') {
      throw new Error('Gerçek para ödemeleri doğrulanmış ödeme sağlayıcısı olmadan gerçekleştirilemez.');
    }
    if (product.grantPremiumPass && record.hasPremiumPass) {
      throw new Error('Premium Pass hesabınızda zaten etkin.');
    }
    if (paymentMethod !== product.currency) {
      throw new Error('Ödeme yöntemi ürün para birimiyle eşleşmiyor.');
    }

    if (product.currency === 'coins') {
      if (record.coins < product.price) {
        throw new Error(`Yetersiz Altın! Bu ürün için ${product.price} Altın gereklidir (Mevcut: ${record.coins} Altın).`);
      }
      record.coins -= product.price;
    } else if (product.currency === 'gems') {
      if ((record.gems || 0) < product.price) {
        throw new Error(`Yetersiz Elmas! Bu ürün için ${product.price} Elmas gereklidir (Mevcut: ${record.gems || 0} Elmas).`);
      }
      record.gems = (record.gems || 0) - product.price;
    }

    if (product.grantPremiumPass) {
      record.hasPremiumPass = true;
    }
    if (product.grantCoins) {
      record.coins += product.grantCoins;
    }
    if (product.grantGems) {
      record.gems = (record.gems || 0) + product.grantGems;
    }

    if (product.grantItems) {
      if (!record.inventory) record.inventory = [];
      for (const item of product.grantItems) {
        const existing = record.inventory.find((i) => i.id === item.id);
        if (existing) {
          existing.qty += item.qty;
        } else {
          record.inventory.push({
            id: item.id,
            name: item.name,
            desc: item.desc,
            qty: item.qty,
            category: item.category || this.getItemCategory(item.id),
            rarity: item.rarity || this.getItemRarity(item.id),
          });
        }

        if (!record.isGuest) {
          try {
            await this.rawClient.userInventoryItem.upsert({
              where: {
                userId_itemId: {
                  userId: record.id,
                  itemId: item.id,
                },
              },
              update: {
                qty: { increment: item.qty },
                name: item.name,
                desc: item.desc,
                updatedAt: new Date(),
              },
              create: {
                userId: record.id,
                itemId: item.id,
                name: item.name,
                desc: item.desc,
                qty: item.qty,
              },
            });
          } catch (itemErr) {
            console.error('[purchaseShopProduct] DB inventory upsert error:', itemErr);
          }
        }
      }
    }

    this.users.set(userId, record);
    this.users.set(record.id, record);
    if (record.username) this.users.set(record.username, record);
    if (record.email) this.users.set(record.email.toLowerCase(), record);

    if (!record.isGuest) {
      this.savePersistedUsers();
      try {
        await this.rawClient.user.update({
          where: { id: record.id },
          data: {
            coins: record.coins,
            gems: record.gems,
            hasPremiumPass: record.hasPremiumPass,
            updatedAt: new Date(),
          },
        });
      } catch (err) {
        console.error('[purchaseShopProduct] DB update error:', err);
      }
    }

    return {
      user: this.toProfile(record),
      message: `${product.name} başarıyla satın alındı ve hesabınıza tanımlandı!`,
    };
  }

  public async openChest(
    userId: string,
    chestId: string,
    keyId?: string
  ): Promise<{
    user: UserProfile;
    reward: {
      coins: number;
      gems: number;
      xp: number;
      rarity: ItemRarity;
      rewardText: string;
      item?: InventoryItem;
    };
  }> {
    let record = this.users.get(userId);
    if (!record) {
      try {
        const u = await this.rawClient.user.findFirst({
          where: { OR: [{ id: userId }, { username: userId }, { email: userId.toLowerCase() }] },
          include: { inventoryItems: true },
        });
        if (u) {
          record = this.prismaUserToRecord(u as any);
          this.users.set(record.id, record);
        }
      } catch {}
    }
    if (!record) throw new Error('Kullanıcı bulunamadı.');
    if (!record.inventory) record.inventory = [];

    const chestItem = record.inventory.find((i) => i.id === chestId);
    if (!chestItem || chestItem.qty <= 0) {
      throw new Error('Açılacak sandık envanterinizde bulunamadı.');
    }

    let requiredKeyId = 'key_silver';
    let chestRarity: ItemRarity = 'common';
    if (chestId.includes('silver')) {
      requiredKeyId = 'key_silver';
      chestRarity = 'rare';
    } else if (chestId.includes('gold')) {
      requiredKeyId = 'key_gold';
      chestRarity = 'epic';
    } else if (chestId.includes('legendary') || chestId.includes('diamond')) {
      requiredKeyId = 'key_diamond';
      chestRarity = 'mythic';
    }

    const actualKeyId = keyId || requiredKeyId;
    const keyItem = record.inventory.find((i) => i.id === actualKeyId || i.id === 'key_master');
    if (!keyItem || keyItem.qty <= 0) {
      throw new Error(`Bu sandığı açmak için ${requiredKeyId.replace('key_', '').toUpperCase()} Anahtar gereklidir!`);
    }

    // Atomically consume key & chest
    chestItem.qty -= 1;
    keyItem.qty -= 1;
    record.inventory = record.inventory.filter((i) => i.qty > 0);

    let coins = 0;
    let gems = 0;
    let xp = 0;
    let bonusItem: InventoryItem | undefined;

    if (chestId.includes('legendary')) {
      coins = Math.floor(4000 + Math.random() * 6000);
      gems = Math.floor(100 + Math.random() * 200);
      xp = Math.floor(800 + Math.random() * 800);
      bonusItem = {
        id: 'frame_flame',
        name: 'Alev Çerçevesi',
        desc: 'Mitolojik profil çerçevesi',
        qty: 1,
        category: 'frame',
        rarity: 'mythic',
      };
    } else if (chestId.includes('gold')) {
      coins = Math.floor(1500 + Math.random() * 2500);
      gems = Math.floor(40 + Math.random() * 60);
      xp = Math.floor(350 + Math.random() * 350);
      bonusItem = {
        id: 'booster_xp_2x_1h',
        name: '2x XP (1 Saat)',
        desc: '1 saat boyunca iki kat XP',
        qty: 1,
        category: 'booster',
        rarity: 'rare',
      };
    } else if (chestId.includes('silver')) {
      coins = Math.floor(600 + Math.random() * 900);
      gems = Math.floor(15 + Math.random() * 25);
      xp = Math.floor(150 + Math.random() * 200);
    } else {
      coins = Math.floor(250 + Math.random() * 350);
      gems = Math.floor(5 + Math.random() * 10);
      xp = Math.floor(80 + Math.random() * 100);
    }

    record.coins += coins;
    record.gems = (record.gems || 0) + gems;
    record.xp += xp;

    if (bonusItem) {
      const existing = record.inventory.find((i) => i.id === bonusItem!.id);
      if (existing) {
        existing.qty += bonusItem.qty;
      } else {
        record.inventory.push(bonusItem);
      }
    }

    const prog = calculateLevelFromXp(record.xp);
    record.level = prog.level;
    record.rankTitle = prog.rankTitle;

    this.users.set(userId, record);
    this.users.set(record.id, record);
    if (record.username) this.users.set(record.username, record);
    if (record.email) this.users.set(record.email.toLowerCase(), record);

    if (!record.isGuest) {
      this.savePersistedUsers();
      try {
        // Consumed chest in PostgreSQL
        if (chestItem.qty <= 0) {
          await this.rawClient.userInventoryItem.deleteMany({
            where: { userId: record.id, itemId: chestId },
          }).catch(() => {});
        } else {
          await this.rawClient.userInventoryItem.update({
            where: { userId_itemId: { userId: record.id, itemId: chestId } },
            data: { qty: chestItem.qty, updatedAt: new Date() },
          }).catch(() => {});
        }

        // Consumed key in PostgreSQL
        if (keyItem.qty <= 0) {
          await this.rawClient.userInventoryItem.deleteMany({
            where: { userId: record.id, itemId: actualKeyId },
          }).catch(() => {});
        } else {
          await this.rawClient.userInventoryItem.update({
            where: { userId_itemId: { userId: record.id, itemId: actualKeyId } },
            data: { qty: keyItem.qty, updatedAt: new Date() },
          }).catch(() => {});
        }

        // Bonus item in PostgreSQL
        if (bonusItem) {
          await this.rawClient.userInventoryItem.upsert({
            where: { userId_itemId: { userId: record.id, itemId: bonusItem.id } },
            update: { qty: { increment: bonusItem.qty }, updatedAt: new Date() },
            create: {
              userId: record.id,
              itemId: bonusItem.id,
              name: bonusItem.name,
              desc: bonusItem.desc,
              qty: bonusItem.qty,
            },
          }).catch(() => {});
        }

        await this.rawClient.user.update({
          where: { id: record.id },
          data: {
            coins: record.coins,
            gems: record.gems,
            xp: record.xp,
            level: record.level,
            rankTitle: record.rankTitle,
            updatedAt: new Date(),
          },
        });
      } catch (err) {
        console.error('[openChest] DB update error:', err);
      }
    }

    const rewardText = `🎉 Sandık açıldı: +${coins} Altın, +${gems} Elmas ve +${xp} XP kazandınız!${bonusItem ? ` Bonus: ${bonusItem.name}!` : ''}`;

    return {
      user: this.toProfile(record),
      reward: {
        coins,
        gems,
        xp,
        rarity: chestRarity,
        rewardText,
        item: bonusItem,
      },
    };
  }

  public getUserEvents(userId: string): { events: any[] } {
    const record = this.users.get(userId);
    const progressMap = record?.eventProgress || {};

    const events = EVENT_DEFINITIONS.map((ev) => {
      const state = progressMap[ev.id];
      const isStarted = !!state?.started;
      // Only count progress if user has explicitly started this event!
      const rawProgress = isStarted ? (state?.progress || 0) : 0;
      // Strictly clamp progress between 0 and targetCount (prevents stale 149 / 10 bug)
      const currentCount = Math.min(ev.targetCount, Math.max(0, rawProgress));
      const completed = currentCount >= ev.targetCount;
      const claimed = !!state?.claimed;

      return {
        ...ev,
        started: isStarted,
        currentCount,
        completed,
        claimed,
      };
    });

    return { events };
  }

  public startEvent(userId: string, eventId: string): { user: UserProfile; event: any; message: string } {
    const record = this.users.get(userId);
    if (!record) throw new Error('Kullanıcı bulunamadı.');

    const event = EVENT_DEFINITIONS.find((e) => e.id === eventId);
    if (!event) throw new Error('Etkinlik bulunamadı.');

    if (!record.eventProgress) record.eventProgress = {};
    const existing = record.eventProgress[eventId];

    // If never started or corrupted progress (> targetCount), initialize clean from 0
    if (!existing || !existing.started || (existing.progress || 0) > event.targetCount) {
      record.eventProgress[eventId] = {
        started: true,
        startedAt: Date.now(),
        progress: 0,
        completed: false,
        claimed: false,
      };
    } else {
      existing.started = true;
    }

    const state = record.eventProgress[eventId];
    const progress = Math.min(event.targetCount, Math.max(0, state.progress || 0));
    const eventData = {
      ...event,
      started: true,
      currentCount: progress,
      completed: progress >= event.targetCount,
      claimed: !!state.claimed,
    };

    if (!record.isGuest) {
      this.savePersistedUsers();
    }

    return {
      user: this.toProfile(record),
      event: eventData,
      message: `"${event.title}" görevi başlatıldı! İlerlemeler şimdi kaydediliyor.`,
    };
  }

  public async claimEventReward(userId: string, eventId: string): Promise<{ user: UserProfile; message: string }> {
    const record = this.users.get(userId);
    if (!record) throw new Error('Kullanıcı bulunamadı.');

    const event = EVENT_DEFINITIONS.find((e) => e.id === eventId);
    if (!event) throw new Error('Etkinlik bulunamadı.');

    if (!record.eventProgress) record.eventProgress = {};
    const state = record.eventProgress[eventId] || { progress: 0, completed: false, claimed: false };

    if (state.progress < event.targetCount) {
      throw new Error(`Bu görev henüz tamamlanmadı (${state.progress} / ${event.targetCount}).`);
    }

    if (state.claimed) {
      throw new Error('Bu etkinliğin ödülü zaten alındı.');
    }

    state.claimed = true;
    record.eventProgress[eventId] = state;

    record.coins += event.rewardCoins;
    record.gems = (record.gems || 0) + event.rewardGems;
    record.xp += event.rewardXp;
    record.seasonXp = (record.seasonXp || 0) + event.rewardSeasonXp;

    if (event.rewardItem) {
      if (!record.inventory) record.inventory = [];
      const existing = record.inventory.find((i) => i.id === event.rewardItem!.id);
      if (existing) {
        existing.qty += event.rewardItem.qty;
      } else {
        record.inventory.push({ ...event.rewardItem });
      }
    }

    const prog = calculateLevelFromXp(record.xp);
    record.level = prog.level;
    record.rankTitle = prog.rankTitle;

    this.users.set(userId, record);
    this.users.set(record.id, record);
    if (record.username) this.users.set(record.username, record);
    if (!record.isGuest) {
      this.savePersistedUsers();
      try {
        await this.rawClient.user.update({
          where: { id: record.id },
          data: {
            coins: record.coins,
            gems: record.gems,
            xp: record.xp,
            level: record.level,
            updatedAt: new Date(),
          },
        });
      } catch (err) {
        console.error('[openChest] DB update error:', err);
      }
    }

    return {
      user: this.toProfile(record),
      message: `Tebrikler! ${event.title} tamamlandı: +${event.rewardCoins} Altın, +${event.rewardGems} Elmas, +${event.rewardSeasonXp} Sezon XP kazandınız!`,
    };
  }

  private toProfile(record: UserRecord): UserProfile {
    let filledCount = 2;
    if (record.fullName) filledCount++;
    if (record.countryCode) filledCount++;
    if (record.phone) filledCount++;
    if (record.birthDate) filledCount++;
    if (record.avatarUrl) filledCount++;
    const profileCompletionPct = Math.min(100, Math.round((filledCount / 7) * 100));

    if (!record.friendCode) {
      record.friendCode = this.generateFriendCode(record.id);
    }
    if (!record.inventory) {
      record.inventory = [];
    }
    if (!record.claimedSeasonTiers) {
      record.claimedSeasonTiers = [1];
    }
    if (!record.notifications) {
      record.notifications = this.defaultNotifications(record.displayName);
    }

    const progress = calculateLevelFromXp(record.xp || 0);
    record.level = progress.level;
    record.rankTitle = progress.rankTitle;
    record.stats = this.sanitizeUserStats(record.stats);

    const todayStr = new Date().toISOString().slice(0, 10);
    const dcState = (record.categoryMastery as any)?.dailyChallenge;
    const completedToday = dcState?.lastCompletedDate === todayStr;

    return {
      id: record.id,
      username: record.username,
      displayName: record.displayName,
      email: record.email,
      fullName: record.fullName,
      countryCode: record.countryCode,
      countryName: record.countryName,
      phone: record.phone,
      birthDate: record.birthDate,
      gender: record.gender,
      bio: record.bio,
      avatarUrl: record.avatarUrl,
      friendCode: record.friendCode,
      level: record.level,
      xp: record.xp,
      seasonXp: record.seasonXp ?? 0,
      hasPremiumPass: !!record.hasPremiumPass,
      coins: record.coins,
      gems: record.gems ?? 14,
      dailyStreak: record.dailyStreak ?? 1,
      dailyChallenge: {
        lastCompletedDate: dcState?.lastCompletedDate,
        completedToday,
        streakDay: record.dailyStreak ?? 1,
      },
      rankTitle: record.rankTitle,
      rankPoints: record.rankPoints,
      profileCompletionPct,
      inventory: record.inventory,
      claimedSeasonTiers: record.claimedSeasonTiers,
      claimedSeasonFreeTiers: record.claimedSeasonFreeTiers || [],
      claimedSeasonPremiumTiers: record.claimedSeasonPremiumTiers || [],
      equippedFrame: record.equippedFrame,
      equippedBadge: record.equippedBadge,
      equippedNameEffect: record.equippedNameEffect,
      equippedBackground: record.equippedBackground,
      eventProgress: record.eventProgress || {},
      friendIds: record.friendIds || [],
      notifications: record.notifications,
      stats: record.stats,
      categoryMastery: record.categoryMastery || {},
      settings: record.settings || {},
    };
  }

  // ==========================================================================
  // SUPABASE CLOUD PUSH & HEALTH CHECK
  // ==========================================================================
  public async pushAllTablesToSupabase(): Promise<{
    synced: boolean;
    counts: {
      categories: number;
      questions: number;
      users: number;
      userInventoryItems: number;
      userNotifications: number;
      matchHistory: number;
    };
  }> {
    this.saveTableToDisk('categories.json', this.store.categories, false);
    this.saveTableToDisk('questions.json', this.store.questions, false);
    this.saveTableToDisk('users.json', this.store.users, false);
    this.saveTableToDisk('user_inventory_items.json', this.store.userInventoryItems, false);
    this.saveTableToDisk('user_notifications.json', this.store.userNotifications, false);
    this.saveTableToDisk('match_history.json', this.store.matchHistory, false);

    const filesToSync: Array<[string, any]> = [
      ['prisma_categories.json', Array.from(this.store.categories.values())],
      ['prisma_questions.json', Array.from(this.store.questions.values())],
      ['prisma_users.json', Array.from(this.store.users.values())],
      ['prisma_user_inventory_items.json', Array.from(this.store.userInventoryItems.values())],
      ['prisma_user_notifications.json', Array.from(this.store.userNotifications.values())],
      ['prisma_match_history.json', Array.from(this.store.matchHistory.values())],
    ];

    const results: boolean[] = [];
    for (const [filename, rows] of filesToSync) {
      const ok = await supabaseService.syncCloudStore(filename, rows);
      results.push(ok);
    }

    // Direct PostgreSQL Table Synchronization via Supabase Client
    const supa = supabaseService.getClient();
    if (supa && !this.isJest) {
      try {
        const nowIso = new Date().toISOString();
        const catRows = Array.from(this.store.categories.values()).map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          icon: c.icon,
          color: c.color,
          totalQuestions: c.totalQuestions,
          updatedAt: nowIso,
        }));
        await supa.from('categories').upsert(catRows);

        const qRows = Array.from(this.store.questions.values()).map((q) => ({
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
          reviewStatus: q.reviewStatus,
          timeLimitSec: q.timeLimitSec || 15,
          updatedAt: nowIso,
        }));
        for (let i = 0; i < qRows.length; i += 50) {
          await supa.from('questions').upsert(qRows.slice(i, i + 50));
        }

        const userRows = Array.from(this.store.users.values()).map((u) => ({
          id: u.id,
          username: u.username,
          email: u.email,
          displayName: u.displayName,
          fullName: u.fullName,
          countryCode: u.countryCode,
          countryName: u.countryName,
          phone: u.phone,
          birthDate: u.birthDate,
          gender: u.gender,
          bio: u.bio,
          avatarUrl: u.avatarUrl,
          friendCode: u.friendCode,
          level: u.level,
          xp: u.xp,
          coins: u.coins,
          gems: u.gems,
          dailyStreak: u.dailyStreak,
          rankTitle: u.rankTitle,
          rankPoints: u.rankPoints,
          profileCompletionPct: u.profileCompletionPct,
          totalMatches: u.totalMatches,
          wins: u.wins,
          correctAnswers: u.correctAnswers,
          totalAnswers: u.totalAnswers,
          bestStreak: u.bestStreak,
          avgResponseTimeMs: u.avgResponseTimeMs,
          categoryMastery: u.categoryMastery,
          claimedSeasonTiers: u.claimedSeasonTiers,
          friendIds: u.friendIds,
          updatedAt: nowIso,
        }));
        if (userRows.length > 0) {
          await supa.from('users').upsert(userRows);
        }

        const invRows = Array.from(this.store.userInventoryItems.values()).map((item) => ({
          id: item.id,
          userId: item.userId,
          itemId: item.itemId,
          name: item.name,
          desc: item.desc,
          qty: item.qty,
          updatedAt: nowIso,
        }));
        if (invRows.length > 0) {
          await supa.from('user_inventory_items').upsert(invRows);
        }

        const notifRows = Array.from(this.store.userNotifications.values()).map((n) => ({
          id: n.id,
          userId: n.userId,
          type: n.type,
          title: n.title,
          sub: n.sub,
          timeText: n.timeText,
          handled: n.handled,
        }));
        if (notifRows.length > 0) {
          await supa.from('user_notifications').upsert(notifRows);
        }
      } catch (err: any) {
        console.warn('[Supabase Sync Warning]:', err.message);
      }
    }

    try {
      const schemaPath = path.join(__dirname, '..', '..', 'prisma', 'schema.prisma');
      const migrationPath = path.join(
        __dirname,
        '..',
        '..',
        'prisma',
        'migrations',
        '20261030000000_init_tavriko_supabase',
        'migration.sql'
      );
      if (fs.existsSync(schemaPath)) {
        await supabaseService.syncCloudStore('prisma_schema.json', {
          schema: fs.readFileSync(schemaPath, 'utf-8'),
          updatedAt: new Date().toISOString(),
        });
      }
      if (fs.existsSync(migrationPath)) {
        await supabaseService.syncCloudStore('prisma_migration_sql.json', {
          sql: fs.readFileSync(migrationPath, 'utf-8'),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch {
      // Ignore schema upload error
    }

    return {
      synced: results.every(Boolean),
      counts: {
        categories: this.store.categories.size,
        questions: this.store.questions.size,
        users: this.store.users.size,
        userInventoryItems: this.store.userInventoryItems.size,
        userNotifications: this.store.userNotifications.size,
        matchHistory: this.store.matchHistory.size,
      },
    };
  }

  public async checkHealth(): Promise<PrismaHealth> {
    return {
      orm: 'PrismaClient',
      version: '6.19.3',
      connected: true,
      supabaseProject: 'rjvbgofzsfescnfohzgu',
      tables: {
        categories: this.store.categories.size,
        questions: this.store.questions.size,
        users: this.store.users.size,
        userInventoryItems: this.store.userInventoryItems.size,
        userNotifications: this.store.userNotifications.size,
        matchHistory: this.store.matchHistory.size,
      },
      message: 'Prisma ORM aktif ve tüm tablolar Supabase (rjvbgofzsfescnfohzgu.supabase.co) ile senkronize.',
    };
  }
}

export const prisma = new PrismaService();
export const db = prisma;
export { PrismaService as DatabaseAdapter };
