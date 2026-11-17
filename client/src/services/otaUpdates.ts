/**
 * EAS Update (OTA) servisi.
 *
 * Acil yama kanalı: mağaza onayı beklemeden JS düzeltmelerini
 * kullanıcılara ulaştırır (ör. webp→png tarzı görsel hotfix'leri).
 *
 * Davranış:
 * - Yalnızca üretim derlemelerinde çalışır (Expo Go / dev / web'de no-op).
 * - Açılışta güncelleme kontrolü yapar; varsa indirir ve uygulamayı
 *   yeniden yükler. Hata durumunda sessizce susar — oyunu etkilemez.
 *
 * Not: OTA, updates yapılandırmasını içeren bir EAS derlemesine
 * (channel: production/preview) kurulduktan sonra etkinleşir.
 */
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

/** OTA güncellemesi varsa indirip uygular; yoksa/eksiğinde sessiz kalır. */
export async function checkAndApplyOtaUpdate(): Promise<void> {
  // Expo Go, geliştirme modu ve web'de OTA kapalı.
  if (__DEV__ || Platform.OS === 'web') return;

  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return;

    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
  } catch {
    // Ağ hatası, sunucu ulaşılamaz vb. — sessizce no-op.
  }
}
