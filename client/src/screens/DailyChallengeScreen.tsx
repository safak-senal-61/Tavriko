import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { ArrowLeft, Flame, Calendar, Sparkles, CheckCircle2, Play } from 'lucide-react-native';

interface DailyChallengeScreenProps {
  onBack: () => void;
  onStartDaily: () => void;
}

export const DailyChallengeScreen: React.FC<DailyChallengeScreenProps> = ({
  onBack,
  onStartDaily,
}) => {
  const [streakDays] = useState(4);

  const days = [
    { day: 'Pzt', completed: true },
    { day: 'Sal', completed: true },
    { day: 'Çar', completed: true },
    { day: 'Per', completed: true },
    { day: 'Cum', completed: false, isToday: true },
    { day: 'Cmt', completed: false },
    { day: 'Paz', completed: false },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            sound.playSound('tap');
            onBack();
          }}
        >
          <ArrowLeft size={22} color={THEME.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Günün Meydan Okuması</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Streak Hero Card */}
        <View style={styles.streakCard}>
          <View style={styles.flameCircle}>
            <Flame size={48} color={THEME.colors.streak} />
          </View>
          <Text style={styles.streakCount}>{streakDays} Günlük Seri!</Text>
          <Text style={styles.streakDesc}>
            Her gün 5 özel soruyu tamamlayarak serini koru ve haftalık büyük ödülü kap!
          </Text>

          {/* Week progress circles */}
          <View style={styles.weekRow}>
            {days.map((d, index) => (
              <View key={index} style={styles.dayCol}>
                <View
                  style={[
                    styles.dayCircle,
                    d.completed && styles.dayCircleDone,
                    d.isToday && styles.dayCircleToday,
                  ]}
                >
                  {d.completed ? (
                    <CheckCircle2 size={16} color="#FFF" />
                  ) : (
                    <Text style={[styles.dayNumber, d.isToday && styles.dayTodayText]}>
                      {index + 1}
                    </Text>
                  )}
                </View>
                <Text style={styles.dayLabel}>{d.day}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Today's Challenge Info */}
        <View style={styles.infoCard}>
          <Text style={styles.cardHeader}>Bugünün Görevi</Text>
          <View style={styles.ruleItem}>
            <Sparkles size={16} color={THEME.colors.primaryLight} />
            <Text style={styles.ruleText}>5 Özel Seçilmiş Karma Soru</Text>
          </View>
          <View style={styles.ruleItem}>
            <Sparkles size={16} color={THEME.colors.gold} />
            <Text style={styles.ruleText}>2x XP & 100 Altın Bonus Ödül</Text>
          </View>
          <View style={styles.ruleItem}>
            <Sparkles size={16} color={THEME.colors.accent} />
            <Text style={styles.ruleText}>Her oyuncu için tek hak (Günde 1 kez)</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.startButton}
          onPress={() => {
            sound.playSound('match_found');
            sound.triggerHaptic('success');
            onStartDaily();
          }}
        >
          <Play size={20} color="#FFF" />
          <Text style={styles.btnText}>Bugünün Görevine Başla</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    backgroundColor: THEME.colors.card,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  content: {
    padding: THEME.spacing.lg,
  },
  streakCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.xl,
    padding: THEME.spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 20,
  },
  flameCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  streakCount: {
    fontSize: 24,
    fontWeight: '900',
    color: THEME.colors.streak,
  },
  streakDesc: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    marginBottom: 20,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  dayCol: {
    alignItems: 'center',
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: THEME.colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
    marginBottom: 4,
  },
  dayCircleDone: {
    backgroundColor: THEME.colors.streak,
    borderColor: THEME.colors.streak,
  },
  dayCircleToday: {
    borderColor: THEME.colors.gold,
  },
  dayNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textMuted,
  },
  dayTodayText: {
    color: THEME.colors.gold,
  },
  dayLabel: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 24,
  },
  cardHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginBottom: 12,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  ruleText: {
    fontSize: 13,
    color: THEME.colors.textSecondary,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.radius.md,
    paddingVertical: 14,
  },
  btnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
