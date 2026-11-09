const KEY = 'tavriko_pending_profile_v1';
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;

let pending: { code: string; at: number } | null = null;

/**
 * Paylaşılan profil bağlantısındaki ?profil=KOD parametresini yakalar.
 * Kullanıcı giriş yaptıktan sonra bu koda ait profil modalı açılır.
 */
export function captureProfileLink(url?: string | null): string | null {
  try {
    const parsed = new URL(url || (typeof window !== 'undefined' ? window.location.href : ''));
    const code = parsed.searchParams.get('profil');
    if (code && /^[A-Za-z0-9\-_]{4,32}$/.test(code)) {
      pending = { code, at: Date.now() };
      try { window.localStorage.setItem(KEY, JSON.stringify(pending)); } catch {}
    }
  } catch {}
  return getPendingProfileCode();
}

export function getPendingProfileCode(): string | null {
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored) pending = JSON.parse(stored);
  } catch {}
  if (!pending || !Number.isFinite(pending.at) || Date.now() - pending.at > MAX_AGE) {
    clearPendingProfileCode();
    return null;
  }
  return pending.code;
}

export function clearPendingProfileCode(): void {
  pending = null;
  try { window.localStorage.removeItem(KEY); } catch {}
  // İşlenen bağlantının tekrar yakalanmasını önle
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('profil')) {
      url.searchParams.delete('profil');
      window.history.replaceState(window.history.state, '', url.toString());
    }
  } catch {}
}
