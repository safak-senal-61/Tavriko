import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Share,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { UserProfile, UserSettings, calculateLevelFromXp } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { socketService } from '../services/socketService';
import { compressAvatarImageAsync } from '../utils/avatarImage';
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
  ModeSquircleIcon,
} from '../components/TavrikoIcons';
let ImagePickerModule: any = null;
try {
  ImagePickerModule = require('expo-image-picker');
} catch {
  ImagePickerModule = null;
}

interface ProfileScreenProps {
  user: UserProfile;
  token?: string | null;
  apiBaseUrl?: string;
  onBack: () => void;
  /** Avatar/karakter seçim ekranına gider */
  onEditProfile: () => void;
  /** Bilgilerimi Düzenle form ekranına gider (ad, ülke, telefon, doğum, cinsiyet, bio) */
  onEditPersonalInfo?: () => void;
  onUpdateAvatar?: (uri: string) => void;
  onUpdateUser?: (updated: UserProfile) => void;
  onNavigateTab?: (tab: 'play' | 'explore' | 'leaders' | 'friends' | 'profile') => void;
  onSettings?: () => void;
}

type ProfileTab = 'overview' | 'mastery' | 'titles' | 'account';

// Unlockable display titles — level-based (same thresholds as calculateLevelFromXp)
const TITLE_CATALOG: Array<{ title: string; minLevel: number; emoji: string }> = [
  { title: 'Acemi Kaşif', minLevel: 1, emoji: '🧭' },
  { title: 'Yükselen Yıldız', minLevel: 3, emoji: '⭐' },
  { title: 'Usta Kaşif', minLevel: 6, emoji: '🗺️' },
  { title: 'Bilgi Şövalyesi', minLevel: 10, emoji: '🛡️' },
  { title: 'Stratejist', minLevel: 15, emoji: '♟️' },
  { title: 'Usta Bilgin', minLevel: 20, emoji: '📜' },
  { title: 'Büyük Üstat', minLevel: 30, emoji: '🎓' },
  { title: 'Efsanevi Deha', minLevel: 40, emoji: '🧠' },
  { title: 'Evrenin Hakimi', minLevel: 50, emoji: '🌌' },
];

const CATEGORY_LABELS: Record<string, { name: string; icon: string }> = {
  science_tech: { name: 'Bilim', icon: '⚛️' },
  history: { name: 'Tarih', icon: '🏛️' },
  geography: { name: 'Coğrafya', icon: '🌍' },
  sports: { name: 'Spor', icon: '🏀' },
  cinema_tv: { name: 'Sinema', icon: '🎬' },
  music: { name: 'Müzik', icon: '🎵' },
  art_culture: { name: 'Sanat', icon: '🎨' },
  physics_chemistry: { name: 'Teknoloji', icon: '💻' },
  nature_ecology: { name: 'Doğa', icon: '🌿' },
  biology: { name: 'Biyoloji', icon: '🧬' },
  food_gastronomy: { name: 'Yemek', icon: '🍲' },
  literature: { name: 'Edebiyat', icon: '📚' },
  space_astronomy: { name: 'Uzay', icon: '🚀' },
  animals_wildlife: { name: 'Hayvanlar', icon: '🐾' },
  mathematics: { name: 'Matematik', icon: '🔢' },
  logic_puzzles: { name: 'Oyun & Zeka', icon: '🎮' },
  language_vocab: { name: 'Dil & Kelime', icon: '💬' },
  general_culture: { name: 'Genel Kültür', icon: '💡' },
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

  const settings: UserSettings = (user.settings as UserSettings) || {};
  const prog = calculateLevelFromXp(user.xp ?? 0);
  const equippedTitle = settings.equippedTitle || prog.rankTitle;
  const onlineVisible = settings.onlineStatusVisible !== false;

  // Live WebSocket connection badge
  useEffect(() => {
    const interval = setInterval(() => setWsConnected(socketService.isConnected()), 3000);
    return () => clearInterval(interval);
  }, []);

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
          // Prefer base64 data URI (works on web + native) and shrink it so the
          // profile photo never breaks realtime connections or DB rows
          const rawUri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
          setPhotoState('saving');
          try {
            const compressed = await compressAvatarImageAsync(rawUri);
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
      } catch {
        // Fallback to profile edit screen
      }
    }
    onEditProfile();
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
    const entries = Object.entries(user.categoryMastery || {}) as Array<[string, { level: number; correctCount: number } | undefined]>;
    return Object.keys(CATEGORY_LABELS)
      .map((id) => {
        const found = entries.find(([k]) => k === id)?.[1];
        return {
          id,
          name: CATEGORY_LABELS[id].name,
          icon: CATEGORY_LABELS[id].icon,
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
    { name: 'Hız Ustası', desc: 'Ort. cevap < 5 sn', done: !!user.stats?.avgResponseTimeMs && user.stats.avgResponseTimeMs < 5000, Icon: SpeedBoltIcon },
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
        message: `Tavriko'da bana meydan oku! 🎮\n${user.displayName} · Seviye ${prog.level} · ${equippedTitle}\nArkadaşlık Kodum: ${friendCode}\nhttps://tavriko-app.vercel.app`,
      });
    } catch {}
  };

  const handleEquipTitle = async (title: string) => {
    if (title === equippedTitle || savingTitle) return;
    sound.playSound('tap');
    setSavingTitle(title);
    setTitleNotice(null);
    // Optimistic update
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
      setTitleNotice({ ok: true, text: `✓ "${title}" unvanı kuşanıldı ve veritabanına kaydedildi.` });
    } catch (err: any) {
      if (onUpdateUser) onUpdateUser(user); // rollback
      setTitleNotice({ ok: false, text: `Unvan kaydedilemedi: ${err?.message || 'bağlantı hatası'}` });
    } finally {
      setSavingTitle(null);
      setTimeout(() => setTitleNotice(null), 3500);
    }
  };

  const renderTabs = () => (
    <View style={styles.tabRow}>
      {([
        ['overview', 'Genel'],
        ['mastery', 'Ustalık'],
        ['titles', 'Unvanlar'],
        ['account', 'Hesap'],
      ] as Array<[ProfileTab, string]>).map(([id, label]) => {
        const active = activeTab === id;
        return (
          <TouchableOpacity
            key={id}
            style={[styles.tabBtn, active && styles.tabBtnActive]}
            onPress={() => {
              sound.playSound('tap');
              setActiveTab(id);
            }}
          >
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
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
        {/* Header */}
        <View style={styles.avatarHeader}>
          <TouchableOpacity style={styles.goldAvatarRing} onPress={handlePickPhotoDirect} activeOpacity={0.85}>
            <CharacterAvatar seed={user.avatarUrl || user.displayName} size={84} />
          </TouchableOpacity>
          <View style={[styles.presenceBadge, { backgroundColor: wsConnected && onlineVisible ? '#3FD08A' : '#6B6288' }]}>
            <Text style={styles.presenceText}>
              {!onlineVisible ? '👻 GİZLİ' : wsConnected ? '● ÇEVRİMİÇİ' : '○ BAĞLANIYOR'}
            </Text>
          </View>
          <Text style={styles.displayName}>{user.fullName || user.displayName}</Text>
          <View style={styles.titlePill}>
            <Text style={styles.titlePillText}>
              {TITLE_CATALOG.find((t) => t.title === equippedTitle)?.emoji || '🏅'} {equippedTitle}
            </Text>
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
                ? '⏳ Fotoğraf küçültülüp kaydediliyor...'
                : photoState === 'saved'
                ? '✓ Profil fotoğrafı güncellendi'
                : '⚠️ Fotoğraf işlenemedi, tekrar deneyin'}
            </Text>
          )}

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerActionBtn}
              onPress={() => {
                sound.playSound('tap');
                if (onEditPersonalInfo) onEditPersonalInfo();
                else onEditProfile();
              }}
            >
              <Text style={styles.headerActionText}>✏️ Düzenle</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerActionBtn} onPress={handleShareProfile}>
              <Text style={styles.headerActionText}>📤 Paylaş</Text>
            </TouchableOpacity>
            {onSettings && (
              <TouchableOpacity
                style={styles.headerActionBtn}
                onPress={() => {
                  sound.playSound('tap');
                  onSettings();
                }}
              >
                <ModeSquircleIcon mode="settings" size={18} />
                <Text style={styles.headerActionText}>Ayarlar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Friend code card */}
        <TouchableOpacity style={styles.friendCodeCard} onPress={handleCopyCode} activeOpacity={0.85}>
          <View>
            <Text style={styles.friendCodeLabel}>ARKADAŞLIK KODUN</Text>
            <Text style={styles.friendCodeValue}>{friendCode}</Text>
          </View>
          <Text style={styles.friendCodeCopy}>{copied ? '✓ Kopyalandı' : '📋 Kopyala'}</Text>
        </TouchableOpacity>

        {renderTabs()}

        {/* TAB: Overview */}
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
                <Text style={styles.highlightTitle}>🔥 En Güçlü Kategorin</Text>
                <Text style={styles.highlightValue}>
                  {bestCategory.icon} {bestCategory.name} · {bestCategory.correctCount} doğru
                </Text>
              </View>
            )}

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Başarılar</Text>
              <Text style={styles.completionBadge}>
                {doneAchievements}/{achievements.length}
              </Text>
            </View>
            <View style={styles.badgeGrid}>
              {achievements.map(({ name, desc, done, Icon }) => (
                <View key={name} style={[styles.badgeCard, !done && { opacity: 0.4 }]}>
                  <Icon size={34} />
                  <Text style={styles.badgeName}>{name}</Text>
                  <Text style={styles.badgeDesc}>{done ? '✓ Açıldı' : desc}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* TAB: Category Mastery */}
        {activeTab === 'mastery' && (
          <View style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Kategori Ustalığı</Text>
            <Text style={styles.cardSub}>Her kategoride verdiğin doğru cevaplar veritabanından canlı okunur.</Text>
            {masteryList.map((m) => (
              <View key={m.id} style={styles.masteryRow}>
                <Text style={styles.masteryIcon}>{m.icon}</Text>
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

        {/* TAB: Titles */}
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
                  <Text style={styles.titleEmoji}>{t.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.titleName}>{t.title}</Text>
                    <Text style={styles.titleReq}>
                      {unlocked ? 'Açıldı' : `🔒 Seviye ${t.minLevel} gerekli`}
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

        {/* TAB: Account */}
        {activeTab === 'account' && (
          <View style={styles.detailsCard}>
            <View style={styles.detailsHeaderRow}>
              <Text style={styles.sectionTitle}>Hesap & Kişisel Bilgiler</Text>
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
              ['Hesap Türü', user.id.startsWith('google_') ? 'Google Hesabı' : 'E-posta Hesabı'],
              ['Profil Görünürlüğü', settings.profilePublic === false ? 'Gizli' : 'Herkese Açık'],
              ['Çevrimiçi Durum', onlineVisible ? 'Görünür' : 'Gizli'],
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
              <Text style={styles.editAccountText}>✏️ Bilgilerimi Düzenle</Text>
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
  backgroundColor: 'rgba(255, 255, 255, 0.08)',
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.14)',
  borderRadius: 20,
} as const;

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 110 },
  avatarHeader: { alignItems: 'center', marginTop: 10 },
  goldAvatarRing: { padding: 4, borderRadius: 50, backgroundColor: '#FFB21E' },
  presenceBadge: { marginTop: -10, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  presenceText: { color: '#FFFFFF', fontSize: 10, fontFamily: THEME.fonts.extraBold },
  displayName: { fontFamily: THEME.fonts.display, fontSize: 26, color: '#FFFFFF', marginTop: 6 },
  titlePill: {
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
  headerActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(10, 4, 24, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerActionText: { color: '#D9CDF5', fontSize: 12, fontFamily: THEME.fonts.extraBold },
  friendCodeCard: {
    ...card,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    marginTop: 14,
  },
  friendCodeLabel: { color: '#D9CDF5', fontSize: 10, fontFamily: THEME.fonts.extraBold },
  friendCodeValue: { color: '#FFFFFF', fontSize: 20, fontFamily: THEME.fonts.display, marginTop: 2 },
  friendCodeCopy: { color: '#FFC43D', fontSize: 12, fontFamily: THEME.fonts.extraBold },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(10, 4, 24, 0.6)',
    borderRadius: 16,
    padding: 4,
    marginVertical: 14,
  },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 12, alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#6B3CFF' },
  tabText: { color: '#D9CDF5', fontSize: 12, fontFamily: THEME.fonts.extraBold },
  tabTextActive: { color: '#FFFFFF' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8, marginBottom: 14 },
  statCard: { ...card, width: '32%', paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontFamily: THEME.fonts.display, fontSize: 20, color: '#FFFFFF' },
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
  detailsCard: { ...card, padding: 14, marginBottom: 16 },
  cardSub: { color: '#D9CDF5', fontSize: 11, fontFamily: THEME.fonts.body, marginTop: 4, marginBottom: 10 },
  detailsHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  completionBadge: { color: '#7CFC8A', fontSize: 12, fontFamily: THEME.fonts.extraBold },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    gap: 10,
  },
  infoLabel: { color: '#D9CDF5', fontSize: 12, fontFamily: THEME.fonts.extraBold },
  infoVal: { color: '#FFFFFF', fontSize: 12, fontFamily: THEME.fonts.extraBold, flexShrink: 1, textAlign: 'right' },
  editAccountBtn: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFC43D',
    alignItems: 'center',
  },
  editAccountText: { color: '#FFC43D', fontSize: 13, fontFamily: THEME.fonts.extraBold },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { fontFamily: THEME.fonts.display, fontSize: 18, color: '#FFFFFF' },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  badgeCard: { ...card, width: '31.5%', height: 104, alignItems: 'center', justifyContent: 'center', gap: 3 },
  badgeName: { color: '#FFFFFF', fontSize: 11, fontFamily: THEME.fonts.extraBold, textAlign: 'center' },
  badgeDesc: { color: '#D9CDF5', fontSize: 9, fontFamily: THEME.fonts.body, textAlign: 'center' },
  masteryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  masteryIcon: { fontSize: 22, width: 30, textAlign: 'center' },
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
  titleEmoji: { fontSize: 22 },
  titleName: { color: '#FFFFFF', fontSize: 14, fontFamily: THEME.fonts.extraBold },
  titleReq: { color: '#D9CDF5', fontSize: 11, fontFamily: THEME.fonts.body },
  titleAction: { color: '#FFC43D', fontSize: 12, fontFamily: THEME.fonts.extraBold },
});
