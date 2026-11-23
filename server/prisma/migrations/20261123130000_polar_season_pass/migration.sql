BEGIN;
CREATE TABLE "polar_season_orders" (
  "checkoutId" TEXT PRIMARY KEY,
  "orderId" TEXT UNIQUE,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "productId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL CHECK ("amount" > 0),
  "sandbox" BOOLEAN NOT NULL,
  "granted" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'open' CHECK ("status" IN ('open', 'closed', 'paid', 'refunded')),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "polar_season_orders_userId_status_idx" ON "polar_season_orders"("userId", "status");
ALTER TABLE "polar_season_orders" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "polar_season_orders" FROM PUBLIC, anon, authenticated;
COMMIT;
