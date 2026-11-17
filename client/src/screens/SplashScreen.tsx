import React, { useEffect } from 'react';
import { View, StyleSheet, Image, useWindowDimensions } from 'react-native';
import { cdnImage } from '../utils/cdn';

const SPLASH_ART = cdnImage('splash-screen.png');

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
 *
 * ÖNEMLİ: Görsel stiline açıkça width/height %100 verilir. Web'de
 * (react-native-web) absoluteFill + intrinsic boyutlu Image, görseli
 * doğal piksel boyutunda (852x1846) render edip ekrandan taşıyordu —
 * splash'in yalnızca bir kısmı görünüyordu. Açık yüzde boyutlar hem
 * native hem web'de tam ekran dolgu garantiler.
 *
 * CİHAZ UYUMU: Telefonlar için "cover" (kenarına kadar dolgu, görsel
 * oranı telefonlarla neredeyse birebir). Tablet / yatay / masaüstü gibi
 * geniş ekranlarda cover, yükleme halkası ve alt sahneyi kırpar; bu
 * yüzden geniş ekranlarda "contain" kullanılır — tüm tasarım görünür,
 * kenarlarda zemin rengiyle uyumlu bantlar kalır.
 */
export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const { width, height } = useWindowDimensions();
  // Telefon: ~0.45-0.56 oran; tablet/yatay: >= 0.62
  const isWideScreen = height > 0 && width / height >= 0.62;

  useEffect(() => {
    const t = setTimeout(onFinish, 1400);
    return () => clearTimeout(t);
  }, [onFinish]);

  return (
    <View style={styles.root}>
      <Image
        source={SPLASH_ART}
        style={styles.image}
        resizeMode={isWideScreen ? 'contain' : 'cover'}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#01025B',
  },
  image: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
});
