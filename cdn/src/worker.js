// Tavriko CDN: client/assets klasörünü Cloudflare Workers Static Assets ile sunar.
// Görseller, ses efektleri ve müzik bu Worker üzerinden uzun süreli önbellekle dağıtılır.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
  'Cross-Origin-Resource-Policy': 'cross-origin',
  'Timing-Allow-Origin': '*',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...CORS, 'Access-Control-Max-Age': '86400' } });
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: CORS });
    }
    const range = request.headers.get('Range');
    // Safari ve bazı mobil tarayıcılar medya için Range (206) yanıtı bekler.
    const res = await env.ASSETS.fetch(range ? new Request(request.url, { method: request.method }) : request);
    if (range && res.status === 200 && /^(audio|video)\//.test(res.headers.get('content-type') || '')) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      if (match && (match[1] || match[2])) {
        const buf = await res.arrayBuffer();
        const total = buf.byteLength;
        let start = match[1] ? parseInt(match[1], 10) : total - parseInt(match[2], 10);
        let end = match[1] && match[2] ? parseInt(match[2], 10) : total - 1;
        start = Math.max(0, start);
        end = Math.min(total - 1, end);
        if (start > end) {
          return new Response(null, { status: 416, headers: { ...CORS, 'Content-Range': `bytes */${total}` } });
        }
        return new Response(request.method === 'HEAD' ? null : buf.slice(start, end + 1), {
          status: 206,
          headers: {
            ...CORS,
            'Content-Type': res.headers.get('content-type'),
            'Content-Range': `bytes ${start}-${end}/${total}`,
            'Content-Length': String(end - start + 1),
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=604800',
          },
        });
      }
    }
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(CORS)) headers.set(k, v);
    headers.set(
      'Cache-Control',
      res.ok || res.status === 206 || res.status === 304
        ? 'public, max-age=604800, stale-while-revalidate=86400'
        : 'no-store'
    );
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  },
};
