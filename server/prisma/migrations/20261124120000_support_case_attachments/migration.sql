BEGIN;
CREATE TABLE "support_case_attachments" (
  "id" UUID PRIMARY KEY,
  "caseId" UUID NOT NULL REFERENCES "support_cases"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL CHECK (char_length("name") BETWEEN 1 AND 120),
  "mime" TEXT NOT NULL,
  "size" INTEGER NOT NULL CHECK ("size" > 0 AND "size" <= 3145728),
  "data" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "support_case_attachments_caseId_createdAt_idx" ON "support_case_attachments" ("caseId", "createdAt");
ALTER TABLE "support_case_attachments" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "support_case_attachments" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "support_case_attachments" TO service_role;
COMMIT;
