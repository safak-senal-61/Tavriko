// Expo config plugin: Play Console, `orientation: "portrait"` nedeniyle
// android.hardware.screen.portrait özelliğini zorunlu sayar ve uygulamayı
// tablet, masaüstü, Play Games on PC ve Android XR cihazlarda yüklenemez
// hale getirir. Bu plugin özelliği manifestte isteğe bağlı (required=false)
// olarak beyan eder; uygulama yine dikey açılır.

const { withAndroidManifest } = require('expo/config-plugins');

const OPTIONAL_FEATURES = [
  'android.hardware.screen.portrait',
  'android.hardware.screen.landscape',
  // CAMERA / RECORD_AUDIO izinleri bu donanımları örtük olarak zorunlu kılar.
  'android.hardware.camera',
  'android.hardware.camera.autofocus',
  'android.hardware.microphone',
];

function withOptionalHardwareFeatures(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest['uses-feature'] = manifest['uses-feature'] || [];
    for (const name of OPTIONAL_FEATURES) {
      const existing = manifest['uses-feature'].find((f) => f.$ && f.$['android:name'] === name);
      if (existing) existing.$['android:required'] = 'false';
      else manifest['uses-feature'].push({ $: { 'android:name': name, 'android:required': 'false' } });
    }
    return cfg;
  });
}

module.exports = withOptionalHardwareFeatures;
