import { describe, expect, it } from 'vitest';
import { getHomeWebSizing, getWebLayout } from './webLayout';

const mainTabs = ['home', 'categories', 'leaderboard', 'friends', 'profile'];

describe('player web layout', () => {
  it('preserves mobile, native and frameless splash layouts', () => {
    expect(getWebLayout(375, 812, 'home', true)).toMatchObject({ roomy: false, split: false, reserveUtility: false });
    expect(getWebLayout(1440, 900, 'auth', false)).toMatchObject({ roomy: false, split: false, reserveUtility: false });
    expect(getWebLayout(1920, 900, 'splash', true)).toMatchObject({ roomy: false, reserveUtility: false, showUtility: false });
  });

  it('keeps the same frame on all five tabs in either tablet orientation and on desktop', () => {
    for (const [width, height] of [[640, 980], [768, 1024], [1032, 1376], [1376, 1032], [1920, 870]]) {
      const home = getWebLayout(width, height, 'home', true);
      for (const screen of mainTabs) {
        expect(getWebLayout(width, height, screen, true)).toMatchObject({
          roomy: true,
          frameMaxWidth: home.frameMaxWidth,
          frameGutter: home.frameGutter,
          reserveUtility: width >= 1440,
          showUtility: width >= 1440,
          contentMaxWidth: undefined,
        });
      }
    }
    expect(getWebLayout(1920, 870, 'home', true).frameMaxWidth).toBeGreaterThan(1400);
    expect(getWebLayout(640, 980, 'home', true).split).toBe(false);
    expect(getWebLayout(768, 1024, 'home', true).split).toBe(true);
  });

  it('keeps gameplay readable without moving the outer desktop frame', () => {
    expect(getWebLayout(1920, 870, 'quiz_arena', true)).toMatchObject({
      roomy: true, split: false, reserveUtility: true, showUtility: false, contentMaxWidth: 920,
      frameMaxWidth: getWebLayout(1920, 870, 'home', true).frameMaxWidth,
    });
  });

  it('puts the leaderboard in columns on wide landscape, but not portrait', () => {
    expect(getWebLayout(1032, 1376, 'leaderboard', true).leaderboardColumns).toBe(false);
    expect(getWebLayout(1376, 1032, 'leaderboard', true).leaderboardColumns).toBe(true);
    expect(getWebLayout(1440, 1800, 'leaderboard', true).reserveUtility).toBe(false);
  });
});

describe('home web sizing', () => {
  it('gives tall tablet pages a larger, stacked layout and keeps landscape side by side', () => {
    expect(getHomeWebSizing(1032, 1376, true)).toMatchObject({ portrait: true, heroHeight: 455, modeHeight: 190 });
    expect(getHomeWebSizing(768, 1024, true)).toMatchObject({ portrait: true, heroHeight: 271, modeHeight: 120 });
    expect(getHomeWebSizing(1376, 1032, true)).toMatchObject({ portrait: false, heroHeight: 420, modeHeight: undefined });
    expect(getHomeWebSizing(1920, 870, true)).toMatchObject({ portrait: false, heroHeight: 352 });
    expect(getHomeWebSizing(1280, 470, true)).toMatchObject({ portrait: false, short: true, heroHeight: 192 });
    expect(getHomeWebSizing(375, 812, false)).toMatchObject({ portrait: false, short: false, heroHeight: undefined });
  });
});
