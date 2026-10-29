import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { UserProfile } from '@trivia/shared';
import { ArrowLeft, Award, Flame, Target, Clock, Zap, Shield, Sparkles } from 'lucide-react-native';

interface ProfileScreenProps {
  user: UserProfile;
  onBack: () => void;
  onEditProfile?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ user, onBack, onEditProfile }) => {
  const winRate =
    user.stats.totalMatches > 0
      ? Math.round((user.stats.wins / user.stats.totalMatches) * 100)
      : 0;

  const accuracy =
    user.stats.totalAnswers > 0
      ? Math.round((user.stats.correctAnswers / user.stats.totalAnswers) * 100)
      : 0;

  const achievements = [
    { id: 'ach1', title: 'İlk Zafer', desc: 'İlk çok oyunculu maçını kazan', unlocked: true, icon: Award },
    { id: 'ach2', title: 'Hız Tutkunu', desc: 'Bir soruyu 2 saniyenin altında doğru bil', unlocked: true, icon: Zap },
    { id: 'ach3', title: 'Seri Katil', desc: '5 soru üst üste doğru cevap ver', unlocked: user.stats.bestStreak >= 5, icon: Flame },
    { id: 'ach4', title: 'Bilgi Ustası', desc: '100 soru doğru yanıtla', unlocked: user.stats.correctAnswers >= 100, icon: Shield },
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
        <Text style={styles.headerTitle}>Oyuncu Profili</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* User Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.displayName}>{user.displayName}</Text>
          <Text style={styles.username}>@{user.username}</Text>

          <View style={styles.rankPill}>
            <Sparkles size={14} color={THEME.colors.gold} />
            <Text style={styles.rankPillText}>{user.rankTitle} ({user.rankPoints} LP)</Text>
          </View>

          {/* XP Progress */}
          <View style={styles.xpSection}>
            <View style={styles.xpLabelRow}>
              <Text style={styles.levelBadgeText}>Seviye {user.level}</Text>
              <Text style={styles.xpText}>{user.xp} / 1000 XP</Text>
            </View>
            <View style={styles.xpTrack}>
              <View style={[styles.xpFill, { width: `${Math.min(100, (user.xp % 1000) / 10)}%` }]} />
            </View>
          </View>
        </View>

        {/* Stats 4-Grid */}
        <Text style={styles.sectionTitle}>Kariyer İstatistikleri</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Target size={20} color={THEME.colors.primaryLight} />
            <Text style={styles.statVal}>{user.stats.totalMatches}</Text>
            <Text style={styles.statLbl}>Toplam Maç</Text>
          </View>

          <View style={styles.statCard}>
            <Award size={20} color={THEME.colors.correct} />
            <Text style={[styles.statVal, { color: THEME.colors.correct }]}>%{winRate}</Text>
            <Text style={styles.statLbl}>Kazanma Oranı</Text>
          </View>

          <View style={styles.statCard}>
            <Flame size={20} color={THEME.colors.streak} />
            <Text style={[styles.statVal, { color: THEME.colors.streak }]}>{user.stats.bestStreak}x</Text>
            <Text style={styles.statLbl}>En İyi Seri</Text>
          </View>

          <View style={styles.statCard}>
            <Clock size={20} color={THEME.colors.accent} />
            <Text style={styles.statVal}>%{accuracy}</Text>
            <Text style={styles.statLbl}>İsabet Oranı</Text>
          </View>
        </View>

        {/* Achievements Section */}
        <Text style={styles.sectionTitle}>Başarılar</Text>
        <View style={styles.achievementsList}>
          {achievements.map((ach) => {
            const Icon = ach.icon;
            return (
              <View key={ach.id} style={[styles.achCard, !ach.unlocked && styles.achLocked]}>
                <View style={[styles.achIcon, ach.unlocked ? styles.achIconUnlocked : styles.achIconLocked]}>
                  <Icon size={20} color={ach.unlocked ? THEME.colors.primaryLight : THEME.colors.textMuted} />
                </View>
                <View style={styles.achInfo}>
                  <Text style={[styles.achTitle, !ach.unlocked && styles.textLocked]}>{ach.title}</Text>
                  <Text style={styles.achDesc}>{ach.desc}</Text>
                </View>
                <View style={[styles.statusBadge, ach.unlocked ? styles.statusBadgeUnlocked : styles.statusBadgeLocked]}>
                  <Text style={[styles.statusBadgeText, ach.unlocked ? styles.textUnlocked : styles.textLocked]}>
                    {ach.unlocked ? 'AÇILDI' : 'KİLİTLİ'}
                  </Text>
                </View>
              </View>
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
  content: {
    padding: THEME.spacing.lg,
    paddingBottom: 40,
  },
  profileCard: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.xl,
    padding: THEME.spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 20,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: THEME.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: THEME.colors.primaryLight,
    marginBottom: 8,
  },
  avatarText: {
    color: '#FFF',
    fontSize: 30,
    fontWeight: '900',
  },
  displayName: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  username: {
    fontSize: 13,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  rankPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: THEME.colors.backgroundSecondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: THEME.radius.full,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginVertical: 12,
  },
  rankPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.gold,
  },
  xpSection: {
    width: '100%',
    marginTop: 4,
  },
  xpLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  levelBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.colors.primaryLight,
  },
  xpText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontWeight: '600',
  },
  xpTrack: {
    height: 8,
    backgroundColor: THEME.colors.backgroundSecondary,
    borderRadius: 4,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    backgroundColor: THEME.colors.primary,
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  statVal: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.colors.textPrimary,
    marginVertical: 4,
  },
  statLbl: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontWeight: '600',
  },
  achievementsList: {
    gap: 10,
  },
  achCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.colors.card,
    padding: 12,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  achLocked: {
    opacity: 0.6,
  },
  achIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  achIconUnlocked: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  achIconLocked: {
    backgroundColor: THEME.colors.backgroundSecondary,
  },
  achInfo: {
    flex: 1,
  },
  achTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  achDesc: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: THEME.radius.sm,
  },
  statusBadgeUnlocked: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  statusBadgeLocked: {
    backgroundColor: THEME.colors.backgroundSecondary,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  textUnlocked: {
    color: THEME.colors.correct,
  },
  textLocked: {
    color: THEME.colors.textMuted,
  },
});
