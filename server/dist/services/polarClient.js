"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clientOriginAllowed = clientOriginAllowed;
exports.clientIpAddress = clientIpAddress;
const node_net_1 = require("node:net");
const webCors_1 = require("../middleware/webCors");
// Web uygulaması Cloudflare'da (ör. tavriko.games), API Vercel'de çalışabilir.
// Oyuncu API'si için izinli her web origin'i checkout başlatabilir.
const playerWebOrigins = (0, webCors_1.makeWebCorsPolicy)();
/**
 * Yerel (Expo/capacitor) istekleri `Origin` başlığı göndermez; tarayıcılar
 * cross-origin POST isteklerinde her zaman gönderir. Bu yüzden başlık yoksa
 * isteğin uygulamadan geldiğini kabul ediyoruz. CSRF koruması, tarayıcı
 * isteklerinde origin eşleşmesiyle korunmaya devam eder.
 */
function clientOriginAllowed(origin, expected, path = '/api/social') {
    return !origin || origin === expected || playerWebOrigins(origin, path);
}
/**
 * Polar, müşterinin ülkesine göre doğru para birimini (TRY) gösterebilmek için
 * `customer_ip_address` bekler. Vercel arkasında gerçek istemci IP'si ilk
 * `x-forwarded-for` değeridir; başka bir proxy zinciri varsa yalnızca geçerli
 * bir IP döndürürüz, aksi halde alanı göndermeyiz.
 */
function clientIpAddress(req) {
    const header = req.get('x-forwarded-for')?.split(',')[0]?.trim();
    if (header && (0, node_net_1.isIP)(header))
        return header;
    const direct = req.ip || req.socket.remoteAddress;
    if (!direct)
        return undefined;
    const normalized = direct.startsWith('::ffff:') ? direct.slice('::ffff:'.length) : direct;
    return (0, node_net_1.isIP)(normalized) ? normalized : undefined;
}
