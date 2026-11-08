import { readFileSync } from 'fs';
import { join } from 'path';

describe('Supabase least-privilege RLS migration', () => {
  const migration = readFileSync(
    join(__dirname, '../prisma/migrations/20261106000000_enable_rls_prisma_tables/migration.sql'),
    'utf8'
  );

  const applicationTables = [
    'categories',
    'questions',
    'users',
    'user_inventory_items',
    'user_notifications',
    'match_history',
    'password_reset_tokens',
  ];

  it('enables RLS on every application table', () => {
    for (const table of applicationTables) {
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
    }
  });

  it('revokes all direct browser-role and PUBLIC privileges', () => {
    expect(migration).toContain('REVOKE ALL PRIVILEGES ON TABLE');
    expect(migration).toContain('FROM PUBLIC, anon, authenticated;');
    expect(migration).not.toContain('TO anon, authenticated');
  });

  it('grants server-side access and creates service-role-only policies for every table', () => {
    expect(migration).toContain('TO service_role;');
    for (const table of applicationTables) {
      expect(migration).toContain(`CREATE POLICY ${table}_service_role_all`);
      expect(migration).toContain(`ON public.${table} FOR ALL TO service_role`);
    }
  });

  it('does not create public read policies or use deprecated auth.role()', () => {
    expect(migration).not.toContain('categories_public_read');
    expect(migration).not.toContain('categories_public_select');
    expect(migration).not.toContain('auth.role()');
  });
});
