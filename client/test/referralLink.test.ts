import { captureReferralLink, getPendingReferral, clearPendingReferral } from '../src/utils/referralLink';
const token = 'a'.repeat(48), other = 'b'.repeat(48);
describe('Davet bağlantısının giriş boyunca korunması', () => {
  let values: Map<string, string>;
  beforeEach(() => {
    values = new Map();
    (globalThis as any).window = {
      location: { href: 'https://tavriko-app.vercel.app/app' },
      localStorage: {
        getItem: (k: string) => values.get(k) || null,
        setItem: (k: string, v: string) => values.set(k, v),
        removeItem: (k: string) => values.delete(k),
      },
      history: { state: null, replaceState: vi.fn() },
    };
    clearPendingReferral();
  });
  afterEach(() => { vi.restoreAllMocks(); delete (globalThis as any).window; });
  it('remembers the invite through OAuth URLs and reload-like reads', () => {
    expect(captureReferralLink(`https://tavriko-app.vercel.app/app?invite=${token}`)).toBe(token);
    expect(captureReferralLink('https://tavriko-app.vercel.app/app?code=oauth')).toBe(token);
    expect(getPendingReferral()).toBe(token);
  });
  it('accepts a newer explicit invite but no arbitrary URL values', () => {
    captureReferralLink(`https://tavriko-app.vercel.app/app?invite=${token}`);
    expect(captureReferralLink('https://tavriko-app.vercel.app/app?invite=<script>')).toBe(token);
    expect(captureReferralLink(`https://tavriko-app.vercel.app/app?invite=${other}`)).toBe(other);
  });
  it('clears the saved token and only removes invite from the URL', () => {
    (globalThis as any).window.location.href = `https://tavriko-app.vercel.app/app?screen=friends&invite=${token}`;
    captureReferralLink();
    clearPendingReferral();
    expect(getPendingReferral()).toBeNull();
    expect(window.history.replaceState).toHaveBeenCalledWith(null, '', 'https://tavriko-app.vercel.app/app?screen=friends');
  });
  it('expires the pending link after seven days', () => {
    captureReferralLink(`https://tavriko-app.vercel.app/app?invite=${token}`);
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 8 * 86400000);
    expect(getPendingReferral()).toBeNull();
  });
  it('is safe with blocked browser storage', () => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
    expect(captureReferralLink(`https://tavriko-app.vercel.app/app?invite=${token}`)).toBe(token);
    clearPendingReferral();
    expect(getPendingReferral()).toBeNull();
  });
  it('rejects corrupted saved values and is safe without a window', () => {
    values.set('tavriko_pending_referral_v1', '{"token":42,"at":0}');
    expect(getPendingReferral()).toBeNull();
    delete (globalThis as any).window;
    expect(captureReferralLink()).toBeNull();
  });
});
