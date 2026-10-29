import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { CategoryId, DifficultyLevel, ALL_CATEGORIES } from '@trivia/shared';
import { ArrowLeft, Play, Shield, Zap, Flame, Award } from 'lucide-react-native';

interface SinglePlayerPracticeScreenProps {
  onBack: () => void;
  onStartPractice: (category: CategoryId, difficulty: DifficultyLevel) => void;
}

export const SinglePlayerPracticeScreen: React.FC<SinglePlayerPracticeScreenProps> = ({
  onBack,
  onStartPractice,
}) => {
  const [selectedCat, setSelectedCat] = useState<CategoryId>('general_culture');
  const [selectedDiff, setSelectedDiff] = useState<DifficultyLevel>('medium');

  const difficulties: Array<{ id: DifficultyLevel; name: string }> = [
    { id: 'easy', name: 'Kolay' },
    { id: 'medium', name: 'Orta' },
    { id: 'hard', name: 'Zor' },
    { id: 'expert', name: 'Uzman' },
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
        <Text style={styles.headerTitle}>Tek Kişilik Pratik</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>1. Zorluk Seviyesi</Text>
        <View style={styles.diffRow}>
          {difficulties.map((d) => {
            const isSelected = selectedDiff === d.id;
            return (
              <TouchableOpacity
                key={d.id}
                style={[styles.diffBtn, isSelected && styles.diffBtnSelected]}
                onPress={() => {
                  sound.playSound('tap');
                  setSelectedDiff(d.id);
                }}
              >
                <Text style={[styles.diffText, isSelected && styles.diffTextSelected]}>
                  {d.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>2. Kategori Seçimi</Text>
        <View style={styles.catGrid}>
          {ALL_CATEGORIES.map((cat) => {
            const isSelected = selectedCat === cat.id;
            const catColors = THEME.categoryColors[cat.id] || THEME.categoryColors.mixed;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.catCard,
                  isSelected && { borderColor: catColors.primary, backgroundColor: `${catColors.primary}18` },
                ]}
                onPress={() => {
                  sound.playSound('tap');
                  setSelectedCat(cat.id);
                }}
              >
                <Text style={[styles.catName, isSelected && { color: catColors.primary }]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={styles.startButton}
          onPress={() => {
            sound.playSound('tap');
            onStartPractice(selectedCat, selectedDiff);
          }}
        >
          <Play size={20} color="#FFF" />
          <Text style={styles.btnText}>Pratiğe Başla</Text>
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
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginBottom: 12,
    marginTop: 8,
  },
  diffRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  diffBtn: {
    flex: 1,
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
  },
  diffBtnSelected: {
    borderColor: THEME.colors.primary,
    backgroundColor: THEME.colors.primary,
  },
  diffText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textMuted,
  },
  diffTextSelected: {
    color: '#FFF',
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  catCard: {
    width: '48%',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.md,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: THEME.colors.border,
  },
  catName: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
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
