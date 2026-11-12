import React from 'react';
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

// Sentry hata izleme: EXPO_PUBLIC_SENTRY_DSN tanımlı değilse sessizce kapalı kalır.
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
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

  if (!fontsLoaded) {
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
