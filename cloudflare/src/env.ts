export interface Env {
  GAME_ROOMS: DurableObjectNamespace;
  MATCHMAKER: DurableObjectNamespace;
  AVATAR_BUCKET?: R2Bucket;

  ENVIRONMENT?: string;
  BACKEND_API_URL: string;
  JWT_SECRET: string;
  INTERNAL_API_SECRET?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  SENTRY_DSN?: string;
  RECONNECTION_GRACE_SEC?: number;
  ROUND_INTERMISSION_SEC?: number;
  COUNTDOWN_DURATION_SEC?: number;
}
