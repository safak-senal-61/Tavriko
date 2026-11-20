import { describe, expect, it } from 'vitest';
import { getWebLayout } from './webLayout';

describe('player web layout', () => {
  it('keeps mobile and native screens out of the wide web layout', () => {
    expect(getWebLayout(375, 'home', true)).toMatchObject({ roomy: false, split: false, showUtility: false });
    expect(getWebLayout(1440, 'auth', false)).toMatchObject({ roomy: false, split: false, showUtility: false });
  });

  it('uses a tablet frame before splitting the main screens', () => {
    expect(getWebLayout(640, 'home', true)).toMatchObject({ roomy: true, split: false });
    for (const screen of ['auth', 'home', 'categories']) {
      expect(getWebLayout(768, screen, true)).toMatchObject({ roomy: true, split: true, showUtility: false });
      expect(getWebLayout(1280, screen, true)).toMatchObject({ split: true, showUtility: true, maxWidth: 1120 });
    }
  });

  it('keeps splash frameless and does not show the utility panel during games', () => {
    expect(getWebLayout(1440, 'splash', true)).toMatchObject({ roomy: false, showUtility: false });
    expect(getWebLayout(1440, 'quiz_arena', true)).toMatchObject({ roomy: true, split: false, showUtility: false, maxWidth: 840 });
  });
});
