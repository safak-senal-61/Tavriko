import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { CategoryId, DifficultyLevel } from '@trivia/shared';
import { Radar, X, Users, Sparkles } from 'lucide-react-native';

interface MatchmakingRadarScreenProps {
  category: CategoryId;
  difficulty: DifficultyLevel;
  onCancel: () => void;
  onMatchFound?: (roomCode: string) => void;
}

export const MatchmakingRadarScreen: React.FC<MatchmakingRadarScreenProps> = ({
  category,
  difficulty,
  onCancel,
}) => {
  const [pulseAnim] = useState(new Animated.Value(0.4));
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    const timer = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);

    return () => {
      pulseLoop.stop();
      clearInterval(timer);
    };
  }, [pulseAnim]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.categoryBadge}>{category.toUpperCase()}</Text>
        <Text style={styles.statusTitle}>Rakip Aranıyor...</Text>
        <Text style={styles.statusSubtitle}>Benzer beceri puanındaki oyuncular taranıyor</Text>
      </View>

      <View style={styles.radarContainer}>
        <Animated.View
          style={[
            styles.radarWaveOuter,
            {
              transform: [{ scale: pulseAnim }],
              opacity: pulseAnim.interpolate({
                inputRange: [0.4, 1.2],
                outputRange: [0.8, 0],
              }),
            },
          ]}
        />
        <Animated.View
          style={[
            styles.radarWaveMiddle,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />
        <View style={styles.radarCenter}>
          <Radar size={44} color="#FFF" />
        </View>
      </View>

      <View style={styles.timerBox}>
        <Text style={styles.timerLabel}>Geçen Süre</Text>
        <Text style={styles.timerValue}>
          00:{elapsedSec < 10 ? `0${elapsedSec}` : elapsedSec}
        </Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => {
            sound.playSound('tap');
            onCancel();
          }}
        >
          <X size={18} color="#FFF" />
          <Text style={styles.cancelText}>Aramayı İptal Et</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: THEME.spacing.lg,
  },
  header: {
    alignItems: 'center',
  },
  categoryBadge: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.primaryLight,
    backgroundColor: THEME.colors.card,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 12,
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginBottom: 6,
  },
  statusSubtitle: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
  },
  radarContainer: {
    width: 240,
    height: 240,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  radarWaveOuter: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    borderColor: THEME.colors.primaryLight,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  radarWaveMiddle: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1.5,
    borderColor: THEME.colors.primary,
  },
  radarCenter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: THEME.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
  },
  timerBox: {
    alignItems: 'center',
    backgroundColor: THEME.colors.card,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  timerLabel: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  timerValue: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginTop: 2,
  },
  footer: {
    width: '100%',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.cardHover,
    paddingVertical: 14,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  cancelText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
