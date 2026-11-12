import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Platform,
  Modal,
  Linking,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { compressAvatarImageAsync } from '../utils/avatarImage';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { createClient } from '@supabase/supabase-js';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
WebBrowser.maybeCompleteAuthSession();
const clientSupabase = createClient(
  'https://rjvbgofzsfescnfohzgu.supabase.co',
  'sb_publishable_ix4qzOkTfA-bFTKvsJ-tSA_rEs0YeEf',
  {
    auth: {
      flowType: 'implicit',
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);
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
import { FloatingImage } from '../components/StoreKit';
import { GuestDiscoveryCard } from '../components/DiscoveryArtwork';
import Reanimated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { sound } from '../services/soundService';

const AUTH_CROWN = require('../../assets/images/ui/auth_crown.png');
const GOOGLE_CLIENT_ID =
  '411578437442-gs1rck2124rgr516fe9dn9tuu15ge9ig.apps.googleusercontent.com';
interface AuthScreenProps {
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
  onSuccess,
  onGuestContinue,
  apiBaseUrl,
  redirectNotice,
}) => {
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
  const [fullName, setFullName] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<CountryOption>(COUNTRIES[0]);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [birthDate, setBirthDate] = useState('');
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
  const [demoResetCodeHint, setDemoResetCodeHint] = useState<string | null>(null);
  const [newResetPassword, setNewResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Google'dan dönüşte (adres çubuğunda token/code varsa) giriş formu yerine "oturum açılıyor" göster
  const [finishingOAuth, setFinishingOAuth] = useState(() =>
    Platform.OS === 'web' && typeof window !== 'undefined' &&
    (window.location.hash.includes('access_token') || window.location.search.includes('access_token') || window.location.search.includes('code=')));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!finishingOAuth) return;
    // Beklenmedik bir durumda ekranda takılı kalma: 20 sn sonra giriş formuna dön
    const t = setTimeout(() => setFinishingOAuth(false), 20000);
    return () => clearTimeout(t);
  }, [finishingOAuth]);
  // Animations
  const floatAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 3200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 3200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    ).start();
  }, [floatAnim, glowAnim]);
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
      if (!password || password.length < 6) {
        sound.playSound('wrong');
        setErrorMsg('Şifreniz en az 6 karakter olmalıdır.');
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
      if (!password || password.length < 6) {
        sound.playSound('wrong');
        setErrorMsg('Şifre en az 6 karakter olmalıdır.');
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
              fullName: fullName.trim() || undefined,
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
  const submitGoogleAuth = async (payload: {
    idToken?: string;
    accessToken?: string;
    email?: string;
    displayName?: string;
    fullName?: string;
    avatarUrl?: string;
  }) => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          clientId: GOOGLE_CLIENT_ID,
          country: `${selectedCountry.flag} ${selectedCountry.name}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Google ile oturum açma başarısız oldu.');
      }
      sound.playSound('victory');
      sound.triggerHaptic('success');
      onSuccess(data.user, data.token);
    } catch (err: any) {
      sound.playSound('wrong');
      setErrorMsg(err.message || 'Google ile giriş yapılamadı.');
    } finally {
      setLoading(false);
    }
  };
  const lastProcessedAuthUrl = useRef<string | null>(null);
  const googlePollInterval = useRef<any>(null);
  const sendClientLog = (level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR', message: string, details?: any) => {
    fetch(`${apiBaseUrl}/logs/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, category: 'CLIENT', message, details }),
    }).catch(() => {});
  };
  useEffect(() => {
    return () => {
      if (googlePollInterval.current) {
        clearInterval(googlePollInterval.current);
        googlePollInterval.current = null;
      }
    };
  }, []);
  const handleAuthRedirectUrl = async (urlStr: string) => {
    if (!urlStr) return;
    if (lastProcessedAuthUrl.current === urlStr) return;
    lastProcessedAuthUrl.current = urlStr;
    sendClientLog('INFO', 'Deep link URL yakalandı', { url: urlStr });
    try {
      setLoading(true);
      let rawParams = '';
      if (urlStr.includes('#')) {
        rawParams = urlStr.split('#')[1];
      } else if (urlStr.includes('?')) {
        rawParams = urlStr.split('?')[1];
      }
      const params = new URLSearchParams(rawParams);
      let accessToken = params.get('access_token');
      const code = params.get('code');
      if (!accessToken && code) {
        sendClientLog('INFO', 'OAuth code yakalandı, Supabase ile oturuma dönüştürülüyor...', { code });
        try {
          const { data: exchangeData, error: exchangeError } = await clientSupabase.auth.exchangeCodeForSession(code);
          if (exchangeData?.session?.access_token) {
            accessToken = exchangeData.session.access_token;
            sendClientLog('SUCCESS', 'Code başarıyla token\'a dönüştürüldü');
          } else if (exchangeError) {
            sendClientLog('WARN', 'exchangeCodeForSession uyarısı: ' + exchangeError.message);
          }
        } catch (exErr: any) {
          sendClientLog('WARN', 'exchangeCodeForSession hatası: ' + exErr.message);
        }
      }
      if (accessToken) {
        sendClientLog('INFO', 'Access token alındı, Supabase kullanıcısı sorgulanıyor...');
        // Fetch authentic Google user details from Supabase using the access token
        let userEmail = '';
        let userName = 'Oyuncu';
        let userAvatar = 'av1';
        let userFullName = 'Oyuncu';

        try {
          const { data: userData } = await clientSupabase.auth.getUser(accessToken);
          if (userData?.user) {
            const sbUser = userData.user;
            userEmail = sbUser.email || '';
            const meta = sbUser.user_metadata || {};
            userName = meta.full_name || meta.name || userEmail.split('@')[0] || 'Oyuncu';
            userFullName = meta.full_name || userName;
            userAvatar = meta.avatar_url || meta.picture || 'av1';
          }
        } catch (fetchErr: any) {
          sendClientLog('WARN', 'getUser istemcide atlandi, sunucuda cozumlenecek', { err: fetchErr.message });
        }

        sendClientLog('INFO', 'Kullanıcı bilgileri sunucuya gönderiliyor', { email: userEmail, userName });
        await submitGoogleAuth({
          accessToken,
          email: userEmail || undefined,
          displayName: userName,
          fullName: userFullName,
          avatarUrl: userAvatar,
        });
      } else {
        const errorDesc = params.get('error_description') || params.get('error');
        if (errorDesc) {
          sendClientLog('ERROR', 'OAuth callback hata döndü', { errorDesc });
          setErrorMsg(decodeURIComponent(errorDesc));
          setLoading(false);
        }
      }
    } catch (err: any) {
      sendClientLog('ERROR', 'handleAuthRedirectUrl hatası', { error: err.message });
      sound.playSound('wrong');
      setErrorMsg(err.message || 'Google girişi tamamlanamadı.');
      setLoading(false);
    }
  };
  useEffect(() => {
    // 1. Web direct redirect return & message listener
    let removeWebMessageListener: (() => void) | undefined;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const currentUrl = window.location.href;
      if (currentUrl.includes('access_token') || currentUrl.includes('code=')) {
        sendClientLog('INFO', 'Web baslangic URL oturum parametresi algilandi', { currentUrl });
        handleAuthRedirectUrl(currentUrl);
        try {
          window.history.replaceState(null, '', window.location.pathname);
        } catch {}
      }

      const onWindowMessage = (event: MessageEvent) => {
        if (event.data?.type === 'TAVRIKO_GOOGLE_AUTH') {
          sendClientLog('INFO', 'window.postMessage uzerinden Google yetkisi alindi', event.data);
          if (event.data.user && event.data.token) {
            sound.playSound('victory');
            sound.triggerHaptic('success');
            setLoading(false);
            onSuccess(event.data.user, event.data.token);
          } else if (event.data.payload) {
            handleAuthRedirectUrl(event.data.payload);
          }
        }
      };
      window.addEventListener('message', onWindowMessage);
      removeWebMessageListener = () => window.removeEventListener('message', onWindowMessage);
    }

    // 2. Mobile initial URL check (cold start)
    Linking.getInitialURL().then((initUrl) => {
      if (initUrl && (initUrl.includes('auth-callback') || initUrl.includes('access_token') || initUrl.includes('code='))) {
        handleAuthRedirectUrl(initUrl);
      }
    }).catch(() => {});

    // 3. Mobile deep link event listener (warm resume)
    const sub = Linking.addEventListener('url', (event) => {
      if (event.url && (event.url.includes('auth-callback') || event.url.includes('access_token') || event.url.includes('code='))) {
        handleAuthRedirectUrl(event.url);
      }
    });
    return () => {
      sub.remove();
      if (removeWebMessageListener) {
        removeWebMessageListener();
      }
    };
  }, []);
  // Authentic Google Sign-In: Always displays Google Account Chooser
  const handleRealGoogleSignIn = async () => {
    sound.playSound('tap');
    sound.triggerHaptic('medium');
    setErrorMsg(null);
    setLoading(true);
    // Google butonunun altındaki yasal metin bildirimiyle devam edildiğini kaydet;
    // giriş tamamlanınca onay sunucuya 'google' yöntemiyle yazılır.
    markGoogleLegalAcknowledged();
    sendClientLog('INFO', 'Google ile Giriş Yap butonuna tıklandı');

    const redirectUri = `${apiBaseUrl}/auth/google/callback`;

    // On Web browsers: Direct full-page redirect! Zero popups, zero popup blockers, 100% reliable!
    if (Platform.OS === 'web' || (typeof window !== 'undefined' && typeof window.location !== 'undefined')) {
      const directOAuthUrl = `https://rjvbgofzsfescnfohzgu.supabase.co/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUri)}&prompt=select_account`;
      sendClientLog('INFO', 'Web doğrudan Google OAuth sayfasına yönlendiriliyor (Popup engeli bypass edildi)...', { redirectUri, directOAuthUrl });
      window.location.href = directOAuthUrl;
      return;
    }

    if (googlePollInterval.current) {
      clearInterval(googlePollInterval.current);
      googlePollInterval.current = null;
    }
    // Safety timeout: Never stay stuck on loading for more than 18 seconds
    const safetyTimer = setTimeout(() => {
      if (googlePollInterval.current) {
        clearInterval(googlePollInterval.current);
        googlePollInterval.current = null;
      }
      setLoading(false);
      sendClientLog('WARN', 'Google giriş süresi zaman aşımına uğradı, buton normale döndü.');
    }, 18000);
    try {
      // 1. Initialize server pending session with a short 3-second timeout
      let sessionId = '';
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const initRes = await fetch(`${apiBaseUrl}/auth/google/init-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (initRes.ok) {
          const initData = await initRes.json();
          sessionId = initData.sessionId;
          sendClientLog('INFO', 'Sunucu oturumu oluşturuldu', { sessionId });
        }
      } catch (initErr: any) {
        sendClientLog('WARN', 'Sunucu init-session çağrısı atlandı veya zaman aşımına uğradı', { err: initErr.message });
      }
      // 2. Clear any prior browser session state
      try {
        WebBrowser.dismissAuthSession();
      } catch {}
      lastProcessedAuthUrl.current = null;
      // 3. Start background polling if sessionId exists
      if (sessionId) {
        let attempts = 0;
        googlePollInterval.current = setInterval(async () => {
          attempts++;
          if (attempts > 30) { // 15 seconds max polling
            if (googlePollInterval.current) clearInterval(googlePollInterval.current);
            googlePollInterval.current = null;
            clearTimeout(safetyTimer);
            setLoading(false);
            return;
          }
          try {
            const statusRes = await fetch(`${apiBaseUrl}/auth/google/session-status?sessionId=${sessionId}`);
            if (statusRes.ok) {
              const statusData = await statusRes.json();
              if (statusData.status === 'ready' && statusData.user && statusData.token) {
                if (googlePollInterval.current) {
                  clearInterval(googlePollInterval.current);
                  googlePollInterval.current = null;
                }
                clearTimeout(safetyTimer);
                try {
                  WebBrowser.dismissAuthSession();
                } catch {}
                sendClientLog('SUCCESS', 'Oturum hazır! Ana sayfaya yönlendiriliyor', { user: statusData.user.email });
                sound.playSound('victory');
                sound.triggerHaptic('success');
                setLoading(false);
                onSuccess(statusData.user, statusData.token);
              } else if (statusData.status === 'error') {
                if (googlePollInterval.current) {
                  clearInterval(googlePollInterval.current);
                  googlePollInterval.current = null;
                }
                clearTimeout(safetyTimer);
                sendClientLog('ERROR', 'Sunucu oturum hatası bildirdi', { error: statusData.error });
                setErrorMsg(statusData.error || 'Google yetkilendirme hatası oluştu.');
                setLoading(false);
              }
            }
          } catch {}
        }, 500);
      }
      // 4. Request OAuth URL from Supabase with prompt: 'select_account' (Preserve Supabase OAuth state)
      const queryParams: Record<string, string> = {
        prompt: 'select_account',
      };
      if (sessionId) {
        queryParams.sessionId = sessionId;
      }

      sendClientLog('INFO', 'Supabase OAuth URL isteniyor...', { redirectUri });
      const { data, error } = await clientSupabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUri,
          queryParams,
          skipBrowserRedirect: true,
        },
      });
      if (error || !data?.url) {
        if (googlePollInterval.current) {
          clearInterval(googlePollInterval.current);
          googlePollInterval.current = null;
        }
        clearTimeout(safetyTimer);
        sendClientLog('ERROR', 'Supabase OAuth URL hatası', { error });
        throw new Error(error?.message || 'Google yetkilendirme linki oluşturulamadı.');
      }
      sendClientLog('INFO', 'WebBrowser açılıyor...', { oauthUrl: data.url });
      // 5. Open authentic Google account selector in system browser sheet (Mobile Native)
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
      sendClientLog('INFO', 'WebBrowser kapandı/döndü', { resultType: result.type });
      if (result.type === 'success' && result.url) {
        clearTimeout(safetyTimer);
        await handleAuthRedirectUrl(result.url);
      } else if (result.type === 'dismiss' || result.type === 'cancel') {
        // Wait 2.5s for poller to catch immediate success, otherwise release loading
        setTimeout(() => {
          if (!lastProcessedAuthUrl.current) {
            if (googlePollInterval.current) {
              clearInterval(googlePollInterval.current);
              googlePollInterval.current = null;
            }
            clearTimeout(safetyTimer);
            setLoading(false);
            sendClientLog('INFO', 'Tarayıcı kapatıldı, buton normale döndü.');
          }
        }, 2500);
      }
    } catch (err: any) {
      if (googlePollInterval.current) {
        clearInterval(googlePollInterval.current);
        googlePollInterval.current = null;
      }
      clearTimeout(safetyTimer);
      sendClientLog('ERROR', 'handleRealGoogleSignIn genel hatası', { message: err.message });
      // Graceful fallback for web if popup was blocked
      if (typeof window !== 'undefined' && err?.message && err.message.toLowerCase().includes('popup')) {
        const directOAuthUrl = `https://rjvbgofzsfescnfohzgu.supabase.co/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUri)}&prompt=select_account`;
        window.location.href = directOAuthUrl;
        return;
      }
      sound.playSound('wrong');
      setErrorMsg(err.message || 'Google ile giriş yapılamadı.');
      setLoading(false);
    }
  };
  const handleRequestResetCode = async () => {
    setErrorMsg(null);
    setResetSuccessMsg(null);
    if (!email.trim() || !email.includes('@')) {
      sound.playSound('wrong');
      setErrorMsg('Şifre sıfırlama kodu için kayıtlı e-posta adresinizi girin.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Sıfırlama kodu gönderilemedi.');
      }
      sound.playSound('reward');
      setDemoResetCodeHint(data.resetCodeDemo || null);
      if (data.resetCodeDemo) {
        setResetCode(data.resetCodeDemo);
      }
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
    setErrorMsg(null);
    if (!resetCode.trim() || resetCode.trim().length < 6) {
      sound.playSound('wrong');
      setErrorMsg('6 haneli doğrulama kodunu eksiksiz girin.');
      return;
    }
    if (!newResetPassword || newResetPassword.length < 6) {
      sound.playSound('wrong');
      setErrorMsg('Yeni şifreniz en az 6 karakter olmalıdır.');
      return;
    }
    if (newResetPassword !== confirmResetPassword) {
      sound.playSound('wrong');
      setErrorMsg('Yeni şifreler birbiriyle eşleşmiyor.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          code: resetCode.trim(),
          newPassword: newResetPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Şifre güncellenemedi.');
      }
      sound.playSound('victory');
      setPassword(newResetPassword);
      setMode('login');
      setResetStep('request');
      setResetSuccessMsg('Şifreniz başarıyla yenilendi! Şimdi giriş yapabilirsiniz.');
    } catch (err: any) {
      sound.playSound('wrong');
      setErrorMsg(err.message || 'Şifre sıfırlama hatası.');
    } finally {
      setLoading(false);
    }
  };
  const translateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -7],
  });
  const haloScale = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1.08],
  });
  // Step bonus calculation
  const stepBonusCoins = regStep * 200;
  const stepBonusGems = regStep * 5;
  const stepProgressPct = regStep * 25;
  if (finishingOAuth && !errorMsg) {
    return (
      <View style={[styles.authRoot, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#FFC43D" />
        <Text style={{ color: '#D9CDF5', fontSize: 14, marginTop: 16, fontFamily: THEME.fonts.bold }}>
          Google hesabınla oturum açılıyor...
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.authRoot}>
      {/* Luxury Multi-Layered Cosmic Background */}
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 400 850" preserveAspectRatio="none">
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
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Clean Modern Brand Header (3D Crown + Floating) */}
        <Animated.View
          style={[
            styles.heroWrap,
            { transform: [{ translateY }] },
          ]}
        >
          <Reanimated.View entering={FadeInDown.delay(60).duration(500).springify().damping(14)} style={styles.heroCrownWrap}>
            <View style={styles.heroCrownGlow} />
            <FloatingImage source={AUTH_CROWN} size={92} />
          </Reanimated.View>
          <Reanimated.View entering={FadeInUp.delay(140).duration(500)}>
            <Text style={styles.cleanBrandTitle}>Tavriko</Text>
            <Text style={styles.brandSubtitle}>CANLI BİLGİ & DÜELLO</Text>
          </Reanimated.View>
        </Animated.View>
        {/* Main Glass Auth Card */}
        <Reanimated.View entering={FadeInDown.delay(220).duration(500).springify().damping(16)} style={styles.card}>
          {redirectNotice ? (
            <View style={styles.redirectNoticeBanner}>
              <Text style={styles.errorText}>🔒 {redirectNotice}</Text>
            </View>
          ) : null}
          {/* Top Tabs: ONLY Giriş Yap & Kayıt Ol */}
          {mode !== 'forgot' && (
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tabBtn, mode === 'login' && styles.tabBtnActive]}
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
                style={[styles.tabBtn, mode === 'register' && styles.tabBtnActive]}
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
              <Text style={styles.label}>E-POSTA VEYA KULLANICI ADI</Text>
              <TextInput
                style={styles.input}
                placeholder="ornek@gmail.com veya kullaniciadi"
                placeholderTextColor={THEME.colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <Text style={styles.label}>ŞİFRE</Text>
              <View style={styles.passwordInputWrap}>
                <TextInput
                  style={styles.passwordInput}
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
              <TouchableOpacity
                style={styles.forgotLinkWrap}
                onPress={() => {
                  sound.playSound('tap');
                  setMode('forgot');
                  setErrorMsg(null);
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
                <ActivityIndicator
                  color={THEME.colors.gold}
                  size="large"
                  style={{ marginVertical: 14 }}
                />
              ) : (
                <Button3D
                  title="GİRİŞ YAP"
                  variant="gold"
                  onPress={handleSubmit}
                  style={{ marginTop: 12 }}
                />
              )}
            </Reanimated.View>
          )}
          {/* ==================== STEP-BY-STEP REGISTER WIZARD ==================== */}
          {mode === 'register' && (
            <Reanimated.View key={'register-form-' + regStep} entering={FadeInDown.delay(80).duration(420).springify().damping(16)}>
              {/* Step Progress Header */}
              <View style={styles.stepWizardBox}>
                <View style={styles.stepWizardHeader}>
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
                  <Text style={styles.label}>E-POSTA ADRESİ *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="ornek@gmail.com"
                    placeholderTextColor={THEME.colors.textMuted}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                  />
                  <Text style={styles.label}>KULLANICI ADI *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Örn: DenizPro"
                    placeholderTextColor={THEME.colors.textMuted}
                    autoCapitalize="none"
                    value={displayName}
                    onChangeText={setDisplayName}
                  />
                  <Text style={styles.label}>ŞİFRE (EN AZ 6 KARAKTER) *</Text>
                  <View style={styles.passwordInputWrap}>
                    <TextInput
                      style={styles.passwordInput}
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
                  <Text style={styles.label}>ŞİFRE TEKRAR *</Text>
                  <View style={styles.passwordInputWrap}>
                    <TextInput
                      style={styles.passwordInput}
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
                    style={{ marginTop: 14 }}
                  />
                </View>
              )}
              {/* STEP 2: Personal Details */}
              {regStep === 2 && (
                <View>
                  <Text style={styles.label}>AD SOYAD</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Örn: Ömer Faruk Şener"
                    placeholderTextColor={THEME.colors.textMuted}
                    value={fullName}
                    onChangeText={setFullName}
                  />
                  <Text style={styles.label}>DOĞUM TARİHİ</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="GG.AA.YYYY (Örn: 15.06.2000)"
                    placeholderTextColor={THEME.colors.textMuted}
                    value={birthDate}
                    onChangeText={setBirthDate}
                  />
                  <Text style={styles.label}>CİNSİYET SEÇİMİ</Text>
                  <View style={styles.genderRow}>
                    {(['Erkek', 'Kadın', 'Belirtmek İstemiyorum'] as const).map((g) => {
                      const active = gender === g;
                      return (
                        <TouchableOpacity
                          key={g}
                          style={[styles.genderChip, active && styles.genderChipActive]}
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
                  <View style={styles.stepNavButtonsRow}>
                    <TouchableOpacity style={styles.backStepBtn} onPress={handlePrevRegStep}>
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
                  <Text style={styles.label}>ÜLKE SEÇİCİ</Text>
                  <TouchableOpacity
                    style={styles.countryPickerBtn}
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
                  <Text style={styles.label}>TELEFON NUMARASI</Text>
                  <View style={styles.phoneRow}>
                    <View style={styles.dialBadge}>
                      <Text style={styles.dialBadgeText}>{selectedCountry.dial}</Text>
                    </View>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
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
                  <View style={styles.stepNavButtonsRow}>
                    <TouchableOpacity style={styles.backStepBtn} onPress={handlePrevRegStep}>
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
                  <Text style={styles.label}>PROFİL FOTOĞRAFI VEYA AVATAR SEÇİN</Text>
                  <View style={styles.photoPickerSection}>
                    <TouchableOpacity
                      style={styles.uploadPhotoBtn}
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
                    <View style={styles.avatarGrid}>
                      {AVATAR_OPTIONS.map((av) => {
                        const isSelected = !customPhotoUri && selectedAvatar === av;
                        return (
                          <TouchableOpacity
                            key={av}
                            style={[styles.avatarOption, isSelected && styles.avatarOptionActive]}
                            onPress={() => {
                              sound.playSound('tap');
                              setCustomPhotoUri(null);
                              setSelectedAvatar(av);
                            }}
                          >
                            <CharacterAvatar seed={av} size={42} />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                  <Text style={styles.label}>KISA BİYOGRAFİ / SLOGAN</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Örn: Tarih ve Bilim kategorisinde rakip tanımam!"
                    placeholderTextColor={THEME.colors.textMuted}
                    value={bio}
                    onChangeText={setBio}
                  />
                  <View style={styles.rewardSummaryBox}>
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
                    <ActivityIndicator
                      color={THEME.colors.gold}
                      size="large"
                      style={{ marginVertical: 14 }}
                    />
                  ) : (
                    <View style={styles.stepNavButtonsRow}>
                      <TouchableOpacity style={styles.backStepBtn} onPress={handlePrevRegStep}>
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
                    ? 'Hesabınıza kayıtlı e-posta adresini girin, 6 haneli şifre yenileme kodunuzu hemen oluşturalım.'
                    : 'Gönderilen 6 haneli doğrulama kodunu ve yeni şifrenizi girin.'}
                </Text>
              </View>
              <Text style={styles.label}>KAYITLI E-POSTA ADRESİNİZ</Text>
              <TextInput
                style={styles.input}
                placeholder="ornek@gmail.com"
                placeholderTextColor={THEME.colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              {resetStep === 'verify' && (
                <>
                  {demoResetCodeHint && (
                    <View style={styles.codeHintBox}>
                      <Text style={styles.codeHintLabel}>DOĞRULAMA KODUNUZ:</Text>
                      <Text style={styles.codeHintValue}>{demoResetCodeHint}</Text>
                    </View>
                  )}
                  <Text style={styles.label}>6 HANELİ DOĞRULAMA KODU</Text>
                  <TextInput
                    style={[styles.input, styles.codeInput]}
                    placeholder="123456"
                    placeholderTextColor={THEME.colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={6}
                    value={resetCode}
                    onChangeText={setResetCode}
                  />
                  <Text style={styles.label}>YENİ ŞİFRE (EN AZ 6 KARAKTER)</Text>
                  <View style={styles.passwordInputWrap}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="••••••••"
                      placeholderTextColor={THEME.colors.textMuted}
                      secureTextEntry={!showResetPassword}
                      value={newResetPassword}
                      onChangeText={setNewResetPassword}
                    />
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => setShowResetPassword(!showResetPassword)}
                    >
                      {showResetPassword ? <EyeOpenIcon size={20} /> : <EyeOffIcon size={20} />}
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.label}>YENİ ŞİFRE TEKRAR</Text>
                  <View style={styles.passwordInputWrap}>
                    <TextInput
                      style={styles.passwordInput}
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
                <ActivityIndicator
                  color={THEME.colors.gold}
                  size="large"
                  style={{ marginVertical: 14 }}
                />
              ) : resetStep === 'request' ? (
                <Button3D
                  title="SIFIRLAMA KODU GÖNDER"
                  variant="gold"
                  onPress={handleRequestResetCode}
                  style={{ marginTop: 14 }}
                />
              ) : (
                <Button3D
                  title="ŞİFREMİ YENİLE"
                  variant="mint"
                  onPress={handleConfirmResetPassword}
                  style={{ marginTop: 14 }}
                />
              )}
              <TouchableOpacity
                style={styles.backToLoginBtn}
                onPress={() => {
                  sound.playSound('tap');
                  setMode('login');
                  setResetStep('request');
                  setErrorMsg(null);
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
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>VEYA</Text>
                <View style={styles.dividerLine} />
              </View>
              {/* Google Sign-In Button -> Directly Opens Official Google Accounts Chooser */}
              <TouchableOpacity
                style={styles.googleBtn}
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
                style={{ marginTop: 12, textAlign: 'center', fontSize: 12, lineHeight: 18 }}
              />
            </>
          )}
        </Reanimated.View>
        {/* Guest Mode Entry */}
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
              style={{ marginTop: 12 }}
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
    paddingVertical: 20,
    paddingHorizontal: 18,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
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
    width: 110,
    height: 110,
    marginBottom: 4,
  },
  heroCrownGlow: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255, 196, 61, 0.22)',
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
    fontSize: 44,
    color: '#FFFFFF',
    letterSpacing: 1.5,
    textShadowColor: 'rgba(168, 85, 247, 0.85)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 18,
    textAlign: 'center',
    marginVertical: 4,
  },
  card: {
    backgroundColor: 'rgba(28, 12, 62, 0.86)',
    borderRadius: 28,
    padding: 20,
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
  codeHintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(90, 219, 181, 0.15)',
    borderWidth: 1,
    borderColor: '#5ADBB5',
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
  },
  codeHintLabel: {
    fontSize: 11,
    fontFamily: THEME.fonts.extraBold,
    color: '#5ADBB5',
  },
  codeHintValue: {
    fontSize: 18,
    fontFamily: THEME.fonts.display,
    color: '#FFFFFF',
    letterSpacing: 3,
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
