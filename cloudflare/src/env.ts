export interface Env {
  GAME_ROOMS: DurableObjectNamespace;
  MATCHMAKER: DurableObjectNamespace;

  ENVIRONMENT?: string;
  BACKEND_API_URL: string;
  JWT_SECRET: string;
  INTERNAL_API_SECRET?: string;
  RECONNECTION_GRACE_SEC?: number;
  ROUND_INTERMISSION_SEC?: number;
  COUNTDOWN_DURATION_SEC?: number;
}
