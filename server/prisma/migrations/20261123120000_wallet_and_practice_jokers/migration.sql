BEGIN;

ALTER TABLE "users" ALTER COLUMN "gems" SET DEFAULT 0;

CREATE TABLE "polar_gem_orders" (
  "checkoutId" TEXT PRIMARY KEY,
  "orderId" TEXT UNIQUE,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "productId" TEXT NOT NULL,
  "gems" INTEGER NOT NULL CHECK ("gems" > 0),
  "amount" INTEGER NOT NULL CHECK ("amount" > 0),
  "refundedGems" INTEGER NOT NULL DEFAULT 0 CHECK ("refundedGems" BETWEEN 0 AND "gems"),
  "status" TEXT NOT NULL DEFAULT 'open' CHECK ("status" IN ('open', 'paid', 'refunded')),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "polar_gem_orders_userId_createdAt_idx" ON "polar_gem_orders"("userId", "createdAt");
ALTER TABLE "polar_gem_orders" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "practice_joker_uses" (
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "sessionId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "jokerId" TEXT NOT NULL,
  "eliminated" TEXT[] NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("userId", "sessionId", "questionId")
);
ALTER TABLE "practice_joker_uses" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "polar_gem_orders", "practice_joker_uses" FROM PUBLIC, anon, authenticated;

COMMIT;
