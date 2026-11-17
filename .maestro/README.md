# Tavriko E2E — Maestro

3 kritik akış (yol haritası 4. hafta maddesi):

| Akış | Dosya | Ne doğrular |
|---|---|---|
| Giriş | `login.yaml` | Kayıtlı hesapla giriş → ana ekran (OYNA) |
| Hızlı eşleşme | `quick-match.yaml` | OYNA → radar ekranı → aramayı iptal → ana ekran |
| Bot maçı | `bot-match.yaml` | OYNA → bot rakip → ilk 3 soru cevaplama akışı |

## Kurulum

1. [Maestro'yü kurun](https://maestro.dev/getting-started/installing-maestro):
   ```bash
   curl -Ls "https://get.maestro.mobile.dev" | bash
   ```
2. Android emülatörü veya iOS simülatörü başlatın (maaşlı cihaz da olur).
3. Test hesabı oluşturun (e-posta + şifre) ve canlı/sunucu ortamına kaydolun.

## Çalıştırma

`APP_ID` = derlenen uygulamanın paket adı (`com.tavriko.app`):

```bash
# Tek akış
maestro test -e APP_ID=com.tavriko.app -e EMAIL=test@ornek.com -e PASSWORD=Sifre123 .maestro/login.yaml

# Tüm akışlar
maestro test -e APP_ID=com.tavriko.app -e EMAIL=test@ornek.com -e PASSWORD=Sifre123 .maestro/
```

Önemli: testID'ler (`login-email-input`, `home-play-button`, `matchmaking-cancel-button`,
`quiz-option-0..3`) bu değişiklikle koda eklendi — akışların seçicilere
dokunabilmesi için **yeni bir derleme** gerektirir (Expo Go'da da
çalışır, çünkü testID Expo Go'da da basılır; ancak gerçek cihaz
deneyimi için development build önerilir).

Not: `bot-match.yaml` canlı sunucuya bağlanır (bot'a düşme süresi
feature flag'i `matchmaking-bot-fallback-sec`, varsayılan 7 sn). Akışı
yerel sunucuya karşı çalıştırmak için `EXPO_PUBLIC_*` ortam
değişkenlerini derleme sırasında yönlendirin.

## Sonuçları CI'ya bağlama (ileride)

GitHub Actions fatura kilidi çözülünce, emülatör başlatan bir iş
(`reactivecircus/android-emulator-runner`) akışları PR başına
çalıştırabilir. Şimdilik akışlar lokalde elle çalıştırılır.
