import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { NICK_STYLES } from '@trivia/shared';
import { NICK_SHADER_FILLS, hexToVec4, nickShaderSource, paletteUniforms } from './nickShaders';
import { NickSlotPool, clampQuality, isLowEndDevice, readableColors, resolveNickQuality } from './nickQualityCore';

const require = createRequire(path.join(__dirname, 'nick.test.ts'));

describe('nick kalite kararı', () => {
  it('kapalı tercih ve kapalı animasyonlar her zaman statik', () => {
    expect(resolveNickQuality({ pref: 'off', skiaAvailable: true })).toBe('static');
    expect(resolveNickQuality({ pref: 'full', smoothAnimations: false, skiaAvailable: true })).toBe('static');
  });
  it('otomatik: güçlü cihazda full, düşük donanım / pil tasarrufunda lite, hareketi azalt açıkken statik', () => {
    expect(resolveNickQuality({ skiaAvailable: true })).toBe('full');
    expect(resolveNickQuality({ skiaAvailable: true, lowEnd: true })).toBe('lite');
    expect(resolveNickQuality({ skiaAvailable: true, batterySaver: true })).toBe('lite');
    expect(resolveNickQuality({ skiaAvailable: true, reduceMotion: true })).toBe('static');
  });
  it('Skia olmayan platformda (web) full istenirse lite döner', () => {
    expect(resolveNickQuality({ pref: 'full', skiaAvailable: false })).toBe('lite');
    expect(clampQuality('full', 'lite')).toBe('lite');
    expect(clampQuality('static', 'full')).toBe('static');
  });
  it('düşük donanım tahmini', () => {
    expect(isLowEndDevice({ totalMemory: 2 * 1024 ** 3 })).toBe(true);
    expect(isLowEndDevice({ totalMemory: 8 * 1024 ** 3, yearClass: 2022 })).toBe(false);
    expect(isLowEndDevice({ yearClass: 2016 })).toBe(true);
  });
});

describe('efekt bütçesi', () => {
  it('sınır aşılınca reddeder, öncelikli istek sınırı aşabilir, bırakınca dinleyiciler uyanır', () => {
    const pool = new NickSlotPool(2);
    let woke = 0;
    pool.subscribe(() => woke++);
    expect(pool.tryAcquire(1)).toBe(true);
    expect(pool.tryAcquire(2)).toBe(true);
    expect(pool.tryAcquire(3)).toBe(false);
    expect(pool.tryAcquire(4, true)).toBe(true);
    pool.release(1);
    expect(woke).toBe(1);
    pool.release(99);
    expect(woke).toBe(1);
  });

  it('mutlak sınır (web WebGL bağlam sınırı) öncelikli istekleri de durdurur', () => {
    const pool = new NickSlotPool(1, 2);
    expect(pool.tryAcquire(1)).toBe(true);
    expect(pool.tryAcquire(2, true)).toBe(true);
    expect(pool.tryAcquire(3, true)).toBe(false);
  });
});

describe('palet yardımcıları', () => {
  it('hex → vec4 ve uniform dolgusu', () => {
    expect(hexToVec4('#FF0000')).toEqual([1, 0, 0, 1]);
    const u = paletteUniforms(['#000000']);
    expect(u.n).toBe(2);
    expect(u.c5).toEqual([0, 0, 0, 1]);
  });
  it('lite modda okunaklı renkler seçilir', () => {
    const list = readableColors(['#0B0618', '#4C1D95', '#A78BFA', '#2E1065'], '#A78BFA');
    expect(list.every((c) => c !== '#0B0618')).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(2);
  });
});

describe('nick paketleri', () => {
  it('her paketin dolgusu için shader var', () => {
    for (const s of NICK_STYLES) expect(NICK_SHADER_FILLS).toContain(s.fill);
  });
  it('parçacıklı paketlerin Lottie dosyası mevcut ve geçerli', () => {
    for (const s of NICK_STYLES) {
      if (s.particles.kind === 'none') continue;
      const file = path.resolve(__dirname, '../../../assets/lottie/nick', `${s.particles.kind}.json`);
      expect(existsSync(file)).toBe(true);
      const json = JSON.parse(readFileSync(file, 'utf8'));
      expect(json.layers.length).toBeGreaterThan(0);
      expect(json.op).toBeGreaterThan(json.ip);
      // colorFilters anahtar yolları
      const names = new Set(json.layers.map((l: any) => l.nm));
      expect(names.has('c0')).toBe(true);
    }
  });
});

// Skia'nın kullandığı CanvasKit ile tüm SkSL shader'larını gerçekten derle
describe('SkSL shader derlemesi (CanvasKit)', () => {
  let ckPath: string | null = null;
  try {
    ckPath = require.resolve('canvaskit-wasm/bin/full/canvaskit.js');
  } catch {
    ckPath = null;
  }
  it.skipIf(!ckPath)('tüm dolgu shaderları hatasız derlenir', async () => {
    const init = require(ckPath!);
    const dir = path.dirname(ckPath!);
    const CK = await init({ locateFile: (f: string) => path.join(dir, f) });
    for (const fill of NICK_SHADER_FILLS) {
      const errors: string[] = [];
      const eff = CK.RuntimeEffect.Make(nickShaderSource(fill), (e: string) => errors.push(e));
      expect(errors, fill).toEqual([]);
      expect(eff, fill).toBeTruthy();
      // uniform sayısı: iRes(2) iOrig(2) iTime iSpeed c0..c5(24) n
      expect(eff.getUniformFloatCount(), fill).toBe(2 + 2 + 1 + 1 + 24 + 1);
      eff.delete();
    }
  }, 30_000);
});
