# Tavriko Antigravity Free Kit

## İçerik
- `AGENTS.md`: kısa ve kalıcı proje kuralları
- `.agents/skills/`: 7 görev odaklı skill
- `.agents/mcp_config.json`: Serena + Context7 MCP örnek yapılandırması
- `docs/README.md`: proje hafıza belgeleri için başlangıç

## Kurulum
1. ZIP'i Tavriko repository köküne çıkar.
2. Mevcut `AGENTS.md`, `.agents/` veya `docs/` varsa üzerine yazmadan önce yedekle/birleştir.
3. Windows PowerShell'de `uvx --version` komutunu dene. Yoksa Astral uv'yi kur:
   `winget install --id=astral-sh.uv -e`
   Kurulumdan sonra terminali yeniden aç.
4. Antigravity'de Agent paneli `...` > MCP Servers > Manage MCP Servers > View raw config yolunu aç.
5. Serena ve Context7 bloklarını global `mcp_config.json` içine ekle veya bu paketteki `.agents/mcp_config.json` dosyasını workspace MCP config olarak kullan. Mevcut sunucuları silme; JSON bloklarını birleştir.
6. Antigravity MCP panelinden sunucuları refresh/reload et. Serena ilk çalışmada proje dil sunucusu/index hazırlığı yapabilir.
7. Tavriko workspace'ini yeniden aç. Customizations > Skills bölümünde skill'lerin göründüğünü kontrol et.
8. İlk görev olarak aşağıdaki keşif promptunu kullan.

## MCP açıklamaları
- Serena yerel kod sembolleri ve referansları üzerinde çalışır. İlk kullanımda `uvx` internetten paketi indirir; sonraki çalıştırmalar cache kullanabilir.
- Context7 remote MCP ücretsiz başlangıç kullanımına sahiptir. API anahtarı olmadan düşük limit uygulanabilir. İstersen ücretsiz hesap açıp anahtar ekleyebilirsin; ücretli plana geçme.
- MCP sunucuları sadece ihtiyaç olduğunda çağrılmalı. Gereksiz araçlar bağlamı ve araç listesini şişirebilir.

## Repomix (isteğe bağlı)
Repomix'i sürekli MCP olarak açmak zorunda değilsin. Geniş mimari incelemesi gerektiğinde Tavriko kökünde:
`npx -y repomix --ignore "node_modules,dist,build,.git,.next,coverage,.expo,*.lock,.env*"`
Çıktıyı paylaşmadan önce gizli bilgi içermediğini kontrol et. `.env` dosyalarını hiçbir zaman paketleme. Ignore sözdizimini ve komut seçeneklerini güncel Repomix dokümantasyonundan doğrula.

## İlk keşif promptu
"Read AGENTS.md. Inspect the repository incrementally and create a verified, concise project map in docs/. Do not modify application code. Identify actual entry points, modules, data flows, database access, authentication, realtime/multiplayer implementation, test scripts, and critical dependencies. Use Serena for targeted symbol/reference navigation when available. Do not dump the entire repository. Mark unknowns explicitly. At the end, list created docs and the exact commands that could be run to validate the project."

## Güvenlik
- MCP config dosyasına gerçek token/secret koyma.
- `service_role`, private keys, OAuth secrets ve `.env` değerlerini AI promptlarına veya Git'e ekleme.
- Config'i Git'e eklemeden önce yerel yolları ve erişim kapsamını kontrol et.
