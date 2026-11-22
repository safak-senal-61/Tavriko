const TABLET_WIDTH = 640;
export const WEB_TAB_WIDE_WIDTH = 760;
const UTILITY_WIDTH = 1440;
const FRAME_MAX_WIDTH = 1640;
export const WEB_UTILITY_WIDTH = 248;
export const WEB_FRAME_GAP = 16;

type PageLayout = { mode: 'dashboard' | 'workspace' | 'focus' | 'splash'; maxWidth?: number };

// Every navigator route has a deliberate layout. These widths constrain content,
// not the background or the shared frame around it.
export const WEB_PAGES = {
  splash: { mode: 'splash' },
  auth: { mode: 'dashboard' },
  home: { mode: 'dashboard' },
  categories: { mode: 'dashboard' },
  leaderboard: { mode: 'dashboard' },
  friends: { mode: 'dashboard' },
  profile: { mode: 'dashboard' },
  friend_profile: { mode: 'workspace', maxWidth: 1184 },
  profile_setup: { mode: 'workspace', maxWidth: 1056 },
  profile_edit: { mode: 'workspace', maxWidth: 1056 },
  difficulty: { mode: 'workspace', maxWidth: 1120 },
  custom_room: { mode: 'workspace', maxWidth: 1280 },
  lobby: { mode: 'workspace', maxWidth: 1240 },
  daily_challenge: { mode: 'workspace', maxWidth: 1120 },
  practice: { mode: 'workspace', maxWidth: 1120 },
  notifications: { mode: 'workspace', maxWidth: 1040 },
  settings: { mode: 'workspace', maxWidth: 1120 },
  season: { mode: 'workspace', maxWidth: 1240 },
  shop: { mode: 'workspace', maxWidth: 1280 },
  events: { mode: 'workspace', maxWidth: 1280 },
  inventory: { mode: 'workspace', maxWidth: 1280 },
  gameplay_rewards: { mode: 'workspace', maxWidth: 1120 },
  pro_league: { mode: 'workspace', maxWidth: 1280 },
  developer: { mode: 'workspace', maxWidth: 1240 },
  matchmaking: { mode: 'focus', maxWidth: 960 },
  duel_versus: { mode: 'focus', maxWidth: 960 },
  quiz_arena: { mode: 'focus', maxWidth: 980 },
  intermission: { mode: 'focus', maxWidth: 980 },
  match_result: { mode: 'focus', maxWidth: 1120 },
  reconnect: { mode: 'focus', maxWidth: 820 },
  error: { mode: 'focus', maxWidth: 820 },
} satisfies Record<string, PageLayout>;

export type ScreenName = keyof typeof WEB_PAGES;

// Scale the artwork separately from type and hit targets. Use the space left
// after the actual screen inset and QR rail, not the browser's raw width.
export function getWebUiSizing(contentWidth: number, height: number, roomy: boolean) {
  const growth = roomy ? Math.max(0, Math.min(1, (contentWidth - 560) / 640)) : 0;
  const short = height <= 620;
  return {
    art: roomy ? 1.14 + growth * (short ? 0.12 : 0.28) : 1,
    buttonHeight: roomy && !short ? Math.round(54 + growth * 6) : 50,
    buttonLabel: roomy ? Math.round(18 + growth * 2) : 18,
    navIcon: roomy ? Math.round(24 + growth * 4) : 22,
    navLabel: roomy ? Math.round(12 + growth * 2) : 10.5,
    navHeight: roomy && !short ? Math.round(68 + growth * 6) : 66,
  };
}

export function getWebLayout(width: number, height: number, screen: ScreenName, isWeb: boolean) {
  const page: PageLayout = WEB_PAGES[screen];
  const roomy = isWeb && width >= TABLET_WIDTH && page.mode !== 'splash';
  const landscape = width >= height;
  const showUtility = roomy && landscape && width >= UTILITY_WIDTH && page.mode !== 'focus';
  const frameGutter = Math.round(Math.min(32, Math.max(12, width * 0.017)));
  const frameWidth = roomy
    ? Math.min(FRAME_MAX_WIDTH, width - frameGutter * 2 - (showUtility ? WEB_UTILITY_WIDTH + WEB_FRAME_GAP : 0)) - 2
    : width;
  const minInset = frameWidth >= WEB_TAB_WIDE_WIDTH ? 24 : 16;
  const pageInset = roomy ? Math.max(minInset, (frameWidth - (page.maxWidth ?? frameWidth)) / 2) : 16;
  const contentWidth = Math.max(0, frameWidth - pageInset * 2);

  return {
    roomy,
    split: roomy && contentWidth >= 690 && (screen === 'auth' || screen === 'home' || screen === 'categories'),
    leaderboardColumns: roomy && contentWidth >= 980 && landscape,
    reserveUtility: showUtility,
    showUtility,
    frameMaxWidth: FRAME_MAX_WIDTH,
    frameGutter,
    frameWidth,
    pageInset,
    contentWidth,
    ui: getWebUiSizing(contentWidth, height, roomy),
    columns: !roomy || contentWidth < 720 ? 1 : contentWidth < 1050 ? 2 : 3,
    mode: page.mode,
  };
}

export function getHomeWebSizing(width: number, height: number, wideLayout: boolean) {
  const short = wideLayout && height <= 620;
  const portrait = wideLayout && height >= 950 && height >= width * 1.12;
  const heroHeight = !wideLayout
    ? undefined
    : short
      ? 192
      : portrait
        ? Math.round(Math.min(475, Math.max(268, height * 0.52 - 261)))
        : Math.round(Math.min(420, Math.max(250, height - 518)));
  const modeHeight = portrait ? Math.round(Math.min(190, Math.max(108, height * 0.2 - 85))) : undefined;
  return { short, portrait, heroHeight, modeHeight };
}
