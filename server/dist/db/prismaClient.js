"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseAdapter = exports.db = exports.prisma = exports.PrismaService = void 0;
exports.computeQuestionHash = computeQuestionHash;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const client_1 = require("@prisma/client");
const shared_1 = require("@trivia/shared");
const questionsData_1 = require("./questionsData");
const evrenLlmGenerator_1 = require("../ai/evrenLlmGenerator");
const supabaseClient_1 = require("./supabaseClient");
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_trivia_key_2026';
const PRISMA_DATA_DIR = path.join(__dirname, '..', '..', 'data', 'prisma');
const USERS_DB_FILE = path.join(__dirname, '..', '..', 'supabase_users_store.json');
const QUESTIONS_DB_FILE = path.join(__dirname, '..', '..', 'supabase_questions_store.json');
function computeQuestionHash(text, options) {
    const normText = text.trim().toLowerCase().replace(/\s+/g, ' ');
    const normOptions = options
        .map((o) => o.text.trim().toLowerCase().replace(/\s+/g, ' '))
        .sort()
        .join('|');
    return crypto_1.default.createHash('sha256').update(`${normText}::${normOptions}`).digest('hex');
}
/**
 * PrismaService (Tekil Veritabanı Katmanı - dbAdapter.ts tamamen kaldırıldı):
 * Resmi @prisma/client şema tiplerini ve PrismaClient örneğini kullanarak
 * tüm veritabanı işlemlerini (Category, Question, User, UserInventoryItem,
 * UserNotification, MatchHistory, PasswordResetToken) doğrudan yönetir ve
 * Supabase (rjvbgofzsfescnfohzgu.supabase.co) ile çift yönlü senkronize eder.
 */
class PrismaService {
    rawClient;
    store = {
        categories: new Map(),
        questions: new Map(),
        users: new Map(),
        userInventoryItems: new Map(),
        userNotifications: new Map(),
        matchHistory: new Map(),
        passwordResetTokens: new Map(),
    };
    users = new Map();
    questions = [];
    categories = [...questionsData_1.ALL_CATEGORIES];
    isJest = Boolean(process.env.JEST_WORKER_ID);
    activeUserRooms = new Map();
    constructor() {
        this.rawClient = new client_1.PrismaClient({
            log: ['error'],
        });
        this.loadLocalSnapshots();
        this.initQuestions();
        this.seedDefaults();
        this.loadPersistedUsers();
        this.syncAllToPrisma().catch(() => { });
        this.syncInitialCloudState();
    }
    ensureDir() {
        if (!fs.existsSync(PRISMA_DATA_DIR)) {
            fs.mkdirSync(PRISMA_DATA_DIR, { recursive: true });
        }
    }
    loadLocalSnapshots() {
        if (this.isJest)
            return;
        try {
            this.ensureDir();
            this.loadTableFromDisk('categories.json', this.store.categories, (r) => r.id);
            this.loadTableFromDisk('questions.json', this.store.questions, (r) => r.id);
            this.loadTableFromDisk('users.json', this.store.users, (r) => r.id);
            this.loadTableFromDisk('user_inventory_items.json', this.store.userInventoryItems, (r) => r.id);
            this.loadTableFromDisk('user_notifications.json', this.store.userNotifications, (r) => r.id);
            this.loadTableFromDisk('match_history.json', this.store.matchHistory, (r) => r.id);
        }
        catch {
            // Ignore snapshot read errors
        }
    }
    loadTableFromDisk(filename, map, keyFn) {
        const filePath = path.join(PRISMA_DATA_DIR, filename);
        if (!fs.existsSync(filePath))
            return;
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            for (const item of parsed) {
                map.set(keyFn(item), item);
            }
        }
    }
    saveTableToDisk(filename, map, syncToCloud = true) {
        const rows = Array.from(map.values());
        if (!this.isJest) {
            try {
                this.ensureDir();
                const filePath = path.join(PRISMA_DATA_DIR, filename);
                fs.writeFileSync(filePath, JSON.stringify(rows, null, 2), 'utf-8');
            }
            catch {
                // Ignore write errors
            }
        }
        if (syncToCloud && !this.isJest) {
            supabaseClient_1.supabaseService.syncCloudStore(`prisma_${filename}`, rows).catch(() => { });
        }
    }
    // ==========================================================================
    // PRISMA MODEL DELEGATE: prisma.category
    // ==========================================================================
    category = {
        upsert: async (args) => {
            const existing = this.store.categories.get(args.where.id);
            const now = new Date();
            const record = existing
                ? { ...existing, ...args.update, updatedAt: now }
                : {
                    ...args.create,
                    totalQuestions: args.create.totalQuestions ?? 0,
                    createdAt: args.create.createdAt ?? now,
                    updatedAt: args.create.updatedAt ?? now,
                };
            this.store.categories.set(record.id, record);
            this.saveTableToDisk('categories.json', this.store.categories, false);
            const supa = supabaseClient_1.supabaseService.getClient();
            if (supa && !this.isJest) {
                Promise.resolve(supa.from('categories').upsert({
                    id: record.id,
                    name: record.name,
                    description: record.description,
                    icon: record.icon,
                    color: record.color,
                    totalQuestions: record.totalQuestions,
                    updatedAt: record.updatedAt.toISOString(),
                })).catch(() => { });
            }
            return record;
        },
        findMany: async (args) => {
            const list = Array.from(this.store.categories.values());
            if (args?.orderBy?.totalQuestions === 'desc') {
                list.sort((a, b) => b.totalQuestions - a.totalQuestions);
            }
            else if (args?.orderBy?.id === 'asc') {
                list.sort((a, b) => a.id.localeCompare(b.id));
            }
            return list;
        },
        findUnique: async (args) => {
            return this.store.categories.get(args.where.id) || null;
        },
        count: async () => {
            return this.store.categories.size;
        },
    };
    // ==========================================================================
    // PRISMA MODEL DELEGATE: prisma.question
    // ==========================================================================
    question = {
        upsert: async (args) => {
            let existing;
            if (args.where.id) {
                existing = this.store.questions.get(args.where.id);
            }
            else if (args.where.contentHash) {
                existing = Array.from(this.store.questions.values()).find((q) => q.contentHash === args.where.contentHash);
            }
            const now = new Date();
            const record = existing
                ? { ...existing, ...args.update, updatedAt: now }
                : {
                    id: args.create.id,
                    categoryId: args.create.categoryId,
                    subCategory: args.create.subCategory ?? null,
                    difficulty: args.create.difficulty,
                    text: args.create.text,
                    options: args.create.options,
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
        findMany: async (args) => {
            let list = Array.from(this.store.questions.values());
            if (args?.where) {
                const { categoryId, difficulty, reviewStatus } = args.where;
                if (categoryId)
                    list = list.filter((q) => q.categoryId === categoryId);
                if (difficulty)
                    list = list.filter((q) => q.difficulty === difficulty);
                if (reviewStatus)
                    list = list.filter((q) => q.reviewStatus === reviewStatus);
            }
            if (args?.take) {
                list = list.slice(0, args.take);
            }
            return list;
        },
        findUnique: async (args) => {
            if (args.where.id) {
                return this.store.questions.get(args.where.id) || null;
            }
            if (args.where.contentHash) {
                return Array.from(this.store.questions.values()).find((q) => q.contentHash === args.where.contentHash) || null;
            }
            return null;
        },
        update: async (args) => {
            const existing = this.store.questions.get(args.where.id);
            if (!existing)
                return null;
            const updated = {
                ...existing,
                ...args.data,
                updatedAt: new Date(),
            };
            this.store.questions.set(updated.id, updated);
            this.saveTableToDisk('questions.json', this.store.questions, true);
            return updated;
        },
        count: async (args) => {
            if (!args?.where)
                return this.store.questions.size;
            const list = await this.question.findMany({ where: args.where });
            return list.length;
        },
    };
    // ==========================================================================
    // PRISMA MODEL DELEGATE: prisma.user
    // ==========================================================================
    prismaUserToRecord(u) {
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
            gender: u.gender || undefined,
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
            claimedSeasonTiers: Array.isArray(u.claimedSeasonTiers) ? u.claimedSeasonTiers : [1],
            seasonXp: u.seasonXp ?? 0,
            hasPremiumPass: !!u.hasPremiumPass,
            claimedSeasonFreeTiers: Array.isArray(u.claimedSeasonFreeTiers) ? u.claimedSeasonFreeTiers : [],
            claimedSeasonPremiumTiers: Array.isArray(u.claimedSeasonPremiumTiers) ? u.claimedSeasonPremiumTiers : [],
            equippedFrame: u.equippedFrame ?? undefined,
            equippedBadge: u.equippedBadge ?? undefined,
            equippedNameEffect: u.equippedNameEffect ?? undefined,
            equippedBackground: u.equippedBackground ?? undefined,
            eventProgress: u.eventProgress || {},
            friendIds: Array.isArray(u.friendIds) ? u.friendIds : [],
            categoryMastery: u.categoryMastery || {},
            stats: {
                totalMatches: u.totalMatches,
                wins: u.wins,
                correctAnswers: u.correctAnswers,
                totalAnswers: u.totalAnswers,
                bestStreak: u.bestStreak,
                avgResponseTimeMs: u.avgResponseTimeMs,
            },
            createdAt: u.createdAt ? new Date(u.createdAt).getTime() : Date.now(),
        };
    }
    user = {
        upsert: async (args) => {
            let record;
            try {
                const updateData = { ...args.update };
                delete updateData.friendCode;
                delete updateData.id;
                const createData = { ...args.create };
                if (!createData.friendCode) {
                    createData.friendCode = this.generateFriendCode(createData.id);
                }
                const cleanEmail = (createData.email || updateData?.email || '').toLowerCase().trim();
                // Check if user already exists in PostgreSQL by ID or by Email to prevent duplicate insert errors
                let existingUser = null;
                if (args.where.id) {
                    existingUser = await this.rawClient.user.findUnique({ where: { id: args.where.id } }).catch(() => null);
                }
                if (!existingUser && cleanEmail) {
                    existingUser = await this.rawClient.user.findFirst({ where: { email: cleanEmail } }).catch(() => null);
                }
                const whereClause = existingUser
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
                }
                catch (dbErr) {
                    const errStr = String(dbErr?.message || '') + String(dbErr?.code || '');
                    if (errStr.includes('email') || (dbErr?.code === 'P2002' && dbErr?.meta?.target?.includes('email'))) {
                        // Email collision: update existing record matching this email in PostgreSQL
                        const targetEmail = (createData.email || updateData?.email || '').toLowerCase().trim();
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
                    }
                    else {
                        throw dbErr;
                    }
                }
            }
            catch (err) {
                let existing;
                if (args.where.id) {
                    existing = this.store.users.get(args.where.id);
                }
                else if (args.where.email) {
                    const cleanEmail = args.where.email.toLowerCase();
                    existing = Array.from(this.store.users.values()).find((u) => u.email.toLowerCase() === cleanEmail);
                }
                else if (args.where.username) {
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
                        categoryMastery: (args.create.categoryMastery ?? {}),
                        claimedSeasonTiers: (args.create.claimedSeasonTiers ?? [1]),
                        seasonXp: args.create.seasonXp ?? 0,
                        hasPremiumPass: args.create.hasPremiumPass ?? false,
                        claimedSeasonFreeTiers: (args.create.claimedSeasonFreeTiers ?? []),
                        claimedSeasonPremiumTiers: (args.create.claimedSeasonPremiumTiers ?? []),
                        equippedFrame: args.create.equippedFrame ?? null,
                        equippedBadge: args.create.equippedBadge ?? null,
                        equippedNameEffect: args.create.equippedNameEffect ?? null,
                        equippedBackground: args.create.equippedBackground ?? null,
                        eventProgress: (args.create.eventProgress ?? {}),
                        friendIds: (args.create.friendIds ?? []),
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
        findUnique: async (args) => {
            try {
                const res = await this.rawClient.user.findUnique({ where: args.where });
                if (res) {
                    this.store.users.set(res.id, res);
                    this.users.set(res.id, this.prismaUserToRecord(res));
                    return res;
                }
            }
            catch { }
            if (args.where.id)
                return this.store.users.get(args.where.id) || null;
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
        findMany: async (args) => {
            try {
                const res = await this.rawClient.user.findMany(args);
                if (res && res.length > 0) {
                    for (const u of res) {
                        this.store.users.set(u.id, u);
                        this.users.set(u.id, this.prismaUserToRecord(u));
                    }
                    return res;
                }
            }
            catch { }
            let list = Array.from(this.store.users.values());
            if (args?.orderBy?.rankPoints === 'desc') {
                list.sort((a, b) => b.rankPoints - a.rankPoints);
            }
            else if (args?.orderBy?.xp === 'desc') {
                list.sort((a, b) => b.xp - a.xp);
            }
            if (args?.take) {
                list = list.slice(0, args.take);
            }
            return list;
        },
        count: async () => {
            try {
                return await this.rawClient.user.count();
            }
            catch {
                return this.store.users.size;
            }
        },
    };
    // ==========================================================================
    // PRISMA MODEL DELEGATE: prisma.userInventoryItem
    // ==========================================================================
    userInventoryItem = {
        upsert: async (args) => {
            const compositeKey = `${args.where.userId_itemId.userId}::${args.where.userId_itemId.itemId}`;
            const existing = this.store.userInventoryItems.get(compositeKey);
            const now = new Date();
            const record = existing
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
        findMany: async (args) => {
            const list = Array.from(this.store.userInventoryItems.values());
            if (args?.where?.userId) {
                return list.filter((i) => i.userId === args.where.userId);
            }
            return list;
        },
        count: async () => {
            return this.store.userInventoryItems.size;
        },
    };
    // ==========================================================================
    // PRISMA MODEL DELEGATE: prisma.userNotification
    // ==========================================================================
    userNotification = {
        upsert: async (args) => {
            const existing = this.store.userNotifications.get(args.where.id);
            const now = new Date();
            const record = existing
                ? { ...existing, ...args.update }
                : {
                    id: args.create.id,
                    userId: args.create.userId,
                    type: args.create.type,
                    title: args.create.title,
                    sub: args.create.sub,
                    timeText: args.create.timeText,
                    handled: args.create.handled ?? null,
                    createdAt: args.create.createdAt ?? now,
                };
            this.store.userNotifications.set(record.id, record);
            this.saveTableToDisk('user_notifications.json', this.store.userNotifications, true);
            return record;
        },
        findMany: async (args) => {
            const list = Array.from(this.store.userNotifications.values());
            if (args?.where?.userId) {
                return list.filter((n) => n.userId === args.where.userId);
            }
            return list;
        },
        count: async () => {
            return this.store.userNotifications.size;
        },
    };
    // ==========================================================================
    // PRISMA MODEL DELEGATE: prisma.matchHistory
    // ==========================================================================
    matchHistory = {
        create: async (args) => {
            const id = args.data.id || `match_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            const record = {
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
        count: async () => {
            return this.store.matchHistory.size;
        },
    };
    // ==========================================================================
    // HIGH-LEVEL DOMAIN METHODS (Previously in DatabaseAdapter)
    // ==========================================================================
    async syncInitialCloudState() {
        if (this.isJest)
            return;
        try {
            const dbUsers = await this.rawClient.user.findMany().catch(() => []);
            if (dbUsers && dbUsers.length > 0) {
                for (const u of dbUsers) {
                    const rec = this.prismaUserToRecord(u);
                    this.users.set(rec.id, rec);
                    this.store.users.set(u.id, u);
                }
                console.log(`[PrismaService] PostgreSQL'den ${dbUsers.length} gerçek kullanıcı senkronize edildi.`);
            }
            const cloudUsers = await supabaseClient_1.supabaseService.loadCloudStore('users_store.json');
            if (cloudUsers && Array.isArray(cloudUsers)) {
                for (const u of cloudUsers) {
                    if (u && u.id && !this.users.has(u.id)) {
                        this.users.set(u.id, u);
                        this.syncUserToPrisma(u).catch(() => { });
                    }
                }
            }
            await supabaseClient_1.supabaseService.syncCloudStore('questions_store.json', this.questions);
            await supabaseClient_1.supabaseService.syncCloudStore('categories_store.json', this.getCategories());
        }
        catch {
            // Ignore background cloud sync errors
        }
    }
    loadPersistedUsers() {
        try {
            if (fs.existsSync(USERS_DB_FILE)) {
                const raw = fs.readFileSync(USERS_DB_FILE, 'utf-8');
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    for (const u of parsed) {
                        if (u && u.id) {
                            this.users.set(u.id, u);
                        }
                    }
                }
            }
        }
        catch {
            // Ignore read errors
        }
    }
    savePersistedUsers() {
        try {
            const list = Array.from(this.users.values()).filter((u) => !u.isGuest);
            if (!this.isJest) {
                fs.writeFileSync(USERS_DB_FILE, JSON.stringify(list, null, 2), 'utf-8');
                supabaseClient_1.supabaseService.syncCloudStore('users_store.json', list).catch(() => { });
            }
            for (const u of list) {
                this.syncUserToPrisma(u).catch(() => { });
            }
        }
        catch {
            // Ignore write errors
        }
    }
    savePersistedQuestions() {
        try {
            if (!this.isJest) {
                fs.writeFileSync(QUESTIONS_DB_FILE, JSON.stringify(this.questions, null, 2), 'utf-8');
                supabaseClient_1.supabaseService.syncCloudStore('questions_store.json', this.questions).catch(() => { });
                supabaseClient_1.supabaseService.syncCloudStore('categories_store.json', this.getCategories()).catch(() => { });
            }
            const latest = this.questions[this.questions.length - 1];
            if (latest) {
                this.syncQuestionToPrisma(latest).catch(() => { });
            }
        }
        catch {
            // Ignore write errors
        }
    }
    initQuestions() {
        const seenHashes = new Set();
        const combined = [];
        for (const q of questionsData_1.QUESTION_BANK) {
            const hash = q.contentHash || computeQuestionHash(q.text, q.options);
            if (!seenHashes.has(hash)) {
                seenHashes.add(hash);
                combined.push({
                    ...q,
                    reviewStatus: (q.reviewStatus || 'published'),
                    contentHash: hash,
                    createdAt: q.createdAt || new Date().toISOString(),
                    language: q.language || 'tr',
                });
            }
        }
        if (evrenLlmGenerator_1.RICH_SEED_BANK) {
            let seedCounter = 1;
            for (const [catKey, diffObj] of Object.entries(evrenLlmGenerator_1.RICH_SEED_BANK)) {
                if (catKey === 'mixed')
                    continue;
                const catId = catKey;
                for (const [diffKey, templates] of Object.entries(diffObj)) {
                    const difficulty = diffKey;
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
                const persisted = JSON.parse(raw);
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
        }
        catch {
            // Ignore read errors
        }
        this.questions = combined;
    }
    seedDefaults() {
        // No mock users: only genuine real users registered via multi-step wizard or Google OAuth are stored.
    }
    async syncUserToPrisma(record) {
        if (record.isGuest)
            return;
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
                    claimedSeasonTiers: (profile.claimedSeasonTiers || [1]),
                    friendIds: (profile.friendIds || []),
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
                    claimedSeasonTiers: (profile.claimedSeasonTiers || [1]),
                    friendIds: (profile.friendIds || []),
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
                }).catch(() => { });
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
                    },
                    create: {
                        id: notifId,
                        userId: record.id,
                        type: notif.type,
                        title: notif.title,
                        sub: notif.sub,
                        timeText: notif.timeText,
                        handled: notif.handled ?? null,
                    },
                }).catch(() => { });
            }
        }
        catch {
            // Safe failover
        }
    }
    async syncQuestionToPrisma(q) {
        const hash = q.contentHash || computeQuestionHash(q.text, q.options);
        await this.question.upsert({
            where: { id: q.id },
            update: {
                categoryId: q.categoryId,
                subCategory: q.subCategory ?? null,
                difficulty: q.difficulty,
                text: q.text,
                options: q.options,
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
                options: q.options,
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
    async syncAllToPrisma() {
        const cats = this.getCategories();
        for (const c of cats) {
            const catName = c.title || c.name || c.id;
            const catColor = c.accentColor || c.color || '#6366F1';
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
        for (const u of this.users.values()) {
            if (!u.isGuest) {
                await this.syncUserToPrisma(u);
            }
        }
    }
    async pushAllDataViaPrismaToSupabase() {
        await this.syncAllToPrisma();
        return this.pushAllTablesToSupabase();
    }
    calculateLevelBonus(payload) {
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
        const rankTitle = level >= 4 ? 'Bilgi Şövalyesi' : level >= 3 ? 'Usta Kaşif' : level >= 2 ? 'Yükselen Yıldız' : 'Acemi Kaşif';
        return { level, xp, coins, gems, rankTitle };
    }
    async createGuest(displayName) {
        const id = 'guest_' + Math.random().toString(36).substring(2, 9);
        const name = displayName || `Misafir_${Math.floor(1000 + Math.random() * 9000)}`;
        const record = {
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
        const token = jsonwebtoken_1.default.sign({ userId: id, username: record.username }, JWT_SECRET, { expiresIn: '7d' });
        return { token, user: this.toProfile(record) };
    }
    async register(usernameOrPayload, displayNameArg, passwordArg) {
        const payload = typeof usernameOrPayload === 'string'
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
        const passwordHash = await bcryptjs_1.default.hash(payload.password, 10);
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
        const token = jsonwebtoken_1.default.sign({ userId: id, username: record.username }, JWT_SECRET, { expiresIn: '30d' });
        return { token, user: this.toProfile(record) };
    }
    async login(identifier, password) {
        const cleanId = identifier.trim().toLowerCase();
        let dbUser = await this.rawClient.user.findFirst({
            where: {
                OR: [{ username: cleanId }, { email: cleanId }],
            },
        }).catch(() => null);
        if (!dbUser) {
            const memUser = Array.from(this.users.values()).find((u) => !u.isGuest && (u.username === cleanId || (u.email && u.email.toLowerCase() === cleanId)));
            if (memUser) {
                await this.syncUserToPrisma(memUser).catch(() => { });
                dbUser = await this.rawClient.user.findUnique({ where: { id: memUser.id } }).catch(() => null);
            }
        }
        if (!dbUser) {
            throw new Error('Bu e-posta veya kullanıcı adına ait kayıtlı bir hesap bulunamadı. Lütfen önce kayıt olun!');
        }
        if (!dbUser.passwordHash) {
            throw new Error('Bu hesap Google ile oluşturulmuş. Lütfen Google ile Giriş Yap butonunu kullanın.');
        }
        const match = await bcryptjs_1.default.compare(password, dbUser.passwordHash);
        if (!match) {
            throw new Error('Girdiğiniz şifre hatalı. Lütfen kontrol edip tekrar deneyin.');
        }
        const record = this.prismaUserToRecord(dbUser);
        this.users.set(record.id, record);
        this.store.users.set(dbUser.id, dbUser);
        const token = jsonwebtoken_1.default.sign({ userId: record.id, username: record.username }, JWT_SECRET, { expiresIn: '30d' });
        return { token, user: this.toProfile(record) };
    }
    async loginOrRegisterGoogle(payload) {
        const cleanEmail = payload.email.trim().toLowerCase();
        // 1. Search in local persistent in-memory database first
        let existingRecord = Array.from(this.users.values()).find((u) => !u.isGuest &&
            ((u.email && u.email.trim().toLowerCase() === cleanEmail) ||
                (payload.googleId && u.googleId === payload.googleId)));
        // 2. Search in PostgreSQL database (order by latest update)
        let dbUser = null;
        if (existingRecord) {
            dbUser = await this.rawClient.user
                .findUnique({ where: { id: existingRecord.id } })
                .catch(() => null);
        }
        if (!dbUser) {
            dbUser = await this.rawClient.user
                .findFirst({
                where: {
                    OR: [
                        { email: cleanEmail },
                        payload.googleId ? { googleId: payload.googleId } : {},
                    ].filter((x) => Object.keys(x).length > 0),
                },
                orderBy: { updatedAt: 'desc' },
            })
                .catch(() => null);
        }
        if (dbUser) {
            const fromDb = this.prismaUserToRecord(dbUser);
            if (existingRecord) {
                existingRecord.coins = Math.max(existingRecord.coins || 0, fromDb.coins || 0);
                existingRecord.gems = Math.max(existingRecord.gems || 0, fromDb.gems || 0);
                existingRecord.xp = Math.max(existingRecord.xp || 0, fromDb.xp || 0);
                existingRecord.level = Math.max(existingRecord.level || 1, fromDb.level || 1);
                if (fromDb.inventory && fromDb.inventory.length > (existingRecord.inventory?.length || 0)) {
                    existingRecord.inventory = fromDb.inventory;
                }
            }
            else {
                existingRecord = fromDb;
            }
            this.users.set(existingRecord.id, existingRecord);
        }
        let isNewUser = false;
        const now = new Date();
        if (!existingRecord) {
            // Truly a brand new user
            isNewUser = true;
            const baseUsername = cleanEmail.split('@')[0].replace(/[^a-z0-9_]/g, '') || 'oyuncu';
            let finalUsername = baseUsername;
            let counter = 1;
            while ((await this.rawClient.user.findUnique({ where: { username: finalUsername } }).catch(() => null)) ||
                Array.from(this.users.values()).some((u) => u.username === finalUsername)) {
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
                });
            }
            catch (err) {
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
                };
            }
            existingRecord = this.prismaUserToRecord(dbUser);
        }
        else {
            // Existing user: Preserve all earned stats, coins, gems, xp, and inventory!
            existingRecord.displayName = payload.displayName || existingRecord.displayName;
            if (payload.fullName)
                existingRecord.fullName = payload.fullName;
            if (payload.avatarUrl)
                existingRecord.avatarUrl = payload.avatarUrl;
            if (payload.googleId)
                existingRecord.googleId = payload.googleId;
            existingRecord.updatedAt = Date.now();
            if (dbUser) {
                try {
                    dbUser = await this.rawClient.user.update({
                        where: { id: dbUser.id },
                        data: {
                            displayName: existingRecord.displayName,
                            fullName: existingRecord.fullName,
                            avatarUrl: existingRecord.avatarUrl,
                            googleId: existingRecord.googleId,
                            coins: existingRecord.coins,
                            gems: existingRecord.gems,
                            xp: existingRecord.xp,
                            level: existingRecord.level,
                            updatedAt: now,
                        },
                    });
                }
                catch { }
            }
        }
        this.users.set(existingRecord.id, existingRecord);
        if (dbUser) {
            this.store.users.set(dbUser.id, dbUser);
        }
        this.savePersistedUsers();
        const token = jsonwebtoken_1.default.sign({ userId: existingRecord.id, username: existingRecord.username }, JWT_SECRET, { expiresIn: '30d' });
        return { token, user: this.toProfile(existingRecord), isNewUser };
    }
    async deleteAccount(userId) {
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
        }
        catch { }
        // 4. Save persisted users snapshot
        this.savePersistedUsers();
        return {
            success: true,
            message: 'Hesabınız ve tüm oyun verileriniz kalıcı olarak silindi.',
        };
    }
    async requestPasswordReset(identifier) {
        const cleanId = identifier.trim().toLowerCase();
        const record = Array.from(this.users.values()).find((u) => !u.isGuest && (u.username === cleanId || (u.email && u.email.toLowerCase() === cleanId)));
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
    async confirmPasswordReset(identifier, otpCode, newPassword) {
        const cleanId = identifier.trim().toLowerCase();
        const record = Array.from(this.users.values()).find((u) => !u.isGuest && (u.username === cleanId || (u.email && u.email.toLowerCase() === cleanId)));
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
        record.passwordHash = await bcryptjs_1.default.hash(newPassword, 10);
        record.resetOtpCode = undefined;
        record.resetOtpExpiresAt = undefined;
        this.savePersistedUsers();
        supabaseClient_1.supabaseService.upsertUser(record).catch(() => { });
        const token = jsonwebtoken_1.default.sign({ userId: record.id, username: record.username }, JWT_SECRET, { expiresIn: '30d' });
        return {
            success: true,
            message: 'Şifreniz başarıyla yenilendi!',
            token,
            user: this.toProfile(record),
        };
    }
    async updateUserProfile(userId, updates) {
        const record = this.users.get(userId);
        if (!record) {
            throw new Error('Kullanıcı bulunamadı.');
        }
        if (updates.displayName !== undefined && updates.displayName.trim()) {
            record.displayName = updates.displayName.trim();
        }
        if (updates.fullName !== undefined)
            record.fullName = updates.fullName.trim();
        if (updates.email !== undefined)
            record.email = updates.email.trim().toLowerCase();
        if (updates.countryCode !== undefined)
            record.countryCode = updates.countryCode;
        if (updates.countryName !== undefined)
            record.countryName = updates.countryName;
        if (updates.phone !== undefined)
            record.phone = updates.phone.trim();
        if (updates.birthDate !== undefined)
            record.birthDate = updates.birthDate.trim();
        if (updates.gender !== undefined)
            record.gender = updates.gender;
        if (updates.bio !== undefined)
            record.bio = updates.bio.trim();
        if (updates.avatarUrl !== undefined)
            record.avatarUrl = updates.avatarUrl;
        this.users.set(userId, record);
        this.savePersistedUsers();
        supabaseClient_1.supabaseService.upsertUser(record).catch(() => { });
        return this.toProfile(record);
    }
    async recordGameStats(userId, delta) {
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
            }
            catch { }
        }
        if (!record)
            return null;
        // Balanced RPG XP curve: Cap single match XP to prevent rapid leveling
        const cappedXp = Math.min(delta.xpEarned, delta.won ? 80 : 30);
        record.xp += cappedXp;
        record.coins += delta.coinsEarned;
        // Season 1 Pass XP progression
        const seasonXpGain = delta.won ? 60 : 25;
        record.seasonXp = (record.seasonXp || 0) + seasonXpGain;
        const progress = (0, shared_1.calculateLevelFromXp)(record.xp);
        record.level = progress.level;
        record.rankTitle = progress.rankTitle;
        record.stats.totalMatches += 1;
        if (delta.won)
            record.stats.wins += 1;
        record.stats.correctAnswers += delta.correctAnswers;
        record.stats.totalAnswers += delta.totalAnswers;
        record.stats.bestStreak = Math.max(record.stats.bestStreak || 0, delta.bestStreak);
        record.updatedAt = Date.now();
        // Automatically update live event progress ONLY for tasks the user actively started and not completed yet
        this.updateStartedEvents(record, {
            matches: 1,
            won: delta.won,
            correctAnswers: delta.correctAnswers,
            streak: delta.bestStreak,
        });
        this.users.set(userId, record);
        this.users.set(record.id, record);
        if (record.username)
            this.users.set(record.username, record);
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
                        updatedAt: new Date(),
                    },
                });
            }
            catch (err) {
                console.error('[recordGameStats] PostgreSQL update error:', err);
            }
        }
        return this.toProfile(record);
    }
    async syncWallet(userId, data) {
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
            }
            catch { }
        }
        if (!record)
            return null;
        if (typeof data.coins === 'number' && data.coins > 0) {
            record.coins = Math.max(record.coins || 0, data.coins);
        }
        if (typeof data.gems === 'number' && data.gems > 0) {
            record.gems = Math.max(record.gems || 0, data.gems);
        }
        if (typeof data.xp === 'number' && data.xp > 0) {
            record.xp = Math.max(record.xp || 0, data.xp);
        }
        if (typeof data.level === 'number' && data.level > 0) {
            record.level = Math.max(record.level || 1, data.level);
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
        }
        catch (err) {
            console.error('[syncWallet] PostgreSQL update error:', err);
        }
        return this.toProfile(record);
    }
    updateStartedEvents(record, delta) {
        if (!record.eventProgress)
            record.eventProgress = {};
        const ev = record.eventProgress;
        for (const def of shared_1.EVENT_DEFINITIONS) {
            const state = ev[def.id];
            // Only track if user actively started this event and has not completed it yet
            if (!state || !state.started || state.completed || state.claimed)
                continue;
            let increment = 0;
            if (def.metric === 'matches_played' && delta.matches) {
                increment = delta.matches;
            }
            else if (def.metric === 'wins' && delta.won) {
                increment = 1;
            }
            else if (def.metric === 'correct_answers' && delta.correctAnswers) {
                increment = delta.correctAnswers;
            }
            else if (def.metric === 'streak' && delta.streak && delta.streak > 0) {
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
    verifyToken(token) {
        try {
            return jsonwebtoken_1.default.verify(token, JWT_SECRET);
        }
        catch {
            return null;
        }
    }
    getUserProfile(userId) {
        const record = this.users.get(userId);
        return record ? this.toProfile(record) : null;
    }
    async getUserProfileAsync(userId) {
        let record = this.users.get(userId);
        if (!record) {
            try {
                const u = await this.rawClient.user.findFirst({
                    where: {
                        OR: [{ id: userId }, { username: userId }],
                    },
                    orderBy: { updatedAt: 'desc' },
                });
                if (u) {
                    record = this.prismaUserToRecord(u);
                    this.users.set(record.id, record);
                }
            }
            catch { }
        }
        return record ? this.toProfile(record) : null;
    }
    async recordDailyChallengeCompletion(userId, data) {
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
            }
            catch { }
        }
        if (!record) {
            return { success: false, user: null, error: 'Kullanıcı bulunamadı', streakIncreased: false };
        }
        const currentStreak = Math.max(1, record.dailyStreak || 1);
        const cfg = (0, shared_1.getDailyChallengeConfig)(currentStreak);
        if (data.correctAnswers < cfg.requiredCorrect) {
            return {
                success: false,
                user: this.toProfile(record),
                error: `Hedef tamamlanamadı. En az ${cfg.requiredCorrect} doğru gerekliydi (${data.correctAnswers}/${data.totalQuestions} yapıldı).`,
                streakIncreased: false,
            };
        }
        const todayStr = new Date().toISOString().slice(0, 10);
        if (!record.categoryMastery)
            record.categoryMastery = {};
        const dcState = record.categoryMastery.dailyChallenge || {};
        const alreadyDoneToday = dcState.lastCompletedDate === todayStr;
        let newStreak = currentStreak;
        if (!alreadyDoneToday) {
            newStreak = currentStreak + 1;
            record.dailyStreak = newStreak;
            record.stats.bestStreak = Math.max(record.stats.bestStreak || 0, newStreak);
            record.categoryMastery.dailyChallenge = {
                lastCompletedDate: todayStr,
                streak: newStreak,
            };
            record.xp += cfg.rewardXp;
            record.coins += cfg.rewardCoins;
            record.gems = (record.gems || 15) + cfg.rewardGems;
            if (cfg.rewardChest) {
                if (!record.inventory)
                    record.inventory = [];
                const chestItem = record.inventory.find((i) => i.id === 'chest' || i.id === cfg.rewardChest);
                if (chestItem)
                    chestItem.qty += 1;
                else
                    record.inventory.push({ id: cfg.rewardChest, name: 'Günün Sandığı', desc: 'Meydan okuma ödülü', qty: 1 });
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
        const prog = (0, shared_1.calculateLevelFromXp)(record.xp);
        record.level = prog.level;
        record.rankTitle = prog.rankTitle;
        this.users.set(record.id, record);
        if (!record.isGuest) {
            this.savePersistedUsers();
            this.syncUserToPrisma(record).catch(() => { });
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
    getCategories() {
        const published = this.questions.filter((q) => (q.reviewStatus || 'published') === 'published');
        const countsByCategory = {};
        for (const q of published) {
            countsByCategory[q.categoryId] = (countsByCategory[q.categoryId] || 0) + 1;
        }
        return this.categories.map((cat) => ({
            ...cat,
            totalQuestions: cat.id === 'mixed'
                ? published.length
                : countsByCategory[cat.id] || 0,
        }));
    }
    getAllQuestions() {
        return [...this.questions];
    }
    getQuestionById(id) {
        return this.questions.find((q) => q.id === id);
    }
    getQuestionsByStatus(status, limit = 50, offset = 0) {
        return this.questions
            .filter((q) => q.reviewStatus === status)
            .slice(offset, offset + limit);
    }
    hasQuestionHash(hash) {
        return this.questions.some((q) => q.contentHash === hash);
    }
    createQuestion(data) {
        const hash = data.contentHash || computeQuestionHash(data.text, data.options);
        const newQuestion = {
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
    approveQuestion(id, reviewedBy, pool = 'standard') {
        const q = this.questions.find((item) => item.id === id);
        if (!q)
            return null;
        q.reviewStatus = 'published';
        q.reviewedBy = reviewedBy;
        q.reviewedAt = new Date().toISOString();
        q.targetPool = pool;
        if (pool === 'daily_challenge') {
            q.isDailyChallenge = true;
        }
        else if (pool === 'custom_room') {
            q.isCustomRoomOnly = true;
        }
        this.savePersistedQuestions();
        return q;
    }
    rejectQuestion(id, reviewedBy, reason) {
        const q = this.questions.find((item) => item.id === id);
        if (!q)
            return null;
        q.reviewStatus = 'rejected';
        q.reviewedBy = reviewedBy;
        q.rejectionReason = reason;
        q.reviewedAt = new Date().toISOString();
        this.savePersistedQuestions();
        return q;
    }
    updateQuestion(id, updates) {
        const idx = this.questions.findIndex((item) => item.id === id);
        if (idx === -1)
            return null;
        const existing = this.questions[idx];
        const updated = {
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
    getReviewStats() {
        const stats = {
            total: this.questions.length,
            pending: 0,
            approved: 0,
            published: 0,
            rejected: 0,
            byCategory: {},
            byDifficulty: {},
        };
        this.questions.forEach((q) => {
            const status = q.reviewStatus || 'published';
            if (status === 'pending_review')
                stats.pending++;
            else if (status === 'approved')
                stats.approved++;
            else if (status === 'published')
                stats.published++;
            else if (status === 'rejected')
                stats.rejected++;
            if (status === 'published') {
                stats.byCategory[q.categoryId] = (stats.byCategory[q.categoryId] || 0) + 1;
                stats.byDifficulty[q.difficulty] = (stats.byDifficulty[q.difficulty] || 0) + 1;
            }
        });
        return stats;
    }
    getQuestions(category = 'mixed', difficulty, count = 10, seenIds = []) {
        const allPublished = this.questions.filter((q) => q.reviewStatus === 'published');
        const pickedMap = new Map();
        const categoryPool = category === 'mixed'
            ? allPublished
            : allPublished.filter((q) => q.categoryId === category);
        let primaryPool = categoryPool;
        if (difficulty) {
            const withDiff = categoryPool.filter((q) => q.difficulty === difficulty);
            if (withDiff.length > 0) {
                primaryPool = withDiff;
            }
        }
        const shuffledPrimary = [...primaryPool].sort(() => 0.5 - Math.random());
        for (const q of shuffledPrimary) {
            if (pickedMap.size >= count)
                break;
            if (!seenIds.includes(q.id)) {
                pickedMap.set(q.id, q);
            }
        }
        if (pickedMap.size < count) {
            const sameCategoryUnseen = categoryPool
                .filter((q) => !pickedMap.has(q.id) && !seenIds.includes(q.id))
                .sort(() => 0.5 - Math.random());
            for (const q of sameCategoryUnseen) {
                if (pickedMap.size >= count)
                    break;
                pickedMap.set(q.id, q);
            }
        }
        if (pickedMap.size < count) {
            for (const q of shuffledPrimary) {
                if (pickedMap.size >= count)
                    break;
                if (!pickedMap.has(q.id)) {
                    pickedMap.set(q.id, q);
                }
            }
        }
        if (pickedMap.size < count) {
            const sameCategoryAny = [...categoryPool].sort(() => 0.5 - Math.random());
            for (const q of sameCategoryAny) {
                if (pickedMap.size >= count)
                    break;
                if (!pickedMap.has(q.id)) {
                    pickedMap.set(q.id, q);
                }
            }
        }
        if (pickedMap.size < count && (category === 'mixed' || categoryPool.length === 0)) {
            const fallbackPool = allPublished
                .filter((q) => !pickedMap.has(q.id))
                .sort(() => 0.5 - Math.random());
            for (const q of fallbackPool) {
                if (pickedMap.size >= count)
                    break;
                pickedMap.set(q.id, q);
            }
        }
        return Array.from(pickedMap.values()).sort(() => 0.5 - Math.random());
    }
    getDailyChallenge() {
        const today = new Date().toISOString().split('T')[0];
        const dedicated = this.questions.filter((q) => (q.targetPool === 'daily_challenge' || q.isDailyChallenge) && q.reviewStatus === 'published');
        let selected = [];
        if (dedicated.length >= 5) {
            selected = [...dedicated].sort(() => 0.5 - Math.random()).slice(0, 5);
        }
        else if (dedicated.length > 0) {
            const rest = this.getQuestions('mixed', undefined, 5 - dedicated.length);
            selected = [...dedicated, ...rest];
        }
        else {
            selected = this.getQuestions('mixed', undefined, 5);
        }
        return {
            date: today,
            questions: selected,
        };
    }
    async findUserByUsernameOrId(query) {
        const qLower = query.toLowerCase().trim();
        for (const record of this.users.values()) {
            if (record.id === query ||
                record.username?.toLowerCase() === qLower ||
                record.displayName?.toLowerCase() === qLower) {
                return this.toProfile(record);
            }
        }
        return this.getUserProfileAsync(query);
    }
    searchQuestions(keyword, limit = 5) {
        const kw = keyword.toLowerCase().trim();
        return this.questions
            .filter((q) => q.text.toLowerCase().includes(kw) || q.subCategory?.toLowerCase().includes(kw))
            .slice(0, limit);
    }
    defaultInventory() {
        return [];
    }
    defaultNotifications(displayName) {
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
    generateFriendCode(id) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let rand = '';
        for (let i = 0; i < 4; i++) {
            rand += chars[Math.floor(Math.random() * chars.length)];
        }
        const clean = id.replace(/[^a-zA-Z0-9]/g, '').slice(-3).toUpperCase();
        return `TV-${clean || 'X'}${rand}`;
    }
    getLeaderboard(limit = 20) {
        const list = Array.from(this.users.values())
            .filter((u) => !u.isGuest)
            .sort((a, b) => b.rankPoints - a.rankPoints || b.xp - a.xp)
            .slice(0, limit)
            .map((u) => this.toProfile(u));
        return list;
    }
    setUserActiveRoom(userId, roomCode) {
        if (roomCode) {
            this.activeUserRooms.set(userId, { roomCode, joinedAt: Date.now() });
        }
        else {
            this.activeUserRooms.delete(userId);
        }
    }
    getFriendsForUser(userId) {
        const me = this.users.get(userId);
        const friendCode = me?.friendCode || this.generateFriendCode(userId);
        const explicitFriendIds = new Set(me?.friendIds || []);
        const explicitFriends = [];
        for (const fId of explicitFriendIds) {
            const u = this.users.get(fId);
            if (u) {
                const prog = (0, shared_1.calculateLevelFromXp)(u.xp || 0);
                const roomInfo = this.activeUserRooms.get(u.id);
                const inRoom = !!roomInfo;
                const currentRoomCode = roomInfo ? roomInfo.roomCode : undefined;
                explicitFriends.push({
                    id: u.id,
                    username: u.username,
                    displayName: u.displayName || u.username,
                    name: u.displayName || u.username,
                    avatarUrl: u.avatarUrl || 'av1',
                    level: prog.level,
                    rankTitle: prog.rankTitle,
                    rankPoints: u.rankPoints || 1000,
                    xp: u.xp || 0,
                    wins: u.stats?.wins || 0,
                    totalMatches: u.stats?.totalMatches || 0,
                    correctAnswers: u.stats?.correctAnswers || 0,
                    bestStreak: u.stats?.bestStreak || 0,
                    countryCode: u.countryCode || 'TR',
                    countryName: u.countryName || 'Türkiye',
                    online: true,
                    status: inRoom ? `Oda: #${currentRoomCode} · Lobide` : 'Arkadaşın · Çevrimiçi',
                    isFriend: true,
                    inRoom,
                    currentRoomCode,
                });
            }
        }
        const otherUsers = Array.from(this.users.values())
            .filter((u) => u.id !== userId && !u.isGuest && !explicitFriendIds.has(u.id))
            .slice(0, 10)
            .map((u, idx) => {
            const prog = (0, shared_1.calculateLevelFromXp)(u.xp || 0);
            const roomInfo = this.activeUserRooms.get(u.id);
            // DenizPro (idx === 0) has an active demo room so users can immediately test room join
            const inRoom = !!roomInfo || idx === 0;
            const currentRoomCode = roomInfo ? roomInfo.roomCode : idx === 0 ? 'DENIZ1' : undefined;
            return {
                id: u.id,
                username: u.username,
                displayName: u.displayName || u.username,
                name: u.displayName || u.username,
                avatarUrl: u.avatarUrl || 'av1',
                level: prog.level,
                rankTitle: prog.rankTitle,
                rankPoints: u.rankPoints || 1000,
                xp: u.xp || 0,
                wins: u.stats?.wins || 0,
                totalMatches: u.stats?.totalMatches || 0,
                correctAnswers: u.stats?.correctAnswers || 0,
                bestStreak: u.stats?.bestStreak || 0,
                countryCode: u.countryCode || 'TR',
                countryName: u.countryName || 'Türkiye',
                online: idx % 3 !== 2,
                status: inRoom
                    ? `Oda: #${currentRoomCode} · Lobide`
                    : idx % 3 !== 2
                        ? 'Çevrimiçi'
                        : 'Çevrimdışı',
                isFriend: false,
                inRoom,
                currentRoomCode,
            };
        });
        return { friendCode, friends: [...explicitFriends, ...otherUsers] };
    }
    async addFriend(userId, targetCodeOrUsername) {
        const me = this.users.get(userId);
        if (!me)
            return { success: false, error: 'Kullanıcı bulunamadı.' };
        const clean = targetCodeOrUsername.trim().toUpperCase();
        const cleanLower = targetCodeOrUsername.trim().toLowerCase();
        // Find target user by friendCode or username
        const target = Array.from(this.users.values()).find((u) => !u.isGuest &&
            ((u.friendCode && u.friendCode.toUpperCase() === clean) ||
                u.username.toLowerCase() === cleanLower));
        if (!target) {
            return {
                success: false,
                error: 'Bu arkadaşlık kodu veya kullanıcı adına ait oyuncu bulunamadı.',
            };
        }
        if (target.id === userId) {
            return { success: false, error: 'Kendi kodunuzu arkadaş olarak ekleyemezsiniz!' };
        }
        if (!me.friendIds)
            me.friendIds = [];
        if (!target.friendIds)
            target.friendIds = [];
        if (me.friendIds.includes(target.id)) {
            return { success: false, error: 'Bu kullanıcı zaten arkadaş listenizde!' };
        }
        // Add friend request notification to target user so they can accept / decline
        if (!target.notifications)
            target.notifications = [];
        // Check if an existing pending request is already present
        const existingReq = target.notifications.find((n) => n.type === 'friend_request' && n.senderId === me.id && !n.handled);
        if (!existingReq) {
            target.notifications.unshift({
                id: 'notif_fr_' + Date.now(),
                type: 'friend_request',
                title: `${me.displayName} sana arkadaşlık isteği gönderdi!`,
                sub: '1v1 düello maçları ve ortak odalarda yarışmak için isteği kabul et.',
                timeText: 'Az önce',
                senderId: me.id,
                senderName: me.displayName,
                senderAvatar: me.avatarUrl || 'av1',
                handled: null,
            });
        }
        // For instantaneous convenience, also add to friend lists mutually
        me.friendIds.push(target.id);
        if (!target.friendIds.includes(me.id)) {
            target.friendIds.push(me.id);
        }
        this.users.set(me.id, me);
        this.users.set(target.id, target);
        this.savePersistedUsers();
        const progress = (0, shared_1.calculateLevelFromXp)(target.xp || 0);
        return {
            success: true,
            friend: {
                id: target.id,
                username: target.username,
                displayName: target.displayName,
                avatarUrl: target.avatarUrl || 'av1',
                level: progress.level,
                rankTitle: progress.rankTitle,
                rankPoints: target.rankPoints || 1000,
                online: true,
                status: 'Arkadaşın · Çevrimiçi',
                isFriend: true,
            },
        };
    }
    getUserNotifications(userId) {
        const user = this.users.get(userId);
        if (!user)
            return [];
        if (!user.notifications || user.notifications.length === 0) {
            user.notifications = [
                {
                    id: 'notif_fr_sample',
                    type: 'friend_request',
                    title: 'Ece Yıldız sana arkadaşlık isteği gönderdi!',
                    sub: '1v1 düellolar ve özel odalar için isteği kabul et.',
                    timeText: 'Az önce',
                    senderId: 'user_ece',
                    senderName: 'Ece Yıldız',
                    senderAvatar: 'av2',
                    handled: null,
                },
                {
                    id: 'notif_duel_sample',
                    type: 'match_invite',
                    title: 'Burak Challenge sana 1v1 Düello Meydan Okudu!',
                    sub: 'Bilim & Genel Kültür · Hazırsan kabul et ve hemen yarış!',
                    timeText: '3 dk önce',
                    senderId: 'user_burak',
                    senderName: 'Burak Challenge',
                    senderAvatar: 'av3',
                    roomCode: 'BURAK1',
                    handled: null,
                },
                {
                    id: 'notif_rew_sample',
                    type: 'reward',
                    title: 'Haftalık Katılım Ödülü Hazır!',
                    sub: 'Tebrikler! +150 Altın ve +10 Elmas hesabına yüklendi.',
                    timeText: 'Bugün',
                },
            ];
            this.users.set(userId, user);
            this.savePersistedUsers();
        }
        return user.notifications;
    }
    async respondToNotification(userId, notificationId, action) {
        const finalHandled = action === 'accept' ? 'accepted' : 'declined';
        const user = this.users.get(userId);
        if (!user) {
            return { success: false, handled: finalHandled, error: 'Kullanıcı bulunamadı.', message: '' };
        }
        if (!user.notifications)
            user.notifications = [];
        const notif = user.notifications.find((n) => n.id === notificationId);
        if (!notif) {
            return { success: false, handled: finalHandled, error: 'Bildirim bulunamadı.', message: '' };
        }
        notif.handled = finalHandled;
        if (notif.type === 'friend_request' || notif.type === 'friend') {
            if (action === 'accept') {
                notif.sub = 'Arkadaşlık isteği kabul edildi. Artık arkadaşsınız!';
                if (notif.senderId) {
                    if (!user.friendIds)
                        user.friendIds = [];
                    if (!user.friendIds.includes(notif.senderId)) {
                        user.friendIds.push(notif.senderId);
                    }
                    const sender = this.users.get(notif.senderId);
                    if (sender) {
                        if (!sender.friendIds)
                            sender.friendIds = [];
                        if (!sender.friendIds.includes(user.id)) {
                            sender.friendIds.push(user.id);
                        }
                        if (!sender.notifications)
                            sender.notifications = [];
                        sender.notifications.unshift({
                            id: 'notif_fra_' + Date.now(),
                            type: 'system',
                            title: `${user.displayName} arkadaşlık isteğini kabul etti!`,
                            sub: 'Artık 1v1 düello maçlarına davet edebilirsin.',
                            timeText: 'Az önce',
                        });
                        this.users.set(sender.id, sender);
                    }
                }
            }
            else {
                notif.sub = 'Arkadaşlık isteği reddedildi.';
            }
        }
        else if (notif.type === 'match_invite' || notif.type === 'duel') {
            if (action === 'accept') {
                notif.sub = 'Düello daveti kabul edildi! Odaya katıldın.';
                this.savePersistedUsers();
                return {
                    success: true,
                    handled: 'accepted',
                    roomCode: notif.roomCode || 'BURAK1',
                    message: 'Düello daveti kabul edildi! Odaya aktarılıyorsunuz...',
                };
            }
            else {
                notif.sub = 'Düello daveti reddedildi.';
            }
        }
        this.users.set(user.id, user);
        this.savePersistedUsers();
        return {
            success: true,
            handled: finalHandled,
            message: action === 'accept' ? 'İşlem başarıyla onaylandı.' : 'İstek reddedildi.',
        };
    }
    async sendDuelChallenge(userId, targetUserId, category = 'genel_kultur') {
        const me = this.users.get(userId);
        if (!me)
            return { success: false, error: 'Kullanıcı oturumu bulunamadı.', message: '' };
        const target = this.users.get(targetUserId);
        if (!target)
            return { success: false, error: 'Hedef oyuncu bulunamadı.', message: '' };
        const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        this.setUserActiveRoom(userId, roomCode);
        if (!target.notifications)
            target.notifications = [];
        target.notifications.unshift({
            id: 'notif_chal_' + Date.now(),
            type: 'match_invite',
            title: `${me.displayName} sana 1v1 Düello Meydan Okudu!`,
            sub: 'Özel 1v1 düello odası hazır. Kabul et ve hemen yarışmaya başla!',
            timeText: 'Az önce',
            senderId: me.id,
            senderName: me.displayName,
            senderAvatar: me.avatarUrl || 'av1',
            roomCode: roomCode,
            handled: null,
        });
        this.users.set(target.id, target);
        this.savePersistedUsers();
        return {
            success: true,
            roomCode,
            message: `${target.displayName} kullanıcısına 1v1 düello daveti başarıyla gönderildi!`,
        };
    }
    async purchaseShopPack(userId, pack) {
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
            }
            catch { }
        }
        if (!record)
            throw new Error('Kullanıcı bulunamadı.');
        // Balance validation to prevent bugs and negative balances
        if (pack.coinsDelta && pack.coinsDelta < 0) {
            const requiredCoins = Math.abs(pack.coinsDelta);
            const currentCoins = record.coins || 0;
            if (currentCoins < requiredCoins) {
                throw new Error(`Yetersiz Altın! Bu işlem için ${requiredCoins} Altın gerekiyor (Mevcut: ${currentCoins} Altın, Eksik: ${requiredCoins - currentCoins} Altın).`);
            }
        }
        if (pack.gemsDelta && pack.gemsDelta < 0) {
            const requiredGems = Math.abs(pack.gemsDelta);
            const currentGems = record.gems || 0;
            if (currentGems < requiredGems) {
                throw new Error(`Yetersiz Elmas! Bu işlem için ${requiredGems} Elmas gerekiyor (Mevcut: ${currentGems} Elmas, Eksik: ${requiredGems - currentGems} Elmas).`);
            }
        }
        if (pack.coinsDelta) {
            record.coins = Math.max(0, (record.coins || 0) + pack.coinsDelta);
        }
        if (pack.gemsDelta) {
            record.gems = Math.max(0, (record.gems || 0) + pack.gemsDelta);
        }
        if (!record.inventory)
            record.inventory = this.defaultInventory();
        if (pack.itemId) {
            const existing = record.inventory.find((i) => i.id === pack.itemId);
            if (existing) {
                existing.qty += pack.itemQty || 1;
            }
            else {
                record.inventory.push({
                    id: pack.itemId,
                    name: pack.itemId === 'chest' ? 'Ahşap Sandık' : 'Özel Eşya',
                    desc: 'Satın alınan eşya',
                    qty: pack.itemQty || 1,
                });
            }
        }
        this.users.set(userId, record);
        this.users.set(record.id, record);
        if (record.username)
            this.users.set(record.username, record);
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
            }
            catch (err) {
                console.error('[openChest] DB update error:', err);
            }
        }
        return this.toProfile(record);
    }
    async useInventoryItem(userId, itemId) {
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
            }
            catch { }
        }
        if (!record)
            throw new Error('Kullanıcı bulunamadı.');
        if (!record.inventory)
            record.inventory = this.defaultInventory();
        const item = record.inventory.find((i) => i.id === itemId);
        if (!item || item.qty <= 0) {
            throw new Error('Bu eşyadan envanterinizde kalmadı.');
        }
        // Key requirement for chest
        if (itemId === 'chest') {
            const keyItem = record.inventory.find((i) => i.id === 'key');
            if (!keyItem || keyItem.qty <= 0) {
                throw new Error('Sandığı açmak için en az 1 adet Altın Anahtara ihtiyacın var! (Mevcut: 0 Anahtar).');
            }
            keyItem.qty -= 1;
        }
        item.qty -= 1;
        let rewardText = `${item.name} kullanıldı!`;
        if (itemId === 'chest' || itemId === 'gift') {
            record.coins += 200;
            record.gems = (record.gems || 0) + 10;
            record.xp += 150;
            rewardText = 'Sandık açıldı: +200 Altın, +10 Elmas ve +150 XP kazandın!';
        }
        else if (itemId === 'gem') {
            record.gems = (record.gems || 0) + 10;
            rewardText = '+10 Elmas hesabına eklendi!';
        }
        else if (itemId === 'coin') {
            record.coins += 100;
            rewardText = '+100 Altın hesabına eklendi!';
        }
        else {
            record.xp += 100;
            rewardText = `${item.name} aktif edildi: +100 XP kazandın!`;
        }
        const prog = (0, shared_1.calculateLevelFromXp)(record.xp);
        record.level = prog.level;
        record.rankTitle = prog.rankTitle;
        this.users.set(userId, record);
        this.users.set(record.id, record);
        if (record.username)
            this.users.set(record.username, record);
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
            }
            catch (err) {
                console.error('[openChest] DB update error:', err);
            }
        }
        return { user: this.toProfile(record), rewardText };
    }
    async claimSeasonTier(userId, tier, track = 'free') {
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
            }
            catch { }
        }
        if (!record)
            throw new Error('Kullanıcı bulunamadı.');
        if (tier < 1 || tier > 50) {
            throw new Error('Geçersiz sezon aşaması (1-50 arası olmalıdır).');
        }
        const tierData = shared_1.SEASON_1_TIERS.find((t) => t.tier === tier);
        if (!tierData)
            throw new Error(`${tier}. aşama verisi bulunamadı.`);
        const userSeasonXp = record.seasonXp || 0;
        if (userSeasonXp < tierData.requiredSeasonXp) {
            const missing = tierData.requiredSeasonXp - userSeasonXp;
            throw new Error(`Bu kademe kilitli! Açmak için ${tierData.requiredSeasonXp} Sezon XP gerekli (Mevcut: ${userSeasonXp}, Eksik: ${missing} Sezon XP).`);
        }
        if (!record.claimedSeasonFreeTiers)
            record.claimedSeasonFreeTiers = [];
        if (!record.claimedSeasonPremiumTiers)
            record.claimedSeasonPremiumTiers = [];
        if (track === 'premium') {
            if (!record.hasPremiumPass) {
                throw new Error('Bu ödülü almak için Sezon 1 Premium Pass sahibi olmalısınız!');
            }
            if (record.claimedSeasonPremiumTiers.includes(tier)) {
                throw new Error('Bu Premium kademe ödülü zaten hesabınıza tanımlandı.');
            }
        }
        else {
            if (record.claimedSeasonFreeTiers.includes(tier)) {
                throw new Error('Bu Ücretsiz kademe ödülü zaten hesabınıza tanımlandı.');
            }
        }
        const reward = track === 'premium' ? tierData.premiumReward : tierData.freeReward;
        // Grant reward to user account/inventory
        if (reward.type === 'coin') {
            record.coins += reward.amount;
        }
        else if (reward.type === 'gem') {
            record.gems = (record.gems || 0) + reward.amount;
        }
        else {
            if (!record.inventory)
                record.inventory = [];
            const itemId = reward.itemId || `${reward.type}_${tier}`;
            const existing = record.inventory.find((i) => i.id === itemId);
            if (existing) {
                existing.qty += reward.amount;
            }
            else {
                record.inventory.push({
                    id: itemId,
                    name: reward.title,
                    desc: `Sezon 1 Kademe ${tier} ${track === 'premium' ? 'Premium' : 'Ücretsiz'} Ödülü`,
                    qty: reward.amount,
                    category: reward.type,
                    rarity: reward.rarity || 'rare',
                });
            }
            if (reward.type === 'frame' && !record.equippedFrame)
                record.equippedFrame = itemId;
            if (reward.type === 'badge' && !record.equippedBadge)
                record.equippedBadge = itemId;
            if (reward.type === 'name_effect' && !record.equippedNameEffect)
                record.equippedNameEffect = itemId;
            if (reward.type === 'background' && !record.equippedBackground)
                record.equippedBackground = itemId;
        }
        if (track === 'premium') {
            record.claimedSeasonPremiumTiers.push(tier);
        }
        else {
            record.claimedSeasonFreeTiers.push(tier);
        }
        this.users.set(userId, record);
        this.users.set(record.id, record);
        if (record.username)
            this.users.set(record.username, record);
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
            }
            catch (err) {
                console.error('[openChest] DB update error:', err);
            }
        }
        return { user: this.toProfile(record), reward };
    }
    async buyPremiumPass(userId) {
        const record = this.users.get(userId);
        if (!record)
            throw new Error('Kullanıcı bulunamadı.');
        if (record.hasPremiumPass) {
            throw new Error('Zaten Sezon 1 Premium Pass sahibisiniz!');
        }
        const costGems = 250;
        if ((record.gems || 0) < costGems) {
            throw new Error(`Yetersiz Elmas! Premium Pass için ${costGems} Elmas gerekli (Mevcut: ${record.gems || 0} Elmas).`);
        }
        record.gems = (record.gems || 0) - costGems;
        record.hasPremiumPass = true;
        this.users.set(userId, record);
        this.users.set(record.id, record);
        if (record.username)
            this.users.set(record.username, record);
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
            }
            catch (err) {
                console.error('[openChest] DB update error:', err);
            }
        }
        return this.toProfile(record);
    }
    async purchaseShopProduct(userId, productId, paymentMethod = 'coins') {
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
            }
            catch { }
        }
        if (!record)
            throw new Error('Kullanıcı bulunamadı.');
        const product = shared_1.SHOP_CATALOG.find((p) => p.id === productId);
        if (!product)
            throw new Error('Ürün mağazada bulunamadı.');
        if (product.currency === 'coins') {
            if (record.coins < product.price) {
                throw new Error(`Yetersiz Altın! Bu ürün için ${product.price} Altın gereklidir (Mevcut: ${record.coins} Altın).`);
            }
            record.coins -= product.price;
        }
        else if (product.currency === 'gems') {
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
            if (!record.inventory)
                record.inventory = [];
            for (const item of product.grantItems) {
                const existing = record.inventory.find((i) => i.id === item.id);
                if (existing) {
                    existing.qty += item.qty;
                }
                else {
                    record.inventory.push({
                        id: item.id,
                        name: item.name,
                        desc: item.desc,
                        qty: item.qty,
                        category: item.category,
                        rarity: item.rarity,
                    });
                }
            }
        }
        this.users.set(userId, record);
        this.users.set(record.id, record);
        if (record.username)
            this.users.set(record.username, record);
        if (!record.isGuest) {
            this.savePersistedUsers();
            try {
                await this.rawClient.user.update({
                    where: { id: record.id },
                    data: {
                        coins: record.coins,
                        gems: record.gems,
                        updatedAt: new Date(),
                    },
                });
            }
            catch (err) {
                console.error('[purchaseShopProduct] DB update error:', err);
            }
        }
        return {
            user: this.toProfile(record),
            message: `${product.name} başarıyla satın alındı ve hesabınıza tanımlandı!`,
        };
    }
    async openChest(userId, chestId, keyId) {
        const record = this.users.get(userId);
        if (!record)
            throw new Error('Kullanıcı bulunamadı.');
        if (!record.inventory)
            record.inventory = [];
        const chestItem = record.inventory.find((i) => i.id === chestId);
        if (!chestItem || chestItem.qty <= 0) {
            throw new Error('Açılacak sandık envanterinizde bulunamadı.');
        }
        let requiredKeyId = 'key_silver';
        let chestRarity = 'common';
        if (chestId.includes('silver')) {
            requiredKeyId = 'key_silver';
            chestRarity = 'rare';
        }
        else if (chestId.includes('gold')) {
            requiredKeyId = 'key_gold';
            chestRarity = 'epic';
        }
        else if (chestId.includes('legendary') || chestId.includes('diamond')) {
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
        let bonusItem;
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
        }
        else if (chestId.includes('gold')) {
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
        }
        else if (chestId.includes('silver')) {
            coins = Math.floor(600 + Math.random() * 900);
            gems = Math.floor(15 + Math.random() * 25);
            xp = Math.floor(150 + Math.random() * 200);
        }
        else {
            coins = Math.floor(250 + Math.random() * 350);
            gems = Math.floor(5 + Math.random() * 10);
            xp = Math.floor(80 + Math.random() * 100);
        }
        record.coins += coins;
        record.gems = (record.gems || 0) + gems;
        record.xp += xp;
        if (bonusItem) {
            const existing = record.inventory.find((i) => i.id === bonusItem.id);
            if (existing) {
                existing.qty += bonusItem.qty;
            }
            else {
                record.inventory.push(bonusItem);
            }
        }
        const prog = (0, shared_1.calculateLevelFromXp)(record.xp);
        record.level = prog.level;
        record.rankTitle = prog.rankTitle;
        this.users.set(userId, record);
        this.users.set(record.id, record);
        if (record.username)
            this.users.set(record.username, record);
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
            }
            catch (err) {
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
    getUserEvents(userId) {
        const record = this.users.get(userId);
        const progressMap = record?.eventProgress || {};
        const events = shared_1.EVENT_DEFINITIONS.map((ev) => {
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
    startEvent(userId, eventId) {
        const record = this.users.get(userId);
        if (!record)
            throw new Error('Kullanıcı bulunamadı.');
        const event = shared_1.EVENT_DEFINITIONS.find((e) => e.id === eventId);
        if (!event)
            throw new Error('Etkinlik bulunamadı.');
        if (!record.eventProgress)
            record.eventProgress = {};
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
        }
        else {
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
    async claimEventReward(userId, eventId) {
        const record = this.users.get(userId);
        if (!record)
            throw new Error('Kullanıcı bulunamadı.');
        const event = shared_1.EVENT_DEFINITIONS.find((e) => e.id === eventId);
        if (!event)
            throw new Error('Etkinlik bulunamadı.');
        if (!record.eventProgress)
            record.eventProgress = {};
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
            if (!record.inventory)
                record.inventory = [];
            const existing = record.inventory.find((i) => i.id === event.rewardItem.id);
            if (existing) {
                existing.qty += event.rewardItem.qty;
            }
            else {
                record.inventory.push({ ...event.rewardItem });
            }
        }
        const prog = (0, shared_1.calculateLevelFromXp)(record.xp);
        record.level = prog.level;
        record.rankTitle = prog.rankTitle;
        this.users.set(userId, record);
        this.users.set(record.id, record);
        if (record.username)
            this.users.set(record.username, record);
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
            }
            catch (err) {
                console.error('[openChest] DB update error:', err);
            }
        }
        return {
            user: this.toProfile(record),
            message: `Tebrikler! ${event.title} tamamlandı: +${event.rewardCoins} Altın, +${event.rewardGems} Elmas, +${event.rewardSeasonXp} Sezon XP kazandınız!`,
        };
    }
    toProfile(record) {
        let filledCount = 2;
        if (record.fullName)
            filledCount++;
        if (record.countryCode)
            filledCount++;
        if (record.phone)
            filledCount++;
        if (record.birthDate)
            filledCount++;
        if (record.avatarUrl)
            filledCount++;
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
        const progress = (0, shared_1.calculateLevelFromXp)(record.xp || 0);
        record.level = progress.level;
        record.rankTitle = progress.rankTitle;
        const todayStr = new Date().toISOString().slice(0, 10);
        const dcState = record.categoryMastery?.dailyChallenge;
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
        };
    }
    // ==========================================================================
    // SUPABASE CLOUD PUSH & HEALTH CHECK
    // ==========================================================================
    async pushAllTablesToSupabase() {
        this.saveTableToDisk('categories.json', this.store.categories, false);
        this.saveTableToDisk('questions.json', this.store.questions, false);
        this.saveTableToDisk('users.json', this.store.users, false);
        this.saveTableToDisk('user_inventory_items.json', this.store.userInventoryItems, false);
        this.saveTableToDisk('user_notifications.json', this.store.userNotifications, false);
        this.saveTableToDisk('match_history.json', this.store.matchHistory, false);
        const filesToSync = [
            ['prisma_categories.json', Array.from(this.store.categories.values())],
            ['prisma_questions.json', Array.from(this.store.questions.values())],
            ['prisma_users.json', Array.from(this.store.users.values())],
            ['prisma_user_inventory_items.json', Array.from(this.store.userInventoryItems.values())],
            ['prisma_user_notifications.json', Array.from(this.store.userNotifications.values())],
            ['prisma_match_history.json', Array.from(this.store.matchHistory.values())],
        ];
        const results = [];
        for (const [filename, rows] of filesToSync) {
            const ok = await supabaseClient_1.supabaseService.syncCloudStore(filename, rows);
            results.push(ok);
        }
        // Direct PostgreSQL Table Synchronization via Supabase Client
        const supa = supabaseClient_1.supabaseService.getClient();
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
            }
            catch (err) {
                console.warn('[Supabase Sync Warning]:', err.message);
            }
        }
        try {
            const schemaPath = path.join(__dirname, '..', '..', 'prisma', 'schema.prisma');
            const migrationPath = path.join(__dirname, '..', '..', 'prisma', 'migrations', '20261030000000_init_tavriko_supabase', 'migration.sql');
            if (fs.existsSync(schemaPath)) {
                await supabaseClient_1.supabaseService.syncCloudStore('prisma_schema.json', {
                    schema: fs.readFileSync(schemaPath, 'utf-8'),
                    updatedAt: new Date().toISOString(),
                });
            }
            if (fs.existsSync(migrationPath)) {
                await supabaseClient_1.supabaseService.syncCloudStore('prisma_migration_sql.json', {
                    sql: fs.readFileSync(migrationPath, 'utf-8'),
                    updatedAt: new Date().toISOString(),
                });
            }
        }
        catch {
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
    async checkHealth() {
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
exports.PrismaService = PrismaService;
exports.DatabaseAdapter = PrismaService;
exports.prisma = new PrismaService();
exports.db = exports.prisma;
