"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordCompletedPlayers = recordCompletedPlayers;
exports.readPlayerAnalytics = readPlayerAnalytics;
const node_crypto_1 = require("node:crypto");
const adminAccountOperations_1 = require("./adminAccountOperations");
async function recordCompletedPlayers(client, summary) {
    if (!Array.isArray(summary.verifiedPlayerIds) || !summary.verifiedPlayerIds.length)
        return;
    const verified = new Set(summary.verifiedPlayerIds);
    // Older workers don't have a match instance ID. Keep a deterministic fallback for retries.
    const identity = typeof summary.matchId === 'string' && adminAccountOperations_1.uuidPattern.test(summary.matchId)
        ? summary.matchId : JSON.stringify([summary.roomCode, summary.mode,
        summary.rankings.map(r => [r.playerId, r.score, r.rank]).sort((a, b) => String(a[0]).localeCompare(String(b[0])))]);
    const participants = new Map(summary.rankings.filter(r => r && typeof r.playerId === 'string' && verified.has(r.playerId) && !r.isBot &&
        !/^(?:bot_|rival_bot_|guest[_:])/.test(r.playerId)).map(r => [r.playerId, r]));
    if (!participants.size)
        return;
    await client.$transaction(async (tx) => {
        const users = await tx.user.findMany({ where: { id: { in: [...participants.keys()] } }, select: { id: true } });
        const boundedInt = (value) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1_000_000, Math.trunc(value))) : 0;
        if (!users.length)
            return;
        await tx.matchHistory.createMany({
            data: users.map(({ id }) => {
                const rank = participants.get(id);
                return {
                    id: `tracked_${(0, node_crypto_1.createHash)('sha256').update(JSON.stringify([identity, id])).digest('hex')}`,
                    userId: id, roomCode: summary.roomCode, mode: summary.mode, categoryId: summary.category || 'general_culture',
                    totalQuestions: boundedInt(summary.totalRounds), correctAnswers: boundedInt(rank.correctAnswersCount),
                    score: boundedInt(rank.score), rankingsJson: [],
                };
            }),
            skipDuplicates: true,
        });
    });
}
async function readPlayerAnalytics(client, days, first, now) {
    const rows = await client.$queryRaw `
    WITH recent AS (
      SELECT DISTINCT m."userId", to_char(m."playedAt" + interval '3 hours', 'YYYY-MM-DD') AS day
      FROM "match_history" m
      WHERE m."userId" IS NOT NULL AND m."playedAt" >= ${first} AND m."playedAt" <= ${now}
    ), people AS (
      SELECT u."id", u."createdAt", NOT EXISTS (
        SELECT 1 FROM "match_history" old WHERE old."userId" = u."id" AND old."playedAt" < ${first}
      ) AS first_in_window
      FROM "users" u JOIN (SELECT DISTINCT "userId" FROM recent) ids ON ids."userId" = u."id"
    ), joined AS (
      SELECT r.day, p.*, row_number() OVER (PARTITION BY p."id" ORDER BY r.day) AS seq
      FROM recent r JOIN people p ON p."id" = r."userId"
    ), coverage AS (
      SELECT min("playedAt") AS since FROM "match_history" WHERE "userId" IS NOT NULL AND "playedAt" <= ${now}
    )
    SELECT j.day, count(DISTINCT j."id") AS active,
      count(*) FILTER (WHERE j.seq = 1 AND j.first_in_window) AS first,
      count(DISTINCT j."id") FILTER (WHERE NOT j.first_in_window) AS returning,
      count(*) FILTER (WHERE j.seq = 1 AND j.first_in_window AND j."createdAt" >= ${first}) AS "newlyRegistered",
      (SELECT since FROM coverage) AS coverage
    FROM joined j GROUP BY GROUPING SETS ((j.day), ())`;
    const totals = rows.find(r => r.day === null);
    return {
        coverageSince: totals?.coverage?.toISOString() ?? null,
        weeklyActive: Number(totals?.active ?? 0),
        weeklyReturning: Number(totals?.returning ?? 0),
        newPlayersWithFirstMatch: Number(totals?.newlyRegistered ?? 0),
        days: days.map(day => {
            const row = rows.find(r => r.day === day);
            return { day, active: Number(row?.active ?? 0), first: Number(row?.first ?? 0) };
        }),
    };
}
