import React, { useState, useRef } from 'react';
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
import { UserProfile, InventoryItem, ItemCategory } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { DEFAULT_API_BASE } from '../config';
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

  // Animation values for chest opening
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

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

  // Determine key needed for a chest
  const getRequiredKey = (chestId: string) => {
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
    const keyInInv = userInventory.find((i) => i.id === reqKey.id);
    const hasKey = (keyInInv?.qty || 0) > 0;

    if (!hasKey) {
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          chestId: selectedChest.id,
          keyId: reqKey.id,
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

  const renderItemVisual = (item: InventoryItem, size = 48) => {
    if (item.category === 'chest' || item.id.includes('chest')) return <ChestIcon size={size} />;
    if (item.category === 'key' || item.id.includes('key')) return <KeyIcon size={size} />;
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
        {/* Header Hero */}
        <View style={styles.heroWrap}>
          <Text style={styles.title}>ENVANTER</Text>
          <Text style={styles.subtitle}>
            {userInventory.length === 0
              ? 'Henüz eşyan yok'
              : `Toplam ${totalQty} eşya · Sunucu Kayıtlı`}
          </Text>
        </View>

        {/* 7 Tabs Horizontal Scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsRow}
        >
          {INV_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabPill, isActive && styles.tabPillActive]}
                onPress={() => {
                  sound.playSound('tap');
                  setActiveTab(tab.id);
                  setStatusMessage(null);
                }}
              >
                <Text style={styles.tabIcon}>{tab.icon}</Text>
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

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
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>Envanterin Boş</Text>
            <Text style={styles.emptyDesc}>
              Mağazadan sandıklar ve güçlendiriciler satın alabilir veya Sezon Pass'ten seviye atlayarak harika ödüller kazanabilirsin!
            </Text>
            {onNavigateSecondary && (
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => {
                  sound.playSound('tap');
                  onNavigateSecondary('shop');
                }}
              >
                <Text style={styles.emptyBtnText}>Mağazaya Git</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : filteredItems.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyTitle}>Bu Kategoride Eşya Yok</Text>
            <Text style={styles.emptyDesc}>
              Seçtiğin kategoriye ait eşya bulunamadı. Diğer sekmelere göz atabilirsin.
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {filteredItems.map((item) => {
              const rarityColor = RARITY_COLORS[item.rarity || 'common'];
              const isChest = item.category === 'chest' || item.id.includes('chest');

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.itemCard, { borderColor: rarityColor }]}
                  activeOpacity={0.8}
                  onPress={() => isChest && handleOpenChestClick(item)}
                >
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
                      <Text style={styles.openPillText}>SANDIĞI AÇ</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

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
                  {chestRewards ? '🎉 TEBRİKLER! ÖDÜLLERİN' : selectedChest.name.toUpperCase()}
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
                    <ChestIcon size={96} />
                  </Animated.View>
                ) : (
                  <View style={styles.rewardsList}>
                    {chestRewards.map((rew, index) => (
                      <View key={index} style={styles.rewardCard}>
                        <Text style={styles.rewardIcon}>
                          {rew.type === 'coins' ? '🪙' : rew.type === 'gems' ? '💎' : '⚡'}
                        </Text>
                        <Text style={styles.rewardText}>
                          +{rew.amount} {rew.type === 'coins' ? 'Altın' : rew.type === 'gems' ? 'Elmas' : 'XP'}
                        </Text>
                      </View>
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
                          1x {getRequiredKey(selectedChest.id).name}
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
    paddingBottom: 110,
    paddingHorizontal: 12,
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
  tabsRow: {
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
    gap: 10,
    marginTop: 8,
  },
  itemCard: {
    width: '48.5%',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 18,
    borderWidth: 1.5,
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
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 6,
  },
  itemName: {
    fontFamily: THEME.fonts.display,
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
    backgroundColor: '#1E0E3E',
    borderWidth: 1.5,
    borderColor: '#FFC43D',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 18,
    color: '#FFC43D',
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
    fontFamily: THEME.fonts.display,
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
