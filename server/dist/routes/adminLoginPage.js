"use strict";
/**
 * Yönetici paneli giriş sayfası (/admin/login).
 *
 * Eskiden panel tarayıcının yerel "HTTP Basic" şifre penceresiyle korunuyordu.
 * Bu pencere Vercel'de sayfa yenilendikçe ve arka plan istekleri (log akışı,
 * istatistik yenileme) 401 aldıkça tekrar tekrar açılıyordu. Artık giriş bu
 * sayfadan yapılır ve oturum 7 gün geçerli HttpOnly bir çerezde tutulur.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeNextPath = sanitizeNextPath;
exports.renderAdminLoginHtml = renderAdminLoginHtml;
/** Yalnızca site içi göreli yönlendirmelere izin verir (açık yönlendirme koruması). */
function sanitizeNextPath(raw) {
    if (typeof raw !== 'string')
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
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: radial-gradient(circle at 20% 10%, #2A1060 0%, #0B0818 55%); color: #F4F0FF; padding: 20px;
    }
    .card {
      width: 100%; max-width: 400px; background: rgba(24, 14, 52, 0.92); border: 1px solid rgba(167, 139, 250, 0.25);
      border-radius: 20px; padding: 32px 28px; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
    }
    h1 { margin: 0 0 6px; font-size: 22px; }
    p.sub { margin: 0 0 24px; color: #BFB3E0; font-size: 14px; line-height: 1.5; }
    label { display: block; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; color: #C4B5FD; margin: 14px 0 6px; }
    input {
      width: 100%; padding: 13px 14px; border-radius: 12px; border: 1px solid rgba(167, 139, 250, 0.35);
      background: #120A2A; color: #FFFFFF; font-size: 15px; outline: none;
    }
    input:focus { border-color: #A78BFA; box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.25); }
    button {
      width: 100%; margin-top: 22px; padding: 14px; border: 0; border-radius: 12px; cursor: pointer;
      font-weight: 800; font-size: 15px; color: #12052C; background: linear-gradient(135deg, #FFD66B, #F5A623);
    }
    button:disabled { opacity: 0.6; cursor: wait; }
    .err { display: none; margin-top: 16px; padding: 12px; border-radius: 10px; background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.4); color: #FECACA; font-size: 14px; }
    .note { margin-top: 18px; font-size: 12px; color: #9C8FC4; text-align: center; }
  </style>
</head>
<body>
  <main class="card">
    <h1>Tavriko Yönetici Paneli</h1>
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
          if (data.token) localStorage.setItem('tavriko_portal_token', data.token);
          window.location.replace(NEXT);
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
