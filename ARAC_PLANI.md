# Tavriko — Araç, İzleme ve Dağıtım Planı (Genişletilmiş)

Mevcut altyapı: **Expo (mobil + web)** · Vercel (web + API) · Cloudflare Workers (CDN + gerçek zamanlı WS/Durable Objects) · PostgreSQL + Prisma (Supabase) · Redis · EAS Build (APK) · GitHub · Jest (52 test)

Koddan çıkan özellik haritası: 1v1 eşleşme motoru (Matchmaker, GameRoomManager, GameStateMachine) · AI soru üretimi (Gemini + Evren LLM + prosedürel fabrika + doğrulayıcı) · mağaza/ekonomi (altın/elmas, StoreKit) · Telegram botu · referans sistemi · günlük yarışma, seri, sezon/lig, liderlik tabloları · arkadaş/sosyal + presence · bildirimler · ses/haptik servisi · admin paneli · yeniden bağlanma (netMonitor)

---

## Özellik → Araç Haritası (özet)

| Uygulama özelliği | Önerilen araç | Ne için |
|---|---|---|
| AI soru üretimi (Gemini/Evren) | **Langfuse** / Helicone | Prompt sürümleme, maliyet, kalite skorları |
| Mağaza/altın/paketler | **RevenueCat** | IAP altyapısı, gelir takibi |
| Bildirimler/seri hatırlatıcı | **Expo Push** | Mağaza onayına gerek kalmadan push |
| Ligler, soru istatistikleri, ekonomi | **Metabase** | Postgres üzerinde BI panoları |
| Eşleşme süresi, bot oranı | **PostHog feature flags** | A/B + kademeli yayına alma |
| WS kopmaları, reconnect | **Sentry breadcrumbs** | Bağlantı sorunlarını görmek |
| CDN görselleri | CI asset kontrolü | Kırık görsel erken uyarısı |
| Güvenlik (admin, API) | **CodeQL + Dependabot + Cloudflare WAF** | Sızma testi, bağımlılık açıkları |
| E2E akışlar | **Maestro** | Kayıt → 1v1 → soru akışları |

---

## 1. Hata İzleme (Error Tracking) — Sentry

**Öneri: Sentry** — hem Expo mobil hem react-native-web tarafını **tek SDK** ile kapsar; source map yüklemesi, release health (crash-free oranı), sürüm bazlı hata gruplandırması sağlar ([Sentry Expo rehberi](https://docs.sentry.io/platforms/react-native/guides/expo/)).

**Kurulum (özet):**
```bash
npx @sentry/wizard@latest -i reactNative
```
Sihirbaz; paketi kurar, Metro ve `app.json` yapılandırmasını yapar, Android/iOS source map ve debug sembol yüklemelerini EAS derlemelerine bağlar. `Sentry.init()`'i uygulama giriş noktasında mümkün olduğunca erken çağırın, kök bileşeni `Sentry.wrap()` ile sarın ([Sentry kurulum](https://docs.sentry.io/platforms/react-native/guides/expo/manual-setup/manual-setup/)).

- **Expo entegrasyonu:** Account Settings → Connections → Sentry bağlantısı; EAS derlemelerinde sürüm/hata eşleşmesi otomatik çalışır ([Expo Sentry rehberi](https://docs.expo.dev/guides/using-sentry/)).
- **Maliyet:** Ücretsiz katman ayda 5.000 olay ([Expo rehberi](https://docs.expo.dev/guides/using-sentry/)).
- **Projeye özel iki nokta:**
  - `netMonitor` + `ReconnectScreen` akışına **Sentry breadcrumb** ekleyin: WS bağlantı/kopma/reconnect anları, gecikme değerleri hata izlerinde görünsün. "Oyundan atılıyorum" şikayetlerinde hata kaydının yanında bağlantı geçmişi altın değerinde.
  - `socketHandler` ve `GameRoomManager`'da kritik state geçişlerinde (maç başlama, skor, maç sonu) breadcrumb bırakın.
- **Cloudflare Workers (WS/CDN) için:** `@sentry/cloudflare` ile worker hatalarını aynı panele toplayın.

**Alternatifler:** Bugsnag (ücretli), GlitchTip (açık kaynak, self-hosted Sentry uyumlu), Firebase Crashlytics (yalnız mobil, Expo Go ile çalışmaz).

---

## 2. Ürün Analitiği — PostHog

**Öneri: PostHog** — `posthog-react-native` SDK'sı Expo Go ile çalışan nadir analitik SDK'larından; web + mobil tek panelde; funnel, kohort, özellik bayrakları, A/B testleri içerir ([Expo analitik karşılaştırması](https://docs.expo.dev/guides/using-analytics/), [PostHog RN kurulumu](https://posthog.com/docs/product-analytics/installation/react-native)). Expo `eas connect` ile kurulumu otomatikleştirir ([Expo PostHog rehberi](https://docs.expo.dev/guides/using-posthog/)).

```bash
npx expo install posthog-react-native expo-file-system expo-application expo-device expo-localization
```

**Tavriko için event şeması:**

| Event | Alanlar | Ne ölçer |
|---|---|---|
| `match_started` | mode (duel/bot), category, source | 1v1 hacmi, bot/canlı oranı |
| `match_completed` | duration, result, question_count | Tamamlama oranı |
| `question_answered` | question_id, correct, time_ms, streak | **Soru bazlı başarı — zorluk dengesinin ana kaynağı** |
| `matchmaking_time` | seconds, matched_with (bot/human) | Eşleşme süresi (kuyruk sağlığı) |
| `store_purchase` | item, currency, amount | Ekonomi akışı |
| `referral_signup` / `referral_first_match` | code | Referans dönüşümü |
| `daily_streak_claimed` | day_count | Seri devamlılığı |
| `settings_changed` | key, value | Ayar etkileşimi (ör. Pil Tasarrufu vakası) |
| `session_start` | platform, version | D1/D7 retention |

**PostHog Feature Flags — projeye özel kullanımlar:**
- Eşleşme parametreleri: bot'a düşme süresi (şu an 7sn sabit), arama süresi — flag ile canlıda A/B test edin.
- Yeni özellikleri kademeli yayına alın (ör. yeni sezon ekranı önce %10 kullanıcıya).

**Alternatifler:** Amplitude / Mixpanel (ücretli eşik), Firebase Analytics (Expo Go'da çalışmaz, dev build ister), Umami/Plausible (yalnız web).

---

## 3. AI Soru Üretimi — Langfuse / Helicone (yeni)

Sunucuda üç katmanlı soru üretimi var: `geminiGenerator`, `evrenLlmGenerator` (n-llmapi) ve `proceduralQuestionFactory` + `questionValidator`. Bu hataya özel araçlar:

- **Langfuse (önerilen):** Açık kaynak (MIT), self-host edilebilen LLM mühendislik platformu ([Langfuse](https://langfuse.com/), [GitHub](https://github.com/langfuse/langfuse)). Sundukları:
  - **Tracing:** Her soru üretim isteğinin prompt'u, yanıtı, token kullanımı, gecikmesi ([gözlemlenebilirlik](https://langfuse.com/docs/observability/overview)).
  - **Prompt yönetimi:** Prompt'ları sürümleyin, test edin, geri alın — Gemini/Evren prompt değişiklikleri koda commit olmadan yönetilir.
  - **Evals / LLM-as-judge:** Üretilen soruları otomatik puanlayın (zorluk uygunluğu, kategori uyumu, Türkçe doğruluk) — mevcut `questionValidator`'ın yanında kalite katmanı.
  - **Maliyet panosu:** Gemini vs Evren maliyet/kalite karşılaştırması, aylık token harcaması, eşik aşımında uyarı ([Langfuse özellikleri](https://langfuse.com/docs)).
  - Self-host: Docker ile kendi sunucunuzda (Postgres + Redis + ClickHouse + S3) ([self-hosting](https://langfuse.com/self-hosting)) — ClickHouse tarafından satın alındı ama MIT lisansıyla açık kaynak kalmaya devam ediyor ([duyuru](https://clickhouse.com/blog/clickhouse-acquires-langfuse-open-source-llm-observability)).
- **Helicone (hafif alternatif):** Tek satır değişiklikle (base URL) proxy modunda tüm LLM isteklerini loglar; caching, rate limiting, 100+ modele tek API anahtarı ([Helicone GitHub](https://github.com/helicone/helicone)). LLM çağrıları Express'ten geçtiği için proxy kurulumu kolay.
- **Öneri:** Başlangıç için Helicone proxy (10 dk kurulum), ciddi prompt/eval yönetimi gerekince Langfuse self-host.

---

## 4. Mağaza ve Ekonomi — RevenueCat + Metabase (yeni)

`ShopScreen`/`StoreKit` altın-elmas paketleri ve `PaymentScreen` var. Mobilde mağazaya girince:

- **RevenueCat:** `react-native-purchases` Expo ile tam uyumlu; sunucu tarafı fiş doğrulama, webhook'lar, gelir/müşteri kaybı (churn) metrikleri hazır gelir ([RevenueCat Expo kurulumu](https://www.revenuecat.com/docs/getting-started/installation/expo)). Expo Go'da otomatik "Preview API Mode" ile çalışır, gerçek satış için development build gerekir ([react-native-purchases](https://github.com/revenuecat/react-native-purchases)). Aynı SDK RN Web'i de destekler — web satışlar RevenueCat Web Billing (Stripe/Paddle) üzerinden aynı entitlemente düşer ([RN Web desteği](https://www-docs.revenuecat.com/blog/engineering/revenuecat-react-native-sdk-adds-react-native-web-support/)). Ekonomi bakiyelerini (altın/elmas) kendi `users` tablonuzda tutmaya devam edebilirsiniz; RevenueCat yalnızca ödeme katmanını düzeltir.
- **Metabase (BI):** Açık kaynak, Postgres'e bağlanır; kod yazmadan pano: günlük eşleşme sayısı, ortalama maç süresi, kategori bazlı doğruluk, soru başına ortalama cevap süresi (zorluk ayarı için), altın kazanç/harcama dengesi (ekonomi şişmesi kontrolü), sezon LP dağılımı. Self-host (Docker) ücretsiz.
- **Ekonomi analitiği için PostHog event'leri + Metabase SQL panoları birlikte çalışır.**

---

## 5. Bildirimler — Expo Push (yeni)

`notificationStore`/`NotificationsScreen` var; push tarafı için:
- **Expo Push Service:** `expo-notifications` + `expo-constants` ile token alın; Android'de FCM, iOS'ta push anahtarı EAS credentials ile yönetilir ([Expo push kurulumu](https://docs.expo.dev/push-notifications/push-notifications-setup/)). Sunucudan basit HTTPS POST ile gönderim ([gönderim rehberi](https://docs.expo.dev/push-notifications/sending-notifications/)).
- **Kullanım alanları (özelliklerden):** günlük seri hatırlatıcısı ("Serini korumak için 1 maç!"), arkadaş isteği/düello meydan okuması, sezon bitiş uyarısı, referans dönüşüm bildirimi.
- **Alternatif:** OneSignal (segmentasyon ve otomasyon istenirse); başlangıç için Expo Push yeterli ve ücretsiz.

---

## 6. Paketleme ve Dağıtım

### Mevcut: EAS (Build) + Vercel otomatik deploy
Ücretsiz EAS katmanı ayda 15 Android + 15 iOS derleme içerir; **düşük öncelikli kuyruk** kullanır — APK'nın uzun kuyrukta beklemesi normaldir ([Expo fiyatlandırma](https://expo.dev/pricing)).

### Önerilen eklemeler
1. **EAS Update (OTA):** JS düzeltmelerini mağaza onayı beklemeden gönderin; ücretsiz katman 1.000 MAU ([EAS Update](https://docs.expo.dev/eas-update/getting-started/)). webp→png tarzı acil yamalar dakikalar içinde yayında.
2. **EAS Submit:** Play Store'a ilk sürümü `eas submit --platform android` ile yükleyin.
3. **EAS Workflows + Maestro:** PR'da otomatik APK derleyip E2E akışlarını emulator'de çalıştırma ([Expo E2E rehberi](https://docs.expo.dev/tutorial/cicd/e2e-tests/)).
4. **Bildirim + IAP:** Expo Push ve RevenueCat, EAS Build ile gelen development/production build'lerinde çalışır (Expo Go'da sınırlı).

### Docker — ne zaman?
Mevcut mimaride (API Vercel, WS/CDN Workers) **gerekmiyor**. Anlamlı olduğu senaryolar:
- API'yi kendi VPS'inize taşıma kararı (multi-stage Dockerfile + docker-compose: Postgres + API).
- **Langfuse self-host** (kendi LLM gözlem sunucunuz) veya Metabase/OpenReplay barındırma — bu üçü Docker ile en kolay kurulur.
- Lokal geliştirme ortamı standardizasyonu.

### CI/CD — GitHub Actions
- **PR'da:** `tsc --noEmit`, ESLint, Jest (52 test), shared paket build.
- **main'e push'ta:** web dist + Vercel (zaten otomatik), tag'de `eas build --profile production`.
- **CDN güvenlik ağı (yeni):** her deploy'da `cdnManifest`'teki tüm görselleri HEAD isteğiyle doğrulayan bir script — kırık görsel kullanıcıdan önce CI'da yakalanır. (Bugünkü "görsel görünmüyor" vakasını kalıcı olarak engeller.)
- **Turborepo (opsiyonel):** monorepo build cache.

---

## 7. SEO

1. **Başlangıç:** `robots.txt` + `sitemap.xml` (Vercel `public/`) · **Google Search Console + Bing Webmaster** kaydı · landing ekranına `<title>`/meta description/OG etiketleri (`react-helmet-async` veya Expo Router kullanan `expo-router/head`) · OG görselleri CDN'den PNG.
2. **Orta vade:** JSON-LD `VideoGame` schema · kategori/lig tanıtım sayfalarını statikleştirme (prerender) ya da pazarlama yüzeyi için ayrı **Next.js** sitesi.
3. **Ölçüm:** GSC ücretsiz; rekabet analizi gerekince Ahrefs/Semrush.

---

## 8. Performans

- **Vercel Analytics + Speed Insights:** Core Web Vitals + ziyaretçi (panelden açılır).
- **Lighthouse CI:** her PR'da web puanı.
- **Sentry Tracing:** API çağrıları ve WS el sıkışmaları span olarak; `tracesSampleRate` geliştirmede 1.0, ürekte düşürün ([Sentry tracing](https://docs.sentry.io/platforms/react-native/tracing)).
- **Eşleşme motoru metrikleri (yeni):** `Matchmaker`'dan ortalama kuyruk süresi, bot'a düşme oranı, DO başına aktif oda sayısı — Cloudflare Analytics Engine ile Workers/Durable Objects istek, hata ve CPU metriklerini panelden izleyin; eşiği aşarsa PostHog/Checkly uyarısı.
- **Mobil:** Expo dev menü Performance Monitor, Android Studio profiler (ANR/jank).

---

## 9. Uptime ve Log Yönetimi

- **Checkly / UptimeRobot:** `/health` ucu, WS endpoint'i, CDN görselleri (ör. `radar_arena.png`) dakikalık kontrol + e-posta bildirimi.
- **Better Stack (Logtail):** Vercel fonksiyon logları + Cloudflare Workers `console.log`'ları tek yerde; hata üstünde alert kuralı. `logRoutes.ts` zaten var — bu akışı Better Stack'e bağlamak doğal adım.
- **Cloudflare Analytics:** WS/CDN worker metrikleri.

---

## 10. Test

- **Mevcut:** Jest birim testleri (52) — korunmaya devam.
- **E2E mobil — Maestro:** YAML akışları; Expo'nun resmi tercih ettiği platform ([Expo × Maestro](https://docs.expo.dev/guides/using-e2e/), [Maestro GitHub](https://github.com/mobile-dev-inc/Maestro)). İlk akışlar: "kayıt → 1v1 eşleşme → soru cevapla" · "misafir modu sınırlaması" · "ayarlar → Pil Tasarrufu → radar animasyonu kapanır" (bugünkü vakayı otomatik testle sabitleyin).
- **E2E web — Playwright:** canlı sitede giriş, eşleşme, mağaza akışları.
- **AI soruları için veri seti testleri:** Langfuse datasets ile üretilen soruların kalite skorları regresyona girsin.

---

## 11. Güvenlik (yeni)

- **GitHub CodeQL + Dependabot + secret scanning:** depoyu otomatik tarama (ücretsiz, GitHub Actions'dan açılır).
- **Cloudflare WAF + rate limit:** auth ve `findMatch` uçlarında basit hız sınırlama; admin paneli (`adminLoginPage`) için IP kısıtı veya Cloudflare Access (ücretsiz SSO katmanı).
- **OWASP ZAP** tarayıcısıyla periyodik otomatik tarama (Docker ile çalışır).
- Sırlar (Gemini/Telegram/EAS anahtarları) zaten ortam değişkenlerinde — Dependabot secret scanning ile yanlışlıkla commit'i yakalar.

---

## 12. Canlı Oturum Kaydı ve Hata Ayıklama

- **Sentry Session Replay (web)** + **OpenReplay (mobil, self-host)**.
- **Reactotron** (geliştirme zamanı RN state/network incelemesi) · **React Native DevTools / Expo Dev Tools** (resmi hata ayıklayıcı).

---

## 13. Ek Araç Kataloğu — özelliklere göre (yeni)

### Yük ve dayanıklılık testi — k6 / Artillery
Gerçek zamanlı eşleşme motoru (`Matchmaker`, `GameRoomManager`, Durable Objects WS) en kritik bileşen: eşzamanlı 100/500/1000 oyuncuda ne oluyor?
- **k6 (önerilen):** Açık kaynak, JS senaryoları ile sanal kullanıcı simülasyonu; eşzamanlı "findMatch → soru cevapla" akışlarını WS üzerinde koşturun, eşleşme süresi/DO CPU eşiklerini ölçün. Sonuçları Grafana Cloud'a basın.
- **Artillery:** Alternatif, YAML tabanlı; HTTP için daha pratik.
- Kullanım: sürüm öncesi ("bir sonraki sezon güncellemesi WS'yi taşıyacak mı?") ve kapasite planlama.

### Yükleme atıfı ve derin bağlantı — AppsFlyer / Adjust / Branch.io
`referralService` + "TV-UBQK9JE" arkadaş kodu var; ancak **kurulum atıfı** (hangi kanaldan gelen kullanıcı hangi kodu kullanarak uygulamayı kurdu) için özel araç gerekir:
- Mobilde: **AppsFlyer** veya **Adjust** (OneLink tarzı) — davet linkine tıklayan arkadaşın mağaza yönlendirmesi + ilk açılışta kodun otomatik doldurulması.
- Web tarafında: `expo-linking` + URL parametreleri ile mevcut kodla çözülebilir; mobil atıf için bu araçlar gerekir.
- Öneri: referans programını büyütme kararı gelene kadar ertele.

### İçerik moderasyonu — avatar ve biyografi
`ProfileEditScreen`'de kullanıcı avatarı ve "Kısa biyografi" alanı var; 18+ bir oyunda KVKK ve marka güvenliği açısından moderasyon katmanı düşünün:
- **Cloudflare Workers AI** (mevcut Worker altyapınızda, ek maliyet yok): metin sınıflandırma ile biyografi taraması.
- **Google Cloud Vision / AWS Rekognition:** Yüklenen avatar görselleri için otomatik denetim (ücretsiz kotalar var).
- Basit başlangıç: bildirim mekanizmasına "şikayet" akışı ekleyip admin panelinde manuel inceleme.

### Veritabanı sağlığı — Supabase yerleşik araçları + pganalyze
Postgres Supabase'de:
- **Supabase Point-in-Time Recovery** ve otomatik yedekleri açın (yoksa) — maç geçmişi ve ekonomi verisi kritik.
- **pganalyze:** Uzun süren sorgu uyarıları, index önerileri (ücretsiz deneme; Supabase panelindeki sorgu görüntüleyicisi de başlangıç için yeterli).

### Durum sayfası — oyuncular için şeffaflık
- **Better Stack Status Pages / UptimeRobot Status Page:** "Sunucu çevrimiçi mi?" sorusuna oyuncuların kendilerinin bakabildiği kamu sayfası; WS ve API olaylarında Twitter/Telegram yerine tek adres. *Kuruldu:* [stats.uptimerobot.com/5TKKlcUCpU](https://stats.uptimerobot.com/5TKKlcUCpU) — Web + WS worker monitörlerini içerir.

### Kullanıcı desteği ve geri bildirim
- **Crisp (ücretsiz katman):** Web'e canlı destek sohbeti penceresi — "oyun içinde takıldım" anında yardım.
- **Canny / Featurebase:** Özellik oylama panosu ("sonraki kategori ne olsun?") — topluluk kararı veriye dayanır.
- **Ekonomik çözüm:** Mevcut `telegramBot.ts` altyapısını destek kanalı olarak da kullanın — oyuncu şikayeti Telegram botuna düşsün, siz oradan yanıtlayın (sıfır maliyet, halihazırda yazılmış kod).

### CI bildirimleri — mevcut Telegram botu ile entegrasyon
Sıfır maliyet bir öneri: GitHub Actions, derleme çöküşü (Sentry alert) ve uptime uyarılarını **kendi Telegram botunuza** webhook ile göndersin. `telegramBot.ts` zaten var; sadece "gönder" fonksiyonunu bir bildirim kanalına dönüştürmek yeterli — ek abonelik yok.

### Çerez/KVKK onayı — Klaro!
Web tarafında yasal metin onayı (`needsLegalConsent`) uygulama içinde var; web'de analitik/çerez araçları eklediğinizde çerez onay katmanı gerekecek:
- **Klaro! (açık kaynak):** Kendi sunucunuzda barındırılan, KVKK/GDPR uyumlu çerez onay bileşeni; PostHog/Sentry gibi araçları yalnızca onay sonrası başlatın.

### Bileşen kataloğu ve görsel regresyon — Storybook + Lost Pixel
`TavrikoIcons`, `TavrikoGradient`, `DiscoveryArtwork` gibi ortak bileşenler var:
- **Storybook (React Native destekli):** Bileşen kataloğu — kart, buton, rozet varyasyonlarını tek yerde görün.
- **Lost Pixel (açık kaynak):** Bileşen ekran görüntülerini her PR'da karşılaştırın — tema/kart tasarımı değişikliklerinde görsel gerileme otomatik yakalanır.

### Bundle boyutu bütçesi
- **`npx expo export --analyze`** (mevcut araç zinciri): web/mobil bundle içeriğini inceleyin.
- **size-limit (açık kaynak):** GitHub Actions'ta "web bundle 200KB'ı geçerse PR kırmızı olsun" kuralı — görseller CDN'de olduğu için JS tarafı küçük kalmalı.

### API geliştirme ve sözleşme testi — Hoppscotch / Bruno + MSW
- **Hoppscotch (web) / Bruno (masaüstü, açık kaynak):** Postman alternatifi; `/auth`, `/social` uçlarını kayıtlı koleksiyonlarda tutun.
- **MSW (Mock Service Worker):** Jest testlerinde API'yi mock'layın — eşleşme/soru akışı testleri sunucudan bağımsız çalışır.

### Kod kalitesi otomasyonu — ekstra
- **Husky + lint-staged:** commit öncesi lint/format (tek seferlik kurulum).
- **Knip:** Kullanılmayan dosya/bağımlılık taraması (monorepo temizliği).
- **Changesets:** `@trivia/shared` paketinin sürümlenmesi ve changelog'u otomatik.
- **Codecov:** Jest kapsam raporlarını PR üzerine yorum olarak düşürün.

### Play Store yayını sonrası — ücretsiz yerleşik araçlar
- **Google Play Console:** Vitals paneli (çökme oranı, ANR, kötü yorum etiketleri), Store Listing A/B testleri (ürün adı/ikon/screenshot denemeleri) — ASO aracı almadan önce burada bolca veri var.
- **Play App Signing:** EAS ile otomatik yönetilir; anahtar kaybı riski sıfırlanır.

### Arama altyapısı (ilerisi için)
Kategori arama şu an istemci tarafında; sunucu tarafına taşınırsa **Meilisearch** (açık kaynak, self-host, typo toleranslı) hafif ve hızlı bir seçenek.

---

## Öncelikli Yol Haritası (güncel)

### Durum (16 Kasım 2026)
- **1. Hafta — tamamlandı:** Sentry (Expo + web) · WS breadcrumb'ları (istemci + sunucu) · robots.txt/sitemap.xml + GSC doğrulama etiketi · CodeQL iş akışı · Dependabot. *Kalan (kod dışı):* GSC/Bing mülk doğrulaması ve sitemap gönderimi; GitHub hesap fatura kilidi (CI/CodeQL işleri başlamıyor — kartı Billing → Payment information'dan yeniden kaydetmek çözer).
- **2. Hafta — kod tarafı tamamlandı:** PostHog entegrasyonu (event şeması: session_start, match_started/completed, question_answered, matchmaking_time, store_purchase, referral_signup, daily_streak_claimed, settings_changed) · bot'a düşme süresi feature flag'i (`matchmaking-bot-fallback-sec`, 3–30sn, varsayılan 7sn) · Helicone proxy (env: `HELICONE_API_KEY`). *Kalan (kod dışı):* PostHog projesi açıp `EXPO_PUBLIC_POSTHOG_KEY` tanımlamak. *Tamamlandı (17 Kasım 2026):* UptimeRobot uptime izleme kaydı — Web (`tavriko-app.vercel.app`, monitör `804699286`) ve WS worker (`tavriko-realtime.uncertainidentity8.workers.dev`, monitör `804699287`) 5 dk aralıkla izleniyor; kamu durum sayfası: [stats.uptimerobot.com/5TKKlcUCpU](https://stats.uptimerobot.com/5TKKlcUCpU) (README'de bağlantılı).
- **Not:** PostHog ve Helicone anahtarları tanımsızken ilgili kodlar sessizce no-op çalışır; anahtar tanımlandığı anda etkinleşir.

| Faz | Ne yapılır | Neden |
|---|---|---|
| **1. Hafta** | Sentry (Expo + web + WS breadcrumb'lar) · GSC + robots/sitemap · GitHub CodeQL/Dependabot aç | Hataları ilk günden görünür kılmak + güvenlik temeli |
| **2. Hafta** | PostHog + event şeması + feature flag (eşleşme parametreleri) · Checkly uptime · Helicone proxy (LLM log) | Ölçüm ve canlı deney yapma gücü |
| **3. Hafta** | EAS Update (OTA) · GitHub Actions CI (test+typecheck+CDN görsel doğrulama) · Expo Push | Acil yama kanalı + kalite kapısı + geri kazanım (retention) |
| **4. Hafta** | Maestro ile 3 kritik E2E · Lighthouse CI · OG/meta etiketleri · Metabase pano (soru istatistikleri) · Telegram'a CI/Sentry uyarı akışı | Kalite + SEO + veri kültürü |
| **5. Hafta** | k6 ile WS yük testi (ilk senaryo) · Husky + lint-staged · size-limit bundle bütçesi · Klaro! çerez onayı (PostHog öncesi şart) | Dayanıklılık + kod kalitesi |
| **Sonra** | EAS Submit (Play Store) → Play Console Vitals takibi · RevenueCat (IAP hazır olduğunda) · Langfuse self-host (prompt/eval) · Sentry Replay/OpenReplay · JSON-LD · k6 tam sürüm senaryoları · moderasyon katmanı (Workers AI) · Storybook + Lost Pixel · Docker (sunucu/self-host araçlar taşınırsa) | Ölçekle gelen ihtiyaçlar |

## Ücret politikası özeti (ücretsiz katmanlar)

| Araç | Ücretsiz katman | Not |
|---|---|---|
| Sentry | 5.000 olay/ay | ([Expo rehberi](https://docs.expo.dev/guides/using-sentry/)) |
| PostHog | 1M olay/ay (self-host sınırsız) | Açık kaynak |
| EAS Build | 15 Android + 15 iOS/ay | Düşük öncelikli kuyruk ([fiyatlandırma](https://expo.dev/pricing)) |
| EAS Update | 1.000 MAU | ([EAS Update](https://docs.expo.dev/eas-update/getting-started/)) |
| Langfuse | MIT, self-host sınırsız | ([Langfuse](https://langfuse.com/)) |
| Helicone | Açık kaynak + ücretsiz katman | ([GitHub](https://github.com/helicone/helicone)) |
| RevenueCat | SDK + temel panel ücretsiz | ([Expo kurulumu](https://www.revenuecat.com/docs/getting-started/installation/expo)) |
| Expo Push | Ücretsiz | ([kurulum](https://docs.expo.dev/push-notifications/push-notifications-setup/)) |
| Metabase | Açık kaynak, self-host ücretsiz | Docker ile kurulur |
| Google Search Console | Tamamen ücretsiz | SEO temel aracı |
| Maestro / OpenReplay / Checkly / CodeQL | Açık kaynak / ücretsiz katman | — |
| k6 / Artillery / MSW / Storybook | Açık kaynak | Yük testi, mock, bileşen kataloğu |
| Klaro! / Hoppscotch / Bruno / Lost Pixel | Açık kaynak | Çerez onayı, API istemcisi, görsel regresyon |
| Telegram botu bildirim kanalı | Mevcut altyapı | CI + Sentry + uptime uyarıları sıfır ek maliyet |
| Google Play Console | Yayıncı hesabı ile | Vitals, Store A/B — ASO için ilk durak |
