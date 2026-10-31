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
        <Text style={styles.title}>GÜNÜN MEYDAN OKUMASI</Text>
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
              title="MEYDAN OKUMAYA BAŞLA ⚡"
              variant="mint"
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
    fontSize: 30,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  streakHero: {
    alignItems: 'center',
    marginVertical: 12,
  },
  flameContainer: {
    marginVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 28,
    color: '#FFFFFF',
    marginTop: 6,
  },
  streakSub: {
    color: '#D9CDF5',
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
    paddingVertical: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    marginVertical: 10,
  },
  dayCol: {
    alignItems: 'center',
    gap: 6,
  },
  dayCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleDone: {
    backgroundColor: '#FF8800',
    borderWidth: 2,
    borderColor: '#FFC43D',
    shadowColor: '#FF9B2F',
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 6,
  },
  dayCircleActive: {
    borderWidth: 2,
    borderColor: '#FFC43D',
    backgroundColor: 'rgba(255, 196, 61, 0.18)',
  },
  dayCircleTodayRing: {
    shadowColor: '#FFC43D',
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  activeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFC43D',
  },
  dayLabel: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.bold,
  },
  missionCard: {
    marginTop: 14,
    padding: 18,
    borderRadius: 24,
    backgroundColor: '#7A3FE0',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 196, 61, 0.35)',
  },
  missionCardCompleted: {
    backgroundColor: '#1E1242',
    borderColor: 'rgba(90, 219, 181, 0.55)',
  },
  xpPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(10, 4, 24, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
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