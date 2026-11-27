BEGIN;
ALTER TABLE "play_purchases"
  ADD COLUMN "purchaseIp" TEXT,
  ADD COLUMN "voidReason" TEXT,
  ADD COLUMN "voidSource" TEXT,
  ADD COLUMN "gemsClawedBack" INTEGER NOT NULL DEFAULT 0 CHECK ("gemsClawedBack" >= 0),
  ADD COLUMN "gemsDebt" INTEGER NOT NULL DEFAULT 0 CHECK ("gemsDebt" >= 0),
  ADD COLUMN "balanceAfterVoid" INTEGER,
  ADD COLUMN "disputeToken" TEXT,
  ADD COLUMN "disputeAt" TIMESTAMP(3),
  ADD COLUMN "disputePreference" TEXT,
  ADD COLUMN "disputeReviewedAt" TIMESTAMP(3);
CREATE INDEX "play_purchases_userId_status_voidReason_idx" ON "play_purchases"("userId", "status", "voidReason");
COMMIT;
