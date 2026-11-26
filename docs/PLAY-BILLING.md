# Google Play Billing (Android)

Android uygulaması elmas paketlerini ve Premium Pass'i yalnızca Google Play Billing ile satar. Web (tavriko.games) Polar ile çalışmaya devam eder. Yerel uygulamada Polar'a veya web ödemesine bağlantı ya da yönlendirme yazısı gösterilmez ([Play ödeme politikası](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en)).

## Akış

1. İstemci `POST /api/social/shop/play/availability` ile açık ürünleri alır, fiyatları Play'den (`expo-iap`) okur. Kapalıysa Elmas sekmesi ve Pass düğmesi gizlenir.
2. `GET /api/social/shop/play/account` kullanıcı kimliğinin SHA-256 özetini verir; satın alma `obfuscatedAccountId` ile başlatılır.
3. İstemci `purchaseToken`'ı `POST /api/social/shop/play/verify` ile gönderir. Sunucu Google Play Developer API'den satın almayı okur; durum `purchased`, sipariş numarası, hesap özeti ve adet 1 değilse reddeder. Bakiye `play_purchases` tablosuna tek kayıtla, kullanıcı satırı kilitlenerek yazılır, sonra ürün sunucuda tüketilir (consume).
4. Pass zaten açıksa satın alma kaydedilmez ve onaylanmaz; Google 3 gün içinde otomatik iade eder.
5. `GET /api/cron/play-voided` (günlük Vercel cron, `CRON_SECRET`) iade/iptal edilen satın almaları geri alır.
6. Uygulama Shop açılışında bekleyen (ödenmiş ama doğrulanmamış) satın almaları tekrar doğrular.

## Ürünler (Play Console > Monetize > In-app products, tek seferlik, tüketilebilir)

| Ürün kimliği | İçerik | Fiyat |
| --- | --- | --- |
| `gems_100` | 100 elmas | 39,99 TL |
| `gems_300` | 330 elmas | 99,99 TL |
| `gems_600` | 700 elmas | 189,99 TL |
| `gems_1500` | 1850 elmas | 449,99 TL |
| `premium_pass` | Sezon Premium Pass | 99,99 TL |

Ürün kimlikleri `shared` katalog kimlikleriyle aynı olmalı; elmas miktarı sunucuda katalogdan gelir.

## Ortam değişkenleri (Vercel, sunucu)

- `PLAY_BILLING_ENABLED=true` — açmadan önce tablo ve ürünler hazır olmalı.
- `GOOGLE_PLAY_PACKAGE_NAME=com.tavriko.app`
- `GOOGLE_PLAY_SERVICE_ACCOUNT` — servis hesabı JSON anahtarı (ham JSON veya base64). Gizli (sensitive) olarak saklanır, koda/loglara konmaz.
- `PLAY_BILLING_ALLOW_TEST_PURCHASES` — yalnızca lisans testçileriyle test ederken `true`; canlıda kaldırılır.
- `CRON_SECRET` — mevcut.

## Yayın sırası

1. `server/prisma/migrations/20261126180000_play_purchases` üretim veritabanına uygulanır (onaylı, elle).
2. Play Console ürünleri ve servis hesabı izinleri tanımlanır; env değişkenleri eklenir; sunucu yayınlanır.
3. `expo-iap` yerel modül olduğu için OTA yetmez: sürüm 1.1.6 / versionCode 26 ile yeni AAB (EAS production) yüklenir, önce Internal testing'de lisans testçisiyle denenir.
