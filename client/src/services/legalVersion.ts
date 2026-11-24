/**
 * Yasal metin sürümü — sunucu ile eşitlenir.
 *
 * Neden gerekli? Uygulama paketindeki (bundle) LEGAL_VERSION, mağazada kurulu
 * eski bir sürümde geride kalabilir. Metinler sunucuda güncellendiğinde bu eski
 * paket, onay isteğinde eski sürümü gönderdiği için sunucu 409 döndürüyor ve
 * kullanıcı onayla dedikçe aynı hata tekrar ediyordu. Artık istemci güncel
 * sürümü /api/legal üzerinden okur; erişilemezse paketteki sürüme düşer.
 */
import { useEffect, useState } from 'react';
import { LEGAL_VERSION } from '@trivia/shared';

export const bundledLegalVersion = LEGAL_VERSION;

let cachedVersion: string | null = null;
let inflight: Promise<string> | null = null;
const listeners = new Set<(version: string) => void>();

const publish = (version: string) => {
  cachedVersion = version;
  listeners.forEach((listener) => listener(version));
};

/** Sunucudaki güncel yasal sürüm. Hata durumunda paket sürümü döner. */
export const fetchLegalVersion = (apiBaseUrl: string, force = false): Promise<string> => {
  if (!force && cachedVersion) return Promise.resolve(cachedVersion);
  if (inflight) return inflight;
  inflight = fetch(`${apiBaseUrl}/legal`, { cache: 'no-store' })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      const version = typeof data?.version === 'string' && data.version ? data.version : bundledLegalVersion;
      publish(version);
      return version;
    })
    .catch(() => cachedVersion || bundledLegalVersion)
    .finally(() => { inflight = null; });
  return inflight;
};

export const getLegalVersion = (): string => cachedVersion || bundledLegalVersion;

/** Sürümü zorla yeniler (ör. sunucu 409 döndürdüğünde). */
export const refreshLegalVersion = (apiBaseUrl: string): Promise<string> => fetchLegalVersion(apiBaseUrl, true);

/** Bileşenlerde güncel sürümü izler; ilk açılışta sunucudan çeker. */
export const useLegalVersion = (apiBaseUrl: string): string => {
  const [version, setVersion] = useState<string>(getLegalVersion());
  useEffect(() => {
    let active = true;
    listeners.add(setVersion);
    void fetchLegalVersion(apiBaseUrl).then((next) => { if (active) setVersion(next); });
    return () => {
      active = false;
      listeners.delete(setVersion);
    };
  }, [apiBaseUrl]);
  return version;
};
