import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '../theme/tokens';
import { TavrikoScreen, TavrikoProgressBar, TavrikoHeroLogo } from '../components/TavrikoIcons';

interface SplashScreenProps {
  onFinish: () => void;
}

/**
 * Uygulama içi açılış ekranı.
 *
 * Tasarım: logo ve yazı tamamen sabittir (ölçek/bükülme animasyonu yoktur),
 * her ekran boyunda kenarlarına taşmadan ortalanır. Yükleme çubuğu ve
 * slogan alt bölgede dengeli boşlukla yer alır.
 */
export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [progress, setProgress] = useState(30);

  useEffect(() => {
    const t1 = setTimeout(() => setProgress(72), 120);
    const t2 = setTimeout(() => setProgress(100), 260);
    const t3 = setTimeout(() => onFinish(), 420);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onFinish]);

  return (
    <TavrikoScreen style={styles.centerAll}>
      {/* Sabit, yumuşak marka parlaması (animasyonsuz) */}
      <View style={styles.logoGlow} pointerEvents="none" />

      {/* Logo + marka yazısı: sabit, ölçeklenmez, taşmaz */}
      <TavrikoHeroLogo width={232} height={210} />

      <View style={styles.loaderWrap}>
        <TavrikoProgressBar progress={progress} height={8} />
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
  logoGlow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#7A3BFF',
    opacity: 0.16,
  },
  loaderWrap: {
    width: 180,
    marginTop: 20,
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
    marginTop: 10,
  },
});
