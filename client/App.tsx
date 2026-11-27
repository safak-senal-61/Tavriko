import React, { useEffect, useState } from 'react';
import * as Sentry from '@sentry/react-native';
import { useFonts } from 'expo-font';
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';
import { AppState, View, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LoadingShimmer } from './src/components/LoadingShimmer';
import { RootNavigator } from './src/navigation/RootNavigator';
import { hydrateAuthStorage, getStoredAuth } from './src/utils/authStorage';
import { useGameStore } from './src/store/gameStore';
import { initPushNotifications } from './src/services/pushNotifications';
import { checkAndApplyOtaUpdate } from './src/services/otaUpdates';
import { checkForPlayUpdate, initPlayUpdates, playUpdatesSupported } from './src/services/playUpdates';
import { UpdateRequiredScreen } from './src/components/UpdateRequiredScreen';
import { useNetStatus } from './src/store/netStatus';
import { adsSupported, refreshAdsConsent } from './src/services/ads';
import { hydrateAnalyticsConsent } from './src/services/analyticsConsent';

// Sentry hata izleme: DSN doğrudan koda gömülüdür. Client DSN'leri gizli
// değildir (her tarayıcı/mobil bundle'ında görünür), yalnızca olay GÖNDERME
// izni verir. Not: Vercel'deki eski EXPO_PUBLIC_SENTRY_DSN ortam değişkeni
// eski bir Sentry projesine işaret ediyordu; ortam değişkeni önceliği bu
// yüzden kaldırıldı — derlemeler tek, güncel DSN kullanır.
const SENTRY_DSN = 'https://c6d56d79f23514abcbd85504d7ae44bb@o4512379947778048.ingest.us.sentry.io/4512379953086464';
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: __DEV__ ? 'development' : 'production',
  });
}

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'tavriko-web-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      html, body {
        background-color: #090414 !important;
        margin: 0;
        padding: 0;
        height: 100%;
        height: 100dvh;
        width: 100%;
        overflow: hidden;
        -webkit-text-size-adjust: 100%;
      }
      #root {
        background-color: #090414 !important;
        display: flex;
        height: 100%;
        height: 100dvh;
        width: 100%;
      }
      /* Custom sleek Tavriko scrollbar */
      ::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }
      ::-webkit-scrollbar-track {
        background: rgba(14, 6, 32, 0.6);
      }
      ::-webkit-scrollbar-thumb {
        background: rgba(255, 196, 61, 0.4);
        border-radius: 999px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 196, 61, 0.75);
      }
      [data-testid="quiz-arena-scroll"], [data-testid="gameplay-rewards-scroll"] {
        scrollbar-width: none;
      }
      [data-testid="quiz-arena-scroll"]::-webkit-scrollbar,
      [data-testid="gameplay-rewards-scroll"]::-webkit-scrollbar {
        display: none;
      }
      /* Eliminate browser sharp default outline on all inputs (Chrome, Safari, Edge) */
      input, textarea, select {
        outline: none !important;
        box-shadow: none !important;
        -webkit-tap-highlight-color: transparent !important;
      }
      input:focus, textarea:focus, select:focus {
        outline: none !important;
        box-shadow: none !important;
      }
    `;
    document.head.appendChild(style);
  }
}

function AppInner() {
  useEffect(() => {
    if (adsSupported) void refreshAdsConsent().catch(() => {});
  }, []);
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });

  useEffect(() => {
    void hydrateAnalyticsConsent();
  }, []);

  // EAS Update (OTA): üretim derlemelerinde açılışta güncelleme kontrolü;
  // Expo Go / dev / web'de no-op. Hata durumunda sessizce susar.
  useEffect(() => {
    void checkAndApplyOtaUpdate();
  }, []);

  // Google Play uygulama içi güncelleme (mağaza sürümü): açılışta, ön plana
  // dönüşte (en fazla 6 saatte bir) ve bağlantı geri gelince kontrol.
  useEffect(() => {
    if (!playUpdatesSupported) return;
    initPlayUpdates();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') void checkForPlayUpdate('foreground');
    });
    let wasOnline = useNetStatus.getState().online;
    const unsubscribeNet = useNetStatus.subscribe(state => {
      if (state.online && !wasOnline) void checkForPlayUpdate('online');
      wasOnline = state.online;
    });
    return () => { sub.remove(); unsubscribeNet(); };
  }, []);

  // Dokunma yönlendirmesi ve Android kanalları; burada izin istenmez.
  useEffect(() => {
    initPushNotifications();
  }, []);

  // Mobilde kalıcı oturum: güvenli depodan (Keystore/Keychain) yükle.
  // RootNavigator ilk render'ından ÖNCE tamamlanmalı; aksi halde açılışta
  // kullanıcı çıkış yapılmamış olsa bile giriş ekranına düşer.
  const [authReady, setAuthReady] = useState(Platform.OS === 'web');
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let cancelled = false;
    hydrateAuthStorage().then(() => {
      if (cancelled) return;
      const { user, token } = getStoredAuth();
      if (user && !useGameStore.getState().user) {
        useGameStore.getState().setUser(user, token ?? undefined);
      }
      setAuthReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!fontsLoaded || !authReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#180B34', justifyContent: 'center', alignItems: 'center' }}>
        <LoadingShimmer wide label="Tavriko yükleniyor" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <RootNavigator />
      {playUpdatesSupported && <UpdateRequiredScreen />}
    </SafeAreaProvider>
  );
}

// Sentry.wrap, SDK kapalıyken bile bileşeni değiştirmeden geçirir.
export default Sentry.wrap(AppInner);
