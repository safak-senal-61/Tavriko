import { CategoryId } from '@trivia/shared';
export const THEME = {
  fonts: {
    display: 'Nunito_900Black',
    body: 'Nunito_700Bold',
    bold: 'Nunito_700Bold',
    medium: 'Nunito_700Bold',
    extraBold: 'Nunito_800ExtraBold',
    black: 'Nunito_900Black',
  },
  colors: {
    // Tavriko UI Kit Royal Purple Background Palette
    background: '#180B34',
    backgroundTop: '#241050',
    backgroundBottom: '#110723',
    backgroundGlow: '#5B2CC4',
    backgroundSecondary: '#241050',
    // Glass & Surface Cards (.g, .pill, .ib)
    card: 'rgba(255, 255, 255, 0.09)',
    cardHover: 'rgba(255, 255, 255, 0.14)',
    border: 'rgba(255, 255, 255, 0.14)',
    borderActive: '#FFC43D',
    pillBg: 'rgba(10, 4, 24, 0.72)',
    pillBorder: 'rgba(255, 255, 255, 0.12)',
    navBg: 'rgba(14, 6, 32, 0.94)',
    // Primary Accents
    primary: '#6B3CFF',
    primaryHover: '#5A27C8',
    primaryLight: '#9A6BFF',
    secondary: '#FF6BC4',
    accent: '#5ADBB5',
    // 3D Buttons (.b, .b.c, .b.r)
    btnGoldTop: '#FFE27A',
    btnGoldBottom: '#FF9B2F',
    btnGoldLip: '#B8560A',
    btnGoldText: '#3B1500',
    btnMintTop: '#8FF0CF',
    btnMintBottom: '#3FB5A0',
    btnMintLip: '#1D7A6B',
    btnMintText: '#0C3A33',
    btnRedTop: '#FF7A8A',
    btnRedBottom: '#D0102E',
    btnRedLip: '#7A0A1C',
    btnRedText: '#FFFFFF',
    // Game feedback
    correct: '#3FD08A',
    success: '#7CFC8A',
    correctBackground: 'rgba(63, 208, 138, 0.22)',
    wrong: '#FF5A6A',
    danger: '#D0102E',
    wrongBackground: 'rgba(255, 90, 106, 0.22)',
    warning: '#FFC43D',
    streak: '#FF9B2F',
    timerWarning: '#FF9B2F',
    timerCritical: '#FF5A6A',
    // Typography
    textPrimary: '#FFFFFF',
    textSecondary: '#D9CDF5',
    textMuted: '#CBBFE8',
    textOnColor: '#FFFFFF',
    // Teams
    teamRed: '#E01535',
    teamBlue: '#6B3CFF',
    // Podium Gold/Silver/Bronze
    gold: '#FFC43D',
    silver: '#B8C2D8',
    bronze: '#D98A4A',
  },
  categoryColors: {
    science_tech: { primary: '#4FD6E8', accent: '#0E7FA8' },
    history: { primary: '#E0985A', accent: '#8A4A12' },
    geography: { primary: '#4A9BFF', accent: '#1F5FE0' },
    sports: { primary: '#FFB347', accent: '#E06A00' },
    cinema_tv: { primary: '#FF7A8A', accent: '#C8102E' },
    music: { primary: '#FF6BC4', accent: '#C01F80' },
    art_culture: { primary: '#9A6BFF', accent: '#5A27C8' },
    physics_chemistry: { primary: '#4A9BFF', accent: '#1F5FE0' },
    biology: { primary: '#4FE0A0', accent: '#14935F' },
    language_vocab: { primary: '#FFB347', accent: '#E06A00' },
    literature: { primary: '#9A6BFF', accent: '#5A27C8' },
    space_astronomy: { primary: '#4FD6E8', accent: '#0E7FA8' },
    logic_puzzles: { primary: '#FF6BC4', accent: '#C01F80' },
    mathematics: { primary: '#FF7A8A', accent: '#C8102E' },
    general_culture: { primary: '#9A6BFF', accent: '#5A27C8' },
    mixed: { primary: '#6B3CFF', accent: '#FF7A2F' },
  } as Record<CategoryId, { primary: string; accent: string }>,
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  radius: {
    sm: 10,
    md: 14,
    lg: 18,
    xl: 20,
    xxl: 26,
    full: 9999,
  },
  typography: {
    titleLarge: {
      fontFamily: 'Nunito_900Black',
      fontSize: 34,
      letterSpacing: 0.5,
    },
    titleMedium: {
      fontFamily: 'Nunito_900Black',
      fontSize: 24,
      letterSpacing: 0.4,
    },
    headline: {
      fontFamily: 'Nunito_900Black',
      fontSize: 19,
      letterSpacing: 0.3,
    },
    bodyLarge: {
      fontFamily: 'Nunito_800ExtraBold',
      fontSize: 16,
    },
    bodyRegular: {
      fontFamily: 'Nunito_700Bold',
      fontSize: 14,
    },
    caption: {
      fontFamily: 'Nunito_800ExtraBold',
      fontSize: 12,
    },
    badge: {
      fontFamily: 'Nunito_800ExtraBold',
      fontSize: 11,
      letterSpacing: 0.4,
    },
  },
};
export function getCategoryTheme(categoryId?: CategoryId) {
  if (!categoryId || !THEME.categoryColors[categoryId]) {
    return THEME.categoryColors.mixed;
  }
  return THEME.categoryColors[categoryId];
}