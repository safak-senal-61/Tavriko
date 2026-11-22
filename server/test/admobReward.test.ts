import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ADMOB_REWARDED_UNIT, AD_ATTEMPT_TTL_MS, matchesAdAttemptTime, verifyAdMobCallback } from '../src/services/admobReward';

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const readKey = async (id: string) => id === '1234' ? publicKey : undefined;
const now = 1_800_000_000_000;
const attemptId = randomUUID();
const signed = `ad_unit=${ADMOB_REWARDED_UNIT}&custom_data=${attemptId}&reward_item=gold%20coins&timestamp=${now}&transaction_id=abc123`;
const callback = (content: string) =>
  `${content}&signature=${sign('sha256', Buffer.from(content), privateKey).toString('base64url')}&key_id=1234`;

describe('AdMob rewarded callback', () => {
  it('verifies raw signed query bytes and reads the opaque attempt ID', async () => {
    await expect(verifyAdMobCallback(callback(signed), readKey, now)).resolves.toEqual({
      attemptId, transactionId: 'abc123', timestamp: now,
    });
  });

  it('rejects changes or ambiguous fields, even if URL decoding would produce the same value', async () => {
    const valid = callback(signed);
    for (const invalid of [
      valid.replace('gold%20coins', 'gold+coins'),
      valid.replace(attemptId, randomUUID()),
      valid.replace('key_id=1234', 'key_id=999'),
      `${valid}&extra=1`,
      callback(`${signed}&transaction_id=another`),
      callback(signed.replace(ADMOB_REWARDED_UNIT, '1234567890')),
      callback(signed.replace(String(now), String(now - 90_000_000))),
      callback(signed.replace(String(now), String(now + 31_000))),
    ]) {
      await expect(verifyAdMobCallback(invalid, readKey, now)).resolves.toBeNull();
    }
  });

  it('distinguishes the signed dashboard verification from an actual reward', async () => {
    await expect(verifyAdMobCallback(callback(signed.replace(`&custom_data=${attemptId}`, '')), readKey, now))
      .resolves.toBe('verification');
  });

  it('binds the ad event to the lifetime of an issued attempt', () => {
    expect(matchesAdAttemptTime(now, now + 50_000)).toBe(true);
    expect(matchesAdAttemptTime(now, now + AD_ATTEMPT_TTL_MS + 1)).toBe(false);
    expect(matchesAdAttemptTime(now, now - 31_000)).toBe(false);
  });
});
