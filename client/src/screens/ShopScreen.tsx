import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { UserProfile } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { DEFAULT_API_BASE } from '../config';
import {
  TavrikoScreen,
  TavrikoTopBar,
  TavrikoSecondaryBottomNav,
  SecondaryNavTab,
  Button3D,
  ChestIcon,
  CoinIcon,
  GemIcon,
} from '../components/TavrikoIcons';
import { PaymentItem } from './PaymentScreen';
interface ShopScreenProps {
  user?: UserProfile;
  apiBaseUrl?: string;
  onUpdateUser?: (updatedUser: UserProfile) => void;
  onBack?: () => void;
  onNavigateSecondary?: (tab: SecondaryNavTab) => void;
  onNotifications?: () => void;
  onProfile?: () => void;
  onOpenPayment?: (item: PaymentItem) => void;
}
const SHOP_TABS = ['Öne Çıkanlar', 'Elmas', 'Altın', 'Sandıklar'] as const;
export const ShopScreen: React.FC<ShopScreenProps> = ({
  user,
  apiBaseUrl,
  onUpdateUser,
  onBack,
  onNavigateSecondary,
  onNotifications,
  onProfile,
  onOpenPayment,
}) => {
  const [activeTab, setActiveTab] = useState<string>('Öne Çıkanlar');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState<boolean>(false);
  // In-Game Currency Purchase Handler with Strict Pre-flight Validation
  const handleInGamePurchase = async (packId: 'coins_2000' | 'mega_chest') => {
    setStatusMessage(null);
    setIsError(false);
    if (!user) {
      sound.playSound('wrong');
      setIsError(true);
      setStatusMessage('İşlem yapmak için giriş yapmalısınız.');
      return;
    }
    // Strict Client-Side Balance Validation
    if (packId === 'coins_2000') {
      const requiredGems = 10;
      const currentGems = user.gems ?? 0;
      if (currentGems < requiredGems) {
        sound.playSound('wrong');
        sound.triggerHaptic('error');
        setIsError(true);
        setStatusMessage(
          `⚠️ Yetersiz Bakiye! Bu paket için ${requiredGems} Elmas gerekli (Mevcut: ${currentGems}, Eksik: ${requiredGems - currentGems} Elmas).`
        );
        return;
      }
    } else if (packId === 'mega_chest') {
      const requiredCoins = 400;
      const currentCoins = user.coins ?? 0;
      if (currentCoins < requiredCoins) {
        sound.playSound('wrong');
        sound.triggerHaptic('error');
        setIsError(true);
        setStatusMessage(
          `⚠️ Yetersiz Bakiye! Bu sandık için ${requiredCoins} Altın gerekli (Mevcut: ${currentCoins}, Eksik: ${requiredCoins - currentCoins} Altın).`
        );
        return;
      }
    }
    const base = apiBaseUrl || DEFAULT_API_BASE;
    try {
      sound.playSound('tap');
      const res = await fetch(`${base}/social/shop/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, packId }),
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
      if (data.user && onUpdateUser) {
        onUpdateUser(data.user);
      }
      setStatusMessage(data.message || 'Satın alma veritabanına kaydedildi!');
    } catch {
      sound.playSound('wrong');
      setIsError(true);
      setStatusMessage('Sunucu bağlantı hatası.');
    }
  };
  // Real Money Purchases Redirect to High-Fidelity PaymentScreen
  const handleOpenRealMoneyPayment = (item: PaymentItem) => {
    sound.playSound('tap');
    sound.triggerHaptic('light');
    if (onOpenPayment) {
      onOpenPayment(item);
    }
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
        <Text style={styles.title}>MAĞAZA</Text>
        <Text style={styles.subtitle}>
          Bakiye: {user?.coins ?? 0} Altın · {user?.gems ?? 0} Elmas (Canlı Veritabanı)
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
        {/* Filter Tabs */}
        <View style={styles.tabsRow}>
          {SHOP_TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabPill, activeTab === tab && styles.tabPillActive]}
              onPress={() => {
                sound.playSound('tap');
                setActiveTab(tab);
              }}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.tabTextActive,
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* Starter Pack Hero Card */}
        {(activeTab === 'Öne Çıkanlar' || activeTab === 'Sandıklar') && (
          <View style={styles.starterPackCard}>
            <View style={{ flex: 1 }}>
              <View style={styles.badgeRow}>
                <View style={styles.specialBadge}>
                  <Text style={styles.specialBadgeText}>ÖZEL FIRSAT</Text>
                </View>
              </View>
              <Text style={styles.starterTitle}>BAŞLANGIÇ PAKETİ</Text>
              <Text style={styles.starterSub}>
                Sandık + 1.000 Altın + 50 Elmas + 2x XP İksiri
              </Text>
              <Button3D
                title="₺39,99 SATIN AL"
                variant="gold"
                onPress={() =>
                  handleOpenRealMoneyPayment({
                    id: 'starter_pack',
                    title: 'Başlangıç Paketi',
                    subtitle: 'Sandık + 1.000 Altın + 50 Elmas + 2x XP İksiri',
                    price: '₺39,99',
                    priceNumeric: 39.99,
                    iconType: 'pack',
                  })
                }
                style={{ alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 20 }}
                textStyle={{ fontSize: 14 }}
              />
            </View>
            <View style={styles.starterIconWrap}>
              <ChestIcon size={58} />
              <View style={styles.gemOverlay}>
                <GemIcon size={32} />
              </View>
            </View>
          </View>
        )}
        {/* 2x2 Interactive Shop Items Grid */}
        <View style={styles.gridWrap}>
          {/* 100 Elmas */}
          {(activeTab === 'Öne Çıkanlar' || activeTab === 'Elmas') && (
            <View style={styles.shopItemCard}>
              <View style={styles.iconCircle}>
                <GemIcon size={46} />
              </View>
              <Text style={styles.itemAmount}>+100 Elmas</Text>
              <Text style={styles.itemDetailText}>Hemen teslim</Text>
              <Button3D
                title="₺19,99"
                variant="purple"
                onPress={() =>
                  handleOpenRealMoneyPayment({
                    id: 'gems_100',
                    title: '100 Elmas',
                    subtitle: 'Hemen teslim · 100 Elmas',
                    price: '₺19,99',
                    priceNumeric: 19.99,
                    iconType: 'gem',
                  })
                }
                style={styles.buyBtn}
                textStyle={{ fontSize: 15 }}
              />
            </View>
          )}
          {/* 500 Elmas (Matches Ödeme@1x.png with bonus) */}
          {(activeTab === 'Öne Çıkanlar' || activeTab === 'Elmas') && (
            <View style={styles.shopItemCard}>
              <View style={styles.bonusTag}>
                <Text style={styles.bonusTagText}>+50 BONUS</Text>
              </View>
              <View style={styles.iconCircle}>
                <GemIcon size={46} />
              </View>
              <Text style={styles.itemAmount}>500 Elmas</Text>
              <Text style={styles.itemDetailText}>+50 bonus elmas</Text>
              <Button3D
                title="₺89,99"
                variant="mint"
                onPress={() =>
                  handleOpenRealMoneyPayment({
                    id: 'gems_500',
                    title: '500 Elmas',
                    subtitle: '+50 bonus elmas',
                    price: '₺89,99',
                    priceNumeric: 89.99,
                    iconType: 'gem',
                  })
                }
                style={styles.buyBtn}
                textStyle={{ fontSize: 15 }}
              />
            </View>
          )}
          {/* +2.000 Altın (Costs 10 Elmas) */}
          {(activeTab === 'Öne Çıkanlar' || activeTab === 'Altın') && (
            <View style={styles.shopItemCard}>
              <View style={styles.iconCircle}>
                <CoinIcon size={46} />
              </View>
              <Text style={styles.itemAmount}>+2.000 Altın</Text>
              <Text style={styles.itemDetailText}>Oyun içi takas</Text>
              <Button3D
                title="10 Elmas"
                variant="gold"
                onPress={() => handleInGamePurchase('coins_2000')}
                style={styles.buyBtn}
                textStyle={{ fontSize: 14 }}
              />
            </View>
          )}
          {/* Mega Sandık (Costs 400 Altın) */}
          {(activeTab === 'Öne Çıkanlar' || activeTab === 'Sandıklar') && (
            <View style={styles.shopItemCard}>
              <View style={styles.iconCircle}>
                <ChestIcon size={46} />
              </View>
              <Text style={styles.itemAmount}>Mega Sandık</Text>
              <Text style={styles.itemDetailText}>Özel ödüller</Text>
              <Button3D
                title="400 Altın"
                variant="mint"
                onPress={() => handleInGamePurchase('mega_chest')}
                style={styles.buyBtn}
                textStyle={{ fontSize: 14 }}
              />
            </View>
          )}
        </View>
      </ScrollView>
      <TavrikoSecondaryBottomNav
        activeTab="shop"
        onSelectTab={(tab) => onNavigateSecondary && onNavigateSecondary(tab)}
      />
    </TavrikoScreen>
  );
};
const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 110,
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
    marginBottom: 12,
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
    fontSize: 12.5,
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
  tabsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  tabPill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  tabPillActive: {
    backgroundColor: '#6B3CFF',
    borderColor: '#FFC43D',
  },
  tabText: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  starterPackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 24,
    backgroundColor: '#7A3FE0',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 196, 61, 0.55)',
    gap: 12,
    marginBottom: 16,
    shadowColor: '#6B3CFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  specialBadge: {
    backgroundColor: '#FFC43D',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  specialBadgeText: {
    fontFamily: THEME.fonts.display,
    fontSize: 10,
    color: '#2A1558',
  },
  starterTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 22,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  starterSub: {
    color: '#F0E6FF',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 16,
  },
  starterIconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gemOverlay: {
    position: 'absolute',
    bottom: -6,
    right: -6,
  },
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
  },
  shopItemCard: {
    width: '48%',
    backgroundColor: 'rgba(28, 12, 62, 0.88)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 22,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    position: 'relative',
  },
  bonusTag: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#5ADBB5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bonusTagText: {
    fontFamily: THEME.fonts.display,
    fontSize: 9,
    color: '#0D382B',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  itemAmount: {
    fontFamily: THEME.fonts.display,
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  itemDetailText: {
    color: '#A799C7',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    marginTop: 2,
    marginBottom: 12,
  },
  buyBtn: {
    width: '100%',
    minHeight: 42,
  },
});