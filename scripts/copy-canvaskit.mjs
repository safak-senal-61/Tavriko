// Skia web (CanvasKit) wasm dosyasını client/public'e kopyalar; Expo web derlemesi
// bunu dist köküne (/canvaskit.wasm) taşır. Dosya git'e eklenmez (bkz. .gitignore).
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const clientDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'client');
const require = createRequire(join(clientDir, 'package.json'));
const src = join(dirname(require.resolve('canvaskit-wasm/package.json')), 'bin', 'full', 'canvaskit.wasm');
if (!existsSync(src)) throw new Error(`canvaskit.wasm bulunamadı: ${src}`);
const outDir = join(clientDir, 'public');
mkdirSync(outDir, { recursive: true });
copyFileSync(src, join(outDir, 'canvaskit.wasm'));
console.log('canvaskit.wasm -> client/public/canvaskit.wasm');
