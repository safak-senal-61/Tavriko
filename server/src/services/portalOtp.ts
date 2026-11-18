import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

// RFC 6238: six digits, SHA-1, 30 seconds. Keep provisioning out of the browser.
export function parseOtpSecret(secret: unknown): Buffer | null {
  if (typeof secret !== 'string' || !/^[A-Z2-7]{32,64}$/.test(secret)) return null;
  let n = 0, bits = 0;
  const bytes: number[] = [];
  for (const c of secret) {
    n = (n << 5) | 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c);
    bits += 5;
    if (bits >= 8) { bits -= 8; bytes.push((n >> bits) & 255); }
  }
  return (n & ((1 << bits) - 1)) === 0 ? Buffer.from(bytes) : null;
}

export function otpCode(secret: Buffer, step: number) {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64BE(BigInt(step));
  const hash = createHmac('sha1', secret).update(bytes).digest();
  return String((hash.readUInt32BE(hash[19] & 15) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}
export const otpFingerprint = (secret: Buffer) => createHash('sha256').update(secret).digest('hex');

export async function consumeOtp(client: PrismaClient, email: string, secret: Buffer, code: string, now = Date.now()) {
  const window = Math.floor(now / 300_000);
  const step = Math.floor(now / 30_000);
  const factor = otpFingerprint(secret);
  return client.$transaction(async tx => {
    await tx.$executeRaw`INSERT INTO "portal_otp_states" ("email","factor","window","attempts") VALUES (${email},${factor},${window},0) ON CONFLICT DO NOTHING`;
    const [state] = await tx.$queryRaw<{ factor: string; lastStep: number; window: number; attempts: number }[]>`
      SELECT "factor","lastStep","window","attempts" FROM "portal_otp_states" WHERE "email"=${email} FOR UPDATE`;
    const attempts = state.window === window ? state.attempts : 0;
    if (attempts >= 8) return 'limited';
    const lastStep = state.factor === factor ? state.lastStep : -1;
    const matched = [step, step - 1, step + 1].find(t =>
      t > lastStep && timingSafeEqual(Buffer.from(otpCode(secret, t)), Buffer.from(code)));
    await tx.portalOtpState.update({ where: { email }, data: {
      factor, lastStep: matched ?? lastStep, window, attempts: attempts + 1,
    } });
    return matched === undefined ? 'invalid' : 'ok';
  });
}
