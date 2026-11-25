# Animated Nick Cosmetics

Tavriko'daki animasyonlu nick (isim efekti) sistemi. Tek kaynak: `shared/src/nickStyles.ts`.

## Mimari

| Katman | Dosya | Görev |
| --- | --- | --- |
| Kayıt defteri | `shared/src/nickStyles.ts` | `NICK_STYLES`: styleId, ad, açıklama, nadirlik (Nadir/Epik/Efsanevi/Mitik), fiyat, palet, dolgu (`fill`), hareket, parçacık türü. `getNickStyle`, `nickOwnership`, `NICK_PACKS`. |
| Mağaza / kozmetik | `shared/src/types.ts` (`NICK_SHOP_PRODUCTS` → `SHOP_CATALOG`), `shared/src/cosmetics.ts` (`NAME_EFFECT_DEFS`) | Mağaza ürünleri ve profil kozmetik tanımları kayıt defterinden türetilir. |
| Sunucu | `server/src/db/prismaClient.ts` | Satın alma / envanter / kuşanma mevcut `name_` akışını kullanır; `getItemRarity` artık kozmetik tanımındaki nadirliği okur. |
| Merkezi renderer | `client/src/components/nick/NickRenderer.tsx` | `<NickRenderer styleId text style numberOfLines variant />` |
| Skia | `nick/NickSkiaLayer.native.tsx`, `nick/nickShaders.ts` | Görünmez RN `<Text>` satır yerleşimi (onTextLayout) üzerine aynı Nunito glifleri SkSL shader dolgusu + BlurMask parıltısıyla çizilir. Web'de `NickSkiaLayer.tsx` (stub). |
| Lottie | `nick/NickParticles.native.tsx`, `client/assets/lottie/nick/*.json` | Yıldız/kıvılcım/elektrik/kozmik toz/kar parçacıkları; `colorFilters` ile paket renkleri. JSON'lar `scripts/generate-nick-lottie.mjs` ile üretilir. |
| Linear Gradient | `nick/NickPlate.tsx`, `nick/NickPreviewModal.tsx` | Paket plakaları ve önizleme arka planları. |
| Önizleme | `nick/NickPreviewModal.tsx` | Profil, liderlik, maç, sohbet, arkadaş listesinde canlı deneme + kalite seçici. `CosmeticPreviewModal(kind="name")` buna yönlenir. |
| Ortam/kalite | `nick/nickEnv.ts`, `nick/nickQualityCore.ts`, `nick/useNickClock.ts` | Tercih, pil tasarrufu, hareketi azalt, düşük donanım, AppState, ekran-dışı durdurma, eşzamanlı efekt bütçesi. |

Tüm oyuncu adları `PlayerName` (`client/src/components/PlayerCosmetics.tsx`) → `NickRenderer` üzerinden çizilir:
Ana sayfa, profil, liderlik, arkadaşlar, lobi (oyuncu listesi + sohbet balonları), düello giriş, quiz arena,
ara liderlik, maç sonu podyumu, Pro Lig. `AnimatedNameText` (StoreKit) geriye dönük uyumluluk için `NickRenderer`'a yönlenir.

## Kalite seviyeleri

- **full**: Skia shader + parıltı (+ `variant="hero"` için Lottie parçacıkları). Yalnızca iOS/Android.
- **lite**: Reanimated renk döngüsü, 20–24 fps. Web, düşük donanım, pil tasarrufu, bütçe aşımı.
- **static**: Animasyonsuz palet rengi. Ayarlar → Nick Efektleri "Kapalı", "Akıcı Animasyonlar" kapalı veya sistemde "hareketi azalt" açık (Otomatik modda).

Ayarlar → Görsel → **Nick Efektleri**: Otomatik / Tam / Hafif / Kapalı (`UserSettings.nickEffects`, settings JSON'unda saklanır).

Performans kuralları: saat yalnızca nick ekrandayken ve uygulama ön plandayken ilerler (UI thread `measure`, ~12 karede bir);
aynı anda en fazla 12 (düşük donanımda 4) tam kalite nick ve 4 (1) parçacık katmanı çalışır; ekran dışındaki Lottie katmanı sökülür;
yazı tipi ve shader nesneleri modül düzeyinde önbelleklenir; `usePlayerCosmetics` yalnızca ilgili oyuncunun önbellek kaydına abone olur.

## Yeni paket eklemek

1. `shared/src/nickStyles.ts` → `NICK_STYLES` dizisine `name_` önekli yeni kayıt ekle (mevcut `fill` / `particles` türlerinden seç).
2. `npm run build -w shared` (shared `dist` depoya dahildir).
3. Yeni bir dolgu türü gerekiyorsa `NickFill` birleşimine ekle ve `client/src/components/nick/nickShaders.ts` içine SkSL gövdesini yaz.
   `client/src/components/nick/nick.test.ts` tüm shader'ları CanvasKit ile derleyerek doğrular.
4. Yeni parçacık türü için `scripts/generate-nick-lottie.mjs`'e üretici ekleyip `node scripts/generate-nick-lottie.mjs` çalıştır ve `NickParticles.native.tsx` içindeki `SOURCES`'a ekle.

## Veritabanı

Şema değişikliği yoktur. `users.equippedNameEffect` (TEXT), `users.equippedNameEffectExpiresAt` (BIGINT) ve
`user_inventory_items.itemId` zaten styleId saklar. Mevcut kimlikler (`name_glow_gold`, `name_gradient_fire`, `name_gradient_ice`,
`name_gradient_rainbow`, `name_void_shadow`, `name_emerald_vine`, `name_toxic_slime`, `name_candy_heart`, `name_plasma_bolt`)
yeniden kullanıldığı için mevcut satın alımlar, envanterler ve kuşanılmış nickler korunur; yeni paketler yeni kimliklerle eklenir.

## Yerel derleme notu

Skia, Lottie ve Expo Linear Gradient yerel modüldür. Bu sürüm yeni bir yerel derleme (EAS build) gerektirir; bu yüzden
`client/app.json` sürümü 1.1.5 / versionCode 25'e yükseltildi (`runtimeVersion.policy = appVersion`, eski 1.1.4 binary'lerine OTA gitmez).
