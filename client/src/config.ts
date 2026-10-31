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

