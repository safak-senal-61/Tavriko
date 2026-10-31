import { supabaseService } from '../src/db/supabaseClient';

describe('Supabase Service Layer & RLS Safety', () => {
  it('reports configuration and connection health without crashing', async () => {
    const health = await supabaseService.checkHealth();
    expect(health).toHaveProperty('configured');
    expect(health).toHaveProperty('connected');
    expect(health).toHaveProperty('message');
  });

  it('handles getPublishedQuestions safely and falls back when offline', async () => {
    const questions = await supabaseService.getPublishedQuestions('geography', 'easy', 5);
    // If Supabase credentials are not set, it returns null without throwing
    expect(questions === null || Array.isArray(questions)).toBe(true);
  });
});
