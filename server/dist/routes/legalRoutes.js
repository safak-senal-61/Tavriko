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
    res.send(layout('Yasal Metinler', `<h1>Yasal Metinler</h1><div class="meta">Sürüm: ${formatVersionDate(shared_1.LEGAL_VERSION)}</div><div class="list">${items}</div>`));
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
