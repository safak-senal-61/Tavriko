import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { UserProfile } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { DEFAULT_API_BASE } from '../config';

interface ProfileEditScreenProps {
  user: UserProfile;
  token?: string | null;
  apiBaseUrl?: string;
  onBack: () => void;
  onSaved: (updated: UserProfile) => void;
}

const COUNTRIES: Array<{ code: string; name: string }> = [
  { code: 'TR', name: 'Türkiye' },
  { code: 'CY', name: 'Kıbrıs (KKTC dahil)' },
  { code: 'DE', name: 'Almanya' },
  { code: 'US', name: 'Amerika Birleşik Devletleri' },
  { code: 'GB', name: 'Birleşik Krallık' },
  { code: 'FR', name: 'Fransa' },
  { code: 'IT', name: 'İtalya' },
  { code: 'ES', name: 'İspanya' },
  { code: 'NL', name: 'Hollanda' },
  { code: 'BE', name: 'Belçika' },
  { code: 'AT', name: 'Avusturya' },
  { code: 'CH', name: 'İsviçre' },
  { code: 'SE', name: 'İsveç' },
  { code: 'NO', name: 'Norveç' },
  { code: 'DK', name: 'Danimarka' },
  { code: 'GR', name: 'Yunanistan' },
  { code: 'AZ', name: 'Azerbaycan' },
  { code: 'SA', name: 'Suudi Arabistan' },
  { code: 'AE', name: 'Birleşik Arap Emirlikleri' },
  { code: 'RU', name: 'Rusya' },
  { code: 'CA', name: 'Kanada' },
  { code: 'AU', name: 'Avustralya' },
  { code: 'JP', name: 'Japonya' },
  { code: 'CN', name: 'Çin' },
  { code: 'KR', name: 'Güney Kore' },
  { code: 'BR', name: 'Brezilya' },
  { code: 'AR', name: 'Arjantin' },
  { code: 'EG', name: 'Mısır' },
  { code: 'MA', name: 'Fas' },
  { code: 'IN', name: 'Hindistan' },
];

const GENDERS: Array<{ id: string; label: string }> = [
  { id: 'Kadın', label: 'Kadın' },
  { id: 'Erkek', label: 'Erkek' },
  { id: 'Diğer', label: 'Diğer' },
];

const normalizeCode = (code: string) => {
  // Eski kayıtlarda 'US-2' gibi hileli kodlar kalmışsa gerçek ISO koduna indir
  const base = code.split('-')[0];
  return COUNTRIES.some((c) => c.code === base) ? base : code;
};

export const ProfileEditScreen: React.FC<ProfileEditScreenProps> = ({
  user,
  token,
  apiBaseUrl,
  onBack,
  onSaved,
}) => {
  const base = apiBaseUrl || DEFAULT_API_BASE;
  const [fullName, setFullName] = useState(user.fullName || user.displayName || '');
  const [countryCode, setCountryCode] = useState(user.countryCode || 'TR');
  const [countryName, setCountryName] = useState(user.countryName || 'Türkiye');
  const [phone, setPhone] = useState(user.phone || '');
  const [birthDate, setBirthDate] = useState(user.birthDate || '');
  const [gender, setGender] = useState(user.gender || '');
  const [bio, setBio] = useState(user.bio || '');
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const birthValid = useMemo(() => {
    if (!birthDate.trim()) return true; // opsiyonel
    const m = birthDate.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!m) return false;
    const day = Number(m[1]);
    const month = Number(m[2]);
    if (day < 1 || day > 31 || month < 1 || month > 12) return false;
    const year = Number(m[3]);
    return year >= 1900 && year <= new Date().getFullYear();
  }, [birthDate]);

  const phoneValid = useMemo(() => {
    if (!phone.trim()) return true; // opsiyonel
    return /^[+\d][\d\s\-()]{5,}$/.test(phone.trim());
  }, [phone]);

  const fullNameValid = fullName.trim().length >= 2;

  const handlePickCountry = (c: { code: string; name: string }) => {
    sound.playSound('tap');
    sound.triggerHaptic('light');
    setCountryCode(normalizeCode(c.code));
    setCountryName(c.name);
    setCountryModalVisible(false);
  };

  const handleFormatBirth = (raw: string) => {
    // Otomatik GG.AA.YYYY biçimlendirme
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    let out = digits;
    if (digits.length > 4) out = `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
    else if (digits.length > 2) out = `${digits.slice(0, 2)}.${digits.slice(2)}`;
    setBirthDate(out);
  };

  const handleSave = async () => {
    if (!fullNameValid || !birthValid || !phoneValid || saving) {
      sound.triggerHaptic('error');
      setNotice({ ok: false, text: '⚠️ Lütfen kırmızı işaretli alanları düzeltin.' });
      setTimeout(() => setNotice(null), 3500);
      return;
    }
    sound.playSound('tap');
    setSaving(true);
    setNotice({
      ok: true,
      text: '⏳ Bilgileri veritabanına kaydediyoruz...',
    });
    try {
      const res = await fetch(`${base}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId: user.id,
          fullName: fullName.trim(),
          countryCode,
          countryName,
          phone: phone.trim(),
          birthDate: birthDate.trim(),
          gender: gender || undefined,
          bio: bio.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      sound.playSound('reward');
      sound.triggerHaptic('success');
      setNotice({
        ok: true,
        text: '✓ Bilgiler güncellendi ve PostgreSQL veritabanına kaydedildi!',
      });
      if (data?.user) {
        onSaved(data.user);
        setTimeout(onBack, 900);
      } else {
        setTimeout(onBack, 900);
      }
    } catch (err: any) {
      sound.triggerHaptic('error');
      setNotice({
        ok: false,
        text: `Kaydedilemedi: ${err?.message || 'bağlantı hatası'}`,
      });
    } finally {
      setSaving(false);
      setTimeout(() => setNotice(null), 4000);
    }
  };

  return (
    <TavrikoShell>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.delay(0).springify().damping(16)}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => {
                sound.playSound('tap');
                onBack();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.backBtnText}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Bilgilerimi Düzenle</Text>
            <View style={{ width: 40 }} />
          </View>
          <Text style={styles.subtitle}>
            Değişiklikler kaydettiğin an PostgreSQL veritabanına kalıcı yazılır.
          </Text>
        </Animated.View>

        {notice && (
          <Text style={[styles.noticeText, { color: notice.ok ? '#3FD08A' : '#FF5A6A' }]}>
            {notice.text}
          </Text>
        )}

        <Animated.View entering={FadeInDown.delay(80).springify().damping(16)}>
          <View style={styles.card}>
            <Text style={styles.label}>Ad Soyad</Text>
            <TextInput
              style={[styles.input, !fullNameValid && fullName.length > 0 && styles.inputError]}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Şafak Şenal"
              placeholderTextColor="#9A8BC2"
              maxLength={40}
            />
            {!fullNameValid && fullName.length > 0 && (
              <Text style={styles.fieldError}>En az 2 karakter girin</Text>
            )}

            <Text style={styles.label}>Kullanıcı Adı</Text>
            <View style={[styles.input, styles.readonlyInput]}>
              <Text style={styles.readonlyText}>@{user.username}</Text>
            </View>
            <Text style={styles.hintText}>Kullanıcı adı oyun kimliğini temsil eder ve değiştirilemez.</Text>

            <TouchableOpacity
              style={[styles.input, styles.selectInput]}
              onPress={() => {
                sound.playSound('tap');
                setCountryModalVisible(true);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.selectValue}>
                {COUNTRIES.find((c) => c.code === countryCode)?.name || countryName}
              </Text>
              <Text style={styles.selectChevron}>›</Text>
            </TouchableOpacity>

            <Text style={styles.label}>Telefon</Text>
            <TextInput
              style={[styles.input, !phoneValid && phone.length > 0 && styles.inputError]}
              value={phone}
              onChangeText={setPhone}
              placeholder="+90 5xx xxx xx xx"
              placeholderTextColor="#9A8BC2"
              keyboardType="phone-pad"
              maxLength={20}
            />
            {!phoneValid && phone.length > 0 && (
              <Text style={styles.fieldError}>Geçerli bir telefon numarası girin</Text>
            )}

            <Text style={styles.label}>Doğum Tarihi</Text>
            <TextInput
              style={[styles.input, !birthValid && birthDate.length > 0 && styles.inputError]}
              value={birthDate}
              onChangeText={handleFormatBirth}
              placeholder="01.01.2000"
              placeholderTextColor="#9A8BC2"
              keyboardType="number-pad"
              maxLength={10}
            />
            {!birthValid && birthDate.length > 0 && (
              <Text style={styles.fieldError}>GG.AA.YYYY biçiminde girin</Text>
            )}

            <Text style={styles.label}>Cinsiyet</Text>
            <View style={styles.genderRow}>
              {GENDERS.map((g) => {
                const active = gender === g.id;
                return (
                  <TouchableOpacity
                    key={g.id}
                    style={[styles.genderBtn, active && styles.genderBtnActive]}
                    onPress={() => {
                      sound.playSound('tap');
                      sound.triggerHaptic('light');
                      setGender(active ? '' : g.id);
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.genderBtnText, active && styles.genderBtnTextActive]}>
                      {g.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Hakkımda (Bio)</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              value={bio}
              onChangeText={(t) => setBio(t.slice(0, 140))}
              placeholder="Kendini kısaca anlat..."
              placeholderTextColor="#9A8BC2"
              multiline
              maxLength={140}
            />
            <Text style={styles.hintText}>{bio.length}/140 karakter</Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(160).springify().damping(16)}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#180B34" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>💾 Kaydet</Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {/* Ülke Seçim Modalı */}
      <Modal
        visible={countryModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCountryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ülkeni Seç</Text>
            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {COUNTRIES.map((c) => {
                const active = countryCode === normalizeCode(c.code);
                return (
                  <TouchableOpacity
                    key={c.code}
                    style={[styles.countryRow, active && styles.countryRowActive]}
                    onPress={() => handlePickCountry(c)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.countryName}>{c.name}</Text>
                    <Text style={styles.countryFlag}>{active ? '✓' : ''}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setCountryModalVisible(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.modalCloseText}>Kapat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </TavrikoShell>
  );
};

/** Ekran kabuğu: koyu degrade arka plan */
const TavrikoShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={styles.shell}>{children}</View>
);

const card = {
  backgroundColor: 'rgba(255, 255, 255, 0.08)',
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.14)',
  borderRadius: 20,
} as const;

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: '#180B34',
    ...Platform.select({
      web: { backgroundImage: 'linear-gradient(160deg, #2A1155 0%, #180B34 55%, #100629 100%)' },
      default: {},
    }),
  },
  scrollContent: { padding: 20, paddingBottom: 60 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(10, 4, 24, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { color: '#FFFFFF', fontSize: 22, fontFamily: THEME.fonts.extraBold },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 22,
    color: '#FFFFFF',
    textAlign: 'center',
    flexShrink: 1,
  },
  subtitle: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.body,
    textAlign: 'center',
    marginTop: 6,
  },
  noticeText: { fontSize: 12, fontFamily: THEME.fonts.extraBold, textAlign: 'center', marginTop: 10 },
  card: { ...card, padding: 16, marginTop: 12 },
  label: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: THEME.fonts.extraBold,
  },
  inputError: { borderColor: '#FF5A6A' },
  fieldError: { color: '#FF5A6A', fontSize: 10, fontFamily: THEME.fonts.extraBold, marginTop: 4 },
  hintText: { color: '#9A8BC2', fontSize: 10, fontFamily: THEME.fonts.body, marginTop: 4 },
  readonlyInput: { backgroundColor: 'rgba(255, 255, 255, 0.04)' },
  readonlyText: { color: '#D9CDF5', fontSize: 14, fontFamily: THEME.fonts.extraBold },
  selectInput: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectValue: { color: '#FFFFFF', fontSize: 14, fontFamily: THEME.fonts.extraBold },
  selectChevron: { color: '#FFC43D', fontSize: 18, fontFamily: THEME.fonts.extraBold },
  genderRow: { flexDirection: 'row', gap: 8 },
  genderBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
  },
  genderBtnActive: {
    borderColor: '#FFC43D',
    backgroundColor: 'rgba(255, 196, 61, 0.15)',
  },
  genderBtnText: { color: '#D9CDF5', fontSize: 13, fontFamily: THEME.fonts.extraBold },
  genderBtnTextActive: { color: '#FFC43D' },
  bioInput: { minHeight: 80, textAlignVertical: 'top', paddingTop: 10 },
  saveBtn: {
    marginTop: 18,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: '#6B3CFF',
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#FFFFFF', fontSize: 16, fontFamily: THEME.fonts.extraBold },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 4, 24, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    ...card,
    width: '100%',
    maxWidth: 360,
    maxHeight: '70%',
    padding: 16,
    backgroundColor: '#241045',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontFamily: THEME.fonts.display,
    fontSize: 18,
    marginBottom: 10,
    textAlign: 'center',
  },
  modalList: { flexGrow: 0 },
  countryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  countryRowActive: { backgroundColor: 'rgba(255, 196, 61, 0.15)' },
  countryName: { color: '#FFFFFF', fontSize: 13, fontFamily: THEME.fonts.extraBold, flex: 1 },
  countryFlag: { color: '#FFC43D', fontSize: 13, fontFamily: THEME.fonts.extraBold },
  modalCloseBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFC43D',
    alignItems: 'center',
  },
  modalCloseText: { color: '#FFC43D', fontSize: 13, fontFamily: THEME.fonts.extraBold },
});

export default ProfileEditScreen;
