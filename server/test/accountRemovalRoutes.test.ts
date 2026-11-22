import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import authRoutes from '../src/routes/authRoutes';
import { legalRouter } from '../src/routes/legalRoutes';
import { renderAccountRemovalEmail, renderOneSignalAccountRemovalTemplate } from '../src/services/accountRemovalEmail';

const mocks = vi.hoisted(() => ({ issue: vi.fn(), confirm: vi.fn(), forget: vi.fn(), verify: vi.fn(), updateProfile: vi.fn(), waitUntil: vi.fn() }));
vi.mock('../src/db/prismaClient', () => ({
  db: { rawClient: {}, forgetDeletedAccount: mocks.forget, verifyToken: mocks.verify, updateUserProfile: mocks.updateProfile },
}));
vi.mock('../src/services/accountRemoval', async (original) => ({
  ...(await original<typeof import('../src/services/accountRemoval')>()),
  issueAccountRemoval: mocks.issue,
  confirmAccountRemoval: mocks.confirm,
}));
vi.mock('@vercel/functions', () => ({ waitUntil: mocks.waitUntil }));

const app = express().use(express.json()).use('/api/auth', authRoutes).use(legalRouter);
const transport = vi.fn<typeof fetch>();
const appId = 'bce93cc5-2299-4f9d-ae2a-1aa6fc4e3523';
const hostedId = 'cce93cc5-2299-4f9d-ae2a-1aa6fc4e3523';
const id = 'registered-fixture';
const email = 'fixture@example.test';
const code = '004891';
const issued = { status: 'issued', email, code, validMinutes: 15 };
const base = '/api/auth';
const player = { Authorization: 'Bearer fixture-session' };
const payload = () => JSON.parse(String(transport.mock.calls.at(-1)?.[1]?.body));

beforeEach(() => {
  vi.stubEnv('ONESIGNAL_APP_ID', appId);
  vi.stubEnv('ONESIGNAL_APP_API_KEY', 'not-a-real-key');
  vi.stubEnv('ONESIGNAL_ACCOUNT_REMOVAL_TEMPLATE_ID', undefined);
  vi.stubEnv('VERCEL', undefined);
  vi.stubGlobal('fetch', transport);
  transport.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'fixture-message' }) } as Response);
  mocks.verify.mockImplementation((token: string) => token === 'fixture-session' ? { userId: id } : null);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe('account removal pages and endpoints', () => {
  it('presents the public form and links it from the legal index', async () => {
    const page = await request(app).get('/remove-account');
    expect(page.status).toBe(200);
    expect(page.headers).toMatchObject({ 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
    expect(page.text).toContain('autocomplete="one-time-code"');
    expect(page.text).toContain('id="acknowledgement" required');
    expect(page.text).not.toMatch(/data\.code|004891/);
    expect((await request(app).get('/legal')).text).toContain('href="/remove-account"');
  });

  it('returns identical public responses for known and unknown addresses without waiting on delivery', async () => {
    vi.stubEnv('VERCEL', '1');
    let finish!: (result: typeof issued) => void;
    mocks.issue.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }))
      .mockResolvedValueOnce({ status: 'unavailable' })
      .mockResolvedValueOnce({ status: 'cooldown', remaining: 45 });
    const known = await request(app).post(`${base}/request-delete-code`).send({ email: ' FIXTURE@example.test ' });
    expect(known.status).toBe(200);
    expect(known.headers['cache-control']).toBe('no-store');
    expect(known.body).toEqual({ success: true, message: expect.any(String), resendAfterSeconds: 60 });
    expect(JSON.stringify(known.body)).not.toMatch(/004891|fixture@example/);
    expect(transport).not.toHaveBeenCalled();
    const unknown = await request(app).post(`${base}/request-delete-code`).send({ email: 'unknown@example.test' });
    const cooldown = await request(app).post(`${base}/request-delete-code`).send({ email });
    expect(unknown.body).toEqual(known.body);
    expect(cooldown.body).toEqual(known.body);
    finish(issued);
    await Promise.all(mocks.waitUntil.mock.calls.map(([job]) => job));
    expect(mocks.issue).toHaveBeenNthCalledWith(1, expect.anything(), { email }, expect.any(String));
    expect(transport).toHaveBeenCalledOnce();
    const { email_body, ...rest } = payload();
    expect(rest).toMatchObject({ app_id: appId, email_to: [email], include_unsubscribed: true, disable_email_click_tracking: true, email_subject: expect.stringContaining('hesap silme') });
    expect(JSON.stringify(rest)).not.toContain(code);
    expect(email_body).toContain(`>${code}</p>`);
    expect(email_body).not.toContain(email);
  });

  it('rejects anonymous, invalid-session and legacy requests without a code', async () => {
    expect((await request(app).post(`${base}/delete-account/request`).send({ email })).status).toBe(401);
    expect((await request(app).post(`${base}/delete-account`).set('Authorization', 'Bearer invalid').send({ code })).status).toBe(401);
    expect((await request(app).post(`${base}/delete-account`).set(player).send({ userId: id })).status).toBe(400);
    expect((await request(app).post(`${base}/confirm-delete`).send({ email, code: 4891 })).status).toBe(400);
    expect(mocks.issue).not.toHaveBeenCalled();
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(mocks.forget).not.toHaveBeenCalled();
  });

  it('prevents changing the registered OTP address through ordinary profile editing', async () => {
    const response = await request(app).put(`${base}/profile`).set(player).send({ email: 'other@example.test' });
    expect(response.status).toBe(400);
    expect(mocks.updateProfile).not.toHaveBeenCalled();
    mocks.updateProfile.mockResolvedValue({ id, email, displayName: 'Updated name' });
    expect((await request(app).put(`${base}/profile`).set(player).send({ displayName: 'Updated name' })).status).toBe(200);
    expect(mocks.updateProfile).toHaveBeenCalledExactlyOnceWith(id, { displayName: 'Updated name' });
  });

  it('uses only the session account, dispatches through an optional hosted template and removes cache only after success', async () => {
    vi.stubEnv('ONESIGNAL_ACCOUNT_REMOVAL_TEMPLATE_ID', hostedId);
    mocks.issue.mockResolvedValueOnce(issued).mockResolvedValueOnce({ status: 'cooldown', remaining: 42 });
    const other = { userId: 'other', email: 'other@example.test' };
    const sent = await request(app).post(`${base}/delete-account/request`).set(player).send(other);
    expect(sent.body).toEqual({ success: true, delivery: 'accepted', resendAfterSeconds: 60 });
    expect(mocks.issue).toHaveBeenCalledWith(expect.anything(), { id }, expect.any(String));
    expect(payload()).toMatchObject({ template_id: hostedId, custom_data: { code, valid_minutes: 15 }, email_to: [email] });
    expect(payload()).not.toHaveProperty('email_body');
    const cooldown = await request(app).post(`${base}/delete-account/request`).set(player).send({});
    expect(cooldown.body).toEqual({ success: true, delivery: 'previous-request', resendAfterSeconds: 42 });
    expect(transport).toHaveBeenCalledOnce();

    mocks.confirm.mockResolvedValueOnce(null).mockResolvedValueOnce({ id, email }).mockResolvedValueOnce(null);
    const wrong = await request(app).post(`${base}/delete-account`).set(player).send({ ...other, code: '000000' });
    expect(wrong.status).toBe(400);
    expect(mocks.forget).not.toHaveBeenCalled();
    const good = await request(app).post(`${base}/delete-account`).set(player).send({ ...other, code });
    expect(good.body).toEqual({ success: true, message: expect.any(String) });
    expect(mocks.confirm).toHaveBeenNthCalledWith(2, expect.anything(), { id }, code, expect.any(String));
    expect(mocks.forget).toHaveBeenCalledExactlyOnceWith(id);
    const again = await request(app).post(`${base}/confirm-delete`).send({ email: ' FIXTURE@example.test ', code });
    expect(again.body).toEqual(wrong.body);
    expect(mocks.confirm).toHaveBeenLastCalledWith(expect.anything(), { email }, code, expect.any(String));
  });

  it('does not claim delivery when the provider rejects the email or is unconfigured', async () => {
    mocks.issue.mockResolvedValue(issued);
    transport.mockResolvedValueOnce({ ok: false, status: 503 } as Response);
    const rejected = await request(app).post(`${base}/delete-account/request`).set(player).send({});
    expect(rejected.status).toBe(503);
    expect(rejected.body).toEqual({ delivery: 'unconfirmed', resendAfterSeconds: 60 });
    vi.stubEnv('ONESIGNAL_APP_API_KEY', undefined);
    expect((await request(app).post(`${base}/request-delete-code`).send({ email })).status).toBe(503);
    expect(mocks.issue).toHaveBeenCalledOnce();
  });

  it('uses the saved dashboard template for the Tavriko app only, with a forced-inline override', async () => {
    vi.stubEnv('ONESIGNAL_APP_ID', 'bb6deff9-50fa-4867-a17d-bf87ab8f2338');
    mocks.issue.mockResolvedValue(issued);
    const result = await request(app).post(`${base}/delete-account/request`).set(player).send({});
    expect(result.status).toBe(200);
    expect(payload()).toMatchObject({ template_id: 'f67ab633-4b54-42b3-a6f0-dbeff95328af', custom_data: { code, valid_minutes: 15 } });
    vi.stubEnv('ONESIGNAL_ACCOUNT_REMOVAL_TEMPLATE_ID', 'inline');
    expect((await request(app).post(`${base}/delete-account/request`).set(player).send({})).status).toBe(200);
    expect(payload()).not.toHaveProperty('template_id');
    expect(payload().email_body).toContain(`>${code}</p>`);
  });

  it('uses a separate template with safe sample values and correct Liquid variables', () => {
    const html = renderAccountRemovalEmail({ code, validMinutes: 15 });
    expect(html.match(/004891/g)).toHaveLength(1);
    expect(html).toContain('<strong>15 dakika</strong>');
    expect(html).not.toMatch(/\b(?:href|src)\s*=/i);
    expect(renderOneSignalAccountRemovalTemplate()).toBe(
      html.replace(code, '{{ message.custom_data.code }}').replace('15 dakika', '{{ message.custom_data.valid_minutes }} dakika'),
    );
    expect(() => renderAccountRemovalEmail({ code: '<b>123', validMinutes: 15 })).toThrow();
  });

  it('rate-limits verification requests before delivery work and separates Vercel client IPs', async () => {
    vi.stubEnv('VERCEL', '1');
    mocks.issue.mockResolvedValue({ status: 'unavailable' });
    const sendFrom = (ip: string) => request(app).post(`${base}/delete-account/request`).set(player).set('X-Forwarded-For', ip).send({});
    for (let i = 0; i < 15; i++) expect((await sendFrom('192.0.2.11')).status).toBe(400);
    const blocked = await sendFrom('192.0.2.11');
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect(mocks.issue).toHaveBeenCalledTimes(15);
    expect(transport).not.toHaveBeenCalled();
    expect((await sendFrom('192.0.2.12')).status).toBe(400);
  });
});
