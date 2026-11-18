import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sampleUptime } from './worker.mjs';

test('writes independent health successes and failures even if Vercel is down', async () => {
  const now = Date.now();
  const env = {SITE_ORIGIN:'https://site.example',OPS_REDIS_REST_URL:'https://redis.example',OPS_REDIS_REST_TOKEN:'fixture'};
  let stored;
  const result = await sampleUptime(env,now,async (url,options) => {
    if (url === 'https://redis.example') {
      stored = JSON.parse(options.body);
      return Response.json({result:1});
    }
    if (url.includes('site.example')) return new Response('unavailable',{status:503});
    if (url.includes('cdn')) return new Response('asset',{headers:{'content-type':'image/png'}});
    return Response.json({service:'Tavriko Real-time Multiplayer Gateway'});
  });
  assert.deepEqual(result,[{name:'web',ok:false},{name:'api',ok:false},{name:'cdn',ok:true},{name:'realtime',ok:true}]);
  assert.match(stored[3],/^tavriko:ops:v1:\{production\}:\d+$/);
  assert.equal(stored[5],`uptime:${Math.floor(now/300000)}`);
  const fields = JSON.parse(stored[6]);
  assert.equal(fields['probe.failed'],2);
  assert.equal(fields['probe.realtime.last.max']%2,1);
});
