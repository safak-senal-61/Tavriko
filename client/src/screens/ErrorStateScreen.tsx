import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { AlertCircle, RefreshCw, Home } from 'lucide-react-native';

interface ErrorStateScreenProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  onHome?: () => void;
}

export const ErrorStateScreen: React.FC<ErrorStateScreenProps> = ({
  title = 'Bir Hata Oluştu',
  message = 'İşlem sırasında beklenmeyen bir sorun ile karşılaşıldı. Lütfen tekrar deneyiniz.',
  onRetry,
  onHome,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <AlertCircle size={44} color={THEME.colors.wrong} />
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>

        <View style={styles.actions}>
          {onRetry && (
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
          )}

          {onHome && (
            <TouchableOpacity
              style={styles.homeBtn}
              onPress={() => {
                sound.playSound('tap');
                onHome();
              }}
            >
              <Home size={18} color={THEME.colors.textPrimary} />
              <Text style={styles.btnTextSecondary}>Ana Sayfaya Dön</Text>
            </TouchableOpacity>
          )}
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
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: THEME.colors.wrongBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginBottom: 8,
  },
  message: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
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
