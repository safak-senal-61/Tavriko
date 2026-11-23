import request from 'supertest';
import jwt from 'jsonwebtoken';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createJokerApp } from '../src/jokerApp';
import { readPracticeJoker, sealPracticeJoker } from '../src/services/practiceJokerProof';

const { consume } = vi.hoisted(() => ({ consume: vi.fn() }));
vi.mock('../src/services/quizJokers', () => ({ consumeQuizJoker: consume }));
vi.mock('../src/db/prismaClient', () => { throw new Error('Fast joker route loaded the main question bank'); });

const secret = 'joker-test-secret-only';
const scope = { userId: 'player', sessionId: 'sess_' + '1'.repeat(32), questionId: 'question' };
const options = [{ id: 'x', text: 'Hidden correct choice' }, { id: 'y', text: 'Wrong choice' }];
const question = { options, correctOptionId: 'x' };

afterEach(() => { vi.unstubAllEnvs(); consume.mockReset(); });

describe('fast joker app', () => {
  it('keeps the issued answer private and binds its ticket to the account, session and question', () => {
    const deadline = Date.now() + 5000;
    const proof = sealPracticeJoker(scope, question, deadline, secret);
    expect(proof).not.toContain('Hidden correct choice');
    expect(sealPracticeJoker(scope, question, deadline, secret)).not.toBe(proof);
    expect(readPracticeJoker(proof, scope, secret)).toEqual({ deadline, question });
    for (const field of Object.keys(scope)) expect(readPracticeJoker(proof, { ...scope, [field]: 'different' }, secret)).toBeNull();
    const changed = `${proof.slice(0, 12)}${proof[12] === 'A' ? 'B' : 'A'}${proof.slice(13)}`;
    expect(readPracticeJoker(changed, scope, secret)).toBeNull();
    expect(readPracticeJoker(proof, scope, 'wrong key')).toBeNull();
  });

  it('rejects missing authentication and outdated tickets before the wallet is touched', async () => {
    vi.stubEnv('JWT_SECRET', secret);
    const app = request(createJokerApp());
    const body = { sessionId: scope.sessionId, questionId: scope.questionId, jokerId: 'joker_eliminate',
      proof: sealPracticeJoker(scope, question, Date.now() - 5000, secret) };
    const auth = `Bearer ${jwt.sign({ userId: scope.userId }, secret)}`;
    await app.post('/api/questions/practice/joker').send(body).expect(401);
    await app.post('/api/questions/practice/joker').set('Authorization', auth).send(body).expect(409);
    await app.post('/api/internal/room-joker').send({}).expect(403);
    expect(consume).not.toHaveBeenCalled();
  });

  it('uses only the verified snapshot and performs one wallet operation', async () => {
    vi.stubEnv('JWT_SECRET', secret);
    consume.mockResolvedValue({ status: 'applied', effect: { eliminated: ['y'] } });
    const deadline = Date.now() + 5000;
    const res = await request(createJokerApp()).post('/api/questions/practice/joker')
      .set('Authorization', `Bearer ${jwt.sign({ userId: scope.userId }, secret)}`)
      .send({ ...scope, userId: 'ignored', questionId: scope.questionId, jokerId: 'joker_eliminate', options: [],
        proof: sealPracticeJoker(scope, question, deadline, secret) }).expect(200);
    expect(consume).toHaveBeenCalledExactlyOnceWith(scope, 'joker_eliminate', question, deadline);
    expect(res.body).toEqual({ eliminated: ['y'] });
    expect(res.headers['x-tavriko-joker-path']).toBe('fast');
    expect(res.headers['server-timing']).toMatch(/^joker-wallet;dur=\d+$/);
  });
});
