# Tavriko web önizlemesi: Cloudflare Pages

Bu dağıtım yalnızca Expo web arayüzüdür. Vercel, Express/Prisma API’sini, yönetimi, hesap silme/yasal sayfaları, Telegram webhook’unu ve zamanlanmış bildirimleri sunmaya devam eder. Eşleşme ve odalar mevcut Cloudflare Worker’da kalır. Önizleme ana alan adını değiştirmez, reklam betiğini etkinleştirmez ve arama indekslemesine kapalıdır.

## Derleme

- Git dalı: önce bu değişikliğin önizleme dalı, `main` değil. Kök dizin: depo kökü. Framework preset: `None`. Node.js: `22`. Komut: `npm run build:client:pages`. Çıktı: `client/dist-pages`.
- `npm ci` ve `npm run build:client:pages` ile aynı çıktı yerelde üretilebilir. `client/dist` ve Vercel’in komutları değişmez. `EXPO_PUBLIC_WEB_API_ORIGIN` varsayılan olarak `https://tavriko-app.vercel.app` değerini kullanır; ayrı bir test API’si varsa yalnızca HTTPS origin’ini girin, `/api` eklemeyin. Bu değişken tarayıcıya açıktır; sır koymayın.
- Sabit önizleme adresi `https://tavriko-web-preview.pages.dev`; proje [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/) olarak oluşturuldu. ZIP’in kökünde `index.html`, `_headers`, `_redirects` ve `ads.txt` bulunmalı; `dist-pages` klasörünün kendisini değil içeriğini arşivleyin. Direct Upload projesi daha sonra [Git entegrasyonuna](https://developers.cloudflare.com/pages/get-started/git-integration/) çevrilemez.

## API ve Google girişi

1. Vercel API dağıtımında `TAVRIKO_WEB_ORIGINS` değişkenine `https://tavriko-web-preview.pages.dev` değerini ekleyin. Birden çok sabit adres gerekiyorsa virgülle ayırın. `*.pages.dev`, yollar ve üçüncü taraf siteler kullanılmaz; yönetim ve dahili API’lere yeni CORS izni verilmez. Değişken ancak yeni bir dağıtımda uygulanır. Bu dağıtımın güncel sunucu kodunu içerdiğini `/api/auth/login` için `OPTIONS` isteğiyle doğrulayın: `Access-Control-Allow-Origin` başlığı tam önizleme adresini içermelidir.
2. Google girişi için Supabase Auth → URL Configuration → Redirect URLs listesine `https://tavriko-web-preview.pages.dev/api/auth/google/callback` adresini tam olarak ekleyin; Site URL veya mevcut Vercel adreslerini değiştirmeyin. PKCE tarayıcı doğrulayıcısı Pages origin’inde kalır. Google veya Supabase sağlayıcı ayarlarını değiştirmek gerekmez; yalnızca [uygulamanın dönüş adresi listesi](https://supabase.com/docs/guides/auth/redirect-urls) güncellenir.
3. `FLOWS.md` içindeki Pages kontrollerini çalıştırın. Gerçek uçtan uca test için ayrı bir test hesabı ve test odası kullanın. Sağlık kontrolünün `200` dönmesi, tarayıcıdaki CORS veya girişin çalıştığını tek başına kanıtlamaz.

## Yayına geçiş ve geri dönüş

- Önizleme doğrulanana kadar mevcut Vercel URL’sini, DNS’i, canonical/sitemap ayarlarını veya reklam ayarlarını değiştirmeyin. Yeni ana adres seçilirse önizleme `noindex` kuralını ve canonical/sitemap dosyalarını yayın için ayrıca güncelleyin. Yeni siteyi reklam göstermek istediğiniz zaman [AdSense incelemesine](https://support.google.com/adsense/answer/7584263) gönderin. Vercel Hobby yalnızca kişisel veya ticari olmayan kullanım içindir; reklam geliri hedefleniyorsa backend planını ayrıca değerlendirin.
- Geri dönüşte kullanıcıları mevcut Vercel adresine yönlendirin. Kullanılmayan Pages origin’ini bir sonraki Vercel dağıtımı için `TAVRIKO_WEB_ORIGINS` listesinden, callback’ini de Supabase Redirect URLs listesinden çıkarın. Veritabanı, cron, yönetim ve eşleşme Worker’ı bu geçişte taşınmaz.
