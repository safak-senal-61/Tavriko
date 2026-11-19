ALTER TABLE "support_cases"
  ADD COLUMN "waitingForPlayer" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "firstReplyAt" TIMESTAMP(3);
UPDATE "support_cases" SET "firstReplyAt" = "updatedAt" WHERE "resolution" IS NOT NULL;
CREATE INDEX "support_cases_firstReplyAt_status_createdAt_idx" ON "support_cases"("firstReplyAt","status","createdAt");

CREATE TABLE "support_case_replies" (
  "id" UUID PRIMARY KEY, "caseId" UUID NOT NULL REFERENCES "support_cases"("id") ON DELETE CASCADE,
  "sender" TEXT NOT NULL CHECK ("sender" IN ('player','staff')), "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "support_case_replies_caseId_createdAt_id_idx" ON "support_case_replies"("caseId","createdAt","id");

CREATE TABLE "portal_sessions" (
  "id" UUID PRIMARY KEY, "email" TEXT NOT NULL, "method" TEXT NOT NULL CHECK ("method" IN ('password','totp','passkey')),
  "device" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3), "revokedBy" TEXT, "passkeyId" TEXT
);
CREATE INDEX "portal_sessions_email_revokedAt_expiresAt_idx" ON "portal_sessions"("email","revokedAt","expiresAt");
CREATE INDEX "portal_sessions_expiresAt_idx" ON "portal_sessions"("expiresAt");
CREATE TABLE "portal_passkeys" (
  "id" TEXT PRIMARY KEY, "email" TEXT NOT NULL, "publicKey" BYTEA NOT NULL, "counter" BIGINT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "portal_passkeys_email_idx" ON "portal_passkeys"("email");
CREATE TABLE "portal_webauthn_challenges" (
  "id" UUID PRIMARY KEY, "challenge" TEXT NOT NULL, "purpose" TEXT NOT NULL CHECK ("purpose" IN ('register','login')),
  "binding" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "portal_webauthn_challenges_expiresAt_idx" ON "portal_webauthn_challenges"("expiresAt");

CREATE TABLE "duel_funnel_events" (
  "accountId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "stage" TEXT NOT NULL CHECK ("stage" IN ('eligible','selected','matched','completed')), "room" TEXT NOT NULL, "at" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("accountId","stage","room")
);
CREATE INDEX "duel_funnel_events_at_idx" ON "duel_funnel_events"("at");

ALTER TABLE "support_case_replies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "portal_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "portal_passkeys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "portal_webauthn_challenges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "duel_funnel_events" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "support_case_replies", "portal_sessions", "portal_passkeys", "portal_webauthn_challenges", "duel_funnel_events" FROM anon, authenticated;
