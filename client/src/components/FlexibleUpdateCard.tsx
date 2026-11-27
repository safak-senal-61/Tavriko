import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Download, RotateCcw, X } from 'lucide-react-native';
import { THEME } from '../theme/tokens';
import {
  completeFlexibleUpdate, dismissFlexiblePrompt, startFlexibleUpdate, usePlayUpdateStore,
} from '../services/playUpdates';

interface Props {
  /** Yalnızca güvenli ekranlarda (ana ekran, maç dışı) gösterilir. */
  eligible: boolean;
  bottomOffset: number;
}

/**
 * İsteğe bağlı (FLEXIBLE) güncelleme kartı:
 *  - Yeni sürüm → "Güncelle" (Play onayı, arka planda indirme) / "Sonra"
 *  - İndiriliyor → küçük ilerleme göstergesi, oyun kesilmez
 *  - İndirildi → "Yeniden başlat" (Play kurar ve uygulamayı yeniden açar)
 */
export function FlexibleUpdateCard({ eligible, bottomOffset }: Props) {
  const decision = usePlayUpdateStore(s => s.decision);
  const promptDue = usePlayUpdateStore(s => s.promptDue);
  const busy = usePlayUpdateStore(s => s.busy);
  const progress = usePlayUpdateStore(s => s.progress);
  const notice = usePlayUpdateStore(s => s.notice);
  if (!eligible) return null;

  if (decision.kind === 'downloading') {
    const percent = progress === null ? null : Math.round(progress * 100);
    return (
      <View style={[styles.pill, { bottom: bottomOffset }]} accessibilityLiveRegion="polite" pointerEvents="none">
        <ActivityIndicator size="small" color="#FFC43D" />
        <Text style={styles.pillText}>Güncelleme indiriliyor{percent === null ? '…' : ` · %${percent}`}</Text>
      </View>
    );
  }

  const ready = decision.kind === 'downloaded';
  if (!promptDue || (decision.kind !== 'optional' && !ready)) return null;

  return (
    <View style={[styles.card, { bottom: bottomOffset }]} accessibilityLiveRegion="polite">
      <View style={[styles.icon, ready && styles.iconReady]}>
        {ready ? <RotateCcw size={22} color="#0C3A33" /> : <Download size={22} color="#3B1500" />}
      </View>
      <View style={styles.texts}>
        <Text style={styles.title}>{ready ? 'Güncelleme hazır' : 'Yeni Tavriko sürümü var'}</Text>
        <Text style={styles.body}>
          {notice === 'failed' ? 'İşlem tamamlanamadı, tekrar deneyebilirsin.'
            : ready ? 'Yeniden başlatınca yeni sürüm açılır. Birkaç saniye sürer.'
              : 'Oynarken arka planda indirilir, bitince haber veririz.'}
        </Text>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void (ready ? completeFlexibleUpdate() : startFlexibleUpdate())}
            style={[styles.primary, ready && styles.primaryReady]}
          >
            {busy ? <ActivityIndicator size="small" color="#3B1500" />
              : <Text style={styles.primaryText}>{ready ? 'Yeniden başlat' : 'Güncelle'}</Text>}
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => (ready ? usePlayUpdateStore.setState({ promptDue: false }) : dismissFlexiblePrompt())} style={styles.later}>
            <Text style={styles.laterText}>Sonra</Text>
          </Pressable>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Kapat"
        hitSlop={10}
        style={styles.close}
        onPress={() => (ready ? usePlayUpdateStore.setState({ promptDue: false }) : dismissFlexiblePrompt())}
      >
        <X size={18} color="#CBBFE8" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute', left: 12, right: 12, flexDirection: 'row', gap: 12, padding: 14, borderRadius: 20,
    backgroundColor: '#22123F', borderWidth: 1.5, borderColor: 'rgba(255,196,61,0.55)',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFC43D', alignItems: 'center', justifyContent: 'center' },
  iconReady: { backgroundColor: '#5ADBB5' },
  texts: { flex: 1, paddingRight: 18 },
  title: { fontFamily: THEME.fonts.black, fontSize: 16, color: '#FFFFFF' },
  body: { fontFamily: THEME.fonts.bold, fontSize: 13, lineHeight: 18, color: '#D9CDF5', marginTop: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  primary: { minHeight: 40, minWidth: 110, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#FFC43D', alignItems: 'center', justifyContent: 'center' },
  primaryReady: { backgroundColor: '#8FF0CF' },
  primaryText: { fontFamily: THEME.fonts.black, fontSize: 14, color: '#3B1500' },
  later: { minHeight: 40, paddingHorizontal: 12, justifyContent: 'center' },
  laterText: { fontFamily: THEME.fonts.bold, fontSize: 14, color: '#D9CDF5' },
  close: { position: 'absolute', top: 10, right: 10 },
  pill: {
    position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(14,6,32,0.94)',
    borderWidth: 1, borderColor: 'rgba(255,196,61,0.45)',
  },
  pillText: { fontFamily: THEME.fonts.bold, fontSize: 13, color: '#FFE0A9' },
});
