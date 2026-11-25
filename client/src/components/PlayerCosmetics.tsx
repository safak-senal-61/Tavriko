import React, { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { getApiBaseUrl } from '../config';
import { useGameStore } from '../store/gameStore';
import { authHeaders } from '../utils/apiAuth';
import { CharacterAvatar } from './TavrikoIcons';
import { ANIMATED_FRAME_COLORS, AnimatedFrame, FramedAvatar, frameFor } from './StoreKit';
import { NickRenderer, type NickVariant } from './nick/NickRenderer';

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
const emit = () => { listeners.forEach(l => l()); };
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

const EMPTY_ENTRY = { at: 0, data: NONE };

/**
 * Oyuncunun kozmetikleri. Her bileşen yalnızca kendi kimliğinin önbellek
 * kaydına abone olur (snapshot = o kaydın nesnesi); başka oyuncuların verisi
 * gelince yeniden render olmaz. Kendi hesabın için yalnızca kozmetik alanları
 * seçilir, profilin diğer alanları değişince isimler yeniden çizilmez.
 */
export function usePlayerCosmetics(userId?: string | null, override?: PlayerCosmetics | null): PlayerCosmetics {
  const meId = useGameStore(s => s.user?.id);
  const meFrame = useGameStore(s => s.user?.equippedFrame);
  const meFrameExp = useGameStore(s => s.user?.equippedFrameExpiresAt);
  const meName = useGameStore(s => s.user?.equippedNameEffect);
  const meNameExp = useGameStore(s => s.user?.equippedNameEffectExpiresAt);
  const isOwn = !!userId && meId === userId;
  const wanted = !override && !isOwn && isRealUserId(userId) ? userId : null;
  const getSnap = useCallback(() => (wanted ? cache.get(wanted) ?? EMPTY_ENTRY : EMPTY_ENTRY), [wanted]);
  const entry = useSyncExternalStore(subscribe, getSnap, getSnap);
  useEffect(() => { if (wanted) request(wanted); });
  const own = useMemo<PlayerCosmetics | null>(
    () => (isOwn
      ? { equippedFrame: meFrame, equippedFrameExpiresAt: meFrameExp, equippedNameEffect: meName, equippedNameEffectExpiresAt: meNameExp }
      : null),
    [isOwn, meFrame, meFrameExp, meName, meNameExp],
  );
  if (override) return override;
  if (own) return own;
  return entry.data || NONE;
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

/**
 * Oyuncu adı: kuşanılmış nick stili varsa merkezi NickRenderer ile (Skia/Lottie
 * veya hafif mod), yoksa düz metin. Profil, maç, liderlik, arkadaş ve sohbet
 * ekranlarının hepsi bu bileşeni kullanır; stil değişince hepsi güncellenir.
 */
export const PlayerName: React.FC<{
  userId?: string | null;
  name: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  cosmetics?: PlayerCosmetics | null;
  variant?: NickVariant;
}> = React.memo(({ userId, name, style, numberOfLines, cosmetics, variant }) => {
  const c = usePlayerCosmetics(userId, cosmetics);
  const effectId = activeNameEffectId(c);
  return <NickRenderer styleId={effectId} text={name} style={style} numberOfLines={numberOfLines} variant={variant} />;
});

const styles = StyleSheet.create({ centered: { position: 'absolute' } });
