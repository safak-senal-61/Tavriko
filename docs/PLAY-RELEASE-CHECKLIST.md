# Tavriko Android yayın kontrolü

## Paket ve servisler

- `main` üzerinden **Android AAB (local EAS build)** işini çalıştırın. EAS Android sürüm kodunu uzaktan artırır. Önceki `versionCode 16` paketi son PR #72 değişikliklerini içermez. Üretilen `1.1.2` paketinin sürüm kodunu ve çalıştırmanın commit’ini doğrulayın.
- `1.1.2` ayrı bir Expo runtime’dır. Google/AdMob değişikliklerini içeren paketi eski `1.1.1` runtime’ına OTA olarak göndermeyin.
- Supabase’in izinli OAuth dönüş adreslerinde hem `https://tavriko-app.vercel.app/api/auth/google/callback` hem `tavriko://auth-callback` olmalı. Web ve Android’de gerçek bir Google test hesabıyla ilk giriş, yeniden giriş ve iptali doğrulayın. Eski cihazlardan gelen OAuth günlüklerini sunucu atar. Önceki üretim günlüklerine erişimi ve saklama süresini olay müdahalesi kapsamında inceleyin; somut maruziyet saptanırsa etkilenen oturumlarla ilgili işlem yapın.
- Vercel’den ayrı olarak aynı commit’i `npm run build:shared && npm run deploy:cloudflare` ile realtime Worker’a dağıtın. İki istemciyle hazır mesajları, eski istemciden serbest metnin reddini, engellemeyi ve varsayılan avatarı doğrulayın. Yönetim panelinde **Oyuncu bildirimi** destek kayıtlarının incelenmesi için bir sorumlu belirleyin.
- Gerçek ödüllü reklamları [SSV ve migrasyon kontrolü](./REWARDED-ADS-ROLLOUT.md) bitene kadar kapalı tutun. Hedef kitleye çocuklar dahilse reklamı etkinleştirmeden önce [Families şartlarını](https://support.google.com/googleplay/android-developer/answer/9893335) ve yaş ekranını tamamlayın.

## Play Console ve cihaz testi

- Veri Güvenliği, reklam beyanı (`AD_ID` dahil), hedef kitle, IARC, inceleme hesabı ve geçerliyse [test erişimi koşullarını](https://support.google.com/googleplay/android-developer/answer/14151465) tamamlayın.
- Hesap silme URL’si olarak `https://tavriko-app.vercel.app/remove-account` kullanın. Test hesabıyla e-posta kodu teslimini ve kalıcı silmeyi hem uygulama içinden hem webden kontrol edin. [Hesap silme politikası](https://support.google.com/googleplay/android-developer/answer/13327111)
- [16 KB cihaz veya emülatörde](https://developer.android.com/guide/practices/page-sizes) paketi açın; giriş, lobi, kamera/avatar ve bildirim akışlarını deneyin. Kaynak manifestte değil, son AAB’de birleşik izinleri ve gerçek sürüm değerlerini esas alın.
- Temiz kurulumda giriş ekranı ve misafir modunda kullanım analitiği istemi görünmemeli. Gerçek bir hesapla giriş yapıp yasal akışı bitirdikten sonra kabul ve ret akışlarını ayrı ayrı deneyin. Olay akışında aynı açılışta bir `session_start` ve onay sonrası bir maç olayı görünmeli; Ayarlar > Gizlilik’ten onay kapatılınca yeni olay görünmemeli.
- Anlık bildirimleri önce reddedin; tekrar ön plana dönmek sistem izin penceresini açmamalı. Ayarlar > Anlık Bildirimler’den izin verin, cihaz ayarlarından döndüğünüzde durumun `Açık` olduğunu görün ve ikinci test hesabından gelen bir düello davetini ön planda ve arka planda deneyin. FCM’nin sağlık yanıtında etkin görünmesi tek başına cihaz teslimatı kanıtı değildir.
- Hata izleme için istemciyi ve sunucuyu ayrı test edin. Test ortamında, planlı bir hatanın doğru projeye ve ortama düştüğünü doğrulayın; sunucunun Sentry/GlitchTip DSN durumu istemciyi kapsamaz.
