// Expo config plugin: bildirim sesini APK içine (android/app/src/main/res/raw)
// kopyalar. Android bildirim kanalları `sound: 'notification.wav'` ile bu
// kaynağa başvurur (expo-notifications SoundResolver uzantıyı atıp
// raw/notification kaynağını arar).
//
// Kaynak: client/native-sounds/notification.wav
// (assets/ dışında tutulur — CDN manifesti yalnızca assets/ içeriğini
// listeler, test bu pariteyi doğrular.)
// Amaç: res/raw klasörü Expo managed workflow'da sürüm kontrolünde tutulmaz;
// EAS build sırasında prebuild bu plugin sayesinde dosyayı yerleştirir.

const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const SOUND_FILE = 'notification.wav';

function withNotificationSound(config) {
  return withDangerousMod(config, [
    'android',
    (modConfig) => {
      const { projectRoot, platformProjectRoot } = modConfig.modRequest;
      const source = path.join(projectRoot, 'native-sounds', SOUND_FILE);
      const rawDir = path.join(platformProjectRoot, 'app', 'src', 'main', 'res', 'raw');

      if (!fs.existsSync(source)) {
        throw new Error(
          `[notification-sound] ${source} bulunamadı — bildirim sesi eklenemiyor.`
        );
      }
      fs.mkdirSync(rawDir, { recursive: true });
      fs.copyFileSync(source, path.join(rawDir, SOUND_FILE));
      return modConfig;
    },
  ]);
}

module.exports = withNotificationSound;
