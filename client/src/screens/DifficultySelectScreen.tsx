import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { DifficultyLevel, CategoryId } from '@trivia/shared';
import { ArrowLeft, Shield, Flame, Zap, Award } from 'lucide-react-native';

interface DifficultySelectScreenProps {
  categoryId: CategoryId;
  onBack: () => void;
  onSelectDifficulty: (difficulty: DifficultyLevel) => void;
}

const TIERS: Array<{
  id: DifficultyLevel;
  name: string;
  multiplier: string;
  desc: string;
  color: string;
  icon: any;
}> = [
  {
    id: 'easy',
    name: 'Kolay',
    multiplier: '1.0x XP',
    desc: 'Temel kavramlar ve herkesin bildiği genel sorular',
    color: '#10B981',
    icon: Shield,
  },
  {
    id: 'medium',
    name: 'Orta',
    multiplier: '1.25x XP',
    desc: 'Dengeli bilgi seviyesi ve dikkat gerektiren sorular',
    color: '#F59E0B',
    icon: Zap,
  },
  {
    id: 'hard',
    name: 'Zor',
    multiplier: '1.5x XP',
    desc: 'Detaylı bilgi ve hızlı karar verme yeteneği',
    color: '#EF4444',
    icon: Flame,
  },
  {
    id: 'expert',
    name: 'Uzman',
    multiplier: '2.0x XP',
    desc: 'Yalnızca gerçek ustalar için derinlemesine sorular',
    color: '#A855F7',
    icon: Award,
  },
];

export const DifficultySelectScreen: React.FC<DifficultySelectScreenProps> = ({
  onBack,
  onSelectDifficulty,
}) => {
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
        <Text style={styles.headerTitle}>Zorluk Seviyesi</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.subtitle}>
          Bilgi seviyene uygun zorluğu seç ve yarışmaya başla!
        </Text>

        <View style={styles.tierList}>
          {TIERS.map((tier) => {
            const Icon = tier.icon;
            return (
              <TouchableOpacity
                key={tier.id}
                style={[styles.tierCard, { borderColor: tier.color }]}
                activeOpacity={0.8}
                onPress={() => {
                  sound.playSound('tap');
                  sound.triggerHaptic('medium');
                  onSelectDifficulty(tier.id);
                }}
              >
                <View style={[styles.iconBox, { backgroundColor: `${tier.color}22` }]}>
                  <Icon size={24} color={tier.color} />
                </View>

                <View style={styles.infoCol}>
                  <View style={styles.titleRow}>
                    <Text style={styles.tierName}>{tier.name}</Text>
                    <View style={[styles.multiplierPill, { backgroundColor: `${tier.color}22` }]}>
                      <Text style={[styles.multiplierText, { color: tier.color }]}>
                        {tier.multiplier}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.tierDesc}>{tier.desc}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
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
  subtitle: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.xl,
  },
  tierList: {
    gap: 16,
  },
  tierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.lg,
    borderWidth: 1.5,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  infoCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  tierName: {
    fontSize: 17,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  multiplierPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: THEME.radius.full,
  },
  multiplierText: {
    fontSize: 11,
    fontWeight: '800',
  },
  tierDesc: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    lineHeight: 16,
  },
});
