import { createContext, useContext } from 'react';
import type { getWebLayout } from './webLayout';

export const PlayerWebLayoutContext = createContext<ReturnType<typeof getWebLayout> | null>(null);

export function usePlayerWebLayout() {
  return useContext(PlayerWebLayoutContext);
}
