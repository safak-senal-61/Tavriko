import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdminAccountsRouter, registrationWindow } from '../src/routes/adminAccountsRoutes';
import { ADMIN_SESSION_COOKIE, issueAdminSessionToken } from '../src/middleware/auth';

const prefix = '/api/admin/accounts';
const id = 'usr_fixture';
const email = 'admin-fixture@example.test';
const updatedAt = new Date('2026-11-17T13:05:00.000Z');
const profileChange = { displayName: 'Çağrı Yılmaz', resetAvatar: true, reason: 'support', expectedUpdatedAt: updatedAt.toISOString() };
const cookie = () => `${ADMIN_SESSION_COOKIE}=${issueAdminSessionToken(email)}`;

function fixture() {
  const user = {
    findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(40), updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  };
  const $queryRaw = vi.fn().mockResolvedValue([]);
  const client = { user, $queryRaw };
  const app = express().use(express.json()).use(createAdminAccountsRouter(client as unknown as Parameters<typeof createAdminAccountsRouter>[0]));
  const patch = (payload = profileChange, origin = 'https://test.tavriko.example') => request(app).patch(prefix + '/' + id + '/profile')
    .set('Host', 'test.tavriko.example').set('Origin', origin).set('Cookie', cookie()).send(payload);
  return { app, user, $queryRaw, patch };
}

beforeEach(() => {
  vi.stubEnv('PORTAL_ADMIN_EMAIL', email);
  vi.stubEnv('PORTAL_ADMIN_PASSWORD', 'test-admin-password');
  vi.stubEnv('JWT_SECRET', 'test-accounts-private-jwt');
  vi.stubEnv('INTERNAL_API_SECRET', 'test-accounts-internal');
});
afterEach(() => { vi.unstubAllEnvs(); });

describe('account directory', () => {
  it('rejects guest and service callers without a portal session', async () => {
    const { app, user } = fixture();
    for (const path of [prefix, prefix+'/metrics', prefix+'/'+id]) {
      expect((await request(app).get(path)).status).toBe(401);
      expect((await request(app).get(path).set('x-internal-secret', 'test-accounts-internal')).status).toBe(403);
    }
    const response = await request(app).patch(prefix+'/'+id+'/profile').set('x-internal-secret','test-accounts-internal').send(profileChange);
    expect(response.status).toBe(403);
    expect(user.findMany).not.toHaveBeenCalled();
    expect(user.updateMany).not.toHaveBeenCalled();
  });
  it('limits results and performs literal search, filtering and stable secondary sort', async () => {
    const { app, user } = fixture();
    user.findMany.mockResolvedValue(Array.from({length:21}, (_,i) => ({id:'usr_'+i})));
    const r = await request(app).get(prefix).query({q:'te_st%',filter:'premium',sort:'matches',page:2}).set('Cookie',cookie());
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({page:2,hasNext:true});
    expect(r.body.accounts).toHaveLength(20);
    expect(r.get('cache-control')).toBe('no-store');
    expect(user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip:20,take:21,
      where:{hasPremiumPass:true,OR:[{id:'te_st%'},{username:{contains:'te\\_st\\%',mode:'insensitive'}},{displayName:{contains:'te\\_st\\%',mode:'insensitive'}}]},
      orderBy:[{totalMatches:'desc'},{createdAt:'desc'},{id:'asc'}],
    }));
    const { select } = user.findMany.mock.calls[0][0];
    for (const field of ['email','phone','passwordHash','avatarUrl','googleId']) expect(select).not.toHaveProperty(field);
    expect((await request(app).get(prefix+'?page=50000').set('Cookie',cookie())).status).toBe(400);
  });
  it('limits drill-down fields and strips the avatar address', async () => {
    const { app, user } = fixture();
    const avatarUrl = 'https://avatar.example.test/signed-resource';
    user.findUnique.mockResolvedValueOnce({id,avatarUrl,matches:[]});
    const response = await request(app).get(prefix+'/'+id).set('Cookie',cookie());
    expect(response.body.account).toMatchObject({id,avatarState:'custom'});
    expect(response.text).not.toContain(avatarUrl);
    const { select } = user.findUnique.mock.calls[0][0];
    for (const field of ['email','phone','passwordHash','pushTokens','settings','googleId']) expect(select).not.toHaveProperty(field);
    expect(select.matches).toMatchObject({take:5,select:{playedAt:true,mode:true,score:true}});
    expect((await request(app).get(prefix+'/missing').set('Cookie',cookie())).status).toBe(404);
  });
  it('uses seven Istanbul dates and does not turn unavailable metrics into zero', async () => {
    expect(registrationWindow(new Date('2026-11-18T21:30:00Z'))).toEqual({
      days:['2026-11-13','2026-11-14','2026-11-15','2026-11-16','2026-11-17','2026-11-18','2026-11-19'],
      first:new Date('2026-11-12T21:00:00Z'),
    });
    const { app, $queryRaw } = fixture();
    const recent = registrationWindow(new Date()).days[0];
    $queryRaw.mockResolvedValueOnce([{day:recent,count:5n}]);
    const metrics = await request(app).get(prefix+'/metrics').set('Cookie',cookie());
    expect(metrics.status).toBe(200);
    expect(metrics.body.total).toBe(40);
    expect(metrics.body.days).toHaveLength(7);
    expect(metrics.body.days[0]).toEqual({day:recent,accounts:5});
    expect(metrics.body.days[1].accounts).toBe(0);
    const failure = fixture();
    failure.user.count.mockRejectedValue(new Error('private connection details'));
    const r = await request(failure.app).get(prefix+'/metrics').set('Cookie',cookie());
    expect(r.status).toBe(503);
    expect(r.text).not.toContain('private connection details');
  });
});

describe('profile corrections', () => {
  it('rejects unintended fields, unsafe names, foreign origins and cross-site metadata', async () => {
    const { app, patch, user } = fixture();
    expect((await patch(profileChange,'https://another.example')).status).toBe(403);
    expect((await patch(profileChange).set('Sec-Fetch-Site','cross-site')).status).toBe(403);
    expect((await patch({...profileChange, displayName:'<script>Never</script>'})).status).toBe(400);
    expect((await patch({...profileChange, coins:500} as typeof profileChange)).status).toBe(400);
    expect((await patch({...profileChange, expectedUpdatedAt:'bad'})).status).toBe(400);
    expect((await request(app).patch(prefix+'/'+id+'/profile').set('Cookie',cookie()).send(profileChange)).status).toBe(403);
    expect(user.findUnique).not.toHaveBeenCalled();
    expect(user.updateMany).not.toHaveBeenCalled();
  });
  it('updates only approved profile fields and checks the exact account version', async () => {
    const { patch, user } = fixture();
    user.findUnique.mockResolvedValue({displayName:'Eski Ad',avatarUrl:'av2',updatedAt});
    const r = await patch();
    expect(r.status).toBe(200);
    expect(user.updateMany).toHaveBeenCalledExactlyOnceWith({
      where:{id,updatedAt},data:{displayName:'Çağrı Yılmaz',avatarUrl:'av1'},
    });
  });
  it('rejects no-op edits and concurrent writes; never reports them saved', async () => {
    const { patch, user } = fixture();
    user.findUnique.mockResolvedValueOnce({displayName:profileChange.displayName,avatarUrl:'av1',updatedAt})
      .mockResolvedValueOnce({displayName:'Eski Ad',avatarUrl:'av2',updatedAt:new Date(updatedAt.getTime()+1)})
      .mockResolvedValueOnce({displayName:'Eski Ad',avatarUrl:'av2',updatedAt});
    user.updateMany.mockResolvedValueOnce({count:0});
    expect((await patch()).status).toBe(400);
    expect((await patch()).status).toBe(409);
    expect(user.updateMany).not.toHaveBeenCalled();
    const stale = await patch();
    expect(stale.status).toBe(409);
    expect(stale.body).not.toHaveProperty('ok');
  });
});
