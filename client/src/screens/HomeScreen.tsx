import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { UserProfile } from '@trivia/shared';
import {
  Zap,
  Users,
  Compass,
  Trophy,
  Flame,
  Award,
  BookOpen,
  Swords,
  ChevronRight,
  Coins,
  Settings,
  Bell,
} from 'lucide-react-native';

interface HomeScreenProps {
  user: UserProfile;
  onQuickMatch: () => void;
  onCustomRoom: () => void;
  onExploreCategories: () => void;
  onDailyChallenge: () => void;
  onPractice: () => void;
  onLeaderboard: () => void;
  onFriends: () => void;
  onProfile: () => void;
  onNotifications: () => void;
  onSettings: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  user,
  onQuickMatch,
  onCustomRoom,
  onExploreCategories,
  onDailyChallenge,
  onPractice,
  onLeaderboard,
  onFriends,
  onProfile,
  onNotifications,
  onSettings,
}) => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Bar / Profile Header */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.userSection} onPress={onProfile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.userName}>{user.displayName}</Text>
            <View style={styles.rankRow}>
              <View style={styles.levelBadge}>
                <Text style={styles.levelText}>Lv. {user.level}</Text>
              </View>
              <Text style={styles.rankTitle}>{user.rankTitle}</Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.topIcons}>
          <View style={styles.coinBadge}>
            <Coins size={14} color={THEME.colors.gold} />
            <Text style={styles.coinText}>{user.coins}</Text>
          </View>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              sound.playSound('tap');
              onNotifications();
            }}
          >
            <Bell size={20} color={THEME.colors.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              sound.playSound('tap');
              onSettings();
            }}
          >
            <Settings size={20} color={THEME.colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Hero Quick Match Banner */}
      <TouchableOpacity
        style={styles.heroBanner}
        activeOpacity={0.88}
        onPress={() => {
          sound.playSound('tap');
          sound.triggerHaptic('medium');
          onQuickMatch();
        }}
      >
        <View style={styles.heroContent}>
          <View style={styles.heroBadge}>
            <Zap size={14} color="#FFF" />
            <Text style={styles.heroBadgeText}>CANLI MULTIPLAYER</Text>
          </View>
          <Text style={styles.heroTitle}>Hızlı Eşleşme</Text>
          <Text style={styles.heroSubtitle}>Dünyanın dört bir yanından rakiplerle anında karşılaş</Text>
        </View>
        <View style={styles.playActionCircle}>
          <ChevronRight size={28} color="#FFF" />
        </View>
      </TouchableOpacity>

      {/* Daily Challenge Card */}
      <TouchableOpacity
        style={styles.dailyCard}
        onPress={() => {
          sound.playSound('tap');
          onDailyChallenge();
        }}
      >
        <View style={styles.dailyLeft}>
          <View style={styles.dailyFlame}>
            <Flame size={24} color={THEME.colors.streak} />
          </View>
          <View>
            <Text style={styles.dailyTitle}>Günün Meydan Okuması</Text>
            <Text style={styles.dailySubtitle}>Özel 5 soru • 2x Deneyim Puanı</Text>
          </View>
        </View>
        <View style={styles.dailyTag}>
          <Text style={styles.dailyTagText}>GİRİŞ YAP</Text>
        </View>
      </TouchableOpacity>

      {/* Game Modes Grid */}
      <Text style={styles.sectionHeader}>Oyun Modları</Text>
      <View style={styles.grid}>
        <TouchableOpacity
          style={[styles.gridCard, { borderColor: THEME.colors.primary }]}
          onPress={() => {
            sound.playSound('tap');
            onCustomRoom();
          }}
        >
          <View style={[styles.gridIconCircle, { backgroundColor: 'rgba(99, 102, 241, 0.2)' }]}>
            <Users size={24} color={THEME.colors.primaryLight} />
          </View>
          <Text style={styles.gridTitle}>Arkadaşlarla Oyna</Text>
          <Text style={styles.gridDesc}>Özel oda kur, oda kodunu paylaş</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.gridCard, { borderColor: THEME.colors.secondary }]}
          onPress={() => {
            sound.playSound('tap');
            onPractice();
          }}
        >
          <View style={[styles.gridIconCircle, { backgroundColor: 'rgba(236, 72, 153, 0.2)' }]}>
            <BookOpen size={24} color={THEME.colors.secondary} />
          </View>
          <Text style={styles.gridTitle}>Tek Kişilik Pratik</Text>
          <Text style={styles.gridDesc}>Kategorileri öğren ve seviye atla</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.gridCard, { borderColor: THEME.colors.accent }]}
          onPress={() => {
            sound.playSound('tap');
            onExploreCategories();
          }}
        >
          <View style={[styles.gridIconCircle, { backgroundColor: 'rgba(6, 182, 212, 0.2)' }]}>
            <Compass size={24} color={THEME.colors.accent} />
          </View>
          <Text style={styles.gridTitle}>Kategorileri Keşfet</Text>
          <Text style={styles.gridDesc}>16 Farklı kategori ve zorluklar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.gridCard, { borderColor: THEME.colors.gold }]}
          onPress={() => {
            sound.playSound('tap');
            onLeaderboard();
          }}
        >
          <View style={[styles.gridIconCircle, { backgroundColor: 'rgba(251, 191, 36, 0.2)' }]}>
            <Trophy size={24} color={THEME.colors.gold} />
          </View>
          <Text style={styles.gridTitle}>Liderler Tablosu</Text>
          <Text style={styles.gridDesc}>Haftalık ve sezonluk sıralama</Text>
        </TouchableOpacity>
      </View>

      {/* Social / Quick Action Row */}
      <View style={styles.quickRow}>
        <TouchableOpacity
          style={styles.quickBtn}
          onPress={() => {
            sound.playSound('tap');
            onFriends();
          }}
        >
          <Users size={18} color={THEME.colors.textPrimary} />
          <Text style={styles.quickBtnText}>Arkadaşlar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickBtn}
          onPress={() => {
            sound.playSound('tap');
            onProfile();
          }}
        >
          <Award size={18} color={THEME.colors.textPrimary} />
          <Text style={styles.quickBtnText}>Başarılar</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  content: {
    padding: THEME.spacing.lg,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.xl,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: THEME.colors.primaryLight,
  },
  avatarText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  levelBadge: {
    backgroundColor: THEME.colors.cardHover,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: THEME.radius.sm,
  },
  levelText: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.primaryLight,
  },
  rankTitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    fontWeight: '500',
  },
  topIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: THEME.colors.card,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  coinText: {
    color: THEME.colors.gold,
    fontWeight: '700',
    fontSize: 13,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: THEME.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  heroBanner: {
    backgroundColor: THEME.colors.primary,
    borderRadius: THEME.radius.xl,
    padding: THEME.spacing.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: THEME.spacing.lg,
    shadowColor: THEME.colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  heroContent: {
    flex: 1,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radius.full,
    marginBottom: 8,
  },
  heroBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
  },
  playActionCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  dailyCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: THEME.spacing.xl,
  },
  dailyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dailyFlame: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dailyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  dailySubtitle: {
    fontSize: 12,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  dailyTag: {
    backgroundColor: THEME.colors.cardHover,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: THEME.colors.streak,
  },
  dailyTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.streak,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginBottom: THEME.spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: THEME.spacing.xl,
  },
  gridCard: {
    width: '48%',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    padding: THEME.spacing.md,
    borderWidth: 1,
  },
  gridIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  gridTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
    marginBottom: 4,
  },
  gridDesc: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    lineHeight: 15,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: THEME.colors.card,
    paddingVertical: 14,
    borderRadius: THEME.radius.md,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  quickBtnText: {
    color: THEME.colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
});
