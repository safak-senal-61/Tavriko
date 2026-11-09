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
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { UserProfile } from '@trivia/shared';
import { THEME } from '../theme/tokens';
import { sound } from '../services/soundService';
import { DEFAULT_API_BASE } from '../config';
import {
  TavrikoScreen,
  Button3D,
  CharacterAvatar,
} from '../components/TavrikoIcons';

interface ProfileEditScreenProps {
  user: UserProfile;
  token?: string | null;
  apiBaseUrl?: string;
  onBack: () => void;
  onSaved: (updated: UserProfile) => void;
}

const COUNTRIES: Array<{ code: string; name: string; flag: string }> = [
  { code: 'TR', name: 'Türkiye', flag: '🇹🇷' },
  { code: 'AZ', name: 'Azerbaycan', flag: '🇦🇿' },
  { code: 'CY', name: 'Kıbrıs (KKTC dahil)', flag: '🇨🇾' },
  { code: 'DE', name: 'Almanya', flag: '🇩🇪' },
  { code: 'US', name: 'Amerika Birleşik Devletleri', flag: '🇺🇸' },
  { code: 'GB', name: 'Birleşik Krallık', flag: '🇬🇧' },
  { code: 'FR', name: 'Fransa', flag: '🇫🇷' },
  { code: 'IT', name: 'İtalya', flag: '🇮🇹' },
  { code: 'ES', name: 'İspanya', flag: '🇪🇸' },
  { code: 'NL', name: 'Hollanda', flag: '🇳🇱' },
  { code: 'BE', name: 'Belçika', flag: '🇧🇪' },
  { code: 'AT', name: 'Avusturya', flag: '🇦🇹' },
  { code: 'CH', name: 'İsviçre', flag: '🇨🇭' },
  { code: 'SE', name: 'İsveç', flag: '🇸🇪' },
  { code: 'NO', name: 'Norveç', flag: '🇳🇴' },
  { code: 'DK', name: 'Danimarka', flag: '🇩🇰' },
  { code: 'GR', name: 'Yunanistan', flag: '🇬🇷' },
  { code: 'SA', name: 'Suudi Arabistan', flag: '🇸🇦' },
  { code: 'AE', name: 'Birleşik Arap Emirlikleri', flag: '🇦🇪' },
  { code: 'RU', name: 'Rusya', flag: '🇷🇺' },
  { code: 'CA', name: 'Kanada', flag: '🇨🇦' },
  { code: 'AU', name: 'Avustralya', flag: '🇦🇺' },
  { code: 'JP', name: 'Japonya', flag: '🇯🇵' },
  { code: 'CN', name: 'Çin', flag: '🇨🇳' },
  { code: 'KR', name: 'Güney Kore', flag: '🇰🇷' },
  { code: 'BR', name: 'Brezilya', flag: '🇧🇷' },
  { code: 'AR', name: 'Arjantin', flag: '🇦🇷' },
  { code: 'EG', name: 'Mısır', flag: '🇪🇬' },
  { code: 'MA', name: 'Fas', flag: '🇲🇦' },
  { code: 'IN', name: 'Hindistan', flag: '🇮🇳' },
];

const GENDERS: Array<{ id: string; label: string }> = [
  { id: 'Kadın', label: 'Kadın' },
  { id: 'Erkek', label: 'Erkek' },
  { id: 'Diğer', label: 'Diğer' },
];

const normalizeCode = (code: string) => {
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
  const [countrySearch, setCountrySearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const birthValid = useMemo(() => {
    if (!birthDate.trim()) return true;
    const m = birthDate.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!m) return false;
    const day = Number(m[1]);
    const month = Number(m[2]);
    if (day < 1 || day > 31 || month < 1 || month > 12) return false;
    const year = Number(m[3]);
    return year >= 1900 && year <= new Date().getFullYear();
  }, [birthDate]);

  const phoneValid = useMemo(() => {
    if (!phone.trim()) return true;
    return /^[+\d][\d\s\-()]{5,}$/.test(phone.trim());
  }, [phone]);

  const fullNameValid = fullName.trim().length >= 2;

  // Profil tamamlanma yüzdesi (6 alan: ad, ülke, telefon, doğum, cinsiyet, bio)
  const completion = useMemo(() => {
    const checks = [
      fullName.trim().length >= 2,
      true, // ülke her zaman seçili
      phone.trim().length > 0,
      /^\d{2}\.\d{2}\.\d{4}$/.test(birthDate.trim()),
      gender.length > 0,
      bio.trim().length > 0,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [fullName, phone, birthDate, gender, bio]);

  const handlePickCountry = (c: { code: string; name: string }) => {
    sound.playSound('tap');
    sound.triggerHaptic('light');
    setCountryCode(normalizeCode(c.code));
    setCountryName(c.name);
    setCountryModalVisible(false);
    setCountrySearch('');
  };

  const handleFormatBirth = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    let out = digits;
    if (digits.length > 4) out = `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
    else if (digits.length > 2) out = `${digits.slice(0, 2)}.${digits.slice(2)}`;
    setBirthDate(out);
  };

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return COUNTRIES;
    const query = countrySearch.toLowerCase().trim();
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(query) || c.code.toLowerCase().includes(query)
    );
  }, [countrySearch]);

  const handleSave = async () => {
    if (!fullNameValid || !birthValid || !phoneValid || saving) {
      sound.triggerHaptic('error');
      setNotice({ ok: false, text: 'Lütfen kırmızı işaretli alanları kontrol edin.' });
      setTimeout(() => setNotice(null), 3500);
      return;
    }
    sound.playSound('tap');
    setSaving(true);
    setNotice({
      ok: true,
      text: 'Bilgiler PostgreSQL veritabanına kaydediliyor...',
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
        text: '✓ Bilgiler başarıyla güncellendi!',
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
    <TavrikoScreen>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Üst Navigasyon Çubuğu */}
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
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={styles.title}>Profili Düzenle</Text>
              <Text style={styles.subtitle}>Hesap ve kimlik bilgilerini güncelle</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>
        </Animated.View>

        {/* Hero Profil Kartı (Canlı PostgreSQL Göstergesi & Avatar) */}
        <Animated.View entering={FadeInDown.delay(60).springify().damping(16)} style={styles.heroCard}>
          <View style={styles.heroAvatarWrap}>
            <View style={styles.heroAvatarGlow} />
            <View style={styles.heroAvatarBorder}>
              <CharacterAvatar seed={user.avatarUrl || user.displayName || user.username} size={64} />
            </View>
          </View>
          <View style={styles.heroInfo}>
            <Text style={styles.heroDisplayName} numberOfLines={1}>
              {fullName || user.displayName}
            </Text>
            <View style={styles.heroBadgeRow}>
              <View style={styles.usernamePill}>
                <Text style={styles.usernamePillText}>@{user.username}</Text>
              </View>
              <View style={styles.syncStatusPill}>
                <View style={styles.syncPulseDot} />
                <Text style={styles.syncStatusText}>PostgreSQL Canlı</Text>
              </View>
            </View>
            {/* Profil Tamamlanma Çubuğu */}
            <View style={styles.completionWrap}>
              <View style={styles.completionBarTrack}>
                <Animated.View
                  entering={ZoomIn.delay(220).duration(500)}
                  style={[styles.completionBarFill, { width: `${completion}%` }]}
                >
                  <View style={styles.completionBarShine} />
                </Animated.View>
              </View>
              <Text style={styles.completionLabel}>Profil %{completion} tamamlandı</Text>
            </View>
          </View>
        </Animated.View>

        {/* Geri Bildirim Bildirim Bandı */}
        {notice && (
          <Animated.View entering={ZoomIn.duration(200)} style={[styles.noticeBanner, notice.ok ? styles.noticeOk : styles.noticeError]}>
            <Text style={[styles.noticeText, { color: notice.ok ? '#3FD08A' : '#FF5A6A' }]}>
              {notice.text}
            </Text>
          </Animated.View>
        )}

        {/* Form Alanları Kartı */}
        <Animated.View entering={FadeInDown.delay(120).springify().damping(16)} style={styles.formCard}>
          {/* Ad Soyad */}
          <Animated.View entering={FadeInDown.delay(100).springify().damping(16)} style={styles.fieldGroup}>
            <View style={styles.fieldLabelRow}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="#FFC43D" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                <Circle cx="12" cy="7" r="4" stroke="#FFC43D" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={styles.fieldLabel}>Ad Soyad</Text>
            </View>
            <View
              style={[
                styles.inputWrapper,
                focusedField === 'name' && styles.inputWrapperFocused,
                !fullNameValid && fullName.length > 0 && styles.inputWrapperError,
              ]}
            >
              <TextInput
                style={styles.textInput}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Adın ve Soyadın"
                placeholderTextColor="#9A8BC2"
                maxLength={40}
                onFocus={() => setFocusedField('name')}
                onBlur={() => setFocusedField(null)}
              />
              {fullNameValid && (
                <Animated.View entering={ZoomIn.duration(200)} style={styles.fieldCheckIcon}>
                  <Text style={styles.fieldCheckText}>✓</Text>
                </Animated.View>
              )}
            </View>
            {!fullNameValid && fullName.length > 0 && (
              <Text style={styles.fieldError}>En az 2 karakter girmelisiniz</Text>
            )}
          </Animated.View>

          {/* Kullanıcı Adı (Salt Okunur) */}
          <Animated.View entering={FadeInDown.delay(145).springify().damping(16)} style={styles.fieldGroup}>
            <View style={styles.fieldLabelRow}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Circle cx="12" cy="12" r="4" stroke="#A855F7" strokeWidth={2} />
                <Path d="M16 8v5a3 3 0 006 0v-1a10 10 0 10-3.92 7.94" stroke="#A855F7" strokeWidth={2} strokeLinecap="round" />
              </Svg>
              <Text style={styles.fieldLabel}>Kullanıcı Adı (Oyun Kimliği)</Text>
            </View>
            <View style={[styles.inputWrapper, styles.readonlyWrapper]}>
              <Text style={styles.readonlyValue}>@{user.username}</Text>
              <View style={styles.lockBadge}>
                <Text style={styles.lockBadgeText}>KİLİTLİ</Text>
              </View>
            </View>
            <Text style={styles.fieldHint}>Kullanıcı adı sıralama ve düellolarda değişmez kimliğindir.</Text>
          </Animated.View>

          {/* Ülke Seçimi */}
          <Animated.View entering={FadeInDown.delay(190).springify().damping(16)} style={styles.fieldGroup}>
            <View style={styles.fieldLabelRow}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Circle cx="12" cy="12" r="10" stroke="#38BDF8" strokeWidth={2} />
                <Path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" stroke="#38BDF8" strokeWidth={2} />
              </Svg>
              <Text style={styles.fieldLabel}>Ülke</Text>
            </View>
            <TouchableOpacity
              style={[styles.inputWrapper, styles.selectWrapper]}
              onPress={() => {
                sound.playSound('tap');
                setCountryModalVisible(true);
              }}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.countryCodeBadge}>
                  <Text style={styles.countryCodeText}>{countryCode}</Text>
                </View>
                <Text style={styles.selectText}>
                  {COUNTRIES.find((c) => c.code === countryCode)?.name || countryName}
                </Text>
              </View>
              <Text style={styles.selectChevron}>›</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Telefon Numarası */}
          <Animated.View entering={FadeInDown.delay(235).springify().damping(16)} style={styles.fieldGroup}>
            <View style={styles.fieldLabelRow}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" stroke="#5ADBB5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={styles.fieldLabel}>Telefon</Text>
            </View>
            <View
              style={[
                styles.inputWrapper,
                focusedField === 'phone' && styles.inputWrapperFocused,
                !phoneValid && phone.length > 0 && styles.inputWrapperError,
              ]}
            >
              <TextInput
                style={styles.textInput}
                value={phone}
                onChangeText={setPhone}
                placeholder="+90 5xx xxx xx xx"
                placeholderTextColor="#9A8BC2"
                keyboardType="phone-pad"
                maxLength={20}
                onFocus={() => setFocusedField('phone')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
            {!phoneValid && phone.length > 0 && (
              <Text style={styles.fieldError}>Geçerli bir telefon numarası girin</Text>
            )}
          </Animated.View>

          {/* Doğum Tarihi */}
          <Animated.View entering={FadeInDown.delay(280).springify().damping(16)} style={styles.fieldGroup}>
            <View style={styles.fieldLabelRow}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Rect x="3" y="4" width="18" height="18" rx="2" stroke="#FFC43D" strokeWidth={2} />
                <Path d="M16 2v4M8 2v4M3 10h18" stroke="#FFC43D" strokeWidth={2} strokeLinecap="round" />
              </Svg>
              <Text style={styles.fieldLabel}>Doğum Tarihi</Text>
            </View>
            <View
              style={[
                styles.inputWrapper,
                focusedField === 'birth' && styles.inputWrapperFocused,
                !birthValid && birthDate.length > 0 && styles.inputWrapperError,
              ]}
            >
              <TextInput
                style={styles.textInput}
                value={birthDate}
                onChangeText={handleFormatBirth}
                placeholder="01.01.2000"
                placeholderTextColor="#9A8BC2"
                keyboardType="number-pad"
                maxLength={10}
                onFocus={() => setFocusedField('birth')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
            {!birthValid && birthDate.length > 0 && (
              <Text style={styles.fieldError}>GG.AA.YYYY biçiminde girin</Text>
            )}
          </Animated.View>

          {/* Cinsiyet */}
          <Animated.View entering={FadeInDown.delay(325).springify().damping(16)} style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Cinsiyet</Text>
            <View style={styles.genderRow}>
              {GENDERS.map((g) => {
                const active = gender === g.id;
                return (
                  <TouchableOpacity
                    key={g.id}
                    style={[styles.genderPill, active && styles.genderPillActive]}
                    onPress={() => {
                      sound.playSound('tap');
                      sound.triggerHaptic('light');
                      setGender(active ? '' : g.id);
                    }}
                    activeOpacity={0.82}
                  >
                    <Text style={[styles.genderPillText, active && styles.genderPillTextActive]}>
                      {g.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>

          {/* Hakkımda (Bio) */}
          <Animated.View entering={FadeInDown.delay(370).springify().damping(16)} style={styles.fieldGroup}>
            <View style={styles.fieldLabelRow}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="#C084FC" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={styles.fieldLabel}>Hakkımda (Bio)</Text>
              <View style={{ flex: 1 }} />
              <Text style={styles.bioCounter}>{bio.length}/140</Text>
            </View>
            <View
              style={[
                styles.inputWrapper,
                styles.bioWrapper,
                focusedField === 'bio' && styles.inputWrapperFocused,
              ]}
            >
              <TextInput
                style={styles.bioInput}
                value={bio}
                onChangeText={(t) => setBio(t.slice(0, 140))}
                placeholder="Kendini kısaca anlat..."
                placeholderTextColor="#9A8BC2"
                multiline
                maxLength={140}
                onFocus={() => setFocusedField('bio')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </Animated.View>
        </Animated.View>

        {/* 3D Kaydet Butonu */}
        <Animated.View entering={FadeInDown.delay(180).springify().damping(16)} style={styles.ctaWrapper}>
          <Button3D
            title={saving ? 'KAYDEDİLİYOR...' : 'DEĞİŞİKLİKLERİ KAYDET'}
            variant="gold"
            onPress={handleSave}
            disabled={saving || !fullNameValid || !birthValid || !phoneValid}
            style={{ width: '100%', minHeight: 56 }}
            textStyle={{ fontSize: 16 }}
          />
        </Animated.View>
      </ScrollView>

      {/* Modern Ülke Seçim Modalı */}
      <Modal
        visible={countryModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCountryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Ülkeni Seç</Text>
            <View style={styles.modalSearchWrapper}>
              <TextInput
                style={styles.modalSearchInput}
                value={countrySearch}
                onChangeText={setCountrySearch}
                placeholder="Ülke ara..."
                placeholderTextColor="#9A8BC2"
                autoCorrect={false}
              />
            </View>
            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {filteredCountries.map((c) => {
                const active = countryCode === normalizeCode(c.code);
                return (
                  <TouchableOpacity
                    key={c.code}
                    style={[styles.countryRow, active && styles.countryRowActive]}
                    onPress={() => handlePickCountry(c)}
                    activeOpacity={0.82}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={styles.countryFlagEmoji}>{c.flag}</Text>
                      <Text style={styles.countryName}>{c.name}</Text>
                    </View>
                    <View style={styles.countryCodePill}>
                      <Text style={styles.countryCodePillText}>{c.code}</Text>
                    </View>
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
    </TavrikoScreen>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 60,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontFamily: THEME.fonts.extraBold,
    marginTop: -2,
  },
  title: {
    fontFamily: THEME.fonts.display,
    fontSize: 22,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.bold,
    textAlign: 'center',
    marginTop: 2,
    opacity: 0.8,
  },

  // Hero Profil Kartı
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  heroAvatarWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAvatarGlow: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 196, 61, 0.25)',
  },
  heroAvatarBorder: {
    borderRadius: 34,
    borderWidth: 2.5,
    borderColor: '#FFC43D',
    overflow: 'hidden',
  },
  heroInfo: {
    flex: 1,
  },
  heroDisplayName: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: THEME.fonts.display,
    marginBottom: 4,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  usernamePill: {
    backgroundColor: 'rgba(107, 60, 255, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(154, 107, 255, 0.45)',
  },
  usernamePillText: {
    color: '#D9CDF5',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  syncStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(63, 208, 138, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3FD08A',
  },
  syncPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3FD08A',
  },
  syncStatusText: {
    color: '#3FD08A',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
  },

  // Profil Tamamlanma Çubuğu
  completionWrap: {
    marginTop: 8,
    gap: 3,
  },
  completionBarTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  completionBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#FFC43D',
    overflow: 'hidden',
  },
  completionBarShine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    transform: [{ skewX: '-18deg' }],
  },
  completionLabel: {
    color: 'rgba(217, 205, 245, 0.75)',
    fontSize: 9.5,
    fontFamily: THEME.fonts.extraBold,
  },

  // Bildirim Bandı
  noticeBanner: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    alignItems: 'center',
  },
  noticeOk: {
    backgroundColor: 'rgba(63, 208, 138, 0.15)',
    borderColor: '#3FD08A',
  },
  noticeError: {
    backgroundColor: 'rgba(255, 90, 106, 0.15)',
    borderColor: '#FF5A6A',
  },
  noticeText: {
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    textAlign: 'center',
  },

  // Form Kartı
  formCard: {
    backgroundColor: 'rgba(20, 8, 48, 0.88)',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(107, 60, 255, 0.45)',
    padding: 14,
    gap: 12,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fieldLabel: {
    color: '#D9CDF5',
    fontSize: 11.5,
    fontFamily: THEME.fonts.extraBold,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 14,
    paddingHorizontal: 12,
    minHeight: 46,
  },
  inputWrapperFocused: {
    borderColor: '#FFC43D',
    backgroundColor: 'rgba(255, 196, 61, 0.08)',
  },
  inputWrapperError: {
    borderColor: '#FF5A6A',
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: THEME.fonts.extraBold,
    paddingVertical: 10,
  },
  fieldCheckIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(63, 208, 138, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldCheckText: {
    color: '#3FD08A',
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
  },
  fieldError: {
    color: '#FF5A6A',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
  },
  fieldHint: {
    color: 'rgba(217, 205, 245, 0.65)',
    fontSize: 10,
    fontFamily: THEME.fonts.bold,
  },

  // Salt Okunur
  readonlyWrapper: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    justifyContent: 'space-between',
  },
  readonlyValue: {
    color: '#D9CDF5',
    fontSize: 14,
    fontFamily: THEME.fonts.extraBold,
  },
  lockBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  lockBadgeText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 9,
    fontFamily: THEME.fonts.extraBold,
  },

  // Seçim Kutusu
  selectWrapper: {
    justifyContent: 'space-between',
  },
  countryCodeBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  countryCodeText: {
    color: '#38BDF8',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
  },
  selectText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontFamily: THEME.fonts.extraBold,
  },
  selectChevron: {
    color: '#FFC43D',
    fontSize: 18,
    fontFamily: THEME.fonts.extraBold,
  },

  // Cinsiyet Hapları
  genderRow: {
    flexDirection: 'row',
    gap: 8,
  },
  genderPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderPillActive: {
    borderColor: '#FFC43D',
    backgroundColor: 'rgba(255, 196, 61, 0.16)',
  },
  genderPillText: {
    color: '#D9CDF5',
    fontSize: 12.5,
    fontFamily: THEME.fonts.extraBold,
  },
  genderPillTextActive: {
    color: '#FFC43D',
  },

  // Bio
  bioWrapper: {
    minHeight: 80,
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  bioInput: {
    flex: 1,
    width: '100%',
    color: '#FFFFFF',
    fontSize: 13.5,
    fontFamily: THEME.fonts.extraBold,
    textAlignVertical: 'top',
  },
  bioCounter: {
    color: 'rgba(217, 205, 245, 0.6)',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
  },

  // CTA Butonu
  ctaWrapper: {
    marginTop: 14,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 4, 24, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '75%',
    backgroundColor: '#1E0E3E',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#6B3CFF',
    padding: 18,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontFamily: THEME.fonts.display,
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 12,
  },
  modalSearchWrapper: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 10,
  },
  modalSearchInput: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
  },
  modalList: {
    flexGrow: 0,
    maxHeight: 280,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 2,
  },
  countryRowActive: {
    backgroundColor: 'rgba(255, 196, 61, 0.15)',
  },
  countryFlagEmoji: {
    fontSize: 18,
  },
  countryName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
  },
  countryCodePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  countryCodePillText: {
    color: '#D9CDF5',
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
  },
  modalCloseBtn: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: '#FFC43D',
    backgroundColor: 'rgba(255, 196, 61, 0.12)',
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#FFC43D',
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
  },
});

export default ProfileEditScreen;
