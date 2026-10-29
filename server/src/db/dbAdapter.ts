import { UserProfile, Question, CategoryId, DifficultyLevel, CategoryInfo } from '@trivia/shared';
import { ALL_CATEGORIES, QUESTION_BANK } from './questionsData';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_trivia_key_2026';

export interface UserRecord {
  id: string;
  username: string;
  displayName: string;
  passwordHash?: string;
  avatarUrl: string;
  isGuest: boolean;
  level: number;
  xp: number;
  coins: number;
  rankTitle: string;
  rankPoints: number;
  stats: {
    totalMatches: number;
    wins: number;
    correctAnswers: number;
    totalAnswers: number;
    bestStreak: number;
    avgResponseTimeMs: number;
  };
  createdAt: number;
}

export class DatabaseAdapter {
  private users: Map<string, UserRecord> = new Map();
  private questions: Question[] = [...QUESTION_BANK];
  private categories: CategoryInfo[] = [...ALL_CATEGORIES];

  constructor() {
    this.seedDefaults();
  }

  private seedDefaults() {
    // Seed some leaderboard mock players for high-production feel
    const mockUsers: Array<Partial<UserRecord>> = [
      { id: 'bot_1', username: 'bilgi_avcisi', displayName: 'Bilgi Avcısı', level: 24, rankPoints: 4850, rankTitle: 'Usta Bilgin', xp: 12400 },
      { id: 'bot_2', username: 'zeus_99', displayName: 'Zeka Fırtınası', level: 19, rankPoints: 3920, rankTitle: 'Stratejist', xp: 8700 },
      { id: 'bot_3', username: 'dahi_kiz', displayName: 'Selin Trivia', level: 15, rankPoints: 3100, rankTitle: 'Kaşif', xp: 5200 },
      { id: 'bot_4', username: 'quiz_master', displayName: 'QuizMaster 3000', level: 12, rankPoints: 2400, rankTitle: 'Çırak', xp: 3400 },
    ];

    mockUsers.forEach((u) => {
      this.users.set(u.id!, {
        id: u.id!,
        username: u.username!,
        displayName: u.displayName!,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${u.username}`,
        isGuest: false,
        level: u.level!,
        xp: u.xp!,
        coins: 1500,
        rankTitle: u.rankTitle!,
        rankPoints: u.rankPoints!,
        stats: {
          totalMatches: u.level! * 12,
          wins: Math.round(u.level! * 8),
          correctAnswers: u.level! * 70,
          totalAnswers: u.level! * 85,
          bestStreak: 12,
          avgResponseTimeMs: 2400,
        },
        createdAt: Date.now() - 86400000 * 30,
      });
    });
  }

  public async createGuest(displayName?: string): Promise<{ token: string; user: UserProfile }> {
    const id = 'guest_' + Math.random().toString(36).substring(2, 9);
    const name = displayName || `Misafir_${Math.floor(1000 + Math.random() * 9000)}`;
    const record: UserRecord = {
      id,
      username: name.toLowerCase().replace(/\s+/g, '_'),
      displayName: name,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${id}`,
      isGuest: true,
      level: 1,
      xp: 0,
      coins: 200,
      rankTitle: 'Acemi Kaşif',
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
    const token = jwt.sign({ userId: id, username: record.username }, JWT_SECRET, { expiresIn: '7d' });
    return { token, user: this.toProfile(record) };
  }

  public async register(username: string, displayName: string, password: string):Promise<{ token: string; user: UserProfile }> {
    const existing = Array.from(this.users.values()).find((u) => u.username === username.toLowerCase());
    if (existing) {
      throw new Error('Kullanıcı adı zaten kullanımda');
    }

    const id = 'usr_' + Math.random().toString(36).substring(2, 9);
    const passwordHash = await bcrypt.hash(password, 10);
    const record: UserRecord = {
      id,
      username: username.toLowerCase(),
      displayName,
      passwordHash,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`,
      isGuest: false,
      level: 1,
      xp: 0,
      coins: 500,
      rankTitle: 'Acemi Kaşif',
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
    const token = jwt.sign({ userId: id, username: record.username }, JWT_SECRET, { expiresIn: '30d' });
    return { token, user: this.toProfile(record) };
  }

  public async login(username: string, password: string): Promise<{ token: string; user: UserProfile }> {
    const record = Array.from(this.users.values()).find((u) => u.username === username.toLowerCase());
    if (!record || !record.passwordHash) {
      throw new Error('Kullanıcı adı veya şifre hatalı');
    }

    const match = await bcrypt.compare(password, record.passwordHash);
    if (!match) {
      throw new Error('Kullanıcı adı veya şifre hatalı');
    }

    const token = jwt.sign({ userId: record.id, username: record.username }, JWT_SECRET, { expiresIn: '30d' });
    return { token, user: this.toProfile(record) };
  }

  public verifyToken(token: string): { userId: string; username: string } | null {
    try {
      return jwt.verify(token, JWT_SECRET) as any;
    } catch {
      return null;
    }
  }

  public getUserProfile(userId: string): UserProfile | null {
    const record = this.users.get(userId);
    return record ? this.toProfile(record) : null;
  }

  public getCategories(): CategoryInfo[] {
    return this.categories;
  }

  public getQuestions(
    category: CategoryId = 'mixed',
    difficulty?: DifficultyLevel,
    count: number = 10
  ): Question[] {
    let pool = this.questions;
    if (category !== 'mixed') {
      pool = pool.filter((q) => q.categoryId === category);
    }
    if (difficulty) {
      const difficultyFiltered = pool.filter((q) => q.difficulty === difficulty);
      if (difficultyFiltered.length >= count) {
        pool = difficultyFiltered;
      }
    }

    // Shuffle and pick
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    // In case pool is smaller than count, repeat or wrap around safely
    if (shuffled.length < count) {
      const result: Question[] = [];
      while (result.length < count && pool.length > 0) {
        result.push(...pool);
      }
      return result.slice(0, count);
    }
    return shuffled.slice(0, count);
  }

  public getDailyChallenge(): { date: string; questions: Question[] } {
    const today = new Date().toISOString().split('T')[0];
    const dailySet = this.getQuestions('mixed', undefined, 5);
    return {
      date: today,
      questions: dailySet,
    };
  }

  public getLeaderboard(limit: number = 20): UserProfile[] {
    const list = Array.from(this.users.values())
      .sort((a, b) => b.rankPoints - a.rankPoints)
      .slice(0, limit)
      .map((u) => this.toProfile(u));
    return list;
  }

  private toProfile(record: UserRecord): UserProfile {
    return {
      id: record.id,
      username: record.username,
      displayName: record.displayName,
      avatarUrl: record.avatarUrl,
      level: record.level,
      xp: record.xp,
      coins: record.coins,
      rankTitle: record.rankTitle,
      rankPoints: record.rankPoints,
      stats: record.stats,
      categoryMastery: {},
    };
  }
}

export const db = new DatabaseAdapter();
