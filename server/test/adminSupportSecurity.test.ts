import { randomUUID, scryptSync } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createAdminAccountsRouter } from '../src/routes/adminAccountsRoutes';
import { createPortalLoginHandler } from '../src/routes/logRoutes';
import { createSupportRouter } from '../src/routes/supportRoutes';
import { otpCode, parseOtpSecret, consumeOtp } from '../src/services/portalOtp';
import { readSignupCohorts } from '../src/services/playerAnalytics';
import { getAdminSessionFromRequest, requireAdminAuth } from '../src/middleware/auth';
import { createPortalSecurityRouter, portalLogout } from '../src/routes/portalSecurityRoutes';
import { changeDuelConsent, readDuelFunnel, recordDuelMilestone } from '../src/services/duelFunnel';

const playerJwtSecret = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET;
const fixtureFactor = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const dbUrl = process.env.ADMIN_OPERATIONS_TEST_DATABASE_URL;
if (dbUrl && (!['127.0.0.1', 'localhost'].includes(new URL(dbUrl).hostname) || !new URL(dbUrl).pathname.endsWith('_qa'))) {
  throw new Error('Use an isolated local *_qa database only.');
}

it('implements the RFC 6238 SHA-1 reference and rejects invalid enrollment input', () => {
  expect(otpCode(parseOtpSecret(fixtureFactor)!, 1)).toBe('287082');
  expect(parseOtpSecret('invalid')).toBeNull();
});

describe.skipIf(!dbUrl)('support, MFA and cohort flows on PostgreSQL', () => {
  const run = randomUUID().slice(0, 10);
  const player = `usr_case_${run}`;
  const other = `${player}_other`;
  const owner = `owner-${run}@example.test`;
  const support = `support-${run}@example.test`;
  const moderator = `moderator-${run}@example.test`;
  const approver = `approver-${run}@example.test`;
  const password = 'fixture-only-staff-password';
  const cases = '/api/admin/accounts/cases';
  const risk = '/api/admin/accounts/risk';
  const reason = 'İç inceleme gerekçesi yalnız panelde kalır.';
  const cookies = new Map<string,string>();
  let client: PrismaClient;
  let app: express.Express;
  const token = (id: string) => `Bearer ${jwt.sign({ userId: id }, playerJwtSecret!, { expiresIn: '5m' })}`;
  const asPlayer = (id: string) => request(app).get('/api/support').set('Authorization', token(id));
  const playerPost = (id: string, body: object) => request(app).post('/api/support').set('Authorization', token(id)).send(body);
  const get = (path: string, actor: string) => request(app).get(path).set('Cookie', cookies.get(actor)!);
  const post = (path: string, actor: string, body: object) => request(app).post(path).set('Cookie', cookies.get(actor)!)
    .set('Host', 'localhost').set('Origin', 'http://localhost').send(body);
  const login = (email: string, code?: string) => request(app).post('/api/portal/login').send({ email, password, code });

  beforeAll(async () => {
    vi.stubEnv('JWT_SECRET', 'fixture-only-portal-secret');
    vi.stubEnv('PORTAL_ADMIN_EMAIL', owner);
    vi.stubEnv('PORTAL_ADMIN_PASSWORD', password);
    vi.stubEnv('PORTAL_TOTP_REQUIRED', '');
    vi.stubEnv('PORTAL_TOTP_SECRETS_JSON', '');
    vi.stubEnv('PORTAL_STAFF_JSON', JSON.stringify([[support,'support'], [moderator,'moderator'], [approver,'approver']].map(([email,role]) => {
      const salt = Buffer.alloc(16,1);
      return { email, role, passwordHash: `${salt.toString('hex')}:${scryptSync(password,salt,64).toString('hex')}` };
    })));
    client = new PrismaClient({ datasourceUrl: dbUrl });
    for (const id of [player, other]) await client.user.create({ data: { id, username: id, email: `${id}@example.test`, displayName: id, friendCode:id } });
    app = express().use(express.json());
    app.post('/api/portal/login', createPortalLoginHandler(client));
    app.get('/owner-only', (req,res,next) => { void requireAdminAuth(req,res,next,client); }, (_req,res) => res.sendStatus(204));
    app.get('/staff-only', async (req,res) => res.sendStatus(await getAdminSessionFromRequest(req,client) ? 204 : 401));
    app.post('/logout', portalLogout(client));
    app.use('/security', createPortalSecurityRouter(client));
    app.use('/api/support', createSupportRouter(client)).use(createAdminAccountsRouter(client));
    for (const email of [owner,support,moderator,approver]) {
      const response = await login(email);
      expect(response.status).toBe(200);
      cookies.set(email,response.headers['set-cookie'][0].split(';')[0]);
    }
  });

  afterAll(async () => {
    if (client) {
      await client.portalOtpState.deleteMany({ where: { email: { contains: run } } });
      await client.portalSession.deleteMany({ where: { email: { contains: run } } });
      await client.adminRiskAlert.deleteMany({ where: { actor: { contains: run } } });
      await client.adminCompensation.deleteMany({ where: { accountId: { startsWith: player } } });
      await client.adminAccountEvent.deleteMany({ where: { accountId: { startsWith: player } } });
      await client.matchHistory.deleteMany({ where: { userId: { startsWith: player } } });
      await client.user.deleteMany({ where: { id: { startsWith: player } } });
      await client.$disconnect();
    }
    vi.unstubAllEnvs();
  });

  it('keeps case ownership and internal notes private; assigns, audits and returns a resolution', async () => {
    const created = await playerPost(player,{kind:'support',subject:'Eksik maç sonucu',message:'Son maçımın sonucunu göremiyorum.'});
    expect(created.status).toBe(201);
    const id = created.body.id;
    expect((await asPlayer(other)).body.cases).toEqual([]);
    expect((await get(cases,moderator)).body.items.some((item: {id:string})=>item.id===id)).toBe(false);
    expect((await get(cases,approver)).status).toBe(403);
    const active = {revision:0,assignee:support,status:'in_progress',reason};
    expect((await post(`${cases}/${id}`,support,active)).status).toBe(200);
    expect((await post(`${cases}/${id}`,support,active)).status).toBe(409);
    expect((await get(`${cases}?owner=mine&account=${player}`,support)).body.items).toEqual([expect.objectContaining({id,status:'in_progress'})]);
    const resolution = 'Maç kaydınız incelendi ve doğrulandı.';
    expect((await post(`${cases}/${id}`,support,{...active,revision:1,status:'resolved',resolution})).status).toBe(200);
    const visible = (await asPlayer(player)).body.cases;
    expect(visible).toEqual([expect.objectContaining({id,resolution,status:'resolved'})]);
    expect(JSON.stringify(visible)).not.toContain(reason);
    expect(JSON.stringify(visible)).not.toContain(support);
    expect((await client.adminAccountEvent.findMany({where:{accountId:player}})).map(e=>e.action).sort())
      .toEqual(['case_opened','case_updated','case_updated']);
  });

  it('binds an appeal to the correct account and requires independent resolution', async () => {
    const moderation = await post(`/api/admin/accounts/${player}/moderation`,moderator,{action:'warn',reason});
    const payload = {kind:'appeal',moderationId:moderation.body.eventId,message:'Uyarının yeniden değerlendirilmesini istiyorum.'};
    const eligible = (await asPlayer(player)).body.events;
    expect(eligible).toEqual([expect.objectContaining({id:payload.moderationId,action:'warn'})]);
    expect(JSON.stringify(eligible)).not.toContain(reason);
    expect((await playerPost(other,payload)).status).toBe(404);
    const opened = await playerPost(player,payload);
    expect(opened.status).toBe(201);
    expect((await playerPost(player,payload)).status).toBe(409);
    const path = `${cases}/${opened.body.id}`;
    const resolution = {revision:0,status:'resolved',reason,resolution:'İtirazınız bağımsız olarak incelendi.'};
    expect((await post(path,support,{...resolution,assignee:support})).status).toBe(404);
    expect((await post(path,moderator,{...resolution,assignee:moderator})).status).toBe(403);
    expect((await post(path,owner,{...resolution,assignee:owner})).status).toBe(200);
  });

  it('deduplicates a burst across accounts and prevents the actor from reviewing it', async () => {
    const first = {id:randomUUID(),kind:'coins',amount:5,reason};
    const results = await Promise.all([first,first,...Array.from({length:5},()=>({...first,id:randomUUID()}))]
      .map((body,i)=>post(`/api/admin/accounts/${i===0||i===1||i%2===0?player:other}/compensations`,owner,body)));
    expect(results.every(r=>r.status===200)).toBe(true);
    const list = (await get(risk,approver)).body.items.filter((alert: {actor:string})=>alert.actor===owner);
    expect(list).toHaveLength(1);
    expect(list[0].count).toBe(5);
    expect((await get(`${risk}/${list[0].id}/grants`,approver)).body.items).toHaveLength(5);
    expect((await post(`${risk}/${list[0].id}`,owner,{reason})).status).toBe(403);
    expect((await post(`${risk}/${list[0].id}`,approver,{reason})).status).toBe(200);
    expect((await post(`${risk}/${list[0].id}`,approver,{reason})).status).toBe(409);
    expect((await get(`${risk}?queue=reviewed`,approver)).body.items).toEqual(expect.arrayContaining([
      expect.objectContaining({id:list[0].id,reviewer:approver,reason}),
    ]));
  });

  it('requires the enrolled factor, invalidates old tokens and consumes each step once', async () => {
    vi.stubEnv('PORTAL_TOTP_SECRETS_JSON', JSON.stringify({[owner]:fixtureFactor}));
    vi.stubEnv('PORTAL_TOTP_REQUIRED', 'true');
    try {
      expect((await get('/owner-only',owner)).status).toBe(401);
      expect((await request(app).get('/owner-only').auth(owner,password)).status).toBe(401);
      expect((await login(support)).status).toBe(503);
      expect((await login(owner)).body.otpRequired).toBe(true);
      const code = otpCode(parseOtpSecret(fixtureFactor)!,Math.floor(Date.now()/30_000));
      const results = await Promise.all([login(owner,code),login(owner,code)]);
      expect(results.map(r=>r.status).sort()).toEqual([200,401]);
      const cookie = results.find(r=>r.status===200)!.headers['set-cookie'][0].split(';')[0];
      expect((await request(app).get('/owner-only').set('Cookie',cookie)).status).toBe(204);
      for(let i=0;i<6;i++) await consumeOtp(client, owner, parseOtpSecret(fixtureFactor)!, code);
      expect(await consumeOtp(client,owner,parseOtpSecret(fixtureFactor)!,code)).toBe('limited');
    } finally {
      vi.stubEnv('PORTAL_TOTP_SECRETS_JSON','');vi.stubEnv('PORTAL_TOTP_REQUIRED','');
    }
  });

  it('uses only verified match rows and excludes immature cohorts from their denominators', async () => {
    const now = new Date('2032-05-18T12:00:00Z');
    const group = [`${player}_cover`, `${player}_yes`, `${player}_no`, `${player}_young`];
    const dates = ['2032-05-01','2032-05-10','2032-05-10','2032-05-16'];
    for (let i=0;i<group.length;i++) await client.user.create({data:{
      id:group[i],username:group[i],friendCode:group[i],email:`${group[i]}@example.test`,displayName:'QA',createdAt:new Date(`${dates[i]}T08:00:00Z`),
    }});
    const records = [[0,'2032-05-01T09:00:00Z',true],[1,'2032-05-12T01:00:00+03:00',true],
      [1,'2032-05-17T10:00:00Z',true],[2,'2032-05-11T10:00:00Z',false],[3,'2032-05-17T10:00:00Z',true]] as const;
    for (const [i,played,tracked] of records) await client.matchHistory.create({ data:{
      id:`${tracked?'tracked':'legacy'}_${randomUUID()}`,userId:group[i],roomCode:'QA-C',mode:'duel',categoryId:'general_culture',
      rankingsJson:[],playedAt:new Date(played),
    }});
    const result = await readSignupCohorts(client,now);
    expect(result.cohorts.find(c=>c.day==='2032-05-10')).toEqual({day:'2032-05-10',signups:2,firstMatch:1,d1:0,d7:1});
    expect(result.cohorts.find(c=>c.day==='2032-05-16')).toEqual({day:'2032-05-16',signups:1,firstMatch:null,d1:1,d7:null});
    expect(result.d7).toEqual({signedUp:2,played:1,rate:0.5});
  });

  it('escalates unanswered cases, returns requested info to the staff queue and guards message visibility', async () => {
    const opened = await playerPost(other, { kind: 'support', subject:'Konuşma testi', message:'İlk mesaj için bir test.' });
    const id = opened.body.id;
    await client.supportCase.update({ where: { id }, data: { createdAt: new Date(Date.now()-25*3_600_000) } });
    expect((await get(`${cases}?queue=overdue`,owner)).body.items).toEqual(expect.arrayContaining([expect.objectContaining({id,late:true})]));
    expect((await get(`${cases}?queue=overdue`,support)).status).toBe(403);
    expect((await post(`${cases}/${id}`,support,{revision:0,assignee:support,status:'in_progress',reason})).status).toBe(200);
    expect((await get(`${cases}?queue=overdue`,owner)).body.items).toEqual(expect.arrayContaining([expect.objectContaining({id})]));
    const path = `${cases}/${id}/replies`;
    const playerPath = `/api/support/${id}/replies`;
    expect((await post(path,support,{revision:1,body:'Oda kodunu paylaşır mısınız?',ask:true})).status).toBe(201);
    expect((await get(`${cases}?queue=overdue&account=${other}`,owner)).body.items).toEqual([]);
    expect((await get(`${cases}?queue=waiting`,support)).body.items).toEqual(expect.arrayContaining([expect.objectContaining({id})]));
    expect((await request(app).get(playerPath).set('Authorization',token(player))).status).toBe(404);
    const thread = (await request(app).get(playerPath).set('Authorization',token(other))).body;
    expect(thread).toMatchObject({ waitingForPlayer:true, revision:2, items:[{sender:'staff',body:'Oda kodunu paylaşır mısınız?'}] });
    expect(JSON.stringify(thread)).not.toContain(support);
    const reply = {revision:2,body:'Oda kodum QA15.'};
    expect((await request(app).post(playerPath).set('Authorization',token(other)).send(reply)).status).toBe(201);
    expect((await request(app).post(playerPath).set('Authorization',token(other)).send(reply)).status).toBe(409);
    expect((await get(`${cases}?queue=active`,support)).body.items).toEqual(expect.arrayContaining([expect.objectContaining({id,waitingForPlayer:false})]));
    expect((await get(path,support)).body.items.map((entry: {sender:string})=>entry.sender)).toEqual(['staff','player']);
  });

  it('revokes only the selected portal session and rejects cross-origin or unauthorized requests', async () => {
    const fresh = await login(support);
    const second = fresh.headers['set-cookie'][0].split(';')[0];
    const ownerSessions = (await get('/security/sessions?scope=team',owner)).body.items;
    const target = ownerSessions.find((row: {email:string;id:string}) => row.email===support &&
      row.id!==JSON.parse(Buffer.from(cookies.get(support)!.split('.')[1],'base64url').toString()).jti);
    expect(target).toBeTruthy();
    const path = `/security/sessions/${target.id}/revoke`;
    expect((await get('/security/sessions?scope=team',support)).status).toBe(403);
    expect((await post(path,moderator,{})).status).toBe(404);
    expect((await request(app).post(path).set('Cookie',cookies.get(owner)!).set('Origin','https://other.test').send({})).status).toBe(403);
    expect((await request(app).get('/staff-only').set('Cookie',second)).status).toBe(204);
    expect((await post(path,owner,{})).status).toBe(200);
    expect((await request(app).get('/staff-only').set('Cookie',second)).status).toBe(401);
    expect((await get('/staff-only',support)).status).toBe(204);
    expect((await post('/logout',support,{})).status).toBe(200);
    expect((await get('/staff-only',support)).status).toBe(401);
  });

  it('counts only mature opted-in signups and a completion from the same verified match', async () => {
    vi.stubEnv('DUEL_FUNNEL_START_AT','2034-05-01T00:00:00Z');
    const date = (value: string) => new Date(`2034-05-${value}:00:00Z`);
    const names = ['complete','other_room','declined','new','no_click'].map(key=>`${player}_${key}`);
    for (const [i,id] of names.entries()) await client.user.create({ data: {
      id, username:id, email:`${id}@example.test`, displayName:id, friendCode:id, createdAt:date(i===3?'09T12':'02T12'),
    } });
    for (const [i,id] of names.entries()) {
      const day = i===3?'09':'02';
      if (i!==2) await changeDuelConsent(client,id,'enroll',date(`${day}T13`));
      if (i!==4) await changeDuelConsent(client,id,'select',date(`${day}T14`));
    }
    const room = randomUUID(), wrong = randomUUID();
    for (const id of names.slice(0,3)) await client.$transaction(async tx => {
      await recordDuelMilestone(tx,'matched',room,[id],date('02T15'));
      await recordDuelMilestone(tx,'completed',id===names[0]?room:wrong,[id],date('02T16'));
    });
    expect(await readDuelFunnel(client,date('12T12'))).toEqual({ coverageStart:'2034-05-01T00:00:00.000Z', registered:3,selected:2,matched:2,completed:1 });
    await changeDuelConsent(client,names[0],'withdraw',date('12T12'));
    expect(await readDuelFunnel(client,date('12T12'))).toMatchObject({registered:2,selected:1,matched:1,completed:0});
    expect(await client.duelFunnelEvent.count({where:{accountId:names[2]}})).toBe(0);
    vi.stubEnv('DUEL_FUNNEL_START_AT','');
  });
});
