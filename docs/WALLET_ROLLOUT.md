# Tavriko cüzdanı ve jokerler: yayınlama notları

## Supabase ve Prisma

`20261123120000_wallet_and_practice_jokers` migration’ı, `polar_gem_orders` ve `practice_joker_uses` tablolarını ekler. `users.gems` sütununun yeni kayıtlar için varsayılanını sıfıra çeker; mevcut hesaplardaki bakiyeleri değiştirmez. Joker stoğu mevcut `user_inventory_items` tablosunda tutulur.

Uygulama kodu veritabanından önce yayınlanırsa joker satışı ve kullanımı ile Polar ödeme başlatma işlemi kapalı kalır. Sunucu, iki tablo hazır olduğunda jokerleri otomatik olarak açar; kısa durum önbelleği en fazla 30 saniye sürer. Polar, ayrıca yetkili yapılandırma olmadan açılmaz.

Canlı jokerler düello, hızlı eşleşme ve arkadaş odalarında çalışır. Önce Vercel API, sonra mevcut `INTERNAL_API_SECRET` ile Cloudflare Worker, ardından istemci yayınlanmalı. Worker soru ve oturum durumunu doğrular; API mevcut `practice_joker_uses` tablosunu canlı tur anahtarıyla da kullanır. Yeni veritabanı migration’ı gerekmez; yukarıdaki cüzdan migration’ı daha önce uygulanmış olmalıdır. Günlük meydan okuma, çevrimdışı antrenman ve misafir oyunları kapsam dışıdır.

Botlu düello da aynı canlı joker yolunu kullanır. Vercel dağıtımı Cloudflare Worker’ı güncellemez. `cloudflare/` altında yetkili hesapla `npm run deploy` çalıştırdıktan sonra Worker’ın `/health` yanıtında `features.liveQuizJokers: true` olduğunu kontrol edin. Bu yalnızca Worker yapılandırmasını gösterir; ardından test hesabıyla botlu düello açarak jokerin uygulanmasını ve tek kopya düşmesini doğrulayın.

Poster jokerleri için yeni Supabase migration’ı yoktur. Önce Worker’ı yayınlayıp `/health` yanıtındaki `features.posterQuizJokers` alanını doğrulayın; ardından API ve istemciyi yayınlayın. Hedefi Bul, Kehanet, Cevap Göster ve Şans Zarı (otomatik gönderim yapmaz) mevcut özel joker sonucu üzerinden iletilir. Kehanet ve Cevap Göster açık insan eşleşmelerinde kullanılamaz. Seri Koruyucu, Şimşek Cevap ve Çifte Puan sadece botlu düello ve arkadaş odalarında uygulanır; koşulu ve puanı Worker hesaplar. İnsanlarla açık eşleşmede veya antrenmanda bu taktikler stok düşürmez. Şıkları Patlat çizimi mevcut Tek Eleme kimliğiyle kullanılır; Yarı Yarıya da kimliğini ve fiyatını korur.

11 ek poster jokeri botlu düelloda ve arkadaş odalarında kullanılır. İkinci Şans ilk yanlışta yeniden seçim verir; Kralın Hakkı puan yazmadan bir şıkkı dener. Zaman Molası sayacı 5 saniye durdurur, Ek Süre 15 saniye ekler, Zaman Dondurma henüz cevaplamamış tek rakibin sayacını ve şıklarını 15 saniye kilitler. Soru Değiştir, stokta yedek varsa yalnızca kullanan oyuncuya yeni soru verir; Pas Geç o tur için cevap kaydetmez. Sihirli Destek sonraki turda bir yanlış şıkkı eler ve doğru cevabın ilk karakterini verir. Halk Desteği en az beş önceki kayıtlı oyuncu yanıtı varsa oranları gösterir, aksi durumda stok düşmez. Koruma Kalkanı yalnızca yanlış cevap cezası açık arkadaş odalarında puan kaybını önler. Altın Avı, jokerin kullanıldığı soruyu doğru cevaplayıp maçı bitirene maç başına bir kez 140 altın verir.

Bu paket için API ve Cloudflare Worker aynı yayın penceresinde güncellenmelidir. Önce Vercel API ve istemci, hemen ardından Worker yayınlanır. Worker `/health` yanıtında `features.advancedQuizJokers` ve `features.rewardCompletion`, Vercel `/api/social/shop/jokers/availability` yanıtında `advanced` alanı `true` olmalıdır. Eski Worker ile 11 yeni jokerin satışı kapalıdır ve canlı maçlar yeni tamamlanma kanıtını göndermez. Yeni Supabase migration’ı gerekmez.

Ödüller ekranındaki dört sandık hedefi 8, 20, 45 ve 90 tamamlanmış maçtır. Maça başından katılan, en az bir geçerli cevap veren ve normal bitişte bağlı olan kayıtlı oyuncuların maçları sandık ve maç temelli rozetlere sayılır. Karşılıklı arkadaşlık rozeti ayrı kalır. Kazanılan ödüller ve envanter korunur; tamamlanma bilgisi taşımayan geçmiş maç kayıtları yeni ilerlemeye katılmaz.

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

Checkout isteğinde müşterinin IP'si `customer_ip_address` olarak Polar'a iletilir; bu alan olmadan Polar sunucunun IP'sini görüp yanlış para birimi gösterebilir. Webhook adresi `/api/webhooks/polar-gems`; olaylar [`order.paid`](https://polar.sh/docs/api-reference/2026-10/order_paid) ve [`order.refunded`](https://polar.sh/docs/api-reference/2026-10/order_refunded). Yayın öncesi gerçek sandbox oturumu, ödemeden dönüş, tekrar teslim, kısmi ve tam iade kontrol edilmeli. İade, daha önce harcanmış elmasları da geri alabilir; bakiye negatife düşerse yeni elmas harcaması yapılamaz.

Webde (tavriko.games) elmas ve Premium Pass Polar ile satılır. Yerel uygulamada Polar'a veya web ödemesine hiçbir bağlantı ya da yazı gösterilmez; [Google Play ödeme kuralları](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en) gereği Android'de satış yalnızca Google Play Billing ile yapılır (bkz. [PLAY-BILLING.md](PLAY-BILLING.md)). Play kapalıysa Elmas sekmesi ve Pass satın alma düğmesi yerel uygulamada gizlenir; web'den alınan bakiye aynı hesapla uygulamada görünür.
