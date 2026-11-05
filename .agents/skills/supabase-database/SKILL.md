---
name: supabase-database
description: Works on Tavriko Supabase schema, queries, Auth, RLS, migrations, Edge Functions, and database security. Use whenever a task touches Supabase or persisted data.
---
# Supabase and Database

1. Inspect existing migrations, generated types, schema files, query helpers, and RLS policies first.
2. Treat migrations and database types as evidence; do not invent columns or relationships.
3. Check RLS for every user-accessible table and verify ownership/role constraints.
4. Never put service-role keys or private credentials in frontend code, logs, examples, or docs.
5. Prefer additive, reversible migrations. Explain data impact before destructive changes.
6. Keep database changes, generated types, and application queries consistent.
7. Use Context7 for current Supabase APIs when required; match the installed SDK version.
8. Test unauthorized access, cross-user access, null/empty data, and expected authenticated flows.
9. Do not execute production mutations or migrations without explicit authorization.
