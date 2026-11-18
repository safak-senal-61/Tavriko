-- Older installations may have these fields from Prisma db push. Add only
-- missing fields so the checked-in migration chain also works on a fresh DB.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "blockedUserIds" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "claimedSeasonFreeTiers" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "claimedSeasonPremiumTiers" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "equippedBackground" TEXT,
  ADD COLUMN IF NOT EXISTS "equippedBackgroundExpiresAt" BIGINT,
  ADD COLUMN IF NOT EXISTS "equippedBadge" TEXT,
  ADD COLUMN IF NOT EXISTS "equippedBadgeExpiresAt" BIGINT,
  ADD COLUMN IF NOT EXISTS "equippedFrame" TEXT,
  ADD COLUMN IF NOT EXISTS "equippedFrameExpiresAt" BIGINT,
  ADD COLUMN IF NOT EXISTS "equippedNameEffect" TEXT,
  ADD COLUMN IF NOT EXISTS "equippedNameEffectExpiresAt" BIGINT,
  ADD COLUMN IF NOT EXISTS "eventProgress" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "hasPremiumPass" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "seasonXp" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "settings" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "user_notifications"
  ADD COLUMN IF NOT EXISTS "roomCode" TEXT,
  ADD COLUMN IF NOT EXISTS "senderAvatar" TEXT,
  ADD COLUMN IF NOT EXISTS "senderId" TEXT,
  ADD COLUMN IF NOT EXISTS "senderName" TEXT;

CREATE TABLE IF NOT EXISTS "push_tokens" (
  "id" TEXT PRIMARY KEY,
  "token" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "platform" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "push_tokens_token_key" ON "push_tokens" ("token");
CREATE INDEX IF NOT EXISTS "push_tokens_userId_idx" ON "push_tokens" ("userId");
ALTER TABLE "push_tokens" ENABLE ROW LEVEL SECURITY;
