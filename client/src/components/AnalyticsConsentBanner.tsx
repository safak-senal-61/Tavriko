/**
 * Analitik onay bandı — KVKK uyumu.
 *
 * Oturum açıldıktan sonra, henüz bir tercih yoksa gösterilir.
 * Gizlilik Politikası dokümanı bandın içinden açılabilir.
 */
import React, { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { FileText, ShieldCheck } from 'lucide-react-native';
import { setAnalyticsConsent } from '../services/analyticsConsent';
import { LegalDocumentModal } from './LegalDocuments';
import type { LegalDocumentId } from '@trivia/shared';

export const AnalyticsConsentBanner: React.FC = () => {
  const [openDoc, setOpenDoc] = useState<LegalDocumentId | null>(null);
  const { height } = useWindowDimensions();
  const shortWeb = Platform.OS === 'web' && height <= 420;

  return (
    <>
      <Modal visible transparent animationType="fade" onRequestClose={() => setAnalyticsConsent('denied')}>
        <View style={styles.backdrop} pointerEvents="auto">
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.scrollContent, shortWeb && styles.scrollShort]}
            keyboardShouldPersistTaps="handled"
          >
          <View style={[styles.sheet, shortWeb && styles.sheetShort]} accessibilityViewIsModal>
            <View style={[styles.iconWrap, shortWeb && styles.iconShort]}>
              <ShieldCheck size={shortWeb ? 19 : 24} color="#6FF0C6" />
            </View>
            <Text style={styles.title}>Deneyimini geliştirmemize yardım et</Text>
            <Text style={[styles.body, shortWeb && styles.bodyShort]}>
              İzin verirsen, Tavriko’yu iyileştirmek için maç başlatma ve tamamlama gibi oyun içi
              etkileşimleri ölçeriz. Bu olaylar, hesap tanımlayıcınla birlikte ölçüm hizmeti
              tarafından işlenir. Oyuncu adın ve e-posta adresin bu ölçüme gönderilmez.
            </Text>
            <Pressable
              style={[styles.docLink, shortWeb && styles.docLinkShort]}
              onPress={() => setOpenDoc('privacy')}
              accessibilityRole="button"
              accessibilityLabel="Gizlilik Politikasını aç"
            >
              <FileText size={15} color="#FFC43D" />
              <Text style={styles.docLinkText}>Gizlilik Politikası</Text>
            </Pressable>
            <Pressable
              style={styles.acceptBtn}
              onPress={() => setAnalyticsConsent('granted')}
              accessibilityRole="button"
              accessibilityLabel="Analitik onayını kabul et"
            >
              <Text style={styles.acceptText}>Kabul Et</Text>
            </Pressable>
            <Pressable
              style={styles.denyBtn}
              onPress={() => setAnalyticsConsent('denied')}
              accessibilityRole="button"
              accessibilityLabel="Analitiği reddet"
            >
              <Text style={styles.denyText}>Şimdilik Reddet</Text>
            </Pressable>
            <Text style={[styles.hint, shortWeb && styles.hintShort]}>Reddetmek oyunu etkilemez. Tercihini Ayarlar › Gizlilik › Kullanım Analitiği bölümünden değiştirebilirsin.</Text>
          </View>
          </ScrollView>
        </View>
      </Modal>
      <LegalDocumentModal documentId={openDoc} onClose={() => setOpenDoc(null)} />
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4,2,20,0.82)',
  },
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    alignItems: 'center',
    padding: 20,
  },
  scrollShort: { padding: 12 },
  sheet: {
    flexShrink: 0,
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#150A38',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,196,61,0.25)',
    padding: 20,
  },
  sheetShort: { padding: 14 },
  iconWrap: {
    alignSelf: 'center',
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(111,240,198,0.14)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconShort: { width: 34, height: 34, borderRadius: 17, marginBottom: 6 },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 12,
  },
  bodyShort: { lineHeight: 18, marginBottom: 8 },
  docLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    marginBottom: 14,
  },
  docLinkShort: { marginBottom: 8 },
  docLinkText: {
    color: '#FFC43D',
    fontSize: 13.5,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  acceptBtn: {
    backgroundColor: '#FFC43D',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 8,
  },
  acceptText: {
    color: '#1A0B4D',
    fontSize: 15,
    fontWeight: '900',
  },
  denyBtn: {
    borderRadius: 14,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  denyText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13.5,
    fontWeight: '700',
  },
  hint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 15,
  },
  hintShort: { marginTop: 8 },
});
