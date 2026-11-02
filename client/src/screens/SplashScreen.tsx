import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import {
  TavrikoScreen,
  TavrikoProgressBar,
  TavrikoHeroLogo,
} from '../components/TavrikoIcons';
interface SplashScreenProps {
  onFinish: () => void;
}
export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [progress, setProgress] = useState(25);
  const logoScale = useRef(new Animated.Value(0.82)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 450,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
    const t1 = setTimeout(() => setProgress(78), 120);
    const t2 = setTimeout(() => {
      setProgress(100);
    }, 280);
    const t3 = setTimeout(() => onFinish(), 400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onFinish, logoScale, logoOpacity]);
  return (
    <TavrikoScreen style={styles.centerAll}>
      <View style={styles.logoHalo} pointerEvents="none" />
      <Animated.View
        style={{
          opacity: logoOpacity,
          transform: [{ scale: logoScale }],
        }}
      >
        <TavrikoHeroLogo width={270} height={160} />
      </Animated.View>
      <View style={styles.loaderWrap}>
        <TavrikoProgressBar progress={progress} height={10} />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
      <Text style={styles.tagline}>Bilgini yarıştır, kazan!</Text>
    </TavrikoScreen>
  );
};
const styles = StyleSheet.create({
  centerAll: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoHalo: {
    position: 'absolute',
    width: 260,
    height: 150,
    borderRadius: 130,
    backgroundColor: '#7A3BFF',
    opacity: 0.35,
  },
  loaderWrap: {
    width: 200,
    marginTop: 24,
  },
  loadingText: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    marginTop: 8,
  },
  tagline: {
    color: '#FFC43D',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
    marginTop: 12,
  },
});