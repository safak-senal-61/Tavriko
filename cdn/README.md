# Tavriko CDN

`client/assets` klasörü (görseller, ses efektleri, müzik) Cloudflare Workers Static Assets ile
`tavriko-cdn` Worker'ı üzerinden dağıtılır. İstemci dosyaları `client/src/utils/cdn.ts` aracılığıyla çeker.

- Canlı adres: `https://tavriko-cdn.uncertainidentity8.workers.dev` (`EXPO_PUBLIC_CDN_URL` ile değiştirilebilir)
- Yeni dosya eklemek: dosyayı `client/assets/...` altına koy, `npm run cdn:manifest` çalıştır, kodda `cdnImage('images/...')` veya `cdnUrl('music/...')` kullan.
- Yayınlamak: `npm run deploy:cdn` (Node 22+ ve `CLOUDFLARE_API_TOKEN` gerekir).
- Önbellek: dosya adresine içerik özeti (`?v=...`) eklenir; dosya değişince adres de değişir.
- Arka plan müziği: `client/assets/music/tavriko_theme.mp3` (özgün, sentezlenmiş 74 sn döngü).
