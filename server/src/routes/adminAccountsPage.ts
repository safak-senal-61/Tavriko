import { adminPages, adminSessionScript, adminTheme, renderAdminHeader, renderAdminHero } from './adminShell';

export function renderAdminAccounts() {
  const accountPage = adminPages.find(page => page.id === 'db')!;
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kullanıcılar | Tavriko Admin</title><style>${adminTheme}
:root{--accounts-small:.8125rem;--accounts-body:.9375rem;--accounts-title:1.125rem}
h2,h3,p,figure{margin:0} h2{font-size:var(--accounts-title)}h3{font-size:var(--accounts-body)}[hidden]{display:none!important}
.account-main{padding-bottom:40px}.account-panel{min-width:0;border:1px solid var(--line);border-radius:12px;background:var(--card)}
.account-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:14px}.metric{padding:16px}
.metric header,.account-section,.account-footer,.dialog-head{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
.muted,.account-status,.account-sub{color:var(--muted);font-size:var(--accounts-small)}.account-status{min-height:1.5em}.account-status[data-error=true]{color:var(--red)}
.metric strong{font-size:1.625rem;line-height:1.2;font-variant-numeric:tabular-nums;display:block;margin:6px 0 2px}
.bars{height:76px;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);align-items:end;gap:3px;padding-top:8px;border-bottom:1px solid var(--line)}
.bars span{display:block;height:var(--bar);min-width:0;background:var(--gold);border-radius:2px 2px 0 0}.bars.traffic span{background:var(--cyan)}.bars span:last-child{opacity:.65}
.axes{display:flex;justify-content:space-between;margin-top:3px}.metric details{margin-top:6px;font-size:var(--accounts-small)}.metric summary{cursor:pointer;color:var(--gold)}
.bin-list{list-style:none;padding:0;margin:6px 0 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(92px,1fr));gap:4px;color:var(--muted)}.bin-list li{font-variant-numeric:tabular-nums}
.account-section,.account-footer{padding:12px 14px}.account-section{align-items:start}.account-controls{display:flex;align-items:end;gap:8px;flex-wrap:wrap;padding:0 14px 12px}
.account-controls label{flex:0 1 auto}.account-controls label:first-child{flex:1 1 205px}.account-main label{display:block;color:var(--muted);font-size:var(--accounts-small);font-weight:650}
.account-main :is(input:not([type=checkbox]),select){display:block;min-height:42px;width:100%;min-width:0;margin-top:4px;padding:7px 9px;border:1px solid var(--line);border-radius:7px;background:#101725;color:var(--text);font:inherit;font-size:var(--accounts-body)}
.account-main button{min-height:40px;padding:5px 10px;border:1px solid var(--line);border-radius:7px;background:var(--card-hover);color:var(--text);font:650 var(--accounts-small) system-ui;cursor:pointer}
.account-main button:disabled{opacity:.49;cursor:not-allowed}.account-main button:not(:disabled):hover{border-color:var(--gold);color:var(--gold)}.account-main button.primary{background:#2b271f;border-color:#806943;color:var(--gold)}
.account-table{overflow-x:auto;overscroll-behavior-inline:contain}.account-table table{width:100%;min-width:550px;border-collapse:collapse;text-align:left;font-size:var(--accounts-small);font-variant-numeric:tabular-nums}
.account-table :is(th,td){padding:8px 14px;border-top:1px solid var(--line)}.account-table th{color:var(--muted);font-weight:700;background:#101725}.account-table td:first-child{overflow-wrap:anywhere;max-width:260px}
.account-sub{display:block}.account-type{font-weight:650;color:var(--gold)}.account-footer>div{display:flex;gap:6px}
dialog{color:var(--text);width:min(560px,calc(100% - 24px));max-height:calc(100dvh - 24px);overflow:auto;overscroll-behavior:contain;padding:16px;border:1px solid var(--line);border-radius:12px;background:var(--card)}
dialog::backdrop{background:#070b13d9}body:has(dialog[open]){overflow:hidden}.dialog-id{overflow-wrap:anywhere;color:var(--muted);font-size:var(--accounts-small)}
.details-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:12px 0}.details-grid div{padding:6px 8px;border:1px solid var(--line);border-radius:6px;overflow-wrap:anywhere}.details-grid dt{font-size:var(--accounts-small);color:var(--muted)}.details-grid dd{margin:2px 0 0;font-size:var(--accounts-body);font-variant-numeric:tabular-nums}
.dialog-actions{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:8px}.dialog-block{margin-top:12px;padding-top:10px;border-top:1px solid var(--line)}.dialog-block summary{cursor:pointer;color:var(--gold)}
.recent-matches{margin:4px 0 0;padding-left:18px;font-size:var(--accounts-small);overflow-wrap:anywhere}.edit-form fieldset{border:0;padding:0;margin:0;min-width:0}
.edit-form label{margin-top:8px}.edit-form input[type=checkbox]{accent-color:var(--gold)}.confirmation{padding:10px;border:1px solid #806943;border-radius:7px;background:#2b271f;margin-top:8px;overflow-wrap:anywhere}
@media(max-width:630px){.account-metrics{grid-template-columns:minmax(0,1fr)}.account-controls label:not(:first-child){flex:1 1 118px}.metric{padding:12px}}
</style></head><body>${renderAdminHeader('db')}
<main class="admin-wrap account-main" id="admin-main" tabindex="-1">
${renderAdminHero(accountPage)}
<section class="account-metrics" aria-label="Kayıt ve erişim ölçümleri">
  <article class="account-panel metric"><header><h2>Yeni hesaplar</h2><span class="muted">Son 7 takvim günü</span></header>
  <strong id="reg-total">…</strong><p class="account-status" id="reg-status" role="status">PostgreSQL verisi bekleniyor.</p>
  <figure id="reg-figure" hidden><div class="bars" id="reg-bars" aria-hidden="true"></div><div class="axes muted"><span id="reg-first"></span><span>Bugün · kısmi</span></div>
  <details><summary>Günlük sayılar</summary><ol class="bin-list" id="reg-values"></ol></details></figure></article>
  <article class="account-panel metric"><header><h2>HTTP istekleri</h2><a class="muted" href="/admin/health">Site Sağlığı</a></header>
  <strong id="http-total">…</strong><p class="account-status" id="http-status" role="status">Trafik verisi bekleniyor.</p>
  <figure id="http-figure" hidden><div class="bars traffic" id="http-bars" aria-hidden="true"></div><div class="axes muted"><span>24 saatlik dilim</span><span>Cari saat · kısmi</span></div>
  <details><summary>Saatlik sayılar</summary><ol class="bin-list" id="http-values"></ol></details></figure></article>
</section>
<section class="account-panel" aria-labelledby="account-list-heading">
  <div class="account-section"><div><h2 id="account-list-heading">Hesap dizini</h2><p class="account-status" id="list-status" role="status">Hesaplar yükleniyor.</p></div><button type="button" id="accounts-refresh">Yenile</button></div>
  <form class="account-controls" id="accounts-filter">
    <label>Hesap ara<input id="account-query" maxlength="80" placeholder="Ad, kullanıcı adı veya hesap ID"></label>
    <label>Hesap filtresi<select id="account-filter"><option value="all">Tüm hesaplar</option><option value="new">Son 7 gün</option><option value="played">Maç oynamış</option><option value="premium">Premium Pass</option></select></label>
    <label>Sırala<select id="account-sort"><option value="newest">En yeni</option><option value="matches">En çok maç</option></select></label>
    <button type="submit" class="primary">Ara</button>
  </form>
  <div class="account-table" role="region" aria-label="Hesaplar tablosu" tabindex="0"><table>
    <thead><tr><th scope="col">Oyuncu</th><th scope="col">Kayıt</th><th scope="col">Seviye</th><th scope="col">Maç</th><th scope="col">İşlem</th></tr></thead>
    <tbody id="account-rows"></tbody></table></div>
  <div class="account-footer"><span class="muted" id="account-page">Sayfa 1</span><div><button id="account-prev" type="button" disabled>Önceki</button><button id="account-next" type="button" disabled>Sonraki</button></div></div>
</section>
<dialog id="account-detail" aria-labelledby="detail-heading"><div class="dialog-head"><h2 id="detail-heading">Hesap ayrıntısı</h2><button type="button" id="detail-close" autofocus>Kapat</button></div>
  <p class="account-status" id="detail-status" role="status"></p>
  <div class="dialog-actions"><button type="button" id="detail-reload">Hesabı yenile</button></div>
  <div id="detail-content" hidden><p class="dialog-id" id="detail-id"></p>
    <div class="dialog-actions"><button type="button" id="copy-id">Hesap ID’yi kopyala</button></div>
    <dl class="details-grid" id="detail-facts"></dl>
    <details class="dialog-block" id="match-section"><summary>Son kayıtlı maçlar</summary><ul class="recent-matches" id="match-list"></ul></details>
    <details class="dialog-block" id="edit-section"><summary>Profili düzelt</summary>
      <form class="edit-form" id="profile-edit">
        <fieldset id="edit-fields"><label>Görünür ad<input id="edit-name" maxlength="100" autocomplete="off"></label>
        <label><input id="edit-avatar" type="checkbox"> Varsayılan avatara dön</label>
        <label>İşlem nedeni<select id="edit-reason" required><option value="">Neden seçin</option><option value="support">Destek talebi</option><option value="display-policy">Profil adı kuralları</option><option value="avatar-reset">Avatar düzeltmesi</option></select></label>
        <div class="dialog-actions"><button type="submit" class="primary">Değişikliği incele</button></div></fieldset>
        <div class="confirmation" id="edit-confirm" hidden><p id="edit-summary"></p><div class="dialog-actions">
          <button type="button" id="edit-save" class="primary">Onayla ve kaydet</button><button type="button" id="edit-cancel">Geri dön</button>
        </div></div>
      </form>
    </details>
  </div>
</dialog></main>
${adminSessionScript}<script>${accountsScript}</script></body></html>`;
}

const accountsScript = String.raw`
const by = id => document.getElementById(id);
const api = '/api/admin/accounts';
const fmt = new Intl.NumberFormat('tr-TR');
const day = new Intl.DateTimeFormat('tr-TR', { day:'numeric', month:'short', year:'numeric', timeZone:'Europe/Istanbul' });
const hour = new Intl.DateTimeFormat('tr-TR', { hour:'2-digit', minute:'2-digit', timeZone:'Europe/Istanbul' });
const num = n => Number.isFinite(n) ? fmt.format(n) : '—';
const date = d => d && Number.isFinite(Date.parse(d)) ? day.format(new Date(d)) : '—';
function el(tag, value, css) {
  const node = document.createElement(tag);
  if (value != null) node.textContent = value;
  if (css) node.className = css;
  return node;
}
function status(id, msg, error = false) {
  by(id).textContent = msg; by(id).dataset.error = String(error);
}
async function read(path, options) {
  const response = await fetch(path, {cache:'no-store', credentials:'same-origin', signal:AbortSignal.timeout(10000), ...options});
  if (response.status === 401) {
    location.assign('/admin/login?next=%2Fadmin%2Fkullanicilar');
    throw new Error('Yönetici oturumu sona erdi.');
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'İşlem tamamlanamadı.');
  return data;
}
function bars(key, entries) {
  const max = Math.max(1, ...entries.map(item => item.value));
  by(key+'-bars').replaceChildren(...entries.map(item => {
    const b = el('span'); b.style.setProperty('--bar', 100*item.value/max + '%');
    b.title = item.label + ': ' + num(item.value); return b;
  }));
  by(key+'-values').replaceChildren(...entries.map(item => el('li', item.label + ': ' + num(item.value))));
  by(key+'-figure').hidden = false;
}
let metricEpoch = 0;
async function refreshMetrics() {
  const epoch = ++metricEpoch;
  await Promise.all([
    read(api+'/metrics').then(d => {
      if (epoch !== metricEpoch) return;
      by('reg-total').textContent = num(d.days.reduce((total, item) => total + item.accounts, 0));
      status('reg-status', num(d.total) + ' toplam kayıtlı hesap · Güncel: ' + hour.format(new Date(d.observedAt)));
      by('reg-first').textContent = date(d.days[0].day);
      bars('reg', d.days.map(item => ({ label: date(item.day), value: item.accounts })));
    }).catch(() => {
      if (epoch !== metricEpoch) return;
      by('reg-total').textContent = '—'; by('reg-figure').hidden = true;
      status('reg-status','Kayıt ölçümü alınamadı.',true);
    }),
    read('/api/admin/ops/fleet').then(d => {
      if (epoch !== metricEpoch) return;
      if (d.store !== 'connected' || !d.fleet?.history?.length) {
        by('http-total').textContent = '—'; by('http-figure').hidden = true;
        status('http-status', d.store === 'unconfigured' ? 'Dağıtık trafik ölçümü yapılandırılmadı.' : 'Trafik verisi alınamadı.', d.store !== 'unconfigured');
        return;
      }
      const history = d.fleet.history;
      by('http-total').textContent = num(history.reduce((total, item) => total + item.requests, 0));
      status('http-status', 'Ölçülen uygulama istekleri · Tekil ziyaretçi değil');
      bars('http', history.map(item => ({ label: hour.format(new Date(item.at)), value: item.requests })));
    }).catch(() => {
      if (epoch !== metricEpoch) return;
      by('http-total').textContent = '—'; by('http-figure').hidden = true;
      status('http-status','Trafik verisi alınamadı.',true);
    })
  ]);
}
let page = 1, hasNext = false, listEpoch = 0, selection = {q:'',filter:'all',sort:'newest'};
async function loadList(target) {
  const epoch = ++listEpoch;
  status('list-status','Hesaplar yükleniyor.');
  by('account-prev').disabled = by('account-next').disabled = true;
  try {
    const params = new URLSearchParams({...selection,page:String(target)});
    const d = await read(api+'?'+params);
    if (epoch !== listEpoch) return;
    page = d.page; hasNext = d.hasNext;
    by('account-rows').replaceChildren();
    for (const a of d.accounts) {
      const tr = by('account-rows').insertRow();
      const main = tr.insertCell();
      main.append(el('strong',a.displayName),el('span','@'+a.username,'account-sub'));
      if (a.hasPremiumPass) main.append(el('span','Premium Pass','account-sub account-type'));
      for (const value of [date(a.createdAt),num(a.level),num(a.totalMatches)]) tr.insertCell().textContent = value;
      const b = el('button','Ayrıntı');
      b.type = 'button'; b.setAttribute('aria-label', a.displayName+' hesabı: Ayrıntı');
      b.addEventListener('click',() => openDetail(a.id)); tr.insertCell().append(b);
    }
    by('account-page').textContent = 'Sayfa '+page;
    status('list-status', d.accounts.length ? num(d.accounts.length)+' hesap gösteriliyor.' : 'Bu aramada hesap bulunamadı.');
    by('account-prev').disabled = page <= 1; by('account-next').disabled = !hasNext;
  } catch (error) {
    if (epoch !== listEpoch) return;
    by('account-rows').replaceChildren();
    by('account-page').textContent = '—';
    status('list-status',error.message || 'Hesaplar alınamadı.',true);
  }
}
function applyFilters() {
  selection = {q:by('account-query').value.trim(),filter:by('account-filter').value,sort:by('account-sort').value};
  page = 1; hasNext = false; loadList(1);
}
by('accounts-filter').addEventListener('submit', e => { e.preventDefault(); applyFilters(); });
by('account-filter').addEventListener('change', applyFilters);
by('account-sort').addEventListener('change', applyFilters);
by('accounts-refresh').addEventListener('click', () => { loadList(page); refreshMetrics(); });
by('account-prev').addEventListener('click', () => { if (page > 1) loadList(page-1); });
by('account-next').addEventListener('click', () => { if (hasNext) loadList(page+1); });
const dialog = by('account-detail');
let current, selectedId, detailEpoch = 0, draft, saving = false;
function resetConfirm() {
  draft = undefined; by('edit-fields').disabled = false; by('edit-confirm').hidden = true;
}
async function loadDetail(id, message) {
  const epoch = ++detailEpoch;
  resetConfirm(); current = undefined;
  by('detail-heading').textContent = 'Hesap ayrıntısı'; by('detail-content').hidden = true;
  status('detail-status','Hesap bilgisi yükleniyor.');
  try {
    const {account:a} = await read(api+'/'+encodeURIComponent(id));
    if (epoch !== detailEpoch) return;
    current = a;
    by('detail-content').hidden = false;
    by('detail-heading').textContent = a.displayName;
    by('detail-id').textContent = '@'+a.username+' · '+a.id;
    const facts = [
      ['Kayıt',date(a.createdAt)], ['Seviye / XP',num(a.level)+' / '+num(a.xp)], ['Lig puanı',num(a.rankPoints)],
      ['Maç / galibiyet',num(a.totalMatches)+' / '+num(a.wins)], ['Altın / elmas',num(a.coins)+' / '+num(a.gems)],
      ['Premium Pass',a.hasPremiumPass?'Var':'Yok'], ['Envanter kalemi',num(a._count.inventoryItems)],
      ['Bildirim kaydı',num(a._count.pushTokens)], ['Avatar',({default:'Varsayılan',custom:'Özel',unset:'Belirtilmemiş'})[a.avatarState] || '—']
    ];
    by('detail-facts').replaceChildren(...facts.map(([label,value]) => {
      const node = el('div'); node.append(el('dt',label),el('dd',value)); return node;
    }));
    by('match-list').replaceChildren(...(a.matches.length ? a.matches.map(m => el('li',date(m.playedAt)+' · '+m.mode+' · '+num(m.score)+' puan')) : [el('li','Kayıtlı maç yok.')]));
    by('profile-edit').reset(); by('edit-name').value = a.displayName;
    by('edit-avatar').disabled = a.avatarState === 'default';
    status('detail-status',message || '');
  } catch (error) { if (epoch === detailEpoch) status('detail-status',error.message,true); }
}
function openDetail(id) {
  selectedId = id;
  by('edit-section').open = by('match-section').open = false;
  dialog.showModal(); loadDetail(id);
}
by('detail-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('cancel',e => { if (saving) e.preventDefault(); });
dialog.addEventListener('close',() => { ++detailEpoch; current = selectedId = undefined; resetConfirm(); });
by('detail-reload').addEventListener('click', () => { if (selectedId && !saving) loadDetail(selectedId); });
by('copy-id').addEventListener('click', async () => {
  if (!current) return;
  try { await navigator.clipboard.writeText(current.id); status('detail-status','Hesap ID panoya kopyalandı.'); }
  catch { status('detail-status','Pano erişimi yok; hesap ID’yi yukarıdan seçip kopyalayın.',true); }
});
by('profile-edit').addEventListener('submit', e => {
  e.preventDefault();
  if (!current || saving || draft) return;
  const name = by('edit-name').value.trim().normalize('NFC');
  const resetAvatar = by('edit-avatar').checked;
  if (name !== current.displayName && !/^[\p{L}\p{N}][\p{L}\p{M}\p{N} ._'’-]{1,39}$/u.test(name)) {
    status('detail-status','Ad 2–40 karakter olmalı. Harf, sayı ve yaygın ad noktalaması kullanın.',true); return;
  }
  if (name === current.displayName && !resetAvatar) { status('detail-status','Kaydedilecek değişiklik yok.',true); return; }
  const changes = [];
  draft = {reason:by('edit-reason').value,expectedUpdatedAt:current.updatedAt};
  if (name !== current.displayName) { draft.displayName = name; changes.push('Görünür ad: '+current.displayName+' → '+name); }
  if (resetAvatar) { draft.resetAvatar = true; changes.push('Avatar: varsayılan'); }
  by('edit-summary').textContent = changes.join(' · ');
  by('edit-fields').disabled = true; by('edit-confirm').hidden = false;
  status('detail-status','Değişikliği gözden geçirin.'); by('edit-save').focus();
});
by('edit-cancel').addEventListener('click', () => { resetConfirm(); status('detail-status','Değişiklik kaydedilmedi.'); by('edit-name').focus(); });
by('edit-save').addEventListener('click',async () => {
  if (!current || !draft || saving) return;
  const id = current.id;
  saving = true;
  for (const key of ['edit-save','edit-cancel','detail-close','detail-reload']) by(key).disabled = true;
  try {
    await read(api+'/'+encodeURIComponent(id)+'/profile',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(draft)});
    await Promise.all([loadDetail(id,'Profil değişikliği kaydedildi.'),loadList(page)]);
  } catch(error) {
    resetConfirm(); status('detail-status',error.message || 'İşlem sonucu doğrulanamadı.',true);
  } finally {
    saving = false; for (const key of ['edit-save','edit-cancel','detail-close','detail-reload']) by(key).disabled = false;
  }
});
refreshMetrics(); loadList(1);
`;
