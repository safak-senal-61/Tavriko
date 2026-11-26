import type { Request } from 'express';
import { describe, expect, it } from 'vitest';
import { clientIpAddress, clientOriginAllowed } from '../src/services/polarClient';

const fakeRequest = (headers: Record<string, string>, ip?: string, remoteAddress?: string) => ({
  get: (name: string) => headers[name.toLowerCase()],
  ip,
  socket: { remoteAddress },
}) as unknown as Request;

describe('Polar client metadata', () => {
  it('accepts the configured browser origin and native requests without an origin', () => {
    expect(clientOriginAllowed('https://app.example.test', 'https://app.example.test')).toBe(true);
    expect(clientOriginAllowed(undefined, 'https://app.example.test')).toBe(true);
    expect(clientOriginAllowed('', 'https://app.example.test')).toBe(true);
    expect(clientOriginAllowed('https://evil.example', 'https://app.example.test')).toBe(false);
  });

  it('reads the first forwarded IP and ignores malformed values', () => {
    expect(clientIpAddress(fakeRequest({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }))).toBe('203.0.113.9');
    expect(clientIpAddress(fakeRequest({ 'x-forwarded-for': 'not-an-ip' }, undefined, '198.51.100.2'))).toBe('198.51.100.2');
    expect(clientIpAddress(fakeRequest({}, '::ffff:192.0.2.5'))).toBe('192.0.2.5');
    expect(clientIpAddress(fakeRequest({}, 'local-proxy'))).toBeUndefined();
  });
});
