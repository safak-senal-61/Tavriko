"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRawPrisma = getRawPrisma;
const client_1 = require("@prisma/client");
let client;
// The small joker handler and the full API reuse the same lazy connection pool.
function getRawPrisma() {
    return client ??= new client_1.PrismaClient({
        datasources: {
            db: { url: process.env.DATABASE_URL || process.env.DIRECT_URL || 'postgresql://postgres:postgres@localhost:5432/postgres' },
        },
        log: ['error'],
    });
}
