import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { UserProfile, calculateLevelFromXp } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { DEFAULT_API_BASE } from '../config';
import {
  TavrikoScreen,
  TavrikoTopBar,
  TavrikoProgressBar,
  Button3D,
  XpStarIcon,
  ChestIcon,
  CoinIcon,
  GemIcon,
  KeyIcon,
  CrownIcon,
  CheckMarkSvg,
} from '../components/TavrikoIcons';
interface SeasonScreenProps {
  user?: UserProfile;
  apiBaseUrl?: string;
  onUpdateUser?: (updatedUser: UserProfile) => void;
  onBack: () => void;
  onProfile?: () => void;
}
interface SeasonTierItem {
  tier: number;
  requiredXp: number;
  freeReward: {
    type: 'coin' | 'gem' | 'key' | 'chest';
    amount: number;
    title: string;
  };
  premiumReward: {
    type: 'coin' | 'gem' | 'chest' | 'crown';
    amount: number;
    title: string;
  };
}
const SEASON_TIERS: SeasonTierItem[] = [
  {
    tier: 1,
    requiredXp: 300,
    freeReward: { type: 'coin', amount: 200, title: '200 Altın' },
    premiumReward: { type: 'chest', amount: 1, title: 'Mega Sandık' },
  },
  {
    tier: 2,
    requiredXp: 750,
    freeReward: { type: 'gem', amount: 10, title: '10 Elmas' },
    premiumReward: { type: 'coin', amount: 1000, title: '1.000 Altın' },
  },
  {
    tier: 3,
    requiredXp: 1350,
    freeReward: { type: 'key', amount: 1, title: 'Altın Anahtar' },
    premiumReward: { type: 'gem', amount: 50, title: '50 Elmas' },
  },
  {
    tier: 4,
    requiredXp: 2100,
    freeReward: { type: 'chest', amount: 1, title: 'Günün Sandığı' },
    premiumReward: { type: 'coin', amount: 2500, title: '2.500 Altın' },
  },
  {
    tier: 5,
    requiredXp: 3000,
    freeReward: { type: 'gem', amount: 25, title: '25 Elmas' },
    premiumReward: { type: 'crown', amount: 1, title: 'Kraliyet Tacı' },
  },
];
export const SeasonScreen: React.FC<SeasonScreenProps> = ({
  user,
  apiBaseUrl,
  onUpdateUser,
  onBack,
  onProfile,
}) => {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState<boolean>(false);
  const [loadingTier, setLoadingTier] = useState<number | null>(null);
  const claimedTiers = user?.claimedSeasonTiers || [1];
  const prog = calculateLevelFromXp(user?.xp ?? 0);
  const userLevel = prog.level;
  const userXp = user?.xp || 0;
  const handleClaimTier = async (tier: number) => {
    if (!user) return;
    setStatusMessage(null);
    setIsError(false);
    // Pre-flight check: is user level sufficient for this tier?
    if (tier > userLevel) {
      sound.playSound('wrong');
      sound.triggerHaptic('error');
      setIsError(true);
      const targetTierObj = SEASON_TIERS.find((t) => t.tier === tier);
      const neededXp = targetTierObj ? targetTierObj.requiredXp : tier * 450;
      const missingXp = Math.max(0, neededXp - userXp);
      setStatusMessage(
        `⚠️ Bu ödülü açmak için Seviye ${tier} (${neededXp} XP) gerekiyor (Mevcut: ${userXp} XP, Eksik: ${missingXp} XP).`
      );
      return;
    }
    if (claimedTiers.includes(tier)) {
      setStatusMessage(`✓ Seviye ${tier} ödülü zaten alındı.`);
      return;
    }
    setLoadingTier(tier);
    const base = apiBaseUrl || DEFAULT_API_BASE;
    try {
      sound.playSound('tap');
      const res = await fetch(`${base}/social/season/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, tier }),
      });
      const data = await res.json();
      if (!res.ok) {
        sound.playSound('wrong');
        sound.triggerHaptic('error');
        setIsError(true);
        setStatusMessage(data.error || 'Sezon ödülü alınamadı.');
        return;
      }
      sound.playSound('reward');
      sound.triggerHaptic('success');
      setIsError(false);
      if (data.user && onUpdateUser) {
        onUpdateUser(data.user);
      }
      setStatusMessage(data.rewardText || `🎁 Seviye ${tier} ödülü veritabanına kaydedildi!`);
    } catch {
      sound.playSound('wrong');
      setIsError(true);
      setStatusMessage('Sunucu bağlantı hatası.');
    } finally {
      setLoadingTier(null);
    }
  };
  const renderRewardIcon = (type: string, size = 26) => {
    switch (type) {
      case 'coin':
        return <CoinIcon size={size} />;
      case 'gem':
        return <GemIcon size={size} />;
      case 'key':
        return <KeyIcon size={size} />;
      case 'crown':
        return <CrownIcon size={size} />;
      default:
        return <ChestIcon size={size} />;
    }
  };
  return (
    <TavrikoScreen>
      <TavrikoTopBar
        leftType="back"
        onLeftPress={onBack}
        coins={user?.coins ?? 0}
        gems={user?.gems ?? 0}
        avatarSeed={user?.avatarUrl || user?.displayName}
        onAvatarPress={onProfile}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>SEZON 1</Text>
        <Text style={styles.subtitle}>
          Canlı Veritabanı Sezon İlerlemesi · {userXp} XP · {prog.rankTitle}
        </Text>
        {statusMessage && (
          <View
            style={[
              styles.statusBanner,
              isError ? styles.statusBannerError : styles.statusBannerSuccess,
            ]}
          >
            <Text
              style={[
                styles.statusBannerText,
                isError ? styles.statusBannerTextError : styles.statusBannerTextSuccess,
              ]}
            >
              {statusMessage}
            </Text>
          </View>
        )}
        {/* Level Progress Card */}
        <View style={styles.levelCard}>
          <Text style={styles.levelLabel}>SEVİYE {userLevel}</Text>
          <XpStarIcon size={22} />
          <TavrikoProgressBar
            progress={prog.progressPct}
            height={10}
            style={{ flex: 1, marginHorizontal: 8 }}
          />
          <Text style={styles.levelFraction}>%{prog.progressPct}</Text>
        </View>
        {/* Pass Column Headers Matching WhatsApp Image 4 */}
        <View style={styles.passHeaderRow}>
          <View style={[styles.passHeaderCol, styles.premiumHeaderCol]}>
            <CrownIcon size={20} />
            <Text style={styles.premiumHeaderText}>PREMIUM PASS</Text>
          </View>
          <View style={styles.tierHeaderCenter}>
            <Text style={styles.tierHeaderCenterText}>AŞAMA</Text>
          </View>
          <View style={[styles.passHeaderCol, styles.freeHeaderCol]}>
            <Text style={styles.freeHeaderText}>ÜCRETSİZ PASS</Text>
          </View>
        </View>
        {/* Tiers Timeline Rows */}
        <View style={styles.tiersContainer}>
          {SEASON_TIERS.map((item) => {
            const isClaimed = claimedTiers.includes(item.tier);
            const isUnlocked = userLevel >= item.tier;
            return (
              <View key={item.tier} style={styles.tierRow}>
                {/* Premium Side */}
                <View
                  style={[
                    styles.rewardBox,
                    styles.premiumRewardBox,
                    !isUnlocked && styles.rewardBoxLocked,
                  ]}
                >
                  {renderRewardIcon(item.premiumReward.type, 26)}
                  <Text style={styles.rewardText} numberOfLines={1}>
                    {item.premiumReward.title}
                  </Text>
                </View>
                {/* Center Tier Circle */}
                <View style={styles.tierCenterBadge}>
                  <Text style={styles.tierBadgeNum}>{item.tier}</Text>
                </View>
                {/* Free Side */}
                <View
                  style={[
                    styles.rewardBox,
                    styles.freeRewardBox,
                    !isUnlocked && styles.rewardBoxLocked,
                  ]}
                >
                  {renderRewardIcon(item.freeReward.type, 26)}
                  <Text style={styles.rewardText} numberOfLines={1}>
                    {item.freeReward.title}
                  </Text>
                </View>
                {/* Claim / Status Action */}
                <View style={styles.tierActionWrap}>
                  {isClaimed ? (
                    <View style={styles.claimedPill}>
                      <CheckMarkSvg size={14} color="#5ADBB5" />
                      <Text style={styles.claimedPillText}>ALINDI</Text>
                    </View>
                  ) : isUnlocked ? (
                    <Button3D
                      title={loadingTier === item.tier ? '...' : 'ÖDÜLÜ AL'}
                      variant="gold"
                      disabled={loadingTier === item.tier}
                      onPress={() => handleClaimTier(item.tier)}
                      style={styles.claimBtn}
                      textStyle={{ fontSize: 11 }}
                    />
                  ) : (
                    <View style={styles.lockedPill}>
                      <Text style={styles.lockedPillText}>Kilitli (Sv. {item.tier})</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </TavrikoScreen>
  );
};
const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 34,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    marginBottom: 14,
  },
  statusBanner: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  statusBannerSuccess: {
    backgroundColor: 'rgba(90, 219, 181, 0.18)',
    borderColor: '#5ADBB5',
  },
  statusBannerError: {
    backgroundColor: 'rgba(255, 75, 75, 0.20)',
    borderColor: '#FF4B4B',
  },
  statusBannerText: {
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    lineHeight: 18,
  },
  statusBannerTextSuccess: {
    color: '#5ADBB5',
  },
  statusBannerTextError: {
    color: '#FF6B6B',
  },
  levelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(28, 12, 62, 0.88)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 18,
    padding: 12,
    marginBottom: 16,
  },
  levelLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.display,
    marginRight: 6,
  },
  levelFraction: {
    color: '#FFC43D',
    fontSize: 12,
    fontFamily: THEME.fonts.display,
  },
  passHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  passHeaderCol: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  premiumHeaderCol: {
    backgroundColor: 'rgba(255, 196, 61, 0.20)',
    borderWidth: 1,
    borderColor: 'rgba(255, 196, 61, 0.45)',
  },
  premiumHeaderText: {
    color: '#FFC43D',
    fontSize: 11,
    fontFamily: THEME.fonts.display,
    letterSpacing: 0.5,
  },
  tierHeaderCenter: {
    width: 60,
    alignItems: 'center',
  },
  tierHeaderCenterText: {
    color: '#A799C7',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
    letterSpacing: 0.8,
  },
  freeHeaderCol: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  freeHeaderText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: THEME.fonts.display,
    letterSpacing: 0.5,
  },
  tiersContainer: {
    gap: 12,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(28, 12, 62, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 18,
    padding: 10,
    position: 'relative',
  },
  rewardBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  premiumRewardBox: {
    borderColor: 'rgba(255, 196, 61, 0.3)',
    borderWidth: 1,
  },
  freeRewardBox: {
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
  },
  rewardBoxLocked: {
    opacity: 0.5,
  },
  rewardText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    flex: 1,
  },
  tierCenterBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6B3CFF',
    borderWidth: 1.5,
    borderColor: '#FFC43D',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
  },
  tierBadgeNum: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.display,
  },
  tierActionWrap: {
    position: 'absolute',
    bottom: -8,
    right: 14,
  },
  claimBtn: {
    minHeight: 28,
    paddingHorizontal: 12,
  },
  claimedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(90, 219, 181, 0.20)',
    borderWidth: 1,
    borderColor: '#5ADBB5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  claimedPillText: {
    color: '#5ADBB5',
    fontSize: 9,
    fontFamily: THEME.fonts.display,
  },
  lockedPill: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  lockedPillText: {
    color: '#A799C7',
    fontSize: 9,
    fontFamily: THEME.fonts.extraBold,
  },
});