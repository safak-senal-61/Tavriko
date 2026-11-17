/**
 * Analitik onay bandı — KVKK uyumu.
 *
 * İlk açılışta (onay kararı yokken) alt köşede belirir. "Kabul Et"
 * deneneye kadar PostHog hiçbir olay göndermez; "Reddet" kalıcı olarak
 * kapatır. Gizlilik Politikası dokümanı bandın içinden açılabilir.
 */
import React, { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { FileText, ShieldCheck } from 'lucide-react-native';
import {
  getAnalyticsConsent,
  setAnalyticsConsent,
  hydrateAnalyticsConsent,
  type AnalyticsConsentValue,
} from '../services/analyticsConsent';
import { LegalDocumentModal } from './LegalDocuments';
import type { LegalDocumentId } from '@trivia/shared';

interface Props {
  /** Kullanıcı karar verdiğinde tetiklenir (onayda analitik başlatılır). */
  onDecide?: (value: AnalyticsConsentValue) => void;
}

export const AnalyticsConsentBanner: React.FC<Props> = ({ onDecide }) => {
  const [visible, setVisible] = useState(false);
  const [openDoc, setOpenDoc] = useState<LegalDocumentId | null>(null);

  useEffect(() => {
    void hydrateAnalyticsConsent().then(() => {
      if (getAnalyticsConsent() === null) setVisible(true);
    });
  }, []);

  const decide = (value: AnalyticsConsentValue) => {
    setAnalyticsConsent(value);
    setVisible(false);
    onDecide?.(value);
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.backdrop} pointerEvents="auto">
          <View style={styles.sheet} accessibilityViewIsModal>
            <View style={styles.iconWrap}>
              <ShieldCheck size={24} color="#6FF0C6" />
            </View>
            <Text style={styles.title}>Deneyimini geliştirmemize yardım et</Text>
            <Text style={styles.body}>
              Tavriko’yu daha iyi hale getirmek için oyun içi etkileşimleri anonim olarak ölçüyoruz
              (PostHog). Veriler hiçbir şekilde üçüncü kişilerle paylaşılmaz; ne topladığımızı
              Gizlilik Politikası’mızda okuyabilirsin.
            </Text>
            <Pressable
              style={styles.docLink}
              onPress={() => setOpenDoc('privacy')}
              accessibilityRole="button"
              accessibilityLabel="Gizlilik Politikasını aç"
            >
              <FileText size={15} color="#FFC43D" />
              <Text style={styles.docLinkText}>Gizlilik Politikası</Text>
            </Pressable>
            <Pressable
              style={styles.acceptBtn}
              onPress={() => decide('granted')}
              accessibilityRole="button"
              accessibilityLabel="Analitik onayını kabul et"
            >
              <Text style={styles.acceptText}>Kabul Et</Text>
            </Pressable>
            <Pressable
              style={styles.denyBtn}
              onPress={() => decide('denied')}
              accessibilityRole="button"
              accessibilityLabel="Analitiği reddet"
            >
              <Text style={styles.denyText}>Şimdilik Reddet</Text>
            </Pressable>
            <Text style={styles.hint}>Reddetmek oyunu etkilemez; tercihini Ayarlar’dan her zaman değiştirebilirsin.</Text>
          </View>
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
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    alignItems: 'center',
    padding: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#150A38',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,196,61,0.25)',
    padding: 20,
  },
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
  docLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    marginBottom: 14,
  },
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
});
