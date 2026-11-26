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

Bu demo checkout'u yalnızca yönetici portalı oturumuyla açılır. Demo için webhook, ücretli sipariş defteri veya oyuncuya ürün teslimi yoktur. Oyunculara yönelik Sezon Pass ayrı bir akıştır.

## Oynayarak kazanılan ödüller

Sandıklar, anahtarlar ve rozetler mağazada satılmaz. Sezon 1'in iki hattı da sabit ödüller içerir; sandık ve anahtar yoktur. Daha önce kazanılmış eşyalar korunur. Maç görevlerinden ücretsiz kazanılan sandıklar Polar checkout'una bağlanmaz.

Oyna → Ödüller ekranı, sunucunun doğruladığı ve oyuncunun en az bir doğru cevap verdiği tamamlanmış maçları sayar. Solo alıştırma ve istemci istatistikleri sayılmaz; geçmişteki doğrulanmış kayıtlar sayılır. Her sandık eşiği hesap başına bir kez alınır ve anahtarıyla birlikte envantere gider. Rozetler karşılıklı kabul edilmiş arkadaşlık, maç sayısı, toplam doğru cevap, farklı oyun günleri (Türkiye saati) ve kusursuz maç görevlerinden kazanılır. Görev rozetleri envanterden süresiz kuşanılır.

Dağıtım sırası: önce hedef PostgreSQL ortamına `20261123100000_gameplay_reward_claims` migrasyonu, ardından API ve Pages/mobil derlemesi. Yeni migrasyon yalnızca kullanıcı başına tekil alım kaydını ekler. Yeni API'nin mağaza kataloğu eski istemcilerden gelen sandık satın alma isteklerini de reddeder. Polar ürünleri veya ödeme ayarları bu değişiklikle otomatik güncellenmez.

## Site Sağlığı

Panel açıkken süreç ölçümleri 15, dağıtık ölçümler 30 saniyede yenilenir. CPU işlem süresinin geçen zamana oranıdır (%100 = bir çekirdek). Anlık RSS ve heap yalnızca yanıtlayan Node.js işlemine aittir; birleşik bölümde istek sırasında gözlenen en yüksek CPU/RSS ayrıca gösterilir, platform tahsis oranı veya boşta çalışan örneklerin ölçümü değildir.

PostgreSQL `SELECT 1`, Supabase `categories` okuması, Redis `PING`, Cloudflare Worker HTTPS `/health` ve etkinse Polar Sandbox ürün okuması panel kontrolleridir. Firebase FCM API kontrolü Google’a yalnızca doğrulama amaçlı bir istek gönderir; cihaz token’ı kullanmaz ve gerçek teslimatı ölçmez. Sentry satırı sunucu SDK durumunu gösterir. Sahip oturumu ile “Sentry test olayı gönder” üzerinden olay kimliğini alın ve Sentry’de sunucu projesinde arayın. Mobil Sentry projesi ayrıdır. Dağıtık toplama ve dış kontroller ayrıca kurulur.

PostHog satırı, uygulamanın kullandığı proje için [PostHog Cloud yapılandırmasını](https://posthog.com/docs/libraries/js/snippet-versioning) sunucudan salt okunur olarak doğrular. `EXPO_PUBLIC_POSTHOG_KEY` veya `EXPO_PUBLIC_POSTHOG_HOST` değiştirilirse derleme ve sunucu çalışma ortamında aynı değerleri kullanın. Özel proxy adresleri bu denetimde “Doğrulanmadı” olarak görünür. Kontrol analitik olayı ya da oyuncu verisi göndermez; gerçek olay alımı ayrı olarak PostHog’da kontrol edilir.

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

## Sezon 1 Premium Pass

Sezon ekranı sandık ve anahtar vermez; jokerler ve diğer ödüller kademeye göre sabittir. Eski elmas satın alma yolu kapatılmıştır. Daha önce alınan Pass ve ödüller korunur. Polar ödemesi web arayüzünde ve yerel uygulamada uygulama içi tarayıcıyla başlatılır; Pass fiyatı sunucudan gelir, bu yüzden uygulamada da gösterilir.

1. İzole bir veritabanında `20261123130000_polar_season_pass` migration'ını test et. Canlıya geçerken önce mevcut migration durumunu doğrula, sonra `npx prisma migrate deploy --schema=server/prisma/schema.prisma` çalıştır. Yeni ledger, mevcut kullanıcı ve ödül kayıtlarını değiştirmez.
2. Polar'da abonelik olmayan, sabit TRY fiyatlı ayrı bir Sezon 1 ürünü oluştur. Liste fiyatı **99,99 TL**'dir (`POLAR_SEASON_AMOUNT_KURUS=9999`); farklı bir fiyat seçersen Polar'daki fiyat ile ortam değişkeni birebir aynı olmalı, aksi halde checkout doğrulaması reddeder. TRY için Polar'ın minimum tutarı 30 TL'dir. [Polar ürün ve fiyatlandırma ayarları](https://polar.sh/docs/features/products) ile fiyatı doğrula. Vercel sunucu ortamına `POLAR_SEASON_PRODUCT_ID`, `POLAR_SEASON_AMOUNT_KURUS` (ondalık TL değil tam sayı kuruş), `POLAR_SEASON_APP_ORIGIN` (ör. `https://tavriko.games`, son `/` olmadan) ve checkout okuma/yazma yetkili `POLAR_SEASON_ACCESS_TOKEN` ekle.
3. Polar webhook hedefini `/api/webhooks/polar-season` olarak ayarla ve `order.paid`, `order.refunded` olaylarını seç; hedefin imza sırrını `POLAR_SEASON_WEBHOOK_SECRET` olarak kaydet. Checkout oluşturmak için `POLAR_SEASON_ENABLED=true` gerekir. Satış kapatılsa bile webhook teslimi ve iadeler çalışmaya devam eder. Checkout yanıtı ve sipariş olayları için [Polar Checkout API](https://polar.sh/docs/api-reference/2026-10/checkouts/create-checkout-session) sözleşmesine bak.
4. Önce test ortamında `POLAR_SEASON_SANDBOX=true` ile açık checkout'u yeniden kullanma, başarılı ödeme sonrası Sezon ekranına dönüş, geciken webhook, tekrar teslim ve tam iade senaryolarını dene. Sandbox'ı ayrı veritabanıyla çalıştır; Vercel production ortamında Sandbox Pass devre dışıdır. Canlı ürün ve webhook onayı olmadan satış bayrağını açma. Ödül ilerlemesi ve daha önce alınmış eşyalar iade sırasında silinmez; yalnızca bu ödeme ile açılan erişim kapanır.

## Canlı Polar ürünleri (Tavriko kuruluşu)

Kuruluşun varsayılan para birimi TRY'dir. Elmas ürünlerinde yalnızca sabit TRY fiyatı bırakıldı; önceki 0 USD fiyatı kaldırıldı. Tüm ürünler tek seferliktir.

| Ürün | Polar ürün kimliği | TRY fiyatı | Ortam değişkeni |
|---|---|---:|---|
| Tavriko 100 Elmas | `3db7aa1e-403b-4300-ae50-e571583456fd` | ₺39,99 | `POLAR_GEMS_PRODUCT_100` |
| Tavriko 330 Elmas | `e584cfea-f4e7-4d77-ae53-9da5d205c6e8` | ₺99,99 | `POLAR_GEMS_PRODUCT_300` |
| Tavriko 700 Elmas | `a9d807d4-efa1-4a8a-97f3-d9e10fc629a9` | ₺189,99 | `POLAR_GEMS_PRODUCT_600` |
| Tavriko 1850 Elmas | `7b4b216b-f114-422e-abe7-43e1238b0ede` | ₺449,99 | `POLAR_GEMS_PRODUCT_1500` |
| Tavriko Premium Pass | `f4221bd5-2931-41a3-848f-6bcbbc94131f` | ₺99,99 | `POLAR_SEASON_PRODUCT_ID` |

Premium Pass ürünü özel (private) görünürlükte; yalnızca API checkout'u ile satılır. Webhook hedefleri: elmas için `/api/webhooks/polar-gems` (`f4393c85-5e53-4c14-be73-a7c0f59f1607`), sezon için `/api/webhooks/polar-season` (`642089e2-ca59-4789-9d70-718b1cf9076e`). Sırlar yalnızca Polar panelinden okunup Vercel ortam değişkenlerine girilir; repoya yazılmaz.

## Realtime Worker sürüm kontrolü

Yeni jokerler için `shared` paketini derle, `npm run build:cloudflare` ve `npm run test:cloudflare` komutlarını çalıştır. Cloudflare'da doğru hesapla `npm run deploy:cloudflare` çalıştırmadan önce Vercel ile Worker'ın mevcut `INTERNAL_API_SECRET` değerlerinin eşleştiğini ve `practice_joker_uses` migration'ının uygulandığını doğrula. Dağıtım sonrası [Worker sağlık uç noktası](https://tavriko-realtime.uncertainidentity8.workers.dev/health) `advancedQuizJokers: true` göstermeli. Bu bayrak tek başına stok tüketimini doğrulamaz; bir test hesabıyla botlu ve arkadaş maçında birer joker kullanıp etkinin ve stok düşüşünün doğru olduğunu kontrol et.
