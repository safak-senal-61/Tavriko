import type { PrismaClient } from '@prisma/client';

const checks = new WeakMap<PrismaClient, Map<string, { expires: number; result: Promise<boolean> }>>();

// Deploying the API ahead of the database migration must not sell unusable jokers.
export function walletSchemaReady(prisma: PrismaClient, feature: 'jokers' | 'gems' = 'jokers'): Promise<boolean> {
  const now = Date.now();
  const byFeature = checks.get(prisma) ?? new Map();
  const cached = byFeature.get(feature);
  if (cached && cached.expires > now) return cached.result;
  const table = feature === 'jokers' ? 'public.practice_joker_uses' : 'public.polar_gem_orders';
  const result = prisma.$queryRaw<{ ready: boolean }[]>`
    SELECT pg_catalog.to_regclass(${table}) IS NOT NULL AS ready
  `.then(rows => rows[0]?.ready === true, () => false);
  byFeature.set(feature, { expires: now + 30_000, result });
  checks.set(prisma, byFeature);
  return result;
}
