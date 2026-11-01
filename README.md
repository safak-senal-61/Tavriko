# ⚡ TAVRİKO — Yeni Nesil Gerçek Zamanlı Multiplayer Bilgi Yarışması

Modern, rekabetçi, stüdyo kalitesinde ve yapay zekâ destekli çok oyunculu (multiplayer) mobil & web bilgi yarışması platformu.

iOS, Android ve Mobil Web üzerinde eş zamanlı çalışacak şekilde **React Native & Expo**, **TypeScript**, **Cloudflare Workers & Durable Objects**, **Node.js (Socket.IO + Express)**, **Supabase PostgreSQL & Prisma**, **Upstash Redis**, **Google Gemini / SSB EVREN GLM-5.3** ve **Telegram Bot** mimarisiyle geliştirilmiştir.

Canlı Web Sürümü: **[https://tavriko-app.vercel.app/](https://tavriko-app.vercel.app/)**  
Cloudflare Realtime Ağ: **`wss://tavriko-realtime.uncertainidentity8.workers.dev/ws`**

---

## 🌟 Öne Çıkan Sistemler & Özellikler

### 1. ⚔️ Gerçek Zamanlı Multiplayer & Eşleşme (Matchmaking)
- **Cloudflare Durable Objects & Native WebSockets**: Düşük gecikmeli, küresel dağıtık gerçek zamanlı oda ve eşleşme motoru (`GAME_ROOMS` ve `MATCHMAKER` Durable Objects).
- **Hızlı Eşleşme (1v1 Quick Match)**: Tek dokunuşla radar animasyonlu 2 oyunculu eşleşme.
- **Yapay Zekâ Bot Rakip Desteği**: Gerçek oyuncu bulunamadığında otomatik devreye giren, insansı gecikmeyle cevap veren bilgisayar rakip ve kesintisiz soru akışı.
- **Arkadaşlarla Özel Oda (Custom Room)**: 6 haneli oda koduyla anında özel lobi açma, doğrudan katılım bağlantısı paylaşımı (`https://tavriko-app.vercel.app/?joinRoom=KOD`).
- **Güvenli Oyun Çıkışı (X Butonu)**: Çarpı butonuna basıldığında tüm aktif sayaçlar, arka plan zamanlayıcıları ve ağ bağlantıları hafıza sızıntısı bırakmadan temizlenir.

### 2. 🏆 Pro Lig & Sezon 1: Bilgi Çağı
- **7 Aşamalı Lig Sistemi**: Bronz, Gümüş, Altın, Platin, Elmas, Şampiyon ve Efsane ligleri.
- **Yükselme ve Düşme Potası**: Haftalık puanlama, ilk 3 için podyum (`🥇 🥈 🥉`) ve sezon sonu ödülleri.
- **50 Kademeli Savaş Bileti (Season Pass)**: Ücretsiz ve Premium Pass kulvarları, Sezon XP (S-XP) ile açılan mitolojik kozmetikler, altın, elmas ve sandıklar.

### 3. 📅 Canlı Etkinlikler & Görev Takibi (Events)
- **3 Dinamik Görev Kategorisi**: Günlük Görevler, Haftalık Hedefler ve Özel Turnuvalar.
- **Gerçek Zamanlı İlerleme Takibi**: Görevler kullanıcı "BAŞLA / OYNA" dedikten sonra aktifleşir; eski maçlar veya kümülatif sorular karışmadan sadece oturumdaki ilerleme kaydedilir.
- **Tek Tıkla Ödül Toplama (`TOPLA`)**: Görev tamamlandığında naneli yeşil butonla ses ve haptik eşliğinde anında ödül teslimi.

### 4. 🛒 Tavriko Mağazası & Envanter (Shop & Inventory)
- **11 Ürün Kategorisi**: Öne Çıkanlar, Elmas Paketleri, Altın Keseleri, Sandıklar (Bronz/Gümüş/Altın), Anahtarlar, Avatarlar, Çerçeveler, Rozetler, İsim Efektleri, Güçlendiriciler ve Arka Planlar.
- **Sandık Açma & Ödül Sistemi**: Gümüş ve altın anahtarlarla açılan sandıklar, parıltı animasyonları ve rastgele kozmetik düşürme mekanizması.

### 5. 🤖 SSB EVREN GLM-5.3 & Gemini Yapay Zekâ Soru Motoru
- T.C. SSB EVREN platformu **GLM-5.3** ve **Google Gemini** LLM modelleriyle 16 kategoride dinamik soru üretimi.
- Otomatik içerik karmaşıklığı analizi, 4 seçenekli şık dengelemesi, açıklama ve doğrulama kaynağı kontrolü.

### 6. 📱 Telegram Yönetim & Topluluk Botu (Vercel Webhook Entegre)
- **Vercel Serverless Uyumlu Webhook**: Serverless mimaride kesintisiz çalışan `POST /api/telegram/webhook` entegrasyonu.
- **Hedef Soru Havuzları**:
  - `[✅ Normal Kategoriye Al]`: Standart 1v1 ve lobi maçları havuzu.
  - `[📅 Günlük Meydan Okuma]`: Günün Meydan Okuması havuzu.
  - `[⚔️ Özel Oda / Arkadaş]`: Özel düellolara özel eğlenceli/zor soru havuzu.
- **Topluluk Komutları**:
  - `/profil <kullanıcı_adı>`: Seviye, LP, galibiyet oranı, en yüksek seri ve unvan kartı.
  - `/lig` veya `/siralama`: Pro Lig canlı ilk 10 lider tablosu.
  - `/oda_kur [kategori]`: Telegram grubunda tek komutla özel oda açıp bağlantı paylaşma.
  - `/gunun_sorusu` veya `/quiz`: Telegram içi anlık oylanabilen Quiz/Poll yarışması.
  - `/soru_uret`, `/gunluk_soru_uret`, `/ozel_soru_uret`: Hedef havuzlu soru üretimi.
  - `/ara_soru <kelime>`: Soru havuzunda arama.

---

## 🏗️ Mimari Yapı

```
Tavriko/
├── shared/                         # Ortak TypeScript tipleri, kontratlar ve formüller
│   ├── src/
│   │   ├── types.ts                # Soru, Oyuncu, Lig, Mağaza, Etkinlik, Pass tipleri
│   │   ├── events.ts               # Socket.IO & WebSocket mesaj sabitleri
│   │   ├── scoring.ts              # Hız bonusu, seri çarpanı ve sıralama matematiği
│   │   └── categories.ts           # 16 kategori metadata ve renk paleti
│   └── test/
├── cloudflare/                     # Cloudflare Workers & Durable Objects Gerçek Zamanlı Katman
│   ├── src/
│   │   ├── index.ts                # Worker giriş noktası ve WebSocket yönlendirme
│   │   ├── GameRoomsDO.ts          # Canlı oda yönetimi, timer ve durum senkronizasyonu
│   │   └── MatchmakerDO.ts         # Global eşleştirme kuyruğu ve bot atama motoru
│   └── wrangler.toml               # Cloudflare Durable Objects bağlayıcıları
├── server/                         # Node.js + Express + Prisma + Telegram Server
│   ├── src/
│   │   ├── ai/evrenLlmGenerator.ts # SSB EVREN GLM-5.3 soru üretim motoru
│   │   ├── telegram/telegramBot.ts # Telegraf Vercel Webhook bot servisi
│   │   ├── db/prismaClient.ts      # Dual Persistence: Supabase PostgreSQL + Bellek İçi Cache
│   │   ├── engine/                 # GameRoomManager, GameStateMachine, Matchmaker
│   │   ├── routes/                 # Auth, Social, Trivia, Telegram, QR REST API
│   │   └── server.ts               # Express bootstrap, Webhook rotaları ve CORS
│   └── test/                       # Birim, entegrasyon ve Telegram bot testleri
├── client/                         # Expo / React Native Çok Platformlu İstemci
│   ├── src/
│   │   ├── theme/tokens.ts         # Mor, lacivert, altın & nane koyu oyun teması
│   │   ├── services/               # Realtime WebSocket, ses (SoundService) ve API
│   │   ├── store/gameStore.ts      # Zustand merkezi durum yönetimi
│   │   ├── components/             # TavrikoIcons, Button3D, TopBar, BottomNav
│   │   ├── screens/                # EventsScreen, ShopScreen, ProLeagueScreen,
│   │   │                           # SeasonScreen, CustomRoomScreen, GameScreen vb.
│   │   └── navigation/             # RootNavigator & sayfa geçişleri
│   └── App.tsx                     # Mobil/Web giriş noktası
├── api/                            # Vercel Serverless Function Giriş Noktası
│   └── index.js                    # Express uygulamasını Vercel Lambda olarak çalıştırır
└── vercel.json                     # Vercel Build & Route yapılandırması
```

---

## 🎮 16 Yarışma Kategorisi

| Kategori | İkon / Renk | Kapsam |
|---|---|---|
| **Coğrafya** | 🌍 `#3B82F6` | Ülkeler, başkentler, coğrafi keşifler, yer şekilleri |
| **Matematik** | 📐 `#10B981` | Aritmetik, geometri, cebir, mantık ve formüller |
| **Genel Kültür** | ✨ `#F59E0B` | Dünya rekorları, popüler kültür, ilginç bilgiler |
| **Tarih** | 🏛️ `#8B5CF6` | Medeniyetler, savaşlar, antlaşmalar, tarihi şahsiyetler |
| **Bilim ve Teknoloji** | 💻 `#06B6D4` | Yazılım, yapay zekâ, donanım, icatlar ve mucitler |
| **Uzay ve Astronomi** | 🚀 `#6366F1` | Gezegenler, galaksiler, uydular ve uzay görevleri |
| **Spor** | ⚽ `#EF4444` | Futbol, basketbol, olimpiyatlar, e-spor ve rekorlar |
| **Sinema ve Dizi** | 🎬 `#EC4899` | Kült yapımlar, yönetmenler, ödüller ve replikler |
| **Müzik** | 🎵 `#14B8A6` | Enstrümanlar, besteciler, yerli & yabancı türler |
| **Edebiyat** | 📖 `#D97706` | Dünya ve Türk klasikleri, şairler, edebi akımlar |
| **Biyoloji** | 🧬 `#22C55E` | Canlılar alemi, anatomi, genetik ve evrim |
| **Fizik ve Kimya** | 🧪 `#A855F7` | Elementler, periyodik tablo, kuantum ve yasalar |
| **Mantık ve Zeka** | 💡 `#E11D48` | Sayı dizileri, akıl yürütme, paradokslar ve bulmacalar |
| **Dil ve Kelime** | 📝 `#0284C7` | Deyimler, atasözleri, etimoloji ve yazım kuralları |
| **Sanat ve Kültür** | 🎨 `#F97316` | Tablolar, heykeller, mimari şaheserler ve müzeler |
| **Karma Mod** | 🎲 `#8B5CF6` | Tüm kategorilerden sürpriz sorular |

---

## ⚡ Skor ve Puanlama Matematiği

$$\text{Puan} = \text{Temel Puan (1000)} + \left(\frac{\text{Kalan Süre}}{\text{Toplam Süre}} \times 500\right) + \text{Seri Bonusu}$$

- **Hız Çarpanı**: 15 saniyelik soruda ilk saniyede doğru cevap veren +500 ek hız puanı kazanır.
- **Seri Bonusu (Streak)**: Art arda gelen her doğru cevap +50, +100, +150 puan katar.
- **Eşitlik Çözümü (Tie-Breaker)**: Eşit puanda toplam cevap süresi (milisaniye) daha düşük olan üst sıraya yerleşir.

---

## 🚀 Kurulum ve Yerel Geliştirme

### Gereksinimler
- Node.js 18+
- npm veya yarn
- (İsteğe bağlı) Wrangler CLI (Cloudflare geliştirmesi için)

### 1. Bağımlılıkları Yükleme
```bash
npm install
npm --prefix shared install
npm --prefix server install
npm --prefix client install
```

### 2. Ortam Değişkenleri (.env)
Kök dizindeki `.env` dosyasını yapılandırın:
```env
PORT=4000
JWT_SECRET=super_secret_tavriko_jwt_key
DATABASE_URL=postgresql://postgres:...@...supabase.co:5432/postgres
TELEGRAM_BOT_TOKEN=123456789:AA...
TELEGRAM_ADMIN_IDS=123456789
EVREN_API_KEY=your_ssb_evren_token
PUBLIC_APP_URL=https://tavriko-app.vercel.app
```

### 3. Paketleri Derleme ve Testleri Çalıştırma
```bash
# Shared paketini derleyin:
npm run build:shared

# Server paketini derleyin:
npm run build:server

# Web istemcisini derleyin:
npm run build:client:web

# Telegram bot testlerini koşturun:
npm --prefix server test -- test/telegramBot.test.ts --forceExit
```

### 4. Geliştirme Sunucularını Başlatma
```bash
# Arka plan sunucusunu başlatın (http://localhost:4000):
npm run dev:server

# Mobil/Web istemciyi başlatın:
cd client && npm run web
```

---

## 🌐 Canlı Dağıtım (Production Deployment)

* **Vercel (Client Web & Serverless API)**:
  `git push origin main` komutu ile Vercel otomatik olarak `vercel.json` derleme komutunu çalıştırır ve `https://tavriko-app.vercel.app/` üzerinde yayına alır.
* **Cloudflare Workers (Realtime DO)**:
  `cloudflare/` dizini altından `npx wrangler deploy` ile `GAME_ROOMS` ve `MATCHMAKER` Durable Objects içeren iş parçacığı canlıya alınır.
* **Telegram Webhook**:
  Canlı dağıtımda `https://tavriko-app.vercel.app/api/telegram/webhook` adresine bağlanır; bot `/start` veya diğer komutları milisaniyeler içinde sunucusuz olarak yanıtlar.

---

## 📄 Lisans

Bu proje özel olarak geliştirilmiştir. Tüm hakları saklıdır.
