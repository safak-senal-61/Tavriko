import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { UserProfile } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import {
  TavrikoScreen,
  TavrikoTopBar,
  Button3D,
  CharacterAvatar,
  BRAND_APP_ICON,
} from '../components/TavrikoIcons';

interface SettingsScreenProps {
  user?: UserProfile;
  apiBaseUrl?: string;
  onBack: () => void;
  onLogout: () => void;
  onDeleteAccount: () => Promise<void>;
  onDeveloper?: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  user,
  apiBaseUrl,
  onBack,
  onLogout,
  onDeleteAccount,
  onDeveloper,
}) => {
  // Audio & Haptics
  const [sfxEnabled, setSfxEnabled] = useState(sound.isSoundEnabled());
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [hapticsEnabled, setHapticsEnabled] = useState(sound.isHapticsEnabled());
  const [timerAlertSound, setTimerAlertSound] = useState(true);

  // Visual & Performance
  const [smoothAnimations, setSmoothAnimations] = useState(true);
  const [batterySaver, setBatterySaver] = useState(false);
  const [ambientGlow, setAmbientGlow] = useState(true);

  // Gameplay Preferences
  const [defaultDifficulty, setDefaultDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [questionTimeSec, setQuestionTimeSec] = useState<number>(20);

  // Social & Privacy
  const [notifsEnabled, setNotifsEnabled] = useState(true);
  const [onlineStatusVisible, setOnlineStatusVisible] = useState(true);
  const [duelInvitesAllowed, setDuelInvitesAllowed] = useState(true);
  const [profilePublic, setProfilePublic] = useState(true);

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

        {/* 1. Account Summary Card */}
        {user && (
          <View style={styles.profileCard}>
            <View style={styles.profileRow}>
              <CharacterAvatar
                seed={user.avatarUrl || user.displayName}
                size={52}
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
                    <Text style={styles.verifiedBadgeText}>✓ Güvenli Oturum</Text>
                  </View>
                </View>
              </View>
            </View>
            <Text style={styles.syncNoticeText}>
              🛡️ Seviyeniz, altınlarınız ({user.coins ?? 0}) ve elmaslarınız ({user.gems ?? 0}) hesabınıza kaydedilir.
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
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Arka Plan Müziği</Text>
              <Text style={styles.settingSub}>Lobi ve menü tema ezgileri</Text>
            </View>
            {renderSwitch(musicEnabled, () => setMusicEnabled((v) => !v))}
          </View>
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
          <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
            <View>
              <Text style={styles.settingLabel}>Süre Uyarı Sesi</Text>
              <Text style={styles.settingSub}>Son 3 saniye geri sayım tik sesi</Text>
            </View>
            {renderSwitch(timerAlertSound, () => setTimerAlertSound((v) => !v))}
          </View>
        </View>

        {/* 3. Visual & Performance */}
        <Text style={styles.sectionHeader}>GÖRSEL VE PERFORMANS</Text>
        <View style={styles.groupCard}>
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>60 FPS Akıcı Animasyonlar</Text>
              <Text style={styles.settingSub}>Ultra pürüzsüz kart ve soru geçişleri</Text>
            </View>
            {renderSwitch(smoothAnimations, () => setSmoothAnimations((v) => !v))}
          </View>
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Pil Tasarruf Modu</Text>
              <Text style={styles.settingSub}>Arka plan efektlerini hafifleterek şarj korur</Text>
            </View>
            {renderSwitch(batterySaver, () => setBatterySaver((v) => !v))}
          </View>
          <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
            <View>
              <Text style={styles.settingLabel}>Arka Plan Parıltıları</Text>
              <Text style={styles.settingSub}>Neon nebula ve karanlık uzay parlamaları</Text>
            </View>
            {renderSwitch(ambientGlow, () => setAmbientGlow((v) => !v))}
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

          <View style={[styles.multiChoiceRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.settingLabel}>Tur Soru Sayısı</Text>
            <View style={styles.pillSelectorRow}>
              {[5, 7, 10].map((count) => {
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
              <Text style={styles.settingLabel}>Çevrimiçi Durumu</Text>
              <Text style={styles.settingSub}>Arkadaş listesinde aktif görün</Text>
            </View>
            {renderSwitch(onlineStatusVisible, () => setOnlineStatusVisible((v) => !v))}
          </View>
          <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
            <View>
              <Text style={styles.settingLabel}>Herkese Açık Profil</Text>
              <Text style={styles.settingSub}>İstatistikler ve rozetler lider tablosunda görünsün</Text>
            </View>
            {renderSwitch(profilePublic, () => setProfilePublic((v) => !v))}
          </View>
        </View>

        {/* 6. Storage & Tools */}
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
              <Text style={styles.settingSub}>Sunucu durumları ve canlı sistem logları</Text>
            </View>
            <Text style={[styles.settingRightSub, { color: '#FFC43D' }]}>Aç ›</Text>
          </TouchableOpacity>
        </View>

        {/* 7. Account Session & Delete Section */}
        <Text style={styles.sectionHeader}>HESAP YÖNETİMİ</Text>
        <View style={styles.accountActionBox}>
          {/* Safe Logout Button */}
          <Button3D
            title="ÇIKIŞ YAP"
            variant="gold"
            onPress={() => {
              sound.playSound('tap');
              onLogout();
            }}
            style={{ width: '100%', minHeight: 46 }}
            textStyle={{ fontSize: 14 }}
          />
          <Text style={styles.logoutNoticeText}>
            ℹ️ Oturumu kapattığınızda altınlarınız, elmaslarınız ve seviyeniz silinmez; tekrar giriş yaptığınızda kaldığınız yerden devam edersiniz.
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
          <Text style={styles.versionText}>Tavriko · v1.0.0 (Production Build)</Text>
          <Text style={styles.versionSubText}>Supabase + Cloudflare Realtime DO Engine</Text>
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
    </TavrikoScreen>
  );
};

const styles = StyleSheet.create({
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
