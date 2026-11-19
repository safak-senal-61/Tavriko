import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { REWARDED_AD_COINS, REWARDED_AD_DAILY_LIMIT, RewardedAdStatus, UserProfile } from '@trivia/shared';
import { adsSupported, initAds, showRewardedAd } from '../services/ads';
import { getApiBaseUrl } from '../config';
import { authHeaders } from '../utils/apiAuth';
import { sound } from '../services/soundService';
import { THEME } from '../theme/tokens';
import { CoinIcon } from './TavrikoIcons';
import { KIT } from './StoreKit';

interface RewardedAdCardProps {
  user?: UserProfile;
  apiBaseUrl?: string;
  onUpdateUser?: (updatedUser: UserProfile) => void;
  /** Sonuç mesajını ekranın mevcut durum bandında göstermek için */
  onMessage?: (message: string, isError: boolean) => void;
}

/** Mağazadaki "Reklam izle, jeton kazan" kartı. Ödülü sunucu verir ve sınırlar. */
export const RewardedAdCard: React.FC<RewardedAdCardProps> = ({ user, apiBaseUrl, onUpdateUser, onMessage }) => {
  const [status, setStatus] = useState<RewardedAdStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const base = apiBaseUrl || getApiBaseUrl();
  const isGuest = !user || (user as any).isGuest || String(user.id || '').startsWith('guest_');

  const applyStatus = useCallback((st?: RewardedAdStatus | null) => {
    if (!st) return;
    setStatus(st);
    setCooldown(st.cooldownSec || 0);
  }, []);

  useEffect(() => {
    if (!adsSupported || isGuest) return;
    initAds().catch(() => {});
    let active = true;
    fetch(`${base}/social/ads/rewarded/status`, { headers: { ...authHeaders() } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => active && d?.status && applyStatus(d.status))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [base, isGuest, user?.id, applyStatus]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (!adsSupported || isGuest) return null;

  const remaining = status?.remainingToday ?? REWARDED_AD_DAILY_LIMIT;
  const limit = status?.dailyLimit ?? REWARDED_AD_DAILY_LIMIT;
  const coins = status?.coinsPerAd ?? REWARDED_AD_COINS;
  const disabled = busy || remaining <= 0 || cooldown > 0;

  const handleWatch = async () => {
    if (disabled) return;
    setBusy(true);
    try {
      const result = await showRewardedAd();
      if (result === 'unavailable') {
        onMessage?.('Şu anda reklam bulunamadı. Biraz sonra tekrar dene.', true);
        return;
      }
      if (result === 'dismissed') {
        onMessage?.('Jeton kazanmak için reklamı sonuna kadar izlemelisin.', true);
        return;
      }
      const res = await fetch(`${base}/social/ads/rewarded/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      applyStatus(data?.status);
      if (data?.user && onUpdateUser) onUpdateUser(data.user);
      if (!res.ok) {
        sound.playSound('wrong');
        onMessage?.(data?.error || 'Reklam ödülü alınamadı.', true);
        return;
      }
      sound.playSound('reward');
      sound.triggerHaptic('success');
      onMessage?.(`+${data.coinsAwarded ?? coins} jeton kazandın!`, false);
    } catch {
      onMessage?.('Bağlantı hatası oluştu.', true);
    } finally {
      setBusy(false);
    }
  };

  const buttonLabel =
    remaining <= 0 ? 'Yarın tekrar' : cooldown > 0 ? `${cooldown} sn` : 'İzle';

  return (
    <View style={styles.card}>
      <CoinIcon size={40} />
      <View style={styles.textCol}>
        <Text style={styles.title}>Reklam izle, jeton kazan</Text>
        <Text style={styles.sub}>
          +{coins} jeton · Bugün {remaining}/{limit} hak
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.button, disabled && styles.buttonDisabled]}
        activeOpacity={0.85}
        onPress={handleWatch}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Reklam izle, jeton kazan"
      >
        {busy ? <ActivityIndicator size="small" color="#1A0B3B" /> : <Text style={styles.buttonText}>{buttonLabel}</Text>}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KIT.card,
    borderColor: KIT.border,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 4,
    gap: 12,
  },
  textCol: { flex: 1 },
  title: { color: '#FFFFFF', fontSize: 15, fontFamily: THEME.fonts.extraBold },
  sub: { color: KIT.muted, fontSize: 12, marginTop: 2, fontFamily: THEME.fonts.bold },
  button: {
    minWidth: 84,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 11,
    backgroundColor: KIT.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#1A0B3B', fontSize: 13, fontFamily: THEME.fonts.extraBold },
});

export default RewardedAdCard;
