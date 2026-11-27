import React, { useEffect } from 'react';
import { cdnImage } from '../utils/cdn';
import { ActivityIndicator, BackHandler, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Download, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react-native';
import { THEME } from '../theme/tokens';
import { GradientFill } from './TavrikoGradient';
import { checkForPlayUpdate, startRequiredUpdate, usePlayUpdateStore } from '../services/playUpdates';

const LOGO = cdnImage('images/brand/logo_full.png');

const NOTICE_TEXT = {
  canceled: 'Güncelleme tamamlanmadı. Oynamaya devam etmek için Tavriko\'yu güncellemen gerekiyor.',
  failed: 'Güncelleme başlatılamadı. Biraz sonra tekrar dene ya da Google Play\'i aç.',
  offline: 'İnternet bağlantısı yok gibi görünüyor. Bağlanınca tekrar dene.',
  play_unavailable: 'Google Play bu cihazda kullanılamıyor. Tavriko\'yu Google Play Store\'dan güncelle.',
} as const;

/**
 * Zorunlu (IMMEDIATE) güncelleme ekranı. Tüm uygulamanın üstünde durur;
 * oyuncu güncellemeden ana ekrana veya oyunlara erişemez. Oturum ve
 * navigasyon arkada korunur, güncellemeden sonra oyuncu kaldığı yerden devam eder.
 */
export function UpdateRequiredScreen() {
  const decision = usePlayUpdateStore(s => s.decision);
  const busy = usePlayUpdateStore(s => s.busy);
  const notice = usePlayUpdateStore(s => s.notice);
  const visible = decision.kind === 'required';

  // Android geri tuşu güncelleme ekranını atlatmasın.
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [visible]);

  if (!visible) return null;
  const viaStore = decision.via === 'store';

  return (
    // Modal: uygulamadaki diğer açılır pencerelerin de üstünde durur.
    <Modal visible animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => {}}>
    <View style={styles.root} accessibilityViewIsModal testID="update-required-screen">
      <GradientFill colors={['#241050', '#180B34', '#110723']} />
      <View style={styles.glow} />
      <View style={styles.content}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" accessibilityIgnoresInvertColors />
        <View style={styles.badge}>
          <Sparkles size={14} color="#3B1500" />
          <Text style={styles.badgeText}>YENİ SÜRÜM</Text>
        </View>
        <Text style={styles.title} accessibilityRole="header">Tavriko güncellendi</Text>
        <Text style={styles.body}>
          Yeni sürümde düzeltmeler ve yenilikler var. Maçlara ve ödüllerine devam etmek için uygulamayı güncelle.
        </Text>

        <View style={styles.points}>
          <View style={styles.point}><ShieldCheck size={18} color="#5ADBB5" /><Text style={styles.pointText}>Hesabın, elmasların ve ilerlemen korunur</Text></View>
          <View style={styles.point}><Download size={18} color="#FFC43D" /><Text style={styles.pointText}>Güncelleme Google Play üzerinden yapılır</Text></View>
        </View>

        {notice && <Text style={styles.notice} accessibilityLiveRegion="polite">{NOTICE_TEXT[notice]}</Text>}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy, disabled: busy }}
          disabled={busy}
          onPress={() => void startRequiredUpdate()}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        >
          <GradientFill colors={[THEME.colors.btnGoldTop, THEME.colors.btnGoldBottom]} style={styles.primaryFill} />
          {busy ? <ActivityIndicator color={THEME.colors.btnGoldText} />
            : <Text style={styles.primaryText}>{viaStore ? 'Google Play\'de güncelle' : 'Şimdi güncelle'}</Text>}
        </Pressable>
        {notice && (
          <Pressable accessibilityRole="button" style={styles.secondary} onPress={() => void checkForPlayUpdate('manual')}>
            <RefreshCw size={16} color="#D9CDF5" />
            <Text style={styles.secondaryText}>Tekrar kontrol et</Text>
          </Pressable>
        )}
      </View>
    </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#180B34' },
  glow: {
    position: 'absolute', top: '18%', alignSelf: 'center', width: 320, height: 320, borderRadius: 160,
    backgroundColor: 'rgba(107, 60, 255, 0.28)',
  },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 26, paddingVertical: 40, maxWidth: 460, width: '100%', alignSelf: 'center' },
  logo: { width: 170, height: 150, marginBottom: 14 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFC43D',
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 12,
  },
  badgeText: { fontFamily: THEME.fonts.black, fontSize: 11, letterSpacing: 1.4, color: '#3B1500' },
  title: { fontFamily: THEME.fonts.black, fontSize: 28, color: '#FFFFFF', textAlign: 'center', marginBottom: 10 },
  body: { fontFamily: THEME.fonts.bold, fontSize: 15, lineHeight: 22, color: '#D9CDF5', textAlign: 'center', marginBottom: 18 },
  points: {
    alignSelf: 'stretch', gap: 10, padding: 14, borderRadius: 18, marginBottom: 18,
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  point: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pointText: { flex: 1, fontFamily: THEME.fonts.bold, fontSize: 14, color: '#FFFFFF' },
  notice: { fontFamily: THEME.fonts.bold, fontSize: 13, lineHeight: 19, color: '#FFB4BE', textAlign: 'center', marginBottom: 14 },
  primary: {
    alignSelf: 'stretch', minHeight: 54, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
    borderBottomWidth: 4, borderBottomColor: THEME.colors.btnGoldLip,
  },
  primaryFill: { borderRadius: 16 },
  pressed: { transform: [{ translateY: 2 }], borderBottomWidth: 2 },
  primaryText: { fontFamily: THEME.fonts.black, fontSize: 17, color: THEME.colors.btnGoldText },
  secondary: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 46, paddingHorizontal: 12, marginTop: 8 },
  secondaryText: { fontFamily: THEME.fonts.bold, fontSize: 14, color: '#D9CDF5' },
});
