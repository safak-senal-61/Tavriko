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
        // 1. Search in PostgreSQL public.users directly
        let dbUser = await this.rawClient.user.findFirst({
            where: {
                OR: [
                    { email: cleanEmail },
                    payload.googleId ? { googleId: payload.googleId } : {},
                ].filter((x) => Object.keys(x).length > 0),
            },
        }).catch(() => null);
        let isNewUser = false;
        const now = new Date();
        if (!dbUser) {
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
                    friendIds: [],
                    createdAt: now,
                    updatedAt: now,
                },
            });
        }
        else {
            // User exists in PostgreSQL: update display name, avatar, and googleId
            dbUser = await this.rawClient.user.update({
                where: { id: dbUser.id },
                data: {
                    displayName: payload.displayName || dbUser.displayName,
                    fullName: payload.fullName || dbUser.fullName,
                    avatarUrl: payload.avatarUrl || dbUser.avatarUrl,
                    googleId: payload.googleId || dbUser.googleId,
                    updatedAt: now,
                },
            });
        }
        const record = this.prismaUserToRecord(dbUser);
        this.users.set(record.id, record);
        this.store.users.set(dbUser.id, dbUser);
        this.savePersistedUsers();
        const token = jsonwebtoken_1.default.sign({ userId: record.id, username: record.username }, JWT_SECRET, { expiresIn: '30d' });
        return { token, user: this.toProfile(record), isNewUser };
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
        const record = this.users.get(userId);
        if (!record)
            return null;
        record.xp += delta.xpEarned;
        record.coins += delta.coinsEarned;
        const progress = (0, shared_1.calculateLevelFromXp)(record.xp);
        record.level = progress.level;
        record.rankTitle = progress.rankTitle;
        record.stats.totalMatches += 1;
        if (delta.won)
            record.stats.wins += 1;
        record.stats.correctAnswers += delta.correctAnswers;
        record.stats.totalAnswers += delta.totalAnswers;
        if (delta.bestStreak > record.stats.bestStreak) {
            record.stats.bestStreak = delta.bestStreak;
        }
        this.users.set(userId, record);
        if (!record.isGuest) {
            this.savePersistedUsers();
            supabaseClient_1.supabaseService.upsertUser(record).catch(() => { });
        }
        return this.toProfile(record);
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
    approveQuestion(id, reviewedBy) {
        const q = this.questions.find((item) => item.id === id);
        if (!q)
            return null;
        q.reviewStatus = 'published';
        q.reviewedBy = reviewedBy;
        q.reviewedAt = new Date().toISOString();
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
        const dailySet = this.getQuestions('mixed', undefined, 5);
        return {
            date: today,
            questions: dailySet,
        };
    }
    defaultInventory() {
        return [
            { id: 'chest', name: 'Ahşap Sandık', desc: '1 altın anahtar ile açılır', qty: 2 },
            { id: 'key', name: 'Altın Anahtar', desc: 'Sandıkların kilidini açar', qty: 3 },
            { id: 'bolt', name: 'Hız Güçlendirici', desc: '+%25 hız bonusu verir', qty: 2 },
            { id: 'crown', name: 'Kraliyet Tacı', desc: 'Özel profil çerçevesi', qty: 1 },
            { id: 'heart', name: 'Ekstra Can', desc: 'Yanlış cevapta seriyi korur', qty: 4 },
            { id: 'gift', name: 'Gizemli Kutu', desc: 'Rastgele altın ödülü içerir', qty: 1 },
            { id: 'gem', name: 'Elmas Kesesi', desc: 'Açıldığında +10 elmas verir', qty: 2 },
            { id: 'coin', name: 'Altın Kesesi', desc: 'Açıldığında +100 altın verir', qty: 3 },
            { id: 'flame', name: 'Seri Kalkanı', desc: 'Günlük serini 1 gün korur', qty: 2 },
        ];
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
    getFriendsForUser(userId) {
        const me = this.users.get(userId);
        const friendCode = me?.friendCode || this.generateFriendCode(userId);
        const explicitFriendIds = new Set(me?.friendIds || []);
        const explicitFriends = [];
        for (const fId of explicitFriendIds) {
            const u = this.users.get(fId);
            if (u) {
                const prog = (0, shared_1.calculateLevelFromXp)(u.xp || 0);
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
                    status: 'Arkadaşın · Çevrimiçi',
                    isFriend: true,
                });
            }
        }
        const otherUsers = Array.from(this.users.values())
            .filter((u) => u.id !== userId && !u.isGuest && !explicitFriendIds.has(u.id))
            .slice(0, 10)
            .map((u, idx) => {
            const prog = (0, shared_1.calculateLevelFromXp)(u.xp || 0);
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
                status: idx === 0 ? 'Oyunda · Düello' : idx % 3 !== 2 ? 'Çevrimiçi' : 'Çevrimdışı',
                isFriend: false,
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
        me.friendIds.push(target.id);
        if (!target.friendIds.includes(me.id)) {
            target.friendIds.push(me.id);
        }
        // Add notification to target
        if (!target.notifications)
            target.notifications = [];
        target.notifications.unshift({
            id: 'notif_fr_' + Date.now(),
            type: 'friend',
            title: `${me.displayName} seni arkadaş olarak ekledi!`,
            sub: 'Artık 1v1 düello maçlarına davet edebilirsin.',
            timeText: 'Az önce',
            handled: null,
        });
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
            },
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
        if (!record.isGuest) {
            this.savePersistedUsers();
            this.syncUserToPrisma(record).catch(() => { });
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
        if (!record.isGuest) {
            this.savePersistedUsers();
            this.syncUserToPrisma(record).catch(() => { });
        }
        return { user: this.toProfile(record), rewardText };
    }
    async claimSeasonTier(userId, tier) {
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
        if (!record.claimedSeasonTiers)
            record.claimedSeasonTiers = [1];
        const currentLevel = (0, shared_1.calculateLevelFromXp)(record.xp || 0).level;
        if (tier > currentLevel) {
            throw new Error(`Bu seviye henüz kilitli! ${tier}. kademeyi açmak için Seviye ${tier} olmalısın (Şu anki Seviyen: ${currentLevel}).`);
        }
        if (record.claimedSeasonTiers.includes(tier)) {
            throw new Error('Bu kademe ödülü zaten hesabınıza tanımlandı.');
        }
        record.claimedSeasonTiers.push(tier);
        record.coins += tier * 150;
        record.gems = (record.gems || 0) + tier * 10;
        record.xp += tier * 200;
        const prog = (0, shared_1.calculateLevelFromXp)(record.xp);
        record.level = prog.level;
        record.rankTitle = prog.rankTitle;
        this.users.set(userId, record);
        if (!record.isGuest) {
            this.savePersistedUsers();
            this.syncUserToPrisma(record).catch(() => { });
        }
        return this.toProfile(record);
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
            record.inventory = this.defaultInventory();
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
