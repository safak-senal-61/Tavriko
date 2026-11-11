import React, { useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Animated, {
  BounceIn,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Stop, Rect, Circle, Path } from 'react-native-svg';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';

/**
 * Tavriko modern uyarı modalı
 * --------------------------------
 * window.alert / Alert.alert yerine geçer: alt kategoride soru yok gibi
 * oyun akışı hatalarını marka dilinde (koyu lüks mor + neon çerçeve +
 * altın gradyan buton) Reanimated giriş animasyonlarıyla gösterir.
 */
interface GameAlertModalProps {
  visible: boolean;
  title?: string;
  message: string;
  /** 'error' kırmızı-turkuaz uyarı ikonu, 'info' mavi bilgi ikonu */
  variant?: 'error' | 'info';
  confirmText?: string;
  onConfirm: () => void;
}

export const GameAlertModal: React.FC<GameAlertModalProps> = ({
  visible,
  title,
  message,
  variant = 'error',
  confirmText = 'ANLADIM',
  onConfirm,
}) => {
  // İkonun yumuşak "nefes" animasyonu: hafif ölçek salınımı
  const iconPulse = useSharedValue(1);
  useEffect(() => {
    if (visible) {
      iconPulse.value = withRepeat(
        withSequence(
          withTiming(1.06, { duration: 900 }),
          withTiming(1, { duration: 900 })
        ),
        -1,
        true
      );
      sound.playSound('wrong');
      sound.triggerHaptic('error');
    } else {
      iconPulse.value = 1;
    }
  }, [visible, iconPulse]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconPulse.value }],
  }));

  const accent = variant === 'error' ? '#FF5A6A' : '#4A9BFF';
  const glow = variant === 'error' ? 'rgba(255, 90, 106, 0.35)' : 'rgba(74, 155, 255, 0.35)';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onConfirm}>
      <View style={styles.overlay}>
        {/* Karartma katmanı */}
        <Animated.View
          entering={FadeIn.duration(220)}
          style={[StyleSheet.absoluteFill, styles.backdrop]}
        />
        <Animated.View
          entering={BounceIn.duration(480).springify(0.55)}
          style={styles.card}
        >
          {/* Neon çift çerçeve */}
          <View style={styles.innerFrame}>
            {/* İkon madalyonu */}
            <Animated.View style={[styles.iconWrap, { shadowColor: glow }, iconStyle]}>
              <Svg width={64} height={64} viewBox="0 0 64 64">
                <Defs>
                  <LinearGradient id="tavrikoAlertIcon" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor={variant === 'error' ? '#FF8A8A' : '#7EC8FF'} />
                    <Stop offset="1" stopColor={accent} />
                  </LinearGradient>
                </Defs>
                <Circle cx="32" cy="32" r="30" fill="url(#tavrikoAlertIcon)" />
                <Circle cx="32" cy="32" r="30" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
                {variant === 'error' ? (
                  <>
                    <Rect x="29" y="18" width="6" height="20" rx="3" fill="#2A0A1A" />
                    <Circle cx="32" cy="45" r="3.6" fill="#2A0A1A" />
                  </>
                ) : (
                  <Path
                    d="M32 16a16 16 0 0116 16 16 16 0 01-16 16 16 16 0 01-16-16 16 16 0 0116-16zm-2 10a2 2 0 012 2v9a2 2 0 01-4 0v-9a2 2 0 012-2zm0 15a2.6 2.6 0 110 5.2 2.6 2.6 0 010-5.2z"
                    fill="#0A1A33"
                  />
                )}
              </Svg>
            </Animated.View>

            <Text style={styles.eyebrow}>TAVRİKO ARENA</Text>
            <Text style={styles.title}>{title || (variant === 'error' ? 'Soru Bulunamadı' : 'Bilgi')}</Text>
            <Text style={styles.message}>{message}</Text>

            {/* Altın gradyan 3D onay butonu */}
            <TouchableOpacity
              style={styles.confirmButton}
              activeOpacity={0.88}
              onPress={() => {
                sound.playSound('tap');
                sound.triggerHaptic('light');
                onConfirm();
              }}
            >
              <View style={styles.btnLip} />
              <View style={styles.btnBody}>
                <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
                  <Defs>
                    <LinearGradient id="tavrikoAlertBtnGrad" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor="#FFE27A" />
                      <Stop offset="0.6" stopColor="#FF9B2F" />
                      <Stop offset="1" stopColor="#E07A00" />
                    </LinearGradient>
                  </Defs>
                  <Rect x="0" y="0" width="100%" height="100%" rx="20" ry="20" fill="url(#tavrikoAlertBtnGrad)" />
                </Svg>
                <Text style={styles.confirmButtonText}>{confirmText}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Kart alt süslemesi: neon ışıma çizgisi */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.glowLine} />
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  backdrop: {
    backgroundColor: 'rgba(8, 3, 20, 0.86)',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 30,
    backgroundColor: '#1E0E3D',
    borderWidth: 1.5,
    borderColor: 'rgba(154, 107, 255, 0.4)',
    shadowColor: 'rgba(154, 107, 255, 0.45)',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 1,
    shadowRadius: 34,
    elevation: 18,
    overflow: 'hidden',
  },
  innerFrame: {
    margin: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(154, 107, 255, 0.22)',
    backgroundColor: 'rgba(30, 14, 61, 0.6)',
    alignItems: 'center',
    paddingTop: 26,
    paddingHorizontal: 22,
    paddingBottom: 22,
  },
  iconWrap: {
    marginBottom: 14,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 22,
    elevation: 8,
  },
  eyebrow: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 11,
    letterSpacing: 3,
    color: '#5ADBB5',
    marginBottom: 6,
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 26,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    fontFamily: THEME.fonts.body,
    fontSize: 14.5,
    lineHeight: 21,
    color: '#D9CDF5',
    textAlign: 'center',
    marginBottom: 20,
  },
  confirmButton: {
    width: '100%',
    height: 52,
    position: 'relative',
    borderRadius: 20,
  },
  btnLip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 50,
    borderRadius: 20,
    backgroundColor: '#B8560A',
  },
  btnBody: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 46,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  confirmButtonText: {
    fontSize: 16,
    fontFamily: THEME.fonts.display,
    fontWeight: '900',
    color: '#3B1500',
    letterSpacing: 1,
  },
  glowLine: {
    alignSelf: 'center',
    width: '46%',
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(154, 107, 255, 0.55)',
    marginBottom: 12,
  },
});
