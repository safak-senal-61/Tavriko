"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminSessionScript = exports.adminTheme = exports.adminPageHeaders = exports.dashboardPages = exports.adminPages = void 0;
exports.renderAdminHeader = renderAdminHeader;
exports.renderAdminHero = renderAdminHero;
exports.adminPages = [
    { id: 'overview', path: '/admin', label: 'Genel Bakış', group: 'Yönetim', description: 'Tavriko yönetim araçlarına ve son sistem ölçümlerine tek yerden ulaşın.' },
    { id: 'game', path: '/admin/oyun', label: 'Oyun Simülatörü', group: 'Oyun ve içerik', description: 'Tavriko web oyununu mobil boyutlarda test edin.' },
    { id: 'expo', path: '/admin/mobil', label: 'Mobil ve QR', group: 'Oyun ve içerik', description: 'Oyunu telefona açmak için QR kodu veya web bağlantısını kullanın.' },
    { id: 'cos', path: '/admin/kozmetikler', label: 'Kozmetikler', group: 'Oyun ve içerik', description: 'Profil çerçevelerini, renkleri ve animasyonları önizleyin.' },
    { id: 'api', path: '/admin/api', label: 'API Araçları', group: 'Operasyon', description: 'API belgelerini inceleyin ve uç noktaları test edin.' },
    { id: 'logs', path: '/admin/loglar', label: 'Canlı Loglar', group: 'Operasyon', description: 'Sunucu kayıtlarını filtreleyin ve hata ayrıntılarını inceleyin.' },
    { id: 'db', path: '/admin/kullanicilar', label: 'Kullanıcılar', group: 'Topluluk', description: 'Veritabanındaki en yeni kullanıcı kayıtlarını inceleyin.' },
    { id: 'mod', path: '/admin/moderasyon', label: 'Moderasyon', group: 'Topluluk', description: 'Kullanıcı engellerini ve moderasyon bildirimlerini yönetin.' },
    { id: 'push', path: '/admin/bildirimler', label: 'Bildirimler', group: 'Topluluk', description: 'Kayıtlı cihazları, bildirim testlerini ve duyuruları yönetin.' },
    { id: 'telegram', path: '/admin/telegram', label: 'Telegram', group: 'Oyun ve içerik', description: 'Onay botunu ve soru havuzu araçlarını yönetin.' },
    { id: 'health', path: '/admin/health', label: 'Site Sağlığı', group: 'Operasyon', description: 'Sunucu kaynaklarını, servis kontrollerini ve Polar Sandbox’ı izleyin.' },
];
exports.dashboardPages = exports.adminPages.filter(p => p.id !== 'health' && p.id !== 'telegram');
const adminPageHeaders = (_req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' });
    next();
};
exports.adminPageHeaders = adminPageHeaders;
exports.adminTheme = `
:root{color-scheme:dark;--bg:#0b101a;--card:#141c2a;--line:#2b384d;--card-border:var(--line);--card-hover:#1c283a;--text:#f1f4f9;--muted:#a4b2c8;--text-muted:var(--muted);--gold:#f3cc76;--gold-dark:#9d7b40;--purple:#628fd1;--purple-light:#a8c6f4;--cyan:#8fb9ed;--green:#84dfb7;--red:#ffaaa3;--amber:#f3cc76;--admin-max:1120px;--admin-pad:24px}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:radial-gradient(ellipse at top right,#1b253b,transparent 45%),var(--bg);color:var(--text);font:15px/1.5 system-ui,sans-serif}
a{color:var(--gold)} :focus-visible{outline:2px solid var(--gold);outline-offset:3px}
.admin-wrap{max-width:var(--admin-max);width:100%;margin-inline:auto;padding-inline:var(--admin-pad)}
.admin-header{position:static;display:block;padding:0;background:#101725;border-bottom:1px solid var(--line);backdrop-filter:none}
.admin-top{display:flex;min-height:60px;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding-block:8px}
.admin-brand,.admin-kicker{color:var(--gold);font-size:12px;font-weight:750;letter-spacing:.12em}
.admin-brand{text-decoration:none;display:inline-flex;align-items:center;gap:9px}
.admin-brand span{border:1px solid var(--line);border-radius:5px;display:grid;place-items:center;width:26px;height:26px;letter-spacing:0;background:var(--card)}
.admin-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
a.admin-command,button.admin-command{width:auto;display:inline-flex;align-items:center;justify-content:center;min-height:36px;padding:6px 11px;background:var(--card-hover);color:var(--text);border:1px solid var(--line);border-radius:8px;font:650 13px system-ui,sans-serif;cursor:pointer;text-decoration:none;white-space:nowrap}
.admin-command:hover,.admin-nav a:hover{border-color:var(--gold);color:var(--gold)}
.admin-nav{display:flex;align-items:stretch;gap:5px;flex-wrap:wrap;padding-bottom:11px;min-height:0;max-width:var(--admin-max)}
.admin-nav a{display:flex;align-items:center;justify-content:center;text-align:center;min-height:37px;padding:5px 6px;color:var(--muted);text-decoration:none;border:1px solid var(--line);border-radius:7px;font-size:13px;font-weight:650;line-height:1.2}
.admin-nav a[aria-current=page]{color:var(--gold);background:#2b271f;border-color:#806943}
.admin-hero{padding:32px 0 20px}
.admin-hero h1{margin:2px 0 0;color:var(--text);font-size:clamp(34px,6vw,52px);line-height:1.15;letter-spacing:-.04em;font-weight:750}
.admin-hero p{margin:6px 0 0;color:var(--muted)}
.admin-skip{position:absolute;top:6px;left:6px;z-index:150;padding:8px;background:var(--card);transform:translateY(-150%)}
.admin-skip:focus{transform:none}
@media(max-width:700px){.admin-nav{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}.admin-nav a{min-height:42px}}
@media(max-width:420px){:root{--admin-pad:12px}.admin-hero{padding-top:24px}.admin-top{min-height:54px}.admin-nav a{font-size:12px;padding-inline:4px}}
`;
function renderAdminHeader(active) {
    return `<a class="admin-skip" href="#admin-main">İçeriğe geç</a>
<header class="admin-header"><div class="admin-wrap admin-top">
<a class="admin-brand" href="/admin"><span aria-hidden="true">T</span>TAVRİKO / YÖNETİM</a>
<div class="admin-actions"><a class="admin-command" href="/app" target="_blank" rel="noopener">Oyunu aç</a><button class="admin-command" type="button" id="admin-logout">Çıkış</button></div>
</div><nav class="admin-wrap admin-nav" aria-label="Yönetim bölümleri">
${exports.adminPages.map(p => `<a href="${p.path}"${p.id === active ? ' aria-current="page"' : ''}>${p.label}</a>`).join('')}
</nav></header>`;
}
exports.adminSessionScript = `<script>
document.getElementById('admin-logout')?.addEventListener('click', async function() {
  this.disabled = true;
  try {
    const res = await fetch('/api/portal/logout',{method:'POST',credentials:'same-origin'});
    if (!res.ok) throw new Error('logout');
    try { localStorage.removeItem('tavriko_portal_token'); } catch {}
    location.replace('/admin/login');
  } catch {
    this.disabled = false;
    this.textContent = 'Çıkış tekrar dene';
  }
});
</script>`;
function renderAdminHero(page) {
    return `<div class="admin-hero"><div class="admin-kicker">${page.group.toLocaleUpperCase('tr-TR')}</div><h1>${page.label}</h1><p>${page.description}</p></div>`;
}
