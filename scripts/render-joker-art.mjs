// Run from any directory: node scripts/render-joker-art.mjs
// Uses Sharp from the workspace toolchain. Shapes are font-independent.
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const active = join(root, 'client/bundled/jokers/poster');
const palettes = {
  aqua: ['#60e8fb', '#217591', '#112b47'],
  berry: ['#ff96dd', '#883879', '#331b53'],
  gold: ['#ffda87', '#985a32', '#462947'],
  green: ['#a5f78a', '#327b5f', '#15333d'],
  ice: ['#a1baff', '#4a56ae', '#242450'],
  coral: ['#ffa892', '#9d4959', '#462341'],
};
const ink = '#191733';
const paint = 'url(#metal)';
const p = (d, fill = paint, stroke = ink, w = 2.8) =>
  `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const line = (d, stroke = '#fff1d7', w = 3) => p(d, 'none', stroke, w);
const c = (x, y, r, fill = paint, stroke = ink, w = 2.8) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${w}"/>`;
const box = (x, y, w, h, rx, fill = paint, stroke = ink, sw = 2.8) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const star = (x, y, r, fill = '#fff0b5') =>
  p(`M${x} ${y-r}q${r*.14} ${r*.86} ${r} ${r}q-${r*.86} ${r*.14} -${r} ${r}q-${r*.14} -${r*.86} -${r} -${r}q${r*.86} -${r*.14} ${r} -${r}Z`, fill, 'none');
const nova = p('M48 36l4.4 8.2 9.2 1.6-6.7 6.5 1.5 9.1-8.4-4.4-8.4 4.4 1.5-9.1-6.7-6.5 9.2-1.6Z', '#fff0b5', ink, 2);
const shield = p('M48 24c8 6 16 8 23 9v16c0 13-10 21-23 27-13-6-23-14-23-27V33c7-1 15-3 23-9Z') +
  p('M48 31c6 4 11 6 16 7v11c0 9-6 15-16 20-10-5-16-11-16-20V38c5-1 10-3 16-7Z', '#302b68', ink, 2);
const timer = (mark) => box(42, 21, 12, 10, 3) + line('M66 33l5-5', '#ffdfac', 5) +
  c(48, 51, 22) + c(48, 51, 15, '#242454', ink, 2) + mark;
const turn = line('M28 43a21 21 0 0 1 34-12l4 4M68 54a21 21 0 0 1-34 12l-4-4', '#c6faff', 5) +
  p('m53 38 15 1 1-15m-26 33-15-1-1 15', '#b5eeff', '#b5eeff', 3);

const live = {
  'hedefi-bul': ['coral', c(46, 51, 23) + c(46, 51, 16, '#ff708d') + c(46, 51, 9, '#fff0cc') +
    c(46, 51, 3, '#a6356c', 'none') + line('M46 51l23-25', '#332245', 6) +
    line('M46 51l23-25', '#ffe29c', 3) + p('M60 36l1-11 5-6 2 7 8 1-6 6Z', '#ffe29c')],
  'yari-yariya': ['green', box(25, 27, 46, 43, 9, '#182d42') +
    [ [33, 35], [51, 35], [33, 52], [51, 52] ].map(([x,y], i) =>
      box(x, y, 12, 11, 2, i < 2 ? paint : '#2c4a53', 'none') +
      (i < 2 ? line(`m${x+3} ${y+5} 2 2 4-4`, '#173a3d', 1.5)
        : line(`m${x+3} ${y+3} 6 5m0-5-6 5`, '#9bb0bd', 1.5))).join('')],
  'siklari-patlat': ['berry', c(43, 55, 17) + box(38, 34, 11, 9, 2) +
    line('M45 35c2-10 8-13 15-9', '#ffd08d', 3) +
    p('m62 18 2 6 7-2-4 6 4 5-7-1-4 5-1-7-7-2 7-3Z', '#ffdc86', ink, 1.6) +
    line('M32 49q2-5 6-6', '#fff7e7', 2) +
    line('m57 56 13 13m0-13-13 13', ink, 10) + line('m57 56 13 13m0-13-13 13', '#ff83a9', 5)],
  'kehanet': ['berry', p('M34 58h28l7 13H27Z', '#ffc981') + c(48, 44, 21) +
    c(48, 44, 15, '#49409b', 'none') + line('M35 38q3-6 9-8', '#f6dbff', 3) +
    star(49, 46, 11) + star(59, 37, 3, '#e8b0ff') + line('M36 66h24', '#fff1c8', 2)],
  'cevap-goster': ['aqua', line('m56 56 13 14', ink, 13) + line('m56 56 13 14', '#ffcd85', 7) +
    c(44, 43, 20) + c(44, 43, 14, '#202858', ink, 2) +
    line('m36 43 5 5 10-11', '#b4ffed', 3.5)],
  'sans-zari': ['berry', p('m29 34 19-10 19 10v24L48 70 29 58Z') +
    p('m29 34 19 11 19-11-19-10Z', '#ffe3f5', ink, 2.4) +
    p('M48 45v25l19-12V34Z', '#9760cc', ink, 2.4) +
    [[48,34],[36,44],[42,55],[36,56],[55,49],[61,54]].map(([x,y]) => c(x,y,2.4,ink,'none')).join('')],
  'seri-koruyucu': ['gold', shield + nova +
    p('M20 52c-5 2-4 8 2 11 13 8 41 5 53-6 4-4 4-7 1-9', 'none', ink, 7) +
    line('M20 52c-5 2-4 8 2 11 13 8 41 5 53-6 4-4 4-7 1-9', '#ffd27b', 3.4)],
  'simsek-cevap': ['gold', p('M52 21 29 52h17l-5 23 28-34H52l8-20Z') +
    line('m52 27-14 19h11', '#fff7d5', 2.5) +
    line('m24 37 7-2m34 24 7-2M25 62l8-2', '#ffa9f5', 2.6)],
  'cifte-puan': ['gold', box(26, 57, 10, 13, 2) + box(42, 48, 10, 22, 2) +
    box(58, 39, 10, 31, 2) + line('M27 45l13-9 10 2 17-14', ink, 8) +
    line('M27 45l13-9 10 2 17-14m-10 0h10v10', '#fff0b5', 3.8)],
  'ilk-karakter': ['aqua', box(26, 26, 44, 44, 9, '#22305a') +
    line('m36 57 12-21 12 21m-19-7h14', '#c9fcff', 4)],
  'kelime-sayisi': ['coral', box(27, 25, 42, 46, 7, '#3e274d') +
    line('M37 37h22M37 46h15M37 55h22M37 61h14', '#ffe0b3', 3.2)],
};

const advanced = {
  'ikinci-sans': ['aqua', c(48, 48, 24, '#234373') + turn +
    line('M42 44c0-5 11-6 11 0 0 4-10 6-10 11h11', '#fff0c5', 3.3)],
  'zaman-molasi': ['ice', timer(line('M45 46v10m6-10v10', '#d5f5ff', 4.5))],
  'sihirli-destek': ['berry', line('m28 68 24-25', ink, 11) +
    line('m28 68 24-25', '#ffb8d7', 5.5) +
    p('m56 23 5 9 10 2-7 8 1 10-9-5-10 5 2-10-8-8 11-2Z', '#ffe29d') + star(33,38,5)],
  'kralin-hakki': ['gold', p('m24 38 13 9 11-17 11 17 13-9-5 28H29Z') +
    line('M31 60h34', '#fff0bd', 2) + p('m48 45 5 6-5 6-5-6Z', '#df7fff', ink, 1.5) +
    [ [24,36],[48,28],[72,36] ].map(([x,y]) => c(x,y,3.5)).join('')],
  'altin-avi': ['gold', box(25, 41, 46, 28, 6, '#9b5544') +
    p('M25 48v-6c0-8 7-13 14-13h18c8 0 14 5 14 13v6Z') +
    line('M35 33v14m24-14v14', '#ffe8ab', 3) + box(43, 44, 10, 12, 3) +
    c(65, 65, 6, '#ffda81') + c(72, 68, 5, '#ffda81')],
  'soru-degistir': ['aqua', c(48, 48, 24, '#224060') + turn + star(47, 48, 5, '#ffeac2')],
  'halk-destegi': ['coral', p('M21 60c0-8 4-13 11-13s11 5 11 13v6H21Zm32 0c0-8 4-13 11-13s11 5 11 13v6H53Z', '#c98dff') +
    c(32, 41, 7, '#dcaaff') + c(64, 41, 7, '#dcaaff') +
    p('M34 66v-7c0-9 6-14 14-14s14 5 14 14v7Z') + c(48, 37, 9)],
  'ek-sure': ['berry', timer(line('M48 42v9l5 4', '#f6e9ff', 3)) +
    c(67, 63, 9, '#ffd7a3') + line('M63 63h8m-4-4v8', ink, 2)],
  'pas-gec': ['coral', p('M26 32q-2 0-2 3v26q0 4 4 2l19-13q3-2 0-4L28 33Z') +
    p('M50 32q-2 0-2 3v26q0 4 4 2l19-13q3-2 0-4L52 33Z')],
  'koruma-kalkani': ['green', shield + line('m39 50 6 6 13-13', '#c9ffd3', 4)],
  'zaman-dondurma': ['ice', c(48, 48, 24, '#284473', '#b8edff', 2) +
    [0,60,120].map(deg =>
      `<g transform="rotate(${deg} 48 48)">${line('M48 28v40m-7-35 7 7 7-7m-14 30 7-7 7 7', '#c7f8ff', 3)}</g>`).join('')],
};

function svg(palette, symbol) {
  const [accent, mid, dark] = palettes[palette];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 96 96">
    <defs>
      <linearGradient id="frame" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${mid}"/><stop offset="100%" stop-color="${dark}"/></linearGradient>
      <linearGradient id="metal" x1="10%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stop-color="#fff3dc"/><stop offset="33%" stop-color="${accent}"/><stop offset="100%" stop-color="${mid}"/></linearGradient>
    </defs>
    ${box(7, 10, 82, 80, 23, '#100d29', 'none')}
    ${box(7, 6, 82, 80, 23, 'url(#frame)', accent, 1.3)}
    ${box(11, 10, 74, 72, 19, 'none', '#ffffff', .7).replace('/>', ' opacity=".20"/>')}
    <ellipse cx="47" cy="48" rx="28" ry="30" fill="${dark}" opacity=".34"/>
    ${star(19, 28, 3, accent)}${star(75, 22, 3.5, accent)}${star(76, 73, 3, accent)}
    ${c(22, 70, 1.35, accent, 'none')}${c(78, 33, 1.2, accent, 'none')}
    ${symbol}</svg>`;
}

for (const [name, [palette, symbol]] of Object.entries({ ...live, ...advanced })) {
  await sharp(Buffer.from(svg(palette, symbol))).webp({ lossless: true }).toFile(join(active, `${name}.webp`));
}
