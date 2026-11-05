-- ============================================================================
-- Tavriko - Supabase Row Level Security (RLS) Hardening for Prisma Tables
-- Locks down PostgREST (anon / authenticated) direct access while preserving
-- Prisma backend & service_role operations.
-- ============================================================================

-- 1. Enable RLS on all Prisma-managed public tables
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_inventory_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "match_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "password_reset_tokens" ENABLE ROW LEVEL SECURITY;

-- 2. Categories: Public read-only, service_role full access
DROP POLICY IF EXISTS "categories_public_select" ON "categories";
CREATE POLICY "categories_public_select" ON "categories"
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "categories_service_role_all" ON "categories";
CREATE POLICY "categories_service_role_all" ON "categories"
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 3. Questions: Service role full access (prevents anon scraping of correctOptionId via PostgREST)
DROP POLICY IF EXISTS "questions_service_role_all" ON "questions";
CREATE POLICY "questions_service_role_all" ON "questions"
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 4. Users: Service role only (protects passwordHash, email, phone, friendIds from anon PostgREST)
DROP POLICY IF EXISTS "users_service_role_all" ON "users";
CREATE POLICY "users_service_role_all" ON "users"
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 5. User Inventory Items: Service role only
DROP POLICY IF EXISTS "user_inventory_items_service_role_all" ON "user_inventory_items";
CREATE POLICY "user_inventory_items_service_role_all" ON "user_inventory_items"
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 6. User Notifications: Service role only
DROP POLICY IF EXISTS "user_notifications_service_role_all" ON "user_notifications";
CREATE POLICY "user_notifications_service_role_all" ON "user_notifications"
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 7. Match History: Service role only
DROP POLICY IF EXISTS "match_history_service_role_all" ON "match_history";
CREATE POLICY "match_history_service_role_all" ON "match_history"
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 8. Password Reset Tokens: Service role only
DROP POLICY IF EXISTS "password_reset_tokens_service_role_all" ON "password_reset_tokens";
CREATE POLICY "password_reset_tokens_service_role_all" ON "password_reset_tokens"
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
