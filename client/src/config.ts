import { Platform } from 'react-native';

/**
 * Tavriko Backend Configuration
 *
 * Cloud URL: Powered by Vercel Serverless (Supabase PostgreSQL + Upstash Redis)
 * Always reachable 24/7 without requiring a local machine or local network!
 */
export const CLOUD_HOST = 'tavriko-app.vercel.app';
export const CLOUD_BASE_URL = `https://${CLOUD_HOST}`;
export const CLOUD_API_URL = `${CLOUD_BASE_URL}/api`;

/**
 * Cloudflare Real-Time WebSocket Gateway URL
 * wss:// in production, ws:// in local dev
 */
export const CLOUDFLARE_WS_DEFAULT_HOST = 'tavriko-realtime.uncertainidentity8.workers.dev';

export const getRealtimeWsUrl = (path: string = '/ws'): string => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  // Allow explicit override from environment variable
  const envUrl = process.env.EXPO_PUBLIC_REALTIME_WS_URL;
  if (envUrl) {
    return envUrl.replace(/\/+$/, '') + cleanPath;
  }

  // Local development check on Web
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost) {
      return `ws://localhost:8787${cleanPath}`;
    }
  }

  // Production Cloudflare Workers WebSocket Gateway
  return `wss://${CLOUDFLARE_WS_DEFAULT_HOST}${cleanPath}`;
};

export const getApiBaseUrl = (): string => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location && window.location.origin) {
    // In web browser, use current host origin to ensure SSL and zero CORS issues
    return `${window.location.origin}/api`;
  }
  return CLOUD_API_URL;
};

export const getSocketBaseUrl = (): string => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin;
  }
  return CLOUD_BASE_URL;
};

// Default to 100% Cloud 24/7 URL for both mobile Expo and Web
export const DEFAULT_API_BASE = CLOUD_API_URL;
