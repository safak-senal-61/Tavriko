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
import { View, ActivityIndicator, Platform } from 'react-native';
import { RootNavigator } from './src/navigation/RootNavigator';
import { hydrateAuthStorage, getStoredAuth } from './src/utils/authStorage';
import { useGameStore } from './src/store/gameStore';
import { initAnalytics, trackSessionStart } from './src/services/analytics';
import { initPushNotifications, registerForPushNotifications } from './src/services/pushNotifications';

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
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });

  // Ürün analitiği (PostHog): anahtar yoksa sessizce kapalı kalır.
  // session_start event'i — D1/D7 retention ölçümünün temeli.
  useEffect(() => {
    void initAnalytics().then(() => {
      trackSessionStart();
    });
  }, []);

  // Push bildirimleri: ön planda banner gösterimi + kanal kurulumu (mobil).
  // Oturum açan kullanıcıların cihaz token'ı sunucuya kaydolunur; kullanıcı
  // değişirse (giriş/çıkış) yeni kullanıcı için yeniden denenir.
  useEffect(() => {
    initPushNotifications();
    const register = (userId: string | undefined) => {
      if (userId) void registerForPushNotifications(userId);
    };
    register(useGameStore.getState().user?.id);
    return useGameStore.subscribe((state) => register(state.user?.id));
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
        <ActivityIndicator size="large" color="#FFC43D" />
      </View>
    );
  }

  return <RootNavigator />;
}

// Sentry.wrap, SDK kapalıyken bile bileşeni değiştirmeden geçirir.
export default Sentry.wrap(AppInner);
