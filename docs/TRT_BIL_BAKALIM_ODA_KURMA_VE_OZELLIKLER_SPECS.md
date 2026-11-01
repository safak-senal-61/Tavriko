# 🎮 TRT Bil Bakalım Tersine Mühendislik, Arayüz Analizi ve Özel Oda Özellikleri Spesifikasyonu

Bu doküman, `trt-bil-bakalim.apk` tersine mühendislik incelemesi ve kullanıcının paylaştığı ekran görüntüsü referans alınarak Tavriko için hazırlanmış detaylı mimari ve yapılacaklar listesidir.

---

## 📌 1. Yönetici Özeti ve APK Analizi

İncelenen dosya: `c:\Users\Ömer faruk şener\Downloads\trt-bil-bakalim.apk` (21.93 MB, 1.268 dosya).

### 🔍 Statik Analiz Bulguları:
1. **Paket ve Dağıtım Kimliği:**
   - İndirilen APK dosyasının `AndroidManifest.xml` string havuzunda paket adı `com.aptoide.android.aptoidegames` olarak tespit edilmiştir (Aptoide oyun başlatıcı sarmalayıcısı).
   - Ekran görüntüsü doğrudan **TRT Bil Bakalım** oyununun resmi **Özel Oda Kurma & Kategori Seçimi** ekranına aittir.
2. **Kullanılan Yerel Kütüphaneler ve Motor:**
   - **UI Motoru:** Jetpack Compose (`androidx.compose.ui`, `androidx.compose.animation`, `androidx.compose.foundation`, `androidx.constraintlayout.compose`).
   - **Animasyon Altyapısı:** `Lottie` vektörel animasyon motoru entegre edilmiştir (`assets/like.json`, `assets/love.json`, `assets/laugh.json`, `assets/down.json`, `assets/thug.json`).
   - **Veri & Arka Plan:** `AndroidX Room Database`, `Kotlin Coroutines & Flow`, `Dagger Hilt`.
   - **Mediation & Gelir Modeli:** `AppLovin MAX`, `Google Mobile Ads (AdMob)`, `Unity Ads`, `Vungle`, `InMobi`.

---

## 🎨 2. Görseldeki Arayüzün Mimari ve Piksel Analizi

### 1. Renk Paleti ve Atmosfer:
- **Arka Plan Degradesi:** `#3A1C71` (Zengin Mor) $\rightarrow$ `#5F0A87` (Derin Neon Viyole) arası dikey doğrusal degrade.
- **Kart Zemini (Modal):** Saf Beyaz `#FFFFFF`, $28\text{px}$ yumuşatılmış köşe yarıçapı (`border-radius`), ortam ışığı derinliği.
- **Vurgu Rengi (Aksiyonlar):** Canlı Turkuaz/Mavi degrade (`#00B4DB` $\rightarrow$ `#0083B0`), beyaz ikon ve tipografi.
- **Tipografi:** Yuvarlak hatlı, modern oyun fontu (Nunito / Quicksand / Montserrat Bold).

### 2. Bileşenler & Etkileşimler:
1. **Kategori Dropdown (Açılır Menü):**
   - Transparan buzlu cam arka plan, beyaz "Karışık" (Shuffle) ikonu, "Karışık" metni ve aşağı ok oku.
   - Tıklandığında arka plan kararır (dimming + blur) ve ortada "Kategorini Seç" modalı yaylanarak açılır.
2. **Soru Sayısı Seçimi:**
   - Seçenekler: `[ 7 ]` (Kısa maç), `[ 14 ]` (Standart maç), `[ 21 ]` (Maraton maç).
3. **Süre Seçimi:**
   - Seçenekler: `[ 20sn ]` (Hızlı refleks), `[ 40sn ]` (Düşünme paylı).
4. **"Kategorini Seç" Modalı:**
   - **Segmented Switch (Genel / Özel):**
     - `Genel`: Klasik temel branşlar (Bilim, Tarih, Sanat, Coğrafya, Spor, Edebiyat).
     - `Özel`: Tematik özel soru paketleri (Yeşilçam, 90'lar Pop, Osmanlı Tarihi, Süper Lig Efsaneleri, Dünya Başkentleri vb.).
   - **3D Squircle Kategori Karuseli:**
     - Yatayda akıcı kayan (horizontal center-snapping carousel).
     - **Seçili Kart:** Ortada duran kart (örneğin görseldeki Turuncu/Kırmızı Sanat/Boya Fırçası ikonu) $\%25$ daha büyük (`transform: scale(1.25)`), 3D kabartmalı (`bevel`) ve belirgin renkli gölgeye sahiptir.
     - **Komşu Kartlar:** Yanlardaki kartlar daha küçük (`scale(0.85)`), opaklığı $\%70$'e inmiş durumdadır.
   - **"Tamam" Butonu:**
     - Modalın altında tam ortalanmış turkuaz hap buton.
5. **Alt Lobi Durumu:**
   - `Diğer oyuncular bekleniyor`: Lobiye en az 2 oyuncu katılana kadar hafifçe yanıp sönen (pulsing opacity) metin.
   - `Oyunu Başlat`: Yeterli oyuncu sayısı ve hazır olma durumu oluşana kadar devre dışı, koşullar sağlanınca aktifleşip parlayan ana başlatma butonu.

---

## ⚖️ 3. Tavriko ile TRT Bil Bakalım Karşılaştırmalı Eksik Analizi (Gap Analysis)

| Özellik / Ekran | TRT Bil Bakalım (Mevcut Görsel) | Tavriko (Mevcut Durum) | Durum & Yapılacak İyileştirme |
| :--- | :--- | :--- | :--- |
| **Oda Kurma Düzeni** | Şık lobi ekranı + açılır modal ile parametre seçimi | `CustomRoomScreen.tsx` içinde uzun düz form | 🔴 **Eksik:** Arayüz modal tabanlı TRT yapısına dönüştürülmeli. |
| **Soru Sayısı Seçenekleri** | `7`, `14`, `21` (Hızlı maç matematiği) | `5`, `10`, `15`, `20`, `30` | 🟡 **Farklı:** `7, 14, 21` standart seçenek olarak eklenmeli. |
| **Soru Süresi Seçenekleri** | `20sn`, `40sn` | `10s`, `15s`, `20s`, `30s` | 🟡 **Farklı:** `20sn` ve `40sn` öncelikli kılınmalı. |
| **Kategori Seçim UI** | 3D Squircle Center-Snapping Carousel | Düz emoji kutucukları (yatay scroll) | 🔴 **Kritik Eksik:** Reanimated tabanlı 3D büyüyen squircle karuseli yapılmalı. |
| **Kategori Ayrımı** | `[ Genel \| Özel ]` Sekmeli Mod | Tek parça düz kategori listesi | 🔴 **Eksik:** Genel ve Özel (Tematik) iki ayrı sekme kurulmalı. |
| **İnteraktif Reaksiyonlar** | Lottie reaksiyonları (like, love, laugh, thug) | Reaksiyon sistemi yok | 🔴 **Eksik:** Lobi ve soru aralarında Lottie tepki butonları eklenmeli. |
| **Oda Paylaşımı** | Oda kodu + doğrudan link paylaşımı | Oda kodu kopyalama ve paylaşım var | 🟢 **Mevcut:** Paylaşım altyapısı hazır. |
| **Oyuncu Başlatma Kilidi** | 2 oyuncu olmadan "Oyunu Başlat" deaktif | 2 oyuncu kuralı kodda var ama UI sade | 🟡 **İyileştirme:** "Diğer oyuncular bekleniyor" pulsing animasyonu eklenmeli. |

---

## 🛠️ 4. Kullanılan ve Tavsiye Edilen Teknoloji Yığını

* **Frontend:** React Native (Expo SDK 52), `react-native-reanimated` v3 (3D scaling carousel), `react-native-gesture-handler`, `expo-linear-gradient`, `lottie-react-native` (emoji reaksiyonları).
* **Haptik & Ses:** `expo-haptics` (karusel kart geçişlerinde mikro tıklama), `expo-audio` / `soundService.ts`.
* **Realtime Ağ:** Cloudflare Workers WebSocket / Durable Objects, Upstash Redis Pub/Sub, Supabase Realtime.

---

## 📋 5. Adım Adım Yapılacaklar Listesi (Roadmap)

### Faz 1: "Kategorini Seç" Modalı ve 3D Squircle Karuseli
- [ ] **1.1. 3D Squircle Kategori Bileşeni (`CategorySquircleCard.tsx`):**
  - Squircle köşe yumuşatması, 3D üst parlama ve alt gölge derinliği.
  - Vektörel beyaz ikonlar (Kimya, Tapınak, Boya Fırçası, Küre vb.).
- [ ] **1.2. Center-Snapping Carousel (`CategoryCarousel.tsx`):**
  - Reanimated ile `interpolate`: Merkeze göre $\text{Scale: } 0.85 \rightarrow 1.25$, $\text{Opacity: } 0.6 \rightarrow 1.0$.
  - Kart değişiminde mikro haptik geribildirim.
- [ ] **1.3. Genel / Özel Segment Switch (`SegmentedFilter.tsx`):**
  - "Genel" ve "Özel" arasında kayan degrade hap animasyonu.

### Faz 2: Lobi ve Oda Kurma Ekranının TRT Standartlarına Uyarlanması
- [ ] **2.1. Ekran Yeniden Tasarımı (`CustomRoomScreen.tsx`):**
  - TRT renk paletine geçiş (Kraliyet Moru degrade).
  - Soru sayısı çiplerinin `[ 7 ] [ 14 ] [ 21 ]` yapılması.
  - Süre seçeneklerinin `[ 20sn ] [ 40sn ]` yapılması.
  - Kategori butonuna basıldığında açılan modal yapısının entegre edilmesi.
- [ ] **2.2. Bekleme & Başlatma Durumu (`LobbyScreen.tsx`):**
  - "Diğer oyuncular bekleniyor" pulsing animasyonu.
  - 2 oyuncu olmadan "Oyunu Başlat" butonunun pasif kalması.

### Faz 3: Lottie Reaksiyonları ve Ses Entegrasyonu
- [ ] **3.1. Lobi İçi Lottie Tepki Çubuğu:**
  - Avatar üzerinde patlayan emojiler (`like.json`, `laugh.json`, `love.json`).
- [ ] **3.2. Ses Tasarımı:**
  - Karusel kaydırma tık sesi, buton basma sesi ve modal açılış yaylanma sesi.
