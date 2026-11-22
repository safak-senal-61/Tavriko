CREATE TABLE "gameplay_reward_claims" (
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "rewardId" TEXT NOT NULL,
  "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("userId", "rewardId")
);

ALTER TABLE "gameplay_reward_claims" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "gameplay_reward_claims" FROM anon, authenticated;
