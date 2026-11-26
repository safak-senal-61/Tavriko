"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_STASH_ENTRIES = void 0;
exports.slotOfItem = slotOfItem;
exports.readStash = readStash;
exports.stashActive = stashActive;
exports.takeFromStash = takeFromStash;
exports.nextForSlot = nextForSlot;
exports.MAX_STASH_ENTRIES = 50;
function slotOfItem(itemId) {
    if (itemId.startsWith('frame_'))
        return 'frame';
    if (itemId.startsWith('bg_'))
        return 'background';
    if (itemId.startsWith('name_'))
        return 'nameEffect';
    if (itemId.startsWith('badge_'))
        return 'badge';
    return null;
}
function readStash(settings) {
    const raw = settings?.cosmeticStash;
    if (!Array.isArray(raw))
        return [];
    return raw.filter((e) => !!e && typeof e.itemId === 'string' && typeof e.remainingMs === 'number' && e.remainingMs > 0 && !!slotOfItem(e.itemId));
}
/**
 * Slotta aktif olan eşyayı (süresi dolmamışsa) kalan süresiyle sepete ekler.
 * Aynı eşya zaten sepetteyse kalan süreler toplanır. Yeni dizi döner.
 */
function stashActive(stash, active, now) {
    const { itemId, expiresAt } = active;
    const slot = itemId ? slotOfItem(itemId) : null;
    // Süresiz (kalıcı) kuşanımlar ve süresi dolanlar sepete girmez.
    if (!itemId || !slot || !expiresAt || expiresAt <= now)
        return stash;
    const remainingMs = expiresAt - now;
    const existing = stash.find(e => e.itemId === itemId);
    if (existing) {
        return stash.map(e => e === existing ? { ...e, remainingMs: e.remainingMs + remainingMs } : e);
    }
    const next = [...stash, { slot, itemId, name: active.name || itemId, remainingMs, storedAt: now }];
    return next.slice(-exports.MAX_STASH_ENTRIES);
}
/** Sepetten bir eşyayı çıkarır; kalan süresiyle birlikte döner. */
function takeFromStash(stash, itemId) {
    const entry = stash.find(e => e.itemId === itemId);
    if (!entry)
        return null;
    return { entry, rest: stash.filter(e => e !== entry) };
}
/** Bir slot için sıradaki (en eski saklanan) eşya. */
function nextForSlot(stash, slot) {
    return stash.filter(e => e.slot === slot).sort((a, b) => a.storedAt - b.storedAt)[0] ?? null;
}
