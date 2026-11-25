import React, { useEffect, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { getApiBaseUrl } from '../config';
import { useGameStore } from '../store/gameStore';
import { authHeaders } from '../utils/apiAuth';
import { CharacterAvatar } from './TavrikoIcons';
import { ANIMATED_FRAME_COLORS, AnimatedFrame, AnimatedNameText, FramedAvatar, frameFor } from './StoreKit';

/**
 * Oyuncuların çerçeve ve isim efektini her ekranda (liderlik, arkadaşlar, lobi, quiz...)
 * animasyonuyla göstermek için ortak katman. Veriler sunucudan toplu çekilir ve kısa süre
 * önbelleğe alınır; kendi hesabın için güncel profil doğrudan kullanılır.
 */
export type PlayerCosmetics = {
  equippedFrame?: string;
  equippedFrameExpiresAt?: number;
  equippedNameEffect?: string;
  equippedNameEffectExpiresAt?: number;
};

const TTL_MS = 60_000;
const BATCH_MS = 40;
const BATCH_MAX = 50;
const NONE: PlayerCosmetics = {};

const cache = new Map<string, { at: number; data: PlayerCosmetics }>();
const pending = new Set<string>();
const inflight = new Set<string>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let version = 0;

const emit = () => { version += 1; listeners.forEach(l => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const isRealUserId = (id?: string | null): id is string => !!id && !/^(bot_|guest_)/i.test(id);

async function flush() {
  timer = null;
  const ids = [...pending].slice(0, BATCH_MAX);
  ids.forEach(id => { pending.delete(id); inflight.add(id); });
  if (pending.size) timer = setTimeout(flush, BATCH_MS);
  if (!ids.length) return;
  try {
    const res = await fetch(`${getApiBaseUrl()}/social/cosmetics?ids=${encodeURIComponent(ids.join(','))}`, { headers: authHeaders() });
    const body = res.ok ? await res.json() as { cosmetics?: Record<string, PlayerCosmetics> } : null;
    const now = Date.now();
    for (const id of ids) cache.set(id, { at: now, data: body?.cosmetics?.[id] ?? NONE });
  } catch {
    const now = Date.now() - TTL_MS + 5_000; // hata: 5 sn sonra yeniden dene
    for (const id of ids) if (!cache.has(id)) cache.set(id, { at: now, data: NONE });
  } finally {
    ids.forEach(id => inflight.delete(id));
    emit();
  }
}

function request(id: string) {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return;
  if (pending.has(id) || inflight.has(id)) return;
  pending.add(id);
  if (!timer) timer = setTimeout(flush, BATCH_MS);
}

/** Satın alma/kuşanma sonrası önbelleği temizler. */
export function invalidatePlayerCosmetics(id?: string) {
  if (id) cache.delete(id); else cache.clear();
  emit();
}

export function usePlayerCosmetics(userId?: string | null, override?: PlayerCosmetics | null): PlayerCosmetics {
  useSyncExternalStore(subscribe, () => version, () => version);
  const me = useGameStore(s => s.user);
  const own = !!userId && me?.id === userId ? me : null;
  const wanted = !override && !own && isRealUserId(userId) ? userId : null;
  useEffect(() => { if (wanted) request(wanted); });
  if (override) return override;
  if (own) return own;
  return (wanted && cache.get(wanted)?.data) || NONE;
}

const active = (id?: string, exp?: number) => (id && (!exp || exp > Date.now()) ? id : undefined);
export const activeFrameId = (c: PlayerCosmetics) => active(c.equippedFrame, c.equippedFrameExpiresAt);
export const activeNameEffectId = (c: PlayerCosmetics) => active(c.equippedNameEffect, c.equippedNameEffectExpiresAt);

/**
 * Avatar + (varsa) animasyonlu çerçeve. Çerçeve, yerleşimi bozmamak için `size` kutusunun
 * dışına taşar; kutu boyutu her zaman `size` kalır.
 */
export const PlayerAvatar: React.FC<{
  userId?: string | null;
  seed?: string;
  size: number;
  cosmetics?: PlayerCosmetics | null;
  /**
   * Avatarı saran halka (kenarlık/parıltı). Çerçeve varsa halka çizilmez, çerçeve onun yerini alır;
   * çerçeve yoksa halka olduğu gibi çizilir. Halkanın dış boyutu `ringSize` (varsayılan `size`).
   */
  ringStyle?: StyleProp<ViewStyle>;
  ringSize?: number;
  children?: React.ReactNode;
}> = ({ userId, seed, size, cosmetics, ringStyle, ringSize, children }) => {
  const c = usePlayerCosmetics(userId, cosmetics);
  const frameId = activeFrameId(c);
  const art = frameId ? frameFor(frameId) : null;
  const animated = frameId && !art && ANIMATED_FRAME_COLORS[frameId.toLowerCase()] ? frameId : null;
  const outer = ringSize ?? size;
  if (!art && !animated) {
    const plain = <CharacterAvatar seed={seed} size={size} />;
    return ringStyle ? <View style={ringStyle}>{plain}{children}</View> : <>{plain}{children}</>;
  }
  // Çerçeve, yerleşimi bozmamak için dış kutunun dışına taşar; kutu boyutu aynı kalır.
  const frameSize = Math.round(outer * (art ? 1.5 : 1.4));
  return (
    <View style={{ width: outer, height: outer, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[styles.centered, { width: frameSize, height: frameSize, left: (outer - frameSize) / 2, top: (outer - frameSize) / 2 }]} pointerEvents="none">
        {art
          ? <FramedAvatar frameId={frameId!} seed={seed} size={frameSize} animate />
          : <AnimatedFrame frameId={animated!} seed={seed} size={frameSize} />}
      </View>
      {children}
    </View>
  );
};

/** Oyuncu adı: isim efekti varsa animasyonlu, yoksa düz metin. */
export const PlayerName: React.FC<{
  userId?: string | null;
  name: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  cosmetics?: PlayerCosmetics | null;
}> = ({ userId, name, style, numberOfLines, cosmetics }) => {
  const c = usePlayerCosmetics(userId, cosmetics);
  const effectId = activeNameEffectId(c);
  if (effectId) return <AnimatedNameText effectId={effectId} style={style} numberOfLines={numberOfLines}>{name}</AnimatedNameText>;
  return <Text style={style} numberOfLines={numberOfLines}>{name}</Text>;
};

const styles = StyleSheet.create({ centered: { position: 'absolute' } });
