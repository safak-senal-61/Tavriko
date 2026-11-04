import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Animated as RNAnimated,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Share,
  ActivityIndicator,
  Platform,
  Switch,
} from 'react-native';
import Animated, { FadeInRight, FadeInUp, FadeInDown, ZoomIn } from 'react-native-reanimated';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { UserProfile, UserSettings, calculateLevelFromXp } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { socketService } from '../services/socketService';
import { compressAvatarImageAsync, uploadAvatarToR2Async } from '../utils/avatarImage';
import { DEFAULT_API_BASE } from '../config';
import {
  TavrikoScreen,
  TavrikoTopBar,
  TavrikoBottomNav,
  TavrikoProgressBar,
  CharacterAvatar,
  TrophyIcon,
  SpeedBoltIcon,
  StreakFlameIcon,
  BadgeShieldIcon,
  CrownIcon,
  ChestIcon,
  XpStarIcon,
  ModeSquircleIcon,
  AVATAR_PRESETS,
  AvatarPreset,
} from '../components/TavrikoIcons';

let ImagePickerModule: any = null;
try {
  ImagePickerModule = require('expo-image-picker');
} catch {
  ImagePickerModule = null;
}

// Vector Icon Components (No cheap AI emojis)
const EditPencilIcon: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = '#FFC43D' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const ShareVectorIcon: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = '#D9CDF5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const CopyVectorIcon: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = '#FFC43D' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="8" y="8" width="12" height="12" rx="3" stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Path
      d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
  </Svg>
);

const CloudSyncIcon: React.FC<{ size?: number; color?: string }> = ({ size = 18, color = '#5ADBB5' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M19.5 12c0-.23-.01-.45-.03-.68A5.5 5.5 0 008.5 8.5a6 6 0 00-5.46 6.88A4.5 4.5 0 007.5 19.5h11a4.5 4.5 0 001-8.5z"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path d="M12 12v4m0 0l-2-2m2 2l2-2" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const CameraVectorIcon: React.FC<{ size?: number; color?: string }> = ({ size = 16, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Circle cx="12" cy="13.5" r="3.25" stroke={color} strokeWidth={1.8} />
  </Svg>
);

const RadioSignalIcon: React.FC<{ size?: number; color?: string }> = ({ size = 14, color = '#3FD08A' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="3" fill={color} />
    <Path d="M4.93 19.07a10 10 0 010-14.14M19.07 4.93a10 10 0 010 14.14" stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Path d="M8.46 15.54a5 5 0 010-7.08M15.54 8.46a5 5 0 010 7.08" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

interface ProfileScreenProps {
  user: UserProfile;
  token?: string | null;
  apiBaseUrl?: string;
  onBack: () => void;
  onEditProfile: () => void;
  onEditPersonalInfo?: () => void;
  onUpdateAvatar?: (uri: string) => void;
  onUpdateUser?: (updated: UserProfile) => void;
  onNavigateTab?: (tab: 'play' | 'explore' | 'leaders' | 'friends' | 'profile') => void;
  onSettings?: () => void;
}

type ProfileTab = 'overview' | 'mastery' | 'titles' | 'settings' | 'account';

// Unlockable display titles with vector badge color coding
const TITLE_CATALOG: Array<{ title: string; minLevel: number; badgeColor: string; rarity: string }> = [
  { title: 'Acemi Kaşif', minLevel: 1, badgeColor: '#4FC3F7', rarity: 'Nadir' },
  { title: 'Yükselen Yıldız', minLevel: 3, badgeColor: '#4FC3F7', rarity: 'Nadir' },
  { title: 'Usta Kaşif', minLevel: 6, badgeColor: '#4FC3F7', rarity: 'Nadir' },
  { title: 'Bilgi Şövalyesi', minLevel: 10, badgeColor: '#B388FF', rarity: 'Epik' },
  { title: 'Stratejist', minLevel: 15, badgeColor: '#B388FF', rarity: 'Epik' },
  { title: 'Usta Bilgin', minLevel: 20, badgeColor: '#B388FF', rarity: 'Epik' },
  { title: 'Büyük Üstat', minLevel: 30, badgeColor: '#FFC43D', rarity: 'Efsanevi' },
  { title: 'Efsanevi Deha', minLevel: 40, badgeColor: '#FFC43D', rarity: 'Efsanevi' },
  { title: 'Evrenin Hakimi', minLevel: 50, badgeColor: '#FFC43D', rarity: 'Efsanevi' },
];

const CATEGORY_LABELS: Record<string, { name: string; tag: string; color: string }> = {
  science_tech: { name: 'Bilim', tag: 'BLM', color: '#4FC3F7' },
  history: { name: 'Tarih', tag: 'TRH', color: '#FFB74D' },
  geography: { name: 'Coğrafya', tag: 'CĞR', color: '#81C784' },
  sports: { name: 'Spor', tag: 'SPR', color: '#FF8A65' },
  cinema_tv: { name: 'Sinema', tag: 'SNM', color: '#BA68C8' },
  music: { name: 'Müzik', tag: 'MZK', color: '#F06292' },
  art_culture: { name: 'Sanat', tag: 'SNT', color: '#4DB6AC' },
  physics_chemistry: { name: 'Teknoloji', tag: 'TKN', color: '#64B5F6' },
  nature_ecology: { name: 'Doğa', tag: 'DOĞ', color: '#AED581' },
  biology: { name: 'Biyoloji', tag: 'BYL', color: '#4DD0E1' },
  food_gastronomy: { name: 'Yemek', tag: 'YMK', color: '#FFD54F' },
  literature: { name: 'Edebiyat', tag: 'EDB', color: '#A1887F' },
  space_astronomy: { name: 'Uzay', tag: 'UZY', color: '#9575CD' },
  animals_wildlife: { name: 'Hayvanlar', tag: 'HYV', color: '#DCE775' },
  mathematics: { name: 'Matematik', tag: 'MTM', color: '#4FC3F7' },
  logic_puzzles: { name: 'Oyun & Zeka', tag: 'ZKA', color: '#FF8A80' },
  language_vocab: { name: 'Dil & Kelime', tag: 'DİL', color: '#80CBC4' },
  general_culture: { name: 'Genel Kültür', tag: 'GNL', color: '#FFD180' },
};

const RARITY_THEME: Record<string, { border: string; glow: string; text: string }> = {
  Efsanevi: { border: '#FFC43D', glow: 'rgba(255, 196, 61, 0.45)', text: '#FFC43D' },
  Epik: { border: '#B388FF', glow: 'rgba(179, 136, 255, 0.45)', text: '#B388FF' },
  Nadir: { border: '#4FC3F7', glow: 'rgba(79, 195, 247, 0.45)', text: '#4FC3F7' },
};

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  user,
  token,
  apiBaseUrl,
  onBack,
  onEditProfile,
  onEditPersonalInfo,
  onUpdateAvatar,
  onUpdateUser,
  onNavigateTab,
  onSettings,
}) => {
  const base = apiBaseUrl || DEFAULT_API_BASE;
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [copied, setCopied] = useState(false);
  const [wsConnected, setWsConnected] = useState<boolean>(socketService.isConnected());
  const [savingTitle, setSavingTitle] = useState<string | null>(null);
  const [titleNotice, setTitleNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [photoState, setPhotoState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Quick settings local state backed by user.settings
  const settings: UserSettings = (user.settings as UserSettings) || {};
  const [onlineStatusVisible, setOnlineStatusVisible] = useState(settings.onlineStatusVisible !== false);
  const [soundEnabled, setSoundEnabled] = useState(settings.soundEnabled !== false);
  const [hapticsEnabled, setHapticsEnabled] = useState(settings.hapticsEnabled !== false);
  const [allowDuelChallenges, setAllowDuelChallenges] = useState(settings.allowDuelChallenges !== false);

  const prog = calculateLevelFromXp(user.xp ?? 0);
  const equippedTitle = settings.equippedTitle || prog.rankTitle;

  // Live WebSocket connection polling & heartbeat
  useEffect(() => {
    const interval = setInterval(() => setWsConnected(socketService.isConnected()), 2500);
    return () => clearInterval(interval);
  }, []);

  // Motion.dev-style continuous pulsing aura loop around avatar
  const auraAnim = useRef(new (require('react-native').Animated).Value(1)).current;
  useEffect(() => {
    const RNAnimated = require('react-native').Animated;
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(auraAnim, {
          toValue: 1.15,
          duration: 1800,
          useNativeDriver: Platform.OS !== 'web',
        }),
        RNAnimated.timing(auraAnim, {
          toValue: 1.0,
          duration: 1800,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [auraAnim]);

  const handlePickPhotoDirect = async () => {
    sound.playSound('tap');
    if (onUpdateAvatar && ImagePickerModule?.launchImageLibraryAsync) {
      try {
        const res = await ImagePickerModule.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
          base64: true,
        } as any);
        if (!res.canceled && res.assets?.length) {
          const asset = res.assets[0];
          const rawUri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
          setPhotoState('saving');
          try {
            const compressed = await uploadAvatarToR2Async(rawUri, user.id);
            onUpdateAvatar(compressed);
            sound.playSound('reward');
            sound.triggerHaptic('success');
            setPhotoState('saved');
            setTimeout(() => setPhotoState('idle'), 2500);
          } catch {
            setPhotoState('error');
            setTimeout(() => setPhotoState('idle'), 3000);
          }
          return;
        }
      } catch {}
    }
    onEditProfile();
  };

  const handleSelectAvatarPreset = async (preset: AvatarPreset) => {
    sound.playSound('tap');
    sound.triggerHaptic('medium');
    if (onUpdateAvatar) {
      onUpdateAvatar(preset.id);
    }
    // Optimistic update
    if (onUpdateUser) {
      onUpdateUser({ ...user, avatarUrl: preset.id });
    }
    // Broadcast via WebSocket
    socketService.setSessionContext({
      ...socketService.lastSessionContext,
      avatarUrl: preset.id,
    });
    // Persist to PostgreSQL database
    try {
      await fetch(`${base}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId: user.id, avatarUrl: preset.id }),
      });
    } catch {}
  };

  const handleToggleOnlineVisibility = async (val: boolean) => {
    setOnlineStatusVisible(val);
    sound.playSound('tap');
    sound.triggerHaptic('light');
    // Realtime WebSocket presence update
    socketService.updatePresence(user.id, val);
    // Persist to PostgreSQL
    try {
      await fetch(`${base}/auth/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId: user.id,
          settings: { ...settings, onlineStatusVisible: val },
        }),
      });
      if (onUpdateUser) {
        onUpdateUser({
          ...user,
          settings: { ...settings, onlineStatusVisible: val },
        });
      }
    } catch {}
  };

  const handleToggleSound = async (val: boolean) => {
    setSoundEnabled(val);
    sound.playSound('tap');
    sound.setSoundEnabled(val);
    try {
      await fetch(`${base}/auth/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId: user.id,
          settings: { ...settings, soundEnabled: val },
        }),
      });
      if (onUpdateUser) {
        onUpdateUser({ ...user, settings: { ...settings, soundEnabled: val } });
      }
    } catch {}
  };

  const handleToggleHaptics = async (val: boolean) => {
    setHapticsEnabled(val);
    sound.setHapticsEnabled(val);
    if (val) sound.triggerHaptic('medium');
    try {
      await fetch(`${base}/auth/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId: user.id,
          settings: { ...settings, hapticsEnabled: val },
        }),
      });
      if (onUpdateUser) {
        onUpdateUser({ ...user, settings: { ...settings, hapticsEnabled: val } });
      }
    } catch {}
  };

  const handleToggleDuels = async (val: boolean) => {
    setAllowDuelChallenges(val);
    sound.playSound('tap');
    try {
      await fetch(`${base}/auth/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId: user.id,
          settings: { ...settings, allowDuelChallenges: val },
        }),
      });
      if (onUpdateUser) {
        onUpdateUser({ ...user, settings: { ...settings, allowDuelChallenges: val } });
      }
    } catch {}
  };

  const handleSyncCloud = async () => {
    sound.playSound('tap');
    sound.triggerHaptic('medium');
    setSyncingCloud(true);
    setSyncNotice(null);
    try {
      const res = await fetch(`${base}/auth/sync-wallet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId: user.id,
          coins: user.coins,
          gems: user.gems,
          xp: user.xp,
          level: prog.level,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.user && onUpdateUser) {
          onUpdateUser(data.user);
        }
        sound.playSound('reward');
        sound.triggerHaptic('success');
        setSyncNotice('Bulut veritabanı ile tam eşitlendi.');
      } else {
        throw new Error('Eşitleme başarısız');
      }
    } catch (e: any) {
      sound.playSound('wrong');
      setSyncNotice('Eşitleme bağlantı hatası oluştu.');
    } finally {
      setSyncingCloud(false);
      setTimeout(() => setSyncNotice(null), 3000);
    }
  };

  const totalMatches = user.stats?.totalMatches || 0;
  const wins = user.stats?.wins || 0;
  const losses = Math.max(0, totalMatches - wins);
  const correctAnswers = user.stats?.correctAnswers || 0;
  const totalAnswers = user.stats?.totalAnswers || 0;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;
  const accuracyRate = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;
  const avgSec = user.stats?.avgResponseTimeMs ? (user.stats.avgResponseTimeMs / 1000).toFixed(1) : '—';
  const friendCode = user.friendCode || '—';

  const masteryList = useMemo(() => {
    const entries = Object.entries(user.categoryMastery || {}) as Array<
      [string, { level: number; correctCount: number } | undefined]
    >;
    return Object.keys(CATEGORY_LABELS)
      .map((id) => {
        const found = entries.find(([k]) => k === id)?.[1];
        return {
          id,
          name: CATEGORY_LABELS[id].name,
          tag: CATEGORY_LABELS[id].tag,
          color: CATEGORY_LABELS[id].color,
          level: found?.level || 0,
          correctCount: found?.correctCount || 0,
        };
      })
      .sort((a, b) => b.correctCount - a.correctCount);
  }, [user.categoryMastery]);

  const maxCorrect = Math.max(1, ...masteryList.map((m) => m.correctCount));
  const bestCategory = masteryList[0]?.correctCount > 0 ? masteryList[0] : null;

  const achievements = [
    { name: 'İlk Zafer', desc: '1 maç kazan', done: wins >= 1, Icon: TrophyIcon },
    {
      name: 'Hız Ustası',
      desc: 'Ort. cevap < 5 sn',
      done: !!user.stats?.avgResponseTimeMs && user.stats.avgResponseTimeMs < 5000,
      Icon: SpeedBoltIcon,
    },
    { name: 'Seri Kralı', desc: '3+ doğru seri', done: (user.stats?.bestStreak || 0) >= 3, Icon: StreakFlameIcon },
    { name: '100 Doğru', desc: '100 doğru cevap', done: correctAnswers >= 100, Icon: BadgeShieldIcon },
    { name: 'Uzman', desc: 'Seviye 5', done: prog.level >= 5, Icon: CrownIcon },
    { name: 'Koleksiyoncu', desc: '5+ eşya', done: (user.inventory?.length || 0) >= 5, Icon: ChestIcon },
  ];
  const doneAchievements = achievements.filter((a) => a.done).length;

  const handleCopyCode = async () => {
    sound.playSound('reward');
    sound.triggerHaptic('success');
    try {
      await Clipboard.setStringAsync(friendCode);
    } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareProfile = async () => {
    sound.playSound('tap');
    try {
      await Share.share({
        message: `Tavriko'da bana meydan oku!\n${user.displayName} · Seviye ${prog.level} · ${equippedTitle}\nArkadaşlık Kodum: ${friendCode}\nhttps://tavriko-app.vercel.app`,
      });
    } catch {}
  };

  const handleEquipTitle = async (title: string) => {
    if (title === equippedTitle || savingTitle) return;
    sound.playSound('tap');
    setSavingTitle(title);
    setTitleNotice(null);
    const optimistic: UserProfile = { ...user, settings: { ...settings, equippedTitle: title } };
    if (onUpdateUser) onUpdateUser(optimistic);
    try {
      const res = await fetch(`${base}/auth/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId: user.id, settings: { equippedTitle: title } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      if (data?.user && onUpdateUser) onUpdateUser(data.user);
      sound.playSound('reward');
      sound.triggerHaptic('success');
      setTitleNotice({ ok: true, text: `"${title}" unvanı kuşanıldı ve kaydedildi.` });
    } catch (err: any) {
      if (onUpdateUser) onUpdateUser(user);
      setTitleNotice({ ok: false, text: `Unvan kaydedilemedi: ${err?.message || 'bağlantı hatası'}` });
    } finally {
      setSavingTitle(null);
      setTimeout(() => setTitleNotice(null), 3500);
    }
  };

  const renderTabs = () => (
    <View style={styles.tabRow}>
      {(
        [
          ['overview', 'Genel'],
          ['mastery', 'Ustalık'],
          ['titles', 'Unvanlar'],
          ['settings', 'Ayarlar'],
          ['account', 'Hesap'],
        ] as const
      ).map(([tKey, label]) => {
        const isActive = activeTab === tKey;
        return (
          <TouchableOpacity
            key={tKey}
            style={[styles.tabBtn, isActive && styles.tabBtnActive]}
            onPress={() => {
              sound.playSound('tap');
              sound.triggerHaptic('light');
              setActiveTab(tKey);
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <TavrikoScreen>
      <TavrikoTopBar
        leftType="back"
        onLeftPress={onBack}
        coins={user.coins ?? 0}
        gems={user.gems ?? 0}
        avatarSeed={user.avatarUrl || user.displayName}
        onAvatarPress={onEditProfile}
      />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Main Hero Header Card */}
        <View style={styles.heroCard}>
          <View style={styles.avatarHeader}>
            <TouchableOpacity style={styles.goldAvatarRing} onPress={handlePickPhotoDirect} activeOpacity={0.85}>
              <CharacterAvatar seed={user.avatarUrl || user.displayName} size={88} />
            </TouchableOpacity>

            {/* Cloudflare Worker Realtime Status Badge */}
            <View
              style={[
                styles.presenceBadge,
                { backgroundColor: wsConnected && onlineStatusVisible ? '#123927' : '#2A1847', borderColor: wsConnected && onlineStatusVisible ? '#3FD08A' : '#735C99' },
              ]}
            >
              <RadioSignalIcon color={wsConnected && onlineStatusVisible ? '#3FD08A' : '#A992E2'} size={12} />
              <Text
                style={[
                  styles.presenceText,
                  { color: wsConnected && onlineStatusVisible ? '#3FD08A' : '#D9CDF5' },
                ]}
              >
                {!onlineStatusVisible ? 'GİZLİ MOD' : wsConnected ? 'REALTIME ÇEVRİMİÇİ' : 'BAĞLANIYOR...'}
              </Text>
            </View>

            <Text style={styles.displayName}>{user.fullName || user.displayName}</Text>

            <View style={styles.titlePill}>
              <XpStarIcon size={14} />
              <Text style={styles.titlePillText}>{equippedTitle}</Text>
            </View>

            <Text style={styles.levelSub}>
              @{user.username} · Seviye {prog.level} · {user.rankPoints ?? 1000} RP
            </Text>

            <View style={{ width: '100%', marginTop: 8 }}>
              <TavrikoProgressBar progress={prog.progressPct} height={8} />
              <Text style={styles.xpText}>
                {prog.currentLevelXp} / {prog.nextLevelXpRequired} XP → Seviye {prog.level + 1}
              </Text>
            </View>

            {user.bio ? <Text style={styles.bioText}>"{user.bio}"</Text> : null}

            {photoState !== 'idle' && (
              <Text
                style={[
                  styles.xpText,
                  {
                    color:
                      photoState === 'error'
                        ? '#FF5A6A'
                        : photoState === 'saved'
                        ? '#3FD08A'
                        : '#FFC43D',
                  },
                ]}
              >
                {photoState === 'saving'
                  ? 'Fotoğraf işlenip kaydediliyor...'
                  : photoState === 'saved'
                  ? 'Profil fotoğrafı güncellendi'
                  : 'Fotoğraf işlenemedi, tekrar deneyin'}
              </Text>
            )}

            {/* Header Actions */}
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerActionBtn}
                onPress={() => {
                  sound.playSound('tap');
                  if (onEditPersonalInfo) onEditPersonalInfo();
                  else onEditProfile();
                }}
              >
                <EditPencilIcon size={14} color="#FFC43D" />
                <Text style={styles.headerActionText}>Düzenle</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerActionBtn} onPress={handleShareProfile}>
                <ShareVectorIcon size={14} color="#D9CDF5" />
                <Text style={styles.headerActionText}>Paylaş</Text>
              </TouchableOpacity>
              {onSettings && (
                <TouchableOpacity
                  style={styles.headerActionBtn}
                  onPress={() => {
                    sound.playSound('tap');
                    onSettings();
                  }}
                >
                  <ModeSquircleIcon mode="settings" size={16} />
                  <Text style={styles.headerActionText}>Tüm Ayarlar</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* HORIZONTAL MOTION AVATAR PICKER (Soldan Sağa Kaydırmalı Karakterler) */}
        <View style={styles.avatarPickerSection}>
          <View style={styles.avatarPickerHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.avatarPickerTitle}>Karakterini Değiştir</Text>
              <View style={styles.swipeHintBadge}>
                <Text style={styles.swipeHintText}>Soldan Sağa Kaydır ➔</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.customPhotoChip}
              onPress={handlePickPhotoDirect}
              activeOpacity={0.8}
            >
              <CameraVectorIcon size={13} color="#FFC43D" />
              <Text style={styles.customPhotoChipText}>Fotoğraf Seç</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.avatarCarouselTrack}
            decelerationRate="fast"
            snapToInterval={96}
          >
            {AVATAR_PRESETS.map((preset, idx) => {
              const isSelected = user.avatarUrl === preset.id;
              const rarityTheme = RARITY_THEME[preset.rarity] || RARITY_THEME.Nadir;

              return (
                <Animated.View
                  key={preset.id}
                  entering={FadeInRight.delay(idx * 35).springify().damping(15)}
                >
                  <TouchableOpacity
                    style={[
                      styles.avatarCarouselCard,
                      isSelected && [
                        styles.avatarCarouselCardActive,
                        { borderColor: rarityTheme.border, shadowColor: rarityTheme.border },
                      ],
                    ]}
                    onPress={() => handleSelectAvatarPreset(preset)}
                    activeOpacity={0.82}
                  >
                    {isSelected && (
                      <View style={[styles.avatarSelectedBadge, { backgroundColor: rarityTheme.border }]}>
                        <Text style={styles.avatarSelectedCheck}>✓</Text>
                      </View>
                    )}
                    <View style={styles.cardAvatarCircle}>
                      <CharacterAvatar index={idx} size={46} />
                    </View>
                    <Text style={styles.cardAvatarName} numberOfLines={1}>
                      {preset.name}
                    </Text>
                    <View style={[styles.cardRarityPill, { backgroundColor: preset.badgeBg }]}>
                      <Text style={[styles.cardRarityText, { color: preset.badgeFg }]}>
                        {preset.rarity}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </ScrollView>
        </View>

        {/* Friend Code Card */}
        <TouchableOpacity style={styles.friendCodeCard} onPress={handleCopyCode} activeOpacity={0.85}>
          <View>
            <Text style={styles.friendCodeLabel}>SENİN ARKADAŞLIK KODUN</Text>
            <Text style={styles.friendCodeValue}>{friendCode}</Text>
          </View>
          <View style={styles.copyBtnPill}>
            <CopyVectorIcon size={14} color="#FFC43D" />
            <Text style={styles.friendCodeCopy}>{copied ? 'Kopyalandı!' : 'Kopyala'}</Text>
          </View>
        </TouchableOpacity>

        {renderTabs()}

        {/* TAB 1: Overview */}
        {activeTab === 'overview' && (
          <>
            <View style={styles.statsGrid}>
              {[
                { v: totalMatches, l: 'Toplam Maç' },
                { v: wins, l: 'Galibiyet' },
                { v: losses, l: 'Mağlubiyet' },
                { v: `%${winRate}`, l: 'Kazanma Oranı' },
                { v: `%${accuracyRate}`, l: `İsabet (${correctAnswers}/${totalAnswers})` },
                { v: user.stats?.bestStreak || 0, l: 'En İyi Seri' },
                { v: `${avgSec} sn`, l: 'Ort. Cevap Süresi' },
                { v: user.dailyStreak || user.dailyChallenge?.streakDay || 0, l: 'Günlük Seri' },
                { v: user.xp ?? 0, l: 'Toplam XP' },
              ].map((s) => (
                <View key={s.l} style={styles.statCard}>
                  <Text style={styles.statValue}>{s.v}</Text>
                  <Text style={styles.statLabel}>{s.l}</Text>
                </View>
              ))}
            </View>

            {bestCategory && (
              <View style={styles.highlightCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <StreakFlameIcon size={18} active />
                  <Text style={styles.highlightTitle}>En Güçlü Kategori</Text>
                </View>
                <Text style={styles.highlightValue}>
                  {bestCategory.name} · {bestCategory.correctCount} doğru cevap
                </Text>
              </View>
            )}

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Kazanılan Başarılar</Text>
              <Text style={styles.completionBadge}>
                {doneAchievements}/{achievements.length}
              </Text>
            </View>
            <View style={styles.badgeGrid}>
              {achievements.map(({ name, desc, done, Icon }) => (
                <View key={name} style={[styles.badgeCard, !done && { opacity: 0.38 }]}>
                  <Icon size={32} />
                  <Text style={styles.badgeName}>{name}</Text>
                  <Text style={styles.badgeDesc}>{done ? 'Kazanıldı' : desc}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* TAB 2: Category Mastery */}
        {activeTab === 'mastery' && (
          <View style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Kategori Ustalığı</Text>
            <Text style={styles.cardSub}>
              Her kategoride verdiğin doğru cevaplar veritabanından canlı okunur.
            </Text>
            {masteryList.map((m) => (
              <View key={m.id} style={styles.masteryRow}>
                <View style={[styles.masteryTagBadge, { backgroundColor: m.color }]}>
                  <Text style={styles.masteryTagText}>{m.tag}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.masteryHeader}>
                    <Text style={styles.masteryName}>{m.name}</Text>
                    <Text style={styles.masteryMeta}>
                      Sv. {m.level} · {m.correctCount} doğru
                    </Text>
                  </View>
                  <TavrikoProgressBar progress={Math.round((m.correctCount / maxCorrect) * 100)} height={6} />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* TAB 3: Titles */}
        {activeTab === 'titles' && (
          <View style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Unvan Seç & Kuşan</Text>
            <Text style={styles.cardSub}>
              Seviye atladıkça yeni unvanlar açılır. Seçtiğin unvan PostgreSQL'e kaydedilir ve arkadaşların tarafından görülür.
            </Text>
            {titleNotice && (
              <Text style={[styles.noticeText, { color: titleNotice.ok ? '#3FD08A' : '#FF5A6A' }]}>
                {titleNotice.text}
              </Text>
            )}
            {TITLE_CATALOG.map((t) => {
              const unlocked = prog.level >= t.minLevel;
              const equipped = t.title === equippedTitle;
              return (
                <TouchableOpacity
                  key={t.title}
                  disabled={!unlocked || equipped || !!savingTitle}
                  onPress={() => handleEquipTitle(t.title)}
                  style={[styles.titleRow, equipped && styles.titleRowEquipped, !unlocked && { opacity: 0.4 }]}
                  activeOpacity={0.85}
                >
                  <View style={[styles.titleRarityDot, { backgroundColor: t.badgeColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.titleName}>{t.title}</Text>
                    <Text style={styles.titleReq}>
                      {unlocked ? `${t.rarity} · Kuşanılabilir` : `Kilitli · Seviye ${t.minLevel} gerekli`}
                    </Text>
                  </View>
                  {savingTitle === t.title ? (
                    <ActivityIndicator color="#FFC43D" size="small" />
                  ) : (
                    <Text style={[styles.titleAction, equipped && { color: '#3FD08A' }]}>
                      {equipped ? '✓ Kuşanıldı' : unlocked ? 'Kuşan ›' : ''}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* TAB 4: Quick Settings & Live Cloud Sync */}
        {activeTab === 'settings' && (
          <View style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Hızlı Ayarlar & Canlı Bağlantı</Text>
            <Text style={styles.cardSub}>
              Tüm tercihler anında PostgreSQL veritabanına ve Cloudflare Worker WebSocket katmanına aktarılır.
            </Text>

            {/* Cloudflare WS Live Banner */}
            <View style={styles.gatewayBanner}>
              <View style={styles.gatewayLeft}>
                <RadioSignalIcon size={18} color={wsConnected ? '#3FD08A' : '#FFC43D'} />
                <View>
                  <Text style={styles.gatewayTitle}>
                    {wsConnected ? 'Cloudflare Realtime Gateway' : 'Gateway Bağlanıyor'}
                  </Text>
                  <Text style={styles.gatewaySub}>
                    {wsConnected ? 'WebSocket senkronizasyonu aktif' : 'Sunucu ile el sıkışılıyor...'}
                  </Text>
                </View>
              </View>
              <View style={[styles.gatewayStatusPill, { backgroundColor: wsConnected ? '#153A2A' : '#3E2510' }]}>
                <Text style={[styles.gatewayStatusText, { color: wsConnected ? '#3FD08A' : '#FFC43D' }]}>
                  {wsConnected ? 'CANLI' : 'BEKLİYOR'}
                </Text>
              </View>
            </View>

            {/* Setting Item: Online Presence */}
            <View style={styles.settingRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.settingLabel}>Çevrimiçi Görünürlük</Text>
                <Text style={styles.settingSub}>
                  Arkadaşların seni lobide ve oyun içi listelerde çevrimiçi görsün
                </Text>
              </View>
              <Switch
                value={onlineStatusVisible}
                onValueChange={handleToggleOnlineVisibility}
                trackColor={{ false: 'rgba(255,255,255,0.15)', true: '#6B3CFF' }}
                thumbColor={onlineStatusVisible ? '#FFC43D' : '#888'}
              />
            </View>

            {/* Setting Item: Sound FX */}
            <View style={styles.settingRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.settingLabel}>Ses Efektleri</Text>
                <Text style={styles.settingSub}>Oyun içi sesler, ödül ve zil efektleri</Text>
              </View>
              <Switch
                value={soundEnabled}
                onValueChange={handleToggleSound}
                trackColor={{ false: 'rgba(255,255,255,0.15)', true: '#6B3CFF' }}
                thumbColor={soundEnabled ? '#FFC43D' : '#888'}
              />
            </View>

            {/* Setting Item: Haptics */}
            <View style={styles.settingRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.settingLabel}>Titreşim & Dokunsal Geri Bildirim</Text>
                <Text style={styles.settingSub}>Tuş vuruşları ve kritik anlarda haptic titreşim</Text>
              </View>
              <Switch
                value={hapticsEnabled}
                onValueChange={handleToggleHaptics}
                trackColor={{ false: 'rgba(255,255,255,0.15)', true: '#6B3CFF' }}
                thumbColor={hapticsEnabled ? '#FFC43D' : '#888'}
              />
            </View>

            {/* Setting Item: 1v1 Match Requests */}
            <View style={styles.settingRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.settingLabel}>1v1 Düello Meydan Okumaları</Text>
                <Text style={styles.settingSub}>Diğer oyunculardan gelen yarış davetlerini kabul et</Text>
              </View>
              <Switch
                value={allowDuelChallenges}
                onValueChange={handleToggleDuels}
                trackColor={{ false: 'rgba(255,255,255,0.15)', true: '#6B3CFF' }}
                thumbColor={allowDuelChallenges ? '#FFC43D' : '#888'}
              />
            </View>

            {/* Database Sync Button */}
            <TouchableOpacity
              style={styles.syncCloudBtn}
              onPress={handleSyncCloud}
              disabled={syncingCloud}
              activeOpacity={0.82}
            >
              <CloudSyncIcon size={18} color="#0A2C21" />
              <Text style={styles.syncCloudBtnText}>
                {syncingCloud ? 'Veritabanı Eşitleniyor...' : 'Bulut Veritabanı ile Eşitle'}
              </Text>
            </TouchableOpacity>

            {syncNotice && (
              <Text
                style={[
                  styles.noticeText,
                  { color: syncNotice.includes('tam') ? '#3FD08A' : '#FF5A6A', textAlign: 'center', marginTop: 8 },
                ]}
              >
                {syncNotice}
              </Text>
            )}

            {/* Link to Full Settings Screen */}
            {onSettings && (
              <TouchableOpacity
                style={styles.fullSettingsLink}
                onPress={() => {
                  sound.playSound('tap');
                  onSettings();
                }}
              >
                <Text style={styles.fullSettingsLinkText}>Gelişmiş Ayarlar Sayfasına Git ➔</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* TAB 5: Account */}
        {activeTab === 'account' && (
          <View style={styles.detailsCard}>
            <View style={styles.detailsHeaderRow}>
              <Text style={styles.sectionTitle}>Hesap Bilgileri</Text>
              <Text style={styles.completionBadge}>Profil %{user.profileCompletionPct || 85}</Text>
            </View>
            <TavrikoProgressBar progress={user.profileCompletionPct || 85} height={8} style={{ marginBottom: 12 }} />
            {[
              ['Kullanıcı Adı', `@${user.username}`],
              ['Ad Soyad', user.fullName || user.displayName],
              ['E-posta Adresi', user.email || 'Belirtilmedi'],
              ['Ülke', `${user.countryName || 'Türkiye'} (${user.countryCode || 'TR'})`],
              ['Telefon', user.phone || 'Belirtilmedi'],
              ['Doğum Tarihi', user.birthDate || 'Belirtilmedi'],
              ['Cinsiyet', user.gender || 'Belirtilmedi'],
              ['Hesap Türü', user.id.startsWith('google_') ? 'Google Hesabı' : 'Standart Hesap'],
              ['Profil Görünürlüğü', settings.profilePublic === false ? 'Gizli' : 'Herkese Açık'],
              ['Çevrimiçi Durum', onlineStatusVisible ? 'Görünür' : 'Gizli'],
            ].map(([label, val]) => (
              <View key={label} style={styles.infoRow}>
                <Text style={styles.infoLabel}>{label}</Text>
                <Text style={styles.infoVal} numberOfLines={1}>
                  {val}
                </Text>
              </View>
            ))}
            <TouchableOpacity
              style={styles.editAccountBtn}
              activeOpacity={0.85}
              onPress={() => {
                sound.playSound('tap');
                sound.triggerHaptic('light');
                if (onEditPersonalInfo) onEditPersonalInfo();
                else onEditProfile();
              }}
            >
              <EditPencilIcon size={14} color="#FFC43D" />
              <Text style={styles.editAccountText}>Bilgilerimi Düzenle</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
      <TavrikoBottomNav
        activeTab="profile"
        onSelectTab={(tab) => {
          if (tab === 'play') onBack();
          else if (onNavigateTab) onNavigateTab(tab);
        }}
      />
    </TavrikoScreen>
  );
};

const card = {
  backgroundColor: 'rgba(28, 12, 62, 0.88)',
  borderWidth: 1.5,
  borderColor: 'rgba(107, 60, 255, 0.45)',
  borderRadius: 22,
} as const;

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 165 },
  heroCard: {
    ...card,
    padding: 16,
    marginTop: 10,
    backgroundColor: 'rgba(24, 10, 54, 0.94)',
    borderColor: 'rgba(255, 196, 61, 0.4)',
  },
  avatarHeader: { alignItems: 'center' },
  avatarGlowContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 104,
    height: 104,
  },
  auraPulseRing: {
    position: 'absolute',
    width: 102,
    height: 102,
    borderRadius: 51,
    backgroundColor: 'rgba(255, 196, 61, 0.35)',
    shadowColor: '#FFC43D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 16,
  },
  goldAvatarRing: {
    padding: 4,
    borderRadius: 54,
    backgroundColor: '#FFB21E',
    shadowColor: '#FFC43D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  presenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  presenceText: { fontSize: 10, fontFamily: THEME.fonts.extraBold, letterSpacing: 0.5 },
  displayName: { fontFamily: THEME.fonts.display, fontSize: 26, color: '#FFFFFF', marginTop: 8 },
  titlePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    backgroundColor: 'rgba(255, 196, 61, 0.15)',
    borderWidth: 1,
    borderColor: '#FFC43D',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  titlePillText: { color: '#FFC43D', fontSize: 12, fontFamily: THEME.fonts.extraBold },
  levelSub: { color: '#D9CDF5', fontSize: 12, fontFamily: THEME.fonts.extraBold, textAlign: 'center', marginTop: 6 },
  xpText: { color: '#D9CDF5', fontSize: 10, fontFamily: THEME.fonts.extraBold, textAlign: 'center', marginTop: 4 },
  bioText: { color: '#FFC43D', fontSize: 12, fontFamily: THEME.fonts.body, marginTop: 6, fontStyle: 'italic' },
  headerActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10, 4, 24, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  headerActionText: { color: '#D9CDF5', fontSize: 12, fontFamily: THEME.fonts.extraBold },

  // Horizontal Motion Avatar Picker Carousel
  avatarPickerSection: {
    marginTop: 14,
    backgroundColor: 'rgba(20, 8, 48, 0.88)',
    borderRadius: 22,
    padding: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(107, 60, 255, 0.5)',
  },
  avatarPickerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarPickerTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: THEME.fonts.display,
  },
  swipeHintBadge: {
    backgroundColor: 'rgba(255, 196, 61, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  swipeHintText: {
    color: '#FFC43D',
    fontSize: 9,
    fontFamily: THEME.fonts.extraBold,
  },
  customPhotoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 196, 61, 0.4)',
  },
  customPhotoChipText: {
    color: '#FFC43D',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  avatarCarouselTrack: {
    paddingVertical: 4,
    paddingRight: 10,
    gap: 10,
  },
  avatarCarouselCard: {
    width: 90,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 16,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    position: 'relative',
  },
  avatarCarouselCardActive: {
    backgroundColor: 'rgba(255, 196, 61, 0.12)',
    borderWidth: 2,
  },
  avatarSelectedBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  avatarSelectedCheck: {
    color: '#1C0C3E',
    fontSize: 11,
    fontWeight: '900',
  },
  cardAvatarCircle: {
    marginBottom: 4,
  },
  cardAvatarName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    marginBottom: 4,
  },
  cardRarityPill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  cardRarityText: {
    fontSize: 8.5,
    fontWeight: '900',
  },

  friendCodeCard: {
    ...card,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    marginTop: 12,
  },
  friendCodeLabel: { color: '#D9CDF5', fontSize: 10, fontFamily: THEME.fonts.extraBold, letterSpacing: 0.5 },
  friendCodeValue: { color: '#FFFFFF', fontSize: 20, fontFamily: THEME.fonts.display, marginTop: 2 },
  copyBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 196, 61, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFC43D',
  },
  friendCodeCopy: { color: '#FFC43D', fontSize: 12, fontFamily: THEME.fonts.extraBold },

  tabRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(10, 4, 24, 0.7)',
    borderRadius: 16,
    padding: 4,
    marginVertical: 14,
  },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 12, alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#6B3CFF' },
  tabText: { color: '#D9CDF5', fontSize: 11, fontFamily: THEME.fonts.extraBold },
  tabTextActive: { color: '#FFFFFF' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8, marginBottom: 14 },
  statCard: { ...card, width: '32%', paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontFamily: THEME.fonts.display, fontSize: 19, color: '#FFFFFF' },
  statLabel: { color: '#D9CDF5', fontSize: 10, fontFamily: THEME.fonts.extraBold, textAlign: 'center', marginTop: 2 },

  highlightCard: {
    ...card,
    padding: 14,
    marginBottom: 14,
    borderColor: 'rgba(255, 196, 61, 0.4)',
    backgroundColor: 'rgba(255, 196, 61, 0.08)',
  },
  highlightTitle: { color: '#FFC43D', fontSize: 12, fontFamily: THEME.fonts.extraBold },
  highlightValue: { color: '#FFFFFF', fontSize: 16, fontFamily: THEME.fonts.display, marginTop: 4 },

  detailsCard: { ...card, padding: 16, marginBottom: 16 },
  cardSub: { color: '#D9CDF5', fontSize: 11, fontFamily: THEME.fonts.body, marginTop: 4, marginBottom: 12, lineHeight: 16 },
  detailsHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  completionBadge: { color: '#7CFC8A', fontSize: 12, fontFamily: THEME.fonts.extraBold },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    gap: 10,
  },
  infoLabel: { color: '#D9CDF5', fontSize: 12, fontFamily: THEME.fonts.extraBold },
  infoVal: { color: '#FFFFFF', fontSize: 12, fontFamily: THEME.fonts.extraBold, flexShrink: 1, textAlign: 'right' },

  editAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFC43D',
    backgroundColor: 'rgba(255, 196, 61, 0.08)',
  },
  editAccountText: { color: '#FFC43D', fontSize: 13, fontFamily: THEME.fonts.extraBold },

  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontFamily: THEME.fonts.display, fontSize: 18, color: '#FFFFFF' },

  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  badgeCard: { ...card, width: '31.5%', height: 104, alignItems: 'center', justifyContent: 'center', gap: 3 },
  badgeName: { color: '#FFFFFF', fontSize: 11, fontFamily: THEME.fonts.extraBold, textAlign: 'center' },
  badgeDesc: { color: '#D9CDF5', fontSize: 9, fontFamily: THEME.fonts.body, textAlign: 'center' },

  masteryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  masteryTagBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  masteryTagText: {
    color: '#0A0418',
    fontSize: 10,
    fontWeight: '900',
  },
  masteryHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  masteryName: { color: '#FFFFFF', fontSize: 13, fontFamily: THEME.fonts.extraBold },
  masteryMeta: { color: '#D9CDF5', fontSize: 11, fontFamily: THEME.fonts.extraBold },

  noticeText: { fontSize: 12, fontFamily: THEME.fonts.extraBold, marginBottom: 8 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 8,
  },
  titleRowEquipped: { borderColor: '#3FD08A', backgroundColor: 'rgba(63, 208, 138, 0.1)' },
  titleRarityDot: { width: 10, height: 10, borderRadius: 5 },
  titleName: { color: '#FFFFFF', fontSize: 14, fontFamily: THEME.fonts.extraBold },
  titleReq: { color: '#D9CDF5', fontSize: 11, fontFamily: THEME.fonts.body },
  titleAction: { color: '#FFC43D', fontSize: 12, fontFamily: THEME.fonts.extraBold },

  // Settings tab specific styles
  gatewayBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(10, 4, 24, 0.7)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    marginBottom: 14,
  },
  gatewayLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  gatewayTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
  },
  gatewaySub: {
    color: '#D9CDF5',
    fontSize: 10,
    fontFamily: THEME.fonts.body,
    marginTop: 1,
  },
  gatewayStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  gatewayStatusText: {
    fontSize: 10,
    fontWeight: '900',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  settingLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
  },
  settingSub: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.body,
    marginTop: 2,
  },
  syncCloudBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#5ADBB5',
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 16,
    shadowColor: '#5ADBB5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  syncCloudBtnText: {
    color: '#0A2C21',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
  },
  fullSettingsLink: {
    marginTop: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  fullSettingsLinkText: {
    color: '#FFC43D',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
});
