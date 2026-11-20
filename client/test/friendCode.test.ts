import { describe, expect, it } from 'vitest';
import { normalizeFriendCodeSuffix } from '../src/utils/friendCode';

describe('friend code entry', () => {
  it.each([
    ['uB1aY94', 'UB1AY94'],
    ['  tv-uB1aY94\n', 'UB1AY94'],
    ['TV-abc', 'ABC'],
    ['x7', 'X7'],
    ['x y.1', 'XY1'],
    ['TV', 'TV'],
    ['tv-', ''],
    ['', ''],
  ])('normalizes %j to a suffix of %j', (input, suffix) => {
    expect(normalizeFriendCodeSuffix(input)).toBe(suffix);
  });
});
