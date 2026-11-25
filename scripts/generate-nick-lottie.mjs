#!/usr/bin/env node
// Animated Nick parçacık Lottie dosyalarını üretir (client/assets/lottie/nick/*.json).
// Renkler beyazdır; istemci `colorFilters` ile katman adlarına (c0, c1, c2…) göre boyar.
// Kullanım: node scripts/generate-nick-lottie.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'client', 'assets', 'lottie', 'nick');
const W = 300;
const H = 100;
const FR = 30;

// Deterministik rastgele: aynı girdi aynı dosyayı üretir (gereksiz diff olmaz).
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const ease = (n) => ({ i: { x: Array(n).fill(0.45), y: Array(n).fill(1) }, o: { x: Array(n).fill(0.55), y: Array(n).fill(0) } });
const kf = (frames) => ({
  a: 1,
  k: frames.map(([t, s], idx) => (idx === frames.length - 1 ? { t, s } : { t, s, ...ease(s.length) })),
});
const fixed = (k) => ({ a: 0, k });

const fill = () => ({ ty: 'fl', nm: 'Fill', c: fixed([1, 1, 1, 1]), o: fixed(100), r: 1, bm: 0 });
const groupTransform = () => ({ ty: 'tr', p: fixed([0, 0]), a: fixed([0, 0]), s: fixed([100, 100]), r: fixed(0), o: fixed(100), sk: fixed(0), sa: fixed(0) });

function layer({ ind, name, ip, op, ks, shapes }) {
  return { ddd: 0, ind, ty: 4, nm: name, sr: 1, ks, ao: 0, shapes, ip, op, st: 0, bm: 0 };
}

function starShape(size, points = 4, inner = 0.28) {
  return {
    ty: 'gr',
    nm: 'Star',
    it: [
      { ty: 'sr', nm: 'Polystar', sy: 1, d: 1, pt: fixed(points), p: fixed([0, 0]), r: fixed(0), ir: fixed(size * inner), is: fixed(0), or: fixed(size), os: fixed(0) },
      fill(),
      groupTransform(),
    ],
  };
}

function dotShape(size) {
  return { ty: 'gr', nm: 'Dot', it: [{ ty: 'el', nm: 'Ellipse', d: 1, p: fixed([0, 0]), s: fixed([size, size]) }, fill(), groupTransform()] };
}

function pathShape(vertices, closed = false) {
  const zeros = vertices.map(() => [0, 0]);
  return { ty: 'sh', nm: 'Path', d: 1, ks: fixed({ i: zeros, o: zeros, v: vertices, c: closed }) };
}

function strokeGroup(vertices, width) {
  return {
    ty: 'gr',
    nm: 'Bolt',
    it: [pathShape(vertices), { ty: 'st', nm: 'Stroke', c: fixed([1, 1, 1, 1]), o: fixed(100), w: fixed(width), lc: 2, lj: 2, ml: 4, bm: 0 }, groupTransform()],
  };
}

function animation(name, op, layers) {
  return { v: '5.7.4', fr: FR, ip: 0, op, w: W, h: H, nm: name, ddd: 0, assets: [], layers: layers.map((l, i) => ({ ...l, ind: i + 1 })) };
}

/** Yanıp sönen 4 köşeli yıldızlar (Gold, Holographic, Diamond, Royal Gold) */
function sparkle() {
  const r = rng(11);
  const op = 90;
  const layers = [];
  for (let i = 0; i < 9; i++) {
    const start = Math.floor((op / 9) * i + r() * 6);
    const life = 26 + Math.floor(r() * 14);
    const x = 18 + r() * (W - 36);
    const y = 14 + r() * (H - 28);
    const size = 5 + r() * 6;
    const t0 = start % (op - life);
    layers.push(
      layer({
        name: `c${i % 3}`,
        ip: t0,
        op: t0 + life,
        ks: {
          o: kf([[t0, [0]], [t0 + life * 0.35, [100]], [t0 + life, [0]]]),
          r: kf([[t0, [0]], [t0 + life, [90]]]),
          p: fixed([x, y, 0]),
          a: fixed([0, 0, 0]),
          s: kf([[t0, [10, 10, 100]], [t0 + life * 0.35, [100, 100, 100]], [t0 + life, [20, 20, 100]]]),
        },
        shapes: [starShape(size)],
      }),
    );
  }
  return animation('nick_sparkle', op, layers);
}

/** Aşağıdan yükselen kor ve kıvılcımlar (Fire, Inferno) */
function embers() {
  const r = rng(29);
  const op = 60;
  const layers = [];
  for (let i = 0; i < 14; i++) {
    const life = 22 + Math.floor(r() * 18);
    const t0 = Math.floor(r() * (op - life));
    const x = 10 + r() * (W - 20);
    const drift = (r() - 0.5) * 30;
    const size = 2.5 + r() * 3.5;
    layers.push(
      layer({
        name: `c${i % 3}`,
        ip: t0,
        op: t0 + life,
        ks: {
          o: kf([[t0, [0]], [t0 + life * 0.2, [100]], [t0 + life, [0]]]),
          r: fixed(0),
          p: kf([[t0, [x, H - 6 - r() * 18, 0]], [t0 + life, [x + drift, 4 + r() * 20, 0]]]),
          a: fixed([0, 0, 0]),
          s: kf([[t0, [100, 100, 100]], [t0 + life, [30, 30, 100]]]),
        },
        shapes: [dotShape(size)],
      }),
    );
  }
  return animation('nick_embers', op, layers);
}

/** Kısa elektrik çakmaları (Glitch, Plazma) */
function electric() {
  const r = rng(47);
  const op = 72;
  const layers = [];
  for (let i = 0; i < 6; i++) {
    const t0 = Math.floor((op / 6) * i + r() * 4);
    const life = 5 + Math.floor(r() * 4);
    const x0 = 10 + r() * (W - 60);
    const y0 = 10 + r() * 30;
    const pts = [[x0, y0]];
    for (let k = 0; k < 4; k++) {
      const [px, py] = pts[pts.length - 1];
      pts.push([px + 8 + r() * 10, py + (k % 2 === 0 ? 1 : -1) * (8 + r() * 12) + 6]);
    }
    layers.push(
      layer({
        name: `c${i % 2}`,
        ip: t0,
        op: Math.min(op, t0 + life),
        ks: {
          o: kf([[t0, [100]], [t0 + 1, [30]], [t0 + 2, [100]], [t0 + life, [0]]]),
          r: fixed(0),
          p: fixed([0, 0, 0]),
          a: fixed([0, 0, 0]),
          s: fixed([100, 100, 100]),
        },
        shapes: [strokeGroup(pts, 1.6)],
      }),
    );
  }
  return animation('nick_electric', op, layers);
}

/** Yavaşça süzülen kozmik toz ve yıldızlar (Galaxy, Shadow) */
function stardust() {
  const r = rng(83);
  const op = 120;
  const layers = [];
  for (let i = 0; i < 12; i++) {
    const life = 50 + Math.floor(r() * 50);
    const t0 = Math.floor(r() * (op - life));
    const x = r() * W;
    const y = r() * H;
    const size = 1.6 + r() * 2.4;
    const twinkle = i % 4 === 0;
    layers.push(
      layer({
        name: `c${i % 3}`,
        ip: t0,
        op: t0 + life,
        ks: {
          o: kf([[t0, [0]], [t0 + life * 0.5, [twinkle ? 100 : 70]], [t0 + life, [0]]]),
          r: fixed(0),
          p: kf([[t0, [x, y, 0]], [t0 + life, [x + (r() - 0.5) * 24, y - 6 - r() * 10, 0]]]),
          a: fixed([0, 0, 0]),
          s: fixed([100, 100, 100]),
        },
        shapes: [twinkle ? starShape(size * 1.8, 4, 0.25) : dotShape(size)],
      }),
    );
  }
  return animation('nick_stardust', op, layers);
}

/** Düşen buz kristalleri (Ice) */
function snow() {
  const r = rng(131);
  const op = 120;
  const layers = [];
  for (let i = 0; i < 10; i++) {
    const life = 60 + Math.floor(r() * 50);
    const t0 = Math.floor(r() * (op - life));
    const x = 10 + r() * (W - 20);
    const size = 3 + r() * 3;
    layers.push(
      layer({
        name: `c${i % 2}`,
        ip: t0,
        op: t0 + life,
        ks: {
          o: kf([[t0, [0]], [t0 + life * 0.25, [90]], [t0 + life, [0]]]),
          r: kf([[t0, [0]], [t0 + life, [120]]]),
          p: kf([[t0, [x, 2, 0]], [t0 + life, [x + (r() - 0.5) * 20, H - 4, 0]]]),
          a: fixed([0, 0, 0]),
          s: fixed([100, 100, 100]),
        },
        shapes: [starShape(size, 6, 0.4)],
      }),
    );
  }
  return animation('nick_snow', op, layers);
}

mkdirSync(OUT, { recursive: true });
const files = { sparkle, embers, electric, stardust, snow };
for (const [name, make] of Object.entries(files)) {
  const json = make();
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(json));
  console.log(`${name}.json: ${json.layers.length} katman, ${json.op} kare`);
}
