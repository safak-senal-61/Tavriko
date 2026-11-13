import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { UserProfile, InventoryItem, ItemCategory, COSMETIC_RENTAL_MS, getCosmeticDef } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { DEFAULT_API_BASE } from '../config';
import { authHeaders } from '../utils/apiAuth';
import {
  TavrikoScreen,
  TavrikoTopBar,
  TavrikoSecondaryBottomNav,
  SecondaryNavTab,
  ChestIcon,
  KeyIcon,
  GemIcon,
  CoinIcon,
  SpeedBoltIcon,
  StreakFlameIcon,
  HeartIcon,
  CrownIcon,
} from '../components/TavrikoIcons';
import Reanimated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Image } from 'react-native';
import {
  KitHeader,
  KitChips,
  KitEmpty,
  STORE_IMG,
  storeImageFor,
  KIT,
  FramedAvatar,
  BackgroundThumb,
  CosmeticPreviewModal,
  frameFor,
  backgroundFor,
  BadgeVisual,
} from '../components/StoreKit';

interface InventoryScreenProps {
  user?: UserProfile;
  apiBaseUrl?: string;
  onUpdateUser?: (updatedUser: UserProfile) => void;
  onBack?: () => void;
  onNavigateSecondary?: (tab: SecondaryNavTab) => void;
  onNotifications?: () => void;
  onProfile?: () => void;
}

type InvTabType = 'all' | 'chests' | 'keys' | 'boosters' | 'cosmetics' | 'badges' | 'avatars';

interface TabItem {
  id: InvTabType;
  label: string;
  icon: string;
}

const INV_TABS: TabItem[] = [
  { id: 'all', label: 'Tümü', icon: '🎒' },
  { id: 'chests', label: 'Sandıklar', icon: '📦' },
  { id: 'keys', label: 'Anahtarlar', icon: '🗝️' },
  { id: 'boosters', label: 'Güçlendirici', icon: '⚡' },
  { id: 'cosmetics', label: 'Kozmetikler', icon: '✨' },
  { id: 'badges', label: 'Rozetler', icon: '🎖️' },
  { id: 'avatars', label: 'Avatarlar', icon: '🎭' },
];

const RARITY_COLORS: Record<string, string> = {
  common: '#A0A0A0',
  rare: '#3B82F6',
  epic: '#A855F7',
  legendary: '#F59E0B',
  mythic: '#EF4444',
};

/** Aktif etki satırı: görsel + isim + kalan süre barı. Bar her saniye azalır,
 *  bittiğinde satır otomatik kaybolur (kozmetik/iksir eski haline döner). */
const ActiveEffectRow: React.FC<{
  visual: React.ReactNode;
  label: string;
  expiresAt: number;
  accent: string;
}> = ({ visual, label, expiresAt, accent }) => {
  const [left, setLeft] = useState(() => Math.max(0, expiresAt - Date.now()));
  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, expiresAt - Date.now())), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  if (left <= 0) return null;
  // Toplam süre tahmini: kalan 1 saati aşarsa 24 saatlik iksirdir (yoksa 1 saat)
  const total = left > COSMETIC_RENTAL_MS * 1.2 ? 24 * 60 * 60 * 1000 : COSMETIC_RENTAL_MS;
  const pct = Math.max(0, Math.min(100, (left / total) * 100));
  const totalSec = Math.floor(left / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const timeText = h > 0 ? `${h}s ${String(m).padStart(2, '0')}dk` : `${m}dk ${String(s).padStart(2, '0')}sn`;
  return (
    <View style={activeFxStyles.row}>
      <View style={activeFxStyles.iconWrap}>{visual}</View>
      <View style={activeFxStyles.info}>
        <Text style={activeFxStyles.label} numberOfLines={1}>{label}</Text>
        <View style={activeFxStyles.barTrack}>
          <Animated.View
            style={[activeFxStyles.barFill, { backgroundColor: accent, width: `${pct}%` }]}
          />
        </View>
        <Text style={activeFxStyles.timeText}>⏳ {timeText} kaldı</Text>
      </View>
    </View>
  );
};

const activeFxStyles = StyleSheet.create({
  card: {
    marginTop: 12,
    backgroundColor: 'rgba(52, 34, 78, 0.55)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(197, 165, 245, 0.28)',
    padding: 12,
  },
  cardTitle: {
    color: '#E9DDFB',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
    marginBottom: 8,
    letterSpacing: 0.4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  iconWrap: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  info: { flex: 1 },
  label: { color: '#F3EDFF', fontSize: 12, fontFamily: THEME.fonts.bold, marginBottom: 4 },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  barFill: { height: 6, borderRadius: 3 },
  timeText: { color: '#CBB8E8', fontSize: 10, fontFamily: THEME.fonts.medium, marginTop: 3 },
});

export const InventoryScreen: React.FC<InventoryScreenProps> = ({
  user,
  apiBaseUrl,
  onUpdateUser,
  onBack,
  onNavigateSecondary,
  onNotifications,
  onProfile,
}) => {
  const [activeTab, setActiveTab] = useState<InvTabType>('all');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState<boolean>(false);
  const [selectedChest, setSelectedChest] = useState<InventoryItem | null>(null);
  const [isOpeningChest, setIsOpeningChest] = useState<boolean>(false);
  const [chestRewards, setChestRewards] = useState<any[] | null>(null);

  // Animation values for chest opening & smooth tab transitions
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const invTabScrollRef = useRef<any>(null);
  const tabContentOpacity = useRef(new Animated.Value(1)).current;

  const handleSelectInvTab = (tabId: InvTabType, idx: number) => {
    if (tabId === activeTab) return;
    sound.playSound('tap');
    sound.triggerHaptic('light');
    setStatusMessage(null);
    const targetX = idx <= 1 ? 0 : Math.max(0, (idx - 1) * 105);
    invTabScrollRef.current?.scrollTo({
      x: targetX,
      animated: true,
    });
    tabContentOpacity.setValue(0.25);
    setActiveTab(tabId);
    Animated.timing(tabContentOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  // Real items from user inventory - NO defaultItems fallback!
  const userInventory: InventoryItem[] = user?.inventory || [];

  const filteredItems = userInventory.filter((item) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'chests') return item.category === 'chest' || item.id.includes('chest');
    if (activeTab === 'keys') return item.category === 'key' || item.id.includes('key');
    if (activeTab === 'boosters') return item.category === 'booster' || item.id.includes('bolt') || item.id.includes('flame');
    if (activeTab === 'badges') return item.category === 'badge' || item.id.includes('badge');
    if (activeTab === 'avatars') return item.category === 'avatar' || item.id.includes('avatar');
    if (activeTab === 'cosmetics') return item.category === 'frame' || item.category === 'name_effect' || item.category === 'background';
    return true;
  });

  const totalQty = userInventory.reduce((acc, it) => acc + (it.qty || 0), 0);

  // Determine key needed for a chest (hediye kutusu anahtar gerektirmez)
  const getRequiredKey = (chestId: string): { id: string; name: string } | null => {
    if (chestId.includes('gift')) {
      return null;
    }
    if (chestId.includes('legendary') || chestId.includes('mythic')) {
      return { id: 'key_diamond', name: 'Elmas Anahtar' };
    }
    if (chestId.includes('gold')) {
      return { id: 'key_gold', name: 'Altın Anahtar' };
    }
    return { id: 'key_silver', name: 'Gümüş Anahtar' };
  };

  const handleOpenChestClick = (item: InventoryItem) => {
    sound.playSound('tap');
    setSelectedChest(item);
    setChestRewards(null);
  };

  const triggerChestOpeningAnimation = async () => {
    if (!selectedChest || !user) return;
    const reqKey = getRequiredKey(selectedChest.id);
    const keyInInv = reqKey ? userInventory.find((i) => i.id === reqKey.id) : undefined;
    const hasKey = !reqKey || (keyInInv?.qty || 0) > 0;

    if (!hasKey && reqKey) {
      sound.playSound('wrong');
      sound.triggerHaptic('error');
      setIsError(true);
      setStatusMessage(`⚠️ ${selectedChest.name} açmak için 1x ${reqKey.name} gereklidir!`);
      return;
    }

    setIsOpeningChest(true);
    sound.playSound('tap');
    sound.triggerHaptic('medium');

    // 1. Shaking animation
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 12, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 15, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]).start();

    // 2. Server API call
    const base = apiBaseUrl || DEFAULT_API_BASE;
    try {
      const res = await fetch(`${base}/social/inventory/open-chest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          userId: user.id,
          chestId: selectedChest.id,
          keyId: reqKey ? reqKey.id : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        sound.playSound('wrong');
        sound.triggerHaptic('error');
        setIsOpeningChest(false);
        setIsError(true);
        setStatusMessage(data.error || 'Sandık açılamadı.');
        return;
      }

      // 3. Reveal glow animation
      Animated.parallel([
        Animated.timing(scaleAnim, { toValue: 1.15, duration: 300, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start(() => {
        sound.playSound('victory');
        sound.triggerHaptic('success');
        setIsOpeningChest(false);
        setChestRewards(data.rewards || []);
        if (data.user && onUpdateUser) {
          onUpdateUser(data.user);
        }
      });
    } catch {
      sound.playSound('wrong');
      setIsOpeningChest(false);
      setIsError(true);
      setStatusMessage('Sunucu bağlantı hatası oluştu.');
    }
  };

  const userSeed = user?.avatarUrl || user?.displayName;
  const previewKindOf = (item: InventoryItem | null): 'frame' | 'background' | null => {
    if (!item) return null;
    if ((item.category === 'frame' || item.id.includes('frame')) && frameFor(item.id)) return 'frame';
    if ((item.category === 'background' || item.id.startsWith('bg_')) && backgroundFor(item.id)) return 'background';
    return null;
  };
  const [previewItem, setPreviewItem] = useState<InventoryItem | null>(null);
  const [equippingItemId, setEquippingItemId] = useState<string | null>(null);

  /** Kozmetik kuşanma: envanterdeki çerçeve/arka plan/isim efekti/rozet profiline uygulanır. */
  const handleEquipItem = async (item: InventoryItem) => {
    if (!apiBaseUrl || equippingItemId) return;
    setEquippingItemId(item.id);
    try {
      const res = await fetch(`${apiBaseUrl}/social/inventory/use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ userId: user?.id, itemId: item.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setIsError(true);
        setStatusMessage(data.error || 'Kozmetik uygulanamadı.');
      } else {
        sound.playSound('victory');
        sound.triggerHaptic('success');
        setIsError(false);
        setStatusMessage(data.rewardText || `${item.name} profilinize uygulandı!`);
        if (data.user && onUpdateUser) onUpdateUser(data.user);
      }
    } catch {
      setIsError(true);
      setStatusMessage('Sunucu bağlantı hatası oluştu.');
    } finally {
      setEquippingItemId(null);
    }
  };

  /** Kozmetik mi? (kuşanılabilir) */
  const isEquippable = (item: InventoryItem) =>
    item.id.startsWith('frame_') || item.id.startsWith('bg_') || item.id.startsWith('name_') || item.id.startsWith('badge_');

  const renderItemVisual = (item: InventoryItem, size = 48) => {
    const pk = previewKindOf(item);
    if (pk === 'frame') return <FramedAvatar frameId={item.id} seed={userSeed} size={Math.round(size * 1.8)} />;
    if (pk === 'background') {
      return <BackgroundThumb bgId={item.id} seed={userSeed} name={user?.displayName} width={Math.round(size * 1.05)} />;
    }
    const img = storeImageFor(item.id, item.category);
    if (img) {
      const s2 = Math.round(size * 1.6);
      return <Image source={img} style={{ width: s2, height: s2 }} resizeMode="contain" />;
    }
    if (item.category === 'chest' || item.id.includes('chest')) return <ChestIcon size={size} />;
    if (item.category === 'key' || item.id.includes('key')) return <KeyIcon size={size} />;
    if (item.id.startsWith('badge_')) return <BadgeVisual badgeId={item.id} size={Math.round(size * 1.4)} />;
    if (item.id.includes('bolt')) return <SpeedBoltIcon size={size} />;
    if (item.id.includes('crown')) return <CrownIcon size={size} />;
    if (item.id.includes('heart')) return <HeartIcon size={size} />;
    if (item.id.includes('gem')) return <GemIcon size={size} />;
    if (item.id.includes('coin')) return <CoinIcon size={size} />;
    return <StreakFlameIcon size={size} />;
  };

  return (
    <TavrikoScreen>
      <TavrikoTopBar
        leftType={onBack ? 'back' : 'bell'}
        onLeftPress={onBack || onNotifications}
        coins={user?.coins ?? 0}
        gems={user?.gems ?? 0}
        avatarSeed={user?.avatarUrl || user?.displayName}
        onAvatarPress={onProfile}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <KitHeader
          title="Envanter"
          subtitle={
            userInventory.length === 0
              ? 'Henüz eşyan yok'
              : `${totalQty} eşya · ${userInventory.length} çeşit`
          }
        />
        <KitChips
          tabs={INV_TABS.map((t) => ({ id: t.id, label: t.label }))}
          active={activeTab}
          onChange={(id, idx) => handleSelectInvTab(id, idx)}
          scrollRef={invTabScrollRef}
        />

        {/* Aktif Etkiler: kuşanılmış kozmetikler + aktif iksirler; süre barı
            bitince satırlar kaybolur, kozmetikler otomatik eski haline döner */}
        {(() => {
          const now = Date.now();
          const activeRows: React.ReactNode[] = [];
          const cos = (id: string | undefined, expiresAt: number | undefined) =>
            id && expiresAt && expiresAt > now ? { id, expiresAt } : null;
          const frame = cos(user?.equippedFrame, user?.equippedFrameExpiresAt);
          const badge = cos(user?.equippedBadge, user?.equippedBadgeExpiresAt);
          const nameFx = cos(user?.equippedNameEffect, user?.equippedNameEffectExpiresAt);
          const bg = cos(user?.equippedBackground, user?.equippedBackgroundExpiresAt);
          if (frame) {
            activeRows.push(
              <ActiveEffectRow
                key="fx-frame"
                visual={<FramedAvatar frameId={frame.id} seed={userSeed} size={40} />}
                label={getCosmeticDef(frame.id)?.name || 'Çerçeve'}
                expiresAt={frame.expiresAt}
                accent="#38BDF8"
              />
            );
          }
          if (badge) {
            const bImg = storeImageFor(badge.id);
            activeRows.push(
              <ActiveEffectRow
                key="fx-badge"
                visual={bImg
                  ? <Image source={bImg} style={{ width: 36, height: 36 }} resizeMode="contain" />
                  : <BadgeVisual badgeId={badge.id} size={36} />}
                label={getCosmeticDef(badge.id)?.name || 'Rozet'}
                expiresAt={badge.expiresAt}
                accent="#F59E0B"
              />
            );
          }
          if (nameFx) {
            activeRows.push(
              <ActiveEffectRow
                key="fx-name"
                visual={<Text style={{ fontSize: 22 }}>✨</Text>}
                label={getCosmeticDef(nameFx.id)?.name || 'İsim Efekti'}
                expiresAt={nameFx.expiresAt}
                accent="#D946EF"
              />
            );
          }
          if (bg) {
            activeRows.push(
              <ActiveEffectRow
                key="fx-bg"
                visual={<Text style={{ fontSize: 22 }}>🖼️</Text>}
                label={getCosmeticDef(bg.id)?.name || 'Arka Plan'}
                expiresAt={bg.expiresAt}
                accent="#8B5CF6"
              />
            );
          }
          if (user?.activeBoosterExpiresAt && user.activeBoosterExpiresAt > now) {
            activeRows.push(
              <ActiveEffectRow
                key="fx-xp2"
                visual={<SpeedBoltIcon size={30} />}
                label="⚡ 2x XP İksiri"
                expiresAt={user.activeBoosterExpiresAt}
                accent="#38BDF8"
              />
            );
          }
          if (user?.xp3BoosterExpiresAt && user.xp3BoosterExpiresAt > now) {
            activeRows.push(
              <ActiveEffectRow
                key="fx-xp3"
                visual={<SpeedBoltIcon size={30} />}
                label="⚡ 3x XP İksiri"
                expiresAt={user.xp3BoosterExpiresAt}
                accent="#A855F7"
              />
            );
          }
          if (user?.coinBoosterExpiresAt && user.coinBoosterExpiresAt > now) {
            activeRows.push(
              <ActiveEffectRow
                key="fx-coin"
                visual={<CoinIcon size={30} />}
                label="🪙 2x Altın İksiri"
                expiresAt={user.coinBoosterExpiresAt}
                accent="#F59E0B"
              />
            );
          }
          if (activeRows.length === 0) return null;
          return (
            <View style={activeFxStyles.card}>
              <Text style={activeFxStyles.cardTitle}>Aktif Etkiler ({activeRows.length})</Text>
              {activeRows}
            </View>
          );
        })()}

        {/* Status Message */}
        {statusMessage && (
          <View style={[styles.statusBanner, isError ? styles.statusError : styles.statusSuccess]}>
            <Text style={[styles.statusBannerText, isError ? styles.statusTextError : styles.statusTextSuccess]}>
              {statusMessage}
            </Text>
          </View>
        )}

        {/* Empty State vs Item Grid */}
        {userInventory.length === 0 ? (
          <KitEmpty
            source={STORE_IMG.inventoryEmpty}
            title="Envanterin boş"
            desc="Mağazadan sandık ve güçlendirici alabilir, Sezon Pass'te seviye atlayarak ödül kazanabilirsin."
            actionLabel={onNavigateSecondary ? 'Mağazaya git' : undefined}
            onAction={() => {
              sound.playSound('tap');
              onNavigateSecondary && onNavigateSecondary('shop');
            }}
          />
        ) : filteredItems.length === 0 ? (
          <KitEmpty
            source={STORE_IMG.inventoryEmpty}
            title="Bu kategoride eşya yok"
            desc="Diğer sekmelere göz atabilirsin."
          />
        ) : (
          <View style={styles.grid}>
            {filteredItems.map((item, index) => {
              const rarityColor = RARITY_COLORS[item.rarity || 'common'];
              const isChest = item.category === 'chest' || item.id.includes('chest');

              return (
                <Reanimated.View
                  key={`${activeTab}-${item.id}`}
                  entering={FadeInDown.delay(Math.min(index, 8) * 50).duration(340)}
                  style={styles.itemCardWrap}
                >
                <TouchableOpacity
                  style={styles.itemCard}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (isChest) handleOpenChestClick(item);
                    else if (isEquippable(item)) handleEquipItem(item);
                    else if (previewKindOf(item)) {
                      sound.playSound('tap');
                      setPreviewItem(item);
                    }
                  }}
                >
                  <View style={[styles.rarityBar, { backgroundColor: rarityColor }]} />
                  <View style={styles.qtyBadge}>
                    <Text style={styles.qtyText}>x{item.qty}</Text>
                  </View>
                  <View style={styles.iconWrap}>
                    {renderItemVisual(item, 44)}
                  </View>
                  <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.itemDesc} numberOfLines={2}>{item.desc}</Text>
                  {isChest && (
                    <View style={styles.openPill}>
                      <Text style={styles.openPillText}>Sandığı aç</Text>
                    </View>
                  )}
                  {isEquippable(item) && (
                    <View style={styles.openPill}>
                      <Text style={styles.openPillText}>
                        {equippingItemId === item.id ? 'Uygulanıyor...' : 'Kuşan'}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
                </Reanimated.View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <CosmeticPreviewModal
        visible={!!previewItem}
        kind={previewKindOf(previewItem)}
        itemId={previewItem?.id || ''}
        title={previewItem?.name || ''}
        seed={userSeed}
        name={user?.displayName}
        level={user?.level}
        stats={
          user
            ? [
                { label: 'Maç', value: String(user.stats?.totalMatches ?? 0) },
                { label: 'Galibiyet', value: String(user.stats?.wins ?? 0) },
                { label: 'Doğru', value: String(user.stats?.correctAnswers ?? 0) },
              ]
            : undefined
        }
        onClose={() => setPreviewItem(null)}
      />

      {/* Chest Opening Modal */}
      <Modal
        visible={!!selectedChest}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isOpeningChest) setSelectedChest(null);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            {selectedChest && (
              <>
                <Text style={styles.modalTitle}>
                  {chestRewards ? 'Ödüllerin' : selectedChest.name}
                </Text>

                {/* Chest Visual / Shake / Glow */}
                {!chestRewards ? (
                  <Animated.View
                    style={[
                      styles.animatedChestWrap,
                      {
                        transform: [
                          { translateX: shakeAnim },
                          { scale: scaleAnim },
                        ],
                      },
                    ]}
                  >
                    <Image
                      source={storeImageFor(selectedChest.id, 'chest') || STORE_IMG.chestWood}
                      style={{ width: 150, height: 150 }}
                      resizeMode="contain"
                    />
                  </Animated.View>
                ) : (
                  <View style={styles.rewardsList}>
                    {chestRewards.map((rew, index) => (
                      <Reanimated.View
                        key={index}
                        entering={ZoomIn.delay(index * 120).springify()}
                        style={styles.rewardCard}
                      >
                        {rew.type === 'coins' ? (
                          <CoinIcon size={22} />
                        ) : rew.type === 'gems' ? (
                          <GemIcon size={22} />
                        ) : rew.type === 'item' ? (
                          <CrownIcon size={22} />
                        ) : (
                          <SpeedBoltIcon size={22} />
                        )}
                        <Text style={styles.rewardText}>
                          {rew.type === 'item'
                            ? `🎁 Bonus: ${rew.label ?? 'Özel Eşya'}${rew.amount > 1 ? ` x${rew.amount}` : ''}`
                            : `+${rew.amount} ${rew.type === 'coins' ? 'Altın' : rew.type === 'gems' ? 'Elmas' : 'XP'}`}
                        </Text>
                      </Reanimated.View>
                    ))}
                  </View>
                )}

                {/* Key Status & Action */}
                {!chestRewards ? (
                  <>
                    <View style={styles.keyReqBox}>
                      <Text style={styles.keyReqLabel}>Gereken Anahtar:</Text>
                      <View style={styles.keyReqRow}>
                        <KeyIcon size={18} />
                        <Text style={styles.keyReqText}>
                          {getRequiredKey(selectedChest.id)
                            ? `1x ${getRequiredKey(selectedChest.id)!.name}`
                            : 'Anahtar gerekmez — hediye kutusu'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.modalActions}>
                      <TouchableOpacity
                        style={styles.cancelBtn}
                        disabled={isOpeningChest}
                        onPress={() => {
                          sound.playSound('tap');
                          setSelectedChest(null);
                        }}
                      >
                        <Text style={styles.cancelBtnText}>Vazgeç</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.openBtn, isOpeningChest && { opacity: 0.7 }]}
                        disabled={isOpeningChest}
                        onPress={triggerChestOpeningAnimation}
                      >
                        {isOpeningChest ? (
                          <ActivityIndicator color="#12052C" size="small" />
                        ) : (
                          <Text style={styles.openBtnText}>Sandığı Aç</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.doneBtn}
                    onPress={() => {
                      sound.playSound('tap');
                      setSelectedChest(null);
                      setChestRewards(null);
                    }}
                  >
                    <Text style={styles.doneBtnText}>Harika!</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

      <TavrikoSecondaryBottomNav
        activeTab="inventory"
        onSelectTab={(tab) => onNavigateSecondary && onNavigateSecondary(tab)}
      />
    </TavrikoScreen>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 140,
    paddingHorizontal: 4,
  },
  heroWrap: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 28,
    color: '#FFC43D',
    letterSpacing: 1.5,
  },
  subtitle: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.medium,
    marginTop: 2,
  },
  tabsScrollWrap: {
    marginHorizontal: -16,
  },
  tabsRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(10, 4, 24, 0.6)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  tabPillActive: {
    backgroundColor: 'rgba(107, 60, 255, 0.45)',
    borderColor: '#FFC43D',
  },
  tabIcon: {
    fontSize: 13,
  },
  tabText: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  statusBanner: {
    borderRadius: 14,
    padding: 12,
    marginVertical: 8,
    borderWidth: 1.5,
  },
  statusSuccess: {
    backgroundColor: 'rgba(111, 227, 193, 0.15)',
    borderColor: '#6FE3C1',
  },
  statusError: {
    backgroundColor: 'rgba(255, 92, 119, 0.15)',
    borderColor: '#FF5C77',
  },
  statusBannerText: {
    fontSize: 13,
    fontFamily: THEME.fonts.bold,
    textAlign: 'center',
  },
  statusTextSuccess: {
    color: '#6FE3C1',
  },
  statusTextError: {
    color: '#FF8598',
  },
  emptyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 24,
  },
  emptyIcon: {
    fontSize: 54,
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 20,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptyDesc: {
    fontFamily: THEME.fonts.medium,
    fontSize: 13,
    color: '#D9CDF5',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  emptyBtn: {
    backgroundColor: '#FFC43D',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  emptyBtnText: {
    color: '#12052C',
    fontSize: 14,
    fontFamily: THEME.fonts.extraBold,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    marginTop: 8,
  },
  itemCardWrap: {
    width: '48.5%',
    alignSelf: 'stretch',
  },
  rarityBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  itemCard: {
    width: '100%',
    flex: 1,
    backgroundColor: KIT.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: KIT.border,
    overflow: 'hidden',
    padding: 12,
    alignItems: 'center',
    position: 'relative',
  },
  qtyBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(107, 60, 255, 0.7)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  qtyText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  iconWrap: {
    height: 92,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 6,
  },
  itemName: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  itemDesc: {
    fontFamily: THEME.fonts.medium,
    fontSize: 10,
    color: '#D9CDF5',
    textAlign: 'center',
    marginVertical: 4,
    minHeight: 26,
  },
  openPill: {
    backgroundColor: '#FFC43D',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginTop: 6,
    width: '100%',
    alignItems: 'center',
  },
  openPillText: {
    color: '#12052C',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 2, 16, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalSheet: {
    backgroundColor: '#1A0B3B',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: THEME.fonts.black,
    fontSize: 20,
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  animatedChestWrap: {
    marginVertical: 16,
  },
  keyReqBox: {
    backgroundColor: 'rgba(10, 4, 24, 0.6)',
    borderRadius: 14,
    padding: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  keyReqLabel: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.medium,
    marginBottom: 4,
  },
  keyReqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  keyReqText: {
    color: '#FFC43D',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.bold,
  },
  openBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#FFC43D',
    alignItems: 'center',
  },
  openBtnText: {
    color: '#12052C',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
  },
  rewardsList: {
    width: '100%',
    gap: 8,
    marginVertical: 16,
  },
  rewardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 196, 61, 0.3)',
  },
  rewardIcon: {
    fontSize: 20,
  },
  rewardText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: THEME.fonts.extraBold,
  },
  doneBtn: {
    backgroundColor: '#6FE3C1',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  doneBtnText: {
    color: '#12052C',
    fontSize: 14,
    fontFamily: THEME.fonts.extraBold,
  },
});
