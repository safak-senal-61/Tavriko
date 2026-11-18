import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { RequestHandler } from 'express';

const SLOT_MS = 15_000;
const SLOT_COUNT = 20;
const latencyBounds = [25, 50, 100, 250, 500, 1000, 2000, 5000];
const families = ['auth', 'trivia', 'social', 'push', 'realtime', 'api', 'web'];
type Counts = { requests: number; clientErrors: number; serverErrors: number; latency: number[] };
const counts = (): Counts => ({ requests: 0, clientErrors: 0, serverErrors: 0, latency: Array(latencyBounds.length + 1).fill(0) });

export function requestFamily(path: string) {
  const [, prefix, section] = path.split('/', 3);
  if (prefix === 'ws' || prefix === 'socket.io') return 'realtime';
  if (prefix !== 'api') return 'web';
  return families.slice(0, 4).includes(section) ? section : 'api';
}

export function makeOpsTelemetry(clock = Date.now) {
  const instance = randomUUID().slice(0, 8);
  const started = clock();
  const slots: { tick: number; groups: Record<string, Counts> }[] = [];
  let cpuClock = performance.now();
  let cpuUsage = process.cpuUsage();
  let cpu: number | null = null;
  let cpuWindowMs = 0;

  function record(family: string, status: number, duration: number) {
    const tick = Math.floor(clock() / SLOT_MS);
    const index = tick % SLOT_COUNT;
    if (slots[index]?.tick !== tick) slots[index] = { tick, groups: {} };
    const groups = slots[index].groups;
    const key = families.includes(family) ? family : 'api';
    const row = groups[key] ||= counts();
    row.requests++;
    if (status >= 500) row.serverErrors++;
    else if (status >= 400) row.clientErrors++;
    const bucket = latencyBounds.findIndex((bound) => duration <= bound);
    row.latency[bucket === -1 ? latencyBounds.length : bucket]++;
  }

  const middleware: RequestHandler = (req, res, next) => {
    if (/^\/(?:api\/)?admin(?:\/|$)|^\/(?:api\/)?health\/?$|^\/(?:metrics|api\/logs|_expo|assets|app\/(?:assets|_expo))(?:\/|$)/.test(req.path)) {
      return next();
    }
    const started = performance.now();
    const group = requestFamily(req.path);
    res.once('finish', () => record(group, res.statusCode, performance.now() - started));
    next();
  };

  function traffic() {
    const tick = Math.floor(clock() / SLOT_MS);
    const total = counts();
    const groups = Object.fromEntries(families.map((key) => [key, counts()]));
    function add(target: Counts, row: Counts) {
      target.requests += row.requests;
      target.clientErrors += row.clientErrors;
      target.serverErrors += row.serverErrors;
      row.latency.forEach((n, i) => { target.latency[i] += n; });
    }
    const history = [];
    for (let t = tick - SLOT_COUNT + 1; t <= tick; t++) {
      if (t < Math.floor(started / SLOT_MS)) continue;
      const slot = slots[t % SLOT_COUNT];
      let requests = 0;
      let serverErrors = 0;
      if (slot?.tick === t) {
        for (const [key, row] of Object.entries(slot.groups)) {
          add(groups[key], row);
          add(total, row);
          requests += row.requests;
          serverErrors += row.serverErrors;
        }
      }
      history.push({ at: t * SLOT_MS, requests, serverErrors, partial: t === tick || t * SLOT_MS < started });
    }
    function summary({ latency, ...row }: Counts) {
      const threshold = Math.ceil(row.requests * 0.95);
      let cumulative = 0;
      const bucket = latency.findIndex((n) => (cumulative += n) >= threshold);
      return { ...row, p95Ms: threshold ? latencyBounds[bucket] ?? null : null, p95OverLimit: threshold > 0 && bucket === latencyBounds.length };
    }
    return { ...summary(total), history, groups: families.map((name) => ({ name, ...summary(groups[name]) })).filter((r) => r.requests > 0) };
  }

  function runtime() {
    const current = performance.now();
    const elapsed = current - cpuClock;
    if (elapsed >= 1000) {
      const diff = process.cpuUsage(cpuUsage);
      cpu = Math.round((diff.user + diff.system) / elapsed) / 10;
      cpuWindowMs = Math.round(elapsed);
      cpuClock = current;
      cpuUsage = process.cpuUsage();
    }
    const { rss, heapUsed, heapTotal } = process.memoryUsage();
    return { instance, cpu, cpuWindowMs, rss, heapUsed, heapTotal, uptimeSec: Math.floor(process.uptime()) };
  }

  return { middleware, record, traffic, runtime };
}

type ProbeState = 'ok' | 'failed' | 'timeout' | 'unconfigured' | 'unknown';
export type Probe = { name: string; detail: string; check?: () => Promise<boolean>; unset?: 'unconfigured' | 'unknown'; optional?: boolean };
export function makeProbeSampler(getProbes: () => Probe[], timeoutMs = 3000, maxAgeMs = 30_000) {
  let cache: Awaited<ReturnType<typeof sample>> | undefined;
  let pending: ReturnType<typeof sample> | undefined;
  const running = new Map<string, Promise<boolean>>();

  async function sample() {
    return Promise.all(getProbes().map(async ({ name, detail, check, unset, optional }) => {
      let state: ProbeState = unset || 'unconfigured';
      const started = performance.now();
      let ms: number | null = null;
      if (check) {
        const work = running.get(name) || Promise.resolve().then(check).catch(() => false).finally(() => running.delete(name));
        running.set(name, work);
        let timer: ReturnType<typeof setTimeout> | undefined;
        const result = await Promise.race([work, new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs); })]);
        clearTimeout(timer);
        state = result === null ? 'timeout' : result ? 'ok' : 'failed';
        if (result !== null) ms = Math.round(performance.now() - started);
      }
      return { name, detail, state, ms, optional: Boolean(optional), checkedAt: new Date().toISOString() };
    }));
  }
  let sampledAt = 0;
  return async () => {
    if (cache && Date.now() - sampledAt < maxAgeMs) return cache;
    if (pending) return pending;
    pending = sample().then((value) => {
      cache = value;
      sampledAt = Date.now();
      return value;
    }).finally(() => { pending = undefined; });
    return pending;
  };
}
