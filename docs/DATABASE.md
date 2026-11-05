# Tavriko — Verified Database, Schema & RLS Overview

## 1. Active Database Architecture
Tavriko uses **Supabase PostgreSQL** accessed primarily through **Prisma ORM** ([`server/prisma/schema.prisma`](file:///c:/Users/%C3%96mer%20faruk%20%C5%9Fener/.gemini/antigravity/scratch/gmae/server/prisma/schema.prisma) and [`server/src/db/prismaClient.ts`](file:///c:/Users/%C3%96mer%20faruk%20%C5%9Fener/.gemini/antigravity/scratch/gmae/server/src/db/prismaClient.ts)), alongside secondary **Supabase JS client** calls ([`server/src/db/supabaseClient.ts`](file:///c:/Users/%C3%96mer%20faruk%20%C5%9Fener/.gemini/antigravity/scratch/gmae/server/src/db/supabaseClient.ts)) for Google OAuth token verification (`auth.getUser`) and optional cloud bucket backups (`tavriko-db`).

## 2. Verified Prisma Schema (`server/prisma/schema.prisma`)
Applied via [`server/prisma/migrations/20261030000000_init_tavriko_supabase/migration.sql`](file:///c:/Users/%C3%96mer%20faruk%20%C5%9Fener/.gemini/antigravity/scratch/gmae/server/prisma/migrations/20261030000000_init_tavriko_supabase/migration.sql):

1. **`categories`** (`Category`):
   - `id` (PK), `name`, `description`, `icon`, `color`, `totalQuestions`, `createdAt`, `updatedAt`.
2. **`questions`** (`Question`):
   - `id` (PK), `categoryId` (FK -> `categories.id` ON DELETE CASCADE), `subCategory`, `difficulty`, `text`, `options` (JSONB), `correctOptionId`, `explanation`, `sourceOrVerification`, `language` (`'tr'`), `contentHash` (UNIQUE), `reviewStatus` (`'published'` | `'pending_review'` | `'approved'` | `'rejected'`), `reviewedBy`, `reviewedAt`, `rejectionReason`, `timeLimitSec` (15).
   - Index: `(categoryId, difficulty, reviewStatus)`.
3. **`users`** (`User`):
   - Identity & Auth: `id` (PK), `username` (UNIQUE), `email` (UNIQUE), `displayName`, `fullName`, `passwordHash`, `googleId` (UNIQUE), `friendCode` (UNIQUE).
   - Progression & Economy: `level`, `xp`, `coins`, `gems`, `dailyStreak`, `rankTitle`, `rankPoints`, `seasonXp`, `hasPremiumPass`.
   - Aggregated Stats: `totalMatches`, `wins`, `correctAnswers`, `totalAnswers`, `bestStreak`, `avgResponseTimeMs`.
   - JSON Columns: `categoryMastery`, `claimedSeasonTiers`, `claimedSeasonFreeTiers`, `claimedSeasonPremiumTiers`, `friendIds` (array of accepted friend user IDs), `eventProgress`, `settings`.
   - Cosmetics: `avatarUrl`, `equippedFrame`, `equippedBadge`, `equippedNameEffect`, `equippedBackground`.
   - Indexes: `rankPoints DESC`, `xp DESC`.
4. **`user_inventory_items`** (`UserInventoryItem`):
   - `id` (PK), `userId` (FK -> `users.id` ON DELETE CASCADE), `itemId`, `name`, `desc`, `qty`.
   - Unique constraint: `(userId, itemId)`.
5. **`user_notifications`** (`UserNotification`):
   - `id` (PK), `userId` (FK -> `users.id` ON DELETE CASCADE), `type` (`'friend_request'` | `'match_invite'` | `'reward'` | `'system'`), `title`, `sub`, `timeText`, `handled` (`null` while pending, `'accepted'` or `'declined'` once resolved), `senderId`, `senderName`, `senderAvatar`, `roomCode`, `createdAt`.
   - Index: `(userId)`.
6. **`match_history`** (`MatchHistory`):
   - `id` (PK), `roomCode`, `mode`, `categoryId`, `winnerId`, `userId` (FK -> `users.id` ON DELETE SET NULL), `score`, `correctAnswers`, `totalQuestions`, `rankingsJson` (JSONB), `playedAt`.
7. **`password_reset_tokens`** (`PasswordResetToken`):
   - `id` (PK), `email`, `code`, `expiresAt`, `used`, `createdAt`.

## 3. Legacy SQL Migration & Row Level Security (`server/migrations/001_initial_schema.sql`)
- [`server/migrations/001_initial_schema.sql`](file:///c:/Users/%C3%96mer%20faruk%20%C5%9Fener/.gemini/antigravity/scratch/gmae/server/migrations/001_initial_schema.sql) defines snake_case tables (`categories`, `questions`, `matches`, `match_players`, `match_answers`, `review_history`) and enables **Row Level Security (RLS)** on those 6 tables:
  - `categories_public_read`: `SELECT USING (true)`
  - `questions_published_public_read`: `SELECT USING (review_status = 'published')`
  - `matches_public_insert` / `matches_public_read`: `WITH CHECK (true)` / `USING (true)`
  - `match_players_public_all` & `match_answers_public_all`: `FOR ALL USING (true)` (overly permissive if anon key is used directly)
  - `review_history_service_role`: `FOR ALL USING (auth.role() = 'service_role')`

## 4. Schema Consolidation & Row Level Security (Verified)
- **Single Prisma Schema**: [`server/prisma/schema.prisma`](file:///c:/Users/%C3%96mer%20faruk%20%C5%9Fener/.gemini/antigravity/scratch/gmae/server/prisma/schema.prisma) is the single source of truth across the monorepo (the duplicate root `prisma/schema.prisma` was removed).
- **RLS Enabled on All Prisma Tables**: [`server/prisma/migrations/20261106000000_enable_rls_prisma_tables/migration.sql`](file:///c:/Users/%C3%96mer%20faruk%20%C5%9Fener/.gemini/antigravity/scratch/gmae/server/prisma/migrations/20261106000000_enable_rls_prisma_tables/migration.sql) enables Row Level Security (`ENABLE ROW LEVEL SECURITY`) on `"categories"`, `"questions"`, `"users"`, `"user_inventory_items"`, `"user_notifications"`, `"match_history"`, and `"password_reset_tokens"`, restricting direct PostgREST access to `service_role` (with public `SELECT` allowed only on `"categories"`).
- **Environment-Only Credentials**: [`api/index.js`](file:///c:/Users/%C3%96mer%20faruk%20%C5%9Fener/.gemini/antigravity/scratch/gmae/api/index.js), [`server/src/db/prismaClient.ts`](file:///c:/Users/%C3%96mer%20faruk%20%C5%9Fener/.gemini/antigravity/scratch/gmae/server/src/db/prismaClient.ts), and [`cloudflare/wrangler.jsonc`](file:///c:/Users/%C3%96mer%20faruk%20%C5%9Fener/.gemini/antigravity/scratch/gmae/cloudflare/wrangler.jsonc) read connection strings and JWT secrets exclusively from environment variables / Cloudflare Secrets without hardcoded fallback credentials.
