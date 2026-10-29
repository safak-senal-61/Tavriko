import { CategoryId } from '@trivia/shared';

export const THEME = {
  colors: {
    background: '#0D0F17',
    backgroundSecondary: '#141824',
    card: '#181C2A',
    cardHover: '#23293D',
    border: '#272F45',
    borderActive: '#4F46E5',

    // Primary Accents
    primary: '#6366F1',
    primaryHover: '#4F46E5',
    primaryLight: '#818CF8',

    secondary: '#EC4899',
    accent: '#06B6D4',

    // Game feedback
    correct: '#10B981',
    correctBackground: 'rgba(16, 185, 129, 0.15)',
    wrong: '#EF4444',
    wrongBackground: 'rgba(239, 68, 68, 0.15)',
    streak: '#F59E0B',
    timerWarning: '#F97316',
    timerCritical: '#EF4444',

    // Typography
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    textOnColor: '#FFFFFF',

    // Teams
    teamRed: '#EF4444',
    teamBlue: '#3B82F6',

    // Podium Gold/Silver/Bronze
    gold: '#FBBF24',
    silver: '#CBD5E1',
    bronze: '#D97706',
  },

  categoryColors: {
    geography: { primary: '#3B82F6', accent: '#93C5FD' },
    mathematics: { primary: '#10B981', accent: '#6EE7B7' },
    general_culture: { primary: '#F59E0B', accent: '#FDE68A' },
    history: { primary: '#8B5CF6', accent: '#C4B5FD' },
    science_tech: { primary: '#06B6D4', accent: '#67E8F9' },
    space_astronomy: { primary: '#6366F1', accent: '#A5B4FC' },
    sports: { primary: '#EF4444', accent: '#FCA5A5' },
    cinema_tv: { primary: '#EC4899', accent: '#F9A8D4' },
    music: { primary: '#14B8A6', accent: '#5EEAD4' },
    literature: { primary: '#D97706', accent: '#FCD34D' },
    biology: { primary: '#22C55E', accent: '#86EFAC' },
    physics_chemistry: { primary: '#A855F7', accent: '#D8B4FE' },
    logic_puzzles: { primary: '#E11D48', accent: '#FDA4AF' },
    language_vocab: { primary: '#0284C7', accent: '#7DD3FC' },
    art_culture: { primary: '#F97316', accent: '#FDBA74' },
    mixed: { primary: '#8B5CF6', accent: '#C084FC' },
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
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    full: 9999,
  },

  typography: {
    titleLarge: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
    titleMedium: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
    headline: { fontSize: 18, fontWeight: '700' as const },
    bodyLarge: { fontSize: 16, fontWeight: '500' as const },
    bodyRegular: { fontSize: 14, fontWeight: '400' as const },
    caption: { fontSize: 12, fontWeight: '500' as const },
    badge: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.5 },
  },
};

export function getCategoryTheme(categoryId?: CategoryId) {
  if (!categoryId || !THEME.categoryColors[categoryId]) {
    return THEME.categoryColors.mixed;
  }
  return THEME.categoryColors[categoryId];
}
