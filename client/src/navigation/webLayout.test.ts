import { describe, expect, it } from 'vitest';
import { getHomeWebSizing, getWebLayout, getWebUiSizing, WEB_PAGES, type ScreenName } from './webLayout';

const mainTabs = ['home', 'categories', 'leaderboard', 'friends', 'profile'] as const;
const allPages = Object.keys(WEB_PAGES) as ScreenName[];

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
          frameWidth: home.frameWidth,
          pageInset: home.pageInset,
        });
      }
    }
    expect(getWebLayout(1920, 870, 'home', true).frameMaxWidth).toBeGreaterThan(1400);
    expect(getWebLayout(640, 980, 'home', true).split).toBe(false);
    expect(getWebLayout(768, 1024, 'home', true).split).toBe(true);
  });

  it('centers gameplay within a full frame without an empty QR column', () => {
    expect(getWebLayout(1920, 870, 'quiz_arena', true)).toMatchObject({
      roomy: true, split: false, reserveUtility: false, showUtility: false, contentWidth: 980,
      frameMaxWidth: getWebLayout(1920, 870, 'home', true).frameMaxWidth,
    });
  });

  it('gives every desktop workspace the same frame, useful width and visible utility', () => {
    const home = getWebLayout(1568, 708, 'home', true);
    for (const screen of allPages) {
      const page = getWebLayout(1568, 708, screen, true);
      if (page.mode === 'workspace' || page.mode === 'dashboard') {
        expect(page.frameWidth, screen).toBe(home.frameWidth);
        expect(page.contentWidth, screen).toBeGreaterThanOrEqual(1040);
        expect(page.showUtility, screen).toBe(true);
      }
    }
  });

  it('fits every page within its frame and preserves phone and native fallbacks', () => {
    for (const screen of allPages) {
      for (const [width, height] of [[640, 950], [768, 1024], [820, 1180], [1032, 1376], [1376, 1032], [1568, 708], [1920, 1080]]) {
        const page = getWebLayout(width, height, screen, true);
        expect(page.frameWidth, screen).toBeLessThanOrEqual(width);
        expect(page.pageInset, screen).toBeGreaterThanOrEqual(16);
        expect(page.contentWidth + 2 * page.pageInset, screen).toBeCloseTo(page.frameWidth);
      }
      expect(getWebLayout(375, 812, screen, true).roomy, screen).toBe(false);
      expect(getWebLayout(1032, 1376, screen, false).roomy, screen).toBe(false);
    }
  });

  it('uses frame width, including the QR panel, to decide how many cards fit', () => {
    expect(getWebLayout(768, 1024, 'shop', true).columns).toBe(1);
    expect(getWebLayout(1032, 1376, 'shop', true).columns).toBe(2);
    expect(getWebLayout(1440, 860, 'shop', true).columns).toBe(3);
    expect(getWebLayout(1920, 870, 'inventory', true).columns).toBe(3);
  });

  it('puts the leaderboard in columns on wide landscape, but not portrait', () => {
    expect(getWebLayout(1032, 1376, 'leaderboard', true).leaderboardColumns).toBe(false);
    expect(getWebLayout(1376, 1032, 'leaderboard', true).leaderboardColumns).toBe(true);
    expect(getWebLayout(1440, 1800, 'leaderboard', true).reserveUtility).toBe(false);
  });

  it('scales controls and art by usable space, preserving phone and short layouts', () => {
    const phone = getWebLayout(375, 812, 'profile', true).ui;
    const tablet = getWebLayout(1032, 1376, 'profile', true).ui;
    const desktop = getWebLayout(1600, 900, 'profile', true).ui;
    const short = getWebLayout(1280, 470, 'profile', true).ui;
    expect(phone).toEqual(getWebUiSizing(1200, 900, false));
    expect(phone.art).toBe(1);
    expect(tablet.art).toBeGreaterThan(phone.art);
    expect(desktop.art).toBeGreaterThan(tablet.art);
    expect(desktop.art).toBeLessThanOrEqual(1.42);
    expect(desktop.navLabel).toBeGreaterThan(phone.navLabel);
    expect(desktop.buttonHeight).toBeGreaterThan(phone.buttonHeight);
    expect(short.buttonHeight).toBe(phone.buttonHeight);
    expect(short.navHeight).toBe(phone.navHeight);
    expect(getWebLayout(1600, 900, 'profile', false).ui).toEqual(phone);
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
