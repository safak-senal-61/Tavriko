import { LEGAL_VERSION, UserProfile, hasAcceptedCurrentLegal, LegalConsentRecord } from '@trivia/shared';

/**
 * Yasal metin onayı yardımcıları.
 * Asıl kayıt sunucuda users.settings.legalConsent alanında tutulur; cihazdaki kayıt
 * yalnızca profil yenilemelerinde onay ekranının gereksiz yere tekrar açılmasını önler.
 */

const GOOGLE_ACK_KEY = 'tavriko_google_legal_ack';
const LOCAL_CONSENT_PREFIX = 'tavriko_legal_consent_';
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

export const rememberLocalConsent = (userId: string) => {
  storage()?.setItem(LOCAL_CONSENT_PREFIX + userId, LEGAL_VERSION);
};

const hasLocalConsent = (userId: string) => storage()?.getItem(LOCAL_CONSENT_PREFIX + userId) === LEGAL_VERSION;

export const getLegalConsent = (user: UserProfile | null | undefined): LegalConsentRecord | null => {
  const consent = (user?.settings as any)?.legalConsent;
  return consent && typeof consent === 'object' ? (consent as LegalConsentRecord) : null;
};

/** Kayıtlı (misafir olmayan) kullanıcı güncel metinleri onaylamamışsa true. */
export const needsLegalConsent = (user: UserProfile | null | undefined, isGuest: boolean): boolean => {
  if (!user || isGuest || user.isGuest || !user.id) return false;
  if (hasAcceptedCurrentLegal(user.settings)) {
    rememberLocalConsent(user.id);
    return false;
  }
  return !hasLocalConsent(user.id);
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
): Promise<UserProfile | null> => {
  const res = await fetch(`${apiBaseUrl}/auth/legal-consent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ version: LEGAL_VERSION, method }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Onay kaydedilemedi. Lütfen tekrar dene.');
  return (data?.user as UserProfile) || null;
};
