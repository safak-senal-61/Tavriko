import { describe, expect, it } from 'vitest';
import { getQuizArenaLayout } from './quizArenaLayout';

describe('quiz arena responsiveness', () => {
  it('reserves room for category artwork even on small phones', () => {
    const narrow = getQuizArenaLayout(288, 568, 8);
    const phone = getQuizArenaLayout(343, 667, 8);
    expect(narrow).toMatchObject({ compactHeader: true, tightHeader: true, categoryArtSize: 16, wideAnswers: false });
    expect(phone).toMatchObject({ compactHeader: true, tightHeader: false, categoryArtSize: 19, categoryFontSize: 12, wideAnswers: false });
  });

  it('adds a smaller rightward extension on the narrowest phones and keeps wider layouts unchanged', () => {
    expect(getQuizArenaLayout(288, 568, 8)).toMatchObject({ mobileCards: true, categoryExtraRightPadding: 8 });
    expect(getQuizArenaLayout(343, 667, 8)).toMatchObject({ mobileCards: true, categoryExtraRightPadding: 14 });
    expect(getQuizArenaLayout(560, 780, 8)).toMatchObject({ mobileCards: false, categoryExtraRightPadding: 0 });
  });

  it('adapts the arena to available tablet and desktop space', () => {
    const phone = getQuizArenaLayout(343, 844, 8);
    const tablet = getQuizArenaLayout(692, 1024, 8);
    const desktop = getQuizArenaLayout(980, 900, 8);
    expect(tablet.wideAnswers).toBe(true);
    expect(tablet.denseFrameMaxWidth).toBeLessThan(desktop.denseFrameMaxWidth!);
    expect(tablet.denseScale).toBeGreaterThan(phone.denseScale);
    expect(desktop.denseScale).toBeGreaterThan(tablet.denseScale);
    expect(desktop.categoryArtSize).toBeGreaterThan(tablet.categoryArtSize);
  });

  it('does not enlarge crowded game elements in a short landscape window', () => {
    const short = getQuizArenaLayout(980, 500, 8);
    expect(short).toMatchObject({ wideAnswers: true, dense: true, uiGrowth: 0, denseScale: 0.65 });
    expect(getQuizArenaLayout(343, 667, 2)).toMatchObject({ dense: false, denseScale: 1, categoryArtSize: 19 });
  });
});
