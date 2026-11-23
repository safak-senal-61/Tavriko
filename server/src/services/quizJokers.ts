import { createHmac } from 'node:crypto';
import { ClientQuestion, JokerId, JokerTactics, LIGHTNING_WINDOW_MS, Question, isJokerId, resolveJokerEffect } from '@trivia/shared';
import { getJwtSecret } from '../middleware/auth';
import { db } from '../db/prismaClient';

export async function consumeQuizJoker(
  key: { userId: string; sessionId: string; questionId: string },
  jokerId: JokerId,
  question: Pick<Question, 'options' | 'correctOptionId'>,
  deadline: number,
  live?: { tactics?: JokerTactics; startedAt: number; requestedAt: number; capabilities?: ClientQuestion['jokerCapabilities']; votes?: Record<string, number> },
) {
  // Stable on retry without adding a column or taking randomness from the client.
  const randomIndex = createHmac('sha256', getJwtSecret() || process.env.INTERNAL_API_SECRET || '')
    .update(JSON.stringify([key.userId, key.sessionId, key.questionId])).digest().readUInt32BE();
  const options = { live: !!live, tactics: live?.tactics, capabilities: live?.capabilities, votes: live?.votes, randomIndex };
  if (Date.now() >= deadline) return { status: 'expired' } as const;
  const effect = resolveJokerEffect(jokerId, question, undefined, {
    ...options, lightningAvailable: !!live && live.requestedAt - live.startedAt < LIGHTNING_WINDOW_MS,
  });
  if (effect) {
    // Lock in the wallet's usual account → stock order. Debit only if the unique
    // use record is inserted, so a concurrent retry never consumes a second copy.
    const [applied] = await db.rawClient.$queryRaw<{ qty: number }[]>`
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
    if (applied) return { status: 'applied', effect } as const;
  }
  // A fresh statement can see a winning concurrent request, including when it
  // consumed the last copy. Never replay a committed effect under another ID.
  const used = await db.rawClient.practiceJokerUse.findUnique({ where: { userId_sessionId_questionId: key } });
  if (used) {
    if (used.jokerId !== jokerId || !isJokerId(used.jokerId)) return { status: 'already_used' } as const;
    const replay = resolveJokerEffect(used.jokerId, question, used.eliminated, options);
    if (replay) return { status: 'applied', effect: replay } as const;
  }
  if (Date.now() >= deadline) return { status: 'expired' } as const;
  return { status: effect ? 'empty' : 'unavailable' } as const;
}
