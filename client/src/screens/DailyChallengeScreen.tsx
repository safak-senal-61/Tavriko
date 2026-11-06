import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { UserProfile, DailyChallengeConfig, getDailyChallengeConfig } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import {
  TavrikoScreen,
  TavrikoTopBar,
  Button3D,
  StreakFlameIcon,
  CheckMarkSvg,
  GemIcon,
  ChestIcon,
  CoinIcon,
} from '../components/TavrikoIcons';
interface DailyChallengeScreenProps {
  user?: UserProfile;
  onBack: () => void;
  onStartDaily: (config: DailyChallengeConfig) => void;
}
export const DailyChallengeScreen: React.FC<DailyChallengeScreenProps> = ({
  user,
  onBack,
  onStartDaily,
}) => {
  const streak = Math.max(1, user?.dailyStreak ?? 1);
  const isCompletedToday = Boolean(user?.dailyChallenge?.completedToday);
  const cfg = getDailyChallengeConfig(streak);
  // 7-day tracker
  // If completed today, days 1..cfg.dayNumber are done!
  // If not completed today, days 1..(cfg.dayNumber - 1) are done, cfg.dayNumber is active!
  const currentActiveDay = cfg.dayNumber;
  const days = [1, 2, 3, 4, 5, 6, 7].map((d) => {
    const isDone = isCompletedToday ? d <= currentActiveDay : d < currentActiveDay;
    const isActive = !isCompletedToday && d === currentActiveDay;
    const isToday = d === currentActiveDay;
    return {
      label: `${d}.G`,
      done: isDone,
      active: isActive,
      today: isToday,
    };
  });
  return (
    <TavrikoScreen>
      <TavrikoTopBar
        leftType="back"
        onLeftPress={onBack}
        coins={user?.coins ?? 0}
        gems={user?.gems ?? 0}
        avatarSeed={user?.avatarUrl || user?.displayName}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={styles.title}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          GÜNLÜK MEYDAN OKUMA
        </Text>
        {/* Dynamic Streak Flame Hero */}
        <View style={styles.streakHero}>
          <View style={styles.flameContainer}>
            <StreakFlameIcon size={76} active={isCompletedToday} />
          </View>
          <Text style={styles.streakTitle}>
            {streak} günlük seri {isCompletedToday ? '🔥' : ''}
          </Text>
          <Text style={styles.streakSub}>
            {isCompletedToday
              ? '✓ Bugünkü meydan okuma tamamlandı! Serin korundu.'
              : `En iyi seri: ${user?.stats?.bestStreak ?? 0} · Seriyi bozma, ödüller büyüyor`}
          </Text>
          {isCompletedToday && (
            <View style={styles.completedBadge}>
              <Text style={styles.completedBadgeText}>🔥 GÜNLÜK SERİ ATEŞLENDİ</Text>
            </View>
          )}
        </View>
        {/* 7-Day Circle Tracker with Glowing Today Indicator */}
        <View style={styles.daysCard}>
          {days.map((d) => (
            <View key={d.label} style={styles.dayCol}>
              <View
                style={[
                  styles.dayCircle,
                  d.done && styles.dayCircleDone,
                  d.active && styles.dayCircleActive,
                  d.today && styles.dayCircleTodayRing,
                ]}
              >
                {d.done ? (
                  <StreakFlameIcon size={22} active={true} />
                ) : d.active ? (
                  <StreakFlameIcon size={18} active={false} />
                ) : null}
              </View>
              <Text
                style={[
                  styles.dayLabel,
                  d.today && { color: '#FFC43D', fontFamily: THEME.fonts.extraBold },
                ]}
              >
                {d.label}
              </Text>
            </View>
          ))}
        </View>
        {/* Mission Card (Changes based on whether today is completed) */}
        {isCompletedToday ? (
          <View style={[styles.missionCard, styles.missionCardCompleted]}>
            <View style={styles.completedStatusPill}>
              <Text style={styles.completedStatusText}>✓ BUGÜN TAMAMLANDI</Text>
            </View>
            <Text style={styles.missionTitle}>Harika İş Çıkardın! 🔥</Text>
            <Text style={styles.missionDesc}>
              Bugünkü görev başarıyla tamamlandı. Yarın ({((streak) % 7) + 1}. Gün):{' '}
              {getDailyChallengeConfig(streak + 1).description} görevi seni bekliyor!
            </Text>
            <View style={styles.rewardLine}>
              <Text style={styles.rewardLabel}>Kazanılan Ödül: </Text>
              <Text style={styles.rewardVal}>+{cfg.rewardXp} XP</Text>
              <Text style={styles.rewardSep}> · </Text>
              <CoinIcon size={15} />
              <Text style={styles.rewardVal}> +{cfg.rewardCoins}</Text>
              <Text style={styles.rewardSep}> · </Text>
              <GemIcon size={15} />
              <Text style={styles.rewardVal}> +{cfg.rewardGems}</Text>
            </View>
            <Button3D
              title="TEKRAR PRATİK YAP (ÖDÜLSÜZ)"
              variant="mint"
              onPress={() => onStartDaily(cfg)}
              style={{ width: '100%', marginTop: 6 }}
            />
          </View>
        ) : (
          <View style={styles.missionCard}>
            <View style={styles.xpPill}>
              <Text style={styles.xpPillText}>GÜN {cfg.dayNumber} · 2x XP</Text>
            </View>
            <Text style={styles.missionTitle}>{cfg.description}</Text>
            <View style={styles.rewardLine}>
              <Text style={styles.rewardLabel}>Ödül: </Text>
              <Text style={styles.rewardVal}>+{cfg.rewardXp} XP</Text>
              <Text style={styles.rewardSep}> · </Text>
              <CoinIcon size={16} />
              <Text style={styles.rewardVal}> +{cfg.rewardCoins}</Text>
              <Text style={styles.rewardSep}> · </Text>
              <GemIcon size={16} />
              <Text style={styles.rewardVal}> +{cfg.rewardGems}</Text>
              {cfg.rewardChest && (
                <>
                  <Text style={styles.rewardSep}> · </Text>
                  <ChestIcon size={18} />
                  <Text style={styles.rewardVal}>
                    {cfg.rewardChest === 'mega_chest' ? ' Mega Sandık' : ' Sandık'}
                  </Text>
                </>
              )}
            </View>
            <Button3D
              title="MEYDAN OKUMAYA BAŞLA"
              variant="gold"
              onPress={() => onStartDaily(cfg)}
              style={{ width: '100%' }}
            />
          </View>
        )}
      </ScrollView>
    </TavrikoScreen>
  );
};
const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 36,
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 22,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  streakHero: {
    alignItems: 'center',
    marginVertical: 8,
  },
  flameContainer: {
    marginVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 24,
    color: '#FFFFFF',
    marginTop: 4,
  },
  streakSub: {
    color: '#D1D5DB',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
    marginTop: 2,
    textAlign: 'center',
  },
  completedBadge: {
    marginTop: 8,
    backgroundColor: 'rgba(255, 122, 0, 0.22)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF7A00',
  },
  completedBadgeText: {
    color: '#FFB300',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    letterSpacing: 0.8,
  },
  daysCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 8,
  },
  dayCol: {
    alignItems: 'center',
    gap: 6,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  dayCircleDone: {
    backgroundColor: '#F59E0B',
    borderWidth: 2,
    borderColor: '#FCD34D',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 5,
  },
  dayCircleActive: {
    borderWidth: 2,
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  dayCircleTodayRing: {
    borderColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F59E0B',
  },
  dayLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: THEME.fonts.bold,
  },
  missionCard: {
    marginTop: 10,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  missionCardCompleted: {
    backgroundColor: '#0F172A',
    borderColor: 'rgba(16, 185, 129, 0.55)',
  },
  xpPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
  },
  xpPillText: {
    color: '#FFC43D',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  completedStatusPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(90, 219, 181, 0.2)',
    borderWidth: 1,
    borderColor: '#5ADBB5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
  },
  completedStatusText: {
    color: '#5ADBB5',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  missionTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 22,
    color: '#FFFFFF',
    marginTop: 10,
    marginBottom: 4,
  },
  missionDesc: {
    color: '#D9CDF5',
    fontSize: 13,
    fontFamily: THEME.fonts.bold,
    lineHeight: 18,
    marginBottom: 12,
  },
  rewardLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 4,
  },
  rewardLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
  },
  rewardVal: {
    color: '#FFC43D',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
  },
  rewardSep: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
  },
});