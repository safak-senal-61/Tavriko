import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { UserProfile, SHOP_CATALOG, ShopProduct, ShopProductCategory } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { DEFAULT_API_BASE } from '../config';
import {
  TavrikoScreen,
  TavrikoTopBar,
  TavrikoSecondaryBottomNav,
  SecondaryNavTab,
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

interface CategoryTabItem {
  id: ShopProductCategory;
  name: string;
  icon: string;
}

const CATEGORY_TABS: CategoryTabItem[] = [
  { id: 'featured', name: 'Öne Çıkanlar', icon: '🔥' },
  { id: 'diamonds', name: 'Elmas', icon: '💎' },
  { id: 'coins', name: 'Altın', icon: '🪙' },
  { id: 'chests', name: 'Sandıklar', icon: '📦' },
  { id: 'keys', name: 'Anahtarlar', icon: '🗝️' },
  { id: 'avatars', name: 'Avatarlar', icon: '🎭' },
  { id: 'frames', name: 'Çerçeveler', icon: '🖼️' },
  { id: 'badges', name: 'Rozetler', icon: '🎖️' },
  { id: 'name_effects', name: 'İsim Efekti', icon: '✨' },
  { id: 'boosters', name: 'Güçlendirici', icon: '⚡' },
  { id: 'backgrounds', name: 'Arka Plan', icon: '🌌' },
];

const RARITY_COLORS: Record<string, string> = {
  common: '#A0A0A0',
  rare: '#3B82F6',
  epic: '#A855F7',
  legendary: '#F59E0B',
  mythic: '#EF4444',
};

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
  const [activeTab, setActiveTab] = useState<ShopProductCategory>('featured');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState<boolean>(false);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [confirmProduct, setConfirmProduct] = useState<ShopProduct | null>(null);

  const filteredProducts = SHOP_CATALOG.filter((p) => p.category === activeTab);

  const isProductOwned = (product: ShopProduct): boolean => {
    if (!user) return false;
    if (product.grantPremiumPass && user.hasPremiumPass) return true;
    if (product.category === 'avatars' && user.inventory?.some((i) => i.id === product.id)) return true;
    if (product.category === 'frames' && user.inventory?.some((i) => i.id === product.id)) return true;
    if (product.category === 'badges' && user.inventory?.some((i) => i.id === product.id)) return true;
    if (product.category === 'name_effects' && user.inventory?.some((i) => i.id === product.id)) return true;
    if (product.category === 'backgrounds' && user.inventory?.some((i) => i.id === product.id)) return true;
    return false;
  };

  const handleInitiatePurchase = (product: ShopProduct) => {
    sound.playSound('tap');
    if (!user) {
      sound.playSound('wrong');
      setIsError(true);
      setStatusMessage('Satın alma yapmak için giriş yapmalısınız.');
      return;
    }

    if (isProductOwned(product)) {
      sound.playSound('wrong');
      setIsError(true);
      setStatusMessage('Bu eşyaya zaten sahipsiniz!');
      return;
    }

    if (product.currency === 'try') {
      if (onOpenPayment) {
        onOpenPayment({
          id: product.id,
          title: product.name,
          priceText: `₺${product.price.toFixed(2)}`,
          description: product.desc,
        });
      } else {
        // Fallback simulated payment
        setConfirmProduct(product);
      }
      return;
    }

    // Check currency balance
    if (product.currency === 'coins' && (user.coins ?? 0) < product.price) {
      sound.playSound('wrong');
      sound.triggerHaptic('error');
      setIsError(true);
      setStatusMessage(`⚠️ Yetersiz Altın! ${product.price} Altın gerekli (Mevcut: ${user.coins ?? 0}).`);
      return;
    }

    if (product.currency === 'gems' && (user.gems ?? 0) < product.price) {
      sound.playSound('wrong');
      sound.triggerHaptic('error');
      setIsError(true);
      setStatusMessage(`⚠️ Yetersiz Elmas! ${product.price} Elmas gerekli (Mevcut: ${user.gems ?? 0}).`);
      return;
    }

    setConfirmProduct(product);
  };

  const handleConfirmPurchase = async () => {
    if (!confirmProduct || !user) return;
    const product = confirmProduct;
    setPurchasingId(product.id);
    setStatusMessage(null);
    setIsError(false);

    const base = apiBaseUrl || DEFAULT_API_BASE;
    try {
      const res = await fetch(`${base}/social/shop/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          productId: product.id,
          paymentMethod: product.currency === 'gems' ? 'gems' : product.currency === 'coins' ? 'coins' : 'credit_card',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        sound.playSound('wrong');
        sound.triggerHaptic('error');
        setIsError(true);
        setStatusMessage(data.error || 'Satın alma başarısız oldu.');
        setConfirmProduct(null);
        setPurchasingId(null);
        return;
      }

      sound.playSound('reward');
      sound.triggerHaptic('success');
      setIsError(false);
      setStatusMessage(data.message || `${product.name} başarıyla satın alındı!`);
      if (data.user && onUpdateUser) {
        onUpdateUser(data.user);
      }
    } catch (err: any) {
      sound.playSound('wrong');
      setIsError(true);
      setStatusMessage('Bağlantı hatası oluştu.');
    } finally {
      setPurchasingId(null);
      setConfirmProduct(null);
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
        {/* Header Hero */}
        <View style={styles.heroWrap}>
          <Text style={styles.shopTitle}>TAVRİKO MAĞAZASI</Text>
          <Text style={styles.shopSub}>Sandıklar, Özel Kozmetikler ve Avantajlı Paketler</Text>
        </View>

        {/* 11 Categories Horizontal Scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {CATEGORY_TABS.map((cat) => {
            const isActive = activeTab === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryTab, isActive && styles.categoryTabActive]}
                onPress={() => {
                  sound.playSound('tap');
                  setActiveTab(cat.id);
                  setStatusMessage(null);
                }}
              >
                <Text style={styles.categoryIcon}>{cat.icon}</Text>
                <Text style={[styles.categoryName, isActive && styles.categoryNameActive]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Status Toast / Banner */}
        {statusMessage && (
          <View style={[styles.statusBanner, isError ? styles.statusError : styles.statusSuccess]}>
            <Text style={[styles.statusText, isError ? styles.statusTextError : styles.statusTextSuccess]}>
              {statusMessage}
            </Text>
          </View>
        )}

        {/* Product Grid */}
        <View style={styles.productGrid}>
          {filteredProducts.map((item) => {
            const owned = isProductOwned(item);
            const rarityColor = RARITY_COLORS[item.rarity || 'common'];
            const isBuying = purchasingId === item.id;

            return (
              <View
                key={item.id}
                style={[
                  styles.productCard,
                  { borderColor: rarityColor },
                  owned && styles.productCardOwned,
                ]}
              >
                {/* Badges */}
                <View style={styles.badgeRow}>
                  {item.badge && (
                    <View style={styles.promoBadge}>
                      <Text style={styles.promoBadgeText}>{item.badge}</Text>
                    </View>
                  )}
                  {item.bonusText && (
                    <View style={styles.bonusBadge}>
                      <Text style={styles.bonusBadgeText}>{item.bonusText}</Text>
                    </View>
                  )}
                </View>

                {/* Product Visual */}
                <View style={styles.visualWrap}>
                  {item.category === 'chests' || item.id.includes('chest') ? (
                    <ChestIcon size={64} />
                  ) : item.category === 'diamonds' ? (
                    <GemIcon size={56} />
                  ) : item.category === 'coins' ? (
                    <CoinIcon size={56} />
                  ) : (
                    <View style={[styles.cosmeticCircle, { borderColor: rarityColor }]}>
                      <Text style={styles.cosmeticIcon}>
                        {item.category === 'avatars' ? '🎭' :
                         item.category === 'frames' ? '🖼️' :
                         item.category === 'badges' ? '🎖️' :
                         item.category === 'name_effects' ? '✨' :
                         item.category === 'keys' ? '🗝️' :
                         item.category === 'boosters' ? '⚡' : '🌌'}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Info */}
                <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.productDesc} numberOfLines={2}>{item.desc}</Text>

                {/* Price / Purchase Button */}
                <TouchableOpacity
                  style={[
                    styles.priceBtn,
                    owned ? styles.priceBtnOwned : styles.priceBtnActive,
                  ]}
                  disabled={owned || isBuying}
                  activeOpacity={0.8}
                  onPress={() => handleInitiatePurchase(item)}
                >
                  {isBuying ? (
                    <ActivityIndicator color="#12052C" size="small" />
                  ) : owned ? (
                    <Text style={styles.priceBtnTextOwned}>SAHİPSİN</Text>
                  ) : (
                    <View style={styles.priceContentRow}>
                      {item.currency === 'coins' && <CoinIcon size={16} />}
                      {item.currency === 'gems' && <GemIcon size={16} />}
                      <Text style={styles.priceBtnText}>
                        {item.currency === 'try' ? `₺${item.price.toFixed(2)}` : item.price}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal
        visible={!!confirmProduct}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmProduct(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>SATIN ALMAYI ONAYLA</Text>
            {confirmProduct && (
              <>
                <Text style={styles.modalProduct}>{confirmProduct.name}</Text>
                <Text style={styles.modalDesc}>{confirmProduct.desc}</Text>
                <View style={styles.modalCostRow}>
                  <Text style={styles.modalCostLabel}>Fiyat:</Text>
                  <View style={styles.priceContentRow}>
                    {confirmProduct.currency === 'coins' && <CoinIcon size={18} />}
                    {confirmProduct.currency === 'gems' && <GemIcon size={18} />}
                    <Text style={styles.modalCostVal}>
                      {confirmProduct.currency === 'try'
                        ? `₺${confirmProduct.price.toFixed(2)}`
                        : `${confirmProduct.price} ${confirmProduct.currency === 'coins' ? 'Altın' : 'Elmas'}`}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalButtonsRow}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => {
                      sound.playSound('tap');
                      setConfirmProduct(null);
                    }}
                  >
                    <Text style={styles.modalCancelText}>İptal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalConfirmBtn}
                    onPress={handleConfirmPurchase}
                  >
                    <Text style={styles.modalConfirmText}>Satın Al</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

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
    paddingHorizontal: 12,
  },
  heroWrap: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  shopTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 28,
    color: '#FFC43D',
    letterSpacing: 1.5,
  },
  shopSub: {
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    color: '#D9CDF5',
    marginTop: 2,
    textAlign: 'center',
  },
  categoryScroll: {
    paddingVertical: 8,
    gap: 8,
  },
  categoryTab: {
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
  categoryTabActive: {
    backgroundColor: 'rgba(107, 60, 255, 0.45)',
    borderColor: '#FFC43D',
  },
  categoryIcon: {
    fontSize: 14,
  },
  categoryName: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  categoryNameActive: {
    color: '#FFFFFF',
  },
  statusBanner: {
    borderRadius: 14,
    padding: 12,
    marginVertical: 10,
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
  statusText: {
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
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  productCard: {
    width: '48.5%',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 12,
    alignItems: 'center',
    position: 'relative',
  },
  productCardOwned: {
    opacity: 0.65,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  badgeRow: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  promoBadge: {
    backgroundColor: '#FF5C77',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  promoBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: THEME.fonts.extraBold,
  },
  bonusBadge: {
    backgroundColor: '#6FE3C1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  bonusBadgeText: {
    color: '#12052C',
    fontSize: 9,
    fontFamily: THEME.fonts.extraBold,
  },
  visualWrap: {
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 8,
  },
  cosmeticCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    backgroundColor: 'rgba(10, 4, 24, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cosmeticIcon: {
    fontSize: 28,
  },
  productName: {
    fontFamily: THEME.fonts.display,
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  productDesc: {
    fontFamily: THEME.fonts.medium,
    fontSize: 10,
    color: '#D9CDF5',
    textAlign: 'center',
    marginVertical: 4,
    minHeight: 28,
  },
  priceBtn: {
    width: '100%',
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  priceBtnActive: {
    backgroundColor: '#FFC43D',
  },
  priceBtnOwned: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  priceContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  priceBtnText: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 13,
    color: '#12052C',
  },
  priceBtnTextOwned: {
    fontFamily: THEME.fonts.bold,
    fontSize: 11,
    color: '#D9CDF5',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 2, 16, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalSheet: {
    backgroundColor: '#1E0E3E',
    borderWidth: 1.5,
    borderColor: '#FFC43D',
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 18,
    color: '#FFC43D',
    marginBottom: 12,
  },
  modalProduct: {
    fontFamily: THEME.fonts.display,
    fontSize: 20,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  modalDesc: {
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    color: '#D9CDF5',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  modalCostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(10, 4, 24, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    marginBottom: 20,
  },
  modalCostLabel: {
    color: '#D9CDF5',
    fontSize: 13,
    fontFamily: THEME.fonts.bold,
  },
  modalCostVal: {
    color: '#FFC43D',
    fontSize: 16,
    fontFamily: THEME.fonts.display,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: THEME.fonts.bold,
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#FFC43D',
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#12052C',
    fontSize: 14,
    fontFamily: THEME.fonts.extraBold,
  },
});
