-- Tavriko: least-privilege RLS for all Prisma-managed public tables.
-- Server-side access uses the Supabase secret key (service_role) or the
-- trusted Prisma DATABASE_URL. Browser clients must never read private rows.

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Remove the overly broad default grants previously given to browser roles.
REVOKE ALL PRIVILEGES ON TABLE
  public.categories,
  public.questions,
  public.users,
  public.user_inventory_items,
  public.user_notifications,
  public.match_history,
  public.password_reset_tokens
FROM anon, authenticated;

-- The game may display category names/icons publicly. No browser writes.
GRANT SELECT ON TABLE public.categories TO anon, authenticated;

-- The trusted server is the only application actor allowed to access private
-- game/user tables. Keep the explicit grant alongside RLS as defense in depth.
GRANT ALL PRIVILEGES ON TABLE
  public.categories,
  public.questions,
  public.users,
  public.user_inventory_items,
  public.user_notifications,
  public.match_history,
  public.password_reset_tokens
TO service_role;

DROP POLICY IF EXISTS categories_public_read ON public.categories;
CREATE POLICY categories_public_read
  ON public.categories
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS categories_service_role_all ON public.categories;
CREATE POLICY categories_service_role_all
  ON public.categories
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS questions_service_role_all ON public.questions;
CREATE POLICY questions_service_role_all
  ON public.questions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS users_service_role_all ON public.users;
CREATE POLICY users_service_role_all
  ON public.users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS user_inventory_items_service_role_all ON public.user_inventory_items;
CREATE POLICY user_inventory_items_service_role_all
  ON public.user_inventory_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS user_notifications_service_role_all ON public.user_notifications;
CREATE POLICY user_notifications_service_role_all
  ON public.user_notifications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS match_history_service_role_all ON public.match_history;
CREATE POLICY match_history_service_role_all
  ON public.match_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS password_reset_tokens_service_role_all ON public.password_reset_tokens;
CREATE POLICY password_reset_tokens_service_role_all
  ON public.password_reset_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
