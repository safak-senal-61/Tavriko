import { Router, Request, Response } from 'express';
import { LEGAL_DOCUMENTS, LEGAL_OPERATOR, LEGAL_VERSION, getLegalDocument, LegalDocument } from '@trivia/shared';

/**
 * Herkese açık yasal metin sayfaları.
 *   GET /legal              -> tüm metinlerin listesi
 *   GET /legal/:id          -> tek metin (terms, privacy, kvkk, cookies, purchases, community)
 *   GET /api/legal          -> JSON (sürüm + metinler)
 *
 * Bu adresler Google OAuth onay ekranı ve uygulama mağazaları için gizlilik politikası
 * / kullanım koşulları bağlantısı olarak da kullanılabilir.
 */
export const legalRouter = Router();

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const formatVersionDate = (version: string) => {
  const [y, m, d] = version.split('-');
  return y && m && d ? `${d}.${m}.${y}` : version;
};

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} | ${escapeHtml(LEGAL_OPERATOR.appName)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0B0818; color: #EDE9FE; line-height: 1.65; }
    header { padding: 20px; border-bottom: 1px solid rgba(167, 139, 250, 0.2); background: #120A2A; }
    header a { color: #FFD66B; text-decoration: none; font-weight: 800; }
    main { max-width: 820px; margin: 0 auto; padding: 28px 20px 64px; }
    h1 { font-size: 26px; line-height: 1.3; margin: 0 0 6px; color: #FFFFFF; }
    h2 { font-size: 18px; margin: 28px 0 8px; color: #FFFFFF; }
    p { margin: 0 0 12px; color: #D6CCF5; }
    .meta { color: #A99BD6; font-size: 14px; margin-bottom: 24px; }
    .list a { display: block; padding: 16px 18px; margin-bottom: 12px; border-radius: 14px; text-decoration: none;
      background: rgba(39, 23, 82, 0.7); border: 1px solid rgba(167, 139, 250, 0.22); color: #FFFFFF; }
    .list a span { display: block; color: #BFB3E0; font-size: 14px; margin-top: 4px; }
    .back { display: inline-block; margin-top: 32px; color: #C4B5FD; }
  </style>
</head>
<body>
  <header><a href="/legal">${escapeHtml(LEGAL_OPERATOR.appName)} · Yasal Metinler</a></header>
  <main>${body}</main>
</body>
</html>`;
}

function renderDocument(doc: LegalDocument): string {
  const sections = doc.sections
    .map(
      (sec) =>
        `<h2>${escapeHtml(sec.heading)}</h2>` + sec.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('')
    )
    .join('');
  return layout(
    doc.title,
    `<h1>${escapeHtml(doc.title)}</h1>
     <div class="meta">Yürürlük / son güncelleme: ${formatVersionDate(LEGAL_VERSION)}</div>
     ${sections}
     <a class="back" href="/legal">← Tüm yasal metinler</a>`
  );
}

legalRouter.get('/api/legal', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({ version: LEGAL_VERSION, operator: LEGAL_OPERATOR, documents: LEGAL_DOCUMENTS });
});

legalRouter.get(['/legal', '/yasal', '/sozlesmeler'], (_req: Request, res: Response) => {
  const items = LEGAL_DOCUMENTS.map(
    (d) => `<a href="/legal/${d.id}">${escapeHtml(d.title)}<span>${escapeHtml(d.summary)}</span></a>`
  ).join('');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.send(
    layout(
      'Yasal Metinler',
      `<h1>Yasal Metinler</h1><div class="meta">Sürüm: ${formatVersionDate(LEGAL_VERSION)}</div><div class="list">${items}</div>`
    )
  );
});

legalRouter.get('/legal/:id', (req: Request, res: Response, next) => {
  const doc = getLegalDocument(String(req.params.id || ''));
  if (!doc) {
    next();
    return;
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.send(renderDocument(doc));
});

/* Türkçe, akılda kalıcı adresler (KVKK/mağaza formlarında kullanılır):
     /aydinlatma-metni    -> KVKK aydınlatma metni
     /gizlilik-politikasi -> gizlilik politikası
     /kullanim-kosullari  -> kullanıcı sözleşmesi
     /satis-sozlesmesi    -> satın alma ve iade koşulları
     /cerez-politikasi    -> çerez politikası
     /topluluk-kurallari  -> topluluk kuralları */
const TR_SLUGS: Record<string, string> = {
  'aydinlatma-metni': 'kvkk',
  'gizlilik-politikasi': 'privacy',
  'kullanim-kosullari': 'terms',
  'satis-sozlesmesi': 'purchases',
  'cerez-politikasi': 'cookies',
  'topluluk-kurallari': 'community',
};

Object.entries(TR_SLUGS).forEach(([slug, id]) => {
  legalRouter.get(`/${slug}`, (_req: Request, res: Response) => {
    const doc = getLegalDocument(id);
    if (!doc) {
      res.status(404).type('text/plain').send('Bulunamadı');
      return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(renderDocument(doc));
  });
});

/* ---------------------------------------------------------------------------
 * KVKK: /remove-account — kullanıcının tüm verilerini web'den silebildiği
 * sayfa. E-posta + doğrulama kodu akışı /api/auth/request-delete-code ve
 * /api/auth/confirm-delete uç noktalarını kullanır.
 * ------------------------------------------------------------------------- */
legalRouter.get('/remove-account', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(renderRemoveAccountPage());
});

function renderRemoveAccountPage(): string {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Hesabımı Sil | ${escapeHtml(LEGAL_OPERATOR.appName)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0B0818; color: #EDE9FE; line-height: 1.65; min-height: 100vh; }
    header { padding: 20px; border-bottom: 1px solid rgba(167, 139, 250, 0.2); background: #120A2A; }
    header a { color: #FFD66B; text-decoration: none; font-weight: 800; }
    main { max-width: 560px; margin: 0 auto; padding: 28px 20px 64px; }
    h1 { font-size: 24px; line-height: 1.3; margin: 0 0 6px; color: #FFFFFF; }
    p { color: #D6CCF5; }
    .warn { background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35);
      border-radius: 14px; padding: 14px 16px; margin: 18px 0; color: #FCA5A5; font-size: 14px; }
    label { display: block; color: #BFB3E0; font-size: 13px; margin: 16px 0 6px; font-weight: 700; }
    input { width: 100%; padding: 13px 16px; border-radius: 12px; border: 1px solid rgba(167,139,250,.3);
      background: #1A1233; color: #FFFFFF; font-size: 16px; outline: none; }
    input:focus { border-color: #FFD66B; }
    button { width: 100%; margin-top: 18px; padding: 15px; border: none; border-radius: 12px;
      background: linear-gradient(135deg, #FFD66B, #F59E0B); color: #281543; font-size: 15px;
      font-weight: 800; cursor: pointer; }
    button:disabled { opacity: .55; cursor: default; }
    button.danger { background: linear-gradient(135deg, #F87171, #DC2626); color: #FFF; }
    .msg { margin-top: 14px; padding: 12px 14px; border-radius: 12px; font-size: 14px; display: none; }
    .msg.ok { background: rgba(63,208,138,.12); border: 1px solid rgba(63,208,138,.35); color: #86EFAC; }
    .msg.err { background: rgba(239,68,68,.12); border: 1px solid rgba(239,68,68,.35); color: #FCA5A5; }
    .codebox { margin-top: 14px; padding: 14px 16px; border-radius: 12px; text-align: center;
      background: rgba(255,214,107,.08); border: 1px dashed rgba(255,214,107,.4); display: none; }
    .codebox b { font-size: 26px; letter-spacing: 6px; color: #FFD66B; }
    .links { margin-top: 26px; font-size: 13px; color: #8F84B0; }
    .links a { color: #C4B5FD; }
  </style>
</head>
<body>
  <header><a href="/legal">${escapeHtml(LEGAL_OPERATOR.appName)} · Yasal</a></header>
  <main>
    <h1>Hesabımı ve Tüm Verilerimi Sil</h1>
    <p>KVKK kapsamında, hesabınızı ve tüm oyun verilerinizi (profil, altın, elmas, rozetler, maç geçmişi, arkadaş listesi ve envanter) kalıcı olarak silebilirsiniz. Bu işlem geri alınamaz.</p>
    <div class="warn">⚠ Bu işlem geri alınamaz. Hesabınızı tekrar oluşturursanız sıfırdan başlarsınız.</div>

    <form id="f" onsubmit="return false;">
      <label for="email">Kayıtlı e-posta adresiniz</label>
      <input id="email" type="email" autocomplete="email" placeholder="ornek@gmail.com" required />

      <div id="step1btns">
        <button id="btnCode" type="button">Doğrulama Kodu Oluştur</button>
      </div>

      <div id="step2" style="display:none">
        <label for="code">6 haneli doğrulama kodu</label>
        <input id="code" type="text" inputmode="numeric" maxlength="6" placeholder="______" />
        <button id="btnDelete" class="danger" type="button">Hesabımı Kalıcı Olarak Sil</button>
      </div>
    </form>

    <div class="codebox" id="codebox">Doğrulama kodunuz: <b id="codeval"></b><br /><small>15 dakika geçerlidir</small></div>
    <div class="msg" id="msg"></div>

    <div class="links">
      İlgili metinler: <a href="/aydinlatma-metni">Aydınlatma Metni</a> ·
      <a href="/gizlilik-politikasi">Gizlilik Politikası</a> ·
      <a href="/kullanim-kosullari">Kullanım Koşulları</a> ·
      <a href="/satis-sozlesmesi">Satış Sözleşmesi</a>
    </div>
  </main>
  <script>
    var emailInput = document.getElementById('email');
    var codeInput = document.getElementById('code');
    var msg = document.getElementById('msg');
    function showMsg(text, ok) {
      msg.textContent = text;
      msg.className = 'msg ' + (ok ? 'ok' : 'err');
      msg.style.display = 'block';
    }
    document.getElementById('btnCode').onclick = function () {
      var email = emailInput.value.trim();
      if (!email || email.indexOf('@') < 0) { showMsg('Geçerli bir e-posta adresi girin.', false); return; }
      this.disabled = true; this.textContent = 'Oluşturuluyor...';
      fetch('/api/auth/request-delete-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email })
      }).then(function (r) { return r.json(); }).then(function (d) {
        document.getElementById('btnCode').disabled = false;
        document.getElementById('btnCode').textContent = 'Doğrulama Kodu Oluştur';
        if (d && d.code) {
          document.getElementById('codebox').style.display = 'block';
          document.getElementById('codeval').textContent = d.code;
          document.getElementById('step2').style.display = 'block';
          showMsg(d.message || 'Kodunuz oluşturuldu.', true);
        } else {
          showMsg((d && d.message) || 'Kod oluşturulamadı.', false);
        }
      }).catch(function () {
        document.getElementById('btnCode').disabled = false;
        document.getElementById('btnCode').textContent = 'Doğrulama Kodu Oluştur';
        showMsg('Sunucuya ulaşılamadı, tekrar deneyin.', false);
      });
    };
    document.getElementById('btnDelete').onclick = function () {
      var email = emailInput.value.trim();
      var code = codeInput.value.trim();
      if (code.length !== 6) { showMsg('6 haneli doğrulama kodunu girin.', false); return; }
      if (!confirm('Hesabınız ve TÜM verileriniz kalıcı olarak silinecek. Emin misiniz?')) return;
      this.disabled = true; this.textContent = 'Siliniyor...';
      fetch('/api/auth/confirm-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, code: code })
      }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); }).then(function (r) {
        if (r.ok && r.d && r.d.success) {
          document.getElementById('f').style.display = 'none';
          document.getElementById('codebox').style.display = 'none';
          showMsg('Hesabınız ve tüm verileriniz kalıcı olarak silindi. Aynı hesapla tekrar giriş yaparsanız sıfırdan başlarsınız.', true);
        } else {
          document.getElementById('btnDelete').disabled = false;
          document.getElementById('btnDelete').textContent = 'Hesabımı Kalıcı Olarak Sil';
          showMsg((r.d && r.d.message) || 'Silme işlemi başarısız.', false);
        }
      }).catch(function () {
        document.getElementById('btnDelete').disabled = false;
        document.getElementById('btnDelete').textContent = 'Hesabımı Kalıcı Olarak Sil';
        showMsg('Sunucuya ulaşılamadı, tekrar deneyin.', false);
      });
    };
  </script>
</body>
</html>`;
}
