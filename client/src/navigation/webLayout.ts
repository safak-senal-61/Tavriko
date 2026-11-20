const TABLET_WIDTH = 640;
export const WEB_TAB_WIDE_WIDTH = 760;
const UTILITY_WIDTH = 1440;
const FRAME_MAX_WIDTH = 1640;

const splitScreens = new Set(['auth', 'home', 'categories']);
const utilityScreens = new Set(['auth', 'home', 'categories', 'leaderboard', 'friends', 'profile']);
const focusedContentWidths: Record<string, number> = {
  profile_setup: 740,
  profile_edit: 740,
  difficulty: 760,
  matchmaking: 840,
  duel_versus: 840,
  quiz_arena: 920,
  intermission: 920,
  reconnect: 760,
  error: 760,
};

export function getWebLayout(width: number, height: number, screen: string, isWeb: boolean) {
  const roomy = isWeb && width >= TABLET_WIDTH && screen !== 'splash';
  const landscape = width >= height;
  // Keep the desktop lane reserved even on focused screens so navigation never moves the app frame.
  const reserveUtility = roomy && width >= UTILITY_WIDTH && landscape;

  return {
    roomy,
    split: roomy && width >= WEB_TAB_WIDE_WIDTH && splitScreens.has(screen),
    leaderboardColumns: roomy && width >= 1080 && landscape,
    reserveUtility,
    showUtility: reserveUtility && utilityScreens.has(screen),
    frameMaxWidth: FRAME_MAX_WIDTH,
    frameGutter: Math.round(Math.min(32, Math.max(12, width * 0.017))),
    contentMaxWidth: roomy ? focusedContentWidths[screen] : undefined,
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
