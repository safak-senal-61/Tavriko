ALTER TABLE "admin_account_events"
  DROP CONSTRAINT "admin_account_events_role_check",
  ADD CONSTRAINT "admin_account_events_role_check"
    CHECK ("role" IN ('owner','support','moderator','approver') OR ("role" = 'player' AND "action" = 'case_opened'));

CREATE TABLE "support_cases" (
  "id" UUID PRIMARY KEY, "accountId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('support','appeal')), "subject" TEXT NOT NULL, "message" TEXT NOT NULL,
  "moderationId" TEXT UNIQUE, "assignee" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open' CHECK ("status" IN ('open','in_progress','resolved')),
  "resolution" TEXT, "revision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "support_cases_accountId_createdAt_idx" ON "support_cases" ("accountId","createdAt");
CREATE INDEX "support_cases_kind_status_createdAt_id_idx" ON "support_cases" ("kind","status","createdAt","id");

CREATE INDEX "admin_compensations_requester_createdAt_idx" ON "admin_compensations" ("requester","createdAt");
CREATE TABLE "admin_risk_alerts" (
  "id" UUID PRIMARY KEY, "actor" TEXT NOT NULL, "count" INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3), "reviewer" TEXT, "reason" TEXT
);
CREATE INDEX "admin_risk_alerts_actor_createdAt_idx" ON "admin_risk_alerts" ("actor","createdAt");
CREATE INDEX "admin_risk_alerts_reviewedAt_createdAt_id_idx" ON "admin_risk_alerts" ("reviewedAt","createdAt","id");

CREATE TABLE "portal_otp_states" (
  "email" TEXT PRIMARY KEY, "factor" TEXT NOT NULL, "lastStep" INTEGER NOT NULL DEFAULT -1, "window" INTEGER NOT NULL, "attempts" INTEGER NOT NULL
);
ALTER TABLE "support_cases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "admin_risk_alerts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "portal_otp_states" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "support_cases", "admin_risk_alerts", "portal_otp_states" FROM anon, authenticated;
