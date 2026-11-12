import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CDN_BASE, cdnImage, cdnUrl } from '../src/utils/cdn';
import { CDN_MANIFEST } from '../src/generated/cdnManifest';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe('CDN yardımcıları', () => {
  it('adresi içerik özetiyle üretir', () => {
    const url = cdnUrl('/music/tavriko_theme.mp3');
    expect(url.startsWith(`${CDN_BASE}/music/tavriko_theme.mp3?v=`)).toBe(true);
  });

  it('görsel kaynağına bilinen boyutları ekler', () => {
    const src = cdnImage('images/brand/logo_full.png');
    expect(src.uri.startsWith(CDN_BASE)).toBe(true);
    expect(src.width).toBeGreaterThan(0);
    expect(src.height).toBeGreaterThan(0);
  });

  it('kodda kullanılan her CDN yolu client/assets içinde ve manifestte bulunur', () => {
    const files = walk(join(__dirname, '../src')).filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes('generated'));
    const used = new Set<string>();
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/(?:cdnImage|cdnUrl)\(\s*'([^']+)'/g)) used.add(m[1]);
      for (const m of text.matchAll(/'((?:sounds|music)\/[^']+)'/g)) used.add(m[1]);
    }
    expect(used.size).toBeGreaterThan(100);
    const missing = [...used].filter(
      (p) => !existsSync(join(__dirname, '../assets', p)) || !CDN_MANIFEST[p]
    );
    expect(missing).toEqual([]);
  });

  it('manifest assets klasörüyle eşleşir', () => {
    const assetsDir = join(__dirname, '../assets');
    const onDisk = walk(assetsDir)
      .map((f) => f.slice(assetsDir.length + 1))
      .filter((f) => !f.endsWith('.md'));
    expect(Object.keys(CDN_MANIFEST).sort()).toEqual(onDisk.sort());
  });
});
