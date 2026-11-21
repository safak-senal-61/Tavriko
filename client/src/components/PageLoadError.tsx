import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { THEME } from '../theme/tokens';

export function PageLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.body} accessibilityLiveRegion="polite">
      <Text style={styles.message}>İçerik yüklenemedi. Bağlantını kontrol edip tekrar dene.</Text>
      <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={onRetry}>
        <Text style={styles.action}>Tekrar dene</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', padding: 16, gap: 8 },
  message: { color: THEME.colors.textSecondary, fontFamily: THEME.fonts.body, fontSize: 14, textAlign: 'center' },
  button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  action: { color: THEME.colors.gold, fontFamily: THEME.fonts.bold, fontSize: 14 },
});
