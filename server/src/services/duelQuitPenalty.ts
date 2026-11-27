import type { PrismaClient } from '@prisma/client';
import { DUEL_QUIT_PENALTY_COINS } from '@trivia/shared';

export interface DuelQuitPenaltyResult {
  applied: boolean;
  /** Bu istekte gerçekten düşülen altın (bakiye yetersizse daha az olabilir). */
  amount: number;
  balance?: number;
}

const PLAYER_ID = /^[A-Za-z0-9_-]{1,128}$/;
const MATCH_ID = /^[A-Za-z0-9_-]{8,80}$/;

export function isPenalizablePlayer(playerId: unknown): playerId is string {
  return typeof playerId === 'string' && PLAYER_ID.test(playerId) &&
    !/^(?:guest(?:[_:]|$)|bot_|rival_bot_)/i.test(playerId);
}

/**
 * Bitmemiş 1v1 maçı terk eden kayıtlı oyuncudan altın düşer. Aynı maç için
 * yalnızca bir kez uygulanır: `gameplay_reward_claims` satırı (userId,
 * `duel_quit:<matchId>`) birincil anahtarı tekrar denemelerde çift kesintiyi önler.
 * Bakiye sıfırın altına düşürülmez.
 */
export async function applyDuelQuitPenalty(
  client: PrismaClient,
  playerId: unknown,
  matchId: unknown,
  amount = DUEL_QUIT_PENALTY_COINS,
): Promise<DuelQuitPenaltyResult> {
  if (!isPenalizablePlayer(playerId) || typeof matchId !== 'string' || !MATCH_ID.test(matchId)) {
    return { applied: false, amount: 0 };
  }
  const rewardId = `duel_quit:${matchId}`;
  return client.$transaction(async (tx) => {
    const [owner] = await tx.$queryRaw<{ id: string; coins: number }[]>`
      SELECT "id", "coins" FROM "users" WHERE "id" = ${playerId} FOR UPDATE`;
    if (!owner) return { applied: false, amount: 0 };
    const existing = await tx.gameplayRewardClaim.findUnique({
      where: { userId_rewardId: { userId: playerId, rewardId } },
      select: { userId: true },
    });
    if (existing) return { applied: false, amount: 0, balance: owner.coins };
    const deducted = Math.max(0, Math.min(amount, owner.coins));
    await tx.gameplayRewardClaim.create({ data: { userId: playerId, rewardId } });
    const saved = deducted > 0
      ? await tx.user.update({ where: { id: playerId }, data: { coins: { decrement: deducted } }, select: { coins: true } })
      : { coins: owner.coins };
    return { applied: true, amount: deducted, balance: saved.coins };
  });
}
