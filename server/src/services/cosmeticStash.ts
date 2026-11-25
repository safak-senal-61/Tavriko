import type { UserSettings } from '@trivia/shared';

/**
 * Süreli kozmetikler (çerçeve, arka plan, isim efekti, rozet) için "bekleyen süre" mantığı.
 *
 * Bir slota yeni kozmetik takılınca, o slottaki ve süresi dolmamış eşyanın kalan süresi
 * kaybolmaz; `settings.cosmeticStash` içinde saklanır. Kullanıcı istediği zaman kalan
 * süreyi tekrar kuşanabilir; kuşanılan eşyanın süresi dolunca da aynı slottaki sıradaki
 * eşya otomatik devreye girer.
 */
export type CosmeticSlot = 'frame' | 'background' | 'nameEffect' | 'badge';

export interface CosmeticStashEntry {
  slot: CosmeticSlot;
  itemId: string;
  name: string;
  /** Eşya kuşanıldığında kalan süre (ms). */
  remainingMs: number;
  /** Sıra: küçük olan önce otomatik devreye girer. */
  storedAt: number;
}

export const MAX_STASH_ENTRIES = 50;

export function slotOfItem(itemId: string): CosmeticSlot | null {
  if (itemId.startsWith('frame_')) return 'frame';
  if (itemId.startsWith('bg_')) return 'background';
  if (itemId.startsWith('name_')) return 'nameEffect';
  if (itemId.startsWith('badge_')) return 'badge';
  return null;
}

export function readStash(settings: UserSettings | undefined | null): CosmeticStashEntry[] {
  const raw = (settings as { cosmeticStash?: unknown } | undefined | null)?.cosmeticStash;
  if (!Array.isArray(raw)) return [];
  return raw.filter((e): e is CosmeticStashEntry =>
    !!e && typeof e.itemId === 'string' && typeof e.remainingMs === 'number' && e.remainingMs > 0 && !!slotOfItem(e.itemId));
}

/**
 * Slotta aktif olan eşyayı (süresi dolmamışsa) kalan süresiyle sepete ekler.
 * Aynı eşya zaten sepetteyse kalan süreler toplanır. Yeni dizi döner.
 */
export function stashActive(
  stash: CosmeticStashEntry[],
  active: { itemId?: string | null; expiresAt?: number | null; name?: string },
  now: number,
): CosmeticStashEntry[] {
  const { itemId, expiresAt } = active;
  const slot = itemId ? slotOfItem(itemId) : null;
  // Süresiz (kalıcı) kuşanımlar ve süresi dolanlar sepete girmez.
  if (!itemId || !slot || !expiresAt || expiresAt <= now) return stash;
  const remainingMs = expiresAt - now;
  const existing = stash.find(e => e.itemId === itemId);
  if (existing) {
    return stash.map(e => e === existing ? { ...e, remainingMs: e.remainingMs + remainingMs } : e);
  }
  const next = [...stash, { slot, itemId, name: active.name || itemId, remainingMs, storedAt: now }];
  return next.slice(-MAX_STASH_ENTRIES);
}

/** Sepetten bir eşyayı çıkarır; kalan süresiyle birlikte döner. */
export function takeFromStash(
  stash: CosmeticStashEntry[],
  itemId: string,
): { entry: CosmeticStashEntry; rest: CosmeticStashEntry[] } | null {
  const entry = stash.find(e => e.itemId === itemId);
  if (!entry) return null;
  return { entry, rest: stash.filter(e => e !== entry) };
}

/** Bir slot için sıradaki (en eski saklanan) eşya. */
export function nextForSlot(stash: CosmeticStashEntry[], slot: CosmeticSlot): CosmeticStashEntry | null {
  return stash.filter(e => e.slot === slot).sort((a, b) => a.storedAt - b.storedAt)[0] ?? null;
}
