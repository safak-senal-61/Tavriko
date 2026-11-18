"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.browserKinds = void 0;
exports.createFleetStore = createFleetStore;
exports.fleetMiddleware = fleetMiddleware;
exports.validSignature = validSignature;
exports.parseDrain = parseDrain;
exports.readCdnTraffic = readCdnTraffic;
const node_crypto_1 = require("node:crypto");
const node_perf_hooks_1 = require("node:perf_hooks");
const redis_1 = require("@upstash/redis");
const functions_1 = require("@vercel/functions");
const opsTelemetry_1 = require("./opsTelemetry");
const HOUR = 3_600_000;
const RETENTION = 172800;
const edgeSources = ['static', 'edge', 'lambda', 'external', 'firewall', 'redirect'];
exports.browserKinds = ['js', 'promise', 'cdn_asset', 'app_asset'];
const region = (process.env.VERCEL_REGION || 'local').match(/^[a-z][a-z0-9-]{1,15}$/)?.[0] || 'other';
const durationBins = [25, 50, 100, 250, 500, 1000, 2000, 5000];
// A shared cluster hash tag keeps multi-hour writes and dedup keys in one slot.
const key = (ns, at) => `tavriko:ops:v1:{${ns}}:${Math.floor(at / HOUR)}`;
const ns = () => process.env.VERCEL_ENV === 'production' ? 'production' : process.env.VERCEL ? 'preview' : 'local';
const SCRIPT = `
local values = cjson.decode(ARGV[1])
local cap = tonumber(ARGV[3])
local accepted = 0
for i, row in ipairs(values) do
  local k = KEYS[row[1]]
  local dedup = KEYS[row[1]+1]
  local seen = row[3]
  local browser = row[4]
  if (not browser or tonumber(redis.call('HGET',k,'browser.total') or '0') < cap)
    and (seen == '' or redis.call('HSETNX',dedup,seen,1) == 1) then
    if seen ~= '' then redis.call('EXPIRE',dedup,ARGV[2]) end
    for field, n in pairs(row[2]) do redis.call('HINCRBY', k,field,n) end
    for field, n in pairs(row[5]) do
      if n > tonumber(redis.call('HGET',k,field) or '0') then redis.call('HSET',k,field,n) end
    end
    redis.call('EXPIRE',k,ARGV[2])
    accepted = accepted + 1
  end
end
return accepted`;
function createFleetStore() {
    const dedicated = Boolean(process.env.OPS_REDIS_REST_URL || process.env.OPS_REDIS_REST_TOKEN);
    const url = dedicated ? process.env.OPS_REDIS_REST_URL : process.env.UPSTASH_REDIS_REST_URL;
    const token = dedicated ? process.env.OPS_REDIS_REST_TOKEN : process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token)
        return null;
    let redis;
    try {
        if (new URL(url.trim()).protocol !== 'https:')
            return null;
        redis = new redis_1.Redis({ url: url.trim(), token: token.trim(), retry: false, signal: () => AbortSignal.timeout(2100) });
    }
    catch {
        return null;
    }
    const namespace = ns();
    return {
        async write(rows) {
            if (!rows.length)
                return 0;
            const keys = [...new Set(rows.map(row => key(namespace, row.at)))];
            return redis.eval(SCRIPT, keys.flatMap(k => [k, k + ':seen']), [
                JSON.stringify(rows.map(row => [keys.indexOf(key(namespace, row.at)) * 2 + 1, row.counts, row.unique || '', Boolean(row.browser), row.maxima || {}])),
                RETENTION, 3000,
            ]);
        },
        async read(at = Date.now()) {
            const end = Math.floor(at / HOUR) * HOUR;
            const times = Array.from({ length: 24 }, (_, i) => end - (23 - i) * HOUR);
            const pipeline = redis.pipeline();
            times.forEach(t => pipeline.hgetall(key(namespace, t)));
            const raw = await pipeline.exec();
            const hours = raw.map((value, i) => ({ at: times[i], counts: value || {} }));
            const counts = {};
            for (const hour of hours)
                for (const [field, n] of Object.entries(hour.counts)) {
                    counts[field] = field.endsWith('.max') ? Math.max(counts[field] || 0, n) : (counts[field] || 0) + n;
                }
            const sampleCount = counts['app.total'] || 0;
            const threshold = Math.ceil(sampleCount * .95);
            let samples = 0;
            const index = [...durationBins, Infinity].findIndex((_, i) => (samples += counts[`app.latency.${i}`] || 0) >= threshold);
            return { hourStart: times[0], counts, p95Ms: sampleCount ? durationBins[index] ?? null : null,
                p95OverLimit: sampleCount > 0 && index === durationBins.length,
                lastHour: hours.at(-1).counts, history: hours.map(({ at, counts: c }) => ({
                    at, requests: c['app.total'] || 0, errors: c['app.5xx'] || 0, browser: c['browser.total'] || 0,
                    edge: c['vercel.total'] || 0, probes: c['probe.total'] || 0, failedProbes: c['probe.failed'] || 0,
                })) };
        },
    };
}
function fleetMiddleware(store) {
    return (req, res, next) => {
        if (!store || !/^\/(?:api(?:\/|$)|app\/?$)/i.test(req.path) ||
            /^\/api\/(?:admin|portal|observability|logs|cron)(?:\/|$)/i.test(req.path))
            return next();
        const started = node_perf_hooks_1.performance.now();
        const cpuStart = process.cpuUsage();
        let complete = () => { };
        const lifetime = new Promise(resolve => { complete = resolve; });
        if (process.env.VERCEL)
            (0, functions_1.waitUntil)(lifetime);
        res.once('close', complete);
        res.once('finish', () => {
            const duration = node_perf_hooks_1.performance.now() - started;
            const family = (0, opsTelemetry_1.requestFamily)(req.path);
            const status = res.statusCode;
            const cpuDelta = process.cpuUsage(cpuStart);
            const latency = durationBins.findIndex(n => duration <= n);
            const counts = {
                'app.total': 1, [`route.${family}.total`]: 1, [`region.${region}.total`]: 1,
                [`app.latency.${latency === -1 ? durationBins.length : latency}`]: 1,
            };
            if (status >= 400) {
                const klass = status >= 500 ? '5xx' : '4xx';
                counts[`app.${klass}`] = 1;
                counts[`route.${family}.${klass}`] = 1;
                counts[`region.${region}.${klass}`] = 1;
            }
            // Peak RSS and highest sampled CPU duty during eligible requests, never a fleet-wide CPU percentage.
            const maxima = { 'app.rss.max': Math.round(process.memoryUsage.rss() / 1048576) };
            if (duration >= 25)
                maxima['app.cpu.max'] = Math.round((cpuDelta.user + cpuDelta.system) / duration);
            res.removeListener('close', complete);
            void store.write([{ at: Date.now(), counts, maxima }]).catch(() => { }).finally(complete);
        });
        next();
    };
}
function validSignature(body, signature, secret) {
    if (!secret || !/^[0-9a-f]{40}$/i.test(signature))
        return false;
    return (0, node_crypto_1.timingSafeEqual)((0, node_crypto_1.createHmac)('sha1', secret).update(body).digest(), Buffer.from(signature, 'hex'));
}
function parseDrain(body, projectId, now = Date.now()) {
    if (!Array.isArray(body) || body.length > 2000 || !projectId)
        return [];
    const rows = [];
    for (const row of body) {
        if (!row || row.projectId !== projectId || row.environment !== 'production' || !edgeSources.includes(row.source))
            continue;
        const status = row.proxy?.statusCode ?? row.statusCode;
        const at = row.timestamp;
        if (!Number.isInteger(status) || (status !== -1 && (status < 100 || status > 599)) ||
            !Number.isSafeInteger(at) || at < now - 24 * HOUR || at > now + 60_000)
            continue;
        // Skip intake observations to avoid telemetry delivering its own delivery logs.
        if ([row.path, row.proxy?.path].some(p => typeof p === 'string' && /\/api\/observability(?:[/?]|$)/i.test(p)))
            continue;
        const upstreamId = row.requestId || row.id;
        if (typeof upstreamId !== 'string' || !upstreamId || upstreamId.length > 256)
            continue;
        const unique = (0, node_crypto_1.createHash)('sha256').update(`${row.source}:${upstreamId}`).digest('hex').slice(0, 32);
        const counts = { 'vercel.total': 1, [`vercel.${row.source}`]: 1 };
        if (status === -1 || status >= 500)
            counts['vercel.5xx'] = 1;
        if (status >= 400 && status < 500)
            counts['vercel.4xx'] = 1;
        if (row.proxy?.vercelCache === 'HIT')
            counts['vercel.cacheHit'] = 1;
        rows.push({ at, unique, counts });
    }
    return rows;
}
const cdnQuery = `SELECT SUM(_sample_interval) AS total,
SUM(IF(double1 >= 400 AND double1 < 500, _sample_interval, 0)) AS clientErrors,
SUM(IF(double1 >= 500, _sample_interval, 0)) AS serverErrors
FROM tavriko_cdn_ops WHERE timestamp > NOW() - INTERVAL '1' DAY`;
async function readCdnTraffic() {
    const id = process.env.OPS_CLOUDFLARE_ACCOUNT_ID;
    const token = process.env.OPS_CLOUDFLARE_ANALYTICS_TOKEN;
    if (!id || !/^[0-9a-f]{32}$/i.test(id) || !token)
        return { state: 'unconfigured' };
    try {
        const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${id}/analytics_engine/sql`, {
            method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' },
            body: cdnQuery, signal: AbortSignal.timeout(2500), redirect: 'error',
        });
        if (!response.ok)
            return { state: 'unavailable' };
        const data = await response.json();
        const r = data?.data?.[0];
        if (!r || !['total', 'clientErrors', 'serverErrors'].every(k => r[k] != null && /^\d+(?:\.\d+)?$/.test(String(r[k]))))
            return { state: 'no-data' };
        const total = Number(r.total);
        return total ? { state: 'observed', total, clientErrors: Number(r.clientErrors), serverErrors: Number(r.serverErrors) } : { state: 'no-data' };
    }
    catch {
        return { state: 'unavailable' };
    }
}
