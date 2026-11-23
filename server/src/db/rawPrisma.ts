import { PrismaClient } from '@prisma/client';

let client: PrismaClient | undefined;

// The small joker handler and the full API reuse the same lazy connection pool.
export function getRawPrisma(): PrismaClient {
  return client ??= new PrismaClient({
    datasources: {
      db: { url: process.env.DATABASE_URL || process.env.DIRECT_URL || 'postgresql://postgres:postgres@localhost:5432/postgres' },
    },
    log: ['error'],
  });
}
