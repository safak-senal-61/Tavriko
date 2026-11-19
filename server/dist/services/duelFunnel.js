"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.duelCoverageStart = duelCoverageStart;
exports.readDuelConsent = readDuelConsent;
exports.changeDuelConsent = changeDuelConsent;
exports.recordDuelMilestone = recordDuelMilestone;
exports.readDuelFunnel = readDuelFunnel;
const adminAccountOperations_1 = require("./adminAccountOperations");
const playerAccess_1 = require("./playerAccess");
const day = 86_400_000;
const windowMs = 7 * day;
function duelCoverageStart() {
    const value = process.env.DUEL_FUNNEL_START_AT;
    if (!value || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value))
        return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
}
const eligibility = (coverage, now) => ({
    gte: new Date(Math.max(coverage.getTime(), now.getTime() - windowMs)),
    lte: now,
});
async function readDuelConsent(client, id, now = new Date()) {
    const start = duelCoverageStart();
    const [user, optedIn] = await Promise.all([
        client.user.findUnique({ where: { id }, select: { createdAt: true } }),
        client.duelFunnelEvent.findUnique({ where: { accountId_stage_room: { accountId: id, stage: 'eligible', room: '' } }, select: { at: true } }),
    ]);
    return { optedIn: Boolean(optedIn), canEnroll: Boolean(start && user && user.createdAt >= start &&
            now.getTime() - user.createdAt.getTime() <= day && user.createdAt <= now) };
}
async function changeDuelConsent(client, id, event, now = new Date()) {
    const start = duelCoverageStart();
    if (!start && event !== 'withdraw')
        return;
    await client.$transaction(async (tx) => {
        const [row] = await tx.$queryRaw `SELECT "createdAt" FROM "users" WHERE "id"=${id} FOR NO KEY UPDATE`;
        if (!row)
            return;
        if (event === 'withdraw') {
            await tx.duelFunnelEvent.deleteMany({ where: { accountId: id } });
            return;
        }
        if (!start || row.createdAt < start || now < row.createdAt || now.getTime() - row.createdAt.getTime() > (event === 'enroll' ? day : windowMs))
            return;
        if (event === 'select' && !(await tx.duelFunnelEvent.findUnique({ where: { accountId_stage_room: { accountId: id, stage: 'eligible', room: '' } }, select: { at: true } })))
            return;
        await tx.duelFunnelEvent.createMany({ data: [{ accountId: id, stage: event === 'enroll' ? 'eligible' : 'selected', room: '', at: now }], skipDuplicates: true });
    });
}
async function recordDuelMilestone(tx, stage, room, ids, now = new Date()) {
    const start = duelCoverageStart();
    if (!start || now < start || !adminAccountOperations_1.uuidPattern.test(room))
        return;
    const candidates = [...new Set(ids.filter(id => playerAccess_1.validPlayerId.test(id) && !(0, playerAccess_1.isGuestIdentity)(id)))].slice(0, 2).sort();
    if (!candidates.length)
        return;
    // Serialize with withdrawal on the same accounts; consult opt-in only after the lock.
    for (const id of candidates)
        await tx.$queryRaw `SELECT "id" FROM "users" WHERE "id"=${id} FOR NO KEY UPDATE`;
    const optedIn = await tx.duelFunnelEvent.findMany({ where: { accountId: { in: candidates }, stage: 'eligible', room: '',
            at: { lte: now }, account: { createdAt: eligibility(start, now) } }, select: { accountId: true } });
    if (optedIn.length)
        await tx.duelFunnelEvent.createMany({ data: optedIn.map(({ accountId }) => ({ accountId, stage, room, at: now })), skipDuplicates: true });
}
async function readDuelFunnel(client, now = new Date()) {
    const start = duelCoverageStart();
    if (!start || now < start)
        return null;
    const cutoff = new Date(now.getTime() - windowMs);
    const lower = new Date(Math.max(start.getTime(), cutoff.getTime() - 30 * day));
    const [row] = await client.$queryRaw `
    WITH eligible AS (
      SELECT u."id", u."createdAt" + interval '7 days' AS deadline, s."at" AS selected
      FROM "duel_funnel_events" e
      JOIN "users" u ON u."id" = e."accountId"
      LEFT JOIN "duel_funnel_events" s ON s."accountId"=u."id" AND s."stage"='selected' AND s."room"=''
        AND s."at">=e."at" AND s."at" < u."createdAt" + interval '7 days'
      WHERE e."stage"='eligible' AND e."room"='' AND u."createdAt">=${lower} AND u."createdAt"<=${cutoff}
    ), progression AS (
      SELECT e."id", e.selected, count(m."room") AS matches, count(c."room") AS completes
      FROM eligible e
      LEFT JOIN "duel_funnel_events" m ON m."accountId"=e."id" AND m."stage"='matched' AND m."at">=e.selected AND m."at"<e.deadline
      LEFT JOIN "duel_funnel_events" c ON c."accountId"=e."id" AND c."stage"='completed' AND c."room"=m."room" AND c."at">=m."at" AND c."at"<e.deadline
      GROUP BY e."id", e.selected
    )
    SELECT count(*) AS registered, count(selected) AS selected, count(*) FILTER (WHERE matches>0) AS matched,
      count(*) FILTER (WHERE completes>0) AS completed FROM progression`;
    return { coverageStart: start.toISOString(), registered: Number(row.registered), selected: Number(row.selected),
        matched: Number(row.matched), completed: Number(row.completed) };
}
