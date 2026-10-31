import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { UserProfile, InventoryItem } from '@trivia/shared';
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
  KeyIcon,
  GemIcon,
  CoinIcon,
  SpeedBoltIcon,
  StreakFlameIcon,
  HeartIcon,
  GiftIcon,
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
const INV_TABS = ['Tümü', 'Sandıklar', 'Güçlendiriciler'] as const;
export const InventoryScreen: React.FC<InventoryScreenProps> = ({
  user,
  apiBaseUrl,
  onUpdateUser,
  onBack,
  onNavigateSecondary,
  onNotifications,
  onProfile,
}) => {
  const [activeTab, setActiveTab] = useState<string>('Tümü');
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  // Default items if user has none yet (matches 3x3 grid from WhatsApp Image 1)
  const defaultItems: InventoryItem[] = [
    {
      id: 'chest',
      name: 'Ahşap Sandık',
      desc: '1 altın anahtar ile açılır',
      qty: 1,
    },
    {
      id: 'key',
      name: 'Altın Anahtar',
      desc: 'Özel sandıkları açar',
      qty: 2,
    },
    {
      id: 'bolt',
      name: 'Hız Güçlendirici',
      desc: '+150 XP kazandırır',
      qty: 2,
    },
    {
      id: 'crown',
      name: 'Kraliyet Tacı',
      desc: 'Özel profil rozeti',
      qty: 1,
    },
    {
      id: 'heart',
      name: 'Ekstra Can',
      desc: 'Düelloda can koruması',
      qty: 3,
    },
    {
      id: 'gift',
      name: 'Gizemli Kutu',
      desc: 'Sürpriz altın ve elmas verir',
      qty: 1,
    },
    {
      id: 'gem',
      name: 'Elmas Kesesi',
      desc: '+20 Elmas kazandırır',
      qty: 1,
    },
    {
      id: 'coin',
      name: 'Altın Kesesi',
      desc: '+500 Altın kazandırır',
      qty: 1,
    },
    {
      id: 'flame',
      name: 'Seri Kalkanı',
      desc: 'Günlük serini korur',
      qty: 1,
    },
  ];
  const items: InventoryItem[] =
    user?.inventory && user.inventory.length > 0 ? user.inventory : defaultItems;
  // Filter items based on activeTab
  const filteredItems = items.filter((item) => {
    if (activeTab === 'Tümü') return true;
    if (activeTab === 'Sandıklar') {
      return item.id === 'chest' || item.id === 'gift';
    }
    if (activeTab === 'Güçlendiriciler') {
      return item.id !== 'chest' && item.id !== 'gift';
    }
    return true;
  });
  const selectedItem =
    filteredItems[selectedIdx] || filteredItems[0] || items[0];
  const totalQty = items.reduce((acc, it) => acc + (it.qty || 0), 0);
  const renderItemIcon = (id: string, size = 42) => {
    switch (id) {
      case 'chest':
        return <ChestIcon size={size} />;
      case 'key':
        return <KeyIcon size={size} />;
      case 'bolt':
        return <SpeedBoltIcon size={size} />;
      case 'crown':
        return <CrownIcon size={size} />;
      case 'heart':
        return <HeartIcon size={size} />;
      case 'gift':
        return <GiftIcon size={size} />;
      case 'gem':
        return <GemIcon size={size} />;
      case 'coin':
        return <CoinIcon size={size} />;
      default:
        return <StreakFlameIcon size={size} />;
    }
  };
  const handleUseItem = async () => {
    if (!user || !selectedItem) return;
    setStatusMessage(null);
    setIsError(false);
    if (selectedItem.qty <= 0) {
      sound.playSound('wrong');
      sound.triggerHaptic('error');
      setIsError(true);
      setStatusMessage('⚠️ Bu eşyadan envanterinde kalmadı.');
      return;
    }
    // Chest Key Validation Check
    if (selectedItem.id === 'chest') {
      const keyItem = items.find((it) => it.id === 'key');
      const keyCount = keyItem?.qty ?? 0;
      if (keyCount <= 0) {
        sound.playSound('wrong');
        sound.triggerHaptic('error');
        setIsError(true);
        setStatusMessage(
          '⚠️ Altın Anahtarın Yok! Ahşap Sandığı açmak için en az 1 Altın Anahtara ihtiyacın var.'
        );
        return;
      }
    }
    setLoading(true);
    const base = apiBaseUrl || DEFAULT_API_BASE;
    try {
      sound.playSound('tap');
      const res = await fetch(`${base}/social/inventory/use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, itemId: selectedItem.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        sound.playSound('wrong');
        sound.triggerHaptic('error');
        setIsError(true);
        setStatusMessage(data.error || 'Eşya kullanılamadı.');
        return;
      }
      sound.playSound('reward');
      sound.triggerHaptic('success');
      setIsError(false);
      if (data.user && onUpdateUser) {
        onUpdateUser(data.user);
      }
      setStatusMessage(data.rewardText || 'Eşya başarıyla kullanıldı!');
    } catch {
      sound.playSound('wrong');
      setIsError(true);
      setStatusMessage('Sunucu bağlantı hatası.');
    } finally {
      setLoading(false);
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
        <Text style={styles.title}>ENVANTER</Text>
        <Text style={styles.subtitle}>
          Toplam {totalQty} eşya · Veritabanı Kayıtlı
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
        {/* Category Tabs */}
        <View style={styles.tabsRow}>
          {INV_TABS.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tabPill, activeTab === t && styles.tabPillActive]}
              onPress={() => {
                sound.playSound('tap');
                setActiveTab(t);
                setSelectedIdx(0);
              }}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === t && styles.tabTextActive,
                ]}
              >
                {t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* 3x3 Grid Matching WhatsApp Image 1 */}
        <View style={styles.gridWrap}>
          {filteredItems.map((item, idx) => {
            const isSelected =
              selectedItem && selectedItem.id === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.slotCard,
                  isSelected && styles.slotCardSelected,
                ]}
                onPress={() => {
                  sound.playSound('tap');
                  setSelectedIdx(idx);
                }}
                activeOpacity={0.85}
              >
                <View style={styles.slotIconWrap}>
                  {renderItemIcon(item.id, 42)}
                </View>
                <Text style={styles.slotName} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={styles.qtyBadge}>
                  <Text style={styles.qtyText}>x{item.qty}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        {/* Bottom Selected Item Detail Card */}
        {selectedItem && (
          <View style={styles.detailCard}>
            <View style={styles.detailIconCircle}>
              {renderItemIcon(selectedItem.id, 44)}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailTitle}>{selectedItem.name}</Text>
              <Text style={styles.detailSub}>{selectedItem.desc}</Text>
            </View>
            <Button3D
              title={
                loading
                  ? 'AÇILIYOR...'
                  : selectedItem.qty > 0
                  ? 'KULLAN / AÇ'
                  : 'TÜKENDİ'
              }
              variant="mint"
              disabled={loading || selectedItem.qty <= 0}
              onPress={handleUseItem}
              style={{ minHeight: 44, paddingHorizontal: 16 }}
              textStyle={{ fontSize: 13 }}
            />
          </View>
        )}
      </ScrollView>
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
    gap: 8,
    marginBottom: 16,
  },
  tabPill: {
    paddingHorizontal: 18,
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
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
    marginBottom: 16,
  },
  slotCard: {
    width: '31%',
    aspectRatio: 0.95,
    backgroundColor: 'rgba(28, 12, 62, 0.88)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    position: 'relative',
  },
  slotCardSelected: {
    borderColor: '#FFC43D',
    borderWidth: 2,
    backgroundColor: 'rgba(74, 30, 150, 0.55)',
    shadowColor: '#FFC43D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  slotIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
  },
  slotName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    marginTop: 4,
  },
  qtyBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  qtyText: {
    color: '#FFC43D',
    fontSize: 10,
    fontFamily: THEME.fonts.display,
  },
  detailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(32, 14, 70, 0.95)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 196, 61, 0.35)',
    borderRadius: 20,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  detailIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: THEME.fonts.display,
  },
  detailSub: {
    color: '#D9CDF5',
    fontSize: 11.5,
    fontFamily: THEME.fonts.extraBold,
    marginTop: 2,
  },
});