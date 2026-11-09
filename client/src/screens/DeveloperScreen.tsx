import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking,
  Modal,
  TextInput,
} from 'react-native';
import { UserProfile } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { socketService } from '../services/socketService';
import { DEFAULT_API_BASE, REALTIME_WS_BASE } from '../config';
import {
  TavrikoScreen,
  TavrikoTopBar,
  CoinIcon,
  GemIcon,
  ChestIcon,
  KeyIcon,
} from '../components/TavrikoIcons';
import { ScreenName } from '../navigation/RootNavigator';

interface DeveloperScreenProps {
  user?: UserProfile;
  apiBaseUrl?: string;
  onUpdateUser?: (updatedUser: UserProfile) => void;
  onNavigate: (screen: ScreenName) => void;
  onBack: () => void;
}

export const DeveloperScreen: React.FC<DeveloperScreenProps> = ({
  user,
  apiBaseUrl,
  onUpdateUser,
  onNavigate,
  onBack,
}) => {
  const [apiPing, setApiPing] = useState<number | null>(null);
  const [isPinging, setIsPinging] = useState<boolean>(false);
  const [wsConnected, setWsConnected] = useState<boolean>(() => {
    try {
      return typeof socketService?.isConnected === 'function' ? socketService.isConnected() : false;
    } catch {
      return false;
    }
  });
  const [showJson, setShowJson] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [tgTesting, setTgTesting] = useState<boolean>(false);
  const [tgStatus, setTgStatus] = useState<string | null>(null);

  // --- Block user ---
  const [blockModal, setBlockModal] = useState<boolean>(false);
  const [blockInput, setBlockInput] = useState<string>('');
  const [blockedUsers, setBlockedUsers] = useState<Array<{ id: string; username?: string; displayName?: string }>>([]);
  const [blockLoading, setBlockLoading] = useState<boolean>(false);

  // --- Send notification ---
  const [notifModal, setNotifModal] = useState<boolean>(false);
  const [notifTarget, setNotifTarget] = useState<string>('');
  const [notifTitle, setNotifTitle] = useState<string>('');
  const [notifSub, setNotifSub] = useState<string>('');
  const [notifSending, setNotifSending] = useState<boolean>(false);
  const [notifStatus, setNotifStatus] = useState<string | null>(null);

  // --- New product ---
  const [productModal, setProductModal] = useState<boolean>(false);
  const [productName, setProductName] = useState<string>('');
  const [productDesc, setProductDesc] = useState<string>('');
  const [productPrice, setProductPrice] = useState<string>('');
  const [productCurrency, setProductCurrency] = useState<'coins' | 'gems' | 'try'>('gems');
  const [productRarity, setProductRarity] = useState<'common' | 'rare' | 'epic' | 'legendary' | 'mythic'>('epic');
  const [productCategory, setProductCategory] = useState<'featured' | 'diamonds' | 'gold' | 'chests' | 'keys' | 'avatars' | 'frames' | 'badges' | 'name_effects' | 'boosters' | 'backgrounds'>('frames');
  const [productAdding, setProductAdding] = useState<boolean>(false);
  const [productStatus, setProductStatus] = useState<string | null>(null);

  const base = apiBaseUrl || DEFAULT_API_BASE;

  useEffect(() => {
    checkApiLatency();
    const timer = setInterval(() => {
      try {
        setWsConnected(typeof socketService?.isConnected === 'function' ? socketService.isConnected() : false);
      } catch {
        setWsConnected(false);
      }
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user?.id && !user?.isGuest) {
      loadBlockedUsers();
    }
  }, [user?.id]);

  const checkApiLatency = async () => {
    setIsPinging(true);
    const start = Date.now();
    try {
      const res = await fetch(`${base}/health`);
      const diff = Date.now() - start;
      if (res.ok) {
        setApiPing(diff);
      } else {
        setApiPing(null);
      }
    } catch {
      setApiPing(null);
    } finally {
      setIsPinging(false);
    }
  };

  const notify = (msg: string) => {
    sound.playSound('reward');
    sound.triggerHaptic('success');
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 3000);
  };

  const handleAddCoins = () => {
    if (!user || !onUpdateUser) return;
    const updated: UserProfile = {
      ...user,
      coins: (user.coins ?? 0) + 1000,
    };
    onUpdateUser(updated);
    notify('+1.000 Altın başarıyla tanımlandı!');
  };

  const handleAddGems = () => {
    if (!user || !onUpdateUser) return;
    const updated: UserProfile = {
      ...user,
      gems: (user.gems ?? 0) + 100,
    };
    onUpdateUser(updated);
    notify('+100 Elmas başarıyla tanımlandı!');
  };

  const handleAddXp = () => {
    if (!user || !onUpdateUser) return;
    const newXp = (user.xp ?? 0) + 500;
    const newLevel = Math.floor(newXp / 1000) + 1;
    const updated: UserProfile = {
      ...user,
      xp: newXp,
      level: newLevel,
    };
    onUpdateUser(updated);
    notify(`+500 XP tanımlandı! Yeni Seviye: ${newLevel}`);
  };

  const handleAddLp = () => {
    if (!user || !onUpdateUser) return;
    const updated: UserProfile = {
      ...user,
      rankPoints: (user.rankPoints ?? 0) + 150,
      rankTitle: (user.rankPoints ?? 0) + 150 >= 1000 ? 'Elmas Oyuncu' : 'Platin Oyuncu',
    };
    onUpdateUser(updated);
    notify('+150 LP Lig Puanı eklendi!');
  };

  const handleTogglePass = () => {
    if (!user || !onUpdateUser) return;
    const nextPass = !user.hasPremiumPass;
    const updated: UserProfile = {
      ...user,
      hasPremiumPass: nextPass,
    };
    onUpdateUser(updated);
    notify(nextPass ? '⭐ Premium Pass KİLİDİ AÇILDI!' : 'Premium Pass kapatıldı.');
  };

  const handleAddChests = () => {
    if (!user || !onUpdateUser) return;
    const inv = [...(user.inventory || [])];
    inv.push(
      { id: 'chest_gold_' + Date.now(), name: 'Altın Sandık', desc: 'Değerli ödüller içerir', category: 'chest', rarity: 'legendary', qty: 1, icon: '📦', equipped: false },
      { id: 'key_gold_' + Date.now(), name: 'Altın Anahtar', desc: 'Altın sandığı açar', category: 'key', rarity: 'legendary', qty: 1, icon: '🗝️', equipped: false },
      { id: 'chest_silver_' + Date.now(), name: 'Gümüş Sandık', desc: 'Sürpriz ödüller içerir', category: 'chest', rarity: 'rare', qty: 2, icon: '📦', equipped: false },
      { id: 'key_silver_' + Date.now(), name: 'Gümüş Anahtar', desc: 'Gümüş sandığı açar', category: 'key', rarity: 'rare', qty: 2, icon: '🗝️', equipped: false }
    );
    const updated: UserProfile = {
      ...user,
      inventory: inv,
    };
    onUpdateUser(updated);
    notify('Test sandıkları ve anahtarları envantere eklendi!');
  };

  const openUrl = (path: string) => {
    sound.playSound('tap');
    let target = path;
    if (!path.startsWith('http')) {
      const origin =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : base.replace(/\/api\/?$/, '');
      target = `${origin}${path.startsWith('/') ? path : `/${path}`}`;
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(target, '_blank');
    } else {
      Linking.openURL(target).catch(() => {});
    }
  };

  const testTelegram = async () => {
    setTgTesting(true);
    setTgStatus(null);
    sound.playSound('tap');
    try {
      const res = await fetch(`${base}/admin/telegram/test`);
      const data = await res.json();
      if (data.success && data.bot) {
        setTgStatus(`✅ @${data.bot.username || data.bot.first_name} Aktif ve hazır!`);
        sound.playSound('reward');
        sound.triggerHaptic('success');
      } else {
        setTgStatus(`⚠️ ${data.error || 'Bot henüz başlatılmamış.'}`);
        sound.playSound('wrong');
        sound.triggerHaptic('error');
      }
    } catch {
      setTgStatus('❌ Sunucuya erişilemedi.');
      sound.playSound('wrong');
      sound.triggerHaptic('error');
    } finally {
      setTgTesting(false);
    }
  };

  // --- Block system ---
  const loadBlockedUsers = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`${base}/social/blocked/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) setBlockedUsers(data.blockedUsers || []);
      }
    } catch {}
  };

  const handleBlockUser = async () => {
    if (!user?.id || !blockInput.trim()) return;
    setBlockLoading(true);
    try {
      const res = await fetch(`${base}/social/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, targetUserId: blockInput.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        notify(`Kullanıcı engellendi!`);
        setBlockInput('');
        setBlockModal(false);
        loadBlockedUsers();
      } else {
        notify(`Hata: ${data.error}`);
      }
    } catch (e: any) {
      notify(`Hata: ${e.message}`);
    } finally {
      setBlockLoading(false);
    }
  };

  const handleUnblockUser = async (targetId: string) => {
    if (!user?.id) return;
    try {
      const res = await fetch(`${base}/social/unblock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, targetUserId: targetId }),
      });
      const data = await res.json();
      if (data.success) {
        notify('Engel kaldırıldı!');
        loadBlockedUsers();
      }
    } catch (e: any) {
      notify(`Hata: ${e.message}`);
    }
  };

  // --- Send notification ---
  const handleSendNotification = async () => {
    if (!user?.id || !notifTarget.trim() || !notifTitle.trim()) return;
    setNotifSending(true);
    try {
      const res = await fetch(`${base}/social/notifications/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          targetUserId: notifTarget.trim(),
          title: notifTitle.trim(),
          sub: notifSub.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotifStatus(`✅ ${data.message}`);
        setNotifTarget('');
        setNotifTitle('');
        setNotifSub('');
        sound.playSound('reward');
      } else {
        setNotifStatus(`⚠️ ${data.error}`);
        sound.playSound('wrong');
      }
    } catch (e: any) {
      setNotifStatus(`❌ ${e.message}`);
      sound.playSound('wrong');
    } finally {
      setNotifSending(false);
    }
  };

  // --- Add new product ---
  const handleAddProduct = async () => {
    if (!productName.trim() || !productPrice.trim()) {
      setProductStatus('⚠️ Ürün adı ve fiyat zorunludur.');
      return;
    }
    setProductAdding(true);
    try {
      // Local-only for now — the shop catalog is defined in shared.
      // We just show a notification that the product would be added.
      const productId = `dev_${Date.now()}`;
      setProductStatus(`✅ Ürün "${productName}" hazırlandı! ID: ${productId}\nKategori: ${productCategory}\nFiyat: ${productPrice} ${productCurrency}\nNadirlik: ${productRarity}`);
      setProductName('');
      setProductDesc('');
      setProductPrice('');
      sound.playSound('reward');
      sound.triggerHaptic('success');
    } catch (e: any) {
      setProductStatus(`❌ ${e.message}`);
      sound.playSound('wrong');
    } finally {
      setProductAdding(false);
    }
  };

  const renderSection = (title: string, children: React.ReactNode) => (
    <View style={styles.card}>
      <Text style={styles.cardHeader}>{title}</Text>
      {children}
    </View>
  );

  return (
    <TavrikoScreen>
      <TavrikoTopBar
        leftType="back"
        onLeftPress={onBack}
        coins={user?.coins ?? 0}
        gems={user?.gems ?? 0}
      />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header Hero */}
        <View style={styles.heroWrap}>
          <View style={styles.badgeRow}>
            <View style={styles.envPill}>
              <View style={styles.greenDot} />
              <Text style={styles.envText}>DEV / OPS SANDBOX</Text>
            </View>
          </View>
          <Text style={styles.title}>GELİŞTİRİCİ PANELİ</Text>
          <Text style={styles.subtitle}>Canlı sistem durumu, sandbox hileleri ve operasyon köprüleri</Text>
        </View>

        {/* Status Toast */}
        {statusMsg && (
          <View style={styles.statusToast}>
            <Text style={styles.statusToastText}>✨ {statusMsg}</Text>
          </View>
        )}

        {/* Section 1: System & Network Health */}
        {renderSection('🌐 SİSTEM & AĞ DURUMU', (
          <>
            <View style={styles.healthRow}>
              <View style={styles.healthInfo}>
                <Text style={styles.healthLabel}>Cloudflare Realtime WebSocket</Text>
                <Text style={styles.healthSub} numberOfLines={1}>{REALTIME_WS_BASE}</Text>
              </View>
              <View style={[styles.statusBadge, wsConnected ? styles.badgeSuccess : styles.badgeWarn]}>
                <Text style={styles.statusBadgeText}>{wsConnected ? 'BAĞLI ✓' : 'KOPUK ⚠️'}</Text>
              </View>
            </View>

            <View style={styles.healthRow}>
              <View style={styles.healthInfo}>
                <Text style={styles.healthLabel}>Vercel Serverless REST API</Text>
                <Text style={styles.healthSub} numberOfLines={1}>{base}</Text>
              </View>
              <TouchableOpacity style={styles.pingBtn} onPress={checkApiLatency} disabled={isPinging}>
                {isPinging ? (
                  <ActivityIndicator size="small" color="#FFC43D" />
                ) : (
                  <Text style={styles.pingText}>{apiPing !== null ? `${apiPing} ms` : 'Ping'}</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={[styles.healthRow, { borderBottomWidth: 0 }]}>
              <View style={styles.healthInfo}>
                <Text style={styles.healthLabel}>Veritabanı Katmanı</Text>
                <Text style={styles.healthSub}>Supabase PostgreSQL + Prisma ORM + Upstash Redis</Text>
              </View>
              <View style={[styles.statusBadge, styles.badgeSuccess]}>
                <Text style={styles.statusBadgeText}>AKTİF ✓</Text>
              </View>
            </View>
          </>
        ))}

        {/* Section 2: Sandbox & Cheat Tools */}
        {renderSection('⚡ KULLANICI & EKONOMİ SANDBOX', (
          <>
            <Text style={styles.cardDesc}>
              Yerel testler için aktif oturumunuza anında altın, elmas, seviye veya envanter tanımlayın.
            </Text>

            <View style={styles.actionGrid}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleAddCoins} activeOpacity={0.8}>
                <CoinIcon size={20} />
                <Text style={styles.actionBtnText}>+1.000 Altın</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionBtn} onPress={handleAddGems} activeOpacity={0.8}>
                <GemIcon size={20} />
                <Text style={styles.actionBtnText}>+100 Elmas</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionBtn} onPress={handleAddXp} activeOpacity={0.8}>
                <Text style={styles.actionIcon}>⭐</Text>
                <Text style={styles.actionBtnText}>+500 XP (Seviye)</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionBtn} onPress={handleAddLp} activeOpacity={0.8}>
                <Text style={styles.actionIcon}>🏆</Text>
                <Text style={styles.actionBtnText}>+150 LP (Lig)</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionBtn} onPress={handleTogglePass} activeOpacity={0.8}>
                <Text style={styles.actionIcon}>🎟️</Text>
                <Text style={styles.actionBtnText}>
                  {user?.hasPremiumPass ? 'Pass Kapat' : 'Premium Pass Aç'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionBtn} onPress={handleAddChests} activeOpacity={0.8}>
                <ChestIcon size={20} />
                <Text style={styles.actionBtnText}>Test Sandıkları</Text>
              </TouchableOpacity>
            </View>
          </>
        ))}

        {/* Section 3: Moderation - Block & Notify */}
        {renderSection('🛡️ MODERASYON & ARKADAŞ YÖNETİMİ', (
          <>
            <Text style={styles.cardDesc}>
              Kullanıcıları engelleyin, bildirim gönderin ve arkadaş yönetimi yapın.
            </Text>

            <TouchableOpacity
              style={styles.moderationBtn}
              onPress={() => { sound.playSound('tap'); setBlockModal(true); loadBlockedUsers(); }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 18 }}>🚫</Text>
              <Text style={styles.moderationBtnText}>Kullanıcı Engelle</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.moderationBtn}
              onPress={() => { sound.playSound('tap'); setNotifModal(true); }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 18 }}>🔔</Text>
              <Text style={styles.moderationBtnText}>Bildirim Gönder</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.moderationBtn}
              onPress={() => { sound.playSound('tap'); setProductModal(true); }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 18 }}>➕</Text>
              <Text style={styles.moderationBtnText}>Yeni Ürün Ekle</Text>
            </TouchableOpacity>

            {/* Blocked users list */}
            {blockedUsers.length > 0 && (
              <View style={styles.blockedList}>
                <Text style={styles.blockedListHeader}>ENGELLİ KULLANICILAR ({blockedUsers.length})</Text>
                {blockedUsers.map((b) => (
                  <View key={b.id} style={styles.blockedRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.blockedName}>{b.displayName || b.username || b.id}</Text>
                      {b.username && <Text style={styles.blockedSub}>@{b.username}</Text>}
                    </View>
                    <TouchableOpacity
                      style={styles.unblockBtn}
                      onPress={() => handleUnblockUser(b.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.unblockBtnText}>Engeli Kaldır</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </>
        ))}

        {/* Section 4: Web Portals & Admin Bridges */}
        {renderSection('🛡️ YÖNETİM & LOG PORTALLARI', (
          <>
            <TouchableOpacity style={styles.portalRowBtn} onPress={() => openUrl('/developer')}>
              <View style={styles.portalIconBox}>
                <Text style={{ fontSize: 20 }}>🛡️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.portalTitle}>Developer & Ops Portalı (/developer)</Text>
                <Text style={styles.portalSub}>Canlı oyun simülatörü, gerçek zamanlı log akışı ve API explorer</Text>
              </View>
              <Text style={styles.portalArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.portalRowBtn} onPress={() => openUrl('/telegram-admin')}>
              <View style={styles.portalIconBox}>
                <Text style={{ fontSize: 20 }}>🤖</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.portalTitle}>Telegram Bot Yönetimi (/telegram-admin)</Text>
                <Text style={styles.portalSub}>Bot Father token yapılandırma ve onay sistemi göstergesi</Text>
              </View>
              <Text style={styles.portalArrow}>›</Text>
            </TouchableOpacity>

            <View style={{ marginTop: 8, marginBottom: 10, paddingHorizontal: 2 }}>
              <TouchableOpacity
                style={styles.tgTestBtn}
                onPress={testTelegram}
                disabled={tgTesting}
                activeOpacity={0.8}
              >
                {tgTesting ? (
                  <ActivityIndicator size="small" color="#38BDF8" />
                ) : (
                  <>
                    <Text style={{ fontSize: 15 }}>⚡</Text>
                    <Text style={styles.tgTestBtnText}>
                      Telegram Bot Durumunu Canlı Test Et
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {tgStatus && (
                <View style={styles.tgStatusBox}>
                  <Text style={styles.tgStatusText}>{tgStatus}</Text>
                </View>
              )}
            </View>

            <TouchableOpacity style={[styles.portalRowBtn, { borderBottomWidth: 0 }]} onPress={() => openUrl('/api/logs')}>
              <View style={styles.portalIconBox}>
                <Text style={{ fontSize: 20 }}>📊</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.portalTitle}>Ham Telemetri & Loglar (/api/logs)</Text>
                <Text style={styles.portalSub}>Sunucu hata kayıtları ve sistem telemetrisi JSON akışı</Text>
              </View>
              <Text style={styles.portalArrow}>›</Text>
            </TouchableOpacity>
          </>
        ))}

        {/* Section 5: Quick Screen Jump */}
        {renderSection('🚀 HIZLI EKRAN ATLAMA', (
          <View style={styles.jumpRow}>
            {(
              [
                { label: '🏆 Sezon 1', screen: 'season' },
                { label: '🎖️ Pro Lig', screen: 'pro_league' },
                { label: '🛍️ Mağaza', screen: 'shop' },
                { label: '🎒 Envanter', screen: 'inventory' },
                { label: '📅 Etkinlikler', screen: 'events' },
                { label: '⚔️ Özel Oda', screen: 'custom_room' },
                { label: '📡 1v1 Radar', screen: 'matchmaking' },
                { label: '👤 Profil', screen: 'profile' },
              ] as const
            ).map((item) => (
              <TouchableOpacity
                key={item.screen}
                style={styles.jumpPill}
                onPress={() => {
                  sound.playSound('tap');
                  onNavigate(item.screen as ScreenName);
                }}
              >
                <Text style={styles.jumpPillText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {/* Section 6: Raw User State */}
        {renderSection('📄 AKTİF OYUNCU DURUMU (JSON)', (
          <>
            <TouchableOpacity style={styles.jsonHeaderRow} onPress={() => setShowJson((v) => !v)}>
              <Text style={styles.jsonToggleText}>{showJson ? 'Gizle ▲' : 'Göster ▼'}</Text>
            </TouchableOpacity>

            {showJson && (
              <View style={styles.jsonBox}>
                <Text style={styles.jsonText}>{JSON.stringify(user || {}, null, 2)}</Text>
              </View>
            )}
          </>
        ))}
      </ScrollView>

      {/* Block User Modal */}
      <Modal visible={blockModal} transparent animationType="fade" onRequestClose={() => setBlockModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>KULLANICI ENGELLE</Text>
            <Text style={styles.modalDesc}>
              Engellenecek kullanıcının ID veya kullanıcı adını girin.
            </Text>
            <TextInput
              style={styles.textInput}
              value={blockInput}
              onChangeText={setBlockInput}
              placeholder="Kullanıcı ID veya kullanıcı adı"
              placeholderTextColor="#736B92"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: 'rgba(255, 92, 119, 0.2)', borderColor: '#FF5C77' }]}
                onPress={handleBlockUser}
                disabled={blockLoading}
                activeOpacity={0.8}
              >
                {blockLoading ? (
                  <ActivityIndicator size="small" color="#FF8598" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: '#FF8598' }]}>ENGELLE</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: 'rgba(255, 255, 255, 0.1)', borderColor: 'rgba(255, 255, 255, 0.25)' }]}
                onPress={() => setBlockModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalBtnText}>VAZGEÇ</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Send Notification Modal */}
      <Modal visible={notifModal} transparent animationType="fade" onRequestClose={() => setNotifModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>BİLDİRİM GÖNDER</Text>
            <Text style={styles.modalDesc}>
              Seçilen kullanıcıya özel bir bildirim gönderin.
            </Text>
            <TextInput
              style={styles.textInput}
              value={notifTarget}
              onChangeText={setNotifTarget}
              placeholder="Hedef kullanıcı ID veya kullanıcı adı"
              placeholderTextColor="#736B92"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={[styles.textInput, { minHeight: 44 }]}
              value={notifTitle}
              onChangeText={setNotifTitle}
              placeholder="Bildirim başlığı"
              placeholderTextColor="#736B92"
            />
            <TextInput
              style={[styles.textInput, { minHeight: 60 }]}
              value={notifSub}
              onChangeText={setNotifSub}
              placeholder="Bildirim alt metni (isteğe bağlı)"
              placeholderTextColor="#736B92"
              multiline
            />
            {notifStatus && (
              <Text style={styles.modalStatus}>{notifStatus}</Text>
            )}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: 'rgba(90, 219, 181, 0.2)', borderColor: '#5ADBB5' }]}
                onPress={handleSendNotification}
                disabled={notifSending}
                activeOpacity={0.8}
              >
                {notifSending ? (
                  <ActivityIndicator size="small" color="#5ADBB5" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: '#5ADBB5' }]}>GÖNDER</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: 'rgba(255, 255, 255, 0.1)', borderColor: 'rgba(255, 255, 255, 0.25)' }]}
                onPress={() => setNotifModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalBtnText}>KAPAT</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Product Modal */}
      <Modal visible={productModal} transparent animationType="fade" onRequestClose={() => setProductModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>YENİ ÜRÜN EKLE</Text>
            <Text style={styles.modalDesc}>
              Mağaza kataloğuna yeni bir ürün tanımı ekleyin.
            </Text>
            <TextInput
              style={styles.textInput}
              value={productName}
              onChangeText={setProductName}
              placeholder="Ürün adı"
              placeholderTextColor="#736B92"
            />
            <TextInput
              style={[styles.textInput, { minHeight: 60 }]}
              value={productDesc}
              onChangeText={setProductDesc}
              placeholder="Ürün açıklaması"
              placeholderTextColor="#736B92"
              multiline
            />
            <TextInput
              style={styles.textInput}
              value={productPrice}
              onChangeText={setProductPrice}
              placeholder="Fiyat (sayı)"
              placeholderTextColor="#736B92"
              keyboardType="numeric"
            />
            {/* Currency selector */}
            <View style={styles.selectorRow}>
              {(['coins', 'gems', 'try'] as const).map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.selectorPill, productCurrency === c ? styles.selectorPillActive : null]}
                  onPress={() => setProductCurrency(c)}
                >
                  <Text style={[styles.selectorPillText, productCurrency === c ? { color: '#1E0E45' } : null]}>
                    {c === 'coins' ? '🪙 Altın' : c === 'gems' ? '💎 Elmas' : '₺ TRY'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Rarity selector */}
            <Text style={styles.selectorLabel}>NADİRLİK</Text>
            <View style={styles.selectorRow}>
              {(['common', 'rare', 'epic', 'legendary', 'mythic'] as const).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.selectorPill, productRarity === r ? styles.selectorPillActive : null]}
                  onPress={() => setProductRarity(r)}
                >
                  <Text style={[styles.selectorPillText, productRarity === r ? { color: '#1E0E45' } : null]}>
                    {r === 'common' ? 'Genel' : r === 'rare' ? 'Nadir' : r === 'epic' ? 'Destansı' : r === 'legendary' ? 'Efsanevi' : 'Mitolojik'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Category selector */}
            <Text style={styles.selectorLabel}>KATEGORİ</Text>
            <View style={styles.selectorRow}>
              {(['featured', 'diamonds', 'gold', 'chests', 'keys', 'avatars', 'frames', 'badges', 'name_effects', 'boosters', 'backgrounds'] as const).map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.selectorPill, productCategory === c ? styles.selectorPillActive : null]}
                  onPress={() => setProductCategory(c)}
                >
                  <Text style={[styles.selectorPillText, productCategory === c ? { color: '#1E0E45' } : null]}>
                    {c === 'featured' ? 'Öne Çıkan' : c === 'diamonds' ? 'Elmaslar' : c === 'gold' ? 'Altınlar' : c === 'chests' ? 'Sandıklar' : c === 'keys' ? 'Anahtarlar' : c === 'avatars' ? 'Avatarlar' : c === 'frames' ? 'Çerçeveler' : c === 'badges' ? 'Rozetler' : c === 'name_effects' ? 'İsim Efek.' : c === 'boosters' ? 'Güçl.' : 'Arka Plan.'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {productStatus && (
              <Text style={styles.modalStatus}>{productStatus}</Text>
            )}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: 'rgba(255, 196, 61, 0.2)', borderColor: '#FFC43D' }]}
                onPress={handleAddProduct}
                disabled={productAdding}
                activeOpacity={0.8}
              >
                {productAdding ? (
                  <ActivityIndicator size="small" color="#FFC43D" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: '#FFC43D' }]}>ÜRÜNÜ EKLE</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: 'rgba(255, 255, 255, 0.1)', borderColor: 'rgba(255, 255, 255, 0.25)' }]}
                onPress={() => setProductModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalBtnText}>KAPAT</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </TavrikoScreen>
  );
};

const styles = StyleSheet.create({
  // --- Layout (responsive: mobile-first) ---
  scrollContent: {
    paddingBottom: 120,
    paddingHorizontal: 12,
  },
  heroWrap: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  badgeRow: {
    marginBottom: 6,
  },
  envPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(90, 219, 181, 0.15)',
    borderWidth: 1,
    borderColor: '#5ADBB5',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#5ADBB5',
  },
  envText: {
    color: '#5ADBB5',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 24,
    color: '#FFC43D',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: THEME.fonts.medium,
    fontSize: 11,
    color: '#D9CDF5',
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 320,
  },
  statusToast: {
    backgroundColor: 'rgba(255, 196, 61, 0.2)',
    borderWidth: 1,
    borderColor: '#FFC43D',
    padding: 10,
    borderRadius: 12,
    marginBottom: 14,
    alignItems: 'center',
  },
  statusToastText: {
    color: '#FFEAA7',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 12,
    color: '#FFC43D',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  cardDesc: {
    fontFamily: THEME.fonts.medium,
    fontSize: 11,
    color: '#D9CDF5',
    marginBottom: 12,
    lineHeight: 16,
  },

  // --- Health rows ---
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  healthInfo: {
    flex: 1,
    marginRight: 8,
  },
  healthLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
  },
  healthSub: {
    color: '#A093C2',
    fontSize: 10,
    fontFamily: THEME.fonts.medium,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeSuccess: {
    backgroundColor: 'rgba(90, 219, 181, 0.2)',
    borderWidth: 1,
    borderColor: '#5ADBB5',
  },
  badgeWarn: {
    backgroundColor: 'rgba(255, 92, 119, 0.2)',
    borderWidth: 1,
    borderColor: '#FF5C77',
  },
  statusBadgeText: {
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
    color: '#FFFFFF',
  },
  pingBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    minWidth: 60,
    alignItems: 'center',
  },
  pingText: {
    color: '#FFC43D',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },

  // --- Action grid ---
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(10, 4, 24, 0.65)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    width: '48.5%',
    flexShrink: 0,
  },
  actionIcon: {
    fontSize: 18,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: THEME.fonts.bold,
    flexShrink: 1,
  },

  // --- Moderation buttons ---
  moderationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(10, 4, 24, 0.65)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 196, 61, 0.3)',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    marginBottom: 8,
  },
  moderationBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
  },

  // --- Blocked users list ---
  blockedList: {
    marginTop: 10,
    backgroundColor: 'rgba(8, 3, 20, 0.5)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  blockedListHeader: {
    color: '#FF8598',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  blockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  blockedName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
  },
  blockedSub: {
    color: '#A093C2',
    fontSize: 10,
    fontFamily: THEME.fonts.medium,
    marginTop: 2,
  },
  unblockBtn: {
    backgroundColor: 'rgba(90, 219, 181, 0.2)',
    borderWidth: 1,
    borderColor: '#5ADBB5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  unblockBtnText: {
    color: '#5ADBB5',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
  },

  // --- Portal rows ---
  portalRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  portalIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(107, 60, 255, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  portalTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
    flexShrink: 1,
  },
  portalSub: {
    color: '#A093C2',
    fontSize: 10,
    fontFamily: THEME.fonts.medium,
    marginTop: 2,
    flexShrink: 1,
  },
  portalArrow: {
    color: '#FFC43D',
    fontSize: 18,
    fontFamily: THEME.fonts.display,
  },

  // --- Telegram test ---
  tgTestBtn: {
    backgroundColor: 'rgba(0, 136, 204, 0.18)',
    borderWidth: 1,
    borderColor: '#0088cc',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  tgTestBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
  },
  tgStatusBox: {
    marginTop: 6,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 10,
    padding: 8,
  },
  tgStatusText: {
    color: '#FF8598',
    fontSize: 11,
    fontFamily: THEME.fonts.bold,
    textAlign: 'center',
  },

  // --- Jump pills ---
  jumpRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  jumpPill: {
    backgroundColor: 'rgba(107, 60, 255, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  jumpPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: THEME.fonts.bold,
  },

  // --- JSON ---
  jsonHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  jsonToggleText: {
    color: '#FFC43D',
    fontSize: 11,
    fontFamily: THEME.fonts.bold,
  },
  jsonBox: {
    marginTop: 8,
    backgroundColor: '#070312',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 10,
    maxHeight: 220,
  },
  jsonText: {
    color: '#6EE7B7',
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier',
    fontSize: 10,
  },

  // --- Modal ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 3, 20, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1E0E45',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 196, 61, 0.55)',
    padding: 18,
  },
  modalTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 16,
    color: '#FFC43D',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 1,
  },
  modalDesc: {
    fontFamily: THEME.fonts.medium,
    fontSize: 11,
    color: '#D9CDF5',
    marginBottom: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  textInput: {
    backgroundColor: 'rgba(8, 3, 20, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.medium,
    marginBottom: 10,
    minHeight: 42,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  modalBtnText: {
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    letterSpacing: 0.5,
  },
  modalStatus: {
    color: '#5ADBB5',
    fontSize: 11,
    fontFamily: THEME.fonts.bold,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
    lineHeight: 16,
  },
  selectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  selectorLabel: {
    color: '#A093C2',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  selectorPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  selectorPillActive: {
    backgroundColor: '#FFC43D',
    borderColor: '#FFC43D',
  },
  selectorPillText: {
    color: '#D9CDF5',
    fontSize: 10,
    fontFamily: THEME.fonts.bold,
  },
});
