import { resolveProfileTitle } from '../src/utils/profileTitle';

describe('Plain-text selected and unlocked profile title', () => {
  it.each([
    [undefined, 1, 'Acemi Kaşif', 'Acemi Kaşif'],
    ['Yükselen Yıldız', 4, 'Acemi Kaşif', 'Yükselen Yıldız'],
    ['Evrenin Hakimi', 4, 'Acemi Kaşif', 'Acemi Kaşif'],
    ['⭐ Acemi Kaşif', 4, 'Yükselen Yıldız', 'Yükselen Yıldız'],
    [{ title: 'Usta Kaşif' }, 6, 'Usta Kaşif', 'Usta Kaşif'],
    ['__proto__', 99, 'unknown', 'Acemi Kaşif'],
  ])('resolves %p at level %p safely', (selected, level, fallback, expected) => {
    expect(resolveProfileTitle(selected, level as number, fallback as string)).toBe(expected);
  });
});
