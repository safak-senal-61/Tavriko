import React from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView } from 'react-native';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { useGameStore } from '../store/gameStore';
import { ArrowLeft, Volume2, Smartphone, Shield, LogOut, Info } from 'lucide-react-native';

interface SettingsScreenProps {
  onBack: () => void;
  onLogout: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack, onLogout }) => {
  const { soundEnabled, hapticsEnabled, setSoundEnabled, setHapticsEnabled } = useGameStore();

  const handleSoundToggle = (val: boolean) => {
    sound.setSoundEnabled(val);
    setSoundEnabled(val);
    if (val) sound.playSound('tap');
  };

  const handleHapticsToggle = (val: boolean) => {
    sound.setHapticsEnabled(val);
    setHapticsEnabled(val);
    if (val) sound.triggerHaptic('light');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            sound.playSound('tap');
            onBack();
          }}
        >
          <ArrowLeft size={22} color={THEME.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ayarlar</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionHeader}>Oyun Deneyimi</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Volume2 size={20} color={THEME.colors.primaryLight} />
              <View>
                <Text style={styles.rowTitle}>Ses Efektleri</Text>
                <Text style={styles.rowDesc}>Cevaplar, sayaç ve zafer sesleri</Text>
              </View>
            </View>
            <Switch
              value={soundEnabled}
              onValueChange={handleSoundToggle}
              trackColor={{ false: THEME.colors.border, true: THEME.colors.primary }}
              thumbColor="#FFF"
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Smartphone size={20} color={THEME.colors.primaryLight} />
              <View>
                <Text style={styles.rowTitle}>Titreşim & Haptik</Text>
                <Text style={styles.rowDesc}>Dokunma ve geri bildirim titreşimleri</Text>
              </View>
            </View>
            <Switch
              value={hapticsEnabled}
              onValueChange={handleHapticsToggle}
              trackColor={{ false: THEME.colors.border, true: THEME.colors.primary }}
              thumbColor="#FFF"
            />
          </View>
        </View>

        <Text style={styles.sectionHeader}>Gizlilik ve Hesap</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => {
              sound.playSound('tap');
            }}
          >
            <View style={styles.rowLeft}>
              <Shield size={20} color={THEME.colors.correct} />
              <Text style={styles.rowTitle}>Gizlilik Politikası & Kurallar</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => {
              sound.playSound('tap');
              onLogout();
            }}
          >
            <View style={styles.rowLeft}>
              <LogOut size={20} color={THEME.colors.wrong} />
              <Text style={[styles.rowTitle, { color: THEME.colors.wrong }]}>Çıkış Yap</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.versionBox}>
          <Info size={14} color={THEME.colors.textMuted} />
          <Text style={styles.versionText}>TriviaVerse v1.0.0 (Production Build)</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: THEME.spacing.lg,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    backgroundColor: THEME.colors.card,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  content: {
    padding: THEME.spacing.lg,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 12,
  },
  card: {
    backgroundColor: THEME.colors.card,
    borderRadius: THEME.radius.lg,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    overflow: 'hidden',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  actionRow: {
    padding: 16,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  rowDesc: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: THEME.colors.border,
  },
  versionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24,
  },
  versionText: {
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
});
