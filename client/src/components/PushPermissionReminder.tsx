import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bell, Swords, UsersRound } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import {
  deferPushReminder,
  parsePushReminder,
  pushReminderDue,
  shortenPushReminderSchedule,
  PUSH_REMINDER_FOREGROUND_DELAY_MS,
  type PushReminderPreference,
} from '../services/pushReminderPolicy';
import type { PushPermission } from '../services/pushNotifications';

const KEY = 'tavriko_push_reminder_v1';
const VARIANTS = [
  {
    icon: Swords, color: '#FFC43D', tint: '#38274A', tag: 'ARKADAŞ DÜELLOLARI',
    title: 'Düello davetlerini kaçırma',
    body: 'Bir arkadaşın seni düelloya çağırdığında hemen haberin olsun.',
  },
  {
    icon: UsersRound, color: '#ADF0D8', tint: '#233944', tag: 'BİRLİKTE OYNA',
    title: 'Arkadaşların odayı kurdu mu?',
    body: 'Oda davetlerini zamanında gör, arkadaşların beklemeden oyuna katıl.',
  },
  {
    icon: Bell, color: '#DAC4FF', tint: '#352358', tag: 'ARKADAŞ İSTEKLERİ',
    title: 'Yeni arkadaşlarından haber al',
    body: 'Sana arkadaşlık isteği geldiğinde bildirimi gör ve dilediğinde yanıtla.',
  },
] as const;

let cachedPreference: PushReminderPreference | undefined;
let loading: Promise<PushReminderPreference> | undefined;
let write = Promise.resolve();

function loadPreference() {
  if (cachedPreference) return Promise.resolve(cachedPreference);
  return loading ??= SecureStore.getItemAsync(KEY).catch(() => null).then(raw => {
    if (cachedPreference) return cachedPreference;
    const stored = parsePushReminder(raw);
    const adjusted = shortenPushReminderSchedule(stored, Date.now());
    if (adjusted.nextAt !== stored.nextAt) savePreference(adjusted);
    return cachedPreference ??= adjusted;
  });
}

function savePreference(preference: PushReminderPreference) {
  cachedPreference = preference;
  write = write.then(() => SecureStore.setItemAsync(KEY, JSON.stringify(preference))).catch(() => {});
}

interface Props {
  eligible: boolean;
  permission: PushPermission;
  onEnable: () => Promise<void>;
}

export function PushPermissionReminder({ eligible, permission, onEnable }: Props) {
  const [preference, setPreference] = useState(cachedPreference);
  const [variantIndex, setVariantIndex] = useState<number | null>(null);
  const canShow = eligible && (permission === 'requestable' || permission === 'blocked');

  useEffect(() => {
    let active = true;
    void loadPreference().then(value => { if (active) setPreference(value); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!canShow) setVariantIndex(null);
  }, [canShow]);

  useEffect(() => {
    if (!canShow || !preference || preference.stopped || variantIndex !== null) return;
    const wait = Math.max(PUSH_REMINDER_FOREGROUND_DELAY_MS, preference.nextAt - Date.now());
    const timer = setTimeout(() => {
      const now = Date.now();
      if (!pushReminderDue(preference, now)) return;
      const next = deferPushReminder(preference, now);
      savePreference(next);
      setPreference(next);
      setVariantIndex(preference.shown % VARIANTS.length);
    }, Math.min(wait, 2_147_483_647));
    return () => clearTimeout(timer);
  }, [canShow, preference, variantIndex]);

  if (!canShow || variantIndex === null) return null;
  const { icon: Icon, color, tint, tag, title, body } = VARIANTS[variantIndex];
  const close = () => setVariantIndex(null);
  const stop = () => {
    if (preference) {
      const next = { ...preference, stopped: true };
      savePreference(next);
      setPreference(next);
    }
    close();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <ScrollView style={styles.backdrop} contentContainerStyle={styles.center}>
        <View style={[styles.card, { borderColor: tint }]} accessibilityViewIsModal>
          <View style={[styles.icon, { backgroundColor: tint }]}><Icon size={26} color={color} /></View>
          <Text style={[styles.tag, { color }]}>{tag}</Text>
          <Text style={styles.title} accessibilityRole="header">{title}</Text>
          <Text style={styles.body}>{body}</Text>
          {permission === 'blocked' && <Text style={styles.hint}>Bildirimleri cihaz ayarlarından açabilirsin.</Text>}
          <Pressable
            accessibilityRole="button"
            style={[styles.button, { backgroundColor: color }]}
            onPress={() => { close(); void onEnable(); }}
          >
            <Text style={styles.buttonText}>{permission === 'blocked' ? 'Cihaz ayarlarını aç' : 'Bildirimleri aç'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.secondary} onPress={close}>
            <Text style={styles.secondaryText}>Şimdi değil</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.secondary} onPress={stop}>
            <Text style={styles.hint}>Bir daha hatırlatma</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(4,2,20,0.82)' },
  center: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 400, padding: 20, backgroundColor: '#190F32', alignItems: 'center', borderRadius: 22, borderWidth: 2 },
  icon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  tag: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textAlign: 'center', marginBottom: 6 },
  title: { color: '#FFF', fontWeight: '800', fontSize: 21, textAlign: 'center', marginBottom: 8 },
  body: { color: '#E2D5F5', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 10 },
  hint: { color: '#CAABD9', fontSize: 12, textAlign: 'center' },
  button: { alignSelf: 'stretch', borderRadius: 14, alignItems: 'center', justifyContent: 'center', minHeight: 48, padding: 8, marginTop: 10 },
  buttonText: { color: '#251638', fontSize: 15, fontWeight: '900', textAlign: 'center' },
  secondary: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', minHeight: 44, padding: 6 },
  secondaryText: { color: '#E2D5F5', fontSize: 14, fontWeight: '700', textAlign: 'center' },
});
