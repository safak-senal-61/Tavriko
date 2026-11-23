import { LEGAL_VERSION, UserProfile, hasAcceptedCurrentLegal, LegalConsentRecord } from '@trivia/shared';

/**
 * Yasal metin onayı yardımcıları.
 * Onay kaynağı, sunucunun kullanıcı profiline yazdığı settings.legalConsent alanıdır.
 */

const GOOGLE_ACK_KEY = 'tavriko_google_legal_ack';
const GOOGLE_ACK_MAX_AGE_MS = 60 * 60 * 1000; // Google yönlendirmesi en fazla 1 saat sürer

const storage = (): Storage | null => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch {}
  return null;
};

/** Google butonuna basıldığında (bildirim metni görülerek) çağrılır. */
export const markGoogleLegalAcknowledged = () => {
  storage()?.setItem(GOOGLE_ACK_KEY, JSON.stringify({ version: LEGAL_VERSION, at: Date.now() }));
};

/** Google ile girişten hemen sonra onayın otomatik kaydedilip kaydedilmeyeceğini döndürür (tek seferlik). */
export const consumeGoogleLegalAck = (): boolean => {
  const s = storage();
  if (!s) return false;
  const raw = s.getItem(GOOGLE_ACK_KEY);
  s.removeItem(GOOGLE_ACK_KEY);
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.version === LEGAL_VERSION && Date.now() - Number(parsed?.at || 0) < GOOGLE_ACK_MAX_AGE_MS;
  } catch {
    return false;
  }
};

export const getLegalConsent = (user: UserProfile | null | undefined) => user?.settings?.legalConsent ?? null;

/** Profilin kısmi/bayat bir yanıtı, aynı hesabın güncel onayını silemez. */
export function preserveLegalConsent(previous: UserProfile | null, incoming: UserProfile | null) {
  if (!incoming || previous?.id !== incoming.id || !hasAcceptedCurrentLegal(previous.settings) ||
    hasAcceptedCurrentLegal(incoming.settings)) return incoming;
  return { ...incoming, settings: { ...incoming.settings, legalConsent: previous.settings?.legalConsent } };
}

/** Kayıtlı (misafir olmayan) kullanıcı güncel metinleri onaylamamışsa true. */
export const needsLegalConsent = (user: UserProfile | null | undefined, isGuest: boolean): boolean => {
  if (!user || isGuest || user.isGuest || !user.id) return false;
  return !hasAcceptedCurrentLegal(user.settings);
};

/** Daha önce başka bir sürümü onaylamış kullanıcılar için "güncelledik" metni gösterilir. */
export const isLegalUpdate = (user: UserProfile | null | undefined) => {
  const consent = getLegalConsent(user);
  return Boolean(consent && consent.version && consent.version !== LEGAL_VERSION);
};

export const submitLegalConsent = async (
  apiBaseUrl: string,
  token: string,
  method: LegalConsentRecord['method']
): Promise<UserProfile> => {
  const res = await fetch(`${apiBaseUrl}/auth/legal-consent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ version: LEGAL_VERSION, method }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Onay kaydedilemedi. Lütfen tekrar dene.');
  if (!data?.user?.id || !hasAcceptedCurrentLegal(data.user.settings)) {
    throw new Error('Onay kaydedilemedi. Lütfen tekrar dene.');
  }
  return data.user as UserProfile;
};
