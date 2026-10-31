import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { CategoryId, DifficultyLevel, ALL_CATEGORIES } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import {
  TavrikoScreen,
  TavrikoTopBar,
  Button3D,
  XpStarIcon,
} from '../components/TavrikoIcons';
interface DifficultySelectScreenProps {
  categoryId: CategoryId;
  onBack: () => void;
  onSelectDifficulty: (difficulty: DifficultyLevel) => void;
  avatarSeed?: string;
  coins?: number;
  gems?: number;
  isGuest?: boolean;
  onLoginPrompt?: () => void;
}
const DIFFICULTIES: {
  id: DifficultyLevel;
  title: string;
  color: string;
  stars: number;
  xpMultiplier: string;
}[] = [
  { id: 'easy', title: 'Kolay', color: '#3FD08A', stars: 1, xpMultiplier: 'x1 XP' },
  { id: 'medium', title: 'Orta', color: '#FFC43D', stars: 2, xpMultiplier: 'x1,5 XP' },
  { id: 'hard', title: 'Zor', color: '#FF9B2F', stars: 3, xpMultiplier: 'x2 XP' },
  { id: 'expert', title: 'Uzman', color: '#FF5A6A', stars: 4, xpMultiplier: 'x3 XP' },
];
export const DifficultySelectScreen: React.FC<DifficultySelectScreenProps> = ({
  categoryId,
  onBack,
  onSelectDifficulty,
  avatarSeed,
  coins = 0,
  gems = 0,
  isGuest = false,
  onLoginPrompt,
}) => {
  const [selected, setSelected] = useState<DifficultyLevel>('hard');
  const category = ALL_CATEGORIES.find((c) => c.id === categoryId);
  return (
    <TavrikoScreen>
      <TavrikoTopBar
        leftType="back"
        onLeftPress={onBack}
        avatarSeed={avatarSeed}
        coins={coins}
        gems={gems}
        isGuest={isGuest}
        onGuestLoginPress={onLoginPrompt}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>ZORLUK SEVİYESİ</Text>
        <Text style={styles.subtitle}>
          {category?.name || 'Bilim'} · 5 soru
        </Text>
        {DIFFICULTIES.map((diff) => {
          const isSelected = selected === diff.id;
          return (
            <TouchableOpacity
              key={diff.id}
              style={[
                styles.diffCard,
                { borderLeftColor: diff.color },
                isSelected && styles.diffCardSelected,
              ]}
              onPress={() => {
                sound.playSound('tap');
                sound.triggerHaptic('light');
                setSelected(diff.id);
              }}
              activeOpacity={0.85}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.diffTitle, { color: diff.color }]}>
                  {diff.title}
                </Text>
                <View style={styles.starsRow}>
                  {Array.from({ length: diff.stars }).map((_, idx) => (
                    <XpStarIcon key={idx} size={18} />
                  ))}
                </View>
              </View>
              <View style={styles.xpPill}>
                <Text style={styles.xpPillText}>{diff.xpMultiplier}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
        <View style={{ marginTop: 8 }}>
          <Button3D
            title="DEVAM"
            onPress={() => onSelectDifficulty(selected)}
            style={{ height: 56 }}
          />
        </View>
      </ScrollView>
    </TavrikoScreen>
  );
};
const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 32,
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 36,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  subtitle: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    marginBottom: 14,
  },
  diffCard: {
    height: 92,
    paddingHorizontal: 18,
    marginBottom: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderLeftWidth: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  diffCardSelected: {
    borderColor: '#FFC43D',
  },
  diffTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 26,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 4,
  },
  xpPill: {
    backgroundColor: 'rgba(10, 4, 24, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  xpPillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
  },
});