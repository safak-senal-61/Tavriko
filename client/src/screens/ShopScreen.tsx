import React, { useEffect, useState, useRef } from 'react';
import { usePlayerWebLayout } from '../navigation/PlayerWebLayoutContext';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  Modal,
  Platform,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { LoadingShimmer } from '../components/LoadingShimmer';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Circle,
  Path,
} from 'react-native-svg';
import { UserProfile, SHOP_CATALOG, ShopProduct, ShopProductCategory, SHOP_DURATIONS, JOKERS, JokerGroup, isCosmeticProduct, isJokerId, isAdvancedJoker, shopPriceForDuration } from '@trivia/shared';
import { JokerGroupTabs } from '../components/WalletPanels';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { getApiBaseUrl } from '../config';
import { authHeaders } from '../utils/apiAuth';
import {
  TavrikoScreen,
  TavrikoTopBar,
  TavrikoSecondaryBottomNav,
  SecondaryNavTab,
  CoinIcon,
  GemIcon,
  SpeedBoltIcon,
  GiftIcon,
} from '../components/TavrikoIcons';
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
import { RewardedAdCard } from '../components/RewardedAdCard';
import { WalletArtwork } from '../components/WalletArtwork';

interface ShopScreenProps {
  user?: UserProfile;
  apiBaseUrl?: string;
  onUpdateUser?: (updatedUser: UserProfile) => void;
  onBack?: () => void;
  onNavigateSecondary?: (tab: SecondaryNavTab) => void;
  onNotifications?: () => void;
  onProfile?: () => void;
  initialTab?: ShopProductCategory;
  onRefresh?: () => void;
}

interface CategoryTabItem {
  id: ShopProductCategory;
  name: string;
}

const WEB = Platform.OS === 'web';
const SELLABLE_CATALOG = SHOP_CATALOG.filter(p =>WEB || p.currency !== 'try');

const ALL_CATEGORY_TABS: CategoryTabItem[] = [
  { id: 'diamonds', name: 'Elmas' },
  { id: 'gold', name: 'Altın' },
  { id: 'jokers', name: 'Jokerler' },
  { id: 'featured', name: 'Paketler' },
  { id: 'frames', name: 'Çerçeveler' },
  { id: 'name_effects', name: 'İsim Efekti' },
  { id: 'boosters', name: 'Güçlendirici' },
  { id: 'backgrounds', name: 'Arka Plan' },
];
const CATEGORY_TABS = ALL_CATEGORY_TABS.filter((tab) => SELLABLE_CATALOG.some((p) => p.category === tab.id));

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
  const page = usePlayerWebLayout();
  const { width } = useWindowDimensions();
  const art = page?.ui.art ?? 1;
  const size = (base: number) => Math.round(base * art);
  const previewHeight = art > 1 && { height: size(108) };
  const visualSize = size(92);
  if (product.category === 'diamonds' || product.category === 'gold') {
    const tier = SHOP_CATALOG.filter(p => p.category === product.category).findIndex(p => p.id === product.id) + 1;
    return <View style={[styles.visualTall, previewHeight]}><WalletArtwork kind={product.category} size={visualSize} tier={tier} /></View>;
  }
  if (isJokerId(product.id)) {
    return <View style={[styles.visualTall, previewHeight]}><WalletArtwork kind={product.id} size={visualSize} /></View>;
  }
  if ((product.category === 'frames' || pId.includes('frame')) && frameFor(pId)) {
    const frameSize = size(Math.min(124, Math.round(width * 0.34)));
    return (
      <View style={[styles.visualTall, { height: frameSize + 10 }]}>
        <FramedAvatar frameId={pId} seed={seed} size={frameSize} />
      </View>
    );
  }
  // Eski, vektör tabanlı çerçeveler.
  if (ANIMATED_FRAME_COLORS[pId]) {
    return (
      <View style={[styles.visualTall, previewHeight]}>
        <AnimatedFrame frameId={pId} seed={seed} size={size(100)} />
      </View>
    );
  }
  // Arka planlar: önce gerçek üretilmiş görsel (varsa), yoksa animasyonlu sahne
  if ((product.category === 'backgrounds' || pId.startsWith('bg_')) && backgroundFor(pId)) {
    return (
      <View style={[styles.visualTall, previewHeight]}>
        <BackgroundThumb bgId={pId} seed={seed} name={name} width={size(64)} />
      </View>
    );
  }
  // Animasyonlu arka planlar: nefes alan renk katmanları
  if (ANIMATED_BG_LAYERS[pId]) {
    return (
      <View style={[styles.visualTall, previewHeight]}>
        <AnimatedBackgroundThumb bgId={pId} seed={seed} name={name} width={size(64)} />
      </View>
    );
  }
  // Animasyonlu isim efektleri: renk döngüsü
  if (ANIMATED_NAME_COLORS[pId]) {
    return (
      <View style={[styles.visualTall, previewHeight]}>
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
      <View style={[styles.visualTall, previewHeight]}>
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
  const img = pId === 'pack_season_premium_pass' ? STORE_IMG.trophy : storeImageFor(pId, product.category);
  if (img) {
    const tint = RARITY_COLORS[product.rarity || 'common'];
    return (
      <View style={[styles.visualBox, art > 1 && { width: visualSize, height: visualSize, borderRadius: visualSize / 2 }]}>
        <View style={[styles.visualGlow, { backgroundColor: tint }]} />
        <Image source={img} style={[styles.visualImg, art > 1 && { width: visualSize, height: visualSize }]} resizeMode="contain" />
      </View>
    );
  }

  // Çerçeveler
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
          <Text style={styles.frameEmojiInside}>T</Text>
        </Svg>
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
            Tavriko
          </Text>
        </View>
      </View>
    );
  }

  // 6. Güçlendiriciler: 1 saatlik ve 24 saatlik farklı tasarımlar
  if (product.category === 'boosters' || pId.includes('booster')) {
    const is24h = pId.includes('24h');
    return (
      <View style={[styles.visualBox, { borderColor: is24h ? '#A855F7' : '#5ADBB5' }]}>
        <View style={[styles.visualGlow, { backgroundColor: is24h ? 'rgba(168, 85, 247, 0.4)' : 'rgba(90, 219, 181, 0.4)' }]} />
        <SpeedBoltIcon size={44} />
        <View style={styles.boosterTag}>
          <Text style={styles.boosterTagText}>{is24h ? '24H' : '2X'}</Text>
        </View>
        {is24h && (
          <View style={styles.boosterClockWrap}>
            <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <Circle cx="12" cy="12" r="9" stroke="#C084FC" strokeWidth="2" />
              <Path d="M12 7v5l3 2" stroke="#C084FC" strokeWidth="2" strokeLinecap="round" />
            </Svg>
          </View>
        )}
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

  return (
    <View style={styles.visualBox}>
      <GiftIcon size={40} />
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
  initialTab,
  onRefresh,
}) => {
  const page = usePlayerWebLayout();
  const threeProducts = page?.columns === 3;
  const roomy = page?.roomy;
  const [activeTab, setActiveTab] = useState<ShopProductCategory>(initialTab === 'diamonds' && !WEB ? 'gold' : initialTab ?? (WEB ? 'diamonds' : 'gold'));
  const [jokerGroup, setJokerGroup] = useState<JokerGroup | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState<boolean>(false);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [pendingPurchaseName, setPendingPurchaseName] = useState<string | null>(null);
  const purchaseLock = useRef(false);
  const [polarAvailable, setPolarAvailable] = useState(false);
  const [polarSandbox, setPolarSandbox] = useState(false);
  const [jokersAvailable, setJokersAvailable] = useState(false);
  const [advancedJokersAvailable, setAdvancedJokersAvailable] = useState(false);
  const base = apiBaseUrl || getApiBaseUrl();
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${base}/social/shop/jokers/availability`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!controller.signal.aborted) {
          setJokersAvailable(data?.enabled === true);
          setAdvancedJokersAvailable(data?.advanced === true);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [base]);
  useEffect(() => {
    if (!WEB) return;
    const controller = new AbortController();
    void fetch(`${base}/social/shop/diamonds/availability`, { method: 'POST', signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!controller.signal.aborted) { setPolarAvailable(data?.enabled === true); setPolarSandbox(data?.sandbox === true); } })
      .catch(() => {});
    return () => controller.abort();
  }, [base]);
  useEffect(() => {
    if (!WEB || !user || user.isGuest || typeof window === 'undefined') return;
    const address = new URL(window.location.href);
    const checkout = address.searchParams.get('gem_checkout');
    if (!checkout || !/^[a-f0-9-]{36}$/i.test(checkout)) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    setStatusMessage('Ödemen doğrulanıyor. Elmaslar doğrulamadan sonra bakiyene eklenir.');
    const check = async () => {
      attempts += 1;
      try {
        const result = await fetch(`${base}/social/shop/diamonds/checkout/${checkout}`, { headers: authHeaders(), signal: controller.signal });
        if (controller.signal.aborted) return;
        if (result.ok) {
          const { status } = await result.json();
          if (controller.signal.aborted) return;
          if (status === 'paid' || status === 'refunded') {
            address.searchParams.delete('gem_checkout');
            window.history.replaceState(window.history.state, '', address);
            setStatusMessage(status === 'paid' ? 'Ödemen doğrulandı. Elmas bakiyen güncellendi.' : 'Bu ödeme iade edildi.');
            onRefresh?.();
            return;
          }
        }
      } catch {}
      if (!controller.signal.aborted && attempts < 8) timer = setTimeout(check, 2200);
    };
    void check();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [base, user?.id, user?.isGuest, onRefresh]);
  const [confirmProduct, setConfirmProduct] = useState<ShopProduct | null>(null);
  // Süreli kozmetikler için seçilen süre (1 saat - 30 gün); fiyatı ölçekler
  const [durationId, setDurationId] = useState<string>('1h');
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

  const filteredProducts = SELLABLE_CATALOG.filter(p => p.category === activeTab &&
    (advancedJokersAvailable || !isJokerId(p.id) || !isAdvancedJoker(p.id)) &&
    (activeTab !== 'jokers' || !jokerGroup || JOKERS.some(joker => joker.id === p.id && joker.group === jokerGroup)));

  // 2x XP artırıcı aktif mi? Kalan süre (ms) yoksa null.
  const boosterExp = user?.activeBoosterExpiresAt ?? 0;
  const boosterRemainingMs = boosterExp >Date.now() ? boosterExp - Date.now() : null;

  const isProductOwned = (product: ShopProduct): boolean => {
    if (!user) return false;
    if (product.grantPremiumPass && user.hasPremiumPass) return true;
    if (product.category === 'frames' && user.inventory?.some((i) => i.id === product.id)) return true;
    if (product.category === 'name_effects' && user.inventory?.some((i) => i.id === product.id)) return true;
    if (product.category === 'backgrounds' && user.inventory?.some((i) => i.id === product.id)) return true;
    return false;
  };

  const handleInitiatePurchase = async (product: ShopProduct) => {
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
      if (!WEB || !polarAvailable || user.isGuest || purchaseLock.current) return;
      purchaseLock.current = true;
      setPurchasingId(product.id);
      setStatusMessage(null);
      try {
        const response = await fetch(`${base}/social/shop/diamonds/checkout`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ productId: product.id }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Ödeme sayfası açılamadı.');
        const url = new URL(data.url);
        const allowedOrigins = polarSandbox ? ['https://sandbox.polar.sh'] : ['https://polar.sh', 'https://buy.polar.sh'];
        if (!allowedOrigins.includes(url.origin) ||
            !url.pathname.startsWith('/checkout/') || url.username || url.password) throw new Error('Ödeme adresi doğrulanamadı.');
        window.location.assign(url.href);
      } catch (error) {
        setIsError(true);
        setStatusMessage(error instanceof Error ? error.message : 'Ödeme sayfası açılamadı.');
      } finally {
        purchaseLock.current = false;
        setPurchasingId(null);
      }
      return;
    }

    // Para bakiyesi kontrolü (süreli kozmetiklerde seçilen sürenin fiyatı)
    const price = shopPriceForDuration(product, durationId);
    if (product.currency === 'coins' && (user.coins ?? 0) < price) {
      sound.playSound('wrong');
      sound.triggerHaptic('error');
      setIsError(true);
      setStatusMessage(`Yetersiz altın. Bu ürün için ${price} altın gerekli.`);
      return;
    }

    if (product.currency === 'gems' && (user.gems ?? 0) < price) {
      sound.playSound('wrong');
      sound.triggerHaptic('error');
      setIsError(true);
      setStatusMessage(`Yetersiz elmas. Bu ürün için ${price} elmas gerekli.`);
      return;
    }

    setConfirmProduct(product);
  };

  const handleConfirmPurchase = async () => {
    if (!confirmProduct || confirmProduct.currency === 'try' || !user || purchaseLock.current) return;
    purchaseLock.current = true;
    const product = confirmProduct;
    setConfirmProduct(null);
    setPurchasingId(product.id);
    setPendingPurchaseName(product.name);
    setStatusMessage(null);
    setIsError(false);

    const base = apiBaseUrl || getApiBaseUrl();
    const authorization = authHeaders();
    try {
      const res = await fetch(`${base}/social/shop/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authorization },
        body: JSON.stringify({
          productId: product.id,
          // Süreli kozmetiklerde seçilen süre sunucuya gönderilir
          durationId: isCosmeticProduct(product) ? durationId : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        sound.playSound('wrong');
        sound.triggerHaptic('error');
        setIsError(true);
        setStatusMessage(data.error || 'Satın alma başarısız oldu.');
        return;
      }

      sound.playSound('reward');
      sound.triggerHaptic('success');
      setIsError(false);
      setStatusMessage(data.message || `${product.name} başarıyla satın alındı ve envantere eklendi!`);
      if (data.user?.id === user.id && authHeaders().Authorization === authorization.Authorization && onUpdateUser) {
        onUpdateUser(data.user);
      }
    } catch (err: any) {
      sound.playSound('wrong');
      setIsError(true);
      setStatusMessage('Bağlantı hatası oluştu.');
    } finally {
      purchaseLock.current = false;
      setPurchasingId(null);
      setPendingPurchaseName(null);
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
        <KitHeader title="Mağaza" subtitle="Kozmetikler ve güçlendiriciler" />
        <KitChips
          tabs={CATEGORY_TABS.filter(c => c.id !== 'jokers' || jokersAvailable).map((c) => ({ id: c.id, label: c.name }))}
          active={activeTab}
          onChange={(id, idx) => handleSelectCategoryTab(id, idx)}
          scrollRef={tabScrollRef}
        />
        {(activeTab === 'diamonds' || activeTab === 'gold' || activeTab === 'jokers') ? <View style={styles.walletSection}>
          <WalletArtwork kind={activeTab === 'jokers' ? 'joker_half' : activeTab} size={74} tier={2} />
          <View style={styles.walletSummary}>
            <Text accessibilityRole="header" style={styles.walletTitle}>{activeTab === 'diamonds' ? 'Elmas paketleri' : activeTab === 'gold' ? 'Altın paketleri' : 'Quiz jokerleri'}</Text>
            <Text style={styles.walletDescription}>{activeTab === 'diamonds'
              ? polarSandbox ? 'Polar test ortamı. Gerçek ödeme yapma.' : polarAvailable ? 'Tek seferlik, güvenli Polar ödemesi.' : 'Elmas paketlerinin ödemesi henüz kullanıma açık değil.'
              : activeTab === 'gold' ? 'Quiz oynayarak altın kazan veya elmasla paket al.' : 'Altınla al. Her jokerin kullanılabildiği maç türü kartında yazıyor.'}</Text>
          </View>
        </View> : <><KitHero
          art={STORE_IMG.trophy}
          artSize={110}
          eyebrow="TAVRİKO MAĞAZASI"
          title="Profilini özelleştir"
          subtitle="Çerçeveler, arka planlar ve isim efektleri."
          height={145}
        />

        <RewardedAdCard
          user={user}
          apiBaseUrl={apiBaseUrl}
          onUpdateUser={onUpdateUser}
          onMessage={(message, error) => {
            setIsError(error);
            setStatusMessage(message);
          }}
        />

        </>}

        {/* Durum Bildirimi */}
        {pendingPurchaseName && (
          <View style={styles.purchasePending} accessibilityLiveRegion="polite" accessibilityState={{ busy: true }}>
            <ActivityIndicator size="small" color="#FFE0A9" />
            <Text style={styles.walletDescription}>{pendingPurchaseName}: Satın alma işleniyor…</Text>
          </View>
        )}
        {statusMessage && (
          <View style={[styles.statusBanner, isError ? styles.statusError : styles.statusSuccess]}>
            <Text style={[styles.statusText, isError ? styles.statusTextError : styles.statusTextSuccess]}>
              {statusMessage}
            </Text>
          </View>
        )}

        {activeTab === 'jokers' && <JokerGroupTabs selected={jokerGroup} onChange={setJokerGroup} />}
        {/* Ürün Izgarası (Yumuşak Sekme Geçiş Animasyonu ile) */}
        <Animated.View
          style={[
            styles.productGrid,
            threeProducts && styles.webProductGrid,
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
                style={[styles.productCard, threeProducts && styles.webProductCard, owned && styles.productCardOwned]}
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
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name} önizlemesini aç`}
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
                <Text style={[styles.productName, roomy && { fontSize: 17 }]} numberOfLines={roomy || item.category === 'frames' ? 2 : 1}>{item.name}</Text>
                <Text style={[styles.productDesc, roomy && { fontSize: 13, lineHeight: 18 }]} numberOfLines={item.category === 'jokers' ? undefined : 2}>{item.desc}</Text>

                {/* 2x XP Artırıcı Aktifse: Kalan Süre Barı */}
                {(item.category === 'boosters' || item.id.includes('booster')) &&
                  boosterRemainingMs !== null &&
                  (() => {
                    const totalMs = item.id.includes('24h') ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
                    const pct = Math.max(2, Math.min(100, (boosterRemainingMs / totalMs) * 100));
                    const totalMin = Math.max(1, Math.round(boosterRemainingMs / 60000));
                    const remainingLabel =
                      totalMin >= 60
                        ? `${Math.floor(totalMin / 60)} sa ${totalMin % 60} dk`
                        : `${totalMin} dk`;
                    return (
                      <View style={styles.boosterTimerWrap}>
                        <View style={styles.boosterTimerTrack}>
                          <View style={[styles.boosterTimerFill, { width: `${pct}%` }]} />
                        </View>
                        <Text style={styles.boosterTimerText}>Aktif — kalan süre: {remainingLabel}</Text>
                      </View>
                    );
                  })()}

                {/* Fiyat Butonu (Tavriko Altın/Elmas Butonu) */}
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`Satın al: ${item.name}`}
                  style={[
                    styles.priceBtn,
                    roomy && styles.webPriceButton,
                    owned || (item.currency === 'try' && !polarAvailable) ? styles.priceBtnOwned : styles.priceBtnActive,
                  ]}
                  disabled={owned || purchasingId !== null || (item.currency === 'try' && !polarAvailable)}
                  activeOpacity={0.8}
                  onPress={() => handleInitiatePurchase(item)}
                >
                  {isBuying ? (
                    <LoadingShimmer label="Satın alma işleniyor" ink />
                  ) : owned ? (
                    <Text style={styles.priceBtnTextOwned}>SAHİPSİN</Text>
                  ) : item.currency === 'try' ? (
                    <Text style={polarAvailable ? styles.priceBtnText : styles.priceBtnTextOwned}>{item.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺{polarAvailable ? ' · Satın al' : ''}</Text>
                  ) : (
                    <View style={styles.priceContentRow}>
                      <Text style={styles.priceBtnText}>
                        {item.price}{item.category === 'jokers' ? ' Altın' : ''}
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
                {isJokerId(confirmProduct.id) && (
                  <WalletArtwork kind={confirmProduct.id} size={64} />
                )}
                <Text style={styles.modalProduct}>{confirmProduct.name}</Text>
                <Text style={styles.modalDesc}>{confirmProduct.desc}</Text>

                {/* Süre seçimi: kozmetiklerde 1 saatten 1 aya kadar seçilir,
                    fiyat seçilen süreye göre ölçeklenir */}
                {isCosmeticProduct(confirmProduct) && (
                  <View style={styles.durationWrap}>
                    <Text style={styles.durationTitle}>SÜRE SEÇ</Text>
                    <View style={styles.durationChips}>
                      {SHOP_DURATIONS.map((d) => {
                        const active = durationId === d.id;
                        return (
                          <TouchableOpacity
                            key={d.id}
                            style={[styles.durationChip, active && styles.durationChipActive]}
                            onPress={() => {
                              sound.playSound('tap');
                              sound.triggerHaptic('light');
                              setDurationId(d.id);
                            }}
                            activeOpacity={0.85}
                          >
                            <Text style={[styles.durationChipText, active && styles.durationChipTextActive]}>
                              {d.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                <View style={styles.modalCostRow}>
                  <Text style={styles.modalCostLabel}>Fiyat:</Text>
                  <View style={styles.priceContentRow}>
                    <Text style={styles.modalCostVal}>
                      {confirmProduct.currency === 'try'
                        ? `₺${confirmProduct.price.toFixed(2)}`
                        : `${shopPriceForDuration(confirmProduct, durationId)} ${confirmProduct.currency === 'coins' ? 'Altın' : 'Elmas'}`}
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
  purchasePending: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, marginBottom: 12 },
  walletSection: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: '#5D4A77', backgroundColor: '#251B3B', padding: 10, marginBottom: 16 },
  walletSummary: { flex: 1, gap: 4, paddingRight: 8 },
  walletTitle: { fontFamily: THEME.fonts.extraBold, color: '#FFE0A9', fontSize: 19 },
  walletDescription: { fontFamily: THEME.fonts.bold, color: '#D9C9E9', fontSize: 13, lineHeight: 19 },
  scrollContent: {
    paddingBottom: Platform.OS === 'web' ? 20 : 160,
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
  webProductGrid: { justifyContent: 'flex-start' },
  webProductCard: { width: '32%' },
  webPriceButton: { minHeight: 46, width: '100%' },
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
  boosterClockWrap: {
    position: 'absolute',
    bottom: -4,
    left: -4,
    backgroundColor: '#2A0F63',
    borderRadius: 9,
    padding: 2,
  },
  boosterTimerWrap: {
    marginTop: 8,
    marginBottom: 2,
    width: '100%',
  },
  boosterTimerTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(90, 219, 181, 0.15)',
    overflow: 'hidden',
  },
  boosterTimerFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#5ADBB5',
  },
  boosterTimerText: {
    marginTop: 4,
    color: '#5ADBB5',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
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
  durationWrap: {
    marginBottom: 12,
  },
  durationTitle: {
    color: '#CBB8E8',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    letterSpacing: 1,
    marginBottom: 6,
    textAlign: 'center',
  },
  durationChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  durationChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(197, 165, 245, 0.35)',
    backgroundColor: 'rgba(52, 34, 78, 0.6)',
  },
  durationChipActive: {
    borderColor: '#FFC837',
    backgroundColor: 'rgba(255, 200, 55, 0.18)',
  },
  durationChipText: {
    color: '#E9DDFB',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
  },
  durationChipTextActive: {
    color: '#FFC837',
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
