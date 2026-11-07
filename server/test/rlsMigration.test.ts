import { readFileSync } from 'fs';
import { join } from 'path';

describe('Supabase least-privilege RLS migration', () => {
  const migration = readFileSync(
    join(__dirname, '../prisma/migrations/20261106000000_enable_rls_prisma_tables/migration.sql'),
    'utf8'
  );

  const privateTables = [
    'questions',
    'users',
    'user_inventory_items',
    'user_notifications',
    'match_history',
    'password_reset_tokens',
  ];

  it('enables RLS on every exposed application table', () => {
    for (const table of ['categories', ...privateTables]) {
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
    }
  });

  it('revokes broad browser-role grants and grants public read access only to categories', () => {
    expect(migration).toContain('REVOKE ALL PRIVILEGES ON TABLE');
    expect(migration).toContain('FROM anon, authenticated;');
    expect(migration).toMatch(/CREATE POLICY categories_public_read[\\s\\S]*?FOR SELECT[\\s\\S]*?TO anon, authenticated[\\s\\S]*?USING \\(true\\)/);
    for (const table of privateTables) {
      expect(migration).toContain(`CREATE POLICY ${table}_service_role_all`);
      expect(migration).not.toMatch(new RegExp(`CREATE POLICY ${table}_[^\\n]*TO anon, authenticated`));
    }
  });

  it('does not use the deprecated auth.role() policy expression', () => {
    expect(migration).not.toContain('auth.role()');
  });
});
