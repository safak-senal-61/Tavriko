import { LEGAL_VERSION, UserProfile, hasAcceptedCurrentLegal, LegalConsentRecord } from '@trivia/shared';
import { getLegalVersion, refreshLegalVersion } from '../services/legalVersion';

/**
 * Yasal metin onayı yardımcıları.
 * Onay kaynağı, sunucunun kullanıcı profiline yazdığı settings.legalConsent alanıdır.
 *
 * Sürüm karşılaştırmaları varsayılan olarak paketteki LEGAL_VERSION ile yapılır;
 * çağıran taraf sunucudan okunan güncel sürümü geçebilir (eski paketlerde
 * sürüm kayması nedeniyle onay ekranının kilitlenmesini önler).
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
  storage()?.setItem(GOOGLE_ACK_KEY, JSON.stringify({ version: getLegalVersion(), at: Date.now() }));
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
    return parsed?.version === getLegalVersion() && Date.now() - Number(parsed?.at || 0) < GOOGLE_ACK_MAX_AGE_MS;
  } catch {
    return false;
  }
};

export const getLegalConsent = (user: UserProfile | null | undefined) => user?.settings?.legalConsent ?? null;

/** Profilin kısmi/bayat bir yanıtı, aynı hesabın güncel onayını silemez. */
export function preserveLegalConsent(previous: UserProfile | null, incoming: UserProfile | null, version: string = LEGAL_VERSION) {
  if (!incoming || previous?.id !== incoming.id || !hasAcceptedCurrentLegal(previous.settings, version) ||
    hasAcceptedCurrentLegal(incoming.settings, version)) return incoming;
  return { ...incoming, settings: { ...incoming.settings, legalConsent: previous.settings?.legalConsent } };
}

/** Kayıtlı (misafir olmayan) kullanıcı güncel metinleri onaylamamışsa true. */
export const needsLegalConsent = (user: UserProfile | null | undefined, isGuest: boolean, version: string = LEGAL_VERSION): boolean => {
  if (!user || isGuest || user.isGuest || !user.id) return false;
  return !hasAcceptedCurrentLegal(user.settings, version);
};

/** Daha önce başka bir sürümü onaylamış kullanıcılar için "güncelledik" metni gösterilir. */
export const isLegalUpdate = (user: UserProfile | null | undefined, version: string = LEGAL_VERSION) => {
  const consent = getLegalConsent(user);
  return Boolean(consent && consent.version && consent.version !== version);
};

/**
 * Onayı sunucuya kaydeder.
 * Sunucu sürüm uyuşmazlığı (409) bildirirse sürüm yeniden okunur ve hata,
 * kullanıcının bir sonraki denemede güncel sürümü göndermesi için iletilir.
 */
export const submitLegalConsent = async (
  apiBaseUrl: string,
  token: string,
  method: LegalConsentRecord['method'],
  version: string = getLegalVersion()
): Promise<UserProfile> => {
  const res = await fetch(`${apiBaseUrl}/auth/legal-consent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ version, method }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 409) {
    await refreshLegalVersion(apiBaseUrl);
    throw new Error('Yasal metinler güncellendi. Onay ekranı yenileniyor, lütfen tekrar onayla.');
  }
  if (!res.ok) throw new Error(data?.error || 'Onay kaydedilemedi. Lütfen tekrar dene.');
  if (!data?.user?.id || !hasAcceptedCurrentLegal(data.user.settings, version)) {
    throw new Error('Onay kaydedilemedi. Lütfen tekrar dene.');
  }
  return data.user as UserProfile;
};
