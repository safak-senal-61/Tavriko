BEGIN;
CREATE TABLE "play_purchases" (
  "purchaseToken" TEXT PRIMARY KEY,
  "orderId" TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "productId" TEXT NOT NULL,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('gems', 'pass')),
  "gems" INTEGER NOT NULL DEFAULT 0 CHECK ("gems" >= 0),
  "test" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'granted' CHECK ("status" IN ('granted', 'voided')),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consumedAt" TIMESTAMP(3),
  "voidedAt" TIMESTAMP(3)
);
CREATE INDEX "play_purchases_userId_kind_status_idx" ON "play_purchases"("userId", "kind", "status");
ALTER TABLE "play_purchases" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "play_purchases" FROM PUBLIC, anon, authenticated;
COMMIT;
