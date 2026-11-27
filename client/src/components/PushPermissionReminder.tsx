import React, { useEffect, useState } from 'react';
import { cdnImage } from '../utils/cdn';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BellRing, Swords, UsersRound } from 'lucide-react-native';
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
import { THEME } from '../theme/tokens';
import { GradientFill } from './TavrikoGradient';
import { GemIcon, GiftIcon, TrophyIcon } from './TavrikoIcons';

const KEY = 'tavriko_push_reminder_v1';
const APP_ICON = cdnImage('images/logo_mark.png');
/** Sırayla gösterilen üç farklı tasarım: ödüller, arkadaş davetleri, düello çağrıları. */
const VARIANT_COUNT = 3;

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
      setVariantIndex(preference.shown % VARIANT_COUNT);
    }, Math.min(wait, 2_147_483_647));
    return () => clearTimeout(timer);
  }, [canShow, preference, variantIndex]);

  if (!canShow || variantIndex === null) return null;
  const close = () => setVariantIndex(null);
  const stop = () => {
    if (preference) {
      const next = { ...preference, stopped: true };
      savePreference(next);
      setPreference(next);
    }
    close();
  };
  const blocked = permission === 'blocked';
  const accept = () => { close(); void onEnable(); };
  const actions = { blocked, accept, close, stop };

  return (
    <Modal visible transparent animationType={variantIndex === 2 ? 'slide' : 'fade'} onRequestClose={close} statusBarTranslucent>
      {variantIndex === 0 && <RewardsPrompt {...actions} />}
      {variantIndex === 1 && <FriendsPrompt {...actions} />}
      {variantIndex === 2 && <DuelSheet {...actions} />}
    </Modal>
  );
}

interface PromptActions {
  blocked: boolean;
  accept: () => void;
  close: () => void;
  stop: () => void;
}

const yesLabel = (blocked: boolean) => (blocked ? 'Evet, ayarlardan aç' : 'Evet, bildirimleri aç');

function FooterLinks({ close, stop, light }: { close: () => void; stop: () => void; light?: boolean }) {
  return (
    <>
      <Pressable accessibilityRole="button" style={styles.secondary} onPress={close}>
        <Text style={[styles.secondaryText, light && { color: '#E2D5F5' }]}>Şimdi değil</Text>
      </Pressable>
      <Pressable accessibilityRole="button" style={styles.tertiary} onPress={stop}>
        <Text style={styles.hint}>Bir daha hatırlatma</Text>
      </Pressable>
    </>
  );
}

/** Tasarım 1: Ödüller — altın başlık bandı, ödül listesi. */
function RewardsPrompt({ blocked, accept, close, stop }: PromptActions) {
  return (
    <ScrollView style={styles.backdrop} contentContainerStyle={styles.center}>
      <View style={[styles.card, styles.rewardsCard]} accessibilityViewIsModal>
        <View style={styles.rewardsHeader}>
          <GradientFill colors={['#FFE27A', '#FF9B2F']} direction="diagonal" />
          <GiftIcon size={64} />
          <Text style={styles.rewardsTag}>ÖDÜL BİLDİRİMLERİ</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.title} accessibilityRole="header">Ödüllerine daha hızlı ulaş</Text>
          <Text style={styles.body}>Bir ödülün hazır olduğunda hemen haber verelim, hiçbirini kaçırma.</Text>
          <View style={styles.rewardList}>
            <View style={styles.rewardRow}><GiftIcon size={26} /><Text style={styles.rewardText}>Günlük ödülün toplanmaya hazır</Text></View>
            <View style={styles.rewardRow}><TrophyIcon size={26} /><Text style={styles.rewardText}>Yeni sezon ödülleri açıldı</Text></View>
            <View style={styles.rewardRow}><GemIcon size={24} /><Text style={styles.rewardText}>Elmas ve altın fırsatları</Text></View>
          </View>
          {blocked && <Text style={styles.hint}>Bildirimleri cihaz ayarlarından açabilirsin.</Text>}
          <Pressable accessibilityRole="button" style={[styles.button, styles.goldButton]} onPress={accept}>
            <Text style={styles.goldButtonText}>{yesLabel(blocked)}</Text>
          </Pressable>
          <FooterLinks close={close} stop={stop} />
        </View>
      </View>
    </ScrollView>
  );
}

/** Tasarım 2: Arkadaş davetleri — örnek bildirim önizlemesi, mint vurgu. */
function FriendsPrompt({ blocked, accept, close, stop }: PromptActions) {
  return (
    <ScrollView style={styles.backdrop} contentContainerStyle={styles.center}>
      <View style={[styles.card, styles.friendsCard]} accessibilityViewIsModal>
        <View style={styles.friendsIcon}><UsersRound size={28} color="#0C3A33" /></View>
        <Text style={[styles.tag, { color: '#8FF0CF' }]}>ARKADAŞ DAVETLERİ</Text>
        <Text style={styles.title} accessibilityRole="header">Arkadaşın seni çağırınca hemen gör</Text>
        <Text style={styles.body}>Arkadaşlık istekleri ve oyun davetleri anında telefonuna gelsin.</Text>
        <View style={styles.preview} accessible accessibilityLabel="Örnek bildirim: Ece seni düelloya davet etti">
          <Image source={APP_ICON} style={styles.previewIcon} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.previewApp}>Tavriko · şimdi</Text>
            <Text style={styles.previewTitle}>Ece seni düelloya davet etti</Text>
            <View style={styles.previewActions}>
              <Text style={styles.previewAction}>Düelloya Katıl</Text>
              <Text style={styles.previewActionMuted}>Reddet</Text>
            </View>
          </View>
        </View>
        {blocked && <Text style={styles.hint}>Bildirimleri cihaz ayarlarından açabilirsin.</Text>}
        <Pressable accessibilityRole="button" style={[styles.button, styles.mintButton]} onPress={accept}>
          <Text style={styles.mintButtonText}>{yesLabel(blocked)}</Text>
        </Pressable>
        <FooterLinks close={close} stop={stop} />
      </View>
    </ScrollView>
  );
}

/** Tasarım 3: Düello çağrıları — alttan açılan sayfa, yan yana düğmeler. */
function DuelSheet({ blocked, accept, close, stop }: PromptActions) {
  return (
    <View style={styles.sheetBackdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Kapat" />
      <View style={styles.sheet} accessibilityViewIsModal>
        <GradientFill colors={['#3A1350', '#1C0B33']} />
        <View style={styles.sheetHandle} />
        <View style={styles.sheetRow}>
          <View style={styles.duelIcon}>
            <Swords size={30} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.tag, { color: '#FF9DB0', textAlign: 'left' }]}>DÜELLO ÇAĞRILARI</Text>
            <Text style={[styles.title, styles.sheetTitle]} accessibilityRole="header">Rakibin hazır, sen neredesin?</Text>
          </View>
        </View>
        <Text style={[styles.body, styles.sheetBody]}>
          Düello çağrıları, oda davetleri ve seri hatırlatmaları geldiğinde haberin olsun.
        </Text>
        <View style={styles.bellRow}>
          <BellRing size={16} color="#FFC43D" />
          <Text style={styles.bellText}>Gereksiz bildirim yok, sadece oyunla ilgili olanlar.</Text>
        </View>
        {blocked && <Text style={[styles.hint, { textAlign: 'left' }]}>Bildirimleri cihaz ayarlarından açabilirsin.</Text>}
        <View style={styles.sheetButtons}>
          <Pressable accessibilityRole="button" style={[styles.button, styles.sheetLater]} onPress={close}>
            <Text style={styles.secondaryText}>Şimdi değil</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={[styles.button, styles.redButton]} onPress={accept}>
            <Text style={styles.redButtonText}>{blocked ? 'Evet, ayarları aç' : 'Evet, aç'}</Text>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" style={styles.tertiary} onPress={stop}>
          <Text style={styles.hint}>Bir daha hatırlatma</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(4,2,20,0.82)' },
  center: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 400, borderRadius: 24, overflow: 'hidden' },
  cardBody: { padding: 20, alignItems: 'center' },
  tag: { fontFamily: THEME.fonts.black, fontSize: 11, letterSpacing: 1.3, textAlign: 'center', marginBottom: 6 },
  title: { fontFamily: THEME.fonts.black, color: '#FFF', fontSize: 21, lineHeight: 27, textAlign: 'center', marginBottom: 8 },
  body: { fontFamily: THEME.fonts.bold, color: '#E2D5F5', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 12 },
  hint: { fontFamily: THEME.fonts.bold, color: '#CAABD9', fontSize: 12, textAlign: 'center' },
  button: { alignSelf: 'stretch', borderRadius: 16, alignItems: 'center', justifyContent: 'center', minHeight: 50, paddingHorizontal: 10, marginTop: 10 },
  secondary: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', minHeight: 44, padding: 6 },
  secondaryText: { fontFamily: THEME.fonts.bold, color: '#E2D5F5', fontSize: 14, textAlign: 'center' },
  tertiary: { alignSelf: 'center', minHeight: 36, justifyContent: 'center', paddingHorizontal: 8 },

  // Ödüller
  rewardsCard: { backgroundColor: '#1D1036', borderWidth: 2, borderColor: '#FFC43D' },
  rewardsHeader: { height: 120, alignItems: 'center', justifyContent: 'center', gap: 6 },
  rewardsTag: { fontFamily: THEME.fonts.black, fontSize: 11, letterSpacing: 1.4, color: '#3B1500' },
  rewardList: { alignSelf: 'stretch', gap: 8, marginBottom: 6 },
  rewardRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 14, backgroundColor: 'rgba(255,196,61,0.10)', borderWidth: 1, borderColor: 'rgba(255,196,61,0.25)',
  },
  rewardText: { flex: 1, fontFamily: THEME.fonts.bold, fontSize: 14, color: '#FFF' },
  goldButton: { backgroundColor: '#FFC43D', borderBottomWidth: 4, borderBottomColor: THEME.colors.btnGoldLip },
  goldButtonText: { fontFamily: THEME.fonts.black, fontSize: 16, color: THEME.colors.btnGoldText },

  // Arkadaşlar
  friendsCard: { backgroundColor: '#13263A', borderWidth: 2, borderColor: '#5ADBB5', padding: 20, alignItems: 'center' },
  friendsIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#8FF0CF', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  preview: {
    alignSelf: 'stretch', flexDirection: 'row', gap: 10, padding: 12, borderRadius: 18, marginBottom: 6,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  previewIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#241050' },
  previewApp: { fontFamily: THEME.fonts.bold, fontSize: 11, color: '#5B5470' },
  previewTitle: { fontFamily: THEME.fonts.extraBold, fontSize: 14, color: '#1B1230', marginTop: 1 },
  previewActions: { flexDirection: 'row', gap: 16, marginTop: 6 },
  previewAction: { fontFamily: THEME.fonts.black, fontSize: 12, color: '#1D7A6B' },
  previewActionMuted: { fontFamily: THEME.fonts.bold, fontSize: 12, color: '#6E6684' },
  mintButton: { backgroundColor: '#8FF0CF', borderBottomWidth: 4, borderBottomColor: THEME.colors.btnMintLip },
  mintButtonText: { fontFamily: THEME.fonts.black, fontSize: 16, color: THEME.colors.btnMintText },

  // Düello sayfası
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(4,2,20,0.7)' },
  sheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28,
    borderTopWidth: 2, borderColor: '#FF7A8A', width: '100%', maxWidth: 520, alignSelf: 'center',
  },
  sheetHandle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)', marginBottom: 14 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 8 },
  duelIcon: {
    width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#D0102E', borderBottomWidth: 4, borderBottomColor: THEME.colors.btnRedLip, transform: [{ rotate: '-6deg' }],
  },
  sheetTitle: { textAlign: 'left', marginBottom: 0, fontSize: 20 },
  sheetBody: { textAlign: 'left' },
  bellRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  bellText: { flex: 1, fontFamily: THEME.fonts.bold, fontSize: 13, color: '#FFE0A9' },
  sheetButtons: { flexDirection: 'row', gap: 10 },
  sheetLater: { flex: 1, alignSelf: 'auto', backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  redButton: { flex: 1.4, alignSelf: 'auto', backgroundColor: '#FF5A6A', borderBottomWidth: 4, borderBottomColor: THEME.colors.btnRedLip },
  redButtonText: { fontFamily: THEME.fonts.black, fontSize: 16, color: '#FFFFFF' },
});
