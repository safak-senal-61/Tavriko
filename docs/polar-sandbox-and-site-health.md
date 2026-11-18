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

Panel görünürken her 15 saniyede bir yenilenir. CPU işlem süresinin geçen zamana oranıdır (%100 = bir çekirdek); RSS ve heap yalnızca yanıtlayan Node.js işlemine aittir. Trafik 15 saniyelik kutularda, yaklaşık beş dakika ve istek ailelerine göre saklanır; p95 histogram üst sınırıdır. Gözlem başladıktan sonra tamamlanan Express istekleri sayılır. Vercel CDN, diğer sunucu örnekleri, WebSocket yükseltmeleri ve tamamlanmayan istekler dahil değildir.

PostgreSQL `SELECT 1`, Supabase `categories` okuması, Redis `PING`, Cloudflare Worker HTTPS `/health` ve etkinse Polar Sandbox ürün okuması bağımsız kontrollerdir. FCM ve Sentry/GlitchTip için yalnızca yapılandırma bilgisi gösterilir. Yeşil durum yalnızca ölçülen kapsam içindir; kalıcı geçmiş, dışarıdan kesinti alarmı ve tüm sunucuları kapsayan izleme ayrı bir gözlem altyapısı gerektirir.

## Canlı ödemeden önce

Canlı kullanıma otomatik geçiş yoktur. Satılacak ürünlerin [Polar Kabul Edilebilir Kullanım Politikası](https://polar.sh/legal/acceptable-use-policy) ve varsa mobil uygulama mağazası kuralları açısından uygunluğu ayrıca değerlendirilmelidir. Üretim ödemesi için imzalı sipariş bildirimleri, tekrarları güvenle işleyen teslimat, kalıcı sipariş kaydı ve iade/iptal kuralları gerekir.
