# Polar Sandbox ve Site Sağlığı

## Sandbox kurulumu

1. [Polar Sandbox](https://sandbox.polar.sh) içinde ayrı bir kuruluş açın veya mevcut Sandbox kuruluşunu seçin. “Tavriko Sandbox Test Ürünü” gibi özel (`private`), tek aktif sabit fiyatı olan, tek seferlik ve hiçbir fayda tanımlanmamış bir test ürünü oluşturun. Canlı ürün kimliği veya canlı anahtar kullanmayın.
2. Kuruluşun geliştirici ayarlarından `products:read` ve `checkouts:write` yetkili Sandbox erişim anahtarı oluşturun. Checkout doğrulama çağrısında `checkouts:write` da kabul edilir ([Polar Checkout API](https://polar.sh/docs/api-reference/2026-10/checkouts/get-checkout-session)). Anahtarı yalnızca çalışma ortamının gizli değişkenlerine girin; repoya, loglara veya istemci uygulamasına koymayın.
3. Önce yerel veya erişim kontrollü bir Vercel önizleme ortamına aşağıdaki sunucu değişkenlerini ekleyin ve yeniden dağıtın:

   | Değişken | Değer |
   |---|---|
   | `POLAR_SANDBOX_ENABLED` | Yalnızca test için `true`; varsayılan kapalı |
   | `POLAR_SANDBOX_ACCESS_TOKEN` | Sandbox kuruluş anahtarı (gizli) |
   | `POLAR_SANDBOX_PRODUCT_ID` | Test ürünü UUID'si |
   | `POLAR_SANDBOX_APP_ORIGIN` | Yönetim panelinin tam origin'i, ör. `https://tavriko-preview.example.com`; sonuna `/` eklemeyin. Yerel HTTP yalnızca loopback için kabul edilir. |

4. `/admin` → “Site Sağlığı / Polar Sandbox” → “Test ödemesi başlat”. [Polar test kartı](https://polar.sh/docs/integrate/sandbox) `4242 4242 4242 4242`, ileri tarih ve herhangi bir üç haneli CVC ile deneyin. Gerçek kart veya müşteri bilgisi girmeyin. Dönüşte `confirmed` yalnızca isteğin alındığını belirtir. Panel `succeeded` durumunu Polar'dan sunucu tarafında okuyana kadar ödemeyi doğrulamaz; gerekirse “Durumu tekrar sorgula”yı kullanın.

Checkout yalnızca yönetici portalı oturumuyla açılır. Demo için webhook, ücretli sipariş defteri veya oyuncuya ürün teslimi yoktur. Demo dışında TRY ürünlerinin satışı ve eski kart formu kapalıdır; katalogdaki altın/elmas ile alışveriş devam eder.

## Site Sağlığı

Panel açıkken süreç ölçümleri 15, dağıtık ölçümler 30 saniyede yenilenir. CPU işlem süresinin geçen zamana oranıdır (%100 = bir çekirdek). Anlık RSS ve heap yalnızca yanıtlayan Node.js işlemine aittir; birleşik bölümde istek sırasında gözlenen en yüksek CPU/RSS ayrıca gösterilir, platform tahsis oranı veya boşta çalışan örneklerin ölçümü değildir.

PostgreSQL `SELECT 1`, Supabase `categories` okuması, Redis `PING`, Cloudflare Worker HTTPS `/health` ve etkinse Polar Sandbox ürün okuması panel kontrolleridir. Firebase FCM API kontrolü Google’a yalnızca doğrulama amaçlı bir istek gönderir; cihaz token’ı kullanmaz ve gerçek teslimatı ölçmez. Sentry satırı sunucu SDK durumunu gösterir. Sahip oturumu ile “Sentry test olayı gönder” üzerinden olay kimliğini alın ve Sentry’de sunucu projesinde arayın. Mobil Sentry projesi ayrıdır. Dağıtık toplama ve dış kontroller ayrıca kurulur.

## Web AdSense

Site kökündeki `/ads.txt` ve HTML’deki `google-adsense-account` meta etiketi, web sitesinin hesabını doğrulamak içindir. Mobil `/app-ads.txt` ayrıdır. Web sitesi Google tarafından onaylanıncaya ve uygulanabilir reklam rızası akışı (Google sertifikalı CMP dahil) kuruluncaya kadar reklam JavaScript’i yüklenmez. PostHog analitik izni reklam izni değildir. [Site doğrulama](https://support.google.com/adsense/answer/7584263) ve [Google CMP koşulları](https://support.google.com/adsense/answer/13554020).

### Dağıtık toplama kurulumu

Ücretsiz Vercel kullanımında Log Drain kurulumunu atlayabilirsiniz. Uygulama istekleri ve tarayıcı hata sinyalleri ortak Redis’e bağımsız yazılır; CDN ve dış erişim kontrolleri de Log Drain kullanmaz. Vercel edge kayıtları toplanmadığında panel bu kapsamı ayrı gösterir.

- **Ortak depo:** `OPS_REDIS_REST_URL` ve `OPS_REDIS_REST_TOKEN` (tercihen izlemeye ayrılmış Upstash Redis); ikisi yoksa mevcut `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` kullanılır. Vercel üretim, önizleme ve yerel toplamları ayrı anahtar alanlarındadır. Yalnızca seçili Express trafiği kaydedilir; yönetim, cron ve gözlem yolları hariçtir. Sayaçlar saatlik ve 48 saat ömürlüdür; panel cari saat dahil son 24 kovayı gösterir. `OPS_SITE_ORIGIN` değiştirilmezse tarayıcı sinyalleri yalnız `https://tavriko-app.vercel.app` üzerinden kabul edilir. Raporlar reklam engelleyici, sekme kapanması, ağ ve saatlik kota nedeniyle eksik olabilir; yığın izi, URL veya oturum kimliği saklanmaz.
- **Vercel edge:** [Vercel Log Drain](https://vercel.com/docs/drains/using-drains) için `/api/observability/vercel` HTTPS uç noktasını, JSON biçimini, Production ve Tavriko projesini seçin. `static`, `lambda`, `edge`, `external`, `firewall`, `redirect` kaynakları desteklenir. Aynı imza gizliliğini Vercel ve `OPS_VERCEL_DRAIN_SECRET` değişkenine girin; proje kimliği `OPS_VERCEL_PROJECT_ID` veya `VERCEL_PROJECT_ID` olmalıdır. Kurulum `x-vercel-verify` challenge isterse doğrulama değerini geçici olarak `OPS_VERCEL_VERIFY_TOKEN` yapın. İmzalı kayıtlardan durum/kaynak/cache kategorileri tutulur; tekrarlar saat kovasında anahtarlanır ve log içeriği atılır. Trafik kapsamı Drain tarafından gönderilen kayıtlarla sınırlıdır; çalışan uygulama sayımıyla çakışabilir. Özel Drain [Pro/Enterprise](https://vercel.com/docs/drains) özelliğidir. Ücret veya plan değişikliği otomatik yapılmaz.
- **Cloudflare CDN:** Önce [Workers Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/get-started/) özelliğini Cloudflare hesabında etkinleştirin, ardından `npm run deploy:cdn` ile CDN Worker'daki `tavriko_cdn_ops` yazıcısını dağıtın. Vercel sunucu ortamına `OPS_CLOUDFLARE_ACCOUNT_ID` ve [Account Analytics: Read yetkili](https://developers.cloudflare.com/analytics/analytics-engine/sql-api/) `OPS_CLOUDFLARE_ANALYTICS_TOKEN` tanımlayın. Sayaç yalnız Worker'a ulaşan GET/HEAD istekleri içindir; tarayıcı önbelleği buraya ulaşmaz.
- **Bağımsız erişilebilirlik:** `wrangler deploy --config monitor/wrangler.jsonc` ile Cloudflare zamanlayıcısını yayınlayın, aynı Redis adresini/keyini `wrangler secret put OPS_REDIS_REST_URL --config monitor/wrangler.jsonc` ve `wrangler secret put OPS_REDIS_REST_TOKEN --config monitor/wrangler.jsonc` ile sağlayın. İş Vercel'den bağımsız, beş dakikada bir web, API, CDN ve Realtime HTTP'yi sınar; Vercel kapalıyken dahi sonucu doğrudan Redis'e yazabilir. Redis'e yazamaması Worker geçmişinde hata verir; panel 16 dakikayı geçen örnekleri eski işaretler. Başarılı kontrol oranı örnekleme oranıdır, SLA değildir; oyun akışını ve WebSocket'i uçtan uca test etmez.

## Canlı ödemeden önce

Canlı kullanıma otomatik geçiş yoktur. Satılacak ürünlerin [Polar Kabul Edilebilir Kullanım Politikası](https://polar.sh/legal/acceptable-use-policy) ve varsa mobil uygulama mağazası kuralları açısından uygunluğu ayrıca değerlendirilmelidir. Üretim ödemesi için imzalı sipariş bildirimleri, tekrarları güvenle işleyen teslimat, kalıcı sipariş kaydı ve iade/iptal kuralları gerekir.
