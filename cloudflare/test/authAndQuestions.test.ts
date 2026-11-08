import { verifyJwt } from '../src/auth/authenticate';
import { getFallbackQuestions, DEFAULT_QUESTIONS } from '../src/game/defaultQuestions';

describe('Auth & Default Questions', () => {
  it('rejects unsigned guest identity strings', async () => {
    const res = await verifyJwt('guest_local_abc123', 'a'.repeat(32));
    expect(res.isValid).toBe(false);
  });

  it('accepts a valid server-signed guest JWT', async () => {
    const secret = 'test-secret-that-is-at-least-32-characters';
    const encode = (value: unknown) => btoa(unescape(encodeURIComponent(JSON.stringify(value))))
      .replace(/=/g, '').replace(/\\+/g, '-').replace(/\\//g, '_');
    const header = encode({ alg: 'HS256', typ: 'JWT' });
    const payload = encode({
      userId: 'guest_abc123',
      username: 'misafir',
      isGuest: true,
      exp: Math.floor(Date.now() / 1000) + 60,
    });
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const signatureBytes = new Uint8Array(await crypto.subtle.sign(
      'HMAC', key, new TextEncoder().encode(header + '.' + payload)
    ));
    let binary = '';
    signatureBytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    const signature = btoa(binary).replace(/=/g, '').replace(/\\+/g, '-').replace(/\\//g, '_');
    const res = await verifyJwt(header + '.' + payload + '.' + signature, secret);
    expect(res.isValid).toBe(true);
    expect(res.user?.id).toBe('guest_abc123');
    expect(res.user?.isGuest).toBe(true);
  });

  it('rejects expired guest JWTs', async () => {
    const secret = 'test-secret-that-is-at-least-32-characters';
    const encode = (value: unknown) => btoa(unescape(encodeURIComponent(JSON.stringify(value))))
      .replace(/=/g, '').replace(/\\+/g, '-').replace(/\\//g, '_');
    const header = encode({ alg: 'HS256', typ: 'JWT' });
    const payload = encode({
      userId: 'guest_abc123',
      username: 'misafir',
      isGuest: true,
      exp: Math.floor(Date.now() / 1000) - 60,
    });
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const signatureBytes = new Uint8Array(await crypto.subtle.sign(
      'HMAC', key, new TextEncoder().encode(header + '.' + payload)
    ));
    let binary = '';
    signatureBytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    const signature = btoa(binary).replace(/=/g, '').replace(/\\+/g, '-').replace(/\\//g, '_');
    const res = await verifyJwt(header + '.' + payload + '.' + signature, secret);
    expect(res.isValid).toBe(false);
  });

  it('rejects malformed or empty JWTs', async () => {
    const res1 = await verifyJwt('', 'secret');
    expect(res1.isValid).toBe(false);

    const res2 = await verifyJwt('invalid.token', 'secret');
    expect(res2.isValid).toBe(false);
  });

  it('provides rich fallback questions per category', () => {
    const geoQuestions = getFallbackQuestions('geography', 'easy', 3);
    expect(geoQuestions.length).toBe(3);
    expect(geoQuestions[0].options.length).toBe(4);
    expect(geoQuestions[0].correctOptionId).toBeDefined();

    const mixedQuestions = getFallbackQuestions('mixed', 'medium', 5);
    expect(mixedQuestions.length).toBe(5);
  });

  it('ensures all default questions have valid structure', () => {
    expect(DEFAULT_QUESTIONS.length).toBeGreaterThanOrEqual(8);
    for (const q of DEFAULT_QUESTIONS) {
      expect(q.text.length).toBeGreaterThan(5);
      expect(q.options.length).toBe(4);
      const optionIds = q.options.map((o) => o.id);
      expect(optionIds).toContain(q.correctOptionId);
      expect(q.explanation.length).toBeGreaterThan(5);
    }
  });
});
