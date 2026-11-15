import React, { useEffect } from 'react';
import { View, StyleSheet, Image } from 'react-native';

interface SplashScreenProps {
  onFinish: () => void;
}

/**
 * Uygulama içi açılış ekranı.
 *
 * Tasarım: kullanıcı tarafından onaylanan tam ekran neon splash
 * (assets/splash-screen.png). Görselde logo, slogan, yükleme halkası ve
 * "Yükleniyor..." metni zaten içeride; ekran yalnızca bu görseli gösterir
 * ve kısa süre sonra uygulamaya geçer.
 *
 * resizeMode "cover": görsel ekranı kenarına kadar doldurur (contain
 * modunda farklı en-boy oranlı ekranlarda kenarlarda boş bantlar
 * kalıyordu). Tasarımın ana içeriği (logo, slogan, yükleme halkası)
 * ortada olduğundan farklı ekranlarda yalnızca atmosferik kenarlar
 * kırpılır; telefonlarda oran zaten neredeyse birebir uyumludur.
 */
export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  useEffect(() => {
    const t = setTimeout(onFinish, 1400);
    return () => clearTimeout(t);
  }, [onFinish]);

  return (
    <View style={styles.root}>
      <Image
        source={require('../../assets/splash-screen.png')}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#01025B',
  },
});
