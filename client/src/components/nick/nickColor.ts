/** Worklet güvenli renk yardımcıları */
export const mixHex = (a: string, b: string, t: number): string => {
  'worklet';
  const pa = parseInt(a.slice(1, 7), 16);
  const pb = parseInt(b.slice(1, 7), 16);
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
};

/** Döngüsel palet örneklemesi: t ∈ [0,1) */
export const cyclicColor = (colors: string[], t: number): string => {
  'worklet';
  const n = colors.length;
  if (n === 0) return '#FFFFFF';
  if (n === 1) return colors[0];
  const x = (((t % 1) + 1) % 1) * n;
  const i = Math.floor(x) % n;
  const j = (i + 1) % n;
  const f = x - Math.floor(x);
  return mixHex(colors[i], colors[j], f * f * (3 - 2 * f));
};

/** '#RRGGBB' + alfa (0..1) → '#RRGGBBAA' */
export const withAlpha = (hex: string, a: number): string => {
  const v = Math.max(0, Math.min(255, Math.round(a * 255)));
  return `${hex.slice(0, 7)}${v.toString(16).padStart(2, '0')}`;
};
