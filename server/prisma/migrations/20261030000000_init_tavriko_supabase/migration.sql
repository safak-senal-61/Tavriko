-- ============================================================================
-- Tavriko (TriviaVerse) - Prisma ORM PostgreSQL Migration for Supabase
-- Project: rjvbgofzsfescnfohzgu (https://rjvbgofzsfescnfohzgu.supabase.co)
-- ============================================================================

-- CreateTable: categories
CREATE TABLE IF NOT EXISTS "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "totalQuestions" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable: questions
CREATE TABLE IF NOT EXISTS "questions" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "subCategory" TEXT,
    "difficulty" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctOptionId" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "sourceOrVerification" TEXT,
    "language" TEXT NOT NULL DEFAULT 'tr',
    "contentHash" TEXT NOT NULL,
    "reviewStatus" TEXT NOT NULL DEFAULT 'published',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "timeLimitSec" INTEGER NOT NULL DEFAULT 15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: users
CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "fullName" TEXT,
    "passwordHash" TEXT,
    "googleId" TEXT,
    "countryCode" TEXT DEFAULT 'TR',
    "countryName" TEXT DEFAULT 'Türkiye',
    "phone" TEXT,
    "birthDate" TEXT,
    "gender" TEXT,
    "bio" TEXT,
    "avatarUrl" TEXT DEFAULT 'av1',
    "friendCode" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "coins" INTEGER NOT NULL DEFAULT 500,
    "gems" INTEGER NOT NULL DEFAULT 15,
    "dailyStreak" INTEGER NOT NULL DEFAULT 1,
    "rankTitle" TEXT NOT NULL DEFAULT 'Acemi Kaşif',
    "rankPoints" INTEGER NOT NULL DEFAULT 1000,
    "profileCompletionPct" INTEGER NOT NULL DEFAULT 50,
    "totalMatches" INTEGER NOT NULL DEFAULT 0,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "correctAnswers" INTEGER NOT NULL DEFAULT 0,
    "totalAnswers" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "avgResponseTimeMs" INTEGER NOT NULL DEFAULT 0,
    "categoryMastery" JSONB NOT NULL DEFAULT '{}',
    "claimedSeasonTiers" JSONB NOT NULL DEFAULT '[1]',
    "friendIds" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable: user_inventory_items
CREATE TABLE IF NOT EXISTS "user_inventory_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "desc" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable: user_notifications
CREATE TABLE IF NOT EXISTS "user_notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sub" TEXT NOT NULL,
    "timeText" TEXT NOT NULL,
    "handled" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable: match_history
CREATE TABLE IF NOT EXISTS "match_history" (
    "id" TEXT NOT NULL,
    "roomCode" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "winnerId" TEXT,
    "userId" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "correctAnswers" INTEGER NOT NULL DEFAULT 0,
    "totalQuestions" INTEGER NOT NULL DEFAULT 5,
    "rankingsJson" JSONB NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable: password_reset_tokens
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "questions_contentHash_key" ON "questions"("contentHash");
CREATE INDEX IF NOT EXISTS "questions_categoryId_difficulty_reviewStatus_idx" ON "questions"("categoryId", "difficulty", "reviewStatus");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "users_googleId_key" ON "users"("googleId");
CREATE UNIQUE INDEX IF NOT EXISTS "users_friendCode_key" ON "users"("friendCode");
CREATE INDEX IF NOT EXISTS "users_rankPoints_idx" ON "users"("rankPoints" DESC);
CREATE INDEX IF NOT EXISTS "users_xp_idx" ON "users"("xp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "user_inventory_items_userId_itemId_key" ON "user_inventory_items"("userId", "itemId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "user_notifications_userId_idx" ON "user_notifications"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "match_history_userId_idx" ON "match_history"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "password_reset_tokens_email_code_idx" ON "password_reset_tokens"("email", "code");

-- AddForeignKey
ALTER TABLE "questions" DROP CONSTRAINT IF EXISTS "questions_categoryId_fkey";
ALTER TABLE "questions" ADD CONSTRAINT "questions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_inventory_items" DROP CONSTRAINT IF EXISTS "user_inventory_items_userId_fkey";
ALTER TABLE "user_inventory_items" ADD CONSTRAINT "user_inventory_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_notifications" DROP CONSTRAINT IF EXISTS "user_notifications_userId_fkey";
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "match_history" DROP CONSTRAINT IF EXISTS "match_history_userId_fkey";
ALTER TABLE "match_history" ADD CONSTRAINT "match_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
