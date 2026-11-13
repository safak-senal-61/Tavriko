import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import { THEME } from '../theme/tokens';
import { TavrikoScreen, Button3D } from '../components/TavrikoIcons';
import { useNetStatus } from '../store/netStatus';
import { netMonitor } from '../services/netMonitor';

/**
 * Yeniden Bağlan ekranı
 * --------------------
 * İnternet uzun süre kopunca oyundan düşürülen oyuncuya gösterilir.
 * Bağlantı geri döndüğü anda otomatik olarak ana ekrana yönlendirir;
 * istenirse "Yeniden Dene" ile anında kontrol yapılır.
 */
interface ReconnectScreenProps {
  onRetry: () => void;
  onExitToHome: () => void;
}
export const ReconnectScreen: React.FC<ReconnectScreenProps> = ({
  onRetry,
  onExitToHome,
}) => {
  const online = useNetStatus((s) => s.online);
  const [checking, setChecking] = useState(false);

  // İkonun yumuşak "nefes" animasyonu
  const iconPulse = useSharedValue(1);
  useEffect(() => {
    iconPulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 900 }),
        withTiming(1, { duration: 900 })
      ),
      -1,
      true
    );
  }, [iconPulse]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconPulse.value }] }));

  // Bağlantı geri döndü: kısa bir "geri geldi" anından sonra ana ekrana dön
  useEffect(() => {
    if (!online) return;
    const timeout = setTimeout(() => onRetry(), 1200);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  const handleRetry = async () => {
    setChecking(true);
    try {
      const reachable = await netMonitor.checkNow();
      if (reachable) onRetry();
    } finally {
      setChecking(false);
    }
  };

  return (
    <TavrikoScreen style={styles.centerAll}>
      {online ? (
        <Animated.View entering={FadeIn.duration(300)} style={styles.ringWrap}>
          <Svg width={150} height={150} viewBox="0 0 150 150">
            <Circle
              cx="75"
              cy="75"
              r="64"
              fill="none"
              stroke="rgba(90, 219, 181, 0.25)"
              strokeWidth="12"
            />
            <Circle
              cx="75"
              cy="75"
              r="64"
              fill="none"
              stroke="#5ADBB5"
              strokeWidth="12"
              strokeDasharray="402"
              strokeDashoffset="0"
              strokeLinecap="round"
            />
          </Svg>
          <View style={styles.ringNumberWrap}>
            <Text style={[styles.ringNumber, { color: '#5ADBB5' }]}>✓</Text>
          </View>
          <Text style={styles.title}>BAĞLANTI GERİ GELDİ</Text>
          <Text style={styles.subtitle}>Ana ekrana yönlendiriliyorsun…</Text>
        </Animated.View>
      ) : (
        <Animated.View entering={FadeInDown.duration(420)} style={styles.centerAll}>
          <Animated.View style={[styles.ringWrap, iconStyle]}>
            <Svg width={150} height={150} viewBox="0 0 150 150">
              <Circle
                cx="75"
                cy="75"
                r="64"
                fill="none"
                stroke="rgba(255,155,47,0.22)"
                strokeWidth="12"
              />
              <Circle
                cx="75"
                cy="75"
                r="64"
                fill="none"
                stroke="#FF9B2F"
                strokeWidth="12"
                strokeDasharray="402"
                strokeDashoffset="134"
                strokeLinecap="round"
              />
            </Svg>
            <View style={styles.ringNumberWrap}>
              <Text style={styles.wifiGlyph}>📡</Text>
            </View>
          </Animated.View>
          <Text style={styles.title}>BAĞLANTI KOPTU</Text>
          <Text style={styles.subtitle}>
            İnternet bağlantın uzun süre kesildiği için oyundan ayrıldın.{'\n'}
            Bağlantın geri geldiği an otomatik olarak ana ekrana döneceksin.
          </Text>
          <Button3D
            title={checking ? 'KONTROL EDİLİYOR…' : 'YENİDEN DENE'}
            variant="mint"
            onPress={handleRetry}
            style={{ width: 240 }}
          />
          <TouchableOpacity
            style={styles.leaveBtn}
            onPress={onExitToHome}
            activeOpacity={0.85}
          >
            <Text style={styles.leaveBtnText}>Ana ekrana dön</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </TavrikoScreen>
  );
};
const styles = StyleSheet.create({
  centerAll: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringWrap: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ringNumberWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringNumber: {
    fontFamily: THEME.fonts.display,
    fontSize: 56,
    color: '#FFFFFF',
  },
  wifiGlyph: {
    fontSize: 44,
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 30,
    color: '#FFFFFF',
    marginTop: 22,
    textAlign: 'center',
  },
  subtitle: {
    color: '#D9CDF5',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    maxWidth: 300,
    marginTop: 8,
    marginBottom: 28,
    lineHeight: 19,
  },
  leaveBtn: {
    width: 240,
    height: 50,
    marginTop: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: THEME.fonts.extraBold,
  },
});
