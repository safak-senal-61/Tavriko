const KEY = 'tavriko_pending_room_v1';
const MAX_AGE = 30 * 60 * 1000; // oda kodları kısa ömürlüdür: 30 dakika

let pending: { code: string; at: number } | null = null;

/**
 * Paylaşılan özel oda bağlantısındaki ?oda=KOD parametresini yakalar.
 * Kullanıcı giriş yaptıktan sonra bu koda sahip odaya otomatik katılır.
 */
export function captureRoomLink(url?: string | null): string | null {
  try {
    const parsed = new URL(url || (typeof window !== 'undefined' ? window.location.href : ''));
    const code = parsed.searchParams.get('oda');
    if (code && /^[A-Za-z0-9]{4,10}$/.test(code)) {
      pending = { code: code.toUpperCase(), at: Date.now() };
      try { window.localStorage.setItem(KEY, JSON.stringify(pending)); } catch {}
    }
  } catch {}
  return getPendingRoomCode();
}

export function getPendingRoomCode(): string | null {
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored) pending = JSON.parse(stored);
  } catch {}
  if (!pending || !Number.isFinite(pending.at) || Date.now() - pending.at > MAX_AGE) {
    clearPendingRoomCode();
    return null;
  }
  return pending.code;
}

export function clearPendingRoomCode(): void {
  pending = null;
  try { window.localStorage.removeItem(KEY); } catch {}
  // İşlenen bağlantının tekrar yakalanmasını önle
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('oda')) {
      url.searchParams.delete('oda');
      window.history.replaceState(window.history.state, '', url.toString());
    }
  } catch {}
}
