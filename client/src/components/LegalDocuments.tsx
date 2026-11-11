import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, ActivityIndicator, Linking, Platform } from 'react-native';
import {
  LEGAL_DOCUMENTS,
  LEGAL_VERSION,
  LegalDocumentId,
  getLegalDocument,
} from '@trivia/shared';
import { Check, X, FileText, ChevronRight, ExternalLink } from 'lucide-react-native';
import { THEME } from '../theme/tokens';
import { CLOUD_BASE_URL } from '../config';

/** Sürümü kullanıcıya gösterilecek tarih formatına çevirir (2026-11-11 -> 11.11.2026). */
export const formatLegalVersion = (version: string = LEGAL_VERSION) => {
  const [y, m, d] = version.split('-');
  return y && m && d ? `${d}.${m}.${y}` : version;
};

/** Yasal metinlerin herkese açık web adresi (ör. https://tavriko-app.vercel.app/legal/privacy). */
export const legalWebUrl = (id?: LegalDocumentId) => {
  const origin =
    Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : CLOUD_BASE_URL;
  return `${origin}/legal${id ? `/${id}` : ''}`;
};

// ---------------------------------------------------------------------------
// Tek bir yasal metni tam ekran okutan modal
// ---------------------------------------------------------------------------
export const LegalDocumentModal: React.FC<{
  documentId: LegalDocumentId | null;
  onClose: () => void;
}> = ({ documentId, onClose }) => {
  const doc = documentId ? getLegalDocument(documentId) : undefined;
  return (
    <Modal visible={Boolean(doc)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.sheetTitle}>{doc?.title}</Text>
              <Text style={styles.sheetMeta}>Son güncelleme: {formatLegalVersion()}</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Metni kapat"
            >
              <X size={20} color="#EDE9FE" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.sheetBody} contentContainerStyle={{ paddingBottom: 24 }}>
            {doc?.sections.map((sec) => (
              <View key={sec.heading} style={{ marginBottom: 14 }}>
                <Text style={styles.sectionHeading}>{sec.heading}</Text>
                {sec.paragraphs.map((p, i) => (
                  <Text key={i} style={styles.paragraph}>
                    {p}
                  </Text>
                ))}
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.primaryBtn} onPress={onClose} accessibilityRole="button">
            <Text style={styles.primaryBtnText}>OKUDUM, KAPAT</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// "Kullanım Koşulları, Gizlilik Politikası ve KVKK Aydınlatma Metni" bağlantılı metin
// ---------------------------------------------------------------------------
export const LegalLinksText: React.FC<{
  prefix?: string;
  suffix?: string;
  onOpen: (id: LegalDocumentId) => void;
  style?: any;
}> = ({ prefix = '', suffix = '', onOpen, style }) => (
  <Text style={[styles.consentText, style]}>
    {prefix}
    <Text style={styles.link} onPress={() => onOpen('terms')} accessibilityRole="link">
      Kullanım Koşulları
    </Text>
    {'’nı, '}
    <Text style={styles.link} onPress={() => onOpen('privacy')} accessibilityRole="link">
      Gizlilik Politikası
    </Text>
    {'’nı ve '}
    <Text style={styles.link} onPress={() => onOpen('kvkk')} accessibilityRole="link">
      KVKK Aydınlatma Metni
    </Text>
    {'’ni'}
    {suffix}
  </Text>
);

// ---------------------------------------------------------------------------
// Onay kutusu (kayıt formu ve onay ekranı)
// ---------------------------------------------------------------------------
export const LegalConsentCheckbox: React.FC<{
  checked: boolean;
  onToggle: () => void;
  onOpen: (id: LegalDocumentId) => void;
  highlightError?: boolean;
}> = ({ checked, onToggle, onOpen, highlightError }) => (
  <View style={[styles.checkRow, highlightError && !checked && styles.checkRowError]}>
    <TouchableOpacity
      onPress={onToggle}
      style={[styles.checkbox, checked && styles.checkboxChecked]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      aria-checked={checked}
      accessibilityLabel="Yasal metinleri okudum ve kabul ediyorum"
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      {checked && <Check size={16} color="#12052C" strokeWidth={3} />}
    </TouchableOpacity>
    <LegalLinksText
      style={{ flex: 1 }}
      onOpen={onOpen}
      suffix=" okudum ve kabul ediyorum."
    />
  </View>
);

// ---------------------------------------------------------------------------
// Tüm yasal metinlerin listesi (Ayarlar > Yasal)
// ---------------------------------------------------------------------------
export const LegalDocumentList: React.FC<{
  onOpen: (id: LegalDocumentId) => void;
  acceptedAt?: string | null;
}> = ({ onOpen, acceptedAt }) => (
  <View>
    {LEGAL_DOCUMENTS.map((doc) => (
      <TouchableOpacity
        key={doc.id}
        style={styles.listRow}
        onPress={() => onOpen(doc.id)}
        accessibilityRole="button"
        accessibilityLabel={doc.title}
      >
        <View style={styles.listIcon}>
          <FileText size={18} color="#FFC43D" />
        </View>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.listTitle}>{doc.shortTitle}</Text>
          <Text style={styles.listSub}>{doc.summary}</Text>
        </View>
        <ChevronRight size={18} color="#BFB3E0" />
      </TouchableOpacity>
    ))}
    <Text style={styles.listFooter}>
      Sürüm: {formatLegalVersion()}
      {acceptedAt ? ` · Onay tarihin: ${new Date(acceptedAt).toLocaleDateString('tr-TR')}` : ''}
    </Text>
    <TouchableOpacity
      style={styles.webLinkRow}
      onPress={() => {
        const url = legalWebUrl();
        if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(url, '_blank', 'noopener');
        else Linking.openURL(url).catch(() => {});
      }}
      accessibilityRole="link"
    >
      <ExternalLink size={14} color="#C4B5FD" />
      <Text style={styles.webLinkText}>Tüm metinleri web’de aç</Text>
    </TouchableOpacity>
  </View>
);

// ---------------------------------------------------------------------------
// Oturum açmış ama güncel metinleri onaylamamış kullanıcılar için zorunlu onay ekranı
// (Google ile ilk giriş ve metin güncellemeleri)
// ---------------------------------------------------------------------------
export const LegalConsentGate: React.FC<{
  visible: boolean;
  isUpdate: boolean;
  submitting: boolean;
  errorMsg?: string | null;
  onAccept: () => void;
  onLogout: () => void;
}> = ({ visible, isUpdate, submitting, errorMsg, onAccept, onLogout }) => {
  const [checked, setChecked] = useState(false);
  const [openDoc, setOpenDoc] = useState<LegalDocumentId | null>(null);
  const [showError, setShowError] = useState(false);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { maxHeight: undefined }]} accessibilityViewIsModal>
          <View style={styles.gateIcon}>
            <FileText size={28} color="#FFC43D" />
          </View>
          <Text style={[styles.sheetTitle, { textAlign: 'center' }]}>
            {isUpdate ? 'Sözleşmelerimizi güncelledik' : 'Hoş geldin! Son bir adım'}
          </Text>
          <Text style={styles.gateSub}>
            {isUpdate
              ? 'Tavriko’yu kullanmaya devam etmek için güncel metinleri inceleyip onaylaman gerekiyor.'
              : 'Hesabını kullanmaya başlamadan önce aşağıdaki metinleri inceleyip onaylaman gerekiyor.'}
          </Text>
          <LegalConsentCheckbox
            checked={checked}
            onToggle={() => {
              setChecked((c) => !c);
              setShowError(false);
            }}
            onOpen={setOpenDoc}
            highlightError={showError}
          />
          {(showError || errorMsg) && (
            <Text style={styles.errorText}>
              {errorMsg || 'Devam etmek için metinleri onaylaman gerekiyor.'}
            </Text>
          )}
          <TouchableOpacity
            style={[styles.primaryBtn, (!checked || submitting) && { opacity: 0.6 }]}
            disabled={submitting}
            onPress={() => {
              if (!checked) {
                setShowError(true);
                return;
              }
              onAccept();
            }}
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator color="#12052C" />
            ) : (
              <Text style={styles.primaryBtnText}>ONAYLA VE DEVAM ET</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={onLogout} disabled={submitting} accessibilityRole="button">
            <Text style={styles.secondaryBtnText}>Onaylamadan çıkış yap</Text>
          </TouchableOpacity>
        </View>
      </View>
      <LegalDocumentModal documentId={openDoc} onClose={() => setOpenDoc(null)} />
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8, 4, 20, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  sheet: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '90%',
    backgroundColor: '#1E1236',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.28)',
    padding: 20,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  sheetTitle: { color: '#FFFFFF', fontSize: 19, lineHeight: 25, fontFamily: THEME.fonts.display },
  sheetMeta: { color: '#BFB3E0', fontSize: 12, marginTop: 4, fontFamily: THEME.fonts.body },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  sheetBody: { flexGrow: 0 },
  sectionHeading: { color: '#FFD66B', fontSize: 15, fontFamily: THEME.fonts.extraBold, marginBottom: 6 },
  paragraph: { color: '#E4DCF9', fontSize: 14, lineHeight: 21, fontFamily: THEME.fonts.body, marginBottom: 8 },
  primaryBtn: {
    marginTop: 14,
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFC43D',
  },
  primaryBtnText: { color: '#12052C', fontSize: 15, fontFamily: THEME.fonts.black, letterSpacing: 0.4 },
  secondaryBtn: { marginTop: 10, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { color: '#C4B5FD', fontSize: 14, fontFamily: THEME.fonts.extraBold },
  consentText: { color: '#E4DCF9', fontSize: 13, lineHeight: 20, fontFamily: THEME.fonts.body },
  link: { color: '#FFD66B', textDecorationLine: 'underline', fontFamily: THEME.fonts.extraBold },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.22)',
    marginTop: 12,
  },
  checkRowError: { borderColor: 'rgba(248, 113, 113, 0.8)' },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#C4B5FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: '#FFC43D', borderColor: '#FFC43D' },
  errorText: { color: '#FCA5A5', fontSize: 13, marginTop: 8, fontFamily: THEME.fonts.extraBold },
  gateIcon: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 196, 61, 0.14)',
    marginBottom: 12,
  },
  gateSub: {
    color: '#D9CDF5',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 6,
    fontFamily: THEME.fonts.body,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  listIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 196, 61, 0.12)',
    marginRight: 12,
  },
  listTitle: { color: '#FFFFFF', fontSize: 15, fontFamily: THEME.fonts.extraBold },
  listSub: { color: '#D9CDF5', fontSize: 12, marginTop: 2, fontFamily: THEME.fonts.body },
  listFooter: { color: '#BFB3E0', fontSize: 12, marginTop: 14, fontFamily: THEME.fonts.body },
  webLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, minHeight: 32 },
  webLinkText: { color: '#C4B5FD', fontSize: 13, fontFamily: THEME.fonts.extraBold },
});
