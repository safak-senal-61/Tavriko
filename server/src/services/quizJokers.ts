import { createHmac } from 'node:crypto';
import { ClientQuestion, JokerId, JokerTactics, LIGHTNING_WINDOW_MS, Question, isJokerId, resolveJokerEffect } from '@trivia/shared';
import { getJwtSecret } from '../middleware/auth';
import { db } from '../db/prismaClient';

export async function consumeQuizJoker(
  key: { userId: string; sessionId: string; questionId: string },
  jokerId: JokerId,
  question: Pick<Question, 'options' | 'correctOptionId'>,
  deadline: number,
  live?: { tactics?: JokerTactics; startedAt: number; capabilities?: ClientQuestion['jokerCapabilities']; votes?: Record<string, number> },
) {
  // Stable on retry without adding a column or taking randomness from the client.
  const randomIndex = createHmac('sha256', getJwtSecret() || process.env.INTERNAL_API_SECRET || '')
    .update(JSON.stringify([key.userId, key.sessionId, key.questionId])).digest().readUInt32BE();
  return db.rawClient.$transaction(async tx => {
    const [account] = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "users" WHERE "id" = ${key.userId} FOR UPDATE`;
    if (!account || Date.now() >= deadline) return { status: 'unavailable' } as const;
    const used = await tx.practiceJokerUse.findUnique({ where: { userId_sessionId_questionId: key } });
    if (used && isJokerId(used.jokerId)) {
      const effect = resolveJokerEffect(used.jokerId, question, used.eliminated, {
        live: !!live, tactics: live?.tactics, capabilities: live?.capabilities, votes: live?.votes, randomIndex,
      });
      return effect ? { status: 'applied', effect } as const : { status: 'unavailable' } as const;
    }
    const effect = resolveJokerEffect(jokerId, question, undefined, {
      live: !!live, tactics: live?.tactics, capabilities: live?.capabilities, votes: live?.votes, randomIndex,
      lightningAvailable: !!live && Date.now() - live.startedAt < LIGHTNING_WINDOW_MS,
    });
    if (!effect || Date.now() >= deadline) return { status: 'unavailable' } as const;
    const stock = await tx.userInventoryItem.updateMany({
      where: { userId: key.userId, itemId: jokerId, qty: { gt: 0 } }, data: { qty: { decrement: 1 } },
    });
    if (!stock.count) return { status: 'empty' } as const;
    await tx.practiceJokerUse.create({ data: { ...key, jokerId, eliminated: effect.eliminated } });
    return { status: 'applied', effect } as const;
  });
}
