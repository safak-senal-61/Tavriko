import type { PrismaClient } from '@prisma/client';

const checks = new WeakMap<PrismaClient, { expires: number; result: Promise<boolean> }>();

// Deploying the API ahead of the database migration must not sell unusable jokers.
export function walletSchemaReady(prisma: PrismaClient): Promise<boolean> {
  const now = Date.now();
  const cached = checks.get(prisma);
  if (cached && cached.expires > now) return cached.result;
  const result = prisma.$queryRaw<{ ready: boolean }[]>`
    SELECT pg_catalog.to_regclass('public.polar_gem_orders') IS NOT NULL
       AND pg_catalog.to_regclass('public.practice_joker_uses') IS NOT NULL AS ready
  `.then(rows => rows[0]?.ready === true, () => false);
  checks.set(prisma, { expires: now + 30_000, result });
  return result;
}
