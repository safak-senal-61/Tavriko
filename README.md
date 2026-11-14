<div align="center">

# ⚡ TAVRİKO

### Yeni Nesil Gerçek Zamanlı Multiplayer Bilgi Yarışması

Modern, rekabetçi, stüdyo kalitesinde ve yapay zekâ destekli çok oyunculu (multiplayer) mobil & web bilgi yarışması platformu.

**iOS, Android ve Mobil Web** üzerinde eş zamanlı çalışır.

[![React Native + Expo](https://img.shields.io/badge/React_Native-Expo-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://expo.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Durable_Objects-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![Supabase PostgreSQL](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![Vercel](https://img.shields.io/badge/Vercel-Serverless-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com)

🎮 **[Canlı Web Sürümünü Oyna](https://tavriko-app.vercel.app/)** ·
🤖 **[Telegram Botu](https://tavriko-app.vercel.app/api/telegram/webhook)** ·
⚡ Realtime: `wss://tavriko-realtime.uncertainidentity8.workers.dev/ws`

</div>

---

## 🌐 Erişilebilir Sayfalar

### Oyun

| Sayfa | Adres | Açıklama |
|---|---|---|
| 🎮 **Web Oyun** | [tavriko-app.vercel.app](https://tavriko-app.vercel.app/) | Tarayıcıdan direkt oynanabilir sürüm |
| 📱 **Oyun (/app)** | [tavriko-app.vercel.app/app](https://tavriko-app.vercel.app/app) | Aynı oyun, kalıcı bağlantı |
| ⚡ **Kısa Yol** | [/play](https://tavriko-app.vercel.app/play) · [/game](https://tavriko-app.vercel.app/game) | Oyuna yönlendiren kısa adresler |
| 🤝 **Odaya Hızlı Katılım** | `?joinRoom=KOD` | `https://tavriko-app.vercel.app/?joinRoom=KOD` ile tek tıkla özel odaya giriş |

### Yasal Metinler ve KVKK

| Sayfa | Adres |
|---|---|
| 📚 Tüm Yasal Metinler | [tavriko-app.vercel.app/legal](https://tavriko-app.vercel.app/legal) |
| 🔔 KVKK Aydınlatma Metni | [/aydinlatma-metni](https://tavriko-app.vercel.app/aydinlatma-metni) |
| 🔒 Gizlilik Politikası | [/gizlilik-politikasi](https://tavriko-app.vercel.app/gizlilik-politikasi) |
| 📜 Kullanım Koşulları | [/kullanim-kosullari](https://tavriko-app.vercel.app/kullanim-kosullari) |
| 💳 Satış Sözleşmesi | [/satis-sozlesmesi](https://tavriko-app.vercel.app/satis-sozlesmesi) |
| 🍪 Çerez Politikası | [/cerez-politikasi](https://tavriko-app.vercel.app/cerez-politikasi) |
| 🛡️ Topluluk Kuralları | [/topluluk-kurallari](https://tavriko-app.vercel.app/topluluk-kurallari) |
| 🗑️ **Hesabımı Sil** | [/remove-account](https://tavriko-app.vercel.app/remove-account) |

> `/remove-account` sayfasından e-posta + doğrulama kodu ile tüm verilerinizi (profil, cüzdan, kozmetikler, maç geçmişi, arkadaş listesi) kalıcı olarak silebilirsiniz — KVKK uyumlu.

### Yönetim ve API

| Sayfa | Adres |
|---|---|
| 🔐 Yönetim Portalı | [tavriko-app.vercel.app/admin/login](https://tavriko-app.vercel.app/admin/login) |
| 📡 Yasal Metinler API (JSON) | [tavriko-app.vercel.app/api/legal](https://tavriko-app.vercel.app/api/legal) |

---

## 🌟 Öne Çıkan Sistemler ve Özellikler

### 1. ⚔️ Gerçek Zamanlı Multiplayer ve Eşleşme
- **Cloudflare Durable Objects ve Native WebSockets**: Düşük gecikmeli, küresel dağıtık gerçek zamanlı oda ve eşleşme motoru (`GAME_ROOMS` ve `MATCHMAKER` Durable Objects).
- **Hızlı Eşleşme (1v1 Quick Match)**: Tek dokunuşla radar animasyonlu 2 oyunculu eşleşme.
- **Yapay Zekâ Bot Rakip Desteği**: Gerçek oyuncu bulunamadığında otomatik devreye giren, insansı gecikmeyle cevap veren bilgisayar rakip.
- **Arkadaşlarla Özel Oda (Custom Room)**: 6 haneli oda koduyla anında özel lobi, doğrudan katılım bağlantısı paylaşımı.
- **Kesintisiz Bağlantı Deneyimi**: İnternet kesildiğinde şık bir animasyon belirir, oyuna kısa bir koruma süresi tanınır; süre dolarsa oyuncu nazikçe maça alınır — akış bozulmadan geri dönüş sağlanır.

### 2. 🏆 Pro Lig ve Sezon 1: Bilgi Çağı
- **7 Aşamalı Lig Sistemi**: Bronz, Gümüş, Altın, Platin, Elmas, Şampiyon ve Efsane.
- **Yükselme ve Düşme Potası**: Haftalık puanlama, ilk 3 için podyum (`🥇 🥈 🥉`) ve sezon sonu ödülleri.
- **50 Kademeli Savaş Bileti (Season Pass)**: Ücretsiz ve Premium kulvarlar, Sezon XP ile açılan mitolojik kozmetikler, altın, elmas ve sandıklar. Sezon kozmetikleri 30 gün süreyle kuşanılır.

### 3. 💎 WePlay Tarzı Süreli Kozmetikler ve Temalar
- **Çalışan Rozetler**: Mağazadan alınan rozetler profil kartında gerçek görselleriyle görünür; süre sayaçlarıyla birlikte kuşanılır.
- **İsim Efektleri**: Parıltı, ateş gradyanı, zümrüt, şeker, void, plazma dahil 8+ animasyonlu isim efekti.
- **Güçlendirici İksirler**: 2x/3x XP ve 2x Altın iksirleri — kullanınca süresi başlar, maç ödüllerine uygulanır, üst üste kullanım süreyi uzatır.
- **PRO/VIP Arka Planlar**: Kuşanılan arka plan yalnızca duvar değil — tüm arayüzün vurgu renkleri (butonlar, parlamalar, çubuklar) arka plan temasına bürünür; süre bitince otomatik eski haline döner.
- **Esnek Süre Seçimi**: Kozmetikler 1 saat, 1 gün, 3 gün, 1 hafta veya 1 aylık alınabilir; fiyat süreye göre ölçeklenir.
- **Envanterden Kuşanma**: Kuşanınca süre başlar, altındaki bar dolunca kozmetik otomatik düşer.

### 4. 📅 Canlı Etkinlikler ve Görev Takibi
- **3 Dinamik Görev Kategorisi**: Günlük Görevler, Haftalık Hedefler ve Özel Turnuvalar.
- **Gerçek Zamanlı İlerleme**: Görevler "BAŞLA" dendikten sonra aktifleşir; yalnızca oturumdaki ilerleme kaydedilir.
- **Tek Tıkla Ödül Toplama**: `TOPLA` butonuyla ses ve haptik eşliğinde anında ödül.

### 5. 🛒 Tavriko Mağazası, Envanter ve Sandıklar
- **11 Ürün Kategorisi**: Öne Çıkanlar, Elmas Paketleri, Altın Keseleri, Sandıklar, Anahtarlar, Avatarlar, Çerçeveler, Rozetler, İsim Efektleri, Güçlendiriciler ve Arka Planlar.
- **Sandık Açma Sistemi**: Anahtarlarla açılan sandıklar, parıltı animasyonları ve rastgele kozmetik düşürme.
- **Her Ürünün Gerçek Görseli**: Envanter ve sezon ödüllerinde her ürün türü kendi görselini kullanır (animasyonlu çerçeveler, isim efektleri, arka plan önizlemeleri).

### 6. 👥 Arkadaşlık ve Profil Sistemi (KVKK Uyumlu)
- **Arkadaş Kodu ve Davet**: `TV-XXXXX` koduyla arkadaş ekleme, düello istekleri, canlı çevrimiçi durumu.
- **Tam Ekran Arkadaş Profili**: Arkadaşının profili kendi profil sayfan gibi görünür; ancak Ayar ve Hesap bölümleri, düzenleme butonları KVKK gereği gizlidir.
- **Arkadaşın Teması**: Görüntülediğin kişinin kuşandığı arka plan ve tema renkleri profilinde aynen yansır.
- **Rozet ve Kozmetik Önizleme**: Rozete basınca isim, açıklama ve kalan süre pencerede açılır.
- **Kalıcı Hesap Silme**: `/remove-account` sayfasından veya ayarlardan tüm veriler veritabanından kalıcı olarak silinir.

### 7. 🤖 SSB EVREN GLM-5.3 ve Gemini Yapay Zekâ Soru Motoru
- T.C. SSB EVREN platformu **GLM-5.3** ve **Google Gemini** LLM modelleriyle 16 kategoride dinamik soru üretimi.
- Otomatik içerik karmaşıklığı analizi, 4 seçenekli şık dengelemesi, açıklama ve doğrulama kaynağı kontrolü.

### 8. 📱 Telegram Yönetim ve Topluluk Botu
- **Vercel Serverless Uyumlu Webhook**: `POST /api/telegram/webhook`.
- **Hedef Soru Havuzları**: `[✅ Normal Kategoriye Al]`, `[📅 Günlük Meydan Okuma]`, `[⚔️ Özel Oda / Arkadaş]`.
- **Topluluk Komutları**: `/profil`, `/lig`, `/siralama`, `/oda_kur`, `/gunun_sorusu`, `/quiz`, `/soru_uret`, `/ara_soru` ve daha fazlası.

---

## 🗺️ Yol Haritası (Roadmap)

### ✅ Tamamlananlar

<details open>
<summary><b>🚀 Çekirdek Sistem</b></summary>

- [x] Gerçek zamanlı multiplayer altyapısı (Cloudflare Durable Objects + WebSockets)
- [x] 1v1 hızlı eşleşme + radar animasyonu
- [x] Yapay zekâ bot rakip desteği (insansı gecikme)
- [x] Özel odalar (6 haneli kod + hızlı katılım bağlantısı)
- [x] 7 aşamalı Pro Lig sistemi (Bronz → Efsane)
- [x] 50 kademeli Sezon Bileti (ücretsiz + premium kulvar)
- [x] Canlı etkinlikler: günlük görevler, haftalık hedefler, turnuvalar
- [x] 16 kategori + karma mod, AI soru üretim motoru
- [x] Telegram yönetim ve topluluk botu
- [x] Günlük meydan okuma sistemi
- [x] Skor matematiği: hız bonusu, seri çarpanı, eşitlik çözümü

</details>

<details open>
<summary><b>💎 Ekonomi ve Kozmetikler</b></summary>

- [x] 11 kategorili mağaza (elmas, altın, sandık, anahtar, avatar, çerçeve, rozet, isim efekti, iksir, arka plan)
- [x] Sandık açma ve rastgele kozmetik düşürme sistemi
- [x] WePlay tarzı süreli kozmetikler (rozetler, isim efektleri, iksirler)
- [x] Çalışan rozetler: gerçek görseller + profil kartında süre sayacı
- [x] 8+ animasyonlu isim efekti (parıltı, ateş, zümrüt, şeker, void, plaza…)
- [x] Güçlendirici iksirler: 2x/3x XP, 2x Altın (1 saat / 24 saat)
- [x] PRO/VIP arka planlar: tüm arayüzün vurgu renklerini değiştirir
- [x] Esnek süre seçimi: 1 saat / 1 gün / 3 gün / 1 hafta / 1 ay
- [x] Envanterden kuşanma + süre barı + otomatik düşme
- [x] Her ürün türü için gerçek önizleme görselleri (envanter + sezon)

</details>

<details open>
<summary><b>🛡️ Güvenlik, KVKK ve Deneyim</b></summary>

- [x] Kayıt sırasında zorunlu yasal metin onayı (sunucu tarafında doğrulanır)
- [x] Tüm yasal metinler için herkese açık web sayfaları (`/legal`, `/aydinlatma-metni`…)
- [x] `/remove-account` web sayfası: e-posta + doğrulama kodu ile tüm verilerin kalıcı silinmesi
- [x] Veritabanı öncelikli hesap silme (maç geçmişi, arkadaş listeleri, kodlar dahil)
- [x] Salt-okunur arkadaş profili görünümü (ayarlar/hesap bölümleri gizli)
- [x] Arkadaşın kuşandığı arka plan ve temanın profilinde yansıması
- [x] İnternet kesintisinde şık animasyon + koruma süresi + nazik çıkış
- [x] Cüzdan sahteciliğine karşı sunucu-otoriter ekonomi modeli
- [x] Kullanıcı sayımını (enumeration) engelleyen güvenli kimlik doğrulama

</details>

### 🚀 Eklenebilecek Yeni Özellikler

<details open>
<summary><b>🎮 Oynanış</b></summary>

- [ ] **2v2 ve Takım Modları (3v3)**: Arkadaşınla aynı takımda lig maçları
- [ ] **Turnuva Modu**: Eleme usulü (bracket) 8/16/32 kişilik turnuvalar, ödül havuzları
- [ ] **İzleyici (Spectator) Modu**: Canlı maçları izleme + yorum satırı
- [ ] **Maç Tekrarları (Replay)**: Podyum sonrası maçın özet kaydı
- [ ] **Günlük Çark (Spin Wheel)**: Ücretsiz günlük ödül çarkı
- [ ] **Mini Oyunlar**: Kelime avı, hızlı yazma düellosu, hafıza eşleştirme
- [ ] **Dinamik Zorluk (Adaptif AI)**: Yapay zekânın oyuncu seviyesine göre soru seçmesi
- [ ] **Sorulan Zaman Modu**: 60 saniyede kaç doğru? Blitz modu
- [ ] **Topluluk Soru Havuzu**: Oyuncuların soru önermesi + moderasyon akışı
- [ ] **Revans (Rövanş) Sistemi**: Kaybedilen maçtan sonra tek tıkla rövanş
- [ ] **Dostluk Maçı Kazanımları**: Arkadaş maçlarında küçük ödüller
- [ ] **Bilgi Maratonu (Endless)**: Seri bozulana kadar süren tek kişilik mod

</details>

<details open>
<summary><b>👥 Sosyal</b></summary>

- [ ] **Klan / Lonca Sistemi**: Klan kurma, klan savaşları, klan ligleri
- [ ] **Klan Savaşları**: Haftalık klan vs klan toplam puan yarışı
- [ ] **Sesli Sohbet / Hızlı Mesajlar**: Maç içi önceden tanımlı hızlı mesajlar
- [ ] **Arkadaş Karşılaştırma**: İstatistiklerini arkadaşınla yan yana karşılaştırma
- [ ] **Düello Geçmişi**: Arkadaşınla olan tüm maçların kaydı ve skor tablosu
- [ ] **Profil Bannerları ve Galeri**: Kazanılan anlara ayrılmış vitrin bölümü
- [ ] **Emote / Tepki Sistemi**: Maç içi emoji ve tepkiler
- [ ] **Günün Oyuncusu**: Toplulukta günün en iyisi vitrini

</details>

<details open>
<summary><b>💎 Ekonomi ve Kozmetik</b></summary>

- [ ] **Oyuncu Pazarı**: Kozmetik takası ve satış (kırılmaz eşya modeli)
- [ ] **Kozmetik Setleri**: Aynı setin parçalarını toplayınca koleksiyon bonusu
- [ ] **Kozmetik Üretimi (Crafting)**: Fazla kozmetikleri birleştirip yeni kozmetik üretme
- [ ] **Sezon Mirası (Legacy) Kozmetikleri**: Eski sezon kozmetiklerini açma anahtarı
- [ ] **Avatar Animasyonları**: Maç başında oynatan giriş animasyonları
- [ ] **Profil Müzikleri**: Profile girenlerde çalan tema müzikleri
- [ ] **Sınırlı Üretim (Limited Edition) Kozmetikler**: Sezonla birlikte yok olan nadir eşyalar
- [ ] **Ödül Sandığı Serileri**: Temalı sandık setleri (mitoloji, uzay, korsan…)

</details>

<details open>
<summary><b>🛡️ Güvenlik ve Platform</b></summary>

- [ ] **PWA Desteği**: Telefona kurulabilir web uygulaması + offline maç modu
- [ ] **Push Bildirimleri**: Düello istekleri, görev hatırlatmaları, sezon duyuruları
- [ ] **Çoklu Dil (i18n)**: İngilizce ve diğer diller
- [ ] **Erişilebilirlik**: Sesli okuma, renk körlüğü modu, büyük yazı tipi
- [ ] **Anti-Cheat Geliştirmeleri**: Cevap süresi anomalisi tespiti, davranış analizi
- [ ] **Hesap Bağlama**: E-posta ↔ Google hesap birleştirme
- [ ] **İki Adımlı Doğrulama (2FA)**: Hesap güvenliği
- [ ] **Doğrulanmış Rozetler**: Gerçek kimlik doğrulaması

</details>

<details open>
<summary><b>🤖 Yapay Zekâ</b></summary>

- [ ] **AI Maç Analizi**: Güçlü ve zayıf kategorilerinin AI analizi
- [ ] **Kişisel Soru Tavsiyeleri**: Eksik kategorilere göre çalışma önerileri
- [ ] **AI Maç Özeti**: Maç sonrası otomatik yazılan renkli özet
- [ ] **Daha Zeki Botlar**: Oyuncu seviyesine uyum sağlayan bot rakipler

</details>

<details open>
<summary><b>📡 Dağıtım</b></summary>

- [ ] **App Store (iOS) ve Google Play** yayını
- [ ] **Discord Botu**: Sunucu içi lig tablosu ve quiz entegrasyonu
- [ ] **Canlı Quiz Şovları**: Toplulukla aynı anda oynanan canlı etkinlikler
- [ ] **Ekip/Destek Sistemi**: Oyun içi bildirim ve destek talebi

</details>

---

## 🏗️ Mimari Yapı

```
Tavriko/
├── shared/                         # Ortak TypeScript tipleri, kontratlar ve formüller
│   ├── src/
│   │   ├── types.ts                # Soru, Oyuncu, Lig, Mağaza, Etkinlik, Pass tipleri
│   │   ├── legal.ts                # KVKK ve yasal metin içerikleri
│   │   ├── cosmetics.ts            # Kozmetik tanımları (rozet, çerçeve, isim efekti…)
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
│   │   ├── routes/                 # Auth, Social, Trivia, Telegram, QR, Legal REST API
│   │   └── server.ts               # Express bootstrap, Webhook rotaları ve CORS
│   └── test/                       # Birim, entegrasyon ve Telegram bot testleri
├── client/                         # Expo / React Native Çok Platformlu İstemci
│   ├── src/
│   │   ├── theme/tokens.ts         # Mor, lacivert, altın & nane koyu oyun teması
│   │   ├── services/               # Realtime WebSocket, ses (SoundService) ve API
│   │   ├── store/gameStore.ts      # Zustand merkezi durum yönetimi
│   │   ├── components/             # TavrikoIcons, Button3D, TopBar, BottomNav, StoreKit
│   │   ├── screens/                # Events, Shop, ProLeague, Season, Profile, Friends…
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

- **Vercel (Client Web & Serverless API)**: `git push origin main` komutuyla Vercel otomatik olarak `vercel.json` derleme komutunu çalıştırır ve `https://tavriko-app.vercel.app/` üzerinde yayına alır.
- **Cloudflare Workers (Realtime DO)**: `cloudflare/` dizini altından `npx wrangler deploy` ile `GAME_ROOMS` ve `MATCHMAKER` Durable Objects içeren iş parçacığı canlıya alınır.
- **Telegram Webhook**: Canlı dağıtımda `https://tavriko-app.vercel.app/api/telegram/webhook` adresine bağlanır; bot `/start` veya diğer komutları milisaniyeler içinde sunucusuz olarak yanıtlar.

---

## 📄 Lisans

Bu proje özel olarak geliştirilmiştir. Tüm hakları saklıdır.

<div align="center">
  <sub>Built with ⚡ by <b>Tavriko Team</b></sub>
</div>
