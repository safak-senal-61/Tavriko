import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Modal,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { UserProfile, UserSettings } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { socketService } from '../services/socketService';
import {
  TavrikoScreen,
  TavrikoTopBar,
  Button3D,
  CharacterAvatar,
  CoinTavrikoIcon,
  GemTavrikoIcon,
} from '../components/TavrikoIcons';

// ============================================================================
// SLEEK VECTOR ICONS (No Cheesy Emojis)
// ============================================================================
const SpeakerIcon: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M11 5L6 9H2V15H6L11 19V5Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M15.54 8.46C16.48 9.4 17 10.68 17 12C17 13.32 16.48 14.6 15.54 15.54" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Path d="M19.07 4.93C20.95 6.81 22 9.34 22 12C22 14.66 20.95 17.19 19.07 19.07" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

const MusicIcon: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M9 18V5L21 3V16" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx="6" cy="18" r="3" stroke={color} strokeWidth="2" />
    <Circle cx="18" cy="16" r="3" stroke={color} strokeWidth="2" />
  </Svg>
);

const VibrateIcon: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="7" y="4" width="10" height="16" rx="2" stroke={color} strokeWidth="2" />
    <Path d="M2 8L2 16M5 10L5 14M22 8L22 16M19 10L19 14" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

const GamepadIcon: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M6 12H10M8 10V14M15 11H15.01M17 13H17.01" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Path d="M17.5 6H6.5C4.01 6 2 8.01 2 10.5C2 13.9 4.3 17.7 7.2 17.9C8.3 18 9.3 17.3 9.9 16.3L10.7 15H13.3L14.1 16.3C14.7 17.3 15.7 18 16.8 17.9C19.7 17.7 22 13.9 22 10.5C22 8.01 19.99 6 17.5 6Z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
  </Svg>
);

const ShieldIcon: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const CloudSyncIcon: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M20 16.2A4.5 4.5 0 0 0 17.5 8h-1.8A7 7 0 1 0 4 14.9" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M12 13V21M12 21L9 18M12 21L15 18" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const KeyIcon: React.FC<{ size?: number; color?: string }> = ({ size = 20, color = '#FFFFFF' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="8" cy="15" r="4" stroke={color} strokeWidth="2" />
    <Path d="M10.85 12.15L19 4M19 4L22 7M19 4L16 7M18 10L20 8" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

interface SettingsScreenProps {
  user?: UserProfile | null;
  apiBaseUrl?: string;
  onBack: () => void;
  onLogout: () => void;
  onDeleteAccount: () => Promise<void>;
  onDeveloper?: () => void;
  onSyncWallet?: () => Promise<void>;
  token?: string | null;
  onUpdateUser?: (updated: UserProfile) => void;
}

const SETTINGS_STORAGE_KEY = 'tavriko_user_settings_v2';

const loadLocalSettings = (): UserSettings => {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) return JSON.parse(raw) as UserSettings;
    }
  } catch {}
  return {};
};

const saveLocalSettings = (settings: UserSettings) => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    }
  } catch {}
};

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  user,
  apiBaseUrl,
  onBack,
  onLogout,
  onDeleteAccount,
  onDeveloper,
  onSyncWallet,
  token,
  onUpdateUser,
}) => {
  const saved: UserSettings = { ...loadLocalSettings(), ...((user?.settings as UserSettings) || {}) };
  const pick = <K extends keyof UserSettings>(key: K, fallback: NonNullable<UserSettings[K]>) =>
    (saved[key] ?? fallback) as NonNullable<UserSettings[K]>;

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Audio & Haptics
  const [sfxEnabled, setSfxEnabled] = useState<boolean>(pick('sfxEnabled', sound.isSoundEnabled()));
  const [sfxVolume, setSfxVolume] = useState<'25' | '50' | '75' | '100'>(pick('sfxVolume', '100'));
  const [musicEnabled, setMusicEnabled] = useState<boolean>(pick('musicEnabled', false));
  const [musicVolume, setMusicVolume] = useState<'25' | '50' | '75' | '100'>(pick('musicVolume', '50'));
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(pick('hapticsEnabled', sound.isHapticsEnabled()));
  const [hapticIntensity, setHapticIntensity] = useState<'light' | 'medium' | 'strong'>(pick('hapticIntensity', 'medium'));
  const [timerAlertSound, setTimerAlertSound] = useState<boolean>(pick('timerAlertSound', true));
  const [victoryMelody, setVictoryMelody] = useState<boolean>(pick('victoryMelody', true));

  // Visual & Performance
  const [smoothAnimations, setSmoothAnimations] = useState<boolean>(pick('smoothAnimations', true));
  const [batterySaver, setBatterySaver] = useState<boolean>(pick('batterySaver', false));

  // Gameplay Preferences
  const [defaultDifficulty, setDefaultDifficulty] = useState<'easy' | 'medium' | 'hard'>(pick('defaultDifficulty', 'medium'));
  const [penaltyForWrong, setPenaltyForWrong] = useState<boolean>(pick('penaltyForWrong', true));
  const [autoNextQuestion, setAutoNextQuestion] = useState<boolean>(pick('autoNextQuestion', true));

  // Social & Privacy (Websocket + Postgres)
  const [onlineStatusVisible, setOnlineStatusVisible] = useState<boolean>(pick('onlineStatusVisible', true));
  const [duelInvitesAllowed, setDuelInvitesAllowed] = useState<boolean>(pick('duelInvitesAllowed', true));
  const [friendRequestsAllowed, setFriendRequestsAllowed] = useState<boolean>(pick('friendRequestsAllowed', true));
  const [profilePublic, setProfilePublic] = useState<boolean>(pick('profilePublic', true));

  // Persistence status
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const isFirstRenderRef = useRef(true);
  const saveTimerRef = useRef<any>(null);

  // Password change modal
  const [pwModalVisible, setPwModalVisible] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Delete modal
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Apply engine sound/haptic state
  useEffect(() => {
    sound.setSoundEnabled(sfxEnabled);
    sound.setHapticsEnabled(hapticsEnabled);
  }, [sfxEnabled, hapticsEnabled]);

  // Aggregate current settings
  const currentSettings: UserSettings = {
    sfxEnabled,
    sfxVolume,
    musicEnabled,
    musicVolume,
    hapticsEnabled,
    hapticIntensity,
    timerAlertSound,
    victoryMelody,
    smoothAnimations,
    batterySaver,
    defaultDifficulty,
    penaltyForWrong,
    autoNextQuestion,
    onlineStatusVisible,
    duelInvitesAllowed,
    friendRequestsAllowed,
    profilePublic,
  };
  const settingsSig = JSON.stringify(currentSettings);

  // Auto-save debounced to PostgreSQL via API + WebSocket Presence update
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }

    saveLocalSettings(currentSettings);

    // Broadcast presence update live over WebSocket
    if (user?.id) {
      socketService.updatePresence(user.id, onlineStatusVisible);
    }

    if (!user || (user as any).isGuest) {
      return;
    }

    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/auth/settings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ userId: user.id, settings: currentSettings }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        setSaveStatus('saved');
        if (data?.user && onUpdateUser) onUpdateUser(data.user);
        setTimeout(() => setSaveStatus('idle'), 2500);
      } catch (err) {
        setSaveStatus('error');
      }
    }, 500);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [settingsSig]);

  const handleManualSync = async () => {
    if (!onSyncWallet || isSyncing) return;
    setIsSyncing(true);
    sound.playSound('tap');
    sound.triggerHaptic('light');
    try {
      await onSyncWallet();
      sound.playSound('reward');
      sound.triggerHaptic('success');
      setSyncNotice('Bulut veritabanı ile eşitlendi');
      setTimeout(() => setSyncNotice(null), 3000);
    } catch {
      setSyncNotice('Eşitleme sırasında bağlantı hatası');
      setTimeout(() => setSyncNotice(null), 3000);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleChangePassword = async () => {
    setPwMessage(null);
    if (newPw.length < 6) {
      setPwMessage({ ok: false, text: 'Yeni şifre en az 6 karakter olmalıdır.' });
      return;
    }
    if (newPw !== newPw2) {
      setPwMessage({ ok: false, text: 'Şifreler eşleşmiyor.' });
      return;
    }
    if (!token) {
      setPwMessage({ ok: false, text: 'Oturum doğrulanamadı. Lütfen tekrar giriş yapın.' });
      return;
    }
    setPwLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || data?.message || 'Şifre güncellenemedi.');
      }
      sound.playSound('reward');
      sound.triggerHaptic('success');
      setPwMessage({ ok: true, text: 'Şifreniz başarıyla güncellendi.' });
      setCurrentPw('');
      setNewPw('');
      setNewPw2('');
      setTimeout(() => {
        setPwModalVisible(false);
        setPwMessage(null);
      }, 1500);
    } catch (err: any) {
      sound.playSound('wrong');
      setPwMessage({ ok: false, text: err?.message || 'İşlem başarısız oldu.' });
    } finally {
      setPwLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await onDeleteAccount();
    } catch {
      setIsDeleting(false);
      setDeleteModalVisible(false);
    }
  };

  // Modern Sleek Toggle Switch
  const renderToggle = (value: boolean, onToggle: () => void) => (
    <TouchableOpacity
      style={[
        styles.switchTrack,
        value ? styles.switchTrackOn : styles.switchTrackOff,
      ]}
      onPress={() => {
        sound.playSound('tap');
        sound.triggerHaptic('light');
        onToggle();
      }}
      activeOpacity={0.85}
    >
      <View
        style={[
          styles.switchThumb,
          value ? styles.switchThumbOn : styles.switchThumbOff,
        ]}
      />
    </TouchableOpacity>
  );

  return (
    <TavrikoScreen>
      <TavrikoTopBar
        leftType="back"
        onLeftPress={onBack}
        coins={user?.coins}
        gems={user?.gems}
        avatarSeed={user?.avatarUrl || user?.displayName}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Text style={styles.title}>Ayarlar</Text>
          {saveStatus !== 'idle' && (
            <View
              style={[
                styles.saveIndicator,
                saveStatus === 'saved' && styles.saveIndicatorSuccess,
                saveStatus === 'error' && styles.saveIndicatorError,
              ]}
            >
              {saveStatus === 'saving' && <ActivityIndicator size="small" color="#FFC43D" />}
              <Text
                style={[
                  styles.saveIndicatorText,
                  saveStatus === 'saved' && { color: '#3FD08A' },
                  saveStatus === 'error' && { color: '#FF5A6A' },
                ]}
              >
                {saveStatus === 'saving'
                  ? 'Kaydediliyor...'
                  : saveStatus === 'saved'
                  ? 'Veritabanına kaydedildi'
                  : 'Kayıt hatası'}
              </Text>
            </View>
          )}
        </View>

        {/* 1. Account & Database Sync Card */}
        {user && (
          <View style={styles.accountCard}>
            <View style={styles.accountHeader}>
              <CharacterAvatar seed={user.avatarUrl || user.displayName} size={50} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.accountName} numberOfLines={1}>
                  {user.displayName}
                </Text>
                <Text style={styles.accountHandle}>
                  @{user.username} {user.email ? `· ${user.email}` : ''}
                </Text>
                <View style={styles.accountBadgeRow}>
                  <View style={styles.levelBadge}>
                    <Text style={styles.levelBadgeText}>
                      Seviye {user.level} · {user.rankTitle || 'Acemi Kaşif'}
                    </Text>
                  </View>
                  <View style={styles.verifiedBadge}>
                    <Text style={styles.verifiedBadgeText}>PostgreSQL Bulut</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Wallet Balances */}
            <View style={styles.walletRow}>
              <View style={styles.walletPill}>
                <CoinTavrikoIcon size={16} />
                <Text style={styles.walletText}>{user.coins ?? 0} Altın</Text>
              </View>
              <View style={styles.walletPill}>
                <GemTavrikoIcon size={16} />
                <Text style={styles.walletText}>{user.gems ?? 0} Elmas</Text>
              </View>
              <View style={styles.walletPill}>
                <Text style={[styles.walletText, { color: '#00F0FF' }]}>⚡ {user.xp ?? 0} XP</Text>
              </View>
            </View>

            {/* Cloud Sync Button */}
            <TouchableOpacity
              style={[styles.syncBtn, isSyncing && { opacity: 0.7 }]}
              onPress={handleManualSync}
              disabled={isSyncing}
              activeOpacity={0.8}
            >
              <CloudSyncIcon size={18} color="#FFC43D" />
              <Text style={styles.syncBtnText}>
                {isSyncing ? 'Veritabanı ile Senkronize Ediliyor...' : 'Bulut Veritabanı ile Eşitle'}
              </Text>
            </TouchableOpacity>

            {syncNotice && <Text style={styles.syncFeedbackText}>{syncNotice}</Text>}
          </View>
        )}

        {/* 2. Audio & Feedback Section */}
        <View style={styles.sectionHeader}>
          <SpeakerIcon size={18} color="#FFC43D" />
          <Text style={styles.sectionTitle}>Ses ve Geri Bildirim</Text>
        </View>

        <View style={styles.groupCard}>
          {/* SFX Toggle */}
          <View style={styles.itemRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.itemLabel}>Ses Efektleri</Text>
              <Text style={styles.itemSub}>Tıklama, soru sonuçları ve zafer sesleri</Text>
            </View>
            {renderToggle(sfxEnabled, () => {
              const next = !sfxEnabled;
              setSfxEnabled(next);
              sound.setSoundEnabled(next);
            })}
          </View>

          {/* SFX Volume Segmented Control */}
          {sfxEnabled && (
            <View style={styles.segmentedRow}>
              <Text style={styles.segmentedLabel}>Efekt Düzeyi</Text>
              <View style={styles.segmentedPills}>
                {(['25', '50', '75', '100'] as const).map((vol) => (
                  <TouchableOpacity
                    key={vol}
                    style={[styles.miniSegPill, sfxVolume === vol && styles.miniSegPillActive]}
                    onPress={() => {
                      sound.playSound('tap');
                      setSfxVolume(vol);
                    }}
                  >
                    <Text
                      style={[styles.miniSegPillText, sfxVolume === vol && styles.miniSegPillTextActive]}
                    >
                      %{vol}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Music Toggle */}
          <View style={styles.itemRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.itemLabel}>Arka Plan Müziği</Text>
              <Text style={styles.itemSub}>Lobi ve menü tema melodisi</Text>
            </View>
            {renderToggle(musicEnabled, () => setMusicEnabled((v) => !v))}
          </View>

          {/* Music Volume Segmented Control */}
          {musicEnabled && (
            <View style={styles.segmentedRow}>
              <Text style={styles.segmentedLabel}>Müzik Düzeyi</Text>
              <View style={styles.segmentedPills}>
                {(['25', '50', '75', '100'] as const).map((vol) => (
                  <TouchableOpacity
                    key={vol}
                    style={[styles.miniSegPill, musicVolume === vol && styles.miniSegPillActive]}
                    onPress={() => {
                      sound.playSound('tap');
                      setMusicVolume(vol);
                    }}
                  >
                    <Text
                      style={[styles.miniSegPillText, musicVolume === vol && styles.miniSegPillTextActive]}
                    >
                      %{vol}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Haptic Toggle */}
          <View style={styles.itemRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.itemLabel}>Titreşimli Geri Bildirim</Text>
              <Text style={styles.itemSub}>Tuş dokunuşları ve soru uyarıları</Text>
            </View>
            {renderToggle(hapticsEnabled, () => {
              const next = !hapticsEnabled;
              setHapticsEnabled(next);
              sound.setHapticsEnabled(next);
            })}
          </View>

          {/* Haptic Intensity */}
          {hapticsEnabled && (
            <View style={styles.segmentedRow}>
              <Text style={styles.segmentedLabel}>Titreşim Şiddeti</Text>
              <View style={styles.segmentedPills}>
                {(
                  [
                    ['light', 'Hafif'],
                    ['medium', 'Orta'],
                    ['strong', 'Güçlü'],
                  ] as const
                ).map(([key, label]) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.miniSegPill, hapticIntensity === key && styles.miniSegPillActive]}
                    onPress={() => {
                      sound.playSound('tap');
                      sound.triggerHaptic(key);
                      setHapticIntensity(key);
                    }}
                  >
                    <Text
                      style={[
                        styles.miniSegPillText,
                        hapticIntensity === key && styles.miniSegPillTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Timer Alert Sound */}
          <View style={[styles.itemRow, { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.itemLabel}>Süre Uyarı Sesi</Text>
              <Text style={styles.itemSub}>Son 5 saniyede geri sayım uyarısı</Text>
            </View>
            {renderToggle(timerAlertSound, () => setTimerAlertSound((v) => !v))}
          </View>
        </View>

        {/* 3. Gameplay & Competition Section */}
        <View style={styles.sectionHeader}>
          <GamepadIcon size={18} color="#FFC43D" />
          <Text style={styles.sectionTitle}>Yarışma ve Oyun Tercihleri</Text>
        </View>

        <View style={styles.groupCard}>
          {/* Default Difficulty */}
          <View style={styles.segmentedRow}>
            <Text style={styles.segmentedLabel}>Varsayılan Zorluk</Text>
            <View style={styles.segmentedPills}>
              {(
                [
                  ['easy', 'Kolay'],
                  ['medium', 'Orta'],
                  ['hard', 'Zor'],
                ] as const
              ).map(([diff, label]) => (
                <TouchableOpacity
                  key={diff}
                  style={[styles.miniSegPill, defaultDifficulty === diff && styles.miniSegPillActive]}
                  onPress={() => {
                    sound.playSound('tap');
                    setDefaultDifficulty(diff);
                  }}
                >
                  <Text
                    style={[
                      styles.miniSegPillText,
                      defaultDifficulty === diff && styles.miniSegPillTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Penalty for wrong answers */}
          <View style={styles.itemRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.itemLabel}>Yanlış Cevap Puan Kesintisi</Text>
              <Text style={styles.itemSub}>Rekabetçi maçlarda hatalı cevaplarda -10 RP</Text>
            </View>
            {renderToggle(penaltyForWrong, () => setPenaltyForWrong((v) => !v))}
          </View>

          {/* Auto next question */}
          <View style={[styles.itemRow, { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.itemLabel}>Otomatik Sonraki Soru</Text>
              <Text style={styles.itemSub}>Cevaplandıktan 1.5 sn sonra devam et</Text>
            </View>
            {renderToggle(autoNextQuestion, () => setAutoNextQuestion((v) => !v))}
          </View>
        </View>

        {/* 4. Privacy & WebSocket Presence Section */}
        <View style={styles.sectionHeader}>
          <ShieldIcon size={18} color="#FFC43D" />
          <Text style={styles.sectionTitle}>Gizlilik ve Çevrim İçi Durumu</Text>
        </View>

        <View style={styles.groupCard}>
          {/* Online Presence (Connected to Cloudflare Worker + Postgres) */}
          <View style={styles.itemRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.itemLabel}>Çevrim İçi Durumu</Text>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: onlineStatusVisible ? 'rgba(63,208,138,0.18)' : 'rgba(107,98,136,0.2)' },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: onlineStatusVisible ? '#3FD08A' : '#A594C9' },
                    ]}
                  >
                    {onlineStatusVisible ? 'Görünür' : 'Gizli'}
                  </Text>
                </View>
              </View>
              <Text style={styles.itemSub}>
                Diğer oyuncular arkadaş listesinde durumunuzu canlı olarak görebilir
              </Text>
            </View>
            {renderToggle(onlineStatusVisible, () => {
              const next = !onlineStatusVisible;
              setOnlineStatusVisible(next);
              if (user?.id) socketService.updatePresence(user.id, next);
            })}
          </View>

          {/* Duel Invites */}
          <View style={styles.itemRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.itemLabel}>1v1 Düello Davetleri</Text>
              <Text style={styles.itemSub}>Arkadaşlarınızdan gelen anlık maç bildirimleri</Text>
            </View>
            {renderToggle(duelInvitesAllowed, () => setDuelInvitesAllowed((v) => !v))}
          </View>

          {/* Friend Requests */}
          <View style={styles.itemRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.itemLabel}>Arkadaşlık İstekleri</Text>
              <Text style={styles.itemSub}>Kullanıcı koduyla gelen arkadaşlık talepleri</Text>
            </View>
            {renderToggle(friendRequestsAllowed, () => setFriendRequestsAllowed((v) => !v))}
          </View>

          {/* Public Profile */}
          <View style={[styles.itemRow, { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.itemLabel}>Herkese Açık Profil</Text>
              <Text style={styles.itemSub}>İstatistiklerinizin liderler tablosunda incelenebilmesi</Text>
            </View>
            {renderToggle(profilePublic, () => setProfilePublic((v) => !v))}
          </View>
        </View>

        {/* 5. Account Security & Session Section */}
        <View style={styles.sectionHeader}>
          <KeyIcon size={18} color="#FFC43D" />
          <Text style={styles.sectionTitle}>Hesap ve Güvenlik</Text>
        </View>

        <View style={styles.accountCard}>
          {user && !(user as any).isGuest && (
            <TouchableOpacity
              style={styles.changePwBtn}
              onPress={() => {
                sound.playSound('tap');
                setPwMessage(null);
                setPwModalVisible(true);
              }}
              activeOpacity={0.8}
            >
              <KeyIcon size={18} color="#FFC43D" />
              <Text style={styles.changePwBtnText}>Şifre Değiştir</Text>
            </TouchableOpacity>
          )}

          {/* Safe Logout Button */}
          <Button3D
            title="GÜVENLİ ÇIKIŞ YAP"
            variant="gold"
            onPress={() => {
              sound.playSound('tap');
              onLogout();
            }}
            style={{ width: '100%', minHeight: 46, marginTop: 8 }}
            textStyle={{ fontSize: 14 }}
          />

          <Text style={styles.logoutDisclaimer}>
            Oturumu kapattığınızda altınlarınız, elmaslarınız ve seviyeniz PostgreSQL veritabanında güvenle saklanır; tekrar giriş yaptığınızda kaldığınız yerden devam edersiniz.
          </Text>

          {/* Delete Account */}
          <TouchableOpacity
            style={styles.deleteAccountBtn}
            onPress={() => {
              sound.playSound('wrong');
              sound.triggerHaptic('warning');
              setDeleteModalVisible(true);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.deleteAccountBtnText}>Hesabımı Kalıcı Olarak Sil</Text>
          </TouchableOpacity>
        </View>

        {/* System & Build Footer */}
        <View style={styles.footerWrap}>
          <Text style={styles.footerVersion}>Tavriko Arena · Sürüm 2.4.0</Text>
          <Text style={styles.footerArchitecture}>
            PostgreSQL (Prisma) · Cloudflare Realtime WebSocket DO
          </Text>
        </View>
      </ScrollView>

      {/* Password Change Modal */}
      <Modal
        visible={pwModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPwModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <KeyIcon size={24} color="#FFC43D" />
              <Text style={styles.modalTitle}>Şifre Değiştir</Text>
            </View>
            <Text style={styles.modalDesc}>
              Hesap güvenliğiniz için en az 6 karakterden oluşan güçlü bir şifre belirleyin.
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Mevcut şifre (varsa)"
              placeholderTextColor="rgba(217,205,245,0.4)"
              secureTextEntry
              value={currentPw}
              onChangeText={setCurrentPw}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Yeni şifre (en az 6 karakter)"
              placeholderTextColor="rgba(217,205,245,0.4)"
              secureTextEntry
              value={newPw}
              onChangeText={setNewPw}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Yeni şifre tekrar"
              placeholderTextColor="rgba(217,205,245,0.4)"
              secureTextEntry
              value={newPw2}
              onChangeText={setNewPw2}
              autoCapitalize="none"
            />

            {pwMessage && (
              <Text
                style={[
                  styles.modalMessage,
                  { color: pwMessage.ok ? '#3FD08A' : '#FF5A6A' },
                ]}
              >
                {pwMessage.text}
              </Text>
            )}

            <View style={styles.modalBtnRow}>
              <Button3D
                title="VAZGEÇ"
                variant="gold"
                disabled={pwLoading}
                onPress={() => setPwModalVisible(false)}
                style={{ flex: 1, minHeight: 44 }}
                textStyle={{ fontSize: 13 }}
              />
              <Button3D
                title={pwLoading ? 'KAYDEDİLİYOR...' : 'KAYDET'}
                variant="mint"
                disabled={pwLoading}
                onPress={handleChangePassword}
                style={{ flex: 1, minHeight: 44 }}
                textStyle={{ fontSize: 13 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.deleteModalTitle}>Hesabı Kalıcı Olarak Sil</Text>
            <Text style={styles.modalDesc}>
              Bu işlem geri alınamaz. Kazandığınız tüm altınlar, elmaslar, başarımlar ve arkadaş listeniz veritabanından tamamen silinecektir.
            </Text>

            <View style={styles.modalBtnRow}>
              <Button3D
                title="VAZGEÇ"
                variant="gold"
                disabled={isDeleting}
                onPress={() => setDeleteModalVisible(false)}
                style={{ flex: 1, minHeight: 44 }}
                textStyle={{ fontSize: 13 }}
              />
              <Button3D
                title={isDeleting ? 'SİLİNİYOR...' : 'EVET, SİL'}
                variant="red"
                disabled={isDeleting}
                onPress={handleConfirmDelete}
                style={{ flex: 1, minHeight: 44 }}
                textStyle={{ fontSize: 13 }}
              />
            </View>
            {isDeleting && <ActivityIndicator color="#FF5A6A" style={{ marginTop: 12 }} />}
          </View>
        </View>
      </Modal>
    </TavrikoScreen>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
    paddingTop: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 28,
    color: '#FFFFFF',
  },
  saveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  saveIndicatorSuccess: {
    backgroundColor: 'rgba(63, 208, 138, 0.15)',
  },
  saveIndicatorError: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  saveIndicatorText: {
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    color: '#D9CDF5',
  },

  // Account Card
  accountCard: {
    backgroundColor: 'rgba(26, 14, 56, 0.92)',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 16,
    marginBottom: 20,
    ...Platform.select({
      web: { boxShadow: '0 8px 30px rgba(0, 0, 0, 0.35)' },
      default: { elevation: 4 },
    }),
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: THEME.fonts.display,
  },
  accountHandle: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.body,
    marginTop: 1,
  },
  accountBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  levelBadge: {
    backgroundColor: 'rgba(107, 60, 255, 0.3)',
    borderWidth: 1,
    borderColor: '#A855F7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  levelBadgeText: {
    color: '#D9CDF5',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
  },
  verifiedBadge: {
    backgroundColor: 'rgba(63, 208, 138, 0.15)',
    borderWidth: 1,
    borderColor: '#3FD08A',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  verifiedBadgeText: {
    color: '#3FD08A',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
  },
  walletRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  walletPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(10, 4, 24, 0.6)',
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  walletText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 196, 61, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 196, 61, 0.4)',
  },
  syncBtnText: {
    color: '#FFC43D',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
  },
  syncFeedbackText: {
    color: '#3FD08A',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    marginTop: 8,
  },

  // Sections
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: THEME.fonts.display,
    letterSpacing: 0.3,
  },
  groupCard: {
    backgroundColor: 'rgba(26, 14, 56, 0.85)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 20,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  itemLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: THEME.fonts.extraBold,
  },
  itemSub: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.body,
    marginTop: 2,
    lineHeight: 15,
  },

  // Segmented Controls
  segmentedRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  segmentedLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
    marginBottom: 8,
  },
  segmentedPills: {
    flexDirection: 'row',
    gap: 6,
  },
  miniSegPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  miniSegPillActive: {
    backgroundColor: 'rgba(255, 196, 61, 0.2)',
    borderColor: '#FFC43D',
  },
  miniSegPillText: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  miniSegPillTextActive: {
    color: '#FFC43D',
  },

  // Toggle Switch
  switchTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 3,
    justifyContent: 'center',
  },
  switchTrackOn: {
    backgroundColor: '#3FD08A',
  },
  switchTrackOff: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  switchThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: { boxShadow: '0 2px 4px rgba(0,0,0,0.3)' },
      default: { elevation: 2 },
    }),
  },
  switchThumbOn: {
    alignSelf: 'flex-end',
  },
  switchThumbOff: {
    alignSelf: 'flex-start',
  },

  // Status Pill
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
  },

  // Password & Logout
  changePwBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 196, 61, 0.4)',
    backgroundColor: 'rgba(255, 196, 61, 0.08)',
    marginBottom: 6,
  },
  changePwBtnText: {
    color: '#FFC43D',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
  },
  logoutDisclaimer: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.body,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 16,
    paddingHorizontal: 4,
  },
  deleteAccountBtn: {
    marginTop: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  deleteAccountBtnText: {
    color: '#F87171',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },

  // Footer
  footerWrap: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  footerVersion: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  footerArchitecture: {
    color: 'rgba(217, 205, 245, 0.6)',
    fontSize: 10,
    fontFamily: THEME.fonts.body,
    marginTop: 2,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 3, 20, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1E0E45',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    padding: 20,
    ...Platform.select({
      web: { boxShadow: '0 16px 48px rgba(0,0,0,0.6)' },
      default: { elevation: 8 },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: THEME.fonts.display,
  },
  deleteModalTitle: {
    color: '#EF4444',
    fontSize: 18,
    fontFamily: THEME.fonts.display,
    marginBottom: 6,
  },
  modalDesc: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.body,
    lineHeight: 18,
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: 'rgba(10, 4, 24, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 10,
  },
  modalMessage: {
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    marginBottom: 10,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
});
