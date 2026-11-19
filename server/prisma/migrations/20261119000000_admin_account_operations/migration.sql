ALTER TABLE "users" ADD COLUMN "restrictedUntil" TIMESTAMP(3);

CREATE INDEX "match_history_playedAt_userId_idx" ON "match_history" ("playedAt", "userId");
CREATE INDEX "match_history_userId_playedAt_idx" ON "match_history" ("userId", "playedAt");

CREATE TABLE "admin_account_events" (
  "id" TEXT PRIMARY KEY, "accountId" TEXT NOT NULL, "actor" TEXT NOT NULL,
  "role" TEXT NOT NULL CHECK ("role" IN ('owner','support','moderator','approver')),
  "action" TEXT NOT NULL, "reason" TEXT NOT NULL, "details" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "admin_account_events_accountId_createdAt_id_idx" ON "admin_account_events" ("accountId", "createdAt", "id");

CREATE TABLE "admin_compensations" (
  "id" UUID PRIMARY KEY, "accountId" TEXT NOT NULL, "requester" TEXT NOT NULL,
  "reviewer" TEXT, "kind" TEXT NOT NULL CHECK ("kind" IN ('coins','gems','item')),
  "itemId" TEXT, "amount" INTEGER NOT NULL CHECK ("amount" > 0),
  "status" TEXT NOT NULL CHECK ("status" IN ('pending','applied','rejected')),
  "reason" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL, "decidedAt" TIMESTAMP(3),
  CHECK (("kind" = 'item') = ("itemId" IS NOT NULL)),
  CHECK (("status" = 'pending') = ("decidedAt" IS NULL)),
  CHECK ("reviewer" IS NULL OR "reviewer" <> "requester")
);
CREATE INDEX "admin_compensations_accountId_kind_status_decidedAt_idx" ON "admin_compensations" ("accountId", "kind", "status", "decidedAt");
CREATE INDEX "admin_compensations_status_expiresAt_createdAt_idx" ON "admin_compensations" ("status", "expiresAt", "createdAt");

ALTER TABLE "admin_account_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admin_compensations" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "admin_account_events", "admin_compensations" FROM anon, authenticated;
