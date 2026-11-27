import { describe, expect, it } from 'vitest';
import { redactUrlForLog } from '../src/utils/redactUrl';

describe('redactUrlForLog', () => {
  it('hides the Google Play RTDN token but keeps the path and other parameters', () => {
    expect(redactUrlForLog('/api/webhooks/google-play?token=s3cr3t&x=1'))
      .toBe('/api/webhooks/google-play?token=[REDACTED]&x=1');
  });

  it('hides encoded and mixed-case sensitive keys', () => {
    expect(redactUrlForLog('/a?Access%5FToken=abc&PASSWORD=p&page=2'))
      .toBe('/a?Access%5FToken=[REDACTED]&PASSWORD=[REDACTED]&page=2');
  });

  it('leaves URLs without a query unchanged', () => {
    expect(redactUrlForLog('/api/health')).toBe('/api/health');
  });
});
