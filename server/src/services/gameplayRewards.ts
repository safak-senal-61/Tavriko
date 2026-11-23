import type { Prisma, PrismaClient } from '@prisma/client';
import { GAMEPLAY_REWARDS, gameplayRewardStatuses, type GameplayMetrics } from '@trivia/shared';

export class GameplayRewardError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

type RewardStore = Pick<Prisma.TransactionClient, '$queryRaw' | 'user' | 'gameplayRewardClaim' | 'userInventoryItem'>;

function requireRegisteredId(userId: string) {
  if (!userId || /^(?:guest(?:[_:]|$)|bot_|rival_bot_)/i.test(userId)) {
    throw new GameplayRewardError(403, 'Ödüller için kayıtlı hesabınla giriş yap.');
  }
}

async function readProgress(store: RewardStore, userId: string) {
  const owner = await store.user.findUnique({ where: { id: userId }, select: { friendIds: true } });
  if (!owner) throw new GameplayRewardError(403, 'Ödüller için kayıtlı hesabınla giriş yap.');
  const friendIds = Array.isArray(owner.friendIds)
    ? [...new Set(owner.friendIds.filter((id): id is string => typeof id === 'string' && id !== userId && !/^(?:guest(?:[_:]|$)|bot_|rival_bot_)/i.test(id)))]
    : [];
  const [matches, friends, claims] = await Promise.all([
    store.$queryRaw<{ matches: bigint; correct: bigint; perfect: bigint; days: bigint }[]>`
      SELECT count(*) AS matches,
        coalesce(sum(least("correctAnswers", "totalQuestions")), 0) AS correct,
        count(*) FILTER (WHERE "correctAnswers" = "totalQuestions") AS perfect,
        count(DISTINCT ("playedAt" + interval '3 hours')::date) AS days
      FROM "match_history"
      WHERE "userId" = ${userId} AND left("id", 8) = 'tracked_'
        AND "rankingsJson" @> '{"rewardCompletion":true}'::jsonb AND "totalQuestions" > 0`,
    friendIds.length ? store.user.count({
      where: { id: { in: friendIds }, friendIds: { array_contains: [userId] } },
    }) : Promise.resolve(0),
    store.gameplayRewardClaim.findMany({ where: { userId }, select: { rewardId: true } }),
  ]);
  const row = matches[0];
  const metrics: GameplayMetrics = {
    matches: Number(row.matches), correct: Number(row.correct), perfect: Number(row.perfect), days: Number(row.days), friends,
  };
  return { metrics, claimedIds: claims.map(({ rewardId }) => rewardId) };
}

export async function getGameplayRewardProgress(store: RewardStore, userId: string) {
  requireRegisteredId(userId);
  const { metrics, claimedIds } = await readProgress(store, userId);
  return gameplayRewardStatuses(metrics, claimedIds);
}

export async function claimGameplayReward(client: PrismaClient, userId: string, rewardId: unknown) {
  requireRegisteredId(userId);
  const reward = GAMEPLAY_REWARDS.find(({ item }) => item.id === rewardId);
  if (!reward) throw new GameplayRewardError(400, 'Bilinmeyen ödül.');

  return client.$transaction(async (tx) => {
    // Serialize claims with other inventory operations for this account across server instances.
    const [owner] = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
    if (!owner) throw new GameplayRewardError(403, 'Ödüller için kayıtlı hesabınla giriş yap.');
    const { metrics, claimedIds } = await readProgress(tx, userId);
    if (claimedIds.includes(reward.item.id)) {
      return { claimedNow: false, rewards: gameplayRewardStatuses(metrics, claimedIds) };
    }
    if (metrics[reward.metric] < reward.target) {
      throw new GameplayRewardError(409, 'Bu ödülü almak için önce görevi tamamla.');
    }
    await tx.gameplayRewardClaim.create({ data: { userId, rewardId: reward.item.id } });
    for (const item of reward.key ? [reward.item, reward.key] : [reward.item]) {
      const permanent = item.category === 'badge';
      await tx.userInventoryItem.upsert({
        where: { userId_itemId: { userId, itemId: item.id } },
        update: permanent ? { durationHours: 0, desc: item.desc, qty: { increment: 1 } } : { qty: { increment: 1 } },
        create: { userId, itemId: item.id, name: item.name, desc: item.desc, qty: 1, durationHours: permanent ? 0 : undefined },
      });
    }
    return { claimedNow: true, rewards: gameplayRewardStatuses(metrics, [...claimedIds, reward.item.id]) };
  });
}
