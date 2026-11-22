import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  enablePushFromUserAction,
  getPushPermission,
  openPushSettings,
  pushSupported,
  registerForPushNotifications,
  type PushPermission,
} from './pushNotifications';

export function usePushPermission(userId: string | null, token: string | null) {
  const [status, setStatus] = useState<PushPermission>('unknown');
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const requestInFlight = useRef(false);
  const readVersion = useRef(0);

  useEffect(() => {
    if (!pushSupported || !userId || !token) return;
    let cancelled = false;
    const sync = async () => {
      const version = ++readVersion.current;
      const next = await getPushPermission();
      if (cancelled || version !== readVersion.current) return;
      setStatus(next);
      if (next !== 'unknown') setError(false);
      if (next === 'granted') void registerForPushNotifications(userId);
    };
    const subscription = AppState.addEventListener('change', state => {
      const active = state === 'active';
      setForeground(active);
      if (active && !requestInFlight.current) void sync();
    });
    const active = AppState.currentState === 'active';
    setForeground(active);
    void sync();
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [userId, token]);

  const enable = useCallback(async () => {
    if (!pushSupported || !userId || !token || requestInFlight.current) return;
    requestInFlight.current = true;
    ++readVersion.current;
    setBusy(true);
    setError(false);
    try {
      let next: PushPermission;
      if (status === 'granted') {
        await openPushSettings();
        next = await getPushPermission();
      } else {
        next = await enablePushFromUserAction();
      }
      setStatus(next);
      if (next === 'granted') void registerForPushNotifications(userId);
      if (next === 'unknown') setError(true);
    } catch {
      setError(true);
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }, [status, userId, token]);

  return { status, foreground, busy, error, enable };
}
