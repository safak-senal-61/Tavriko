"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameplayRewardError = void 0;
exports.getGameplayRewardProgress = getGameplayRewardProgress;
exports.claimGameplayReward = claimGameplayReward;
const shared_1 = require("@trivia/shared");
class GameplayRewardError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
exports.GameplayRewardError = GameplayRewardError;
function requireRegisteredId(userId) {
    if (!userId || /^(?:guest(?:[_:]|$)|bot_|rival_bot_)/i.test(userId)) {
        throw new GameplayRewardError(403, 'Ödüller için kayıtlı hesabınla giriş yap.');
    }
}
async function readProgress(store, userId) {
    const owner = await store.user.findUnique({ where: { id: userId }, select: { friendIds: true } });
    if (!owner)
        throw new GameplayRewardError(403, 'Ödüller için kayıtlı hesabınla giriş yap.');
    const friendIds = Array.isArray(owner.friendIds)
        ? [...new Set(owner.friendIds.filter((id) => typeof id === 'string' && id !== userId && !/^(?:guest(?:[_:]|$)|bot_|rival_bot_)/i.test(id)))]
        : [];
    const [matches, friends, claims] = await Promise.all([
        store.$queryRaw `
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
    const metrics = {
        matches: Number(row.matches), correct: Number(row.correct), perfect: Number(row.perfect), days: Number(row.days), friends,
    };
    return { metrics, claimedIds: claims.map(({ rewardId }) => rewardId) };
}
async function getGameplayRewardProgress(store, userId) {
    requireRegisteredId(userId);
    const { metrics, claimedIds } = await readProgress(store, userId);
    return (0, shared_1.gameplayRewardStatuses)(metrics, claimedIds);
}
async function claimGameplayReward(client, userId, rewardId) {
    requireRegisteredId(userId);
    const reward = shared_1.GAMEPLAY_REWARDS.find(({ item }) => item.id === rewardId);
    if (!reward)
        throw new GameplayRewardError(400, 'Bilinmeyen ödül.');
    return client.$transaction(async (tx) => {
        // Serialize claims with other inventory operations for this account across server instances.
        const [owner] = await tx.$queryRaw `
      SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
        if (!owner)
            throw new GameplayRewardError(403, 'Ödüller için kayıtlı hesabınla giriş yap.');
        const { metrics, claimedIds } = await readProgress(tx, userId);
        if (claimedIds.includes(reward.item.id)) {
            return { claimedNow: false, rewards: (0, shared_1.gameplayRewardStatuses)(metrics, claimedIds) };
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
        return { claimedNow: true, rewards: (0, shared_1.gameplayRewardStatuses)(metrics, [...claimedIds, reward.item.id]) };
    });
}
