import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { CategoryInfo, CategoryId, ALL_CATEGORIES } from '@trivia/shared';
import { ArrowLeft, Sparkles, BookCheck } from 'lucide-react-native';

interface CategoryExploreScreenProps {
  onBack: () => void;
  onSelectCategory: (categoryId: CategoryId) => void;
}

export const CategoryExploreScreen: React.FC<CategoryExploreScreenProps> = ({
  onBack,
  onSelectCategory,
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
        <Text style={styles.headerTitle}>Kategorileri Keşfet</Text>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        <Text style={styles.leadText}>
          İlgi alanına göre bir kategori seç, rakiplerinle yarış veya seviyeni geliştir!
        </Text>

        <View style={styles.grid}>
          {ALL_CATEGORIES.map((cat: CategoryInfo) => {
            const catColors = THEME.categoryColors[cat.id] || THEME.categoryColors.mixed;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryCard, { borderColor: catColors.primary }]}
                activeOpacity={0.8}
                onPress={() => {
                  sound.playSound('tap');
                  onSelectCategory(cat.id);
                }}
              >
                <View style={[styles.iconPill, { backgroundColor: `${catColors.primary}22` }]}>
                  <Sparkles size={20} color={catColors.primary} />
                </View>
                <Text style={styles.cardTitle}>{cat.name}</Text>
                <Text style={styles.cardDesc} numberOfLines={2}>
                  {cat.description}
                </Text>
                <View style={styles.countBadge}>
                  <BookCheck size={12} color={THEME.colors.textMuted} />
                  <Text style={styles.countText}>{cat.totalQuestions} Soru</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
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
  list: {
    padding: THEME.spacing.lg,
    paddingBottom: 40,
  },
  leadText: {
    fontSize: 14,
    color: THEME.colors.textSecondary,
    marginBottom: THEME.spacing.lg,
    lineHeight: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryCard: {
    width: '48%',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.md,
    borderWidth: 1.5,
  },
  iconPill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    lineHeight: 15,
    marginBottom: 10,
    minHeight: 30,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  countText: {
    fontSize: 11,
    fontWeight: '600',
    color: THEME.colors.textMuted,
  },
});
