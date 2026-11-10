import { useGameStore } from '../store/gameStore';

/**
 * Returns the authenticated player's Authorization header, if a session
 * token is present. Spread into fetch headers for endpoints that require
 * a verified session.
 */
export const authHeaders = (): Record<string, string> => {
  const token = useGameStore.getState().token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};
