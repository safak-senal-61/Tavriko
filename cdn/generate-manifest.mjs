// client/assets içindeki görsel/ses dosyaları için CDN manifestini üretir.
// Çıktı: client/src/generated/cdnManifest.ts  (yol -> [genişlik, yükseklik, içerik özeti])
// Çalıştırma: node cdn/generate-manifest.mjs
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assetsDir = join(root, 'client', 'assets');
const outFile = join(root, 'client', 'src', 'generated', 'cdnManifest.ts');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function pngSize(b) {
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}
function jpegSize(b) {
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1];
    const len = b.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    }
    i += 2 + len;
  }
  return [0, 0];
}
function webpSize(b) {
  const fmt = b.toString('ascii', 12, 16);
  if (fmt === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (fmt === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (fmt === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
  }
  return [0, 0];
}

const manifest = {};
for (const file of walk(assetsDir).sort()) {
  const ext = extname(file).toLowerCase();
  if (ext === '.md' || file.includes('/.')) continue;
  const key = relative(assetsDir, file).split('\\').join('/');
  const buf = readFileSync(file);
  let size = [0, 0];
  if (ext === '.png') size = pngSize(buf);
  else if (ext === '.jpg' || ext === '.jpeg') size = jpegSize(buf);
  else if (ext === '.webp') size = webpSize(buf);
  manifest[key] = [size[0], size[1], createHash('sha1').update(buf).digest('hex').slice(0, 8)];
}

mkdirSync(dirname(outFile), { recursive: true });
const body = Object.entries(manifest)
  .map(([k, v]) => `  ${JSON.stringify(k)}: [${v[0]}, ${v[1]}, ${JSON.stringify(v[2])}],`)
  .join('\n');
writeFileSync(
  outFile,
  `// Otomatik üretilir: node cdn/generate-manifest.mjs\n// yol -> [genişlik, yükseklik, içerik özeti]\nexport const CDN_MANIFEST: Record<string, [number, number, string]> = {\n${body}\n};\n`
);
console.log(`${Object.keys(manifest).length} dosya yazıldı -> ${relative(root, outFile)}`);
