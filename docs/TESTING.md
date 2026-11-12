# Tavriko — Verified Build & Testing Guide

## 1. Workspace Build Commands
Run from the repository root (`c:\Users\Ömer faruk şener\.gemini\antigravity\scratch\gmae`):

- **Build shared types & scoring (`@trivia/shared`)**:
  ```powershell
  npm run build:shared
  ```
- **Build backend server (`@tavriko/server`)**:
  ```powershell
  npm run build:server
  ```
- **Typecheck Cloudflare Worker & Durable Objects (`@tavriko/realtime`)**:
  ```powershell
  npm run build:cloudflare
  ```
- **Export Expo Web bundle (`@tavriko/client` -> `client/dist`)**:
  ```powershell
  npm run build:client:web
  ```
- **Full Monorepo Build**:
  ```powershell
  npm run build
  ```

## 2. Verified Test Commands
- **Shared Package Unit Tests** (`shared/test/scoring.test.ts`):
  ```powershell
  npm run test:shared
  ```
- **Server Authoritative Game Engine Tests** (`server/test/gameEngine.test.ts`):
  ```powershell
  npm --prefix server test -- gameEngine.test.ts
  ```
- **Server Full Test Suite** (`server/test/*.test.ts`):
  ```powershell
  npm run test:server
  ```
- **Cloudflare Protocol & Validation Tests** (`cloudflare/test/protocol.test.ts`):
  ```powershell
  npm run test:cloudflare
  ```
- **Client Component & Store Tests** (`client/test/`):
  ```powershell
  npm run test:client
  ```

## 3. Repomix Snapshot Generation
A root [`repomix.config.json`](file:///c:/Users/%C3%96mer%20faruk%20%C5%9Fener/.gemini/antigravity/scratch/gmae/repomix.config.json) is configured to exclude `node_modules`, `dist`, `build`, `.git`, `.next`, `coverage`, `.expo`, lockfiles, `.env*`, binary assets, and large JSON seed dumps:
```powershell
npx -y repomix --ignore "node_modules,dist,build,.git,.next,coverage,.expo,*.lock,.env*"
```

## Lig Puanı (LP) kuralları

LP yalnızca sıralı (ranked) maçlarda, yani botsuz 1v1 hızlı eşleşmede değişir (`isRankedMatch`, `shared/src/rewards.ts`).
Galibiyet +20 ve her doğru cevap için +2; mağlubiyet -5; dereceli maçta her yanlış/boş cevap -10 (ayarlardan kapatılabilir).
Galibiyette net kazanç en az +5, LP 0'ın altına düşmez. Testler: `shared/src/leaguePoints.test.ts`.
