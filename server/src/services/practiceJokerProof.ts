import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Question } from '@trivia/shared';

export type JokerQuestion = Pick<Question, 'options' | 'correctOptionId'>;
export const practiceSessionPattern = /^sess_[a-f0-9]{32}$/;
export const getJokerSigningSecret = () => process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || '';
type Scope = { userId: string; sessionId: string; questionId: string };

const key = (secret: string) => createHmac('sha256', secret).update('tavriko:practice-joker:v2').digest();
const scopeBytes = ({ userId, sessionId, questionId }: Scope) => Buffer.from(JSON.stringify([userId, sessionId, questionId]));

export function sealPracticeJoker(scope: Scope, question: JokerQuestion, deadline: number, secret: string): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(secret), nonce);
  cipher.setAAD(scopeBytes(scope));
  const data = Buffer.concat([cipher.update(JSON.stringify({ deadline, options: question.options, correctOptionId: question.correctOptionId })), cipher.final()]);
  return `v2.${Buffer.concat([nonce, cipher.getAuthTag(), data]).toString('base64url')}`;
}

export function readPracticeJoker(proof: unknown, scope: Scope, secret: string): { deadline: number; question?: JokerQuestion } | null {
  if (typeof proof !== 'string' || proof.length > 64_000 || !secret) return null;
  if (/^\d{13}\.[a-f0-9]{64}$/.test(proof)) {
    const [deadline, signature] = proof.split('.');
    const expected = createHmac('sha256', secret).update(JSON.stringify(
      ['practice-joker', scope.userId, scope.sessionId, scope.questionId, Number(deadline)],
    )).digest();
    return timingSafeEqual(expected, Buffer.from(signature, 'hex')) ? { deadline: Number(deadline) } : null;
  }
  if (!/^v2\.[A-Za-z0-9_-]+$/.test(proof)) return null;
  try {
    const data = Buffer.from(proof.slice(3), 'base64url');
    const cipher = createDecipheriv('aes-256-gcm', key(secret), data.subarray(0, 12));
    cipher.setAAD(scopeBytes(scope));
    cipher.setAuthTag(data.subarray(12, 28));
    const decoded = JSON.parse(Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString()) as JokerQuestion & { deadline: number };
    if (!Number.isSafeInteger(decoded.deadline) || !Array.isArray(decoded.options) ||
        !decoded.options.some(option => option.id === decoded.correctOptionId)) return null;
    return { deadline: decoded.deadline, question: { options: decoded.options, correctOptionId: decoded.correctOptionId } };
  } catch { return null; }
}
