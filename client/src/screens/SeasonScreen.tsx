import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import { UserProfile, SEASON_1_TIERS, SeasonTierItem, SeasonReward } from '@trivia/shared';
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
  BadgeShieldIcon,
  SpeedBoltIcon,
} from '../components/TavrikoIcons';
import Reanimated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Image } from 'react-native';
import { KitHero, STORE_IMG, KIT, FloatingElement, FloatingImage } from '../components/StoreKit';
import { GradientFill } from '../components/TavrikoGradient';

interface SeasonScreenProps {
  user?: UserProfile;
  apiBaseUrl?: string;
  onUpdateUser?: (updatedUser: UserProfile) => void;
  onBack: () => void;
  onProfile?: () => void;
}

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
  const [claimedRewardModal, setClaimedRewardModal] = useState<SeasonReward | null>(null);
  const [isPurchasingPass, setIsPurchasingPass] = useState(false);

  const scrollRef = useRef<any>(null);

  const seasonXp = user?.seasonXp || 0;
  const hasPremium = !!user?.hasPremiumPass;
  const claimedFree = user?.claimedSeasonFreeTiers || user?.claimedSeasonTiers || [1];
  const claimedPremium = user?.claimedSeasonPremiumTiers || [];

  // Calculate current tier (1..50)
  const currentTier = Math.min(50, Math.max(1, Math.floor(seasonXp / 400) + 1));
  const currentTierData = SEASON_1_TIERS.find((t) => t.tier === currentTier) || SEASON_1_TIERS[0];
  const nextTierData = SEASON_1_TIERS.find((t) => t.tier === currentTier + 1);
  const currentTierBaseXp = (currentTier - 1) * 400;
  const xpInCurrentTier = Math.max(0, seasonXp - currentTierBaseXp);
  const progressPct = Math.min(100, Math.max(0, Math.round((xpInCurrentTier / 400) * 100)));

  // Auto-scroll to user's active tier
  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollRef.current && currentTier > 3) {
        scrollRef.current.scrollTo({ y: (currentTier - 2) * 120, animated: true });
      }
    }, 450);
    return () => clearTimeout(timer);
  }, []);

  const handleClaimTier = async (tier: number, track: 'free' | 'premium') => {
    if (!user) return;
    setStatusMessage(null);
    setIsError(false);

    const tierData = SEASON_1_TIERS.find((t) => t.tier === tier);
    if (!tierData) return;

    if (seasonXp < tierData.requiredSeasonXp) {
      sound.playSound('wrong');
      sound.triggerHaptic('error');
      setIsError(true);
      const missing = tierData.requiredSeasonXp - seasonXp;
      setStatusMessage(`⚠️ Bu kademe kilitli! ${tierData.requiredSeasonXp} Sezon XP gerekli (Eksik: ${missing} XP).`);
      return;
    }

    if (track === 'premium' && !hasPremium) {
      sound.playSound('wrong');
      sound.triggerHaptic('error');
      setIsError(true);
      setStatusMessage('⚠️ Bu ödülü almak için Sezon 1 Premium Pass sahibi olmalısınız!');
      return;
    }

    const alreadyClaimed = track === 'premium' ? claimedPremium.includes(tier) : claimedFree.includes(tier);
    if (alreadyClaimed) {
      sound.playSound('wrong');
      setIsError(true);
      setStatusMessage('Bu kademe ödülü zaten alındı.');
      return;
    }

    const base = apiBaseUrl || DEFAULT_API_BASE;
    setLoadingTier(tier);

    try {
      sound.playSound('tap');
      const res = await fetch(`${base}/social/season/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, tier, track }),
      });
      const data = await res.json();
      if (!res.ok) {
        sound.playSound('wrong');
        sound.triggerHaptic('error');
        setIsError(true);
        setStatusMessage(data.error || 'Ödül alınırken hata oluştu.');
        return;
      }

      sound.playSound('reward');
      sound.triggerHaptic('success');
      setIsError(false);
      setClaimedRewardModal(data.reward || (track === 'premium' ? tierData.premiumReward : tierData.freeReward));

      if (data.user && onUpdateUser) {
        onUpdateUser(data.user);
      }
    } catch {
      sound.playSound('wrong');
      setIsError(true);
      setStatusMessage('Bağlantı hatası oluştu, lütfen tekrar deneyin.');
    } finally {
      setLoadingTier(null);
    }
  };

  const handleBuyPremiumPass = async () => {
    if (!user) return;
    setStatusMessage(null);
    setIsError(false);

    if ((user.gems || 0) < 250) {
      sound.playSound('wrong');
      sound.triggerHaptic('error');
      setIsError(true);
      setStatusMessage(`⚠️ Yetersiz Elmas! Premium Pass için 250 Elmas gereklidir (Mevcut: ${user.gems || 0} Elmas).`);
      return;
    }

    const base = apiBaseUrl || DEFAULT_API_BASE;
    setIsPurchasingPass(true);

    try {
      sound.playSound('tap');
      const res = await fetch(`${base}/social/season/premium-pass`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        sound.playSound('wrong');
        sound.triggerHaptic('error');
        setIsError(true);
        setStatusMessage(data.error || 'İşlem başarısız oldu.');
        return;
      }

      sound.playSound('reward');
      sound.triggerHaptic('success');
      setIsError(false);
      setStatusMessage('🎉 Sezon 1 Premium Pass başarıyla aktif edildi!');

      if (data.user && onUpdateUser) {
        onUpdateUser(data.user);
      }
    } catch {
      sound.playSound('wrong');
      setIsError(true);
      setStatusMessage('Bağlantı hatası oluştu.');
    } finally {
      setIsPurchasingPass(false);
    }
  };

  const renderRewardIcon = (type: string, size: number = 32) => {
    const img3d =
      type === 'chest' ? STORE_IMG.chestGold : type === 'key' ? STORE_IMG.key : type === 'booster' ? STORE_IMG.booster : null;
    if (img3d) {
      const s2 = Math.round(size * 1.45);
      return <Image source={img3d} style={{ width: s2, height: s2 }} resizeMode="contain" />;
    }
    switch (type) {
      case 'coin':
        return <CoinIcon size={size} />;
      case 'gem':
        return <GemIcon size={size} />;
      case 'key':
        return <KeyIcon size={size} />;
      case 'chest':
        return <ChestIcon size={size} />;
      case 'crown':
      case 'frame':
        return <CrownIcon size={size} />;
      case 'badge':
        return <BadgeShieldIcon size={size} />;
      case 'booster':
      case 'name_effect':
      case 'background':
        return <SpeedBoltIcon size={size} />;
      default:
        return <XpStarIcon size={size} />;
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
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sidePad}>
          <KitHero
            source={STORE_IMG.seasonHero}
            eyebrow="SEZON 1 · 45 GÜN KALDI"
            title="Bilgi Çağı"
            subtitle="50 kademelik Sezon Pass yolculuğu"
            height={164}
            delay={0}
          />
        </View>

        <Reanimated.View entering={FadeInDown.delay(90).duration(400)} style={styles.progressCard}>
          <View style={styles.tierPill}>
            <Text style={styles.tierPillLabel}>KADEME</Text>
            <Text style={styles.tierPillVal}>{currentTier}</Text>
          </View>
          <View style={styles.xpProgressWrap}>
            <View style={styles.xpTextRow}>
              <Text style={styles.xpLabelText}>Sezon ilerlemesi</Text>
              <Text style={styles.xpValText}>
                {seasonXp} / {currentTier < 50 ? currentTier * 400 : 20000} XP
              </Text>
            </View>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${progressPct}%` }]}>
                <GradientFill direction="horizontal" colors={['#5ADBB5', '#FFC837']} />
              </View>
            </View>
            <Text style={styles.xpHint}>
              {currentTier < 50 ? `Sonraki kademe için ${400 - xpInCurrentTier} XP` : 'Son kademeye ulaştın'}
            </Text>
          </View>
        </Reanimated.View>

        {/* Premium Pass Purchase Banner */}
        {!hasPremium ? (
          <Reanimated.View entering={FadeInDown.delay(160).duration(400)} style={styles.passPromoCard}>
            <View style={styles.passPromoLeft}>
              <FloatingImage source={STORE_IMG.trophy} size={56} />
              <View style={{ flex: 1 }}>
                <Text style={styles.passPromoTitle}>Premium Pass</Text>
                <Text style={styles.passPromoSub}>
                  50 kademede 15.000 Altın, 1.200 Elmas, Alev Çerçevesi ve Efsanevi Sandıklar!
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.passBuyBtn}
              onPress={handleBuyPremiumPass}
              activeOpacity={0.85}
              disabled={isPurchasingPass}
            >
              <GemIcon size={18} />
              <Text style={styles.passBuyBtnText}>
                {isPurchasingPass ? 'Açılıyor...' : '250'}
              </Text>
            </TouchableOpacity>
          </Reanimated.View>
        ) : (
          <View style={styles.passActiveBanner}>
            <CrownIcon size={22} />
            <Text style={styles.passActiveText}>Sezon 1 Premium Pass aktif</Text>
          </View>
        )}

        {/* Status Alert Banner */}
        {statusMessage && (
          <View style={[styles.statusBanner, isError && styles.statusBannerError]}>
            <Text style={styles.statusText}>{statusMessage}</Text>
          </View>
        )}

        {/* Track Column Headers */}
        <View style={styles.trackHeaderRow}>
          <View style={styles.trackHeaderLeft}>
            <Text style={styles.trackHeaderTitle}>Ücretsiz</Text>
          </View>
          <View style={styles.trackHeaderCenter}>
            <Text style={styles.trackHeaderCenterText}>Kademe</Text>
          </View>
          <View style={styles.trackHeaderRight}>
            <CrownIcon size={16} />
            <Text style={styles.trackHeaderPremiumTitle}>Premium</Text>
          </View>
        </View>

        {/* 50 Tiers List */}
        <View style={styles.tiersContainer}>
          <View style={styles.tierSpine} pointerEvents="none" />
          {SEASON_1_TIERS.map((tierItem, tierIdx) => {
            const isUnlocked = seasonXp >= tierItem.requiredSeasonXp;
            const isFreeClaimed = claimedFree.includes(tierItem.tier);
            const isPremiumClaimed = claimedPremium.includes(tierItem.tier);
            const isCurrent = tierItem.tier === currentTier;

            return (
              <Reanimated.View
                key={tierItem.tier}
                entering={tierIdx < 10 ? FadeInDown.delay(200 + tierIdx * 45).duration(360) : undefined}
                style={[
                  styles.tierRow,
                  isCurrent && styles.tierRowCurrent,
                ]}
              >
                {/* Free Reward Card (Left) */}
                <View
                  style={[
                    styles.rewardCard,
                    styles.freeRewardCard,
                    isFreeClaimed && styles.cardClaimed,
                    !isUnlocked && styles.cardLocked,
                  ]}
                >
                  <View style={[styles.rewardIconWrap, isCurrent && styles.rewardIconWrapCurrent]}>
                    {isCurrent ? (
                      <FloatingElement amplitude={3} duration={1300}>
                        {renderRewardIcon(tierItem.freeReward.type, 26)}
                      </FloatingElement>
                    ) : (
                      renderRewardIcon(tierItem.freeReward.type, 26)
                    )}
                  </View>
                  <Text style={styles.rewardAmount} numberOfLines={2}>
                    {tierItem.freeReward.title}
                  </Text>
                  {isFreeClaimed ? (
                    <View style={styles.claimedPill}>
                      <Text style={styles.claimedPillText}>Alındı</Text>
                    </View>
                  ) : isUnlocked ? (
                    <TouchableOpacity
                      style={styles.claimBtn}
                      onPress={() => handleClaimTier(tierItem.tier, 'free')}
                      activeOpacity={0.8}
                      disabled={loadingTier === tierItem.tier}
                    >
                      <Text style={styles.claimBtnText}>
                        {loadingTier === tierItem.tier ? '...' : 'Al'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.lockedPill}>
                      <Text style={styles.lockedPillText}>Kilitli</Text>
                    </View>
                  )}
                </View>

                {/* Center Tier Circle & Connector */}
                <View style={styles.centerTierBadgeWrap}>
                  <View
                    style={[
                      styles.tierNumberCircle,
                      isUnlocked && styles.tierCircleUnlocked,
                      isCurrent && styles.tierCircleCurrent,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tierNumberText,
                        isUnlocked && styles.tierNumberTextUnlocked,
                      ]}
                    >
                      {tierItem.tier}
                    </Text>
                  </View>
                  <Text style={styles.tierXpRequirementText}>
                    {tierItem.requiredSeasonXp} XP
                  </Text>
                </View>

                {/* Premium Reward Card (Right) */}
                <View
                  style={[
                    styles.rewardCard,
                    styles.premiumRewardCard,
                    isPremiumClaimed && styles.cardClaimed,
                    (!isUnlocked || !hasPremium) && styles.cardLocked,
                  ]}
                >
                  <View style={[styles.rewardIconWrap, isCurrent && styles.rewardIconWrapCurrent]}>
                    {isCurrent ? (
                      <FloatingElement amplitude={3} duration={1300}>
                        {renderRewardIcon(tierItem.premiumReward.type, 26)}
                      </FloatingElement>
                    ) : (
                      renderRewardIcon(tierItem.premiumReward.type, 26)
                    )}
                  </View>
                  <Text style={styles.premiumRewardAmount} numberOfLines={2}>
                    {tierItem.premiumReward.title}
                  </Text>
                  {isPremiumClaimed ? (
                    <View style={styles.claimedPill}>
                      <Text style={styles.claimedPillText}>Alındı</Text>
                    </View>
                  ) : isUnlocked && hasPremium ? (
                    <TouchableOpacity
                      style={[styles.claimBtn, styles.claimBtnGold]}
                      onPress={() => handleClaimTier(tierItem.tier, 'premium')}
                      activeOpacity={0.8}
                      disabled={loadingTier === tierItem.tier}
                    >
                      <Text style={styles.claimBtnTextGold}>
                        {loadingTier === tierItem.tier ? '...' : 'Al'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.lockedPillGold}>
                      {!hasPremium ? (
                        <CrownIcon size={14} />
                      ) : (
                        <Text style={styles.lockedPillText}>Kilitli</Text>
                      )}
                    </View>
                  )}
                </View>
              </Reanimated.View>
            );
          })}
        </View>
      </ScrollView>

      {/* Claimed Reward Success Modal */}
      {claimedRewardModal && (
        <Modal
          transparent
          animationType="fade"
          visible={!!claimedRewardModal}
          onRequestClose={() => setClaimedRewardModal(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Reanimated.View entering={ZoomIn.springify()} style={styles.modalRewardGlow}>
                {renderRewardIcon(claimedRewardModal.type, 64)}
              </Reanimated.View>
              <Text style={styles.modalTitle}>Ödül alındı</Text>
              <Text style={styles.modalRewardName}>
                {claimedRewardModal.title}
              </Text>
              <Text style={styles.modalSub}>
                Ödülünüz hesabınıza ve envanterinize başarıyla tanımlandı!
              </Text>
              <Button3D
                title="Harika"
                onPress={() => setClaimedRewardModal(null)}
                style={{ width: 180, marginTop: 16 }}
              />
            </View>
          </View>
        </Modal>
      )}
    </TavrikoScreen>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 48,
  },
  sidePad: {
    marginHorizontal: 14,
    marginTop: 4,
  },
  progressCard: {
    marginHorizontal: 14,
    marginTop: -4,
    marginBottom: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: KIT.card,
    borderWidth: 1,
    borderColor: KIT.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    overflow: 'hidden',
    minWidth: 6,
  },
  xpHint: {
    color: KIT.muted,
    fontSize: 11,
    fontFamily: THEME.fonts.medium,
    marginTop: 6,
  },
  tierSpine: {
    position: 'absolute',
    top: 10,
    bottom: 10,
    left: '50%',
    width: 2,
    marginLeft: -1,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  heroBanner: {
    marginHorizontal: 14,
    marginTop: 8,
    marginBottom: 12,
    padding: 16,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
  },
  seasonBadge: {
    backgroundColor: 'rgba(255, 196, 61, 0.22)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFC43D',
    marginBottom: 6,
  },
  seasonBadgeText: {
    color: '#FFC43D',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  heroTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 32,
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  heroSub: {
    color: '#D9CDF5',
    fontSize: 13,
    fontFamily: THEME.fonts.bold,
    marginBottom: 14,
  },
  tierStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 12,
  },
  tierPill: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: 'rgba(90, 219, 181, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(90, 219, 181, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierPillLabel: {
    color: '#6FE3C1',
    fontSize: 9,
    fontFamily: THEME.fonts.extraBold,
  },
  tierPillVal: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: THEME.fonts.black,
  },
  xpProgressWrap: {
    flex: 1,
  },
  xpTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  xpLabelText: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.bold,
  },
  xpValText: {
    color: '#6FE3C1',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  passPromoCard: {
    marginHorizontal: 14,
    marginBottom: 14,
    padding: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 200, 55, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 200, 55, 0.35)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  passPromoLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  crownCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFB21E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  passPromoTitle: {
    fontFamily: THEME.fonts.black,
    fontSize: 16,
    color: '#FFFFFF',
  },
  passPromoSub: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.bold,
    marginTop: 2,
  },
  passBuyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: KIT.gold,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  passBuyBtnText: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 14,
    color: '#2A1200',
  },
  passActiveBanner: {
    marginHorizontal: 14,
    marginBottom: 12,
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(124, 252, 138, 0.15)',
    borderWidth: 1,
    borderColor: '#7CFC8A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  passActiveText: {
    color: '#7CFC8A',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
  },
  statusBanner: {
    marginHorizontal: 14,
    marginBottom: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 196, 61, 0.2)',
    borderWidth: 1,
    borderColor: '#FFC43D',
  },
  statusBannerError: {
    backgroundColor: 'rgba(255, 90, 106, 0.2)',
    borderColor: '#FF5A6A',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
    textAlign: 'center',
  },
  trackHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginBottom: 8,
  },
  trackHeaderLeft: {
    flex: 1,
    alignItems: 'center',
  },
  trackHeaderTitle: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  trackHeaderCenter: {
    width: 64,
    alignItems: 'center',
  },
  trackHeaderCenterText: {
    color: '#6FE3C1',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  trackHeaderRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  trackHeaderPremiumTitle: {
    color: '#FFC43D',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  tiersContainer: {
    paddingHorizontal: 12,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
  },
  tierRowCurrent: {
    backgroundColor: 'rgba(107, 60, 255, 0.16)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  rewardCard: {
    flex: 1,
    height: 100,
    borderRadius: 16,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
  },
  freeRewardCard: {
    backgroundColor: KIT.card,
    borderColor: KIT.border,
  },
  premiumRewardCard: {
    backgroundColor: 'rgba(60, 30, 10, 0.45)',
    borderColor: 'rgba(255, 200, 55, 0.22)',
  },
  cardLocked: {
    opacity: 0.55,
  },
  cardClaimed: {
    borderColor: 'rgba(124, 252, 138, 0.4)',
    backgroundColor: 'rgba(124, 252, 138, 0.06)',
  },
  rewardIconWrap: {
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardIconWrapCurrent: {
    backgroundColor: 'rgba(255, 196, 61, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  rewardAmount: {
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 13,
    fontFamily: THEME.fonts.bold,
    textAlign: 'center',
  },
  premiumRewardAmount: {
    color: '#FFC43D',
    fontSize: 11,
    lineHeight: 13,
    fontFamily: THEME.fonts.bold,
    textAlign: 'center',
  },
  claimBtn: {
    backgroundColor: '#6FE3C1',
    paddingHorizontal: 14,
    paddingVertical: 3,
    borderRadius: 10,
  },
  claimBtnText: {
    color: '#0A3326',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  claimBtnGold: {
    backgroundColor: '#FFB21E',
  },
  claimBtnTextGold: {
    color: '#3B1500',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  claimedPill: {
    backgroundColor: 'rgba(124, 252, 138, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  claimedPillText: {
    color: '#7CFC8A',
    fontSize: 9,
    fontFamily: THEME.fonts.extraBold,
  },
  lockedPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  lockedPillGold: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  lockedPillText: {
    fontSize: 10,
    color: 'rgba(217, 205, 245, 0.6)',
    fontFamily: THEME.fonts.bold,
  },
  centerTierBadgeWrap: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierNumberCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2A1558',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierCircleUnlocked: {
    borderColor: '#5ADBB5',
    backgroundColor: '#163A3A',
  },
  tierCircleCurrent: {
    borderColor: '#FFC43D',
    borderWidth: 3,
    transform: [{ scale: 1.15 }],
  },
  tierNumberText: {
    fontFamily: THEME.fonts.black,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  tierNumberTextUnlocked: {
    color: '#FFFFFF',
  },
  tierXpRequirementText: {
    color: 'rgba(217, 205, 245, 0.7)',
    fontSize: 9,
    fontFamily: THEME.fonts.bold,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 4, 24, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#241050',
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#FFC43D',
    padding: 24,
    alignItems: 'center',
  },
  modalRewardGlow: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255, 196, 61, 0.2)',
    borderWidth: 2,
    borderColor: '#FFC43D',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 24,
    color: '#FFC43D',
    letterSpacing: 1,
  },
  modalRewardName: {
    fontFamily: THEME.fonts.display,
    fontSize: 18,
    color: '#FFFFFF',
    marginTop: 6,
    textAlign: 'center',
  },
  modalSub: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
  },
});
