CREATE TABLE "rewarded_ad_attempts" (
  "id" UUID PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rewardedAt" TIMESTAMP(3),
  "transactionId" TEXT UNIQUE
);

CREATE INDEX "rewarded_ad_attempts_userId_rewardedAt_idx" ON "rewarded_ad_attempts"("userId", "rewardedAt");
CREATE INDEX "rewarded_ad_attempts_userId_createdAt_idx" ON "rewarded_ad_attempts"("userId", "createdAt");
ALTER TABLE "rewarded_ad_attempts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "rewarded_ad_attempts" FROM anon, authenticated;
