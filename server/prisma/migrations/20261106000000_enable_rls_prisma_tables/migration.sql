-- Tavriko: strict server-only access for all seven application tables.
-- All browser data access must go through authenticated server endpoints.
-- The backend connects using the trusted Supabase service_role / Prisma DB URL.

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- No direct PostgREST/table access for browser roles (or PUBLIC).
REVOKE ALL PRIVILEGES ON TABLE
  public.categories,
  public.questions,
  public.users,
  public.user_inventory_items,
  public.user_notifications,
  public.match_history,
  public.password_reset_tokens
FROM PUBLIC, anon, authenticated;

-- Explicitly retain server-side application access.
GRANT ALL PRIVILEGES ON TABLE
  public.categories,
  public.questions,
  public.users,
  public.user_inventory_items,
  public.user_notifications,
  public.match_history,
  public.password_reset_tokens
TO service_role;

-- No policies for anon/authenticated: RLS therefore denies direct access.
-- Service role has BYPASSRLS in Supabase; Prisma's trusted DB connection
-- remains server-only and must never be exposed to the client.
DROP POLICY IF EXISTS categories_public_read ON public.categories;
DROP POLICY IF EXISTS categories_public_select ON public.categories;
DROP POLICY IF EXISTS categories_service_role_all ON public.categories;
CREATE POLICY categories_service_role_all
  ON public.categories FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS questions_service_role_all ON public.questions;
CREATE POLICY questions_service_role_all
  ON public.questions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS users_service_role_all ON public.users;
CREATE POLICY users_service_role_all
  ON public.users FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS user_inventory_items_service_role_all ON public.user_inventory_items;
CREATE POLICY user_inventory_items_service_role_all
  ON public.user_inventory_items FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS user_notifications_service_role_all ON public.user_notifications;
CREATE POLICY user_notifications_service_role_all
  ON public.user_notifications FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS match_history_service_role_all ON public.match_history;
CREATE POLICY match_history_service_role_all
  ON public.match_history FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS password_reset_tokens_service_role_all ON public.password_reset_tokens;
CREATE POLICY password_reset_tokens_service_role_all
  ON public.password_reset_tokens FOR ALL TO service_role
  USING (true) WITH CHECK (true);
