"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.legalRouter = void 0;
const express_1 = require("express");
const shared_1 = require("@trivia/shared");
/**
 * Herkese açık yasal metin sayfaları.
 *   GET /legal              -> tüm metinlerin listesi
 *   GET /legal/:id          -> tek metin (terms, privacy, kvkk, cookies, purchases, community)
 *   GET /api/legal          -> JSON (sürüm + metinler)
 *
 * Bu adresler Google OAuth onay ekranı ve uygulama mağazaları için gizlilik politikası
 * / kullanım koşulları bağlantısı olarak da kullanılabilir.
 */
exports.legalRouter = (0, express_1.Router)();
const escapeHtml = (value) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const formatVersionDate = (version) => {
    const [y, m, d] = version.split('-');
    return y && m && d ? `${d}.${m}.${y}` : version;
};
function layout(title, body) {
    return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} | ${escapeHtml(shared_1.LEGAL_OPERATOR.appName)}</title>
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
  <header><a href="/legal">${escapeHtml(shared_1.LEGAL_OPERATOR.appName)} · Yasal Metinler</a></header>
  <main>${body}</main>
</body>
</html>`;
}
function renderDocument(doc) {
    const sections = doc.sections
        .map((sec) => `<h2>${escapeHtml(sec.heading)}</h2>` + sec.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join(''))
        .join('');
    return layout(doc.title, `<h1>${escapeHtml(doc.title)}</h1>
     <div class="meta">Yürürlük / son güncelleme: ${formatVersionDate(shared_1.LEGAL_VERSION)}</div>
     ${sections}
     <a class="back" href="/legal">← Tüm yasal metinler</a>`);
}
exports.legalRouter.get('/api/legal', (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({ version: shared_1.LEGAL_VERSION, operator: shared_1.LEGAL_OPERATOR, documents: shared_1.LEGAL_DOCUMENTS });
});
exports.legalRouter.get(['/legal', '/yasal', '/sozlesmeler'], (_req, res) => {
    const items = shared_1.LEGAL_DOCUMENTS.map((d) => `<a href="/legal/${d.id}">${escapeHtml(d.title)}<span>${escapeHtml(d.summary)}</span></a>`).join('');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(layout('Yasal Metinler', `<h1>Yasal Metinler</h1><div class="meta">Sürüm: ${formatVersionDate(shared_1.LEGAL_VERSION)}</div><div class="list">${items}<a href="/remove-account">Hesap silme<span>Kayıtlı e-posta adresinizi doğrulayarak hesabınızı kalıcı olarak silin.</span></a></div>`));
});
exports.legalRouter.get('/legal/:id', (req, res, next) => {
    const doc = (0, shared_1.getLegalDocument)(String(req.params.id || ''));
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
const TR_SLUGS = {
    'aydinlatma-metni': 'kvkk',
    'gizlilik-politikasi': 'privacy',
    'kullanim-kosullari': 'terms',
    'satis-sozlesmesi': 'purchases',
    'cerez-politikasi': 'cookies',
    'topluluk-kurallari': 'community',
};
Object.entries(TR_SLUGS).forEach(([slug, id]) => {
    exports.legalRouter.get(`/${slug}`, (_req, res) => {
        const doc = (0, shared_1.getLegalDocument)(id);
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
exports.legalRouter.get('/remove-account', (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.send(renderRemoveAccountPage());
});
function renderRemoveAccountPage() {
    return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#160b2b" />
  <title>Hesabımı Sil | ${escapeHtml(shared_1.LEGAL_OPERATOR.appName)}</title>
  <style>
    :root { color-scheme: dark; --bg: #12091f; --surface: #201338; --field: #150c25; --border: #604986;
      --ink: #fcf7ff; --muted: #d8cbed; --gold: #ffd76e; --danger: #ffb5c3; --good: #aef0ce;
      --sm: .875rem; --base: 1rem; --lg: clamp(1.65rem, 4vw, 2.4rem); --pad: clamp(1rem, 4vw, 2rem); }
    * { box-sizing: border-box; }
    [hidden] { display: none !important; }
    body { margin: 0; min-height: 100vh; color: var(--ink); background: radial-gradient(ellipse at 12% 5%, #361c5c 0%, transparent 55%), var(--bg);
      font-family: 'Nunito', system-ui, sans-serif; font-size: var(--base); line-height: 1.55; }
    a { color: var(--gold); text-underline-offset: 3px; }
    a:focus-visible, button:focus-visible, input:focus-visible { outline: 2px solid var(--gold); outline-offset: 4px; }
    .bar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; max-width: 1040px; padding: 1rem var(--pad); margin: auto; }
    .brand { display: inline-flex; align-items: center; gap: .6rem; color: var(--ink); text-decoration: none; font-weight: 850; }
    .brand img { width: 32px; height: 32px; border-radius: 8px; }
    .bar > a:last-child { font-size: var(--sm); color: var(--muted); }
    main { width: min(100%, 660px); margin: clamp(.5rem, 5vw, 3rem) auto 0; padding: 0 var(--pad) 2rem; }
    .card { padding: var(--pad); border: 1px solid var(--border); border-radius: 22px; background: var(--surface); box-shadow: 0 20px 72px #07040e85; }
    .heading { margin: 0 0 1.25rem; }
    .kicker { display: flex; align-items: center; gap: .5rem; color: var(--gold); font-size: var(--sm); font-weight: 800; letter-spacing: .05em; }
    .kicker svg { flex: none; }
    h1 { font-size: var(--lg); line-height: 1.15; margin: .65rem 0; letter-spacing: -.025em; }
    p { color: var(--muted); margin: .5rem 0 0; }
    .warn, .msg:not(:empty) { border-radius: 12px; padding: .75rem 1rem; margin: 1rem 0; font-size: var(--sm); }
    .warn, .msg[data-kind="error"]:not(:empty) { color: var(--danger); border: 1px solid #935771; background: #39213c; }
    .msg[data-kind="ok"]:not(:empty) { color: var(--good); border: 1px solid #527967; background: #24343d; }
    .steps { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; list-style: none; padding: 0; margin: 1.25rem 0; }
    .steps li { border-top: 2px solid var(--border); padding-top: .5rem; color: var(--muted); font-size: var(--sm); }
    .steps [aria-current="step"] { border-color: var(--gold); color: var(--gold); font-weight: 800; }
    .steps span { display: inline-block; margin-right: .25rem; }
    label:not(.check) { display: block; margin-bottom: .4rem; font-weight: 750; }
    input:not([type="checkbox"]) { width: 100%; min-height: 48px; padding: .75rem; border: 1px solid var(--border); border-radius: 10px;
      font: inherit; color: var(--ink); background: var(--field); }
    #code { font-family: ui-monospace, monospace; font-weight: 700; letter-spacing: .35em; }
    small, .help { color: var(--muted); font-size: var(--sm); }
    small { display: block; margin: .5rem 0 0; }
    button { min-height: 46px; border: 0; border-radius: 10px; font: inherit; font-weight: 800; cursor: pointer; }
    button:disabled { opacity: .64; cursor: not-allowed; }
    .action { width: 100%; margin-top: 1rem; background: var(--gold); color: #23152a; }
    .action:hover:not(:disabled) { filter: brightness(1.07); }
    .danger { background: var(--danger); }
    .ghost { padding: .25rem .45rem; background: transparent; color: var(--muted); font-size: var(--sm); text-decoration: underline; text-underline-offset: 3px; }
    .tools { display: flex; flex-wrap: wrap; justify-content: space-between; gap: .25rem .75rem; margin: .4rem -.45rem 0; }
    .check { display: flex; align-items: flex-start; gap: .75rem; margin-top: .8rem; color: var(--muted); font-size: var(--sm); }
    .check input { accent-color: var(--gold); width: 18px; height: 18px; flex: none; margin: 3px 0 0; }
    footer { padding: 1rem .25rem; font-size: var(--sm); }
    footer nav { display: flex; flex-wrap: wrap; gap: .4rem 1rem; margin-top: .75rem; }
    footer a { color: #dfcafb; }
  </style>
</head>
<body>
  <header class="bar">
    <a class="brand" href="/"><img src="/favicon-32.png" width="32" height="32" alt="" />${escapeHtml(shared_1.LEGAL_OPERATOR.appName)}</a>
    <a href="/legal">Yasal metinler</a>
  </header>
  <main>
    <section class="card" aria-labelledby="title">
      <div class="heading">
        <div class="kicker"><svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s7-3 7-9V5l-7-3-7 3v8c0 6 7 9 7 9Z"/><path d="m9 12 2 2 4-4"/></svg> HESAP GÜVENLİĞİ</div>
        <h1 id="title">Hesabımı kalıcı olarak sil</h1>
        <p>Hesap silme isteğinizi, Tavriko’da kayıtlı e-posta adresinize gönderilen tek kullanımlık kodla doğrulayın.</p>
      </div>
      <div class="warn" id="warning"><strong>Bu işlem geri alınamaz.</strong> Hesabınızla birlikte oyun ilerlemenizi, bakiyenizi ve envanterinizi kaybedersiniz.</div>
      <ol class="steps" id="steps" aria-label="Silme adımları">
        <li id="step-email" aria-current="step"><span>01</span> E-posta</li>
        <li id="step-code"><span>02</span> Doğrula ve sil</li>
      </ol>
      <form id="address-form" method="post">
        <label for="email">Kayıtlı e-posta adresiniz</label>
        <input id="email" type="email" autocomplete="email" spellcheck="false" maxlength="254" placeholder="ornek@eposta.com" required />
        <button id="send" class="action" type="submit">E-postama kod gönder</button>
      </form>
      <form id="code-form" method="post" hidden>
        <label for="code">E-postadaki 6 haneli kod</label>
        <input id="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" aria-describedby="code-hint" required />
        <small id="code-hint">Kod 15 dakika geçerlidir. Gelen kutunuzu ve spam klasörünüzü kontrol edin.</small>
        <div class="tools"><button id="edit" class="ghost" type="button">E-postayı değiştir</button><button id="resend" class="ghost" type="button">Kodu yeniden gönder</button></div>
        <label class="check"><input type="checkbox" id="acknowledgement" required /> Hesabımın ve oyun ilerlememin kalıcı olarak silineceğini anlıyorum.</label>
        <button id="remove" class="action danger" type="submit">Doğrula ve hesabımı sil</button>
      </form>
      <div class="msg" id="msg" role="status" aria-live="polite" tabindex="-1"></div>
      <noscript><p>Bu formu kullanmak için JavaScript’i etkinleştirin veya aşağıdaki bağlantıdan destek alın.</p></noscript>
    </section>
    <footer>
      <p>E-postanıza erişemiyor musunuz? <a href="mailto:${escapeHtml(shared_1.LEGAL_OPERATOR.contactEmail)}">Tavriko desteğine yazın</a>.</p>
      <nav aria-label="İlgili metinler"><a href="/aydinlatma-metni">KVKK Aydınlatma Metni</a><a href="/gizlilik-politikasi">Gizlilik Politikası</a></nav>
    </footer>
  </main>
  <script>
    (() => {
      const get = (id) => document.getElementById(id);
      const [addressForm, codeForm, email, code, send, resend, edit, remove, msg] =
        ['address-form', 'code-form', 'email', 'code', 'send', 'resend', 'edit', 'remove', 'msg'].map(get);
      let target = '', busy = false, deadline = 0, timer;
      function show(text, kind) { msg.textContent = text; msg.dataset.kind = kind; }
      function updateResend() {
        const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        resend.disabled = busy || seconds > 0;
        resend.textContent = seconds > 0 ? 'Yeniden gönder (' + seconds + ' sn)' : 'Kodu yeniden gönder';
        if (!seconds) clearInterval(timer);
      }
      function lock(working) {
        busy = working;
        send.disabled = edit.disabled = remove.disabled = working;
        updateResend();
      }
      async function post(path, body) {
        const response = await fetch('/api/auth/' + path, {
          method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success !== true) throw new Error(data.error || 'İşlem tamamlanamadı. Lütfen tekrar deneyin.');
        return data;
      }
      async function requestCode(address) {
        if (busy) return;
        lock(true);
        send.textContent = 'Gönderiliyor…';
        try {
          const data = await post('request-delete-code', { email: address });
          target = address;
          addressForm.hidden = true;
          codeForm.hidden = false;
          code.value = '';
          get('acknowledgement').checked = false;
          get('step-email').removeAttribute('aria-current');
          get('step-code').setAttribute('aria-current', 'step');
          show('Bu adres bir Tavriko hesabına bağlıysa doğrulama kodu e-postayla gönderilir.', 'ok');
          deadline = Date.now() + (Number(data.resendAfterSeconds) || 60) * 1000;
          clearInterval(timer);
          timer = setInterval(updateResend, 1000);
          code.focus();
        } catch (error) {
          show(error.message === 'Failed to fetch' ? 'Sunucuya ulaşılamadı. Lütfen tekrar deneyin.' : error.message, 'error');
        } finally { send.textContent = 'E-postama kod gönder'; lock(false); }
      }
      addressForm.addEventListener('submit', (event) => { event.preventDefault(); void requestCode(email.value.trim()); });
      resend.addEventListener('click', () => { if (!busy && !resend.disabled) void requestCode(target); });
      edit.addEventListener('click', () => {
        clearInterval(timer); deadline = 0; target = ''; code.value = ''; show('', 'ok');
        codeForm.hidden = true; addressForm.hidden = false;
        get('step-code').removeAttribute('aria-current');
        get('step-email').setAttribute('aria-current', 'step');
        email.focus();
      });
      code.addEventListener('input', () => { code.value = code.value.replace(/[^0-9]/g, ''); });
      codeForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (busy || !target) return;
        lock(true); remove.textContent = 'Doğrulanıyor…';
        try {
          await post('confirm-delete', { email: target, code: code.value.trim() });
          codeForm.hidden = true;
          get('steps').hidden = get('warning').hidden = true;
          get('title').textContent = 'Hesabınız silindi';
          get('title').nextElementSibling.textContent = 'Tavriko hesabınıza artık giriş yapamazsınız.';
          clearInterval(timer); deadline = 0; target = ''; code.value = ''; email.value = '';
          show('Hesabınız kalıcı olarak silindi.', 'ok');
          msg.focus();
        } catch (error) {
          show(error.message === 'Failed to fetch' ? 'Sunucuya ulaşılamadı. Lütfen tekrar deneyin.' : error.message, 'error');
          code.value = ''; code.focus();
        } finally { remove.textContent = 'Doğrula ve hesabımı sil'; lock(false); }
      });
    })();
  </script>
</body>
</html>`;
}
