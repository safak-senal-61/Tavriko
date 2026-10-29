import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { WifiOff, RefreshCw, Home } from 'lucide-react-native';

interface ReconnectScreenProps {
  onRetry: () => void;
  onExitToHome: () => void;
}

export const ReconnectScreen: React.FC<ReconnectScreenProps> = ({ onRetry, onExitToHome }) => {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <WifiOff size={44} color={THEME.colors.wrong} />
        </View>

        <Text style={styles.title}>Bağlantı Kesildi</Text>
        <Text style={styles.desc}>
          Sunucuyla olan gerçek zamanlı bağlantınız koptu. Maç durumunuzu kurtarmak için otomatik olarak yeniden bağlanılıyor...
        </Text>

        <View style={styles.spinnerRow}>
          <ActivityIndicator size="small" color={THEME.colors.primaryLight} />
          <Text style={styles.spinnerText}>Yeniden bağlanılıyor...</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              sound.playSound('tap');
              onRetry();
            }}
          >
            <RefreshCw size={18} color="#FFF" />
            <Text style={styles.btnText}>Tekrar Dene</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.homeBtn}
            onPress={() => {
              sound.playSound('tap');
              onExitToHome();
            }}
          >
            <Home size={18} color={THEME.colors.textPrimary} />
            <Text style={styles.btnTextSecondary}>Lobiye Dön</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: THEME.spacing.lg,
  },
  card: {
    width: '100%',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.xl,
    padding: THEME.spacing.xl,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: THEME.colors.wrong,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: THEME.colors.wrongBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: THEME.colors.textPrimary,
    marginBottom: 8,
  },
  desc: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  spinnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  spinnerText: {
    fontSize: 13,
    color: THEME.colors.primaryLight,
    fontWeight: '600',
  },
  actions: {
    width: '100%',
    gap: 10,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.radius.md,
    paddingVertical: 14,
  },
  homeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.backgroundSecondary,
    borderRadius: THEME.radius.md,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  btnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  btnTextSecondary: {
    color: THEME.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
});
