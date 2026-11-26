// Expo config plugin: Android yerel kütüphanelerinin hangi işlemci mimarileri
// (ABI) için derleneceğini TAVRIKO_ANDROID_ARCHS ortam değişkeniyle belirler.
//
// Yalnızca eas.json "preview" profili (dağıtılan test APK'sı) bu değişkeni
// verir: arm64-v8a + armeabi-v7a → tüm gerçek telefonlar, x86/x86_64 (yalnızca
// emülatör) çıkarılır ve APK ~77 MB küçülür. "production" (Play AAB) profili
// değişkeni vermez → varsayılan 4 mimari korunur; Play her cihaza zaten
// yalnızca kendi mimarisini indirir.

const { withGradleProperties } = require('expo/config-plugins');

const KNOWN = new Set(['armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64']);
const KEY = 'reactNativeArchitectures';

function parseArchs(raw) {
  if (!raw) return null;
  const archs = String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const unknown = archs.filter((a) => !KNOWN.has(a));
  if (unknown.length) {
    throw new Error(`TAVRIKO_ANDROID_ARCHS geçersiz mimari: ${unknown.join(', ')}`);
  }
  return archs.length ? [...new Set(archs)] : null;
}

function withAndroidArchitectures(config) {
  const archs = parseArchs(process.env.TAVRIKO_ANDROID_ARCHS);
  if (!archs) return config;
  return withGradleProperties(config, (cfg) => {
    const props = cfg.modResults.filter((p) => !(p.type === 'property' && p.key === KEY));
    props.push({ type: 'property', key: KEY, value: archs.join(',') });
    cfg.modResults = props;
    return cfg;
  });
}

module.exports = withAndroidArchitectures;
module.exports.parseArchs = parseArchs;
