# Tavriko cüzdanı ve jokerler: yayınlama notları

## Supabase ve Prisma

`20261123120000_wallet_and_practice_jokers` migration’ı, `polar_gem_orders` ve `practice_joker_uses` tablolarını ekler. `users.gems` sütununun yeni kayıtlar için varsayılanını sıfıra çeker; mevcut hesaplardaki bakiyeleri değiştirmez. Joker stoğu mevcut `user_inventory_items` tablosunda tutulur.

Hedef Supabase proje referansını ve Prisma migration geçmişini doğrulayın. Staging’de ve ardından doğrulanmış hedefte, dağıtım hesabıyla `cd server && npx prisma migrate status && npx prisma migrate deploy` sırasını kullanın. `DATABASE_URL` ve `DIRECT_URL` yalnız sunucu ortamında tanımlanmalı. Migration geçmişi ile şema uyuşmuyorsa SQL’i doğrudan yapıştırmayın veya migration’ı uygulanmış olarak işaretlemeyin; önce farkı inceleyin.

## Polar sanal ödeme

Önce tercihen ayrı bir test veritabanına bağlı staging kullanın; sandbox webhooks da bağlı veritabanına elmas yükler. Sadece sabit TRY fiyatlı, tek seferlik dört elmas ürünü tanımlanmalı. Altın, joker ve rastgele içerikler Polar ürünü değildir. [Polar Checkout API](https://polar.sh/docs/api-reference/2026-10/checkouts/create-checkout-session) ve [Polar kabul edilebilir kullanım şartları](https://polar.sh/docs/merchant-of-record/acceptable-use) yayın öncesi referanstır.

| Paket | Elmas | Katalog fiyatı | Ortam değişkeni |
|---|---:|---:|---|
| `gems_100` | 100 | ₺39,99 | `POLAR_GEMS_PRODUCT_100` |
| `gems_300` | 330 | ₺99,99 | `POLAR_GEMS_PRODUCT_300` |
| `gems_600` | 700 | ₺189,99 | `POLAR_GEMS_PRODUCT_600` |
| `gems_1500` | 1.850 | ₺449,99 | `POLAR_GEMS_PRODUCT_1500` |

Yalnız sunucuda `POLAR_GEMS_APP_ORIGIN` (izin verilen tam HTTPS origin), `POLAR_GEMS_ACCESS_TOKEN`, `POLAR_GEMS_WEBHOOK_SECRET` ve dört ürün kimliği tanımlanır. Önce staging’de `POLAR_GEMS_SANDBOX=true` kullanın. `POLAR_GEMS_ENABLED=true` olmadıkça ödeme kapalı kalır.

Webhook adresi `/api/webhooks/polar-gems`; olaylar [`order.paid`](https://polar.sh/docs/api-reference/2026-10/order_paid) ve [`order.refunded`](https://polar.sh/docs/api-reference/2026-10/order_refunded). Yayın öncesi gerçek sandbox oturumu, ödemeden dönüş, tekrar teslim, kısmi ve tam iade kontrol edilmeli. İade, daha önce harcanmış elmasları da geri alabilir; bakiye negatife düşerse yeni elmas harcaması yapılamaz.

Google Play sürümü Polar bağlantısı göstermez. Yerel uygulamada gerçek parayla satış ayrıca [Google Play ödeme kurallarına](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en) uygun bir entegrasyon gerektirir.
