import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const apiOrigin = (process.env.EXPO_PUBLIC_WEB_API_ORIGIN || 'https://tavriko-app.vercel.app').trim();
const api = URL.parse(apiOrigin);
if (!api || api.protocol !== 'https:' || api.hostname.includes('*') ||
    (apiOrigin !== api.origin && apiOrigin !== `${api.origin}/`)) {
  throw new Error('EXPO_PUBLIC_WEB_API_ORIGIN must be a complete HTTPS origin, without a path or wildcard.');
}

const npm = process.env.npm_execpath;
const build = spawnSync(process.execPath, [npm, '--prefix', 'client', 'run', 'build:web', '--', '--output-dir', 'dist-pages'], {
  cwd: fileURLToPath(root),
  env: { ...process.env, EXPO_PUBLIC_WEB_API_ORIGIN: api.origin },
  stdio: 'inherit',
});
if (build.error) throw build.error;
if (build.status !== 0) process.exit(build.status ?? 1);

const output = new URL('client/dist-pages/', root);
for (const name of ['index.html', 'ads.txt']) {
  if (!existsSync(new URL(name, output))) throw new Error(`Pages export is missing ${name}`);
}
// Pages serves the SPA on /app and the same-origin OAuth return only when
// there is no top-level 404.html. A rewrite to index.html triggers its redirect.
if (existsSync(new URL('404.html', output))) throw new Error('Pages web export must use the default SPA fallback.');
for (const name of ['_redirects', '_headers']) {
  copyFileSync(new URL(`pages/${name}`, root), new URL(name, output));
}
