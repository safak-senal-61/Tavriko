const TABLET_WIDTH = 640;
const SPLIT_WIDTH = 760;
const UTILITY_WIDTH = 1240;

const wideScreens = new Set(['auth', 'home', 'categories']);

export function getWebLayout(width: number, screen: string, isWeb: boolean) {
  const roomy = isWeb && width >= TABLET_WIDTH && screen !== 'splash';
  const wideScreen = roomy && wideScreens.has(screen);

  return {
    roomy,
    split: wideScreen && width >= SPLIT_WIDTH,
    showUtility: wideScreen && width >= UTILITY_WIDTH,
    maxWidth: wideScreen ? 1120 : screen === 'quiz_arena' ? 840 : 720,
  };
}
