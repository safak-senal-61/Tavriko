import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  SlideInDown,
  SlideOutUp,
} from 'react-native-reanimated';
import Svg, { Path, Circle } from 'react-native-svg';
import { THEME } from '../theme/tokens';
import { useNetStatus, OFFLINE_GAME_GRACE_MS } from '../store/netStatus';

/**
 * Uygulama genelinde internet durumu bildirimi
 * --------------------------------------------
 * İnternet koptuğunda ekranın üstünde beliren modern, camsı bir kapsül.
 * Kök seviyede render edilir ve `pointerEvents="none"` olduğu için
 * altındaki arayüzün akışını / dokunmalarını asla engellemez.
 *
 * - Oyun dışında: "İnternet bağlantısı yok — yeniden bağlanmaya çalışılıyor"
 * - Oyun içinde: koruma süresi geri sayımı + ince ilerleme çubuğu
 *   (süre dolarsa RootNavigator oyuncuyu oyundan düşürür)
 * - Bağlantı geri döndüğünde kısa mint renkli "geri geldi" bildirimi
 */
interface ConnectionStatusOverlayProps {
  /** ReconnectScreen gibi bağlantı durumunun zaten anlatıldığı ekranlarda gizle */
  suppress?: boolean;
}

const RECONNECTED_VISIBLE_MS = 2600;

export const ConnectionStatusOverlay: React.FC<ConnectionStatusOverlayProps> = ({ suppress }) => {
  const online = useNetStatus((s) => s.online);
  const graceEndsAt = useNetStatus((s) => s.graceEndsAt);
  const reconnectedAt = useNetStatus((s) => s.reconnectedAt);

  const [remainingMs, setRemainingMs] = useState<number>(0);
  const [showReconnected, setShowReconnected] = useState<boolean>(false);

  // Koruma süresi geri sayımı (oyun içi)
  useEffect(() => {
    if (!graceEndsAt) {
      setRemainingMs(0);
      return;
    }
    const tick = () => setRemainingMs(Math.max(0, graceEndsAt - Date.now()));
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [graceEndsAt]);

  // Bağlantı dönünce kısa "geri geldi" bildirimi göster
  useEffect(() => {
    if (!reconnectedAt) return;
    setShowReconnected(true);
    const timeout = setTimeout(() => setShowReconnected(false), RECONNECTED_VISIBLE_MS);
    return () => clearTimeout(timeout);
  }, [reconnectedAt]);

  // İkonun yumuşak "nefes" animasyonu
  const iconPulse = useSharedValue(1);
  useEffect(() => {
    if (!online) {
      iconPulse.value = withRepeat(
        withSequence(
          withTiming(1.12, { duration: 750 }),
          withTiming(1, { duration: 750 })
        ),
        -1,
        true
      );
    } else {
      iconPulse.value = withTiming(1, { duration: 200 });
    }
  }, [online, iconPulse]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconPulse.value }] }));

  const showOffline = !online && !suppress;
  const showSuccess = showReconnected && !suppress && !showOffline;

  const secondsLeft = Math.ceil(remainingMs / 1000);
  const progressPct = graceEndsAt
    ? Math.max(0, Math.min(100, (remainingMs / OFFLINE_GAME_GRACE_MS) * 100))
    : 0;

  return (
    // Kök görünüm her zaman takılı kalır: kapsülün giriş/çıkış animasyonları
    // (entering/exiting) kapsül koşullu kaldırıldığında da düzgün oynasın diye.
    // pointerEvents="none" olduğu için arayüz akışını asla engellemez.
    <View pointerEvents="none" style={styles.root}>
      {showOffline && (
        <Animated.View
          entering={SlideInDown.springify().damping(16).stiffness(200)}
          exiting={SlideOutUp.duration(260)}
          style={styles.pill}
        >
          <Animated.View style={[styles.iconWrap, iconStyle]}>
            <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
              {/* Wifi-off ikonu: kesik yaylar + kapalı nokta + çapraz çizgi */}
              <Path
                d="M8.5 16.5a5 5 0 0 1 7 0"
                stroke="#FFB3BC"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <Path
                d="M2 8.8a15 15 0 0 1 4.2-2.6M10.7 5c4-.4 8.1.9 11.3 3.8M16.9 11.2a10 10 0 0 1 2.2 1.7"
                stroke="#FFB3BC"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <Circle cx="12" cy="19.5" r="1.4" fill="#FFB3BC" />
              <Path
                d="M3 3l18 18"
                stroke="#FF5A6A"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </Svg>
          </Animated.View>

          <View style={styles.textWrap}>
            <Text style={styles.title}>İnternet bağlantısı yok</Text>
            {graceEndsAt ? (
              <>
                <Text style={styles.subtitle}>
                  Oyunda kalmak için bağlantının dönmesine{' '}
                  <Text style={styles.countdown}>{secondsLeft} sn</Text> kaldı
                </Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
                </View>
              </>
            ) : (
              <Text style={styles.subtitle}>Yeniden bağlanmaya çalışılıyor…</Text>
            )}
          </View>
        </Animated.View>
      )}
      {showSuccess && (
        <Animated.View
          entering={SlideInDown.springify().damping(16).stiffness(200)}
          exiting={SlideOutUp.duration(260)}
          style={[styles.pill, styles.pillSuccess]}
        >
          <View style={[styles.iconWrap, styles.iconWrapSuccess]}>
            <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
              <Circle cx="12" cy="12" r="10.5" fill="rgba(90, 219, 181, 0.16)" />
              <Path
                d="M7.5 12.6l3 3 6-6.6"
                stroke="#5ADBB5"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          <Text style={[styles.title, styles.titleSuccess]}>Bağlantı geri geldi</Text>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 14 : 18,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '92%',
    backgroundColor: 'rgba(16, 6, 32, 0.92)',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 90, 106, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: 'rgba(255, 90, 106, 0.35)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 18,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 8px 28px rgba(255, 90, 106, 0.28)' as any }
      : { elevation: 12 }),
  },
  pillSuccess: {
    borderColor: 'rgba(90, 219, 181, 0.55)',
    shadowColor: 'rgba(90, 219, 181, 0.35)',
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 8px 28px rgba(90, 219, 181, 0.25)' as any }
      : {}),
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 90, 106, 0.14)',
    marginRight: 10,
  },
  iconWrapSuccess: {
    backgroundColor: 'rgba(90, 219, 181, 0.14)',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 13,
    color: '#FFE9EC',
    letterSpacing: 0.2,
  },
  titleSuccess: {
    color: '#DDF9F0',
  },
  subtitle: {
    fontFamily: THEME.fonts.body,
    fontSize: 11,
    color: '#D9CDF5',
    marginTop: 1,
  },
  countdown: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 11,
    color: '#FFC43D',
  },
  progressTrack: {
    height: 3.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#FF9B2F',
  },
});
