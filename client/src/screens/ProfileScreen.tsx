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
  gaming_videogames: { name: 'Video Oyunları', tag: 'OYU', color: '#8B5CF6' },
  anime_manga: { name: 'Anime & Manga', tag: 'ANM', color: '#EC4899' },
  cartoons_animation: { name: 'Çizgi Film', tag: 'ÇZG', color: '#F59E0B' },
  cinema_tv: { name: 'Sinema & Dizi', tag: 'SNM', color: '#BA68C8' },
  comics_superheroes: { name: 'Çizgi Roman', tag: 'ÇZR', color: '#0284C7' },
  fantasy_fiction: { name: 'Fantastik', tag: 'FNT', color: '#7C3AED' },
  literature: { name: 'Edebiyat', tag: 'EDB', color: '#A1887F' },
  music: { name: 'Müzik', tag: 'MZK', color: '#F06292' },
  social_internet: { name: 'Sosyal Medya', tag: 'SSY', color: '#06B6D4' },
  animals_wildlife: { name: 'Hayvanlar', tag: 'HYV', color: '#DCE775' },
  mythology_ancient: { name: 'Mitoloji', tag: 'MTL', color: '#F59E0B' },
  hobbies_leisure: { name: 'Hobiler', tag: 'HOB', color: '#10B981' },
  history: { name: 'Tarih', tag: 'TRH', color: '#FFB74D' },
  geography: { name: 'Coğrafya', tag: 'CĞR', color: '#81C784' },
  art_culture: { name: 'Sanat & Kültür', tag: 'SNT', color: '#4DB6AC' },
  sports: { name: 'Spor', tag: 'SPR', color: '#FF8A65' },
  science_tech: { name: 'Bilim & Teknoloji', tag: 'BLM', color: '#4FC3F7' },
  logic_puzzles: { name: 'Oyun & Zeka', tag: 'ZKA', color: '#FF8A80' },
  mathematics: { name: 'Matematik', tag: 'MTM', color: '#4FC3F7' },
  food_gastronomy: { name: 'Yemek & Mutfak', tag: 'YMK', color: '#FFD54F' },
  daily_life: { name: 'Günlük Hayat', tag: 'GÜN', color: '#6366F1' },
  turkey_special: { name: 'Türkiye', tag: 'TRK', color: '#DC2626' },
  space_astronomy: { name: 'Uzay', tag: 'UZY', color: '#9575CD' },
  biology: { name: 'Biyoloji', tag: 'BYL', color: '#4DD0E1' },
  physics_chemistry: { name: 'Fizik & Kimya', tag: 'FZK', color: '#64B5F6' },
  language_vocab: { name: 'Dil & Kelime', tag: 'DİL', color: '#80CBC4' },
  nature_ecology: { name: 'Doğa & Ekoloji', tag: 'DOĞ', color: '#AED581' },
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
  const [showAvatarDrawer, setShowAvatarDrawer] = useState(false);
  const [copied, setCopied] = useState(false);
  const [wsConnected, setWsConnected] = useState<boolean>(socketService.isConnected());
  const [savingTitle, setSavingTitle] = useState<string | null>(null);
  const [titleNotice, setTitleNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [photoState, setPhotoState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const tabContentOpacity = useRef(new RNAnimated.Value(1)).current;
  const tabContentTranslateY = useRef(new RNAnimated.Value(0)).current;

  const switchProfileTab = (nextTab: ProfileTab) => {
    if (nextTab === activeTab) return;
    sound.playSound('tap');
    sound.triggerHaptic('light');
    setActiveTab(nextTab);
    tabContentOpacity.setValue(0.25);
    tabContentTranslateY.setValue(10);
    RNAnimated.parallel([
      RNAnimated.timing(tabContentOpacity, {
        toValue: 1,
        duration: 210,
        useNativeDriver: Platform.OS !== 'web',
      }),
      RNAnimated.spring(tabContentTranslateY, {
        toValue: 0,
        damping: 18,
        stiffness: 210,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  };

  // Quick settings local state backed by user.settings
  const settings: UserSettings & { soundEnabled?: boolean; allowDuelChallenges?: boolean } =
    (user.settings as any) || {};
  const [onlineStatusVisible, setOnlineStatusVisible] = useState(settings.onlineStatusVisible !== false);
  const [soundEnabled, setSoundEnabled] = useState(settings.soundEnabled !== false);
  const [hapticsEnabled, setHapticsEnabled] = useState(settings.hapticsEnabled !== false);
  const [allowDuelChallenges, setAllowDuelChallenges] = useState(settings.allowDuelChallenges !== false);

  const prog = calculateLevelFromXp(user.xp ?? 0);
  const equippedTitle = settings.equippedTitle || prog.rankTitle;

  // Live WebSocket connection polling & heartbeat
  useEffect(() => {
    const checkConn = () =>
      setWsConnected(socketService.isConnected() || socketService.isPresenceConnected());
    checkConn();
    const interval = setInterval(checkConn, 2500);
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
    socketService.connect(undefined, {
      userId: user.id,
      displayName: user.displayName,
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
        onUpdateUser({ ...user, settings: { ...settings, soundEnabled: val } as any });
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
        onUpdateUser({ ...user, settings: { ...settings, allowDuelChallenges: val } as any });
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

  const totalMatches = Math.max(0, Number(user.stats?.totalMatches || 0));
  const wins = Math.min(totalMatches, Math.max(0, Number(user.stats?.wins || 0)));
  const losses = Math.max(0, totalMatches - wins);
  const rawTotalAnswers = Math.max(0, Number(user.stats?.totalAnswers || 0));
  const totalAnswers =
    totalMatches === 0
      ? 0
      : Math.min(Math.max(totalMatches * 5, rawTotalAnswers || totalMatches * 5), totalMatches * 10);
  const rawCorrectAnswers = Math.max(0, Number(user.stats?.correctAnswers || 0));
  const correctAnswers = totalMatches === 0 ? 0 : Math.min(totalAnswers, rawCorrectAnswers);
  const winRate = totalMatches > 0 ? Math.min(100, Math.round((wins / totalMatches) * 100)) : 0;
  const accuracyRate = totalAnswers > 0 ? Math.min(100, Math.round((correctAnswers / totalAnswers) * 100)) : 0;
  const safeBestStreak = Math.min(correctAnswers, Math.max(0, Number(user.stats?.bestStreak || 0)));
  const avgSec = user.stats?.avgResponseTimeMs ? (user.stats.avgResponseTimeMs / 1000).toFixed(1) : '—';
  const friendCode = user.friendCode || '—';

  const masteryList = useMemo(() => {
    let rawEntries: Record<string, any> = (user.categoryMastery as any) || {};
    const totalMastery = Object.values(rawEntries).reduce(
      (acc: number, item: any) => acc + (Number(item?.correctCount) || 0),
      0
    );
    if (totalMastery === 0 && correctAnswers > 0) {
      const defKeys = ['general_culture', 'science_tech', 'history', 'geography', 'sports', 'cinema_tv'];
      const portion = Math.max(1, Math.floor(correctAnswers / defKeys.length));
      let rem = correctAnswers;
      const fallback: Record<string, { level: number; correctCount: number }> = {};
      for (const k of defKeys) {
        if (rem <= 0) break;
        const add = Math.min(portion, rem);
        fallback[k] = { level: Math.floor(add / 5) + (add > 0 ? 1 : 0), correctCount: add };
        rem -= add;
      }
      rawEntries = fallback;
    }

    const entries = Object.entries(rawEntries) as Array<
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
  }, [user.categoryMastery, correctAnswers]);

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
          ['overview', 'Özet'],
          ['mastery', 'Ustalık'],
          ['titles', 'Unvan'],
          ['settings', 'Ayar'],
          ['account', 'Hesap'],
        ] as const
      ).map(([tKey, label]) => {
        const isActive = activeTab === tKey;
        return (
          <TouchableOpacity
            key={tKey}
            style={[styles.tabBtn, isActive && styles.tabBtnActive]}
            onPress={() => switchProfileTab(tKey)}
            activeOpacity={0.8}
          >
            <Text
              style={[styles.tabText, isActive && styles.tabTextActive]}
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              minimumFontScale={0.72}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <TavrikoScreen style={styles.profileScreenRoot}>
      <TavrikoTopBar
        leftType="back"
        onLeftPress={onBack}
        coins={user.coins ?? 0}
        gems={user.gems ?? 0}
        avatarSeed={user.avatarUrl || user.displayName}
        onAvatarPress={onEditProfile}
      />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Unified Compact Hero Identity Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            {/* Left: Avatar + Online Dot + Edit Trigger */}
            <TouchableOpacity
              style={styles.heroAvatarButton}
              onPress={() => {
                sound.playSound('tap');
                setShowAvatarDrawer((prev) => !prev);
              }}
              activeOpacity={0.85}
            >
              <View style={styles.goldAvatarRing}>
                <CharacterAvatar seed={user.avatarUrl || user.displayName} size={68} />
              </View>
              <View
                style={[
                  styles.heroOnlineDot,
                  {
                    backgroundColor: wsConnected && onlineStatusVisible ? '#3FD08A' : '#735C99',
                  },
                ]}
              />
            </TouchableOpacity>

            {/* Right: Identity, Title, Level & XP */}
            <View style={styles.heroIdentityCol}>
              <View style={styles.heroNameRow}>
                <Text style={styles.displayName} numberOfLines={1}>
                  {user.fullName || user.displayName}
                </Text>
              </View>

              <Text style={styles.levelSub} numberOfLines={1}>
                @{user.username} · Sv. {prog.level} · {user.rankPoints ?? 1000} RP
              </Text>

              <View style={styles.heroBadgesRow}>
                <View style={styles.titlePill}>
                  <XpStarIcon size={12} />
                  <Text style={styles.titlePillText} numberOfLines={1}>
                    {equippedTitle}
                  </Text>
                </View>
                <View
                  style={[
                    styles.presenceMiniPill,
                    {
                      backgroundColor:
                        wsConnected && onlineStatusVisible
                          ? 'rgba(63, 208, 138, 0.14)'
                          : 'rgba(115, 92, 153, 0.2)',
                      borderColor:
                        wsConnected && onlineStatusVisible
                          ? 'rgba(63, 208, 138, 0.45)'
                          : 'rgba(169, 146, 226, 0.3)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.presenceMiniText,
                      { color: wsConnected && onlineStatusVisible ? '#3FD08A' : '#D9CDF5' },
                    ]}
                  >
                    {!onlineStatusVisible ? 'Gizli' : wsConnected ? 'Çevrimiçi' : 'Bağlanıyor'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Compact XP Progress Bar */}
          <View style={styles.heroXpWrap}>
            <View style={styles.heroXpHeader}>
              <Text style={styles.heroXpLabel}>Seviye {prog.level} İlerlemesi</Text>
              <Text style={styles.heroXpVal}>
                {prog.currentLevelXp} / {prog.nextLevelXpRequired} XP
              </Text>
            </View>
            <TavrikoProgressBar progress={prog.progressPct} height={7} />
          </View>

          {user.bio ? (
            <Text style={styles.bioText} numberOfLines={2}>
              "{user.bio}"
            </Text>
          ) : null}

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

          {/* Integrated Friend Code & Quick Action Strip */}
          <View style={styles.heroBottomContainer}>
            {/* Row 1: Friend Code Pill + Share Button */}
            <View style={styles.heroCodeRow}>
              <TouchableOpacity
                style={styles.inlineFriendCodeBtn}
                onPress={handleCopyCode}
                activeOpacity={0.82}
              >
                <View style={styles.codeTextGroup}>
                  <Text style={styles.inlineCodeLbl}>ARKADAŞ KODU</Text>
                  <Text style={styles.inlineCodeVal}>{friendCode}</Text>
                </View>
                <View style={styles.inlineCopyBadge}>
                  <CopyVectorIcon size={12} color="#FFC43D" />
                  <Text style={styles.inlineCopyText}>{copied ? 'Kopyalandı' : 'Kopyala'}</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.headerActionBtnShare}
                onPress={handleShareProfile}
                activeOpacity={0.82}
                accessibilityLabel="Profili Paylaş"
              >
                <ShareVectorIcon size={15} color="#D9CDF5" />
              </TouchableOpacity>
            </View>

            {/* Row 2: Karakter Değiştir & Profili Düzenle Buttons */}
            <View style={styles.heroActionButtonsRow}>
              <TouchableOpacity
                style={[
                  styles.heroActionBtnHalf,
                  showAvatarDrawer && styles.heroActionBtnHalfActive,
                ]}
                onPress={() => {
                  sound.playSound('tap');
                  setShowAvatarDrawer((prev) => !prev);
                }}
                activeOpacity={0.82}
              >
                <Text style={{ fontSize: 14 }}>🎭</Text>
                <Text
                  style={[
                    styles.heroActionBtnText,
                    showAvatarDrawer && styles.heroActionBtnTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {showAvatarDrawer ? 'Kapat' : 'Karakter'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.heroActionBtnHalf, styles.heroActionBtnEdit]}
                onPress={() => {
                  sound.playSound('tap');
                  if (onEditPersonalInfo) onEditPersonalInfo();
                  else onEditProfile();
                }}
                activeOpacity={0.82}
              >
                <EditPencilIcon size={14} color="#FFC43D" />
                <Text style={[styles.heroActionBtnText, { color: '#FFC43D' }]} numberOfLines={1}>
                  Düzenle
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Collapsible Avatar & Photo Drawer inside Hero Card */}
          {showAvatarDrawer && (
            <View style={styles.avatarDrawerBox}>
              <View style={styles.avatarPickerHeaderRow}>
                <View style={styles.avatarPickerTitleWrap}>
                  <Text style={styles.avatarPickerTitle}>Karakter veya Fotoğraf Seç</Text>
                  <Text style={styles.avatarPickerSubtitle}>Kaydırarak karakterini değiştir</Text>
                </View>
                <TouchableOpacity
                  style={styles.customPhotoChip}
                  onPress={handlePickPhotoDirect}
                  activeOpacity={0.8}
                >
                  <CameraVectorIcon size={13} color="#FFC43D" />
                  <Text style={styles.customPhotoChipText}>Galeri</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.avatarCarouselTrack}
                decelerationRate="fast"
              >
                {AVATAR_PRESETS.map((preset, idx) => {
                  const isSelected = user.avatarUrl === preset.id;
                  const rarityTheme = RARITY_THEME[preset.rarity] || RARITY_THEME.Nadir;

                  return (
                    <TouchableOpacity
                      key={preset.id}
                      style={[
                        styles.avatarCarouselCard,
                        isSelected && [
                          styles.avatarCarouselCardActive,
                          { borderColor: rarityTheme.border },
                        ],
                      ]}
                      onPress={() => handleSelectAvatarPreset(preset)}
                      activeOpacity={0.82}
                    >
                      {isSelected && (
                        <View
                          style={[
                            styles.avatarSelectedBadge,
                            { backgroundColor: rarityTheme.border },
                          ]}
                        >
                          <Text style={styles.avatarSelectedCheck}>✓</Text>
                        </View>
                      )}
                      <View style={styles.cardAvatarCircle}>
                        <CharacterAvatar index={idx} size={42} />
                      </View>
                      <Text style={styles.cardAvatarName} numberOfLines={1}>
                        {preset.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>

        {renderTabs()}

        <RNAnimated.View
          style={{
            width: '100%',
            maxWidth: 580,
            alignItems: 'center',
            opacity: tabContentOpacity,
            transform: [{ translateY: tabContentTranslateY }],
          }}
        >
        {/* TAB 1: Overview */}
        {activeTab === 'overview' && (
          <>
            {/* Primary 2x2 Key Performance Cards */}
            <View style={styles.primaryStatsGrid}>
              <View style={styles.primaryStatBox}>
                <Text style={styles.primaryStatLabel}>TOPLAM MAÇ</Text>
                <Text style={styles.primaryStatValue}>{totalMatches}</Text>
                <Text style={styles.primaryStatSub}>
                  {wins}G · {losses}M
                </Text>
              </View>
              <View style={styles.primaryStatBox}>
                <Text style={styles.primaryStatLabel}>KAZANMA ORANI</Text>
                <Text style={[styles.primaryStatValue, { color: '#3FD08A' }]}>%{winRate}</Text>
                <Text style={styles.primaryStatSub}>{wins} Galibiyet</Text>
              </View>
              <View style={styles.primaryStatBox}>
                <Text style={styles.primaryStatLabel}>DOĞRU CEVAP</Text>
                <Text style={[styles.primaryStatValue, { color: '#FFC43D' }]}>
                  {correctAnswers}
                  <Text style={styles.primaryStatFraction}>/{totalAnswers}</Text>
                </Text>
                <Text style={styles.primaryStatSub}>Toplam {totalAnswers} soru</Text>
              </View>
              <View style={styles.primaryStatBox}>
                <Text style={styles.primaryStatLabel}>İSABET ORANI</Text>
                <Text style={[styles.primaryStatValue, { color: '#38BDF8' }]}>%{accuracyRate}</Text>
                <Text style={styles.primaryStatSub}>En iyi seri: {safeBestStreak}x</Text>
              </View>
            </View>

            {/* Compact Secondary Metrics Strip */}
            <View style={styles.secondaryMetricsCard}>
              <View style={styles.secondaryMetricItem}>
                <Text style={styles.secondaryMetricVal}>{avgSec} sn</Text>
                <Text style={styles.secondaryMetricLbl}>Ort. Süre</Text>
              </View>
              <View style={styles.secondaryMetricDivider} />
              <View style={styles.secondaryMetricItem}>
                <Text style={styles.secondaryMetricVal}>
                  {user.dailyStreak || user.dailyChallenge?.streakDay || 0} gün
                </Text>
                <Text style={styles.secondaryMetricLbl}>Günlük Seri</Text>
              </View>
              <View style={styles.secondaryMetricDivider} />
              <View style={styles.secondaryMetricItem}>
                <Text style={styles.secondaryMetricVal}>{user.xp ?? 0}</Text>
                <Text style={styles.secondaryMetricLbl}>Toplam XP</Text>
              </View>
            </View>

            {bestCategory && (
              <View style={styles.highlightCard}>
                <View style={styles.highlightHeaderRow}>
                  <View style={styles.highlightIconBadge}>
                    <StreakFlameIcon size={18} active />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.highlightTitle}>EN GÜÇLÜ KATEGORİ</Text>
                    <Text style={styles.highlightValue}>
                      {bestCategory.name}
                    </Text>
                  </View>
                  <View style={styles.highlightCountBadge}>
                    <Text style={styles.highlightCountText}>
                      {bestCategory.correctCount} Doğru
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Rozetler & Başarılar</Text>
              <Text style={styles.completionBadge}>
                {doneAchievements}/{achievements.length}
              </Text>
            </View>
            <View style={styles.badgeGrid}>
              {achievements.map(({ name, desc, done, Icon }) => (
                <View key={name} style={[styles.badgeCard, !done && { opacity: 0.42 }]}>
                  <Icon size={28} />
                  <Text style={styles.badgeName} numberOfLines={1}>{name}</Text>
                  <Text style={styles.badgeDesc} numberOfLines={1}>{done ? 'Tamamlandı' : desc}</Text>
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
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.masteryHeader}>
                    <Text style={styles.masteryName} numberOfLines={1}>{m.name}</Text>
                    <Text style={styles.masteryMeta}>
                      Sv. {m.level} · {m.correctCount} doğru
                    </Text>
                  </View>
                  <TavrikoProgressBar
                    progress={
                      m.correctCount > 0
                        ? Math.min(100, Math.round((m.correctCount / maxCorrect) * 100))
                        : 0
                    }
                    height={6}
                  />
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
        </RNAnimated.View>
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
  backgroundColor: '#0F172A',
  borderWidth: 1.5,
  borderColor: 'rgba(255, 255, 255, 0.12)',
  borderRadius: 22,
  width: '100%',
  maxWidth: 580,
} as const;

const styles = StyleSheet.create({
  profileScreenRoot: {
    paddingHorizontal: 4,
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
  },
  scrollContent: {
    paddingBottom: 150,
    alignItems: 'center',
    paddingHorizontal: 2,
    width: '100%',
  },
  heroCard: {
    ...card,
    padding: 14,
    marginTop: 8,
    backgroundColor: '#0F172A',
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroAvatarButton: {
    position: 'relative',
    flexShrink: 0,
  },
  goldAvatarRing: {
    padding: 3,
    borderRadius: 42,
    backgroundColor: '#FFB21E',
  },
  heroOnlineDot: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
    borderColor: '#180A36',
  },
  heroIdentityCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  heroNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  displayName: {
    fontFamily: THEME.fonts.display,
    fontSize: 21,
    color: '#FFFFFF',
  },
  levelSub: {
    color: '#D9CDF5',
    fontSize: 11.5,
    fontFamily: THEME.fonts.extraBold,
    marginTop: 2,
  },
  heroBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  titlePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 196, 61, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 196, 61, 0.5)',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  titlePillText: {
    color: '#FFC43D',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  presenceMiniPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  presenceMiniText: {
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
  },
  heroXpWrap: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  heroXpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  heroXpLabel: {
    color: '#C4B5FD',
    fontSize: 10.5,
    fontFamily: THEME.fonts.extraBold,
  },
  heroXpVal: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontFamily: THEME.fonts.extraBold,
  },
  xpText: { color: '#D9CDF5', fontSize: 10, fontFamily: THEME.fonts.extraBold, textAlign: 'center', marginTop: 4 },
  bioText: { color: '#FFC43D', fontSize: 11.5, fontFamily: THEME.fonts.body, marginTop: 8, fontStyle: 'italic' },
  heroBottomContainer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    gap: 8,
  },
  heroCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineFriendCodeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(10, 4, 24, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 196, 61, 0.35)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  codeTextGroup: {
    flexDirection: 'column',
  },
  inlineCodeLbl: {
    color: '#A992E2',
    fontSize: 8.5,
    fontFamily: THEME.fonts.extraBold,
    letterSpacing: 0.4,
  },
  inlineCodeVal: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontFamily: THEME.fonts.display,
  },
  inlineCopyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 196, 61, 0.14)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  inlineCopyText: {
    color: '#FFC43D',
    fontSize: 10.5,
    fontFamily: THEME.fonts.extraBold,
  },
  headerActionBtnShare: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 4, 24, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 12,
  },
  heroActionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroActionBtnHalf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    backgroundColor: 'rgba(10, 4, 24, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  heroActionBtnHalfActive: {
    backgroundColor: 'rgba(154, 107, 255, 0.25)',
    borderColor: '#9A6BFF',
  },
  heroActionBtnEdit: {
    backgroundColor: 'rgba(255, 196, 61, 0.12)',
    borderColor: 'rgba(255, 196, 61, 0.4)',
  },
  heroActionBtnText: {
    color: '#D9CDF5',
    fontSize: 12.5,
    fontFamily: THEME.fonts.extraBold,
  },
  heroActionBtnTextActive: {
    color: '#FFFFFF',
  },

  // Collapsible Avatar Drawer inside Hero Card
  avatarDrawerBox: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  avatarPickerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  avatarPickerTitleWrap: {
    flex: 1,
  },
  avatarPickerTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.display,
  },
  avatarPickerSubtitle: {
    color: '#D9CDF5',
    fontSize: 10.5,
    fontFamily: THEME.fonts.bold,
    marginTop: 1,
    opacity: 0.8,
  },
  customPhotoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 196, 61, 0.14)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 196, 61, 0.5)',
    flexShrink: 0,
  },
  customPhotoChipText: {
    color: '#FFC43D',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  avatarCarouselTrack: {
    paddingVertical: 4,
    paddingRight: 8,
    gap: 8,
  },
  avatarCarouselCard: {
    width: 78,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    position: 'relative',
  },
  avatarCarouselCardActive: {
    backgroundColor: 'rgba(255, 196, 61, 0.14)',
    borderWidth: 2,
  },
  avatarSelectedBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  avatarSelectedCheck: {
    color: '#1C0C3E',
    fontSize: 10,
    fontWeight: '900',
  },
  cardAvatarCircle: {
    marginBottom: 4,
  },
  cardAvatarName: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
  },

  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 4,
    marginVertical: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    width: '100%',
    maxWidth: 580,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabBtn: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#F59E0B',
  },
  tabText: {
    color: '#94A3B8',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
  },
  tabTextActive: {
    color: '#0F172A',
    fontWeight: '900',
  },

  primaryStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    marginBottom: 10,
  },
  primaryStatBox: {
    ...card,
    width: '48.5%',
    paddingVertical: 13,
    paddingHorizontal: 14,
    backgroundColor: '#1E293B',
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  primaryStatLabel: {
    color: '#A992E2',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
    letterSpacing: 0.6,
  },
  primaryStatValue: {
    fontFamily: THEME.fonts.display,
    fontSize: 24,
    color: '#FFFFFF',
    marginTop: 3,
  },
  primaryStatFraction: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.55)',
  },
  primaryStatSub: {
    color: '#D9CDF5',
    fontSize: 10.5,
    fontFamily: THEME.fonts.bold,
    marginTop: 2,
  },
  secondaryMetricsCard: {
    ...card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginBottom: 12,
    backgroundColor: '#1E293B',
    borderRadius: 16,
  },
  secondaryMetricItem: {
    flex: 1,
    alignItems: 'center',
  },
  secondaryMetricDivider: {
    width: 1,
    height: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  secondaryMetricVal: {
    fontFamily: THEME.fonts.display,
    fontSize: 15,
    color: '#FFFFFF',
  },
  secondaryMetricLbl: {
    color: '#D9CDF5',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
    marginTop: 2,
  },

  highlightCard: {
    ...card,
    padding: 14,
    marginBottom: 12,
    backgroundColor: '#1E293B',
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: 'rgba(245, 158, 11, 0.45)',
  },
  highlightHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  highlightIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.5)',
  },
  highlightTitle: {
    color: '#F59E0B',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
    letterSpacing: 0.8,
  },
  highlightValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: THEME.fonts.display,
    marginTop: 2,
  },
  highlightCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  highlightCountText: {
    color: '#34D399',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },

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

  masterySpotlightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1.2,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    marginBottom: 14,
  },
  masterySpotlightIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  masterySpotlightTitle: {
    color: '#F59E0B',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    letterSpacing: 0.8,
  },
  masterySpotlightSub: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.medium,
    marginTop: 2,
    lineHeight: 15,
  },
  masteryTotalPill: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  masteryTotalPillNum: {
    color: '#F59E0B',
    fontSize: 15,
    fontFamily: THEME.fonts.display,
    fontWeight: '900',
  },
  masteryTotalPillLbl: {
    color: '#94A3B8',
    fontSize: 9,
    fontFamily: THEME.fonts.extraBold,
  },
  masterySubHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  masterySubHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.display,
    fontWeight: '800',
  },
  masterySubHeaderCount: {
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  activeMasteryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1.2,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    marginBottom: 10,
  },
  masteryLevelBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  masteryLevelBadgeText: {
    color: '#0F172A',
    fontSize: 9,
    fontFamily: THEME.fonts.extraBold,
    fontWeight: '900',
  },
  masteryRankTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: THEME.fonts.medium,
  },
  masteryNextHint: {
    color: '#94A3B8',
    fontSize: 10,
    fontFamily: THEME.fonts.medium,
  },
  dormantMasteryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dormantMasteryCard: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  dormantMasteryBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dormantMasteryBadgeText: {
    color: '#0F172A',
    fontSize: 9,
    fontWeight: '900',
  },
  dormantMasteryName: {
    color: '#E2E8F0',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  dormantMasterySub: {
    color: '#64748B',
    fontSize: 9.5,
    fontFamily: THEME.fonts.medium,
  },

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
