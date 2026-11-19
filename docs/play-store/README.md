# Tavriko Google Play tanıtım paketi

Bu klasör, Türkçe mağaza sayfası için Tavriko’nun logo ve arena çizimlerinden hazırlanan grafikleri ve gerçek uygulama arayüzünden alınan ekran görüntülerini içerir. Uygulama kodu ve yayın yapılandırması değişmez.

| Materyal | Dosya | Biçim |
| --- | --- | --- |
| Uygulama simgesi | [tavriko-icon-512.png](tavriko-icon-512.png) | 512 × 512, 32 bit PNG (RGBA) |
| Tanıtım görseli | [tavriko-feature-1024x500.png](tavriko-feature-1024x500.png) | 1024 × 500, 24 bit PNG (RGB) |
| 7 telefon ekran görüntüsü | [phone/](phone/) | 1080 × 1920, 9:16, JPEG |
| 4 tablet önizlemesi | [tablet/](tablet/) | 1600 × 2560, 10:16, JPEG |
| 3 katlanabilir cihaz önizlemesi | [foldable/](foldable/) | 2040 × 2040 (iç), 1500 × 2000 (iç), 1280 × 2048 (dış), JPEG |
| Tanıtım videosu | [tavriko-tanitim-tr.mp4](tavriko-tanitim-tr.mp4) | 1920 × 1080, H.264 + AAC, Türkçe |

## Çekim ve yayın notları

- **Arayüz:** Ekran görüntüleri Tavriko’nun web sürümünün farklı ekran boyutlarındaki gerçek arayüzünden alındı. Android cihazdan veya Android emülatöründen alınmış ekran görüntüleri değildir. Mağaza yayını öncesinde aynı akışları Android sürümünde kontrol edin; yerel Android çekimleri için [Google’ın ekran görüntüsü kılavuzunu](https://developer.android.com/google/play/requirements/screenshots-android-cli) kullanın.
- **Video:** El animasyonu ve bu video için oluşturulmuş elektronik müzik, gerçek Tavriko ekran görüntülerinin üzerine eklendi. Tek kişilik tur uygulamada oynandı. 1v1 bölümünde iki ayrı sentetik test hesabı, yerel Express ve Cloudflare Workers ortamında 15 soruluk botsuz bir maç oynadı; üretim hesapları ve üretim düello kuyruğu kullanılmadı.
- **Play Console:** Simgeyi, tanıtım görselini ve ilgili ekran görüntülerini mağaza kaydının **Grafikler** bölümüne ekleyin. MP4 doğrudan yüklenmez: önce YouTube’a herkese açık veya liste dışı olarak yükleyin, ardından video URL’sini **Önizleme videosu** alanına girin ([Google Play Console yardım sayfası](https://support.google.com/googleplay/android-developer/answer/9866151?hl=tr)). Bu GitHub paketi, Play Console veya YouTube yayını yapmaz.
