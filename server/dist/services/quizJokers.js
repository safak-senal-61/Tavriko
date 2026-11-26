"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.consumeQuizJoker = consumeQuizJoker;
const node_crypto_1 = require("node:crypto");
const shared_1 = require("@trivia/shared");
const practiceJokerProof_1 = require("./practiceJokerProof");
const rawPrisma_1 = require("../db/rawPrisma");
async function consumeQuizJoker(key, jokerId, question, deadline, live) {
    // Stable on retry without adding a column or taking randomness from the client.
    const randomIndex = (0, node_crypto_1.createHmac)('sha256', (0, practiceJokerProof_1.getJokerSigningSecret)() || process.env.INTERNAL_API_SECRET || '')
        .update(JSON.stringify([key.userId, key.sessionId, key.questionId])).digest().readUInt32BE();
    const options = { live: !!live, tactics: live?.tactics, capabilities: live?.capabilities, votes: live?.votes, randomIndex };
    if (Date.now() >= deadline)
        return { status: 'expired' };
    const db = (0, rawPrisma_1.getRawPrisma)();
    const effect = (0, shared_1.resolveJokerEffect)(jokerId, question, undefined, {
        ...options, lightningAvailable: !!live && live.requestedAt - live.startedAt < shared_1.LIGHTNING_WINDOW_MS,
    });
    if (effect) {
        // Lock in the wallet's usual account → stock order. Debit only if the unique
        // use record is inserted, so a concurrent retry never consumes a second copy.
        const [applied] = await db.$queryRaw `
      WITH account AS MATERIALIZED (
        SELECT "id" FROM "users" WHERE "id" = ${key.userId} FOR UPDATE
      ), stock AS MATERIALIZED (
        SELECT i."id" FROM account a JOIN "user_inventory_items" i ON i."userId" = a."id"
        WHERE i."itemId" = ${jokerId} AND i."qty" > 0 FOR UPDATE OF i
      ), claimed AS (
        INSERT INTO "practice_joker_uses" ("userId", "sessionId", "questionId", "jokerId", "eliminated")
        SELECT ${key.userId}, ${key.sessionId}, ${key.questionId}, ${jokerId}, ${effect.eliminated}::text[]
        FROM stock WHERE clock_timestamp() < to_timestamp(${deadline}::double precision / 1000)
        ON CONFLICT ("userId", "sessionId", "questionId") DO NOTHING
        RETURNING "userId"
      )
      UPDATE "user_inventory_items" i SET "qty" = i."qty" - 1, "updatedAt" = CURRENT_TIMESTAMP
      FROM stock, claimed WHERE i."id" = stock."id" AND i."userId" = claimed."userId"
      RETURNING i."qty"
    `;
        if (applied)
            return { status: 'applied', effect };
    }
    // A fresh statement can see a winning concurrent request, including when it
    // consumed the last copy. Never replay a committed effect under another ID.
    const used = await db.practiceJokerUse.findUnique({ where: { userId_sessionId_questionId: key } });
    if (used) {
        if (used.jokerId !== jokerId || !(0, shared_1.isJokerId)(used.jokerId))
            return { status: 'already_used' };
        const replay = (0, shared_1.resolveJokerEffect)(used.jokerId, question, used.eliminated, options);
        if (replay)
            return { status: 'applied', effect: replay };
    }
    if (Date.now() >= deadline)
        return { status: 'expired' };
    return { status: effect ? 'empty' : 'unavailable' };
}
