const HOUR = 3600000;
const store = `
if redis.call('HSETNX',KEYS[2],ARGV[1],1) == 0 then return 0 end
local fields = cjson.decode(ARGV[2])
for field, value in pairs(fields) do
  if string.sub(field,-4) == '.max' then
    if value > tonumber(redis.call('HGET',KEYS[1],field) or '0') then redis.call('HSET',KEYS[1],field,value) end
  else redis.call('HINCRBY',KEYS[1],field,value) end
end
redis.call('EXPIRE',KEYS[1],172800)
redis.call('EXPIRE',KEYS[2],172800)
return 1`;

export async function sampleUptime(env, timestamp, request = fetch) {
  const site = new URL(env.SITE_ORIGIN);
  const redis = new URL(env.OPS_REDIS_REST_URL);
  if (site.protocol !== 'https:' || redis.protocol !== 'https:' || !env.OPS_REDIS_REST_TOKEN) throw new Error('Monitor configuration invalid');
  const targets = [
    ['web', new URL('/app',site).href, async r => /text\/html/i.test(r.headers.get('content-type') || '') && (await r.text()).includes('<title')],
    ['api', new URL('/api/observability/ping',site).href, async r => (await r.json())?.service === 'tavriko'],
    ['cdn', 'https://tavriko-cdn.uncertainidentity8.workers.dev/favicon.png', r => /^image\//.test(r.headers.get('content-type') || '')],
    ['realtime','https://tavriko-realtime.uncertainidentity8.workers.dev/health', async r => (await r.json())?.service === 'Tavriko Real-time Multiplayer Gateway'],
  ];
  const results = await Promise.all(targets.map(async ([name,url,check]) => {
    let ok = false;
    try {
      const r = await request(url,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(5500)});
      ok = r.ok && await check(r);
      if (!r.bodyUsed) await r.body?.cancel();
    } catch { /* recorded as failed, including timeout */ }
    return {name,ok};
  }));
  const base = `tavriko:ops:v1:{production}:${Math.floor(timestamp/HOUR)}`;
  const fields = {'probe.total':results.length,'probe.failed':results.filter(r => !r.ok).length};
  for (const {name,ok} of results) {
    fields[`probe.${name}.total`] = 1;
    fields[`probe.${name}.failed`] = Number(!ok);
    fields[`probe.${name}.last.max`] = Math.floor(timestamp/1000)*2 + Number(ok);
  }
  const response = await request(redis.origin,{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(3500),
    headers:{Authorization:`Bearer ${env.OPS_REDIS_REST_TOKEN}`,'Content-Type':'application/json'},
    body:JSON.stringify(['EVAL',store,2,base,base+':seen','uptime:'+Math.floor(timestamp/300000),JSON.stringify(fields)]),
  });
  if (!response.ok || ![0,1].includes((await response.json())?.result)) throw new Error('Monitor storage unavailable');
  return results;
}

export default {
  async scheduled(controller,env) { await sampleUptime(env,controller.scheduledTime); },
};
