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
      { id: 'chest_gold_' + Date.now(), name: 'Altın Sandık', category: 'chests', rarity: 'legendary', qty: 1, icon: '📦', isEquipped: false },
      { id: 'key_gold_' + Date.now(), name: 'Altın Anahtar', category: 'keys', rarity: 'legendary', qty: 1, icon: '🗝️', isEquipped: false },
      { id: 'chest_silver_' + Date.now(), name: 'Gümüş Sandık', category: 'chests', rarity: 'rare', qty: 2, icon: '📦', isEquipped: false },
      { id: 'key_silver_' + Date.now(), name: 'Gümüş Anahtar', category: 'keys', rarity: 'rare', qty: 2, icon: '🗝️', isEquipped: false }
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
        <View style={styles.card}>
          <Text style={styles.cardHeader}>🌐 SİSTEM & AĞ DURUMU</Text>

          {/* WebSocket Row */}
          <View style={styles.healthRow}>
            <View style={styles.healthInfo}>
              <Text style={styles.healthLabel}>Cloudflare Realtime WebSocket</Text>
              <Text style={styles.healthSub} numberOfLines={1}>{REALTIME_WS_BASE}</Text>
            </View>
            <View style={[styles.statusBadge, wsConnected ? styles.badgeSuccess : styles.badgeWarn]}>
              <Text style={styles.statusBadgeText}>{wsConnected ? 'BAĞLI ✓' : 'KOPUK ⚠️'}</Text>
            </View>
          </View>

          {/* REST API Row */}
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

          {/* Database Row */}
          <View style={[styles.healthRow, { borderBottomWidth: 0 }]}>
            <View style={styles.healthInfo}>
              <Text style={styles.healthLabel}>Veritabanı Katmanı</Text>
              <Text style={styles.healthSub}>Supabase PostgreSQL + Prisma ORM + Upstash Redis</Text>
            </View>
            <View style={[styles.statusBadge, styles.badgeSuccess]}>
              <Text style={styles.statusBadgeText}>AKTİF ✓</Text>
            </View>
          </View>
        </View>

        {/* Section 2: Sandbox & Cheat Tools */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>⚡ KULLANICI & EKONOMİ SANDBOX</Text>
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
        </View>

        {/* Section 3: Web Portals & Admin Bridges */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>🛡️ YÖNETİM & LOG PORTALLARI</Text>

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

          {/* Telegram Test Button & Live Feedback */}
          <View style={{ marginTop: 8, marginBottom: 10, paddingHorizontal: 2 }}>
            <TouchableOpacity
              style={{
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
              }}
              onPress={testTelegram}
              disabled={tgTesting}
              activeOpacity={0.8}
            >
              {tgTesting ? (
                <ActivityIndicator size="small" color="#38BDF8" />
              ) : (
                <>
                  <Text style={{ fontSize: 15 }}>⚡</Text>
                  <Text style={{ color: '#38BDF8', fontSize: 12, fontFamily: THEME.fonts.bold }}>
                    Telegram Bot Durumunu Canlı Test Et
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {tgStatus && (
              <View style={{ marginTop: 6, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 10, padding: 8 }}>
                <Text style={{ color: tgStatus.startsWith('✅') ? '#5ADBB5' : '#FF8598', fontSize: 11, fontFamily: THEME.fonts.bold, textAlign: 'center' }}>
                  {tgStatus}
                </Text>
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
        </View>

        {/* Section 4: Quick Screen Jump */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>🚀 HIZLI EKRAN ATLAMA</Text>
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
        </View>

        {/* Section 5: Raw User State */}
        <View style={styles.card}>
          <TouchableOpacity style={styles.jsonHeaderRow} onPress={() => setShowJson((v) => !v)}>
            <Text style={styles.cardHeader}>📄 AKTİF OYUNCU DURUMU (JSON)</Text>
            <Text style={styles.jsonToggleText}>{showJson ? 'Gizle ▲' : 'Göster ▼'}</Text>
          </TouchableOpacity>

          {showJson && (
            <View style={styles.jsonBox}>
              <Text style={styles.jsonText}>{JSON.stringify(user || {}, null, 2)}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </TavrikoScreen>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 80,
    paddingHorizontal: 14,
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
    fontSize: 28,
    color: '#FFC43D',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontFamily: THEME.fonts.medium,
    fontSize: 12,
    color: '#D9CDF5',
    marginTop: 2,
    textAlign: 'center',
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
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 13,
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
    marginRight: 10,
  },
  healthLabel: {
    color: '#FFFFFF',
    fontSize: 13,
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
    minWidth: 64,
    alignItems: 'center',
  },
  pingText: {
    color: '#FFC43D',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
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
  },
  actionIcon: {
    fontSize: 18,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontFamily: THEME.fonts.bold,
  },
  portalRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  portalIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(107, 60, 255, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  portalTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.bold,
  },
  portalSub: {
    color: '#A093C2',
    fontSize: 10,
    fontFamily: THEME.fonts.medium,
    marginTop: 2,
  },
  portalArrow: {
    color: '#FFC43D',
    fontSize: 18,
    fontFamily: THEME.fonts.display,
  },
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
  jsonHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  jsonToggleText: {
    color: '#FFC43D',
    fontSize: 11,
    fontFamily: THEME.fonts.bold,
  },
  jsonBox: {
    marginTop: 10,
    backgroundColor: '#070312',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 10,
    maxHeight: 250,
  },
  jsonText: {
    color: '#6EE7B7',
    fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier',
    fontSize: 10,
  },
});
