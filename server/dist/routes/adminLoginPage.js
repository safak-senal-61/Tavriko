"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeNextPath = sanitizeNextPath;
exports.renderAdminLoginHtml = renderAdminLoginHtml;
const adminShell_1 = require("./adminShell");
/**
 * Yönetici paneli giriş sayfası (/admin/login).
 *
 * Eskiden panel tarayıcının yerel "HTTP Basic" şifre penceresiyle korunuyordu.
 * Bu pencere Vercel'de sayfa yenilendikçe ve arka plan istekleri (log akışı,
 * istatistik yenileme) 401 aldıkça tekrar tekrar açılıyordu. Artık giriş bu
 * sayfadan yapılır ve oturum 7 gün geçerli HttpOnly bir çerezde tutulur.
 */
/** Yalnızca site içi göreli yönlendirmelere izin verir (açık yönlendirme koruması). */
function sanitizeNextPath(raw) {
    if (typeof raw !== 'string' || /[\\\u0000-\u001f\u007f]/u.test(raw))
        return '/admin';
    if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\'))
        return '/admin';
    if (raw.startsWith('/admin/login'))
        return '/admin';
    return raw;
}
function renderAdminLoginHtml(nextPath, configured) {
    // JSON gömülürken </script> kaçışını engellemek için < karakteri kaçırılır.
    const nextJson = JSON.stringify(nextPath).replace(/</g, '\\u003c');
    return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Tavriko Yönetici Girişi</title>
  <style>
    ${adminShell_1.adminTheme}
    body {
      margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
      padding: var(--admin-pad);
    }
    .card {
      width: 100%; max-width: 440px; background: var(--card); border: 1px solid var(--line);
      border-radius: 12px; padding: clamp(18px,6vw,32px); box-shadow: 0 18px 48px rgba(0,0,0,.24);
    }
    h1 { margin: 4px 0 6px; font-size: clamp(26px,6vw,34px); line-height:1.15; letter-spacing:-.035em; }
    p.sub { margin: 0 0 24px; color: var(--muted); font-size: 14px; line-height: 1.5; }
    label { display: block; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; color: var(--muted); margin: 14px 0 6px; }
    input {
      width: 100%; padding: 13px 14px; border-radius: 8px; border: 1px solid var(--line);
      background: #101725; color: var(--text); font: inherit;
    }
    input:focus { border-color: var(--gold); }
    button {
      width: 100%; margin-top: 22px; padding: 14px; border: 0; border-radius: 8px; cursor: pointer;
      font-weight: 750; font-size: 15px; color: #1c160d; background: var(--gold);
    }
    button:disabled { opacity: 0.6; cursor: wait; }
    .err { display: none; margin-top: 16px; padding: 12px; border-radius: 10px; background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.4); color: #FECACA; font-size: 14px; }
    .note { margin-top: 18px; font-size: 12px; color: var(--muted); text-align: center; }
  </style>
</head>
<body>
  <main class="card">
    <div class="admin-kicker">TAVRİKO / YÖNETİM</div>
    <h1>Yönetici Girişi</h1>
    <p class="sub">${configured ? 'Devam etmek için yönetici e-posta adresi ve şifresiyle giriş yapın. Oturumunuz bu cihazda 7 gün açık kalır.' : 'Yönetici girişi yapılandırılmamış. PORTAL_ADMIN_EMAIL, PORTAL_ADMIN_PASSWORD ve JWT_SECRET ortam değişkenlerini tanımlayın.'}</p>
    <form id="loginForm" autocomplete="on">
      <label for="email">E-POSTA</label>
      <input id="email" name="email" type="email" autocomplete="username" required />
      <label for="password">ŞİFRE</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required />
      <button id="submitBtn" type="submit"${configured ? '' : ' disabled'}>Giriş Yap</button>
      <div id="err" class="err" role="alert"></div>
    </form>
    <p class="note">Bu sayfa yalnızca yetkili yöneticiler içindir.</p>
  </main>
  <script>
    const NEXT = ${nextJson};
    const form = document.getElementById('loginForm');
    const btn = document.getElementById('submitBtn');
    const err = document.getElementById('err');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.style.display = 'none';
      btn.disabled = true;
      btn.textContent = 'Kontrol ediliyor...';
      try {
        const res = await fetch('/api/portal/login', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: document.getElementById('email').value.trim(),
            password: document.getElementById('password').value,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          try { localStorage.removeItem('tavriko_portal_token'); } catch {}
          const oldTab = NEXT === '/admin' && /^#tab-(?:game|expo|cos|api|logs|db|mod|push)$/.test(location.hash) ? location.hash : '';
          window.location.replace(data.role === 'owner' ? NEXT + oldTab : '/admin/kullanicilar');
          return;
        }
        err.textContent = res.status === 429 ? 'Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.' : (data.error || 'Hatalı e-posta veya şifre.');
        err.style.display = 'block';
      } catch (ex) {
        err.textContent = 'Bağlantı hatası. Lütfen tekrar deneyin.';
        err.style.display = 'block';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Giriş Yap';
      }
    });
  </script>
</body>
</html>`;
}
