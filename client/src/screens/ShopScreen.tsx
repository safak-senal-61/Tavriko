import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Platform,
  Animated,
} from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Circle,
  Path,
} from 'react-native-svg';
import { UserProfile, SHOP_CATALOG, ShopProduct, ShopProductCategory } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { getApiBaseUrl } from '../config';
import { authHeaders } from '../utils/apiAuth';
import {
  TavrikoScreen,
  TavrikoTopBar,
  TavrikoSecondaryBottomNav,
  SecondaryNavTab,
  ChestIcon,
  CoinIcon,
  GemIcon,
  KeyIcon,
  BadgeShieldIcon,
  SpeedBoltIcon,
  CrownIcon,
} from '../components/TavrikoIcons';
import { PaymentItem } from './PaymentScreen';
import Reanimated, { FadeInDown } from 'react-native-reanimated';
import { Image } from 'react-native';
import {
  KitHeader,
  KitHero,
  KitChips,
  STORE_IMG,
  storeImageFor,
  KIT,
  FramedAvatar,
  BackgroundThumb,
  AnimatedFrame,
  AnimatedBackgroundThumb,
  AnimatedNameText,
  ANIMATED_FRAME_COLORS,
  ANIMATED_BG_LAYERS,
  ANIMATED_NAME_COLORS,
  CosmeticPreviewModal,
  frameFor,
  backgroundFor,
} from '../components/StoreKit';

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

// Tavriko UI Kit 7 Mağaza Alt Sayfası + Öne Çıkanlar
const CATEGORY_TABS: CategoryTabItem[] = [
  { id: 'featured', name: 'Paketler', icon: '🎁' },
  { id: 'chests', name: 'Sandıklar', icon: '📦' },
  { id: 'keys', name: 'Anahtarlar', icon: '🗝️' },
  { id: 'frames', name: 'Çerçeveler', icon: '🖼️' },
  { id: 'badges', name: 'Rozetler', icon: '🎖️' },
  { id: 'name_effects', name: 'İsim Efekti', icon: '✨' },
  { id: 'boosters', name: 'Güçlendirici', icon: '⚡' },
  { id: 'backgrounds', name: 'Arka Plan', icon: '🌌' },
  { id: 'diamonds', name: 'Elmas', icon: '💎' },
  { id: 'gold', name: 'Altın', icon: '🪙' },
];

const FEATURED_CHEST = SHOP_CATALOG.find((p) => p.id === 'chest_legendary');

const RARITY_COLORS: Record<string, string> = {
  common: '#8A7BAF',
  rare: '#3B82F6',
  epic: '#A855F7',
  legendary: '#F59E0B',
  mythic: '#FF416C',
};

// UI Kit Birebir Vektörel Ürün Görseli
const ShopItemVisual: React.FC<{ product: ShopProduct; seed?: string; name?: string }> = ({
  product,
  seed,
  name,
}) => {
  const pId = product.id;
  // Animasyonlu çerçeveler: renkli geçişli pulse halkaları
  if (ANIMATED_FRAME_COLORS[pId]) {
    return (
      <View style={styles.visualTall}>
        <AnimatedFrame frameId={pId} seed={seed} size={100} />
      </View>
    );
  }
  if ((product.category === 'frames' || pId.includes('frame')) && frameFor(pId)) {
    return (
      <View style={styles.visualTall}>
        <FramedAvatar frameId={pId} seed={seed} size={100} />
      </View>
    );
  }
  // Animasyonlu arka planlar: nefes alan renk katmanları
  if (ANIMATED_BG_LAYERS[pId]) {
    return (
      <View style={styles.visualTall}>
        <AnimatedBackgroundThumb bgId={pId} seed={seed} name={name} width={64} />
      </View>
    );
  }
  if ((product.category === 'backgrounds' || pId.startsWith('bg_')) && backgroundFor(pId)) {
    return (
      <View style={styles.visualTall}>
        <BackgroundThumb bgId={pId} seed={seed} name={name} width={64} />
      </View>
    );
  }
  // Animasyonlu isim efektleri: renk döngüsü
  if (ANIMATED_NAME_COLORS[pId]) {
    return (
      <View style={styles.visualTall}>
        <View style={styles.namePlate}>
          <AnimatedNameText effectId={pId} style={styles.namePlateText} numberOfLines={1}>
            {name || 'Tavriko'}
          </AnimatedNameText>
        </View>
      </View>
    );
  }
  if ((product.category as string) === 'name_effects' || pId.includes('name_') || pId.includes('effect')) {
    const isFire = pId.includes('fire');
    return (
      <View style={styles.visualTall}>
        <View style={styles.namePlate}>
          <Text
            style={[styles.namePlateText, isFire ? styles.nameEffectFire : styles.nameEffectGold]}
            numberOfLines={1}
          >
            {name || 'Tavriko'}
          </Text>
        </View>
      </View>
    );
  }
  const featuredImg: Record<string, any> = {
    pack_season_premium_pass: STORE_IMG.trophy,
    pack_starter: STORE_IMG.chestGold,
    pack_mega_bundle: STORE_IMG.chestLegendary,
  };
  const img = featuredImg[pId] || storeImageFor(pId, product.category);
  if (img) {
    const tint = RARITY_COLORS[product.rarity || 'common'];
    return (
      <View style={styles.visualBox}>
        <View style={[styles.visualGlow, { backgroundColor: tint }]} />
        <Image source={img} style={styles.visualImg} resizeMode="contain" />
      </View>
    );
  }

  // 1. Sandıklar
  if (product.category === 'chests' || pId.includes('chest')) {
    let tint = '#8B5A2B'; // Wood
    if (pId === 'chest_silver') tint = '#94A3B8';
    if (pId === 'chest_gold') tint = '#F59E0B';
    if (pId === 'chest_legendary') tint = '#A855F7';

    return (
      <View style={[styles.visualBox, { borderColor: tint }]}>
        <ChestIcon size={56} />
      </View>
    );
  }

  // 2. Anahtarlar
  if (product.category === 'keys' || pId.includes('key')) {
    let keyColor = '#94A3B8';
    if (pId === 'key_gold') keyColor = '#F59E0B';
    if (pId === 'key_diamond') keyColor = '#00F0FF';

    return (
      <View style={[styles.visualBox, { borderColor: keyColor }]}>
        <Svg width="54" height="54" viewBox="0 0 24 24" fill="none">
          <Circle cx="8" cy="8" r="5" stroke={keyColor} strokeWidth="2.5" />
          <Circle cx="8" cy="8" r="2" fill={keyColor} />
          <Path
            d="M12 12L20 20M17 17L19 15M15 19L17 17"
            stroke={keyColor}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </Svg>
      </View>
    );
  }

  // 3. Çerçeveler
  if (product.category === 'frames' || pId.includes('frame')) {
    return (
      <View style={styles.visualBox}>
        <Svg width="56" height="56" viewBox="0 0 56 56">
          <Defs>
            <LinearGradient id="frameGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={pId === 'frame_flame' ? '#FF416C' : pId === 'frame_royal_gold' ? '#FFE27A' : '#00F0FF'} />
              <Stop offset="1" stopColor={pId === 'frame_flame' ? '#FF9B2F' : pId === 'frame_royal_gold' ? '#FF8800' : '#FF007F'} />
            </LinearGradient>
          </Defs>
          <Circle cx="28" cy="28" r="22" stroke="url(#frameGrad)" strokeWidth="4" fill="rgba(19, 9, 38, 0.8)" />
          <Circle cx="28" cy="28" r="16" fill="rgba(255, 255, 255, 0.1)" />
          <Text style={styles.frameEmojiInside}>👤</Text>
        </Svg>
      </View>
    );
  }

  // 4. Rozetler
  if (product.category === 'badges' || pId.includes('badge')) {
    return (
      <View style={styles.visualBox}>
        <BadgeShieldIcon size={48} />
      </View>
    );
  }

  // 5. İsim Efekti
  if (product.category === 'name_effects' || pId.includes('effect')) {
    const isFire = pId === 'effect_fire_glow';
    return (
      <View style={[styles.visualBox, { borderColor: isFire ? '#FF9B2F' : '#FFC837' }]}>
        <View style={styles.nameEffectPreview}>
          <Text style={[styles.nameEffectText, isFire ? styles.nameEffectFire : styles.nameEffectGold]}>
            Tavriko {isFire ? '🔥' : '✨'}
          </Text>
        </View>
      </View>
    );
  }

  // 6. Güçlendiriciler
  if (product.category === 'boosters' || pId.includes('booster')) {
    return (
      <View style={[styles.visualBox, { borderColor: '#5ADBB5' }]}>
        <SpeedBoltIcon size={46} />
        <View style={styles.boosterTag}>
          <Text style={styles.boosterTagText}>2X</Text>
        </View>
      </View>
    );
  }

  // 7. Arka Plan
  if (product.category === 'backgrounds' || pId.includes('bg_')) {
    const isRoyal = pId === 'bg_royal_square';
    return (
      <View style={[styles.visualBox, { borderColor: isRoyal ? '#F59E0B' : '#A855F7' }]}>
        <Svg width="54" height="42" viewBox="0 0 54 42">
          <Defs>
            <LinearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={isRoyal ? '#3A0E63' : '#1A0B3B'} />
              <Stop offset="1" stopColor={isRoyal ? '#16042B' : '#4C1D95'} />
            </LinearGradient>
          </Defs>
          <Rect width="54" height="42" rx="8" fill="url(#bgGrad)" stroke="#5ADBB5" strokeWidth="1" />
          <Circle cx="27" cy="21" r="10" fill={isRoyal ? 'rgba(255, 200, 55, 0.2)' : 'rgba(0, 240, 255, 0.2)'} />
        </Svg>
      </View>
    );
  }

  // Elmas / Altın
  if (product.category === 'diamonds') {
    return (
      <View style={styles.visualBox}>
        <GemIcon size={48} />
      </View>
    );
  }

  if (product.category === 'gold') {
    return (
      <View style={styles.visualBox}>
        <CoinIcon size={48} />
      </View>
    );
  }

  return (
    <View style={styles.visualBox}>
      <Text style={styles.fallbackVisualEmoji}>🎁</Text>
    </View>
  );
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
  const [activeTab, setActiveTab] = useState<ShopProductCategory>('chests');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState<boolean>(false);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [confirmProduct, setConfirmProduct] = useState<ShopProduct | null>(null);
  const [previewProduct, setPreviewProduct] = useState<ShopProduct | null>(null);
  const previewKind = (p: ShopProduct | null): 'frame' | 'background' | 'name' | null => {
    if (!p) return null;
    if ((p.category === 'frames' || p.id.includes('frame')) && (frameFor(p.id) || ANIMATED_FRAME_COLORS[p.id])) return 'frame';
    if ((p.category === 'backgrounds' || p.id.startsWith('bg_')) && (backgroundFor(p.id) || ANIMATED_BG_LAYERS[p.id])) return 'background';
    if (p.category === 'name_effects' || p.id.includes('name_')) return 'name';
    return null;
  };
  const userSeed = user?.avatarUrl || user?.displayName;
  const tabScrollRef = useRef<any>(null);
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentTranslateX = useRef(new Animated.Value(0)).current;

  const handleSelectCategoryTab = (catId: ShopProductCategory, idx: number) => {
    if (catId === activeTab) return;
    const prevIdx = CATEGORY_TABS.findIndex((c) => c.id === activeTab);
    const direction = idx >= prevIdx ? 14 : -14;
    sound.playSound('tap');
    sound.triggerHaptic('light');
    setStatusMessage(null);
    const targetX = idx <= 1 ? 0 : Math.max(0, (idx - 1) * 105);
    tabScrollRef.current?.scrollTo({
      x: targetX,
      animated: true,
    });
    contentOpacity.setValue(0.25);
    contentTranslateX.setValue(direction);
    setActiveTab(catId);
    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 210,
        useNativeDriver: true,
      }),
      Animated.spring(contentTranslateX, {
        toValue: 0,
        damping: 18,
        stiffness: 180,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const filteredProducts = SHOP_CATALOG.filter((p) => p.category === activeTab);

  const isProductOwned = (product: ShopProduct): boolean => {
    if (!user) return false;
    if (product.grantPremiumPass && user.hasPremiumPass) return true;
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
          subtitle: product.desc,
          price: `₺${product.price.toFixed(2)}`,
          priceNumeric: product.price,
        });
      } else {
        setConfirmProduct(product);
      }
      return;
    }

    // Para bakiyesi kontrolü
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

    const base = apiBaseUrl || getApiBaseUrl();
    try {
      const res = await fetch(`${base}/social/shop/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
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
      setStatusMessage(data.message || `${product.name} başarıyla satın alındı ve envantere eklendi!`);
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
        {/* Başlık */}
        <KitHeader title="Mağaza" subtitle="Sandık, anahtar ve kozmetikler" />
        <KitHero
          art={STORE_IMG.chestLegendary}
          artSize={124}
          eyebrow="ÖNE ÇIKAN"
          title={FEATURED_CHEST?.name || 'Efsanevi Sandık'}
          subtitle={FEATURED_CHEST?.desc?.split('.')[0]}
          height={150}
        >
          <TouchableOpacity
            style={styles.heroCta}
            activeOpacity={0.85}
            onPress={() => handleSelectCategoryTab('chests', 1)}
          >
            <Text style={styles.heroCtaText}>Sandıklara bak</Text>
          </TouchableOpacity>
        </KitHero>

        <KitChips
          tabs={CATEGORY_TABS.map((c) => ({ id: c.id, label: c.name }))}
          active={activeTab}
          onChange={(id, idx) => handleSelectCategoryTab(id, idx)}
          scrollRef={tabScrollRef}
        />

        {/* Durum Bildirimi */}
        {statusMessage && (
          <View style={[styles.statusBanner, isError ? styles.statusError : styles.statusSuccess]}>
            <Text style={[styles.statusText, isError ? styles.statusTextError : styles.statusTextSuccess]}>
              {statusMessage}
            </Text>
          </View>
        )}

        {/* Ürün Izgarası (Yumuşak Sekme Geçiş Animasyonu ile) */}
        <Animated.View
          style={[
            styles.productGrid,
            {
              opacity: contentOpacity,
              transform: [{ translateX: contentTranslateX }],
            },
          ]}
        >
          {filteredProducts.map((item, index) => {
            const owned = isProductOwned(item);
            const rarityColor = RARITY_COLORS[item.rarity || 'common'];
            const isBuying = purchasingId === item.id;

            return (
              <Reanimated.View
                key={`${activeTab}-${item.id}`}
                entering={FadeInDown.delay(Math.min(index, 8) * 55).duration(360)}
                style={[styles.productCard, owned && styles.productCardOwned]}
              >
                <View style={[styles.rarityBar, { backgroundColor: rarityColor }]} />
                {/* Rozetler */}
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

                {/* Vektörel Görsel */}
                {previewKind(item) ? (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => {
                      sound.playSound('tap');
                      setPreviewProduct(item);
                    }}
                  >
                    <ShopItemVisual product={item} seed={userSeed} name={user?.displayName} />
                    <View style={styles.zoomHint}>
                      <Text style={styles.zoomHintText}>Büyüt</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <ShopItemVisual product={item} seed={userSeed} name={user?.displayName} />
                )}

                {/* İsim & Açıklama */}
                <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.productDesc} numberOfLines={2}>{item.desc}</Text>

                {/* Fiyat Butonu (Tavriko Altın/Elmas Butonu) */}
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
                      <Text style={styles.priceBtnText}>
                        {item.currency === 'try' ? `₺${item.price.toFixed(2)}` : item.price}
                      </Text>
                      {item.currency === 'coins' && <CoinIcon size={16} />}
                      {item.currency === 'gems' && <GemIcon size={16} />}
                    </View>
                  )}
                </TouchableOpacity>
              </Reanimated.View>
            );
          })}
        </Animated.View>
      </ScrollView>

      <CosmeticPreviewModal
        visible={!!previewProduct}
        kind={previewKind(previewProduct)}
        itemId={previewProduct?.id || ''}
        title={previewProduct?.name || ''}
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
        onClose={() => setPreviewProduct(null)}
        actionLabel={previewProduct && !isProductOwned(previewProduct) ? 'Satın al' : undefined}
        onAction={() => {
          const p = previewProduct;
          setPreviewProduct(null);
          if (p) handleInitiatePurchase(p);
        }}
      />

      {/* Satın Alma Onay Modalı */}
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
                    <Text style={styles.modalCostVal}>
                      {confirmProduct.currency === 'try'
                        ? `₺${confirmProduct.price.toFixed(2)}`
                        : `${confirmProduct.price} ${confirmProduct.currency === 'coins' ? 'Altın' : 'Elmas'}`}
                    </Text>
                    {confirmProduct.currency === 'coins' && <CoinIcon size={18} />}
                    {confirmProduct.currency === 'gems' && <GemIcon size={18} />}
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
    paddingBottom: 160,
    paddingHorizontal: 4,
  },
  heroWrap: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 8,
  },
  shopTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 26,
    color: '#FFC837',
    letterSpacing: 2,
  },
  categoryScrollWrap: {
    marginHorizontal: -16,
  },
  categoryScroll: {
    paddingHorizontal: 16,
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
    backgroundColor: '#1E0E3D',
    borderWidth: 1.5,
    borderColor: 'rgba(154, 107, 255, 0.25)',
  },
  categoryTabActive: {
    backgroundColor: 'rgba(107, 60, 255, 0.45)',
    borderColor: '#FFC837',
  },
  categoryIcon: {
    fontSize: 14,
  },
  categoryName: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
  },
  categoryNameActive: {
    color: '#FFFFFF',
  },
  statusBanner: {
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginVertical: 8,
    alignItems: 'center',
  },
  statusSuccess: {
    backgroundColor: 'rgba(90, 219, 181, 0.2)',
    borderWidth: 1,
    borderColor: '#5ADBB5',
  },
  statusError: {
    backgroundColor: 'rgba(255, 65, 108, 0.2)',
    borderWidth: 1,
    borderColor: '#FF416C',
  },
  statusText: {
    fontSize: 13,
    fontFamily: THEME.fonts.bold,
  },
  statusTextSuccess: {
    color: '#5ADBB5',
  },
  statusTextError: {
    color: '#FF416C',
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
    marginTop: 8,
  },
  productCard: {
    width: '48%',
    backgroundColor: KIT.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: KIT.border,
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    marginBottom: 4,
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
      },
    }),
  },
  productCardOwned: {
    opacity: 0.65,
  },
  badgeRow: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  promoBadge: {
    backgroundColor: '#FF416C',
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
    backgroundColor: '#FFC837',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  bonusBadgeText: {
    color: '#12052C',
    fontSize: 9,
    fontFamily: THEME.fonts.extraBold,
  },
  visualBox: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    position: 'relative',
  },
  visualTall: {
    height: 108,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  zoomHint: {
    position: 'absolute',
    right: -6,
    bottom: 4,
    paddingHorizontal: 7,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 4, 30, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  zoomHintText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontFamily: THEME.fonts.extraBold,
  },
  namePlate: {
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 4, 30, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    maxWidth: 150,
  },
  namePlateText: {
    fontSize: 17,
    fontFamily: THEME.fonts.black,
  },
  visualGlow: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    opacity: 0.22,
  },
  visualImg: {
    width: 92,
    height: 92,
  },
  rarityBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    opacity: 0.9,
  },
  heroCta: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: KIT.gold,
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 11,
    justifyContent: 'center',
  },
  heroCtaText: {
    color: '#1A0B3B',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  frameEmojiInside: {
    position: 'absolute',
    fontSize: 20,
    alignSelf: 'center',
    top: 14,
  },
  nameEffectPreview: {
    paddingHorizontal: 6,
  },
  nameEffectText: {
    fontSize: 11,
    fontFamily: THEME.fonts.display,
  },
  nameEffectGold: {
    color: '#FFD970',
    textShadowColor: 'rgba(255, 200, 55, 0.85)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  nameEffectFire: {
    color: '#FF8A3D',
    textShadowColor: 'rgba(255, 65, 30, 0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  boosterTag: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: '#FF416C',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  boosterTagText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  fallbackVisualEmoji: {
    fontSize: 32,
  },
  productName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    marginTop: 4,
  },
  productDesc: {
    color: KIT.muted,
    fontSize: 11,
    fontFamily: THEME.fonts.medium,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 8,
    minHeight: 26,
  },
  priceBtn: {
    width: '100%',
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceBtnActive: {
    backgroundColor: '#FFC837',
  },
  priceBtnOwned: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  priceContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priceBtnText: {
    color: '#12052C',
    fontSize: 13,
    fontFamily: THEME.fonts.display,
  },
  priceBtnTextOwned: {
    color: '#8A7BAF',
    fontSize: 11,
    fontFamily: THEME.fonts.bold,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(9, 4, 24, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalSheet: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#1E0E3D',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FFC837',
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: THEME.fonts.display,
    color: '#FFC837',
    letterSpacing: 1,
    marginBottom: 8,
  },
  modalProduct: {
    fontSize: 15,
    fontFamily: THEME.fonts.bold,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  modalDesc: {
    fontSize: 12,
    fontFamily: THEME.fonts.medium,
    color: '#9A8BC2',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  modalCostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
  },
  modalCostLabel: {
    color: '#D9CDF5',
    fontSize: 13,
    fontFamily: THEME.fonts.bold,
  },
  modalCostVal: {
    color: '#FFC837',
    fontSize: 14,
    fontFamily: THEME.fonts.bold,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    color: '#D9CDF5',
    fontSize: 13,
    fontFamily: THEME.fonts.bold,
  },
  modalConfirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFC837',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    color: '#12052C',
    fontSize: 13,
    fontFamily: THEME.fonts.display,
  },
});
