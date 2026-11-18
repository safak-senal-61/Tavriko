"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordCompletedPlayers = recordCompletedPlayers;
exports.readSignupCohorts = readSignupCohorts;
exports.readPlayerAnalytics = readPlayerAnalytics;
const node_crypto_1 = require("node:crypto");
const adminAccountOperations_1 = require("./adminAccountOperations");
const duelFunnel_1 = require("./duelFunnel");
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
        if (summary.mode === 'duel' && summary.funnelMatch === true && typeof summary.matchId === 'string') {
            await (0, duelFunnel_1.recordDuelMilestone)(tx, 'completed', summary.matchId, users.map(user => user.id));
        }
    });
}
async function readSignupCohorts(client, now) {
    const rows = await client.$queryRaw `
    WITH span AS (
      SELECT (${now}::timestamp + interval '3 hours')::date AS today,
        (min("playedAt") + interval '3 hours')::date + 1 AS first_full
      FROM "match_history" WHERE "id" LIKE 'tracked\\_%' AND "userId" IS NOT NULL AND "playedAt" <= ${now}
    ), signups AS (
      SELECT u."id", (u."createdAt" + interval '3 hours')::date AS cohort, span.today, u."createdAt"
      FROM "users" u CROSS JOIN span
      WHERE u."createdAt" >= greatest(span.first_full, span.today - 30)::timestamp - interval '3 hours'
        AND u."createdAt" < span.today::timestamp - interval '3 hours'
        AND span.first_full IS NOT NULL AND u."id" !~* '^guest[_:]'
    ), plays AS (
      SELECT s."id", s.cohort, s.today, COALESCE(bool_or(p.day < s.cohort + 7), false) AS first_match,
        COALESCE(bool_or(p.day = s.cohort + 1), false) AS d1, COALESCE(bool_or(p.day = s.cohort + 7), false) AS d7
      FROM signups s
      LEFT JOIN LATERAL (
        SELECT (m."playedAt" + interval '3 hours')::date AS day FROM "match_history" m
        WHERE m."userId" = s."id" AND m."id" LIKE 'tracked\\_%' AND m."playedAt" >= s."createdAt"
          AND m."playedAt" < (s.cohort + 8)::timestamp - interval '3 hours' AND m."playedAt" <= ${now}
      ) p ON true GROUP BY s."id", s.cohort, s.today
    )
    SELECT cohort::text AS day, count(*) AS signups,
      CASE WHEN cohort + 7 <= today THEN count(*) FILTER (WHERE first_match) END AS "firstMatch",
      CASE WHEN cohort + 2 <= today THEN count(*) FILTER (WHERE d1) END AS d1,
      CASE WHEN cohort + 8 <= today THEN count(*) FILTER (WHERE d7) END AS d7
    FROM plays GROUP BY cohort, today ORDER BY cohort DESC`;
    const cohorts = rows.map(row => ({ day: row.day, signups: Number(row.signups),
        firstMatch: row.firstMatch === null ? null : Number(row.firstMatch),
        d1: row.d1 === null ? null : Number(row.d1), d7: row.d7 === null ? null : Number(row.d7) }));
    const summarize = (key) => {
        const signedUp = cohorts.reduce((sum, row) => sum + (row[key] === null ? 0 : row.signups), 0);
        const played = cohorts.reduce((sum, row) => sum + (row[key] ?? 0), 0);
        return { signedUp, played, rate: signedUp ? played / signedUp : null };
    };
    return { cohorts, firstMatch: summarize('firstMatch'), d1: summarize('d1'), d7: summarize('d7') };
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
