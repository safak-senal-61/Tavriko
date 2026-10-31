import { Platform } from 'react-native';

/**
 * Tavriko Backend Configuration
 *
 * Cloud URL: Powered by Vercel Serverless (Supabase PostgreSQL + Upstash Redis)
 * Local URL: Local Node.js + Express development server on port 4000
 */
export const VERCEL_API_URL = 'https://tavriko-app.vercel.app/api';
export const LOCAL_API_URL =
  Platform.OS === 'web'
    ? 'http://localhost:4000/api'
    : 'http://192.168.2.67:4000/api';

// Default to Cloud Vercel Backend so mobile Expo app runs anywhere, anytime without localhost!
export const DEFAULT_API_BASE = VERCEL_API_URL;
