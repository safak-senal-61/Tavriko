import { LEGAL_VERSION, type UserProfile } from '@trivia/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { needsLegalConsent, preserveLegalConsent, submitLegalConsent } from '../src/utils/legalConsent';

const user = { id: 'player', settings: { onlineStatusVisible: true } } as UserProfile;
const receipt = { version: LEGAL_VERSION, acceptedAt: '2026-11-23T00:00:00.000Z', documents: [], method: 'in_app' } as const;
const accepted = { ...user, settings: { ...user.settings, legalConsent: { ...receipt, documents: [] } } };

afterEach(() => vi.unstubAllGlobals());

describe('account legal consent', () => {
  it('keeps an approved receipt after a partial or stale profile update', () => {
    for (const settings of [undefined, { onlineStatusVisible: false }, {
      legalConsent: { ...receipt, version: 'old', documents: [] },
    }]) {
      const merged = preserveLegalConsent(accepted, { ...user, settings });
      expect(merged?.settings?.legalConsent).toEqual(receipt);
      expect(needsLegalConsent(merged, false)).toBe(false);
    }
  });

  it('does not transfer approval to a different account or bypass new terms', () => {
    expect(needsLegalConsent(preserveLegalConsent(accepted, { ...user, id: 'other' }), false)).toBe(true);
    expect(preserveLegalConsent(accepted, null)).toBeNull();
    expect(needsLegalConsent({ ...accepted, settings: { legalConsent: { ...receipt, version: 'old', documents: [] } } }, false)).toBe(true);
    expect(needsLegalConsent(user, true)).toBe(false);
  });

  it('compares consent against the version fetched from the server', () => {
    const serverReceipt = { ...receipt, version: '2026-12-01', documents: [] };
    const onServerVersion = { ...user, settings: { ...user.settings, legalConsent: serverReceipt } };
    // Paket sürümü eski olsa da sunucunun sürümü onaylanmışsa ekran açılmaz.
    expect(needsLegalConsent(onServerVersion, false, '2026-12-01')).toBe(false);
    expect(needsLegalConsent(onServerVersion, false, LEGAL_VERSION)).toBe(true);
  });

  it('posts the version it was given so a stale bundle cannot loop on 409', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ user: { ...accepted, settings: { ...accepted.settings, legalConsent: { ...receipt, version: '2026-12-01', documents: [] } } } }) });
    vi.stubGlobal('fetch', fetchMock);
    await submitLegalConsent('https://example.invalid/api', 'fixture', 'in_app', '2026-12-01');
    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as any).body)).version).toBe('2026-12-01');
  });

  it('only accepts a successful response that contains the current receipt', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Tekrar dene' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ user }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ user: accepted }) }));
    const submit = () => submitLegalConsent('https://example.invalid/api', 'fixture', 'in_app');
    await expect(submit()).rejects.toThrow('Tekrar dene');
    await expect(submit()).rejects.toThrow('Onay kaydedilemedi');
    await expect(submit()).resolves.toEqual(accepted);
  });
});
