import { THEME, getCategoryTheme } from './tokens';
import { useGameStore } from '../store/gameStore';

describe('Theme and GameStore', () => {
  it('contains expected dark gaming palette tokens', () => {
    expect(THEME.colors.background).toBe('#0D0F17');
    expect(THEME.colors.card).toBe('#181C2A');
    expect(THEME.colors.primary).toBe('#6366F1');
    expect(THEME.colors.correct).toBe('#10B981');
    expect(THEME.colors.wrong).toBe('#EF4444');
  });

  it('retrieves custom category colors', () => {
    const geo = getCategoryTheme('geography');
    expect(geo.primary).toBe('#3B82F6');
    const math = getCategoryTheme('mathematics');
    expect(math.primary).toBe('#10B981');
  });

  it('updates store state when user logs in and resets on logout', () => {
    const store = useGameStore.getState();
    expect(store.user).toBeNull();

    store.setUser({
      id: 'u1',
      username: 'gamer1',
      displayName: 'Gamer 1',
      level: 1,
      xp: 0,
      coins: 100,
      rankTitle: 'Acemi',
      rankPoints: 1000,
      stats: {
        totalMatches: 0,
        wins: 0,
        correctAnswers: 0,
        totalAnswers: 0,
        bestStreak: 0,
        avgResponseTimeMs: 0,
      },
      categoryMastery: {},
    });

    expect(useGameStore.getState().user?.displayName).toBe('Gamer 1');

    store.resetGame();
    expect(useGameStore.getState().currentQuestion).toBeNull();
  });
});
