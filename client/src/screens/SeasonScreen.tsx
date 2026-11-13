import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
import { authHeaders } from '../utils/apiAuth';
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
import { Check, LockKeyhole, Gift } from 'lucide-react-native';
import {
  KitHero,
  STORE_IMG,
  KIT,
  FloatingElement,
  FloatingImage,
  ShimmerView,
  UI_IMG,
  storeImageFor,
  FramedAvatar,
  AnimatedFrame,
  AnimatedBackgroundThumb,
  AnimatedNameText,
  BackgroundThumb,
  backgroundFor,
  frameFor,
} from '../components/StoreKit';
import { GradientFill } from '../components/TavrikoGradient';

interface SeasonScreenProps {
  user?: UserProfile;
  apiBaseUrl?: string;
  onUpdateUser?: (updatedUser: UserProfile) => void;
  onBack: () => void;
  onProfile?: () => void;
  /** Sunucudaki güncel profili çeker (sayfa yenilendiğinde alınan ödüllerin doğru görünmesi için). */
  onRefreshUser?: () => void;
}

type TrackKind = 'free' | 'premium';

const RARITY_COLOR: Record<string, string> = {
  common: '#94A3B8',
  rare: '#38BDF8',
  epic: '#A855F7',
  legendary: '#FFC837',
};

const TIER_XP = 400;

export const SeasonScreen: React.FC<SeasonScreenProps> = ({
  user,
  apiBaseUrl,
  onUpdateUser,
  onBack,
  onProfile,
  onRefreshUser,
}) => {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState<boolean>(false);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [claimingAll, setClaimingAll] = useState(false);
  const [claimedRewardModal, setClaimedRewardModal] = useState<SeasonReward | null>(null);
  const [isPurchasingPass, setIsPurchasingPass] = useState(false);
  const [onlyClaimable, setOnlyClaimable] = useState(false);

  const scrollRef = useRef<any>(null);
  // Çift dokunuşa karşı: sunucuya giden istek bitmeden yeni talep başlatılmaz.
  const inFlightRef = useRef(false);
  const tiersTopRef = useRef(0);
  const rowYRef = useRef<Record<number, number>>({});

  const seasonXp = user?.seasonXp || 0;
  const hasPremium = !!user?.hasPremiumPass;
  const claimedFree = user?.claimedSeasonFreeTiers || user?.claimedSeasonTiers || [1];
  const claimedPremium = user?.claimedSeasonPremiumTiers || [];

  const currentTier = Math.min(50, Math.max(1, Math.floor(seasonXp / TIER_XP) + 1));
  const currentTierBaseXp = (currentTier - 1) * TIER_XP;
  const xpInCurrentTier = Math.max(0, seasonXp - currentTierBaseXp);
  const progressPct = currentTier >= 50 && seasonXp >= 50 * TIER_XP
    ? 100
    : Math.min(100, Math.max(0, Math.round((xpInCurrentTier / TIER_XP) * 100)));

  // Alınabilir (kilidi açık, henüz alınmamış) ödüller
  const claimables = useMemo(() => {
    const list: Array<{ tier: number; track: TrackKind }> = [];
    for (const t of SEASON_1_TIERS) {
      if (seasonXp < t.requiredSeasonXp) continue;
      if (!claimedFree.includes(t.tier)) list.push({ tier: t.tier, track: 'free' });
      if (hasPremium && !claimedPremium.includes(t.tier)) list.push({ tier: t.tier, track: 'premium' });
    }
    return list;
  }, [seasonXp, hasPremium, claimedFree, claimedPremium]);

  const claimedCount = useMemo(
    () => SEASON_1_TIERS.filter((t) => claimedFree.includes(t.tier)).length + SEASON_1_TIERS.filter((t) => claimedPremium.includes(t.tier)).length,
    [claimedFree, claimedPremium],
  );

  // Ekran açıldığında sunucudaki güncel durumu al (yenilemeden sonra alınan ödüller kilitli kalır)
  useEffect(() => {
    onRefreshUser?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Kullanıcının aktif kademesine kaydır
  useEffect(() => {
    const timer = setTimeout(() => {
      const y = rowYRef.current[currentTier];
      if (scrollRef.current && y !== undefined && currentTier > 2) {
        scrollRef.current.scrollTo({ y: Math.max(0, tiersTopRef.current + y - 90), animated: true });
      }
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const failWith = (message: string) => {
    sound.playSound('wrong');
    sound.triggerHaptic('error');
    setIsError(true);
    setStatusMessage(message);
  };

  /** Tek bir ödülü sunucudan talep eder; başarıyla alınan ödül döner, aksi halde null. */
  const requestClaim = useCallback(async (tier: number, track: TrackKind): Promise<{ reward: SeasonReward; user?: UserProfile } | { error: string }> => {
    if (!user) return { error: 'Oturum bulunamadı.' };
    const base = apiBaseUrl || DEFAULT_API_BASE;
    try {
      const res = await fetch(`${base}/social/season/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ userId: user.id, tier, track }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Sunucu "zaten alındı" derse yerel durumu da sunucuyla eşitle
        onRefreshUser?.();
        return { error: data.error || 'Ödül alınırken hata oluştu.' };
      }
      const tierData = SEASON_1_TIERS.find((t) => t.tier === tier);
      const reward = data.reward || (track === 'premium' ? tierData?.premiumReward : tierData?.freeReward);
      if (data.user && onUpdateUser) onUpdateUser(data.user);
      return { reward, user: data.user };
    } catch {
      return { error: 'Bağlantı hatası oluştu, lütfen tekrar deneyin.' };
    }
  }, [user, apiBaseUrl, onUpdateUser, onRefreshUser]);

  const handleClaimTier = async (tier: number, track: TrackKind) => {
    if (!user || inFlightRef.current) return;
    setStatusMessage(null);
    setIsError(false);

    const tierData = SEASON_1_TIERS.find((t) => t.tier === tier);
    if (!tierData) return;

    if (seasonXp < tierData.requiredSeasonXp) {
      failWith(`Bu kademe kilitli. ${tierData.requiredSeasonXp} Sezon XP gerekli (eksik: ${tierData.requiredSeasonXp - seasonXp} XP).`);
      return;
    }
    if (track === 'premium' && !hasPremium) {
      failWith('Bu ödülü almak için Sezon 1 Premium Pass sahibi olmalısınız.');
      return;
    }
    const alreadyClaimed = track === 'premium' ? claimedPremium.includes(tier) : claimedFree.includes(tier);
    if (alreadyClaimed) {
      failWith('Bu kademe ödülü zaten alındı.');
      return;
    }

    inFlightRef.current = true;
    setLoadingKey(`${track}-${tier}`);
    try {
      sound.playSound('tap');
      const result = await requestClaim(tier, track);
      if ('error' in result) {
        failWith(result.error);
        return;
      }
      sound.playSound('reward');
      sound.triggerHaptic('success');
      setIsError(false);
      setClaimedRewardModal(result.reward);
    } finally {
      inFlightRef.current = false;
      setLoadingKey(null);
    }
  };

  const handleClaimAll = async () => {
    if (!user || inFlightRef.current || claimables.length === 0) return;
    inFlightRef.current = true;
    setClaimingAll(true);
    setStatusMessage(null);
    setIsError(false);
    let ok = 0;
    let lastError: string | null = null;
    try {
      sound.playSound('tap');
      for (const item of claimables) {
        const result = await requestClaim(item.tier, item.track);
        if ('error' in result) {
          lastError = result.error;
          break;
        }
        ok += 1;
      }
      if (ok > 0) {
        sound.playSound('reward');
        sound.triggerHaptic('success');
        setIsError(false);
        setStatusMessage(`${ok} ödül hesabınıza tanımlandı.`);
      }
      if (lastError) failWith(ok > 0 ? `${ok} ödül alındı, ancak işlem durdu: ${lastError}` : lastError);
    } finally {
      inFlightRef.current = false;
      setClaimingAll(false);
    }
  };

  const handleBuyPremiumPass = async () => {
    if (!user || inFlightRef.current) return;
    setStatusMessage(null);
    setIsError(false);

    if ((user.gems || 0) < 250) {
      failWith(`Yetersiz elmas. Premium Pass için 250 elmas gerekir (mevcut: ${user.gems || 0}).`);
      return;
    }

    const base = apiBaseUrl || DEFAULT_API_BASE;
    inFlightRef.current = true;
    setIsPurchasingPass(true);
    try {
      sound.playSound('tap');
      const res = await fetch(`${base}/social/season/premium-pass`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        failWith(data.error || 'İşlem başarısız oldu.');
        return;
      }
      sound.playSound('reward');
      sound.triggerHaptic('success');
      setIsError(false);
      setStatusMessage('Sezon 1 Premium Pass etkinleştirildi.');
      if (data.user && onUpdateUser) onUpdateUser(data.user);
    } catch {
      failWith('Bağlantı hatası oluştu.');
    } finally {
      inFlightRef.current = false;
      setIsPurchasingPass(false);
    }
  };

  const renderRewardIcon = (reward: SeasonReward, size: number = 32) => {
    const { type } = reward;
    const seed = user?.avatarUrl || user?.displayName || 'av1';
    const displayName = user?.displayName || 'Oyuncu';
    let img: any = null;
    if (type === 'coin') img = storeImageFor(`coins_${reward.amount}`);
    else if (type === 'gem') img = storeImageFor(`gems_${reward.amount}`);
    else if (type === 'chest' || type === 'key' || type === 'booster' || type === 'badge') {
      img = storeImageFor(reward.itemId || type, type);
    }
    if (img) {
      const s2 = Math.round(size * (type === 'badge' ? 1.5 : 1.35));
      return <Image source={img} style={{ width: s2, height: s2 }} resizeMode="contain" />;
    }
    switch (type) {
      /* Sezon kartlarında kozmetikler artık kendi gerçek görsellerini
         kullanıyor: çerçeveler için avatar + çerçeve, isim efektleri için
         animasyonlu yazı, arka planlar için animasyonlu önizleme. */
      case 'frame': {
        const rid = reward.itemId || 'frame_neon';
        if (frameFor(rid)) {
          return <FramedAvatar frameId={rid} seed={seed} size={Math.round(size * 1.6)} />;
        }
        return <AnimatedFrame frameId={rid} seed={seed} size={Math.round(size * 1.6)} />;
      }
      case 'badge':
        return <BadgeShieldIcon size={size} />;
      case 'name_effect': {
        const rid = reward.itemId || 'name_glow_gold';
        return (
          <View style={{ width: Math.round(size * 1.6), alignItems: 'center' }}>
            <AnimatedNameText
              effectId={rid}
              numberOfLines={1}
              style={{ fontSize: Math.round(size * 0.55), fontWeight: '800' }}
            >
              Örnek
            </AnimatedNameText>
          </View>
        );
      }
      case 'background': {
        const rid = reward.itemId || 'bg_nebula';
        if (backgroundFor(rid)) {
          return <BackgroundThumb bgId={rid} seed={seed} name={displayName} width={Math.round(size * 1.4)} />;
        }
        return (
          <AnimatedBackgroundThumb bgId={rid} seed={seed} name={displayName} width={Math.round(size * 1.4)} />
        );
      }
      default:
        return <XpStarIcon size={size} />;
    }
  };

  const renderRewardCard = (
    tierItem: { tier: number; requiredSeasonXp: number },
    reward: SeasonReward,
    track: TrackKind,
    isCurrent: boolean,
  ) => {
    const isPremiumTrack = track === 'premium';
    const unlocked = seasonXp >= tierItem.requiredSeasonXp;
    const claimed = (isPremiumTrack ? claimedPremium : claimedFree).includes(tierItem.tier);
    const passLocked = isPremiumTrack && !hasPremium;
    const canClaim = unlocked && !claimed && !passLocked;
    const accent = RARITY_COLOR[reward.rarity || 'common'] || RARITY_COLOR.common;
    const busy = loadingKey === `${track}-${tierItem.tier}`;
    const big = reward.rarity === 'legendary' || tierItem.tier === 50;

    return (
      <View
        style={[
          styles.rewardCard,
          isPremiumTrack ? styles.premiumRewardCard : styles.freeRewardCard,
          unlocked && !claimed && { borderColor: `${accent}66` },
          canClaim && styles.cardClaimable,
          claimed && styles.cardClaimed,
          !unlocked && styles.cardLocked,
        ]}
      >
        <View style={[styles.rarityBar, { backgroundColor: accent, opacity: unlocked ? 0.9 : 0.35 }]} />
        <View style={[styles.rewardIconWrap, big && styles.rewardIconWrapBig, canClaim && { backgroundColor: `${accent}22` }]}>
          {canClaim && <ShimmerView color="#FFE9A8" duration={2400} />}
          <View style={claimed || !unlocked ? styles.iconDim : undefined}>
            {canClaim && isCurrent ? (
              <FloatingElement amplitude={3} duration={1300}>
                {renderRewardIcon(reward, big ? 34 : 28)}
              </FloatingElement>
            ) : (
              renderRewardIcon(reward, big ? 34 : 28)
            )}
          </View>
          {claimed && (
            <View style={styles.claimedTick}>
              <Check size={11} color="#06281B" strokeWidth={4} />
            </View>
          )}
          {!claimed && (!unlocked || passLocked) && (
            <View style={styles.lockTick}>
              <LockKeyhole size={11} color="#E9DDFF" />
            </View>
          )}
        </View>
        <Text style={isPremiumTrack ? styles.premiumRewardAmount : styles.rewardAmount} numberOfLines={2}>
          {reward.title}
        </Text>
        {claimed ? (
          <View style={styles.claimedPill}>
            <Text style={styles.claimedPillText}>Alındı</Text>
          </View>
        ) : canClaim ? (
          <TouchableOpacity
            style={[styles.claimBtn, isPremiumTrack && styles.claimBtnGold]}
            onPress={() => handleClaimTier(tierItem.tier, track)}
            activeOpacity={0.8}
            disabled={busy || claimingAll || isPurchasingPass}
          >
            <Text style={isPremiumTrack ? styles.claimBtnTextGold : styles.claimBtnText}>{busy ? '...' : 'AL'}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.lockedPill}>
            <Text style={styles.lockedPillText}>{passLocked ? 'Premium' : 'Kilitli'}</Text>
          </View>
        )}
      </View>
    );
  };

  const visibleTiers = onlyClaimable
    ? SEASON_1_TIERS.filter((t) => {
        const unlocked = seasonXp >= t.requiredSeasonXp;
        return unlocked && (!claimedFree.includes(t.tier) || (hasPremium && !claimedPremium.includes(t.tier)));
      })
    : SEASON_1_TIERS;

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

        {/* İlerleme kartı */}
        <Reanimated.View entering={FadeInDown.delay(90).duration(400)} style={styles.progressCard}>
          <GradientFill direction="diagonal" colors={['rgba(107,60,255,0.38)', 'rgba(20,8,52,0.9)']} />
          <View style={styles.progressTop}>
            <View style={styles.tierEmblemWrap}>
              <FloatingImage source={UI_IMG.seasonEmblem} size={56} />
              <View style={styles.tierNumBadge}>
                <Text style={styles.tierNumText}>{currentTier}</Text>
              </View>
            </View>
            <View style={styles.xpProgressWrap}>
              <View style={styles.xpTextRow}>
                <Text style={styles.xpLabelText}>KADEME {currentTier}</Text>
                <Text style={styles.xpValText}>
                  {seasonXp} / {Math.min(50, currentTier) * TIER_XP} XP
                </Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${Math.max(progressPct, 6)}%` }]}>
                  <GradientFill direction="horizontal" colors={['#5ADBB5', '#FFC837']} />
                  <ShimmerView color="#FFF3C4" duration={1800} />
                </View>
              </View>
              <Text style={styles.xpHint}>
                {currentTier < 50 || seasonXp < 50 * TIER_XP
                  ? `Sonraki kademe için ${Math.min(50, currentTier) * TIER_XP - seasonXp} XP kaldı`
                  : 'Son kademeye ulaştın'}
              </Text>
            </View>
          </View>
          <View style={styles.statRow}>
            <View style={styles.statCell}>
              <Text style={styles.statVal}>{currentTier}/50</Text>
              <Text style={styles.statLbl}>Kademe</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={[styles.statVal, claimables.length > 0 && { color: '#6FE3C1' }]}>{claimables.length}</Text>
              <Text style={styles.statLbl}>Alınabilir</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statVal}>{claimedCount}</Text>
              <Text style={styles.statLbl}>Alınan</Text>
            </View>
          </View>
          {claimables.length > 0 && (
            <TouchableOpacity
              style={styles.claimAllBtn}
              activeOpacity={0.85}
              onPress={handleClaimAll}
              disabled={claimingAll || isPurchasingPass || loadingKey !== null}
            >
              <Gift size={16} color="#0A3326" />
              <Text style={styles.claimAllText}>
                {claimingAll ? 'Alınıyor...' : `Tümünü al (${claimables.length})`}
              </Text>
            </TouchableOpacity>
          )}
        </Reanimated.View>

        {/* Premium Pass */}
        {!hasPremium ? (
          <Reanimated.View entering={FadeInDown.delay(160).duration(400)} style={styles.passPromoCard}>
            <GradientFill direction="diagonal" colors={['rgba(255,200,55,0.20)', 'rgba(168,85,247,0.14)']} />
            <View style={styles.passPromoLeft}>
              <FloatingImage source={STORE_IMG.trophy} size={56} />
              <View style={{ flex: 1 }}>
                <Text style={styles.passPromoTitle}>Premium Pass</Text>
                <Text style={styles.passPromoSub}>
                  50 kademede 15.000 Altın, 1.200 Elmas, Alev Çerçevesi ve Efsanevi Sandıklar.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.passBuyBtn}
              onPress={handleBuyPremiumPass}
              activeOpacity={0.85}
              disabled={isPurchasingPass || claimingAll}
            >
              <GemIcon size={18} />
              <Text style={styles.passBuyBtnText}>{isPurchasingPass ? 'Açılıyor...' : '250'}</Text>
            </TouchableOpacity>
          </Reanimated.View>
        ) : (
          <View style={styles.passActiveBanner}>
            <CrownIcon size={20} />
            <Text style={styles.passActiveText}>Sezon 1 Premium Pass aktif</Text>
          </View>
        )}

        {statusMessage && (
          <View style={[styles.statusBanner, isError && styles.statusBannerError]}>
            <Text style={styles.statusText}>{statusMessage}</Text>
          </View>
        )}

        {/* Filtre */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, !onlyClaimable && styles.filterChipActive]}
            onPress={() => setOnlyClaimable(false)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterText, !onlyClaimable && styles.filterTextActive]}>Tüm kademeler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, onlyClaimable && styles.filterChipActive]}
            onPress={() => setOnlyClaimable(true)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterText, onlyClaimable && styles.filterTextActive]}>
              Alınabilir ({claimables.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Kolon başlıkları */}
        <View style={styles.trackHeaderRow}>
          <View style={styles.trackHeaderLeft}>
            <Text style={styles.trackHeaderTitle}>ÜCRETSİZ</Text>
          </View>
          <View style={styles.trackHeaderCenter} />
          <View style={styles.trackHeaderRight}>
            <CrownIcon size={14} />
            <Text style={styles.trackHeaderPremiumTitle}>PREMIUM</Text>
          </View>
        </View>

        {/* Kademeler */}
        <View
          style={styles.tiersContainer}
          onLayout={(e) => { tiersTopRef.current = e.nativeEvent.layout.y; }}
        >
          {!onlyClaimable && <View style={styles.tierSpine} pointerEvents="none" />}
          {visibleTiers.length === 0 && (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Şu anda alınabilecek ödül yok. Maç oynayarak Sezon XP kazan.</Text>
            </View>
          )}
          {visibleTiers.map((tierItem, tierIdx) => {
            const isUnlocked = seasonXp >= tierItem.requiredSeasonXp;
            const isCurrent = tierItem.tier === currentTier;
            const bothClaimed = claimedFree.includes(tierItem.tier) && (!hasPremium || claimedPremium.includes(tierItem.tier));

            return (
              <Reanimated.View
                key={tierItem.tier}
                onLayout={(e) => { rowYRef.current[tierItem.tier] = e.nativeEvent.layout.y; }}
                entering={tierIdx < 8 ? FadeInDown.delay(200 + tierIdx * 45).duration(360) : undefined}
                style={[styles.tierRow, isCurrent && styles.tierRowCurrent]}
              >
                {renderRewardCard(tierItem, tierItem.freeReward, 'free', isCurrent)}

                <View style={styles.centerTierBadgeWrap}>
                  <View
                    style={[
                      styles.tierNumberCircle,
                      isUnlocked && styles.tierCircleUnlocked,
                      bothClaimed && styles.tierCircleDone,
                      isCurrent && styles.tierCircleCurrent,
                    ]}
                  >
                    <Text style={[styles.tierNumberText, isUnlocked && styles.tierNumberTextUnlocked]}>
                      {tierItem.tier}
                    </Text>
                  </View>
                  {isCurrent ? (
                    <Text style={styles.currentTag}>SEN</Text>
                  ) : (
                    <Text style={styles.tierXpRequirementText}>{tierItem.requiredSeasonXp} XP</Text>
                  )}
                </View>

                {renderRewardCard(tierItem, tierItem.premiumReward, 'premium', isCurrent)}
              </Reanimated.View>
            );
          })}
        </View>
      </ScrollView>

      {/* Ödül modalı */}
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
                {renderRewardIcon(claimedRewardModal, 56)}
              </Reanimated.View>
              <Text style={styles.modalTitle}>Ödül alındı</Text>
              <Text style={styles.modalRewardName}>{claimedRewardModal.title}</Text>
              <Text style={styles.modalSub}>Ödülünüz hesabınıza ve envanterinize tanımlandı.</Text>
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
  scrollContent: { paddingBottom: 56 },
  sidePad: { marginHorizontal: 14, marginTop: 4 },
  progressCard: {
    marginHorizontal: 14,
    marginTop: -4,
    marginBottom: 12,
    padding: 14,
    borderRadius: 22,
    backgroundColor: KIT.card,
    borderWidth: 1,
    borderColor: 'rgba(168, 140, 255, 0.35)',
    overflow: 'hidden',
    gap: 12,
  },
  progressTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tierEmblemWrap: { width: 64, alignItems: 'center', justifyContent: 'center' },
  tierNumBadge: {
    position: 'absolute',
    bottom: -2,
    right: 0,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 5,
    backgroundColor: '#FFC43D',
    borderWidth: 2,
    borderColor: '#1A0E3C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierNumText: { color: '#1A0E3C', fontSize: 12, fontFamily: THEME.fonts.black },
  xpProgressWrap: { flex: 1 },
  xpTextRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  xpLabelText: { color: '#FFFFFF', fontSize: 12, fontFamily: THEME.fonts.black, letterSpacing: 0.8 },
  xpValText: { color: '#6FE3C1', fontSize: 11, fontFamily: THEME.fonts.extraBold },
  barTrack: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 6, overflow: 'hidden', minWidth: 8 },
  xpHint: { color: KIT.muted, fontSize: 11, fontFamily: THEME.fonts.medium, marginTop: 6 },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(8, 3, 24, 0.45)',
    borderRadius: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statCell: { flex: 1, alignItems: 'center' },
  statVal: { color: '#FFFFFF', fontSize: 16, fontFamily: THEME.fonts.black },
  statLbl: { color: KIT.muted, fontSize: 10, fontFamily: THEME.fonts.bold, marginTop: 1 },
  statDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.1)' },
  claimAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#6FE3C1',
    borderRadius: 14,
    paddingVertical: 11,
  },
  claimAllText: { color: '#0A3326', fontSize: 14, fontFamily: THEME.fonts.black },
  passPromoCard: {
    marginHorizontal: 14,
    marginBottom: 14,
    padding: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(20, 8, 52, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 200, 55, 0.45)',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  passPromoLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  passPromoTitle: { fontFamily: THEME.fonts.black, fontSize: 16, color: '#FFFFFF' },
  passPromoSub: { color: '#D9CDF5', fontSize: 11, fontFamily: THEME.fonts.bold, marginTop: 2 },
  passBuyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: KIT.gold,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  passBuyBtnText: { fontFamily: THEME.fonts.extraBold, fontSize: 14, color: '#2A1200' },
  passActiveBanner: {
    marginHorizontal: 14,
    marginBottom: 12,
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(124, 252, 138, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(124, 252, 138, 0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  passActiveText: { color: '#7CFC8A', fontSize: 13, fontFamily: THEME.fonts.extraBold },
  statusBanner: {
    marginHorizontal: 14,
    marginBottom: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 196, 61, 0.2)',
    borderWidth: 1,
    borderColor: '#FFC43D',
  },
  statusBannerError: { backgroundColor: 'rgba(255, 90, 106, 0.2)', borderColor: '#FF5A6A' },
  statusText: { color: '#FFFFFF', fontSize: 12, fontFamily: THEME.fonts.bold, textAlign: 'center' },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, marginBottom: 10 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  filterChipActive: { backgroundColor: 'rgba(107, 60, 255, 0.45)', borderColor: 'rgba(168,140,255,0.8)' },
  filterText: { color: KIT.muted, fontSize: 12, fontFamily: THEME.fonts.bold },
  filterTextActive: { color: '#FFFFFF' },
  trackHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginBottom: 6,
  },
  trackHeaderLeft: { flex: 1, alignItems: 'center' },
  trackHeaderTitle: { color: '#D9CDF5', fontSize: 11, fontFamily: THEME.fonts.extraBold, letterSpacing: 1.2 },
  trackHeaderCenter: { width: 64 },
  trackHeaderRight: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  trackHeaderPremiumTitle: { color: '#FFC43D', fontSize: 11, fontFamily: THEME.fonts.extraBold, letterSpacing: 1.2 },
  tiersContainer: { paddingHorizontal: 12 },
  tierSpine: {
    position: 'absolute',
    top: 10,
    bottom: 10,
    left: '50%',
    width: 3,
    marginLeft: -1.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  emptyBox: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  emptyText: { color: KIT.muted, fontSize: 12, fontFamily: THEME.fonts.bold, textAlign: 'center' },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tierRowCurrent: {
    backgroundColor: 'rgba(107, 60, 255, 0.2)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255, 196, 61, 0.55)',
    paddingVertical: 8,
  },
  rewardCard: {
    flex: 1,
    minHeight: 118,
    borderRadius: 18,
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    overflow: 'hidden',
  },
  rarityBar: { position: 'absolute', top: 0, left: 14, right: 14, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  freeRewardCard: { backgroundColor: 'rgba(255, 255, 255, 0.06)', borderColor: KIT.border },
  premiumRewardCard: { backgroundColor: 'rgba(70, 36, 8, 0.5)', borderColor: 'rgba(255, 200, 55, 0.25)' },
  cardLocked: { opacity: 0.6 },
  cardClaimable: {
    borderColor: '#6FE3C1',
    borderWidth: 1.5,
    backgroundColor: 'rgba(111, 227, 193, 0.1)',
    shadowColor: '#6FE3C1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 4,
  },
  cardClaimed: {
    borderColor: 'rgba(124, 252, 138, 0.35)',
    backgroundColor: 'rgba(124, 252, 138, 0.05)',
  },
  iconDim: { opacity: 0.55 },
  rewardIconWrap: {
    width: 56,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rewardIconWrapBig: { width: 66, height: 58 },
  claimedTick: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#7CFC8A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockTick: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(20, 8, 52, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardAmount: { color: '#FFFFFF', fontSize: 11, lineHeight: 13, fontFamily: THEME.fonts.bold, textAlign: 'center', marginTop: 4 },
  premiumRewardAmount: { color: '#FFD879', fontSize: 11, lineHeight: 13, fontFamily: THEME.fonts.bold, textAlign: 'center', marginTop: 4 },
  claimBtn: {
    backgroundColor: '#6FE3C1',
    paddingHorizontal: 18,
    paddingVertical: 4,
    borderRadius: 11,
    marginTop: 4,
  },
  claimBtnText: { color: '#0A3326', fontSize: 11, fontFamily: THEME.fonts.black, letterSpacing: 0.6 },
  claimBtnGold: { backgroundColor: '#FFB21E' },
  claimBtnTextGold: { color: '#3B1500', fontSize: 11, fontFamily: THEME.fonts.black, letterSpacing: 0.6 },
  claimedPill: {
    backgroundColor: 'rgba(124, 252, 138, 0.18)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 9,
    marginTop: 4,
  },
  claimedPillText: { color: '#7CFC8A', fontSize: 10, fontFamily: THEME.fonts.extraBold },
  lockedPill: { paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  lockedPillText: { fontSize: 10, color: 'rgba(217, 205, 245, 0.65)', fontFamily: THEME.fonts.bold },
  centerTierBadgeWrap: { width: 64, alignItems: 'center', justifyContent: 'center' },
  tierNumberCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#2A1558',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierCircleUnlocked: { borderColor: '#5ADBB5', backgroundColor: '#163A3A' },
  tierCircleDone: { borderColor: '#7CFC8A', backgroundColor: '#1B4A2C' },
  tierCircleCurrent: {
    borderColor: '#FFC43D',
    borderWidth: 3,
    backgroundColor: '#4A2A8C',
    transform: [{ scale: 1.15 }],
    shadowColor: '#FFC43D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 4,
  },
  tierNumberText: { fontFamily: THEME.fonts.black, fontSize: 14, color: 'rgba(255, 255, 255, 0.6)' },
  tierNumberTextUnlocked: { color: '#FFFFFF' },
  tierXpRequirementText: { color: 'rgba(217, 205, 245, 0.7)', fontSize: 9, fontFamily: THEME.fonts.bold, marginTop: 3 },
  currentTag: { color: '#FFC43D', fontSize: 9, fontFamily: THEME.fonts.black, letterSpacing: 1, marginTop: 4 },
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
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(255, 196, 61, 0.2)',
    borderWidth: 2,
    borderColor: '#FFC43D',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modalTitle: { fontFamily: THEME.fonts.display, fontSize: 24, color: '#FFC43D', letterSpacing: 1 },
  modalRewardName: { fontFamily: THEME.fonts.display, fontSize: 18, color: '#FFFFFF', marginTop: 6, textAlign: 'center' },
  modalSub: { color: '#D9CDF5', fontSize: 12, fontFamily: THEME.fonts.bold, textAlign: 'center', marginTop: 8, lineHeight: 16 },
});
