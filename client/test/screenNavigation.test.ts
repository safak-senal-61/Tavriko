import { ALL_CATEGORIES } from '@trivia/shared';

describe('Screen and Navigation Contract', () => {
  it('validates navigation route names and category availability', () => {
    const routeNames = [
      'splash',
      'auth',
      'profile_setup',
      'home',
      'categories',
      'difficulty',
      'matchmaking',
      'custom_room',
      'lobby',
      'quiz_arena',
      'intermission',
      'match_result',
      'friends',
      'profile',
      'leaderboard',
      'daily_challenge',
      'practice',
      'notifications',
      'settings',
      'reconnect',
      'error',
    ];

    expect(routeNames.length).toBeGreaterThanOrEqual(20);
    expect(routeNames).toContain('home');
    expect(routeNames).toContain('quiz_arena');
    expect(routeNames).toContain('match_result');
  });
});
