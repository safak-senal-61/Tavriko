import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { CategoryId, DifficultyLevel } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import {
  TavrikoScreen,
  TavrikoTopBar,
  Button3D,
  XpStarIcon,
} from '../components/TavrikoIcons';
interface SinglePlayerPracticeScreenProps {
  onBack: () => void;
  onStartPractice: (category: CategoryId, difficulty: DifficultyLevel) => void;
}
const PRACTICE_CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'science_tech', label: 'Bilim' },
  { id: 'history', label: 'Tarih' },
  { id: 'sports', label: 'Spor' },
  { id: 'space_astronomy', label: 'Uzay' },
];
const PRACTICE_DIFFICULTIES: { id: DifficultyLevel; label: string }[] = [
  { id: 'easy', label: 'Kolay' },
  { id: 'medium', label: 'Orta' },
  { id: 'hard', label: 'Zor' },
  { id: 'expert', label: 'Uzman' },
];
const QUESTION_COUNTS = [5, 10, 15, 20];
export const SinglePlayerPracticeScreen: React.FC<
  SinglePlayerPracticeScreenProps
> = ({ onBack, onStartPractice }) => {
  const [selectedCat, setSelectedCat] = useState<CategoryId>('science_tech');
  const [selectedDiff, setSelectedDiff] = useState<DifficultyLevel>('medium');
  const [selectedCount, setSelectedCount] = useState<number>(10);
  const [timerEnabled, setTimerEnabled] = useState<boolean>(true);
  return (
    <TavrikoScreen>
      <TavrikoTopBar leftType="back" onLeftPress={onBack} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>TEK KİŞİLİK PRATİK</Text>
        <Text style={styles.subtitle}>Kendi hızında çalış</Text>
        {/* Kategori */}
        <Text style={styles.sectionLabel}>Kategori</Text>
        <View style={styles.chipRow}>
          {PRACTICE_CATEGORIES.map((c) => {
            const isOn = selectedCat === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.chip, isOn && styles.chipOn]}
                onPress={() => setSelectedCat(c.id)}
              >
                <Text style={styles.chipText}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {/* Zorluk */}
        <Text style={styles.sectionLabel}>Zorluk</Text>
        <View style={styles.chipRow}>
          {PRACTICE_DIFFICULTIES.map((d) => {
            const isOn = selectedDiff === d.id;
            return (
              <TouchableOpacity
                key={d.id}
                style={[styles.chip, isOn && styles.chipOn]}
                onPress={() => setSelectedDiff(d.id)}
              >
                <Text style={styles.chipText}>{d.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {/* Soru sayısı */}
        <Text style={styles.sectionLabel}>Soru sayısı</Text>
        <View style={styles.chipRow}>
          {QUESTION_COUNTS.map((cnt) => {
            const isOn = selectedCount === cnt;
            return (
              <TouchableOpacity
                key={cnt}
                style={[styles.chip, isOn && styles.chipOn]}
                onPress={() => setSelectedCount(cnt)}
              >
                <Text style={styles.chipText}>{cnt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {/* Zamanlayıcı Toggle */}
        <TouchableOpacity
          style={styles.toggleCard}
          onPress={() => setTimerEnabled((v) => !v)}
          activeOpacity={0.85}
        >
          <Text style={styles.toggleLabel}>Zamanlayıcı</Text>
          <View
            style={[
              styles.switchTrack,
              { backgroundColor: timerEnabled ? '#3FD08A' : '#4A3A7A' },
            ]}
          >
            <View
              style={[
                styles.switchThumb,
                timerEnabled ? { right: 3 } : { left: 3 },
              ]}
            />
          </View>
        </TouchableOpacity>
        {/* Last Practice Summary */}
        <View style={styles.lastPracticeCard}>
          <XpStarIcon size={22} />
          <Text style={styles.lastPracticeText}>
            Son antrenman: Bilim · 8/10 doğru
          </Text>
        </View>
        <Button3D
          title="ANTRENMANI BAŞLAT"
          onPress={() => onStartPractice(selectedCat, selectedDiff)}
          style={{ height: 56 }}
        />
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
    fontSize: 34,
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
  sectionLabel: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  chip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    alignItems: 'center',
  },
  chipOn: {
    backgroundColor: '#6B3CFF',
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    marginBottom: 12,
  },
  toggleLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: THEME.fonts.extraBold,
  },
  switchTrack: {
    width: 46,
    height: 26,
    borderRadius: 13,
    position: 'relative',
  },
  switchThumb: {
    position: 'absolute',
    top: 3,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  lastPracticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    marginBottom: 20,
  },
  lastPracticeText: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
});