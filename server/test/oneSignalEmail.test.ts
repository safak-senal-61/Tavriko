import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import authRoutes from '../src/routes/authRoutes';
import { logger } from '../src/utils/logger';
import { getOneSignalEmailConfig, sendOneSignalPasswordResetEmail } from '../src/services/oneSignalEmail';

const mocks = vi.hoisted(() => ({ issue: vi.fn(), confirm: vi.fn(), waitUntil: vi.fn() }));
vi.mock('../src/db/prismaClient', () => ({ db: { rawClient: {} } }));
vi.mock('../src/services/passwordReset', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/services/passwordReset')>()),
  issuePasswordReset: mocks.issue,
  confirmPasswordReset: mocks.confirm,
}));
vi.mock('@vercel/functions', () => ({ waitUntil: mocks.waitUntil }));

const appId = 'bce93cc5-2299-4f9d-ae2a-1aa6fc4e3523';
const key = 'test-only-not-a-real-key';
const payload = { email: 'fixture@example.test', code: '004891', validMinutes: 15 };
const transport = vi.fn<typeof fetch>();
const app = express().use(express.json()).use('/auth', authRoutes);

beforeEach(() => {
  vi.stubEnv('ONESIGNAL_APP_ID', appId);
  vi.stubEnv('ONESIGNAL_APP_API_KEY', key);
  vi.stubEnv('VERCEL', undefined);
  vi.stubGlobal('fetch', transport);
  transport.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'message-id' }) } as Response);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe('OneSignal password reset delivery and auth responses', () => {
  it('targets only the registered mailbox and puts the OTP only in the email body', async () => {
    vi.stubEnv('VERCEL', '1');
    mocks.issue.mockResolvedValue(payload);
    const accepted = await request(app).post('/auth/forgot-password').send({ email: '  FIXTURE@example.test  ' });
    expect(accepted.status).toBe(200);
    expect(accepted.headers['cache-control']).toBe('no-store');
    expect(accepted.body).toEqual({ success: true, message: expect.any(String), resendAfterSeconds: 60 });
    expect(JSON.stringify(accepted.body)).not.toMatch(/004891|fixture@example/);
    expect(mocks.issue).toHaveBeenCalledWith(expect.anything(), payload.email, expect.any(String));
    expect(mocks.waitUntil).toHaveBeenCalledOnce();
    await mocks.waitUntil.mock.calls[0][0];
    expect(transport).toHaveBeenCalledOnce();
    const [endpoint, options] = transport.mock.calls[0];
    expect(endpoint).toBe('https://api.onesignal.com/notifications?c=email');
    expect(options?.headers).toMatchObject({ Authorization: `Key ${key}` });
    const email = JSON.parse(String(options?.body));
    expect(email).toMatchObject({ app_id: appId, email_to: [payload.email], include_unsubscribed: true, disable_email_click_tracking: true });
    expect(email.email_subject).not.toContain(payload.code);
    expect(email.email_body).toContain(payload.code);
    expect(email.email_body).toContain('15 dakika');
    expect(email).not.toHaveProperty('included_segments');
    expect(email).not.toHaveProperty('email_bcc');

    mocks.issue.mockResolvedValue(null);
    const unknown = await request(app).post('/auth/forgot-password').send({ email: 'unknown@example.test' });
    expect(unknown.body).toEqual(accepted.body);
    expect(transport).toHaveBeenCalledOnce();
  });

  it('fails closed when OneSignal config is missing and rejects malformed request bodies', async () => {
    vi.stubEnv('ONESIGNAL_APP_API_KEY', undefined);
    expect(await request(app).post('/auth/forgot-password').send({ email: payload.email })).toHaveProperty('status', 503);
    expect(await request(app).post('/auth/forgot-password').send({ email: {} })).toHaveProperty('status', 400);
    expect(mocks.issue).not.toHaveBeenCalled();
    expect(transport).not.toHaveBeenCalled();
  });

  it('logs a safe warning for provider rejection without logging its response or credentials', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    transport.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: '', errors: payload }) } as Response);
    transport.mockRejectedValueOnce(new Error(`${key} ${payload.code}`));
    await sendOneSignalPasswordResetEmail(getOneSignalEmailConfig()!, payload);
    await sendOneSignalPasswordResetEmail(getOneSignalEmailConfig()!, payload);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/fixture@example|004891|test-only-not-a-real-key/);
  });

  it('validates the six-digit format, handles rejected codes and never issues an auth session', async () => {
    const input = { email: payload.email, code: payload.code, newPassword: 'TestPassword1!' };
    expect(await request(app).post('/auth/reset-password').send({ ...input, code: 'abcd01' })).toHaveProperty('status', 400);
    expect(await request(app).post('/auth/reset-password').send({ ...input, newPassword: '😀'.repeat(20) })).toHaveProperty('status', 400);
    expect(mocks.confirm).not.toHaveBeenCalled();
    mocks.confirm.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    expect(await request(app).post('/auth/reset-password').send(input)).toHaveProperty('status', 400);
    const success = await request(app).post('/auth/reset-password').send(input);
    expect(success.status).toBe(200);
    expect(success.body).toEqual({ success: true, message: 'Şifreniz başarıyla yenilendi!' });
    expect(mocks.confirm).toHaveBeenLastCalledWith(expect.anything(), {
      identifier: payload.email, code: payload.code, password: input.newPassword,
    }, expect.any(String));
  });
});
