"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderOpsPage = renderOpsPage;
function renderOpsPage() {
    return `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Site Sağlığı | Tavriko Admin</title>
<style>
:root{color-scheme:dark;--line:#2b384d;--text:#f1f4f9;--muted:#a4b2c8;--gold:#f3cc76;--green:#84dfb7;--red:#ffaaa3}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(ellipse at top right,#1b253b,transparent 45%),#0b101a;color:var(--text);font:15px/1.5 system-ui,sans-serif}
main,nav{max-width:1120px;margin:auto;padding:0 24px}header{border-bottom:1px solid var(--line)}nav,.hero,.tools,.service-title{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}nav{min-height:64px}
a,.kicker{color:var(--gold)}.kicker{font-size:12px;font-weight:750;letter-spacing:.12em}.hero{padding:32px 0 20px;align-items:end}.hero p,.panel p{margin:6px 0;color:var(--muted)}
h1,h2,p{margin:0}h1{font-size:clamp(34px,6vw,52px);line-height:1.15;letter-spacing:-.04em}h2{font-size:20px;letter-spacing:-.025em}
button{font:inherit;font-size:13px;font-weight:650;border:1px solid var(--line);background:#1c283a;color:var(--text);border-radius:8px;padding:9px 14px;cursor:pointer}button:hover:not(:disabled){border-color:var(--gold)}button:disabled{opacity:.55;cursor:default}button.primary{background:var(--gold);color:#1c160d}
:focus-visible{outline:2px solid var(--gold);outline-offset:3px}.state{display:flex;gap:8px 16px;align-items:center;flex-wrap:wrap;margin-bottom:14px;padding:9px 13px;border:1px solid var(--line);background:#101725;border-radius:9px;color:var(--muted);font-size:13px}
.pill{display:inline-block;padding:3px 8px;border-radius:5px;font-size:12px;font-weight:750;background:#253149;color:var(--muted)}.good{background:#1a3834;color:var(--green)}.warn{background:#413520;color:var(--gold)}.bad{background:#402a32;color:var(--red)}
.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px}.panel,.kpi{background:#141c2a;border:1px solid var(--line);border-radius:12px;padding:18px;min-width:0}.value{display:block;font-size:clamp(23px,3vw,32px);font-weight:750;line-height:1.2;letter-spacing:-.045em;margin:7px 0;font-variant-numeric:tabular-nums}.muted,small{color:var(--muted);font-size:13px}
.layout{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-bottom:25px}.stack{display:grid;gap:14px;align-content:start}
.fleet{margin:0 0 16px}.fleet .kpis{margin:12px 0}.fleet .kpi{background:#101725}.fleet details{margin-top:12px}.fleet summary{color:var(--gold);cursor:pointer}.fleet .chart{height:65px}
.service{border-top:1px solid var(--line);padding:10px 0}.service:last-child{padding-bottom:0}.service p{font-size:13px;margin:3px 0 0}.service time{font-size:12px;color:var(--muted)}
.chart{height:90px;border-bottom:1px solid var(--line);display:flex;gap:3px;margin:12px 0 4px;align-items:end}.bar{height:100%;flex:1;display:flex;justify-content:start;flex-direction:column-reverse;overflow:hidden}.bar b,.bar i{width:100%;display:block;background:#72a6ed;border-radius:2px}.bar i{background:#ec887d}.partial{opacity:.55}.chart-footer{display:flex;justify-content:space-between;gap:4px;color:var(--muted);font-size:12px}
table{width:100%;border-collapse:collapse;margin-top:10px;font-size:13px}th,td{padding:7px 3px;text-align:right;border-bottom:1px solid var(--line)}th:first-child,td:first-child{text-align:left}th{color:var(--muted)}
ul{padding-left:18px;margin:8px 0}.sandbox{border-top:2px solid #9d7b40}.sandbox .tools{margin:12px 0;justify-content:start}
@media(max-width:800px){.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.layout{grid-template-columns:1fr}}@media(max-width:420px){main,nav{padding-inline:12px}.panel,.kpi{padding:12px}.hero{padding-top:24px}.kpis,.layout{gap:8px}}
</style></head><body>
<header><nav aria-label="Yönetim"><span class="kicker">TAVRİKO / OPS</span><a href="/admin">Yönetim paneline dön</a></nav></header>
<main>
<div class="hero"><div><div class="kicker">SİSTEM GÖZLEMİ</div><h1>Site Sağlığı</h1><p>Sunucu kaynakları, API trafiği ve bağlantı kontrolleri.</p></div>
<div class="tools"><button id="pause" type="button">Durdur</button><button id="reload" type="button">Şimdi yenile</button></div></div>
<div class="state" aria-live="polite"><span class="pill" id="state">Ölçüm bekleniyor</span><span id="fresh">İlk örnek alınıyor.</span></div>
<section class="panel fleet" aria-labelledby="fleet-title">
<div class="service-title"><h2 id="fleet-title">Dağıtık izleme</h2><span id="fleet-state" class="pill">Veri bekleniyor</span></div>
<p id="fleet-fresh">Saatlik geçmiş ve dış erişilebilirlik ölçümleri yükleniyor.</p>
<div class="kpis">
<div class="kpi"><span class="muted">Vercel uygulama istekleri</span><strong id="fleet-app" class="value">—</strong><small id="fleet-app-note">Örnekler arası toplam</small></div>
<div class="kpi"><span class="muted">Vercel edge kayıtları</span><strong id="fleet-edge" class="value">—</strong><small id="fleet-edge-note">Log Drain bekleniyor</small></div>
<div class="kpi"><span class="muted">Cloudflare CDN istekleri</span><strong id="fleet-cdn" class="value">—</strong><small id="fleet-cdn-note">Son 24 saat</small></div>
<div class="kpi"><span class="muted">Tarayıcı hata sinyalleri</span><strong id="fleet-browser" class="value">—</strong><small id="fleet-browser-note">Sınırlı sayıda anonim bildirim</small></div>
</div>
<div class="chart" role="img" id="fleet-chart" aria-label="Saatlik uygulama trafiği"></div><div class="chart-footer"><span>Son 24 saat dilimi</span><span>Mavi: diğer · Kırmızı: 5xx</span><span>Şu an</span></div>
<table><thead><tr><th>Dış kontrol</th><th>Son durum</th><th>Başarılı / ölçüm</th></tr></thead><tbody id="uptime-targets"><tr><td colspan="3">Ölçüm bekleniyor.</td></tr></tbody></table>
<details><summary>Kapsam ve bölge ayrıntıları</summary><p id="fleet-runtime">İşlem örnekleri bekleniyor.</p><p id="fleet-regions"></p><p>Kaynakları birbirine eklemeyin: Vercel edge ve uygulama sayımları çakışabilir. Tarayıcı göstergesi hata oranı değildir. Dış kontroller beş dakikada bir çalışır; ölçüm yoksa sistemin erişilebilir olduğu varsayılmaz.</p></details>
</section>
<div class="service-title"><h2>Yanıt veren işlem</h2><span class="muted">Anlık, tek Node.js örneği</span></div>
<div class="kpis">
<div class="kpi"><span class="muted">İşlem CPU</span><strong class="value" id="cpu">—</strong><small id="cpu-window">%100 = bir çekirdek</small></div>
<div class="kpi"><span class="muted">Bellek / RSS</span><strong class="value" id="ram">—</strong><small id="heap">Node.js heap: —</small></div>
<div class="kpi"><span class="muted">İşlem çalışma süresi</span><strong class="value" id="uptime">—</strong><small id="instance">Örnek: —</small></div>
<div class="kpi"><span class="muted">HTTP gecikmesi / p95</span><strong class="value" id="p95">—</strong><small>Yaklaşık üst sınır, son 5 dk.</small></div></div>
<div class="layout"><div class="stack">
<section class="panel"><h2>HTTP trafiği</h2><p id="traffic">Henüz istek verisi yok.</p><div class="chart" id="chart" role="img" aria-label="15 saniyelik trafik aralıkları"></div>
<div class="chart-footer"><span id="chart-start">—</span><span>Mavi: diğer · Kırmızı: 5xx</span><span>Son örnek</span></div>
<table><thead><tr><th>Grup</th><th>İstek</th><th>4xx</th><th>5xx</th><th>p95</th></tr></thead><tbody id="groups"><tr><td colspan="5">Örnek bekleniyor.</td></tr></tbody></table></section>
<section class="panel"><h2>İnceleme önerileri</h2><ul id="notes"><li>İlk ölçüm bekleniyor.</li></ul>
<p><a href="/admin#tab-logs">Canlı loglar ve hataları aç</a></p>
<p>Bu bölüm tek Node.js örneğini ölçer. Birleşik trafik, CDN ve tarayıcı sinyalleri Dağıtık izleme bölümündedir.</p></section>
</div><div class="stack">
<section class="panel"><h2>Servis kontrolleri</h2><p>Panel açıkken alınır. Her örnekte 30 saniye önbelleklenir.</p><div id="services"></div></section>
<section class="panel sandbox"><div class="kicker">TEST ORTAMI · GERÇEK TAHSİLAT YOK</div><h2>Polar Sandbox</h2><p>Tek seferlik test ürünü; oyuncu bakiyesi ve envanteri değişmez. Gerçek kart bilgisi girmeyin.</p>
<p>Test kartı: <code>4242 4242 4242 4242</code>, ileri tarih ve herhangi bir üç haneli CVC.</p>
<div class="tools"><button type="button" class="primary" id="checkout" disabled>Test ödemesi başlat</button><button type="button" id="verify" hidden>Durumu tekrar sorgula</button></div>
<div id="payment" class="muted" role="status">Sandbox yapılandırması kontrol ediliyor.</div></section>
</div></div></main>
<script>
const by = id => document.getElementById(id), put = (id, value) => { by(id).textContent = value; };
const number = n => new Intl.NumberFormat('tr-TR', {maximumFractionDigits:1}).format(n);
const clock = at => new Date(at).toLocaleTimeString('tr-TR'), bytes = n => number(n / 1048576) + ' MiB';
const p95 = d => d.p95OverLimit ? '> 5 sn' : d.p95Ms == null ? '—' : '≤ ' + number(d.p95Ms) + ' ms';
const api = '/api/admin/ops';
let sample, paused = false, busy = false, stale = false, lastInstance, instanceChanged = false, needsLogin = false, paymentBusy = false, paymentMessage = false;
let fleetBusy = false, fleetObserved = 0;
const probeLabels = {ok:['Yanıt veriyor','good'],failed:['Kontrol başarısız','bad'],timeout:['Zaman aşımı','warn'],unconfigured:['Yapılandırılmadı','warn'],unknown:['Doğrulanmadı','']};
const groupLabels = {auth:'Kimlik doğrulama',trivia:'Oyun API',social:'Sosyal / mağaza',push:'Bildirim',realtime:'Realtime HTTP',api:'Diğer API',web:'Web'};
const initial = new URLSearchParams(location.search).get('checkout_id');
const checkoutId = /^[0-9a-f-]{36}$/i.test(initial || '') ? initial : null;
if (initial !== null) history.replaceState(null, '', location.pathname);
async function read(url, options) {
  const response = await fetch(url, {cache:'no-store', ...options, signal:AbortSignal.timeout(11000)});
  if (response.status === 401) { needsLogin = true; throw new Error('Yönetici oturumu sona erdi. Tekrar giriş yapın.'); }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'İstek tamamlanamadı.');
  return data;
}
function el(tag, text, cls) { const node = document.createElement(tag); if (text != null) node.textContent = text; if (cls) node.className = cls; return node; }
function badge(text, kind) { put('state', text); by('state').className = 'pill ' + kind; }
function duration(s) { return s < 60 ? number(s) + ' sn' : s < 3600 ? Math.floor(s / 60) + ' dk ' + s % 60 + ' sn' : Math.floor(s / 3600) + ' sa ' + Math.floor(s / 60) % 60 + ' dk'; }
async function refreshFleet() {
  if (fleetBusy || needsLogin) return;
  fleetBusy = true;
  try {
    const d = await read(api + '/fleet');
    const c = d.fleet?.counts || {};
    fleetObserved = Date.parse(d.observedAt);
    const points = d.uptime.some(t => t.lastAt);
    const attention = d.uptime.some(t => t.lastAt && (t.stale || !t.lastOK));
    const coverage = d.store === 'connected' && Boolean(c['vercel.total']) && d.cdn.state === 'observed' && points;
    put('fleet-state', attention ? 'Dış kontrol uyarısı' : coverage ? 'Kaynaklar veri gönderiyor' : 'Kapsam eksik');
    by('fleet-state').className = 'pill ' + (attention || !coverage ? 'warn' : 'good');
    put('fleet-fresh', 'Son veri: ' + clock(fleetObserved) + ' · ' + ({connected:'Ortak depo bağlı', unconfigured:'Ortak depo yapılandırılmadı', unavailable:'Ortak depoya ulaşılamadı'}[d.store]));
    const observed = field => c[field] > 0 ? number(c[field]) : '—';
    put('fleet-app', observed('app.total'));
    put('fleet-app-note', c['app.total'] ? number(c['app.5xx'] || 0) + ' sunucu hatası · p95 ' + p95(d.fleet) : 'Ölçülmüş uygulama trafiği yok');
    put('fleet-edge', observed('vercel.total'));
    put('fleet-edge-note', c['vercel.total'] ? number(c['vercel.cacheHit'] || 0) + ' cache HIT · ' + number(c['vercel.5xx'] || 0) + ' hata' : d.drainConfigured ? 'İmzalı kayıt bekleniyor' : 'Log Drain kurulumu gerekli');
    put('fleet-cdn', d.cdn.state === 'observed' ? number(d.cdn.total) : '—');
    put('fleet-cdn-note', d.cdn.state === 'observed' ? number(d.cdn.serverErrors) + ' sunucu hatası · örneklem düzeltilmiş' : ({unconfigured:'Analytics Engine kurulumu gerekli',unavailable:'Cloudflare sorgusu başarısız','no-data':'CDN verisi gözlenmedi'}[d.cdn.state]));
    put('fleet-browser', observed('browser.total'));
    put('fleet-browser-note', c['browser.total'] ? 'JS ' + (c['browser.js'] || 0) + ' · Promise ' + (c['browser.promise'] || 0) + ' · Kaynak ' + ((c['browser.cdn_asset'] || 0) + (c['browser.app_asset'] || 0)) : 'Bildirim yok; sıfır hata kanıtı değil');
    put('fleet-runtime', c['app.total'] ? 'İstek sırasında örneklenen en yüksek RSS: ' + number(c['app.rss.max'] || 0) + ' MiB. ' + (c['app.cpu.max'] ? 'En yüksek işlem CPU örneği: %' + number(c['app.cpu.max']/10) + ' (bir çekirdek = %100).' : 'CPU için yeterli örnek yok.') : 'İşlem örneği yok.');
    put('fleet-regions', Object.entries(c).filter(([k]) => /^region\\.[a-z0-9-]+\\.total$/.test(k)).map(([k,n]) => k.split('.')[1] + ': ' + number(n)).join(' · '));
    const bins = d.fleet?.history || [];
    const chart = by('fleet-chart'); chart.replaceChildren();
    const scale = Math.max(1,...bins.map(x => x.requests));
    for (const b of bins) {
      const column = el('span',null,'bar'), ok = el('b'), fail = el('i');
      column.title = clock(b.at) + ': ' + b.requests + ' istek, ' + b.errors + ' sunucu hatası';
      ok.style.height = 100*(b.requests-b.errors)/scale + '%'; fail.style.height = 100*b.errors/scale + '%';
      column.append(ok,fail); chart.append(column);
    }
    chart.setAttribute('aria-label','Saatlik uygulama trafiği. Toplam: ' + (c['app.total'] || 'veri yok'));
    const rows = by('uptime-targets'); rows.replaceChildren();
    const targets = {web:'Web',api:'API',cdn:'Cloudflare CDN',realtime:'Realtime HTTP'};
    for (const t of d.uptime) {
      const row = el('tr');
      const label = !t.lastAt ? 'Ölçüm yok' : t.stale ? 'Veri eski' : t.lastOK ? 'Erişilebilir' : 'Başarısız';
      const data = el('td'); data.append(el('span',label,'pill ' + (!t.lastAt || t.stale ? 'warn' : t.lastOK ? 'good' : 'bad')));
      if (t.lastAt) data.title = new Date(t.lastAt).toLocaleString('tr-TR');
      row.append(el('td',targets[t.name]),data,el('td',t.total ? (t.total-t.failed) + ' / ' + t.total : '—')); rows.append(row);
    }
  } catch (e) {
    put('fleet-state','Veri alınamadı');
    by('fleet-state').className = 'pill warn';
    put('fleet-fresh',fleetObserved ? 'Son bilinen veri: ' + clock(fleetObserved) : 'Birleşik veri alınamadı.');
  } finally { fleetBusy = false; }
}
function freshness() {
  if (fleetObserved && Date.now()-fleetObserved>75000) { put('fleet-state','Birleşik veri eski'); by('fleet-state').className='pill warn'; }
  if (!sample) return;
  const age = Math.max(0, Date.now() - Date.parse(sample.observedAt));
  put('fresh', 'Son örnek ' + clock(sample.observedAt) + (instanceChanged ? ' · Sunucu örneği değişti' : '') +
    (paused ? ' · Otomatik yenileme durdu' : age > 45000 ? ' · Veri eski' : ' · 15 sn aralıkla yenilenir'));
  if (needsLogin) badge('Oturum gerekli', 'bad');
  else if (stale || age > 45000) badge('Güncel veri yok', 'warn');
  else if (sample.status === 'warning') badge('İnceleme gerekli', 'warn');
  else if (sample.status === 'no-traffic') badge('Trafik gözlenmedi', '');
  else badge('Ölçülen kapsamda sorun sinyali yok', 'good');
}
function render(d) {
  const r = d.runtime, t = d.traffic;
  instanceChanged = Boolean(lastInstance && lastInstance !== r.instance); lastInstance = r.instance;
  put('cpu', r.cpu == null ? '—' : '%' + number(r.cpu));
  put('cpu-window', r.cpu == null ? 'CPU örneği bekleniyor' : duration(Math.round(r.cpuWindowMs / 1000)) + ' örnek · %100 = bir çekirdek');
  put('ram', bytes(r.rss)); put('heap', 'Heap: ' + bytes(r.heapUsed) + ' / ' + bytes(r.heapTotal));
  put('uptime', duration(r.uptimeSec)); put('instance', 'Node.js örneği: ' + r.instance); put('p95', p95(t));
  put('traffic', number(t.requests) + ' tamamlanan istek · ' + number(t.clientErrors) + ' istemci hatası (4xx) · ' + number(t.serverErrors) + ' sunucu hatası (5xx)');
  const scale = Math.max(1, ...t.history.map(b => b.requests)), chart = by('chart'); chart.replaceChildren();
  chart.setAttribute('aria-label', '15 saniyelik trafik aralıkları: ' + t.requests + ' istek, ' + t.serverErrors + ' sunucu hatası');
  put('chart-start', t.history.length ? clock(t.history[0].at) : '—');
  for (const b of t.history) {
    const bar = el('span', null, b.partial ? 'bar partial' : 'bar'), requests = el('b'), errors = el('i');
    bar.title = clock(b.at) + ': ' + b.requests + ' istek, ' + b.serverErrors + ' sunucu hatası' + (b.partial ? ' (kısmi aralık)' : '');
    requests.style.height = (100 * (b.requests - b.serverErrors) / scale) + '%'; errors.style.height = (100 * b.serverErrors / scale) + '%';
    bar.append(requests, errors); chart.append(bar);
  }
  const groups = by('groups'); groups.replaceChildren();
  if (!t.groups.length) { const td = el('td', 'Bu örnekte trafik yok.'); td.colSpan = 5; const tr = el('tr'); tr.append(td); groups.append(tr); }
  for (const g of t.groups) {
    const row = el('tr');
    [groupLabels[g.name] || 'Diğer', number(g.requests), number(g.clientErrors), number(g.serverErrors), p95(g)].forEach(v => row.append(el('td', v))); groups.append(row);
  }
  const notes = by('notes'), services = by('services'); notes.replaceChildren(); services.replaceChildren();
  for (const s of d.services) {
    const card = el('div', null, 'service'), title = el('div', null, 'service-title'), label = probeLabels[s.state];
    title.append(el('strong', s.name), el('span', label[0], 'pill ' + label[1]));
    const time = el('time', clock(s.checkedAt) + (s.ms == null ? '' : ' · ' + number(s.ms) + ' ms')); time.dateTime = s.checkedAt;
    card.append(title, el('p', s.detail), time); services.append(card);
    if (!s.optional && s.state !== 'ok') notes.append(el('li', s.name + ': ' + label[0] + '. Hizmet ayarlarını ve sağlayıcı kayıtlarını kontrol edin.'));
  }
  for (const g of t.groups.filter(g => g.serverErrors > 0)) notes.append(el('li', groupLabels[g.name] + ': ' + number(g.serverErrors) + ' adet 5xx. Aynı saat aralığındaki uygulama kayıtlarını inceleyin.'));
  for (const g of t.groups.filter(g => g.requests >= 20 && (g.p95OverLimit || g.p95Ms > 1000))) notes.append(el('li', groupLabels[g.name] + ': p95 1 saniyeyi aştı. Yavaş dış servisleri ve veritabanı sorgularını kontrol edin.'));
  if (!t.requests) notes.append(el('li', 'Bu örneğe ulaşan tamamlanmış istek yok. Trafik gözlenmemesi sistemin sağlıklı olduğunu göstermez.'));
  if (!notes.children.length) notes.append(el('li', 'Bu örnekte 5xx veya zorunlu servis uyarısı gözlenmedi.'));
  by('checkout').disabled = !d.sandboxEnabled || paymentBusy || needsLogin;
  if (!checkoutId && !paymentMessage) put('payment', d.sandboxEnabled ? 'Test işlemi başlatılabilir.' : 'Sandbox kapalı veya sunucu yapılandırması eksik.');
}
async function refresh() {
  if (busy || needsLogin) return;
  busy = true; by('reload').disabled = true;
  try { const next = await read(api + '/snapshot'); render(next); sample = next; stale = false; freshness(); }
  catch (error) {
    stale = true; freshness();
    if (!sample) { badge(needsLogin ? 'Oturum gerekli' : 'Ölçüm alınamadı', 'bad'); put('fresh', error.message); }
    if (needsLogin) by('checkout').disabled = true;
  } finally { busy = false; by('reload').disabled = needsLogin; }
}
const renew = () => { refresh(); refreshFleet(); };
by('pause').addEventListener('click', () => { paused = !paused; put('pause', paused ? 'Devam et' : 'Durdur'); freshness(); if (!paused) renew(); });
by('reload').addEventListener('click', renew);
setInterval(() => { if (!paused && !document.hidden) refresh(); }, 15000);
setInterval(() => { if (!paused && !document.hidden) refreshFleet(); }, 30000);
setInterval(freshness, 3000);
document.addEventListener('visibilitychange', () => { if (!paused && !document.hidden) renew(); });
async function verify() {
  if (!checkoutId || by('verify').disabled) return;
  by('verify').hidden = false; by('verify').disabled = true;
  put('payment', 'Durum Polar Sandbox üzerinden doğrulanıyor…');
  try {
    const result = await read(api + '/polar/checkout/' + encodeURIComponent(checkoutId));
    const labels = {open:'Ödeme henüz tamamlanmadı.',confirmed:'İşlem alındı; ödeme henüz doğrulanmadı.',succeeded:'Polar Sandbox test ödemesini doğruladı. Oyun hesabı değişmedi.',failed:'Polar Sandbox işlemin başarısız olduğunu bildirdi.',expired:'Test işleminin süresi doldu.'};
    put('payment', labels[result.status] || 'Ödeme durumu doğrulanamadı.');
  } catch (error) { put('payment', error.message); }
  finally { by('verify').disabled = false; }
}
by('verify').addEventListener('click', verify);
by('checkout').addEventListener('click', async () => {
  paymentBusy = paymentMessage = true; by('checkout').disabled = true;
  put('payment', 'Test oturumu hazırlanıyor…');
  try {
    const result = await read(api + '/polar/checkout', {method:'POST', headers:{'Content-Type':'application/json'}, body:'{}'});
    location.assign(result.url);
  } catch (error) {
    put('payment', error.message); paymentBusy = false; by('checkout').disabled = needsLogin || !sample?.sandboxEnabled;
  }
});
renew(); if (checkoutId) verify();
</script></body></html>`;
}
