import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Modal,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { UserProfile, UserSettings } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import {
  TavrikoScreen,
  TavrikoTopBar,
  Button3D,
  CharacterAvatar,
  BRAND_APP_ICON,
  CoinTavrikoIcon,
  GemTavrikoIcon,
} from '../components/TavrikoIcons';

interface SettingsScreenProps {
  user?: UserProfile;
  apiBaseUrl?: string;
  onBack: () => void;
  onLogout: () => void;
  onDeleteAccount: () => Promise<void>;
  onDeveloper?: () => void;
  onSyncWallet?: () => Promise<void>;
  token?: string | null;
  onUpdateUser?: (updated: UserProfile) => void;
}

const SETTINGS_STORAGE_KEY = 'tavriko_user_settings_v1';

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
  // Saved settings: PostgreSQL (user.settings) takes precedence over local cache
  const saved: UserSettings = { ...loadLocalSettings(), ...((user?.settings as UserSettings) || {}) };
  const pick = <K extends keyof UserSettings>(key: K, fallback: NonNullable<UserSettings[K]>) =>
    (saved[key] ?? fallback) as NonNullable<UserSettings[K]>;

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  useEffect(() => {
    console.log('[SettingsScreen] Mount/Update | User:', {
      id: user?.id,
      email: user?.email,
      coins: user?.coins,
      gems: user?.gems,
      xp: user?.xp,
      level: user?.level,
    });
  }, [user]);

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
  const [ambientGlow, setAmbientGlow] = useState<boolean>(pick('ambientGlow', true));
  const [textSize, setTextSize] = useState<'normal' | 'large'>(pick('textSize', 'normal'));
  const [buttonSpring, setButtonSpring] = useState<boolean>(pick('buttonSpring', true));

  // Gameplay Preferences
  const [defaultDifficulty, setDefaultDifficulty] = useState<'easy' | 'medium' | 'hard'>(pick('defaultDifficulty', 'medium'));
  const [questionCount, setQuestionCount] = useState<number>(pick('questionCount', 5));
  const [questionTimeSec, setQuestionTimeSec] = useState<number>(pick('questionTimeSec', 20));
  const [penaltyForWrong, setPenaltyForWrong] = useState<boolean>(pick('penaltyForWrong', true));
  const [autoNextQuestion, setAutoNextQuestion] = useState<boolean>(pick('autoNextQuestion', true));
  const [doubleTapProtection, setDoubleTapProtection] = useState<boolean>(pick('doubleTapProtection', false));

  // Social & Privacy
  const [notifsEnabled, setNotifsEnabled] = useState<boolean>(pick('notifsEnabled', true));
  const [duelInvitesAllowed, setDuelInvitesAllowed] = useState<boolean>(pick('duelInvitesAllowed', true));
  const [roomInvitesAllowed, setRoomInvitesAllowed] = useState<boolean>(pick('roomInvitesAllowed', true));
  const [onlineStatusVisible, setOnlineStatusVisible] = useState<boolean>(pick('onlineStatusVisible', true));
  const [profilePublic, setProfilePublic] = useState<boolean>(pick('profilePublic', true));
  const [friendRequestsAllowed, setFriendRequestsAllowed] = useState<boolean>(pick('friendRequestsAllowed', true));

  // Notifications
  const [dailyReminder, setDailyReminder] = useState<boolean>(pick('dailyReminder', true));
  const [seasonAlerts, setSeasonAlerts] = useState<boolean>(pick('seasonAlerts', true));
  const [friendActivity, setFriendActivity] = useState<boolean>(pick('friendActivity', true));

  // Persistence status
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'local' | 'error'>('idle');
  const isFirstRenderRef = useRef(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Password change modal
  const [pwModalVisible, setPwModalVisible] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const currentSettings: UserSettings = {
    sfxEnabled, sfxVolume, musicEnabled, musicVolume, hapticsEnabled, hapticIntensity,
    timerAlertSound, victoryMelody, smoothAnimations, batterySaver, ambientGlow, textSize,
    buttonSpring, defaultDifficulty, questionCount, questionTimeSec, penaltyForWrong,
    autoNextQuestion, doubleTapProtection, notifsEnabled, duelInvitesAllowed, roomInvitesAllowed,
    onlineStatusVisible, profilePublic, friendRequestsAllowed, dailyReminder, seasonAlerts,
    friendActivity,
  };
  const settingsSignature = JSON.stringify(currentSettings);

  // Apply audio/haptic engine state whenever relevant settings change
  useEffect(() => {
    const vol01 = (v: string) => Math.min(1, Math.max(0, Number(v) / 100));
    sound.setSoundEnabled(sfxEnabled);
    sound.setSoundVolume(vol01(sfxVolume));
    sound.setHapticsEnabled(hapticsEnabled);
    sound.setHapticIntensity(hapticIntensity);
    sound.setMusicEnabled(musicEnabled);
    sound.setMusicVolume(vol01(musicVolume));
  }, [sfxEnabled, sfxVolume, hapticsEnabled, hapticIntensity, musicEnabled, musicVolume]);

  // Debounced persistence: localStorage immediately, PostgreSQL via POST /auth/settings
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    saveLocalSettings(currentSettings);
    if (!user || (user as any).isGuest) {
      setSaveStatus('local');
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
        console.log('✅ [SettingsScreen] Ayarlar PostgreSQL veritabanına kaydedildi.');
        setSaveStatus('saved');
        if (data?.user && onUpdateUser) onUpdateUser(data.user);
      } catch (err: any) {
        console.warn('⚠️ [SettingsScreen] Ayarlar sunucuya kaydedilemedi:', err?.message);
        setSaveStatus('error');
      }
    }, 600);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsSignature]);

  const handleChangePassword = async () => {
    setPwMessage(null);
    if (newPw.length < 6) {
      setPwMessage({ ok: false, text: 'Yeni şifre en az 6 karakter olmalıdır.' });
      return;
    }
    if (newPw !== newPw2) {
      setPwMessage({ ok: false, text: 'Yeni şifreler birbiriyle eşleşmiyor.' });
      return;
    }
    if (!token) {
      setPwMessage({ ok: false, text: 'Oturum doğrulanamadı. Lütfen çıkış yapıp tekrar giriş yapın.' });
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
      if (!res.ok || data?.success === false) throw new Error(data?.error || data?.message || 'Şifre değiştirilemedi.');
      sound.playSound('reward');
      sound.triggerHaptic('success');
      setPwMessage({ ok: true, text: '✓ Şifreniz başarıyla güncellendi.' });
      setCurrentPw('');
      setNewPw('');
      setNewPw2('');
      setTimeout(() => {
        setPwModalVisible(false);
        setPwMessage(null);
      }, 1500);
    } catch (err: any) {
      sound.playSound('wrong');
      setPwMessage({ ok: false, text: err?.message || 'Şifre değiştirilemedi.' });
    } finally {
      setPwLoading(false);
    }
  };

  // Feedback & Modal state
  const [cacheClearedNotice, setCacheClearedNotice] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const renderSwitch = (value: boolean, onToggle: () => void) => (
    <TouchableOpacity
      style={[
        styles.switchTrack,
        { backgroundColor: value ? '#3FD08A' : '#3A2E5E' },
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
          value ? { right: 3 } : { left: 3 },
        ]}
      />
    </TouchableOpacity>
  );

  const handleManualSync = async () => {
    if (!onSyncWallet || isSyncing) return;
    setIsSyncing(true);
    sound.playSound('tap');
    sound.triggerHaptic('light');
    try {
      await onSyncWallet();
      sound.playSound('reward');
      sound.triggerHaptic('success');
      setSyncNotice(`✓ Buluta Yazıldı! (${user?.coins ?? 0} Altın, ${user?.gems ?? 0} Elmas)`);
      setTimeout(() => setSyncNotice(null), 3500);
    } catch {
      setSyncNotice('❌ Senkronizasyon sırasında hata oluştu.');
      setTimeout(() => setSyncNotice(null), 3500);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearCache = () => {
    sound.playSound('reward');
    sound.triggerHaptic('success');
    setCacheClearedNotice(true);
    setTimeout(() => setCacheClearedNotice(false), 2500);
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
        <Text style={styles.title}>AYARLAR</Text>
        {saveStatus !== 'idle' && (
          <Text
            style={[
              styles.saveStatusText,
              saveStatus === 'error' && { color: '#FF5A6A' },
              saveStatus === 'saved' && { color: '#3FD08A' },
            ]}
          >
            {saveStatus === 'saving' && '⏳ Ayarlar veritabanına kaydediliyor...'}
            {saveStatus === 'saved' && '✓ Ayarlar PostgreSQL veritabanına kaydedildi'}
            {saveStatus === 'local' && '💾 Misafir modu: ayarlar yalnızca bu cihazda saklanıyor'}
            {saveStatus === 'error' && '⚠️ Sunucuya kaydedilemedi, bu cihazda saklandı'}
          </Text>
        )}

        {/* 1. Account Summary & Live Cloud Persistence Card */}
        {user && (
          <View style={styles.profileCard}>
            <View style={styles.profileRow}>
              <CharacterAvatar
                seed={user.avatarUrl || user.displayName}
                size={54}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.profileDisplayName} numberOfLines={1}>
                  {user.displayName}
                </Text>
                <Text style={styles.profileUsername}>
                  @{user.username || 'oyuncu'} {user.email ? `· ${user.email}` : ''}
                </Text>
                <View style={styles.levelBadgeRow}>
                  <View style={styles.levelBadge}>
                    <Text style={styles.levelBadgeText}>
                      Seviye {user.level} · {user.rankTitle || 'Acemi Kaşif'}
                    </Text>
                  </View>
                  <View style={styles.verifiedBadge}>
                    <Text style={styles.verifiedBadgeText}>✓ Supabase Bulut Koruması</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Live Wallet Balances */}
            <View style={styles.walletDisplayRow}>
              <View style={styles.walletStatPill}>
                <CoinTavrikoIcon size={18} />
                <Text style={styles.walletStatText}>{user.coins ?? 0} Altın</Text>
              </View>
              <View style={styles.walletStatPill}>
                <GemTavrikoIcon size={18} />
                <Text style={styles.walletStatText}>{user.gems ?? 0} Elmas</Text>
              </View>
              <View style={styles.walletStatPill}>
                <Text style={[styles.walletStatText, { color: '#00F0FF' }]}>⚡ {user.xp ?? 0} XP</Text>
              </View>
            </View>

            {/* Cloud Sync CTA Button */}
            <TouchableOpacity
              style={[styles.syncButton, isSyncing && { opacity: 0.7 }]}
              onPress={handleManualSync}
              disabled={isSyncing}
              activeOpacity={0.8}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color="#FFC43D" />
              ) : (
                <Text style={styles.syncButtonText}>☁️ Veritabanı ile Şimdi Senkronize Et</Text>
              )}
            </TouchableOpacity>

            {syncNotice && (
              <Text style={styles.syncSuccessNotice}>{syncNotice}</Text>
            )}

            <Text style={styles.syncNoticeText}>
              🛡️ Oturumu kapatsanız veya sayfayı yenileseniz dahi altınlarınız ({user.coins ?? 0}) ve elmaslarınız ({user.gems ?? 0}) silinmez; yalnızca "Hesabımı Kalıcı Olarak Sil" dendiğinde sıfırlanır.
            </Text>
          </View>
        )}

        {/* 2. Audio & Haptics */}
        <Text style={styles.sectionHeader}>SES VE GERİ BİLDİRİM</Text>
        <View style={styles.groupCard}>
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Ses Efektleri</Text>
              <Text style={styles.settingSub}>Tıklama, doğru/yanlış ve zafer sesleri</Text>
            </View>
            {renderSwitch(sfxEnabled, () => {
              const next = !sfxEnabled;
              setSfxEnabled(next);
              sound.setSoundEnabled(next);
            })}
          </View>

          {sfxEnabled && (
            <View style={styles.multiChoiceRow}>
              <Text style={styles.settingLabel}>Efekt Ses Düzeyi</Text>
              <View style={styles.pillSelectorRow}>
                {(['25', '50', '75', '100'] as const).map((vol) => {
                  const active = sfxVolume === vol;
                  return (
                    <TouchableOpacity
                      key={vol}
                      style={[styles.miniPill, active && styles.miniPillActive]}
                      onPress={() => {
                        sound.playSound('tap');
                        setSfxVolume(vol);
                      }}
                    >
                      <Text style={[styles.miniPillText, active && styles.miniPillTextActive]}>
                        %{vol}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Arka Plan Müziği</Text>
              <Text style={styles.settingSub}>Lobi ve menü tema ezgileri</Text>
            </View>
            {renderSwitch(musicEnabled, () => setMusicEnabled((v) => !v))}
          </View>

          {musicEnabled && (
            <View style={styles.multiChoiceRow}>
              <Text style={styles.settingLabel}>Müzik Ses Düzeyi</Text>
              <View style={styles.pillSelectorRow}>
                {(['25', '50', '75', '100'] as const).map((vol) => {
                  const active = musicVolume === vol;
                  return (
                    <TouchableOpacity
                      key={vol}
                      style={[styles.miniPill, active && styles.miniPillActive]}
                      onPress={() => {
                        sound.playSound('tap');
                        setMusicVolume(vol);
                      }}
                    >
                      <Text style={[styles.miniPillText, active && styles.miniPillTextActive]}>
                        %{vol}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Haptik Titreşim</Text>
              <Text style={styles.settingSub}>Buton dokunuşları ve soru geri bildirimleri</Text>
            </View>
            {renderSwitch(hapticsEnabled, () => {
              const next = !hapticsEnabled;
              setHapticsEnabled(next);
              sound.setHapticsEnabled(next);
            })}
          </View>

          {hapticsEnabled && (
            <View style={styles.multiChoiceRow}>
              <Text style={styles.settingLabel}>Titreşim Şiddeti</Text>
              <View style={styles.pillSelectorRow}>
                {[
                  { id: 'light', label: 'Hafif' },
                  { id: 'medium', label: 'Dengeli' },
                  { id: 'strong', label: 'Güçlü' },
                ].map((item) => {
                  const active = hapticIntensity === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.miniPill, active && styles.miniPillActive]}
                      onPress={() => {
                        sound.playSound('tap');
                        sound.triggerHaptic(item.id as any);
                        setHapticIntensity(item.id as any);
                      }}
                    >
                      <Text style={[styles.miniPillText, active && styles.miniPillTextActive]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Süre Uyarı Sesi</Text>
              <Text style={styles.settingSub}>Son 3 saniye geri sayım tik sesi</Text>
            </View>
            {renderSwitch(timerAlertSound, () => setTimerAlertSound((v) => !v))}
          </View>

          <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
            <View>
              <Text style={styles.settingLabel}>Zafer & Podyum Melodisi</Text>
              <Text style={styles.settingSub}>Maç sonunda ödül ve kupa şölen müziği</Text>
            </View>
            {renderSwitch(victoryMelody, () => setVictoryMelody((v) => !v))}
          </View>
        </View>

        {/* 3. Visual & Performance */}
        <Text style={styles.sectionHeader}>GÖRSEL VE PERFORMANS</Text>
        <View style={styles.groupCard}>
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>60 FPS Ultra Akıcı Animasyonlar</Text>
              <Text style={styles.settingSub}>Ultra pürüzsüz kart ve soru geçişleri</Text>
            </View>
            {renderSwitch(smoothAnimations, () => setSmoothAnimations((v) => !v))}
          </View>

          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Pil Tasarruf Modu</Text>
              <Text style={styles.settingSub}>Efektleri hafifleterek cihaz şarjını korur</Text>
            </View>
            {renderSwitch(batterySaver, () => setBatterySaver((v) => !v))}
          </View>

          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Arka Plan Parıltıları & Nebula</Text>
              <Text style={styles.settingSub}>Neon nebula ve karanlık uzay parlamaları</Text>
            </View>
            {renderSwitch(ambientGlow, () => setAmbientGlow((v) => !v))}
          </View>

          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Buton Yaylanma Efekti (3D Bounce)</Text>
              <Text style={styles.settingSub}>Dokunulduğunda yaylanan buton hissiyatı</Text>
            </View>
            {renderSwitch(buttonSpring, () => setButtonSpring((v) => !v))}
          </View>

          <View style={[styles.multiChoiceRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.settingLabel}>Soru Metin Boyutu</Text>
            <View style={styles.pillSelectorRow}>
              {[
                { id: 'normal', label: 'Standart (16px)' },
                { id: 'large', label: 'Büyük (19px)' },
              ].map((item) => {
                const active = textSize === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.miniPill, active && styles.miniPillActive]}
                    onPress={() => {
                      sound.playSound('tap');
                      setTextSize(item.id as any);
                    }}
                  >
                    <Text style={[styles.miniPillText, active && styles.miniPillTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* 4. Gameplay Preferences */}
        <Text style={styles.sectionHeader}>YARIŞMA TERCİHLERİ</Text>
        <View style={styles.groupCard}>
          <View style={styles.multiChoiceRow}>
            <Text style={styles.settingLabel}>Varsayılan Zorluk</Text>
            <View style={styles.pillSelectorRow}>
              {(['easy', 'medium', 'hard'] as const).map((diff) => {
                const label = diff === 'easy' ? 'Kolay' : diff === 'medium' ? 'Orta' : 'Zor';
                const active = defaultDifficulty === diff;
                return (
                  <TouchableOpacity
                    key={diff}
                    style={[styles.miniPill, active && styles.miniPillActive]}
                    onPress={() => {
                      sound.playSound('tap');
                      setDefaultDifficulty(diff);
                    }}
                  >
                    <Text style={[styles.miniPillText, active && styles.miniPillTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.multiChoiceRow}>
            <Text style={styles.settingLabel}>Soru Başı Süre</Text>
            <View style={styles.pillSelectorRow}>
              {[15, 20, 30].map((sec) => {
                const active = questionTimeSec === sec;
                return (
                  <TouchableOpacity
                    key={sec}
                    style={[styles.miniPill, active && styles.miniPillActive]}
                    onPress={() => {
                      sound.playSound('tap');
                      setQuestionTimeSec(sec);
                    }}
                  >
                    <Text style={[styles.miniPillText, active && styles.miniPillTextActive]}>
                      {sec} sn
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.multiChoiceRow}>
            <Text style={styles.settingLabel}>Tur Soru Sayısı</Text>
            <View style={styles.pillSelectorRow}>
              {[5, 7, 10, 15].map((count) => {
                const active = questionCount === count;
                return (
                  <TouchableOpacity
                    key={count}
                    style={[styles.miniPill, active && styles.miniPillActive]}
                    onPress={() => {
                      sound.playSound('tap');
                      setQuestionCount(count);
                    }}
                  >
                    <Text style={[styles.miniPillText, active && styles.miniPillTextActive]}>
                      {count} Soru
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Yanlış Cevap Cezası</Text>
              <Text style={styles.settingSub}>Özel odalarda yanlış cevap başına -50 puan</Text>
            </View>
            {renderSwitch(penaltyForWrong, () => setPenaltyForWrong((v) => !v))}
          </View>

          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Otomatik Soru Geçişi</Text>
              <Text style={styles.settingSub}>Tüm oyuncular cevapladığında beklemeden geç</Text>
            </View>
            {renderSwitch(autoNextQuestion, () => setAutoNextQuestion((v) => !v))}
          </View>

          <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
            <View>
              <Text style={styles.settingLabel}>Çift Dokunma Koruması</Text>
              <Text style={styles.settingSub}>Yanlışlıkla şıkka basmayı önlemek için teyit ister</Text>
            </View>
            {renderSwitch(doubleTapProtection, () => setDoubleTapProtection((v) => !v))}
          </View>
        </View>

        {/* 5. Social & Privacy */}
        <Text style={styles.sectionHeader}>GİZLİLİK VE SOSYAL</Text>
        <View style={styles.groupCard}>
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Oyun Bildirimleri</Text>
              <Text style={styles.settingSub}>Arkadaşlık ve ödül bildirimleri</Text>
            </View>
            {renderSwitch(notifsEnabled, () => setNotifsEnabled((v) => !v))}
          </View>

          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>1v1 Düello Davetleri</Text>
              <Text style={styles.settingSub}>Arkadaşlardan gelen meydan okumalara izin ver</Text>
            </View>
            {renderSwitch(duelInvitesAllowed, () => setDuelInvitesAllowed((v) => !v))}
          </View>

          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Özel Oda Davetleri</Text>
              <Text style={styles.settingSub}>Arkadaşların seni doğrudan odasına çekebilsin</Text>
            </View>
            {renderSwitch(roomInvitesAllowed, () => setRoomInvitesAllowed((v) => !v))}
          </View>

          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Çevrimiçi Durumu</Text>
              <Text style={styles.settingSub}>Arkadaş listesinde aktif görün</Text>
            </View>
            {renderSwitch(onlineStatusVisible, () => setOnlineStatusVisible((v) => !v))}
          </View>

          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Arkadaşlık İstekleri</Text>
              <Text style={styles.settingSub}>Yeni arkadaşlık tekliflerine açık ol</Text>
            </View>
            {renderSwitch(friendRequestsAllowed, () => setFriendRequestsAllowed((v) => !v))}
          </View>

          <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
            <View>
              <Text style={styles.settingLabel}>Herkese Açık Profil</Text>
              <Text style={styles.settingSub}>İstatistikler ve rozetler lider tablosunda görünsün</Text>
            </View>
            {renderSwitch(profilePublic, () => setProfilePublic((v) => !v))}
          </View>
        </View>

        {/* 6. Notifications & Alerts */}
        <Text style={styles.sectionHeader}>BİLDİRİMLER VE ETKİNLİKLER</Text>
        <View style={styles.groupCard}>
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Günlük Görev Hatırlatıcısı</Text>
              <Text style={styles.settingSub}>Serini kaybetmemek için her akşam uyarı al</Text>
            </View>
            {renderSwitch(dailyReminder, () => setDailyReminder((v) => !v))}
          </View>

          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Yeni Sezon & Etkinlikler</Text>
              <Text style={styles.settingSub}>Özel ödüllü turnuvalardan ilk senin haberin olsun</Text>
            </View>
            {renderSwitch(seasonAlerts, () => setSeasonAlerts((v) => !v))}
          </View>

          <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
            <View>
              <Text style={styles.settingLabel}>Arkadaş Giriş Bildirimi</Text>
              <Text style={styles.settingSub}>Yakın arkadaşların lobiye girdiğinde haber ver</Text>
            </View>
            {renderSwitch(friendActivity, () => setFriendActivity((v) => !v))}
          </View>
        </View>

        {/* 7. Storage & System */}
        <Text style={styles.sectionHeader}>DEPOLAMA VE SİSTEM</Text>
        <View style={styles.groupCard}>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={handleClearCache}
            activeOpacity={0.8}
          >
            <View>
              <Text style={styles.settingLabel}>Önbelleği Temizle</Text>
              <Text style={styles.settingSub}>Geçici ses ve grafik önbelleğini tazele</Text>
            </View>
            <Text style={styles.settingRightSub}>
              {cacheClearedNotice ? '✓ Temizlendi' : 'Temizle ›'}
            </Text>
          </TouchableOpacity>

          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Uygulama Dili</Text>
              <Text style={styles.settingSub}>Türkçe (Türkiye)</Text>
            </View>
            <Text style={styles.settingRightSub}>Değiştir ›</Text>
          </View>

          <TouchableOpacity
            style={[styles.settingRow, { borderBottomWidth: 0 }]}
            onPress={() => {
              sound.playSound('tap');
              if (onDeveloper) {
                onDeveloper();
              }
            }}
          >
            <View>
              <Text style={[styles.settingLabel, { color: '#FFC43D' }]}>
                🛡️ Geliştirici & Ops Paneli
              </Text>
              <Text style={styles.settingSub}>Sunucu durumları, DO podları ve canlı sistem logları</Text>
            </View>
            <Text style={[styles.settingRightSub, { color: '#FFC43D' }]}>Aç ›</Text>
          </TouchableOpacity>
        </View>

        {/* 8. Account Session & Delete Section */}
        <Text style={styles.sectionHeader}>HESAP VE GÜVENLİK</Text>
        <View style={styles.accountActionBox}>
          {/* Change Password */}
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
              <Text style={styles.changePwBtnText}>🔑 Şifre Değiştir / Şifre Belirle</Text>
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
            style={{ width: '100%', minHeight: 46 }}
            textStyle={{ fontSize: 14 }}
          />
          <Text style={styles.logoutNoticeText}>
            ℹ️ Oturumu kapattığınızda altınlarınız ({user?.coins ?? 0}), elmaslarınız ({user?.gems ?? 0}) ve seviyeniz silinmez; tekrar giriş yaptığınızda kaldığınız yerden devam edersiniz.
          </Text>

          {/* Delete Account Button */}
          <TouchableOpacity
            style={styles.deleteAccountBtn}
            onPress={() => {
              sound.playSound('wrong');
              sound.triggerHaptic('warning');
              setDeleteModalVisible(true);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.deleteAccountBtnText}>⚠️ Hesabımı Kalıcı Olarak Sil</Text>
          </TouchableOpacity>
        </View>

        {/* Footer Brand & Version */}
        <View style={styles.footerBrand}>
          <Image
            source={BRAND_APP_ICON}
            style={styles.appIcon}
            resizeMode="cover"
          />
          <Text style={styles.versionText}>Tavriko Arena · v1.2.0 (Production Build)</Text>
          <Text style={styles.versionSubText}>Supabase PostgreSQL + Cloudflare Realtime DO Engine</Text>
        </View>
      </ScrollView>

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalWarningTitle}>⚠️ HESABINIZI SİLMEK ÜZERESİNİZ</Text>
            <Text style={styles.modalWarningDesc}>
              Bu işlem geri alınamaz! Hesabınız, kazandığınız tüm altınlar, elmaslar, seviyeniz, maç geçmişiniz ve arkadaş listeniz sunucudan kalıcı olarak silinecektir.
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
            {isDeleting && (
              <ActivityIndicator color="#FF5A6A" style={{ marginTop: 14 }} />
            )}
          </View>
        </View>
      </Modal>

      {/* Password Change Modal */}
      <Modal
        visible={pwModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPwModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={[styles.modalWarningTitle, { color: '#FFC43D' }]}>🔑 ŞİFRE DEĞİŞTİR</Text>
            <Text style={styles.modalWarningDesc}>
              Google ile giriş yaptıysanız ve henüz şifreniz yoksa "Mevcut Şifre" alanını boş bırakabilirsiniz.
            </Text>
            <TextInput
              style={styles.pwInput}
              placeholder="Mevcut şifre"
              placeholderTextColor="rgba(217,205,245,0.45)"
              secureTextEntry
              value={currentPw}
              onChangeText={setCurrentPw}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.pwInput}
              placeholder="Yeni şifre (en az 6 karakter)"
              placeholderTextColor="rgba(217,205,245,0.45)"
              secureTextEntry
              value={newPw}
              onChangeText={setNewPw}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.pwInput}
              placeholder="Yeni şifre (tekrar)"
              placeholderTextColor="rgba(217,205,245,0.45)"
              secureTextEntry
              value={newPw2}
              onChangeText={setNewPw2}
              autoCapitalize="none"
            />
            {pwMessage && (
              <Text style={[styles.pwMessage, { color: pwMessage.ok ? '#3FD08A' : '#FF5A6A' }]}>
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
    </TavrikoScreen>
  );
};

const styles = StyleSheet.create({
  saveStatusText: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    marginBottom: 10,
  },
  changePwBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 196, 61, 0.5)',
    backgroundColor: 'rgba(255, 196, 61, 0.1)',
    alignItems: 'center',
    marginBottom: 12,
  },
  changePwBtnText: {
    color: '#FFC43D',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
  },
  pwInput: {
    width: '100%',
    backgroundColor: 'rgba(10, 4, 24, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
    marginBottom: 10,
  },
  pwMessage: {
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    marginBottom: 8,
  },
  scrollContent: {
    paddingBottom: 48,
    paddingHorizontal: 2,
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 34,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 14,
    letterSpacing: 0.5,
  },
  profileCard: {
    padding: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    marginBottom: 16,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileDisplayName: {
    color: '#FFFFFF',
    fontFamily: THEME.fonts.display,
    fontSize: 18,
    letterSpacing: 0.3,
  },
  profileUsername: {
    color: '#D9CDF5',
    fontFamily: THEME.fonts.extraBold,
    fontSize: 12,
    marginTop: 2,
  },
  levelBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  levelBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 196, 61, 0.2)',
    borderWidth: 1,
    borderColor: '#FFC43D',
  },
  levelBadgeText: {
    color: '#FFC43D',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  verifiedBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(63, 208, 138, 0.2)',
    borderWidth: 1,
    borderColor: '#3FD08A',
  },
  verifiedBadgeText: {
    color: '#3FD08A',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  walletDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  walletStatPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  walletStatText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  syncButton: {
    marginTop: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 196, 61, 0.15)',
    borderWidth: 1,
    borderColor: '#FFC43D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncButtonText: {
    color: '#FFC43D',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  syncSuccessNotice: {
    color: '#3FD08A',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    marginTop: 6,
  },
  syncNoticeText: {
    color: 'rgba(217, 205, 245, 0.8)',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    marginTop: 10,
    lineHeight: 15,
  },
  sectionHeader: {
    fontFamily: THEME.fonts.extraBold,
    fontSize: 12,
    color: '#FFC43D',
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 6,
  },
  groupCard: {
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    overflow: 'hidden',
    marginBottom: 10,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    gap: 12,
  },
  multiChoiceRow: {
    flexDirection: 'column',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    gap: 10,
  },
  settingLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: THEME.fonts.extraBold,
  },
  settingSub: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    marginTop: 2,
    lineHeight: 14,
  },
  settingRightSub: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  pillSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  miniPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniPillActive: {
    backgroundColor: '#6B3CFF',
    borderColor: '#FFC43D',
  },
  miniPillText: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  miniPillTextActive: {
    color: '#FFFFFF',
  },
  switchTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  switchThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    position: 'absolute',
  },
  accountActionBox: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 20,
    gap: 12,
  },
  logoutNoticeText: {
    color: 'rgba(217, 205, 245, 0.75)',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
    lineHeight: 15,
  },
  deleteAccountBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 90, 106, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 90, 106, 0.35)',
    marginTop: 4,
  },
  deleteAccountBtnText: {
    color: '#FF5A6A',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
  },
  footerBrand: {
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  appIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    marginBottom: 4,
  },
  versionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  versionSubText: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    padding: 20,
    borderRadius: 24,
    backgroundColor: '#1E1238',
    borderWidth: 1.5,
    borderColor: '#FF5A6A',
    alignItems: 'center',
  },
  modalWarningTitle: {
    color: '#FF5A6A',
    fontFamily: THEME.fonts.display,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 10,
  },
  modalWarningDesc: {
    color: '#D9CDF5',
    fontFamily: THEME.fonts.extraBold,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
});
