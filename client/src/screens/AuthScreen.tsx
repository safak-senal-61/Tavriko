import { cdnImage } from '../utils/cdn';
import { getApiBaseUrl } from '../config';
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Platform,
  Modal,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { LoadingShimmer } from '../components/LoadingShimmer';
import * as ImagePicker from 'expo-image-picker';
import { compressAvatarImageAsync } from '../utils/avatarImage';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
// Doğum tarihi için şık takvim seçici (native). Web'de takvim girişi metin
// alanıyla korunur; modül yalnızca native'de yüklenir (web'de import
// edilmemesi bundle'ı ve platform uyumluluğunu korur).
let DateTimePickerModule: any = null;
if (Platform.OS !== 'web') {
  try {
    DateTimePickerModule = require('@react-native-community/datetimepicker').default;
  } catch {
    DateTimePickerModule = null;
  }
}
WebBrowser.maybeCompleteAuthSession();
const supabaseAuthUrl = 'https://rjvbgofzsfescnfohzgu.supabase.co/auth/v1';
const supabasePublishableKey = 'sb_publishable_ix4qzOkTfA-bFTKvsJ-tSA_rEs0YeEf';
const verifierKey = 'tavriko-google-code-verifier';
const web = Platform.OS === 'web';

async function saveVerifier(verifier: string) {
  const value = JSON.stringify({ verifier, expiresAt: Date.now() + 10 * 60_000 });
  if (web) window.sessionStorage.setItem(verifierKey, value);
  else await SecureStore.setItemAsync(verifierKey, value);
}

async function takeVerifier(): Promise<string | null> {
  const value = web ? window.sessionStorage.getItem(verifierKey) : await SecureStore.getItemAsync(verifierKey);
  if (web) window.sessionStorage.removeItem(verifierKey);
  else await SecureStore.deleteItemAsync(verifierKey);
  if (!value) return null;
  const { verifier, expiresAt } = JSON.parse(value);
  return typeof verifier === 'string' && expiresAt > Date.now() ? verifier : null;
}
import { UserProfile, LEGAL_VERSION, LegalDocumentId } from '@trivia/shared';
import {
  LegalConsentCheckbox,
  LegalDocumentModal,
  LegalLinksText,
} from '../components/LegalDocuments';
import { markGoogleLegalAcknowledged } from '../utils/legalConsent';
import { THEME } from '../theme/tokens';
import {
  CharacterAvatar,
  AVATAR_PRESETS,
  Button3D,
  CoinIcon,
  EyeOpenIcon,
  EyeOffIcon,
} from '../components/TavrikoIcons';
import { GuestDiscoveryCard } from '../components/DiscoveryArtwork';
import { usePlayerWebLayout } from '../navigation/PlayerWebLayoutContext';
import Reanimated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { sound } from '../services/soundService';

// Tavriko marka logosu (şeffaf arka planlı, CDN yerine paket içinden — hızlı ve garantili)
const AUTH_LOGO = cdnImage('images/brand/emblem_tight.png');
const AUTH_ARENA = cdnImage('images/duel_banner.png');

/** Doğum tarihi: Date → "GG.AA.YYYY" (sunucunun beklediği biçim). */
function formatBirthDateTR(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

/** "GG.AA.YYYY" → Date; ayrıştırılamazsa null (takvim seçicisi varsayılanı için). */
function parseBirthDateTR(value: string): Date | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec((value || '').trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(d.getTime()) ? null : d;
}
interface AuthScreenProps {
  wideLayout?: boolean;
  onSuccess: (user: UserProfile, token: string) => void;
  onGuestContinue: () => void;
  apiBaseUrl: string;
  redirectNotice?: string | null;
}
const AVATAR_OPTIONS = AVATAR_PRESETS.map((p) => p.id);
interface CountryOption {
  code: string;
  name: string;
  dial: string;
  flag: string;
}
const COUNTRIES: CountryOption[] = [
  { code: 'TR', name: 'Türkiye', dial: '+90', flag: '🇹🇷' },
  { code: 'AZ', name: 'Azerbaycan', dial: '+994', flag: '🇦🇿' },
  { code: 'DE', name: 'Almanya', dial: '+49', flag: '🇩🇪' },
  { code: 'US', name: 'ABD', dial: '+1', flag: '🇺🇸' },
  { code: 'GB', name: 'Birleşik Krallık', dial: '+44', flag: '🇬🇧' },
  { code: 'NL', name: 'Hollanda', dial: '+31', flag: '🇳🇱' },
  { code: 'FR', name: 'Fransa', dial: '+33', flag: '🇫🇷' },
  { code: 'CY', name: 'KKTC', dial: '+90', flag: '🇨🇾' },
];
const GoogleGLogo: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 48 48">
    <Path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <Path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <Path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <Path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
  </Svg>
);
export const AuthScreen: React.FC<AuthScreenProps> = ({
  wideLayout = false,
  onSuccess,
  onGuestContinue,
  apiBaseUrl,
  redirectNotice,
}) => {
  const page = usePlayerWebLayout();
  const wideFullscreen = wideLayout && page?.fullscreen;
  const resetApiBase = Platform.OS === 'web' ? getApiBaseUrl() : apiBaseUrl;
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [regStep, setRegStep] = useState<1 | 2 | 3 | 4>(1);
  // Yasal metin onayı (kayıt) ve metin görüntüleyici
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [legalError, setLegalError] = useState(false);
  const [openLegalDoc, setOpenLegalDoc] = useState<LegalDocumentId | null>(null);
  // Login & Register core fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  // Step 2 & 3 & 4 Extended fields
  // Ad ve soyad ayrı alanlarda toplanır; sunucuya birleştirilerek gider.
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<CountryOption>(COUNTRIES[0]);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [birthDate, setBirthDate] = useState('');
  // Doğum tarihi takvim seçicisi (native): açık/kapalı durumu.
  const [birthDatePickerOpen, setBirthDatePickerOpen] = useState(false);
  const [gender, setGender] = useState<'Belirtmek İstemiyorum' | 'Erkek' | 'Kadın'>(
    'Belirtmek İstemiyorum'
  );
  const [bio, setBio] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('av1');
  const [customPhotoUri, setCustomPhotoUri] = useState<string | null>(null);
  // Password visibility toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  // Password Reset flow
  const [resetStep, setResetStep] = useState<'request' | 'verify'>('request');
  const [resetCode, setResetCode] = useState('');
  const [resetResendAt, setResetResendAt] = useState(0);
  const [resetResendSeconds, setResetResendSeconds] = useState(0);
  const [newResetPassword, setNewResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!resetResendAt) return;
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((resetResendAt - Date.now()) / 1000));
      setResetResendSeconds(remaining);
      if (!remaining) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [resetResendAt]);
  // Mobilde giriş/kayıt ekranı sayfaya tam sığmalı (kaydırma olmamalı).
  // Küçük ekranlarda yerleşim kompaktlaştırılır; web'de dar görünümlü
  // (telefon) pencerelerde de kompakt mod devreye girer; masaüstündeki
  // ferah yerleşim korunur.
  // Not: Modern telefonların çoğu 820dp'den yüksek; native'de kompakt mod
  // her zaman açık (masaüstü ferah yerleşimi yalnızca geniş web penceresi).
  const { height: winH, width: winW } = useWindowDimensions();
  const compact = Platform.OS !== 'web' || winW < 520;
  // Çok küçük ekranlar (≤740dp): ekstra sıkı katman — hero, girişler ve
  // butonlar daha da küçültülür.
  const tiny = winH <= 740;
  // Google'dan dönüşte (adres çubuğunda token/code varsa) giriş formu yerine "oturum açılıyor" göster
  const [finishingOAuth, setFinishingOAuth] = useState(() =>
    Platform.OS === 'web' && typeof window !== 'undefined' &&
    /(?:[?#&])(?:code|error)=/.test(window.location.href));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!finishingOAuth) return;
    // Beklenmedik bir durumda ekranda takılı kalma: 20 sn sonra giriş formuna dön
    const t = setTimeout(() => setFinishingOAuth(false), 20000);
    return () => clearTimeout(t);
  }, [finishingOAuth]);
  // Not: Logo ve "Tavriko" başlığı artık sabittir (yüzen/parlayan animasyon
  // kaldırıldı) — küçük ekranlarda da ekran kullanımı daha verimli.
  const handlePickImage = async () => {
    sound.playSound('tap');
    sound.triggerHaptic('light');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const rawUri = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;
        setCustomPhotoUri(await compressAvatarImageAsync(rawUri));
        sound.playSound('correct');
      }
    } catch {
      setErrorMsg('Galeriye erişilemedi, hazır avatarlardan birini seçebilirsiniz.');
    }
  };
  // Validate Step before moving forward in Multi-Step Registration
  const handleNextRegStep = () => {
    setErrorMsg(null);
    if (regStep === 1) {
      if (!email.trim() || !email.includes('@')) {
        sound.playSound('wrong');
        setErrorMsg('Lütfen geçerli bir e-posta adresi girin.');
        return;
      }
      if (!displayName.trim() || displayName.trim().length < 3) {
        sound.playSound('wrong');
        setErrorMsg('Kullanıcı adı en az 3 karakter olmalıdır.');
        return;
      }
      if (!password || password.length < 8) {
        sound.playSound('wrong');
        setErrorMsg('Şifreniz en az 8 karakter olmalıdır.');
        return;
      }
      if (password !== confirmPassword) {
        sound.playSound('wrong');
        setErrorMsg('Girilen şifreler birbiriyle eşleşmiyor.');
        return;
      }
      sound.playSound('reward');
      setRegStep(2);
    } else if (regStep === 2) {
      sound.playSound('reward');
      setRegStep(3);
    } else if (regStep === 3) {
      sound.playSound('reward');
      setRegStep(4);
    }
  };
  const handlePrevRegStep = () => {
    setErrorMsg(null);
    sound.playSound('tap');
    if (regStep > 1) {
      setRegStep((prev) => (prev - 1) as 1 | 2 | 3 | 4);
    }
  };
  const handleSubmit = async () => {
    setErrorMsg(null);
    sound.playSound('tap');
    if (mode === 'login') {
      if (!email.trim() || !password.trim()) {
        sound.playSound('wrong');
        setErrorMsg('Lütfen e-posta (veya kullanıcı adı) ve şifrenizi girin.');
        return;
      }
    } else if (mode === 'register') {
      if (!email.trim() || !email.includes('@')) {
        sound.playSound('wrong');
        setErrorMsg('Lütfen geçerli bir e-posta adresi girin.');
        setRegStep(1);
        return;
      }
      if (!displayName.trim() || displayName.trim().length < 3) {
        sound.playSound('wrong');
        setErrorMsg('Kullanıcı adı en az 3 karakter olmalıdır.');
        setRegStep(1);
        return;
      }
      if (!password || password.length < 8) {
        sound.playSound('wrong');
        setErrorMsg('Şifre en az 8 karakter olmalıdır.');
        setRegStep(1);
        return;
      }
      if (!legalAccepted) {
        sound.playSound('wrong');
        setLegalError(true);
        setErrorMsg('Kayıt olmak için Kullanım Koşulları, Gizlilik Politikası ve KVKK Aydınlatma Metni’ni onaylamalısın.');
        return;
      }
    }
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const finalAvatar = customPhotoUri || selectedAvatar;
      const formattedPhone = phoneNumber.trim()
        ? `${selectedCountry.dial} ${phoneNumber.trim()}`
        : undefined;
      const body =
        mode === 'login'
          ? { email: email.trim(), password }
          : {
              email: email.trim(),
              password,
              displayName: displayName.trim(),
              // Ad + soyad ayrı alanlardan birleştirilir.
              fullName: `${firstName.trim()} ${lastName.trim()}`.trim() || undefined,
              country: `${selectedCountry.flag} ${selectedCountry.name}`,
              phoneNumber: formattedPhone,
              birthDate: birthDate.trim() || undefined,
              gender,
              bio: bio.trim() || undefined,
              avatarUrl: finalAvatar,
              acceptedLegalVersion: LEGAL_VERSION,
            };
      const res = await fetch(`${apiBaseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'İşlem başarısız oldu.');
      }
      sound.playSound('victory');
      sound.triggerHaptic('success');
      onSuccess(data.user, data.token);
    } catch (err: any) {
      sound.playSound('wrong');
      setErrorMsg(err.message || 'Sunucuya bağlanılamadı');
    } finally {
      setLoading(false);
    }
  };
  const lastProcessedCode = useRef<string | null>(null);
  const handleAuthRedirectUrl = async (raw: string) => {
    // React Native's URL polyfill does not expose hostname for custom schemes.
    const nativeLink = /^tavriko:\/\/auth-callback\/?(?=[?#]|$)/i;
    if (!web && !nativeLink.test(raw)) return;
    let code: string | null;
    let hasError: boolean;
    try {
      const url = new URL(web ? raw : raw.replace(nativeLink, 'https://callback.invalid/'));
      const hash = new URLSearchParams(url.hash.slice(1));
      code = url.searchParams.get('code') || hash.get('code');
      hasError = hash.has('error') || url.searchParams.has('error');
    } catch { return; }
    if (!code && !hasError) return;
    if (code && lastProcessedCode.current === code) return;
    lastProcessedCode.current = code;
    setLoading(true);
    try {
      if (!code || !/^[a-zA-Z0-9_-]{8,128}$/.test(code)) throw new Error('Google OAuth tamamlanmadı.');
      const verifier = await takeVerifier();
      if (!verifier) throw new Error('Google oturumu doğrulanamadı.');
      const exchange = await fetch(`${supabaseAuthUrl}/token?grant_type=pkce`, {
        method: 'POST',
        headers: { apikey: supabasePublishableKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
      });
      if (!exchange.ok) throw new Error('Google oturumu doğrulanamadı.');
      const { access_token: accessToken } = await exchange.json();
      if (typeof accessToken !== 'string' || !accessToken) throw new Error('Google oturumu doğrulanamadı.');
      const response = await fetch(`${apiBaseUrl}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken }),
      });
      if (!response.ok) throw new Error('Google girişi reddedildi.');
      const result = await response.json();
      sound.playSound('victory');
      sound.triggerHaptic('success');
      onSuccess(result.user, result.token);
    } catch {
      sound.playSound('wrong');
      setErrorMsg('Google girişi tamamlanamadı. Lütfen yeniden dene.');
    } finally {
      setFinishingOAuth(false);
      setLoading(false);
    }
  };
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const currentUrl = window.location.href;
      if (/(?:[?#&])(?:code|error)=/.test(currentUrl)) {
        const path = window.location.pathname === '/api/auth/google/callback'
          ? '/app'
          : window.location.pathname;
        try { window.history.replaceState(null, '', path); } catch {}
        void handleAuthRedirectUrl(currentUrl);
      }
      return;
    }
    Linking.getInitialURL().then((url) => {
      if (url) void handleAuthRedirectUrl(url);
    }).catch(() => {});
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (url) void handleAuthRedirectUrl(url);
    });
    return () => subscription.remove();
  }, []);

  const handleRealGoogleSignIn = async () => {
    sound.playSound('tap');
    sound.triggerHaptic('medium');
    setErrorMsg(null);
    setLoading(true);
    markGoogleLegalAcknowledged();
    lastProcessedCode.current = null;
    try {
      const redirectTo = Platform.OS === 'web'
        ? `${window.location.origin}/api/auth/google/callback`
        : 'tavriko://auth-callback';
      const verifier = Array.from(await Crypto.getRandomBytesAsync(32),
        byte => byte.toString(16).padStart(2, '0')).join('');
      const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier,
        { encoding: Crypto.CryptoEncoding.BASE64 });
      const challenge = digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      await saveVerifier(verifier);
      const params = new URLSearchParams({
        provider: 'google', redirect_to: redirectTo, prompt: 'select_account',
        code_challenge: challenge, code_challenge_method: 's256',
      });
      const authorizationUrl = `${supabaseAuthUrl}/authorize?${params.toString()}`;
      if (Platform.OS === 'web') {
        window.location.assign(authorizationUrl);
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, redirectTo);
      if (result.type === 'success' && result.url) await handleAuthRedirectUrl(result.url);
      if (!lastProcessedCode.current) setLoading(false);
    } catch {
      sound.playSound('wrong');
      setErrorMsg('Google ile giriş yapılamadı. Lütfen yeniden dene.');
      setLoading(false);
    }
  };
  const clearResetForm = () => {
    setResetStep('request');
    setResetCode('');
    setNewResetPassword('');
    setConfirmResetPassword('');
    setShowResetPassword(false);
    setResetSuccessMsg(null);
    setResetResendAt(0);
    setResetResendSeconds(0);
    setErrorMsg(null);
  };
  const handleRequestResetCode = async () => {
    if (loading || (resetStep === 'verify' && Date.now() < resetResendAt)) return;
    setErrorMsg(null);
    const target = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target) || target.length > 254) {
      sound.playSound('wrong');
      setErrorMsg('Şifre sıfırlama kodu için kayıtlı e-posta adresinizi girin.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${resetApiBase}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: target }),
      });
      const data = await res.json();
      if (!res.ok || data.success !== true) {
        throw new Error(data.error || 'Sıfırlama kodu gönderilemedi.');
      }
      sound.playSound('reward');
      setResetCode('');
      const wait = Math.max(0, Math.min(600, Number(data.resendAfterSeconds) || 60));
      setResetResendAt(Date.now() + wait * 1000);
      setResetResendSeconds(wait);
      setResetStep('verify');
      setResetSuccessMsg(data.message);
    } catch (err: any) {
      sound.playSound('wrong');
      setErrorMsg(err.message || 'İşlem başarısız oldu.');
    } finally {
      setLoading(false);
    }
  };
  const handleConfirmResetPassword = async () => {
    if (loading) return;
    setErrorMsg(null);
    if (!/^\d{6}$/.test(resetCode)) {
      sound.playSound('wrong');
      setErrorMsg('6 haneli doğrulama kodunu eksiksiz girin.');
      return;
    }
    if (!newResetPassword || newResetPassword.length < 8) {
      sound.playSound('wrong');
      setErrorMsg('Yeni şifreniz en az 8 karakter olmalıdır.');
      return;
    }
    if (newResetPassword !== confirmResetPassword) {
      sound.playSound('wrong');
      setErrorMsg('Yeni şifreler birbiriyle eşleşmiyor.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${resetApiBase}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          code: resetCode.trim(),
          newPassword: newResetPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.success !== true) {
        throw new Error(data.error || 'Şifre güncellenemedi.');
      }
      sound.playSound('victory');
      setPassword('');
      setMode('login');
      clearResetForm();
      setResetSuccessMsg('Şifreniz başarıyla yenilendi! Şimdi giriş yapabilirsiniz.');
    } catch (err: any) {
      sound.playSound('wrong');
      setErrorMsg(err.message || 'Şifre sıfırlama hatası.');
    } finally {
      setLoading(false);
    }
  };
  // Step bonus calculation
  const stepBonusCoins = regStep * 200;
  const stepBonusGems = regStep * 5;
  const stepProgressPct = regStep * 25;
  const guestEntry = (
    <Reanimated.View entering={FadeInUp.delay(320).duration(450)}>
      <GuestDiscoveryCard
        compact
        onPress={() => {
          sound.playSound('nav');
          sound.triggerHaptic('light');
          onGuestContinue();
        }}
      />
    </Reanimated.View>
  );
  if (finishingOAuth && !errorMsg) {
    return (
      <View style={[styles.authRoot, { alignItems: 'center', justifyContent: 'center' }]}>
        <LoadingShimmer wide />
        <Text style={{ color: '#D9CDF5', fontSize: 14, marginTop: 16, fontFamily: THEME.fonts.bold }}>
          Google hesabınla oturum açılıyor...
        </Text>
      </View>
    );
  }
  return (
    <View style={[styles.authRoot, wideLayout && styles.authRootWide]}>
      {/* Luxury Multi-Layered Cosmic Background */}
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 400 850" preserveAspectRatio="none" pointerEvents="none">
        <Defs>
          <LinearGradient id="bgGrad" x1="0" y1="0" x2="0.3" y2="1">
            <Stop offset="0" stopColor="#2E1165" />
            <Stop offset="0.45" stopColor="#1B0A3E" />
            <Stop offset="1" stopColor="#0E0422" />
          </LinearGradient>
        </Defs>
        <Path d="M0 0h400v850H0z" fill="url(#bgGrad)" />
        <Circle cx="200" cy="130" r="190" fill="#6D28D9" opacity="0.25" />
        <Circle cx="340" cy="360" r="140" fill="#2563EB" opacity="0.16" />
        <Circle cx="50" cy="620" r="160" fill="#DB2777" opacity="0.15" />
      </Svg>
      <ScrollView
        style={[styles.scrollView, wideLayout && styles.authRootWide]}
        contentContainerStyle={[
          styles.scrollContent,
          compact && styles.scrollContentCompact,
          tiny && styles.scrollContentTiny,
          wideLayout && styles.scrollContentWide,
          wideFullscreen && styles.scrollContentFullscreen,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[wideLayout && styles.authIntro, wideFullscreen && styles.authIntroFullscreen]}>
        {/* Clean Modern Brand Header (3D Crown) — sabit, animasyonsuz */}
        <View style={[styles.heroWrap, compact && styles.heroWrapCompact, tiny && styles.heroWrapTiny, wideLayout && styles.heroWrapWide]}>
          <View style={[styles.heroCrownWrap, compact && styles.heroCrownWrapCompact, tiny && styles.heroCrownWrapTiny]}>
            <View style={[styles.heroCrownGlow, compact && styles.heroCrownGlowCompact]} />
            <Image
              source={AUTH_LOGO}
              style={[styles.heroLogo, compact && styles.heroLogoCompact, tiny && styles.heroLogoTiny]}
              resizeMode="contain"
              accessibilityLabel="Tavriko logosu"
            />
          </View>
          <View>
            <Text style={[styles.cleanBrandTitle, compact && styles.cleanBrandTitleCompact, tiny && styles.cleanBrandTitleTiny]}>Tavriko</Text>
            <Text style={[styles.brandSubtitle, compact && styles.brandSubtitleCompact, tiny && styles.brandSubtitleTiny]}>CANLI BİLGİ & DÜELLO</Text>
          </View>
        </View>
          {wideLayout && (
            <>
              <View style={styles.arenaPreview}>
                <Image source={AUTH_ARENA} style={styles.arenaImage} resizeMode="cover" accessible={false} />
                <View style={styles.arenaCaption}>
                  <Text style={styles.arenaTitle}>Bilgini yarıştır, kazan!</Text>
                  <Text style={styles.arenaSubtitle}>Canlı düellolar, günlük görevler ve Pro Lig</Text>
                </View>
              </View>
              {guestEntry}
            </>
          )}
        </View>
        {/* Main Glass Auth Card */}
        <Reanimated.View entering={FadeInDown.delay(220).duration(500).springify().damping(16)} style={[
          styles.card, compact && styles.cardCompact, tiny && styles.cardTiny,
          wideLayout && styles.cardWide, wideFullscreen && styles.cardFullscreen,
        ]}>
          {redirectNotice ? (
            <View style={styles.redirectNoticeBanner}>
              <Text style={styles.errorText}>🔒 {redirectNotice}</Text>
            </View>
          ) : null}
          {/* Top Tabs: ONLY Giriş Yap & Kayıt Ol */}
          {mode !== 'forgot' && (
            <View style={[styles.tabRow, compact && styles.tabRowCompact, tiny && styles.tabRowTiny]}>
              <TouchableOpacity
                style={[styles.tabBtn, compact && styles.tabBtnCompact, tiny && styles.tabBtnTiny, mode === 'login' && styles.tabBtnActive]}
                onPress={() => {
                  sound.playSound('nav');
                  setMode('login');
                  setErrorMsg(null);
                }}
              >
                <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>
                  Giriş Yap
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, compact && styles.tabBtnCompact, tiny && styles.tabBtnTiny, mode === 'register' && styles.tabBtnActive]}
                onPress={() => {
                  sound.playSound('nav');
                  setMode('register');
                  setErrorMsg(null);
                  setResetSuccessMsg(null);
                }}
              >
                <Text style={[styles.tabText, mode === 'register' && styles.tabTextActive]}>
                  Kayıt Ol
                </Text>
              </TouchableOpacity>
            </View>
          )}
          {resetSuccessMsg && mode === 'login' && (
            <Reanimated.View entering={ZoomIn.duration(220)} style={styles.successBanner}>
              <Text style={styles.successText}>✓ {resetSuccessMsg}</Text>
            </Reanimated.View>
          )}
          {/* ==================== LOGIN FORM ==================== */}
          {mode === 'login' && (
            <Reanimated.View key="login-form" entering={FadeInDown.delay(80).duration(420).springify().damping(16)}>
              <Text style={[styles.label, compact && styles.labelCompact, tiny && styles.labelTiny]}>E-POSTA VEYA KULLANICI ADI</Text>
              <TextInput
                style={[styles.input, compact && styles.inputCompact, tiny && styles.inputTiny]}
                placeholder="ornek@gmail.com veya kullaniciadi"
                placeholderTextColor={THEME.colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                testID="login-email-input"
                value={email}
                onChangeText={setEmail}
              />
              <Text style={[styles.label, compact && styles.labelCompact, tiny && styles.labelTiny]}>ŞİFRE</Text>
              <View style={styles.passwordInputWrap}>
                <TextInput
                  style={[styles.passwordInput, compact && styles.inputCompact, tiny && styles.inputTiny]}
                  placeholder="••••••••"
                  placeholderTextColor={THEME.colors.textMuted}
                  secureTextEntry={!showPassword}
                  testID="login-password-input"
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => {
                    sound.playSound('tap');
                    setShowPassword(!showPassword);
                  }}
                >
                  {showPassword ? <EyeOpenIcon size={20} /> : <EyeOffIcon size={20} />}
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.forgotLinkWrap}
                accessibilityRole="button"
                testID="open-password-reset"
                onPress={() => {
                  sound.playSound('tap');
                  clearResetForm();
                  setMode('forgot');
                }}
              >
                <Text style={styles.forgotLinkText}>Şifremi Unuttum?</Text>
              </TouchableOpacity>
              {errorMsg && (
                <Reanimated.View entering={ZoomIn.duration(220)} style={styles.errorBanner}>
                  <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
                </Reanimated.View>
              )}
              {loading ? (
                <LoadingShimmer wide label="Oturum açılıyor" style={{ marginTop: compact ? 8 : 12 }} />
              ) : (
                <Button3D
                  title="GİRİŞ YAP"
                  variant="gold"
                  testID="login-submit"
                  onPress={handleSubmit}
                  style={[{ marginTop: compact ? 8 : 12 }, compact && styles.btnCompact, tiny && styles.btnTiny]}
                />
              )}
            </Reanimated.View>
          )}
          {/* ==================== STEP-BY-STEP REGISTER WIZARD ==================== */}
          {mode === 'register' && (
            <Reanimated.View key={'register-form-' + regStep} entering={FadeInDown.delay(80).duration(420).springify().damping(16)}>
              {/* Step Progress Header */}
              <View style={[styles.stepWizardBox, compact && styles.stepWizardBoxCompact, tiny && styles.stepWizardBoxTiny]}>
                <View style={[styles.stepWizardHeader, compact && styles.stepWizardHeaderCompact]}>
                  <View style={styles.stepBadgeRow}>
                    <Text style={styles.stepTitleText}>
                      ADIM {regStep} / 4 ·{' '}
                      {regStep === 1
                        ? 'HESAP BİLGİLERİ'
                        : regStep === 2
                        ? 'KİŞİSEL BİLGİLER'
                        : regStep === 3
                        ? 'ÜLKE & İLETİŞİM'
                        : 'PROFİL & AVATAR'}
                    </Text>
                  </View>
                  <Text style={styles.stepBonusPill}>
                    +{stepBonusCoins} Altın · +{stepBonusGems} Elmas
                  </Text>
                </View>
                {/* 4 Step Dots Bar */}
                <View style={styles.stepDotsContainer}>
                  {[1, 2, 3, 4].map((st) => {
                    const active = regStep >= st;
                    const current = regStep === st;
                    return (
                      <TouchableOpacity
                        key={st}
                        style={[
                          styles.stepSegment,
                          active && styles.stepSegmentActive,
                          current && styles.stepSegmentCurrent,
                        ]}
                        onPress={() => {
                          if (st < regStep) {
                            sound.playSound('tap');
                            setRegStep(st as 1 | 2 | 3 | 4);
                          }
                        }}
                        activeOpacity={0.8}
                      />
                    );
                  })}
                </View>
              </View>
              {/* STEP 1: Account Credentials */}
              {regStep === 1 && (
                <View>
                  <Text style={[styles.label, compact && styles.labelCompact, tiny && styles.labelTiny]}>E-POSTA ADRESİ *</Text>
                  <TextInput
                    style={[styles.input, compact && styles.inputCompact, tiny && styles.inputTiny]}
                    placeholder="ornek@gmail.com"
                    placeholderTextColor={THEME.colors.textMuted}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                  />
                  <Text style={[styles.label, compact && styles.labelCompact, tiny && styles.labelTiny]}>KULLANICI ADI *</Text>
                  <TextInput
                    style={[styles.input, compact && styles.inputCompact, tiny && styles.inputTiny]}
                    placeholder="Örn: DenizPro"
                    placeholderTextColor={THEME.colors.textMuted}
                    autoCapitalize="none"
                    value={displayName}
                    onChangeText={setDisplayName}
                  />
                  <Text style={[styles.label, compact && styles.labelCompact, tiny && styles.labelTiny]}>ŞİFRE (EN AZ 6 KARAKTER) *</Text>
                  <View style={styles.passwordInputWrap}>
                    <TextInput
                      style={[styles.passwordInput, compact && styles.inputCompact, tiny && styles.inputTiny]}
                      placeholder="••••••••"
                      placeholderTextColor={THEME.colors.textMuted}
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={setPassword}
                    />
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => {
                        sound.playSound('tap');
                        setShowPassword(!showPassword);
                      }}
                    >
                      {showPassword ? <EyeOpenIcon size={20} /> : <EyeOffIcon size={20} />}
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.label, compact && styles.labelCompact, tiny && styles.labelTiny]}>ŞİFRE TEKRAR *</Text>
                  <View style={styles.passwordInputWrap}>
                    <TextInput
                      style={[styles.passwordInput, compact && styles.inputCompact, tiny && styles.inputTiny]}
                      placeholder="••••••••"
                      placeholderTextColor={THEME.colors.textMuted}
                      secureTextEntry={!showConfirmPassword}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                    />
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => {
                        sound.playSound('tap');
                        setShowConfirmPassword(!showConfirmPassword);
                      }}
                    >
                      {showConfirmPassword ? (
                        <EyeOpenIcon size={20} />
                      ) : (
                        <EyeOffIcon size={20} />
                      )}
                    </TouchableOpacity>
                  </View>
                  {errorMsg && (
                    <View style={styles.errorBanner}>
                      <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
                    </View>
                  )}
                  <Button3D
                    title="DEVAM ET (ADIM 2/4) →"
                    variant="gold"
                    onPress={handleNextRegStep}
                    style={[{ marginTop: compact ? 10 : 14 }, compact && styles.btnCompact, tiny && styles.btnTiny]}
                  />
                </View>
              )}
              {/* STEP 2: Personal Details */}
              {regStep === 2 && (
                <View>
                  <Text style={[styles.label, compact && styles.labelCompact, tiny && styles.labelTiny]}>AD</Text>
                  <TextInput
                    style={[styles.input, compact && styles.inputCompact, tiny && styles.inputTiny]}
                    placeholder="Örn: Zeynep"
                    placeholderTextColor={THEME.colors.textMuted}
                    autoCapitalize="words"
                    value={firstName}
                    onChangeText={setFirstName}
                  />
                  <Text style={[styles.label, compact && styles.labelCompact, tiny && styles.labelTiny]}>SOYAD</Text>
                  <TextInput
                    style={[styles.input, compact && styles.inputCompact, tiny && styles.inputTiny]}
                    placeholder="Örn: Demir"
                    placeholderTextColor={THEME.colors.textMuted}
                    autoCapitalize="words"
                    value={lastName}
                    onChangeText={setLastName}
                  />
                  <Text style={styles.fieldHintText}>Gerçek adın yalnızca profilinde görünür, kullanıcı adınla karıştırılmaz.</Text>
                  <Text style={[styles.label, compact && styles.labelCompact, tiny && styles.labelTiny]}>DOĞUM TARİHİ</Text>
                  {Platform.OS === 'web' || !DateTimePickerModule ? (
                    <TextInput
                      style={[styles.input, compact && styles.inputCompact, tiny && styles.inputTiny]}
                      placeholder="GG.AA.YYYY (Örn: 15.06.2000)"
                      placeholderTextColor={THEME.colors.textMuted}
                      value={birthDate}
                      onChangeText={setBirthDate}
                    />
                  ) : (
                    <>
                      <TouchableOpacity
                        style={[styles.datePickerBtn, compact && styles.datePickerBtnCompact]}
                        onPress={() => {
                          sound.playSound('tap');
                          setBirthDatePickerOpen(true);
                        }}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.datePickerIcon}>📅</Text>
                        <Text style={[styles.datePickerText, !birthDate && styles.datePickerPlaceholder]}>
                          {birthDate || 'Takvimden doğum tarihini seç'}
                        </Text>
                        <Text style={styles.countryPickerArrow}>▼</Text>
                      </TouchableOpacity>
                      {birthDatePickerOpen && (
                        <DateTimePickerModule
                          value={parseBirthDateTR(birthDate) || new Date(2000, 0, 15)}
                          mode="date"
                          maximumDate={new Date()}
                          minimumDate={new Date(1930, 0, 1)}
                          display={Platform.OS === 'ios' ? 'inline' : 'default'}
                          onChange={(event: any, date?: Date) => {
                            // Android'de iptal de onChange üretir; dismiss durumunda seçim yapılmaz.
                            setBirthDatePickerOpen(false);
                            if (date) setBirthDate(formatBirthDateTR(date));
                          }}
                        />
                      )}
                    </>
                  )}
                  <Text style={[styles.label, compact && styles.labelCompact, tiny && styles.labelTiny]}>CİNSİYET SEÇİMİ</Text>
                  <View style={styles.genderRow}>
                    {(['Erkek', 'Kadın', 'Belirtmek İstemiyorum'] as const).map((g) => {
                      const active = gender === g;
                      return (
                        <TouchableOpacity
                          key={g}
                          style={[styles.genderChip, compact && styles.genderChipCompact, active && styles.genderChipActive]}
                          onPress={() => {
                            sound.playSound('tap');
                            setGender(g);
                          }}
                        >
                          <Text
                            style={[styles.genderChipText, active && styles.genderChipTextActive]}
                          >
                            {g === 'Belirtmek İstemiyorum' ? 'Belirtme' : g}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {errorMsg && (
                    <View style={styles.errorBanner}>
                      <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
                    </View>
                  )}
                  <View style={[styles.stepNavButtonsRow, compact && styles.stepNavButtonsRowCompact]}>
                    <TouchableOpacity style={[styles.backStepBtn, compact && styles.backStepBtnCompact]} onPress={handlePrevRegStep}>
                      <Text style={styles.backStepBtnText}>← GERİ</Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Button3D
                        title="DEVAM ET (3/4) →"
                        variant="gold"
                        onPress={handleNextRegStep}
                      />
                    </View>
                  </View>
                </View>
              )}
              {/* STEP 3: Country & Phone */}
              {regStep === 3 && (
                <View>
                  <Text style={[styles.label, compact && styles.labelCompact, tiny && styles.labelTiny]}>ÜLKE SEÇİCİ</Text>
                  <TouchableOpacity
                    style={[styles.countryPickerBtn, compact && styles.countryPickerBtnCompact]}
                    onPress={() => {
                      sound.playSound('tap');
                      setCountryPickerOpen(true);
                    }}
                  >
                    <Text style={styles.countryPickerFlag}>{selectedCountry.flag}</Text>
                    <Text style={styles.countryPickerText}>
                      {selectedCountry.name} ({selectedCountry.dial})
                    </Text>
                    <Text style={styles.countryPickerArrow}>▼</Text>
                  </TouchableOpacity>
                  <Text style={[styles.label, compact && styles.labelCompact, tiny && styles.labelTiny]}>TELEFON NUMARASI</Text>
                  <View style={styles.phoneRow}>
                    <View style={[styles.dialBadge, compact && styles.dialBadgeCompact]}>
                      <Text style={styles.dialBadgeText}>{selectedCountry.dial}</Text>
                    </View>
                    <TextInput
                      style={[styles.input, compact && styles.inputCompact, { flex: 1 }]}
                      placeholder="5XX XXX XX XX"
                      placeholderTextColor={THEME.colors.textMuted}
                      keyboardType="phone-pad"
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                    />
                  </View>
                  {errorMsg && (
                    <View style={styles.errorBanner}>
                      <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
                    </View>
                  )}
                  <View style={[styles.stepNavButtonsRow, compact && styles.stepNavButtonsRowCompact]}>
                    <TouchableOpacity style={[styles.backStepBtn, compact && styles.backStepBtnCompact]} onPress={handlePrevRegStep}>
                      <Text style={styles.backStepBtnText}>← GERİ</Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Button3D
                        title="DEVAM ET (4/4) →"
                        variant="gold"
                        onPress={handleNextRegStep}
                      />
                    </View>
                  </View>
                </View>
              )}
              {/* STEP 4: Avatar, Bio & Final Submit */}
              {regStep === 4 && (
                <View>
                  <Text style={[styles.label, compact && styles.labelCompact, tiny && styles.labelTiny]}>PROFİL FOTOĞRAFI VEYA AVATAR SEÇİN</Text>
                  <View style={[styles.photoPickerSection, compact && styles.photoPickerSectionCompact]}>
                    <TouchableOpacity
                      style={[styles.uploadPhotoBtn, compact && styles.uploadPhotoBtnCompact]}
                      onPress={handlePickImage}
                      activeOpacity={0.85}
                    >
                      {customPhotoUri ? (
                        <Image source={{ uri: customPhotoUri }} style={styles.uploadedPhotoImg} />
                      ) : (
                        <CharacterAvatar seed={selectedAvatar} size={52} />
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.uploadPhotoTitle}>
                          {customPhotoUri ? 'Özel Fotoğraf Seçildi ✓' : 'Galeriden Fotoğraf Yükle'}
                        </Text>
                        <Text style={styles.uploadPhotoSub}>
                          Cihazınızdan fotoğraf seçin veya aşağıdan karakter belirleyin
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <View style={[styles.avatarGrid, compact && styles.avatarGridCompact]}>
                      {AVATAR_OPTIONS.map((av) => {
                        const isSelected = !customPhotoUri && selectedAvatar === av;
                        return (
                          <TouchableOpacity
                            key={av}
                            style={[styles.avatarOption, compact && styles.avatarOptionCompact, isSelected && styles.avatarOptionActive]}
                            onPress={() => {
                              sound.playSound('tap');
                              setCustomPhotoUri(null);
                              setSelectedAvatar(av);
                            }}
                          >
                            <CharacterAvatar seed={av} size={compact ? 32 : 42} />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                  <Text style={[styles.label, compact && styles.labelCompact, tiny && styles.labelTiny]}>KISA BİYOGRAFİ / SLOGAN</Text>
                  <TextInput
                    style={[styles.input, compact && styles.inputCompact, tiny && styles.inputTiny]}
                    placeholder="Örn: Tarih ve Bilim kategorisinde rakip tanımam!"
                    placeholderTextColor={THEME.colors.textMuted}
                    value={bio}
                    onChangeText={setBio}
                  />
                  <View style={[styles.rewardSummaryBox, compact && styles.rewardSummaryBoxCompact]}>
                    <CoinIcon size={20} />
                    <Text style={styles.rewardSummaryText}>
                      Kayıt Başlangıç Paketi: +{stepBonusCoins} Altın & +{stepBonusGems} Elmas hesabınıza tanımlanır!
                    </Text>
                  </View>
                  <LegalConsentCheckbox
                    checked={legalAccepted}
                    onToggle={() => {
                      sound.playSound('tap');
                      setLegalAccepted((v) => !v);
                      setLegalError(false);
                    }}
                    onOpen={setOpenLegalDoc}
                    highlightError={legalError}
                  />
                  {errorMsg && (
                    <View style={styles.errorBanner}>
                      <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
                    </View>
                  )}
                  {loading ? (
                    <LoadingShimmer wide label="Hesap oluşturuluyor" />
                  ) : (
                    <View style={[styles.stepNavButtonsRow, compact && styles.stepNavButtonsRowCompact]}>
                      <TouchableOpacity style={[styles.backStepBtn, compact && styles.backStepBtnCompact]} onPress={handlePrevRegStep}>
                        <Text style={styles.backStepBtnText}>← GERİ</Text>
                      </TouchableOpacity>
                      <View style={{ flex: 1 }}>
                        <Button3D
                          title="KAYDI TAMAMLA ✓"
                          variant="mint"
                          onPress={handleSubmit}
                        />
                      </View>
                    </View>
                  )}
                </View>
              )}
            </Reanimated.View>
          )}
          {/* ==================== FORGOT / RESET PASSWORD VIEW ==================== */}
          {mode === 'forgot' && (
            <Reanimated.View key={'forgot-' + resetStep} entering={FadeInDown.delay(80).duration(420).springify().damping(16)}>
              <View style={styles.forgotHeaderBox}>
                <Text style={styles.forgotTitle}>ŞİFREMİ UNUTTUM</Text>
                <Text style={styles.forgotSub}>
                  {resetStep === 'request'
                    ? 'Hesabınıza kayıtlı e-posta adresini girin. Şifrenizi yenilemek için 6 haneli bir kod isteyebilirsiniz.'
                    : 'E-postadaki 6 haneli doğrulama kodunu ve yeni şifrenizi girin.'}
                </Text>
              </View>
              <Text style={[styles.label, compact && styles.labelCompact, tiny && styles.labelTiny]}>KAYITLI E-POSTA ADRESİNİZ</Text>
              <TextInput
                testID="reset-email"
                accessibilityLabel="Kayıtlı e-posta adresiniz"
                style={[styles.input, compact && styles.inputCompact, tiny && styles.inputTiny]}
                placeholder="ornek@gmail.com"
                placeholderTextColor={THEME.colors.textMuted}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                editable={resetStep === 'request' && !loading}
              />
              {resetStep === 'verify' && (
                <>
                  {resetSuccessMsg && (
                    <Text testID="reset-inbox-status" accessibilityLiveRegion="polite" style={styles.resetInboxStatus}>
                      {resetSuccessMsg}
                    </Text>
                  )}
                  <Text style={[styles.label, compact && styles.labelCompact, tiny && styles.labelTiny]}>6 HANELİ DOĞRULAMA KODU</Text>
                  <TextInput
                    testID="reset-otp"
                    accessibilityLabel="6 haneli doğrulama kodu"
                    style={[styles.input, styles.codeInput]}
                    placeholder="000000"
                    placeholderTextColor={THEME.colors.textMuted}
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={resetCode}
                    onChangeText={(value) => setResetCode(value.replace(/[^0-9]/g, '').slice(0, 6))}
                  />
                  <Text style={[styles.label, compact && styles.labelCompact, tiny && styles.labelTiny]}>YENİ ŞİFRE (EN AZ 8 KARAKTER)</Text>
                  <View style={styles.passwordInputWrap}>
                    <TextInput
                      testID="reset-new-password"
                      accessibilityLabel="Yeni şifre"
                      autoComplete="new-password"
                      style={[styles.passwordInput, compact && styles.inputCompact, tiny && styles.inputTiny]}
                      placeholder="••••••••"
                      placeholderTextColor={THEME.colors.textMuted}
                      secureTextEntry={!showResetPassword}
                      value={newResetPassword}
                      onChangeText={setNewResetPassword}
                    />
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      accessibilityRole="button"
                      accessibilityLabel={showResetPassword ? 'Yeni şifreyi gizle' : 'Yeni şifreyi göster'}
                      onPress={() => setShowResetPassword(!showResetPassword)}
                    >
                      {showResetPassword ? <EyeOpenIcon size={20} /> : <EyeOffIcon size={20} />}
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.label, compact && styles.labelCompact, tiny && styles.labelTiny]}>YENİ ŞİFRE TEKRAR</Text>
                  <View style={styles.passwordInputWrap}>
                    <TextInput
                      testID="reset-confirm-password"
                      accessibilityLabel="Yeni şifre tekrar"
                      autoComplete="new-password"
                      style={[styles.passwordInput, compact && styles.inputCompact, tiny && styles.inputTiny]}
                      placeholder="••••••••"
                      placeholderTextColor={THEME.colors.textMuted}
                      secureTextEntry={!showResetPassword}
                      value={confirmResetPassword}
                      onChangeText={setConfirmResetPassword}
                    />
                  </View>
                </>
              )}
              {errorMsg && (
                <Reanimated.View entering={ZoomIn.duration(220)} style={styles.errorBanner}>
                  <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
                </Reanimated.View>
              )}
              {loading ? (
                <LoadingShimmer wide label={resetStep === 'request' ? 'Sıfırlama kodu gönderiliyor' : 'Şifre yenileniyor'}
                  style={{ marginTop: compact ? 10 : 14 }} />
              ) : resetStep === 'request' ? (
                <Button3D
                  testID="reset-send"
                  title="SIFIRLAMA KODU GÖNDER"
                  variant="gold"
                  onPress={handleRequestResetCode}
                  style={[{ marginTop: compact ? 10 : 14 }, compact && styles.btnCompact, tiny && styles.btnTiny]}
                />
              ) : (
                <Button3D
                  testID="reset-submit"
                  title="ŞİFREMİ YENİLE"
                  variant="mint"
                  onPress={handleConfirmResetPassword}
                  style={[{ marginTop: compact ? 10 : 14 }, compact && styles.btnCompact, tiny && styles.btnTiny]}
                />
              )}
              {resetStep === 'verify' && (
                <View style={styles.resetActions}>
                  <TouchableOpacity
                    testID="reset-resend"
                    accessibilityRole="button"
                    style={styles.resetSecondaryAction}
                    onPress={handleRequestResetCode}
                    disabled={loading || resetResendSeconds > 0}
                  >
                    <Text style={[styles.backToLoginText, resetResendSeconds > 0 && styles.resetActionMuted]}>
                      {resetResendSeconds > 0 ? `Tekrar gönder (${resetResendSeconds} sn)` : 'Kodu tekrar gönder'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID="reset-change-email"
                    accessibilityRole="button"
                    style={styles.resetSecondaryAction}
                    onPress={clearResetForm}
                    disabled={loading}
                  >
                    <Text style={styles.backToLoginText}>E-postayı değiştir</Text>
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity
                style={styles.backToLoginBtn}
                accessibilityRole="button"
                testID="reset-back"
                disabled={loading}
                onPress={() => {
                  sound.playSound('tap');
                  clearResetForm();
                  setMode('login');
                }}
              >
                <Text style={styles.backToLoginText}>← Giriş Ekranına Dön</Text>
              </TouchableOpacity>
            </Reanimated.View>
          )}
          {/* Google Sign-In & Divider (Only shown on Login tab, not on Register) */}
          {mode === 'login' && (
            <>
              {/* Divider */}
              <View style={[styles.dividerRow, compact && styles.dividerRowCompact, tiny && styles.dividerRowTiny]}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>VEYA</Text>
                <View style={styles.dividerLine} />
              </View>
              {/* Google Sign-In Button -> Directly Opens Official Google Accounts Chooser */}
              <TouchableOpacity
                style={[styles.googleBtn, compact && styles.googleBtnCompact, tiny && styles.googleBtnTiny]}
                onPress={handleRealGoogleSignIn}
                disabled={loading}
                activeOpacity={0.85}
              >
                <View style={styles.googleIconWrap}>
                  <GoogleGLogo size={18} />
                </View>
                <Text style={styles.googleBtnText}>
                  {loading ? 'Google Bağlanıyor...' : 'Google ile Giriş Yap'}
                </Text>
              </TouchableOpacity>
              <LegalLinksText
                prefix="Google ile devam ederek "
                suffix=" okuduğunu ve kabul ettiğini onaylamış olursun."
                onOpen={setOpenLegalDoc}
                style={{ marginTop: compact ? 8 : 12, textAlign: 'center', fontSize: 12, lineHeight: 18 }}
              />
            </>
          )}
        </Reanimated.View>
        {!wideLayout && guestEntry}
      </ScrollView>
      <LegalDocumentModal documentId={openLegalDoc} onClose={() => setOpenLegalDoc(null)} />
      {/* Country Picker Modal */}
      <Modal
        visible={countryPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCountryPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>ÜLKE SEÇİN</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {COUNTRIES.map((c) => (
                <TouchableOpacity
                  key={c.code}
                  style={[
                    styles.countryOptionRow,
                    selectedCountry.code === c.code && styles.countryOptionActive,
                  ]}
                  onPress={() => {
                    sound.playSound('tap');
                    setSelectedCountry(c);
                    setCountryPickerOpen(false);
                  }}
                >
                  <Text style={styles.countryOptionFlag}>{c.flag}</Text>
                  <Text style={styles.countryOptionName}>{c.name}</Text>
                  <Text style={styles.countryOptionDial}>{c.dial}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Button3D
              title="KAPAT"
              variant="glass"
              onPress={() => setCountryPickerOpen(false)}
              style={[{ marginTop: compact ? 8 : 12 }, compact && styles.btnCompact, tiny && styles.btnTiny]}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};
const styles = StyleSheet.create({
  authRoot: {
    flex: 1,
    backgroundColor: '#12052C',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    alignItems: 'center',
  },
  scrollView: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  authRootWide: { maxWidth: '100%' },
  scrollContentWide: {
    maxWidth: 1032,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  authIntro: { flex: 1, minWidth: 0, maxWidth: 464 },
  scrollContentFullscreen: { maxWidth: 1376, columnGap: 32 },
  authIntroFullscreen: { maxWidth: 660 },
  heroWrapWide: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  arenaPreview: {
    minHeight: 180,
    justifyContent: 'flex-end',
    backgroundColor: '#130932',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.5)',
    overflow: 'hidden',
  },
  arenaImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  arenaCaption: { backgroundColor: 'rgba(14, 5, 34, 0.92)', padding: 12 },
  arenaTitle: { color: '#FFFFFF', fontFamily: THEME.fonts.display, fontSize: 23 },
  arenaSubtitle: { color: '#E2D7F5', fontFamily: THEME.fonts.bold, fontSize: 13, marginTop: 2 },
  cardWide: { flex: 1, minWidth: 0, width: 'auto', padding: 20 },
  cardFullscreen: { maxWidth: 620 },
  // ---- Mobil kompakt yerleşim: küçük ekranlarda kaydırmasız sığdırma ----
  // Logo ekranın en tepesine yapışmasın: üstte nefes payı bırak (status bar).
  scrollContentCompact: {
    paddingTop: 30,
    paddingBottom: 10,
    justifyContent: 'flex-start',
  },
  // ---- Çok küçük ekranlar (≤740dp): ekstra sıkı katman ----
  scrollContentTiny: { paddingTop: 18, paddingBottom: 6 },
  heroWrapTiny: { marginBottom: 4 },
  heroCrownWrapTiny: { width: 58, height: 48 },
  heroLogoTiny: { width: 54, height: 42 },
  cleanBrandTitleTiny: { fontSize: 22, marginVertical: 0 },
  brandSubtitleTiny: { fontSize: 9, letterSpacing: 1.5 },
  cardTiny: { padding: 8, borderRadius: 18 },
  tabRowTiny: { marginBottom: 6, padding: 3 },
  tabBtnTiny: { paddingVertical: 6 },
  inputTiny: { paddingVertical: 6, fontSize: 13 },
  labelTiny: { marginTop: 4, marginBottom: 2, fontSize: 9 },
  btnTiny: { minHeight: 38 },
  dividerRowTiny: { marginVertical: 6 },
  googleBtnTiny: { paddingVertical: 8 },
  stepWizardBoxTiny: { padding: 6, marginBottom: 4 },
  heroWrapCompact: { marginBottom: 6 },
  heroCrownWrapCompact: { width: 72, height: 60 },
  heroCrownGlowCompact: { width: 58, height: 58, borderRadius: 29 },
  heroLogoCompact: { width: 68, height: 52 },
  cleanBrandTitleCompact: { fontSize: 26 },
  brandSubtitleCompact: { fontSize: 10, letterSpacing: 2 },
  cardCompact: { padding: 10, borderRadius: 20 },
  tabRowCompact: { marginBottom: 8 },
  tabBtnCompact: { paddingVertical: 7 },
  labelCompact: { marginTop: 5, marginBottom: 3, fontSize: 10 },
  inputCompact: { paddingVertical: 8, fontSize: 13.5 },
  btnCompact: { minHeight: 42 },
  dividerRowCompact: { marginVertical: 8 },
  googleBtnCompact: { paddingVertical: 10 },
  stepWizardBoxCompact: { padding: 8, marginBottom: 6 },
  stepWizardHeaderCompact: { marginBottom: 5 },
  genderChipCompact: { paddingVertical: 7 },
  countryPickerBtnCompact: { paddingVertical: 9 },
  dialBadgeCompact: { paddingVertical: 9, paddingHorizontal: 10 },
  uploadPhotoBtnCompact: { padding: 7, gap: 8, borderRadius: 14 },
  avatarOptionCompact: { padding: 1, borderRadius: 18 },
  avatarGridCompact: { gap: 3 },
  rewardSummaryBoxCompact: { marginTop: 7, padding: 7, gap: 6 },
  stepNavButtonsRowCompact: { marginTop: 8, gap: 8 },
  backStepBtnCompact: { height: 42, paddingHorizontal: 12 },
  photoPickerSectionCompact: { gap: 6 },
  heroWrap: {
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  heroCrownWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 112,
    height: 94,
    marginBottom: 2,
  },
  heroCrownGlow: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(122, 59, 255, 0.28)',
  },
  heroLogo: {
    width: 106,
    height: 81,
  },
  brandSubtitle: {
    color: '#D9CDF5',
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    letterSpacing: 3,
    textAlign: 'center',
    opacity: 0.85,
  },
  cleanBrandTitle: {
    fontFamily: THEME.fonts.display,
    fontSize: 38,
    color: '#FFFFFF',
    letterSpacing: 1.2,
    textShadowColor: 'rgba(168, 85, 247, 0.85)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 18,
    textAlign: 'center',
    marginVertical: 2,
  },
  card: {
    backgroundColor: 'rgba(28, 12, 62, 0.86)',
    borderRadius: 28,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(8, 3, 20, 0.55)',
    borderRadius: 16,
    padding: 4,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    borderRadius: 12,
  },
  tabBtnActive: {
    backgroundColor: '#7636DF',
    borderWidth: 1,
    borderColor: 'rgba(255, 196, 61, 0.55)',
    shadowColor: '#7636DF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 6,
  },
  tabText: {
    fontSize: 14,
    fontFamily: THEME.fonts.extraBold,
    color: THEME.colors.textMuted,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  stepWizardBox: {
    backgroundColor: 'rgba(14, 5, 34, 0.65)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 196, 61, 0.32)',
  },
  stepWizardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  stepBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepTitleText: {
    fontSize: 11,
    fontFamily: THEME.fonts.display,
    color: '#FFC43D',
  },
  stepBonusPill: {
    fontSize: 10,
    fontFamily: THEME.fonts.extraBold,
    color: '#5ADBB5',
    backgroundColor: 'rgba(90, 219, 181, 0.14)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  stepDotsContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  stepSegment: {
    flex: 1,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  stepSegmentActive: {
    backgroundColor: '#5ADBB5',
  },
  stepSegmentCurrent: {
    backgroundColor: '#FFC43D',
  },
  stepNavButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  backStepBtn: {
    height: 50,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backStepBtnText: {
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
    color: '#FFFFFF',
  },
  rewardSummaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 196, 61, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 196, 61, 0.35)',
  },
  rewardSummaryText: {
    flex: 1,
    fontSize: 11,
    fontFamily: THEME.fonts.bold,
    color: '#FFE27A',
  },
  label: {
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    color: THEME.colors.textSecondary,
    marginBottom: 6,
    marginTop: 8,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: 'rgba(10, 4, 24, 0.62)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: THEME.fonts.bold,
    ...(Platform.OS === 'web'
      ? ({
          outlineStyle: 'none',
          outlineWidth: 0,
          outlineColor: 'transparent',
          outline: 'none',
          boxShadow: 'none',
        } as any)
      : {}),
  },
  passwordInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 4, 24, 0.62)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 14,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({
          outlineStyle: 'none',
          outlineWidth: 0,
          outlineColor: 'transparent',
          outline: 'none',
          boxShadow: 'none',
        } as any)
      : {}),
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: THEME.fonts.bold,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 14,
    ...(Platform.OS === 'web'
      ? ({
          outlineStyle: 'none',
          outlineWidth: 0,
          outlineColor: 'transparent',
          outline: 'none',
          boxShadow: 'none',
        } as any)
      : {}),
  },
  eyeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  forgotLinkWrap: {
    alignSelf: 'flex-end',
    marginTop: 8,
    marginBottom: 4,
  },
  forgotLinkText: {
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    color: '#FFC43D',
  },
  countryPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 4, 24, 0.62)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  countryPickerFlag: {
    fontSize: 18,
  },
  countryPickerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: THEME.fonts.bold,
    color: '#FFFFFF',
  },
  countryPickerArrow: {
    fontSize: 11,
    color: '#D9CDF5',
  },
  // Doğum tarihi takvim seçici butonu (ülke seçici görünümüyle uyumlu).
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 4, 24, 0.62)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 8,
  },
  datePickerBtnCompact: {
    paddingVertical: 10,
  },
  datePickerIcon: {
    fontSize: 17,
  },
  datePickerText: {
    flex: 1,
    fontSize: 13,
    color: '#FFFFFF',
    fontFamily: THEME.fonts.medium,
  },
  datePickerPlaceholder: {
    color: THEME.colors.textMuted,
  },
  // Alan altı kısa açıklama (daha hızlı, daha spesifik kayıt akışı için).
  fieldHintText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginBottom: 4,
    lineHeight: 15,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dialBadge: {
    backgroundColor: 'rgba(118, 54, 223, 0.4)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dialBadgeText: {
    color: '#FFC43D',
    fontFamily: THEME.fonts.extraBold,
    fontSize: 13,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 8,
  },
  genderChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(10, 4, 24, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
  },
  genderChipActive: {
    backgroundColor: 'rgba(90, 219, 181, 0.2)',
    borderColor: '#5ADBB5',
  },
  genderChipText: {
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
    color: '#D9CDF5',
  },
  genderChipTextActive: {
    color: '#5ADBB5',
    fontWeight: '800',
  },
  photoPickerSection: {
    marginTop: 4,
    marginBottom: 6,
    gap: 10,
  },
  uploadPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  uploadedPhotoImg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#FFC43D',
  },
  uploadPhotoTitle: {
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
    color: '#FFFFFF',
  },
  uploadPhotoSub: {
    fontSize: 11,
    fontFamily: THEME.fonts.medium,
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  avatarGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  avatarOption: {
    padding: 3,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarOptionActive: {
    borderColor: '#FFC43D',
    backgroundColor: 'rgba(255, 196, 61, 0.18)',
  },
  forgotHeaderBox: {
    backgroundColor: 'rgba(10, 4, 24, 0.5)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  forgotTitle: {
    fontSize: 15,
    fontFamily: THEME.fonts.display,
    color: '#FFC43D',
    marginBottom: 4,
  },
  forgotSub: {
    fontSize: 12,
    fontFamily: THEME.fonts.medium,
    color: '#D9CDF5',
    lineHeight: 17,
  },
  resetInboxStatus: {
    backgroundColor: 'rgba(90, 219, 181, 0.15)',
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
    color: '#C4F5E7',
    fontSize: 12,
    lineHeight: 17,
    fontFamily: THEME.fonts.medium,
  },
  codeInput: {
    textAlign: 'center',
    fontSize: 20,
    letterSpacing: 6,
    fontFamily: THEME.fonts.display,
  },
  backToLoginBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 6,
  },
  resetActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  resetSecondaryAction: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  resetActionMuted: {
    color: '#ACA1BE',
  },
  backToLoginText: {
    fontSize: 12,
    fontFamily: THEME.fonts.extraBold,
    color: '#D9CDF5',
  },
  redirectNoticeBanner: {
    backgroundColor: 'rgba(255, 92, 119, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 92, 119, 0.45)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 0,
    marginBottom: 18,
  },
  errorBanner: {
    backgroundColor: 'rgba(255, 92, 119, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 92, 119, 0.45)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 14,
    marginBottom: 20,
  },
  errorText: {
    color: '#FF8598',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
    textAlign: 'center',
  },
  successBanner: {
    backgroundColor: 'rgba(90, 219, 181, 0.16)',
    borderWidth: 1,
    borderColor: '#5ADBB5',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  successText: {
    color: '#5ADBB5',
    fontSize: 12,
    fontFamily: THEME.fonts.bold,
    textAlign: 'center',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  dividerText: {
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    color: THEME.colors.textMuted,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 13,
    borderBottomWidth: 3,
    borderBottomColor: '#CBD5E1',
  },
  googleIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleBtnText: {
    fontSize: 15,
    fontFamily: THEME.fonts.extraBold,
    color: '#1E293B',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 2, 16, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalSheet: {
    backgroundColor: '#220E4E',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: THEME.fonts.display,
    color: '#FFFFFF',
  },
  countryOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 10,
  },
  countryOptionActive: {
    backgroundColor: 'rgba(118, 54, 223, 0.4)',
  },
  countryOptionFlag: {
    fontSize: 20,
  },
  countryOptionName: {
    flex: 1,
    fontSize: 14,
    fontFamily: THEME.fonts.bold,
    color: '#FFFFFF',
  },
  countryOptionDial: {
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
    color: '#FFC43D',
  },
  googleSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  googleClientIdBadge: {
    fontSize: 11,
    fontFamily: THEME.fonts.medium,
    color: '#D9CDF5',
    marginTop: 2,
  },
  gmailAccountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  gmailAccountName: {
    fontSize: 14,
    fontFamily: THEME.fonts.extraBold,
    color: '#FFFFFF',
  },
  gmailAccountEmail: {
    fontSize: 12,
    fontFamily: THEME.fonts.medium,
    color: '#D9CDF5',
  },
  gmailContinueBadge: {
    backgroundColor: '#FFB21E',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  gmailContinueText: {
    fontSize: 11,
    fontFamily: THEME.fonts.display,
    color: '#3B1500',
  },
  useAnotherGmailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  useAnotherGmailIcon: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFC43D',
  },
  useAnotherGmailText: {
    fontSize: 13,
    fontFamily: THEME.fonts.extraBold,
    color: '#FFC43D',
  },
});
