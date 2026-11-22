import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GAMEPLAY_REWARDS, type GameplayRewardStatus, type UserProfile } from '@trivia/shared';
import { KitHeader, KitHero, KitChips, KIT, STORE_IMG, BadgeVisual, storeImageFor } from '../components/StoreKit';
import { TavrikoScreen, TavrikoTopBar } from '../components/TavrikoIcons';
import { usePlayerWebLayout } from '../navigation/PlayerWebLayoutContext';
import { authHeaders } from '../utils/apiAuth';

type RewardTab = 'chest' | 'badge';
const tabs: { id: RewardTab; label: string }[] = [
  { id: 'chest', label: 'Sandıklar' },
  { id: 'badge', label: 'Rozetler' },
];

type Props = {
  user: UserProfile;
  apiBaseUrl: string;
  onUpdateUser: (user: UserProfile) => void;
  onBack: () => void;
  onInventory: () => void;
  onFriends: () => void;
};

export function GameplayRewardsScreen({ user, apiBaseUrl, onUpdateUser, onBack, onInventory, onFriends }: Props) {
  const layout = usePlayerWebLayout();
  const columns = layout?.columns ?? 1;
  const [tab, setTab] = useState<RewardTab>('chest');
  const [rewards, setRewards] = useState<GameplayRewardStatus[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [claimError, setClaimError] = useState(false);
  const [message, setMessage] = useState('');
  const claimInFlight = useRef(false);
  const claimController = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setRewards(null);
    setLoadError('');
    fetch(`${apiBaseUrl}/social/rewards`, { headers: authHeaders(), signal: controller.signal })
      .then(async res => {
        const body = await res.json().catch(() => null);
        if (!res.ok || !Array.isArray(body?.rewards)) {
          if (!controller.signal.aborted) setLoadError(body?.error || 'Ödüller yüklenemedi. Tekrar deneyebilirsin.');
          return;
        }
        if (!controller.signal.aborted) setRewards(body.rewards);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError('Sunucuya bağlanılamadı. Tekrar deneyebilirsin.');
      });
    return () => controller.abort();
  }, [apiBaseUrl, reload]);

  useEffect(() => () => claimController.current?.abort(), []);

  const claim = async (id: string, name: string) => {
    if (claimInFlight.current) return;
    const controller = new AbortController();
    claimController.current = controller;
    claimInFlight.current = true;
    setBusy(id);
    setMessage('');
    setClaimError(false);
    try {
      const res = await fetch(`${apiBaseUrl}/social/rewards/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ rewardId: id }),
        signal: controller.signal,
      });
      const body = await res.json().catch(() => null);
      if (controller.signal.aborted) return;
      if (!res.ok || !Array.isArray(body?.rewards)) {
        setClaimError(true);
        setMessage(body?.error || 'Ödül alınamadı. Tekrar deneyebilirsin.');
        return;
      }
      setRewards(body.rewards);
      if (body.user?.id === user.id) onUpdateUser(body.user);
      setMessage(body.claimedNow ? `${name} envanterine eklendi.` : `${name} zaten alınmış.`);
    } catch {
      if (controller.signal.aborted) return;
      setClaimError(true);
      setMessage('Sunucuya bağlanılamadı. Tekrar deneyebilirsin.');
    } finally {
      claimInFlight.current = false;
      if (!controller.signal.aborted) setBusy(null);
    }
  };

  return (
    <TavrikoScreen>
      <TavrikoTopBar
        leftType="back" onLeftPress={onBack}
        coins={user.coins} gems={user.gems ?? 0} avatarSeed={user.avatarUrl || user.displayName}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <KitHeader title="Ödüller" subtitle="Maçları oyna, görevleri tamamla" />
        <KitHero eyebrow="TAVRİKO ÖDÜLLERİ" title="Oyna ve kazan" height={142}
          art={STORE_IMG.chestGold} artSize={106} subtitle="Sandıkları ve kalıcı rozetleri ücretsiz kazan." />
        <KitChips tabs={tabs} active={tab} onChange={setTab} accessibleToggle />
        <View style={styles.intro}>
          <Text accessibilityRole="header" style={styles.heading}>{tab === 'chest' ? 'Sandıklar' : 'Rozetler'}</Text>
          <Text style={styles.copy}>{tab === 'chest'
            ? 'Sunucunun doğruladığı ve en az bir doğru cevap verdiğin maçlar sayılır. Her sandık, anahtarıyla birlikte bir kez alınabilir.'
            : 'Her görevin ilerlemesi ayrıdır. Rozetleri aldıktan sonra envanterden profiline takabilirsin.'}</Text>
          <View style={styles.links}>
            <Pressable style={styles.outline} accessibilityRole="button" onPress={onInventory}>
              <Text style={styles.linkText}>Envantere git</Text>
            </Pressable>
            {tab === 'badge' && (
              <Pressable style={styles.outline} accessibilityRole="button" onPress={onFriends}>
                <Text style={styles.linkText}>Arkadaşlara git</Text>
              </Pressable>
            )}
          </View>
        </View>
        {!!message && (
          <View style={styles.notice}>
            <Text accessibilityLiveRegion="polite" style={[styles.copy, { color: claimError ? '#FFB4AF' : KIT.mint }]}>{message}</Text>
            {claimError && (
              <Pressable accessibilityRole="button" style={styles.outline} onPress={() => { setMessage(''); setReload(n => n + 1); }}>
                <Text style={styles.linkText}>İlerlemeyi yenile</Text>
              </Pressable>
            )}
          </View>
        )}
        {rewards ? (
          <View style={styles.grid}>
            {GAMEPLAY_REWARDS.filter(({ item }) => item.category === tab).map(reward => {
              const { item, key, target, task } = reward;
              const status = rewards.find(s => s.id === item.id);
              const current = status?.current ?? 0;
              const ready = current >= target && !status?.claimed;
              const active = ready || Boolean(status?.claimed);
              const art = storeImageFor(item.id, item.category);
              return (
                <View key={item.id} style={[styles.card, columns > 1 && { width: columns === 2 ? '49%' : '32.3%' }]}>
                  <View style={styles.row}>
                    {item.category === 'badge' ? <BadgeVisual badgeId={item.id} size={54} /> :
                      art && <Image source={art} style={styles.art} resizeMode="contain" />}
                    <View style={styles.details}>
                      <Text style={styles.name}>{item.name}</Text>
                      <Text style={styles.copy}>{task}</Text>
                    </View>
                  </View>
                  <View style={styles.progressLabel}>
                    <Text style={styles.meta}>{key ? `${key.name} dahil` : 'Kalıcı rozet'}</Text>
                    <Text style={[styles.count, active && { color: KIT.mint }]}>{current} / {target}</Text>
                  </View>
                  <View style={styles.track} accessibilityRole="progressbar" accessibilityLabel={item.name}
                    aria-valuemin={0} aria-valuemax={target} aria-valuenow={current}>
                    <View style={[styles.fill, { width: `${100 * current / target}%`, backgroundColor: active ? KIT.mint : '#AD88FF' }]} />
                  </View>
                  {ready ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={`${item.name} ödülünü al`}
                      accessibilityState={{ disabled: busy !== null, busy: busy === item.id }}
                      disabled={busy !== null} style={[styles.claim, busy && styles.disabled]} onPress={() => void claim(item.id, item.name)}>
                      <Text style={styles.claimText}>{busy === item.id ? 'Alınıyor…' : 'Ödülü al'}</Text>
                    </Pressable>
                  ) : (
                    <Text style={[styles.status, status?.claimed && { color: KIT.mint }]}>{status?.claimed ? 'Alındı' : 'Devam ediyor'}</Text>
                  )}
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.notice}>
            <Text accessibilityLiveRegion="polite" style={styles.copy}>{loadError || 'Ödüller yükleniyor…'}</Text>
            {!!loadError && (
              <Pressable accessibilityRole="button" style={styles.outline} onPress={() => setReload(n => n + 1)}>
                <Text style={styles.linkText}>Tekrar dene</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </TavrikoScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 28, gap: 12 },
  intro: { gap: 7 },
  heading: { fontSize: 21, color: '#FFF', fontWeight: '800' },
  copy: { fontSize: 13, color: '#E1D5F5', lineHeight: 19 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  outline: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', borderWidth: 1, borderColor: '#76579A', paddingHorizontal: 12, borderRadius: 12 },
  linkText: { fontSize: 13, fontWeight: '700', color: '#EEE2FF' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  card: { width: '100%', backgroundColor: '#211341', borderColor: '#5D427B', borderWidth: 1, borderRadius: 16, padding: 12, gap: 8 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 56 },
  art: { width: 54, height: 54 },
  details: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  progressLabel: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6 },
  meta: { color: '#D7C5EF', fontSize: 12, flex: 1 },
  count: { fontVariant: ['tabular-nums'], color: '#FFF', fontSize: 13, fontWeight: '800' },
  track: { height: 8, backgroundColor: '#3D2957', borderRadius: 8, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 8 },
  claim: { backgroundColor: KIT.gold, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 11 },
  claimText: { color: '#231229', fontWeight: '800', fontSize: 14 },
  disabled: { opacity: 0.67 },
  status: { minHeight: 44, textAlignVertical: 'center', lineHeight: 44, color: '#D7C5EF', fontWeight: '700', fontSize: 13 },
  notice: { borderWidth: 1, borderColor: '#5D427B', borderRadius: 12, backgroundColor: '#211341', padding: 12, gap: 8 },
});
