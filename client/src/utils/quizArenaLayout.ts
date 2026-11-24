export const NATIVE_QUIZ_TABLET_FRAME_WIDTH = 620;

const unit = (value: number) => Math.max(0, Math.min(1, value));

export function getQuizArenaLayout(contentWidth: number, height: number, playerCount: number) {
  const dense = playerCount >= 5;
  const compactHeader = contentWidth < 400;
  const tightHeader = contentWidth < 325;
  const mobileCards = contentWidth < 480;
  const wideAnswers = contentWidth >= 560;
  const widthGrowth = unit((contentWidth - 400) / 500);
  const uiGrowth = widthGrowth * unit((height - 560) / 240);
  const denseScale = dense
    ? Math.max(0.65, Math.min(1, 0.92 - 0.04 * (playerCount - 5) + 0.15 * uiGrowth, (height - 100) / 760))
    : 1;

  return {
    dense,
    denseScale,
    wideAnswers,
    compactHeader,
    tightHeader,
    mobileCards,
    categoryExtraRightPadding: mobileCards ? (tightHeader ? 8 : 14) : 0,
    uiGrowth,
    denseFrameMaxWidth: dense && wideAnswers
      ? Math.round(640 + 210 * unit((contentWidth - 560) / 420))
      : undefined,
    categoryArtSize: compactHeader
      ? (tightHeader ? 16 : 19)
      : Math.round((dense ? 22 : 30) + (dense ? 11 : 6) * widthGrowth),
    categoryMaxWidth: compactHeader ? 192 : Math.round(220 + 84 * widthGrowth),
    categoryFontSize: compactHeader ? 12 : Math.round(13 + 2 * widthGrowth),
    subCategoryFontSize: compactHeader ? 10 : Math.round(10 + 2 * widthGrowth),
    categoryMinHeight: compactHeader ? 32 : dense ? Math.round(34 + 8 * widthGrowth) : 40,
    categoryHorizontalPadding: compactHeader ? (tightHeader ? 5 : 6) : Math.round(8 + 4 * widthGrowth),
  };
}
