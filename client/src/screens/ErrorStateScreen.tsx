import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { THEME } from '../theme/tokens';
import {
  TavrikoScreen,
  Button3D,
  ModeSquircleIcon,
  BRAND_APP_ICON,
} from '../components/TavrikoIcons';
interface ErrorStateScreenProps {
  message?: string;
  onRetry: () => void;
  onHome: () => void;
}
export const ErrorStateScreen: React.FC<ErrorStateScreenProps> = ({
  message,
  onRetry,
  onHome,
}) => {
  return (
    <TavrikoScreen style={styles.screenWrap}>
      <View style={styles.mainCenter}>
        <Image
          source={BRAND_APP_ICON}
          style={styles.appIcon}
          resizeMode="cover"
        />
        <Text style={styles.title}>BİR ŞEYLER TERS GİTTİ</Text>
        <Text style={styles.subtitle}>
          {message ||
            'Sunucuya ulaşılamadı. Biraz sonra tekrar dene.\nHata kodu: 503'}
        </Text>
        <Button3D
          title="TEKRAR DENE"
          onPress={onRetry}
          style={{ width: 240 }}
        />
        <TouchableOpacity
          style={styles.homeBtn}
          onPress={onHome}
          activeOpacity={0.85}
        >
          <Text style={styles.homeBtnText}>Ana sayfa</Text>
        </TouchableOpacity>
      </View>
      {/* Bottom Empty State Example Card from page23 */}
      <View style={styles.emptyExampleCard}>
        <ModeSquircleIcon mode="friends" size={40} />
        <View style={{ flex: 1 }}>
          <Text style={styles.emptyExampleTitle}>Henüz arkadaşın yok</Text>
          <Text style={styles.emptyExampleSub}>
            Boş durum örneği: kod paylaşarak davet et
          </Text>
        </View>
      </View>
    </TavrikoScreen>
  );
};
const styles = StyleSheet.create({
  screenWrap: {
    justifyContent: 'space-between',
    paddingBottom: 24,
  },
  mainCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appIcon: {
    width: 110,
    height: 110,
    borderRadius: 24,
    opacity: 0.85,
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 30,
    color: '#FFFFFF',
    marginTop: 14,
  },
  subtitle: {
    color: '#D9CDF5',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    maxWidth: 280,
    marginTop: 8,
    marginBottom: 24,
  },
  homeBtn: {
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
  homeBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: THEME.fonts.extraBold,
  },
  emptyExampleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  emptyExampleTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: THEME.fonts.extraBold,
  },
  emptyExampleSub: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
});