import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import {
  TavrikoScreen,
  TavrikoTopBar,
  Button3D,
  BRAND_APP_ICON,
} from '../components/TavrikoIcons';
interface SettingsScreenProps {
  onBack: () => void;
  onLogout: () => void;
  onDeveloper?: () => void;
}
export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onBack,
  onLogout,
  onDeveloper,
}) => {
  const [sfxEnabled, setSfxEnabled] = useState(sound.isSoundEnabled());
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [hapticsEnabled, setHapticsEnabled] = useState(sound.isHapticsEnabled());
  const [notifsEnabled, setNotifsEnabled] = useState(true);
  const renderSwitch = (value: boolean, onToggle: () => void) => (
    <TouchableOpacity
      style={[
        styles.switchTrack,
        { backgroundColor: value ? '#3FD08A' : '#4A3A7A' },
      ]}
      onPress={onToggle}
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
  return (
    <TavrikoScreen>
      <TavrikoTopBar leftType="back" onLeftPress={onBack} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>AYARLAR</Text>
        {/* Toggles Group */}
        <View style={styles.groupCard}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Ses efektleri</Text>
            {renderSwitch(sfxEnabled, () => {
              const next = !sfxEnabled;
              setSfxEnabled(next);
              sound.setSoundEnabled(next);
            })}
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Müzik</Text>
            {renderSwitch(musicEnabled, () => setMusicEnabled((v) => !v))}
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Haptik titreşim</Text>
            {renderSwitch(hapticsEnabled, () => {
              const next = !hapticsEnabled;
              setHapticsEnabled(next);
              sound.setHapticsEnabled(next);
            })}
          </View>
          <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.settingLabel}>Bildirimler</Text>
            {renderSwitch(notifsEnabled, () => setNotifsEnabled((v) => !v))}
          </View>
        </View>
        {/* Links Group */}
        <View style={[styles.groupCard, { marginTop: 14 }]}>
          <TouchableOpacity style={styles.settingRow}>
            <Text style={styles.settingLabel}>Dil</Text>
            <Text style={styles.settingRightSub}>Türkçe ›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingRow}>
            <Text style={styles.settingLabel}>Hesap</Text>
            <Text style={styles.settingRightSub}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingRow}>
            <Text style={styles.settingLabel}>Gizlilik</Text>
            <Text style={styles.settingRightSub}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.settingRow, { borderBottomWidth: 0 }]}
            onPress={() => {
              sound.playSound('tap');
              if (onDeveloper) {
                onDeveloper();
              }
            }}
          >
            <Text style={[styles.settingLabel, { color: '#FFC43D' }]}>🛡️ Geliştirici & Ops Paneli</Text>
            <Text style={[styles.settingRightSub, { color: '#FFC43D' }]}>Aç ›</Text>
          </TouchableOpacity>
        </View>
        {/* Logout Button */}
        <View style={{ alignItems: 'center', marginTop: 28 }}>
          <Button3D
            title="ÇIKIŞ YAP"
            variant="red"
            onPress={onLogout}
            style={{ width: 240 }}
          />
        </View>
        {/* Footer App Icon & Version */}
        <View style={styles.footerBrand}>
          <Image
            source={BRAND_APP_ICON}
            style={styles.appIcon}
            resizeMode="cover"
          />
          <Text style={styles.versionText}>Tavriko · Sürüm 1.0.0</Text>
        </View>
      </ScrollView>
    </TavrikoScreen>
  );
};
const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 32,
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 36,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 14,
  },
  groupCard: {
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  settingLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: THEME.fonts.extraBold,
  },
  settingRightSub: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
  switchTrack: {
    width: 46,
    height: 26,
    borderRadius: 13,
    position: 'relative',
  },
  switchThumb: {
    position: 'absolute',
    top: 3,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  footerBrand: {
    alignItems: 'center',
    marginTop: 20,
    gap: 8,
  },
  appIcon: {
    width: 56,
    height: 51,
    borderRadius: 14,
  },
  versionText: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
  },
});