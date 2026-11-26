"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.walletSchemaReady = walletSchemaReady;
const checks = new WeakMap();
// Deploying the API ahead of the database migration must not sell unusable jokers.
function walletSchemaReady(prisma, feature = 'jokers') {
    const now = Date.now();
    const byFeature = checks.get(prisma) ?? new Map();
    const cached = byFeature.get(feature);
    if (cached && cached.expires > now)
        return cached.result;
    const table = feature === 'jokers' ? 'public.practice_joker_uses' : 'public.polar_gem_orders';
    const result = prisma.$queryRaw `
    SELECT pg_catalog.to_regclass(${table}) IS NOT NULL AS ready
  `.then(rows => rows[0]?.ready === true, () => false);
    byFeature.set(feature, { expires: now + 30_000, result });
    checks.set(prisma, byFeature);
    return result;
}
