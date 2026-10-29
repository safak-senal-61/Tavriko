# ⚡ TriviaVerse — Yeni Nesil Multiplayer Bilgi Yarışması

Modern, rekabetçi, stüdyo kalitesinde gerçek zamanlı çok oyunculu (multiplayer) mobil bilgi yarışması platformu.

iOS, Android ve Mobil Web üzerinde eş zamanlı çalışacak şekilde **React Native & Expo**, **TypeScript**, **Node.js (Socket.IO + Express)** mimarisiyle geliştirilmiştir.

---

## 🌟 Öne Çıkan Özellikler

- **Yetkili (Authoritative) Sunucu Motoru**: İstemci tarafına güvenmeyen, sunucu kontrollü soru sayaçları, cevap kilitleme, anlık puan ve hız çarpanı hesaplaması, anti-cheat doğrulaması.
- **16 Kategori & 4 Zorluk Seviyesi**: Coğrafyadan Mantık ve Zeka sorularına, Bilim & Teknolojiden Edebiyata kadar 16 özgün kategori, her birine özel renk temaları ve ikonlar.
- **Gerçek Zamanlı Multiplayer Modları**:
  - **Hızlı Eşleşme (Quick Match)**: Tek dokunuşla radar animasyonlu eşleştirme.
  - **Arkadaşlarla Oyna (Private Custom Rooms)**: 6 haneli özel oda kodu, anlık davet ve lobi kontrolü.
  - **Herkes Herkese Karşı (Free-for-All)**: Çok oyunculu eş zamanlı rekabet.
  - **Takım Savaşı (Team Battle)**: Kırmızı vs Mavi takım puanlaması.
  - **Günün Meydan Okuması (Daily Challenge)**: Günlük seri takibi ve 2x XP ödülü.
  - **Tek Kişilik Pratik (Solo Practice)**: Kategori ve zorluk seçerek tek başına öğrenme.
- **22 Bütünlüklü Oyun Ekranı**: Açılış animasyonundan aktif soru arenasına, canlı podyumdan bildirimler ve ayarlara kadar eksiksiz UI/UX.
- **Ses & Haptik Tasarımı**: Doğru/yanlış cevap sesleri, sayaç tik-takları, arpejler ve titreşim geri bildirimleri.

---

## 🏗️ Mimari Yapı

```
gmae/
├── shared/                     # Paylaşılan TypeScript modelleri, kontratlar ve skor formülleri
│   ├── src/
│   │   ├── types.ts            # Kategori, Soru, Oyuncu, Oda, Lig tipleri
│   │   ├── events.ts           # Socket.IO Event sabitleri
│   │   ├── scoring.ts          # Hız bonusu, seri çarpanı, sıralama algoritması
│   │   └── categories.ts       # 16 kategori metadata ve renk paleti
│   └── test/
├── server/                     # Node.js + Express + Socket.IO Authoritative Server
│   ├── src/
│   │   ├── engine/
│   │   │   ├── GameRoomManager.ts   # Oda yaşam döngüsü, timer, soru akışı
│   │   │   ├── GameStateMachine.ts  # Durum makinesi (Lobby -> Active -> Result)
│   │   │   └── Matchmaker.ts        # Eşleştirme kuyruğu & radar eşleşmesi
│   │   ├── socket/
│   │   │   └── socketHandler.ts     # Gerçek zamanlı socket kanalları
│   │   ├── db/
│   │   │   ├── dbAdapter.ts         # Dual persistence & JWT auth
│   │   │   └── questionsData.ts     # Genişletilebilir 16 kategori soru havuzu
│   │   ├── routes/                  # Auth, Categories, Questions, Leaderboards REST API
│   │   └── server.ts                # Server bootstrap & CORS
│   └── test/                        # Birim, REST API ve Çoklu İstemci simülasyon testleri
├── client/                     # Expo / React Native Çok Platformlu İstemci
│   ├── src/
│   │   ├── theme/tokens.ts          # Dark gaming UI tasarım tokenları
│   │   ├── services/
│   │   │   ├── socketService.ts     # Socket.IO singleton istemcisi
│   │   │   └── soundService.ts      # Web Audio & Haptics motoru
│   │   ├── store/gameStore.ts       # Zustand merkezi oyun ve oturum durumu
│   │   ├── screens/                 # 22 Ekran bileşeni
│   │   └── navigation/RootNavigator.tsx # Ana yönlendirme ve durum köprüsü
│   └── App.tsx                      # Mobil/Web Giriş Noktası
└── scripts/
    └── run-all-tests.bat            # Tüm monorepo testlerini tek tıkla çalıştıran script
```

---

## 🎮 16 Kategori Listesi

| Kategori | İkon / Renk | Açıklama |
|---|---|---|
| **Coğrafya** | 🌍 `#3B82F6` | Dünya haritası, ülkeler, başkentler, nehirler |
| **Matematik** | 🔢 `#10B981` | Aritmetik, geometri, cebir, mantık ve formüller |
| **Genel Kültür** | ✨ `#F59E0B` | Günlük hayat, genel bilgiler, rekorlar |
| **Tarih** | 🏛️ `#8B5CF6` | Medeniyetler, savaşlar, tarihi liderler |
| **Bilim ve Teknoloji** | 💻 `#06B6D4` | Yazılım, yapay zeka, icatlar, dijital dünya |
| **Uzay ve Astronomi** | 🚀 `#6366F1` | Gezegenler, galaksiler, kara delikler |
| **Spor** | 🏆 `#EF4444` | Futbol, basketbol, olimpiyatlar, tenis |
| **Sinema ve Diziler** | 🎬 `#EC4899` | Kült filmler, Oscar ödülleri, replikler |
| **Müzik** | 🎵 `#14B8A6` | Sanatçılar, albümler, enstrümanlar |
| **Edebiyat** | 📖 `#D97706` | Dünya klasikleri, şairler, edebi akımlar |
| **Biyoloji** | 🧬 `#22C55E` | Canlılar alemi, anatomi, genetik |
| **Fizik ve Kimya** | ⚛️ `#A855F7` | Atomlar, periyodik tablo, kuantum fiziği |
| **Mantık ve Zeka** | 🧠 `#E11D48` | Akıl oyunları, sayı dizileri, bulmacalar |
| **Dil ve Kelime** | ✍️ `#0284C7` | Etimoloji, deyimler, sözcük dağarcığı |
| **Sanat ve Kültür** | 🎨 `#F97316` | Tablolar, heykeller, müzeler, mimari |
| **Karma Mod** | 🔀 `#8B5CF6` | Tüm kategorilerden rastgele sürpriz sorular |

---

## ⚡ Skor ve Puanlama Formülü

$$\text{Puan} = \text{Temel (1000)} + \text{Hız Bonusu (Kalan Süre / Toplam Süre } \times 500) + \text{Seri Bonusu}$$

- **Hız Bonusu**: 15 saniyelik soruda anında cevap veren +500 ek hız puanı alır.
- **Seri Bonusu**: Art arda gelen her doğru cevap +50, +100, +150 puan kazandırır.
- **Eşitlik Bozma (Tie-Breaker)**: Eşit puan alan yarışmacılarda ortalama cevap verme süresi (milisaniye cinsinden) daha düşük olan oyuncu üst sırada yer alır.

---

## 🚀 Hızlı Başlangıç

### 1. Testleri Çalıştırma
```bash
# Tüm paketlerin (shared, server, client) testlerini tek komutla koşturun:
scripts\run-all-tests.bat
```

### 2. Sunucuyu Başlatma
```bash
cd server
npm start
# Sunucu http://localhost:4000 adresinde ayağa kalkar (REST + Socket.IO)
```

### 3. Mobil / Web İstemciyi Başlatma
```bash
cd client
# Web tarayıcısında anında çalıştırmak için:
npm run web

# Expo Go ile Android veya iOS cihazınızda çalıştırmak için:
npm start
```
