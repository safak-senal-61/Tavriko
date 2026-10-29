# Yeni Nesil Multiplayer Bilgi Yarışması Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, competitive, studio-quality real-time multiplayer trivia mobile game for Android, iOS, and Web with Expo, TypeScript, Node.js Socket.IO server, authoritative game loops, 16 categories, and 22 cohesive screens.

**Architecture:** Monorepo with `shared/` contracts, `server/` running Node.js + Express + Socket.IO with authoritative timer/score state machines, and `client/` running Expo React Native with responsive mobile/web layout, high-performance animations, haptics, and live socket connection.

**Tech Stack:** Expo SDK, React Native, TypeScript, Socket.IO, Express, Prisma/SQLite/Postgres, Jest, Lucide Icons, Audio & Haptics.

**Spec:** `docs/superpowers/specs/2026-10-30-multiplayer-trivia-game-design.md`

## Global Constraints
- Platform support: Android, iOS, and Mobile Web without native build failures.
- Zero-client trust: The server strictly controls question timers, validates answers, computes speed bonuses, and emits outcomes.
- 16 Categories with 4 difficulty levels (Kolay, Orta, Zor, Uzman).
- Modern studio UI/UX: Dark theme `#0D0F17`, vibrant category accents, sleek typography, micro-interactions, no generic AI-template feel.
- Immediate runnable state: Dual-engine database adapter (SQLite / Prisma / Memory fallback) ensuring zero setup pain on any developer machine.

## Review Focus
1. Player disconnects mid-question and reconnects within 10 seconds: must catch up to the current question snapshot without state desynchronization.
2. Latency/jitter compensation: player answers at the last 100ms before server round close; server handles timestamps authoritatively.
3. Rapid spam clicking on answer options: must lock on first registered option and reject subsequent mutation attempts.
4. Room host disconnects: host ownership must gracefully transfer to the next senior player in the room or close if empty.
5. Ties on leaderboard: handled deterministically via average response time (ms) tie-breaker.

---

### Task 1: Shared Contracts, Type System & Game Formulas
**Files:**
- Create: `shared/src/types.ts`
- Create: `shared/src/scoring.ts`
- Create: `shared/src/events.ts`
- Create: `shared/package.json`
- Create: `shared/tsconfig.json`
- Test: `shared/src/scoring.test.ts`

**Interfaces:**
- Consumes: none
- Produces: `GameRoom`, `Player`, `Question`, `QuestionOption`, `GameMode`, `CategoryType`, `calculateScore(timeRemainingMs, totalTimeMs, isCorrect, streak)`, `SocketEvents`.

- [ ] **Step 1: Write the failing tests for scoring formulas**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement shared types, event constants, and scoring formulas**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit shared package**

---

### Task 2: Server Architecture, Authoritative Game Loop & Room State Machine
**Files:**
- Create: `server/src/engine/GameRoomManager.ts`
- Create: `server/src/engine/GameStateMachine.ts`
- Create: `server/src/engine/Matchmaker.ts`
- Create: `server/src/socket/socketHandler.ts`
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Test: `server/test/gameEngine.test.ts`

**Interfaces:**
- Consumes: Shared contracts from Task 1.
- Produces: `GameRoomManager.createRoom()`, `joinRoom()`, `submitAnswer()`, `handleDisconnect()`, `reconnectPlayer()`, `Matchmaker.enqueue()`.

- [ ] **Step 1: Write test for room creation, answer submission, and timer state transitions**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement GameRoomManager, GameStateMachine, Matchmaker, and Socket.IO handlers**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit server core**

---

### Task 3: Backend Database Layer, Seed Questions & REST API
**Files:**
- Create: `server/src/db/dbAdapter.ts`
- Create: `server/src/db/questionsData.ts` (Comprehensive 16-category questions pool with 4 difficulties)
- Create: `server/src/routes/authRoutes.ts`
- Create: `server/src/routes/triviaRoutes.ts`
- Create: `server/src/routes/socialRoutes.ts`
- Create: `server/src/server.ts`
- Test: `server/test/api.test.ts`

**Interfaces:**
- Consumes: `types.ts`, `scoring.ts`
- Produces: REST endpoints (`/api/auth/guest`, `/api/auth/login`, `/api/categories`, `/api/questions/daily`, `/api/leaderboards`, `/api/profile`).

- [ ] **Step 1: Write integration tests for auth, category query, and daily challenge**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement database adapter, 16-category question bank, routes, and Express app**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit REST & DB layer**

---

### Task 4: Client Architecture, Design System, Theme & Sound/Haptics
**Files:**
- Create: `client/package.json`
- Create: `client/app.json`
- Create: `client/tsconfig.json`
- Create: `client/src/theme/tokens.ts` (Gaming palette, typography, elevation, category colors)
- Create: `client/src/services/soundService.ts` (Audio cues, haptic feedback)
- Create: `client/src/services/socketService.ts` (Real-time Socket.IO connection manager)
- Create: `client/src/store/gameStore.ts` (Zustand/Context for user, room, and game state)
- Test: `client/src/theme/theme.test.ts`

**Interfaces:**
- Consumes: `shared/src/types.ts`
- Produces: Theme tokens, Audio/Haptic triggers, Global game stores, Socket client singleton.

- [ ] **Step 1: Write tests for theme tokens and game store actions**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement theme, sound/haptic service, socket client, and state management**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit client foundation**

---

### Task 5: Complete Screen Suite (22 Cohesive Screens)
**Files:**
- Create: `client/src/screens/SplashScreen.tsx`
- Create: `client/src/screens/AuthScreen.tsx`
- Create: `client/src/screens/ProfileSetupScreen.tsx`
- Create: `client/src/screens/HomeScreen.tsx`
- Create: `client/src/screens/CategoryExploreScreen.tsx`
- Create: `client/src/screens/DifficultySelectScreen.tsx`
- Create: `client/src/screens/MatchmakingRadarScreen.tsx`
- Create: `client/src/screens/CustomRoomScreen.tsx`
- Create: `client/src/screens/LobbyScreen.tsx`
- Create: `client/src/screens/QuizArenaScreen.tsx` (Authoritative timer bar, animated 4 options, streak multiplier)
- Create: `client/src/screens/AnswerFeedbackModal.tsx`
- Create: `client/src/screens/IntermissionLeaderboardScreen.tsx`
- Create: `client/src/screens/MatchResultPodiumScreen.tsx` (Podium, XP progress, stat breakdowns)
- Create: `client/src/screens/FriendsScreen.tsx`
- Create: `client/src/screens/ProfileScreen.tsx`
- Create: `client/src/screens/LeaderboardScreen.tsx`
- Create: `client/src/screens/DailyChallengeScreen.tsx`
- Create: `client/src/screens/SinglePlayerPracticeScreen.tsx`
- Create: `client/src/screens/NotificationsScreen.tsx`
- Create: `client/src/screens/SettingsScreen.tsx`
- Create: `client/src/screens/ReconnectScreen.tsx`
- Create: `client/src/screens/ErrorStateScreen.tsx`
- Create: `client/src/navigation/RootNavigator.tsx`
- Test: `client/test/screenNavigation.test.ts`

**Interfaces:**
- Consumes: `gameStore.ts`, `socketService.ts`, `theme/tokens.ts`
- Produces: Polished interactive UI for all 22 required specs.

- [ ] **Step 1: Write tests for navigation and screen rendering transitions**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement all 22 screens with micro-animations, accessible touch targets, and dark gaming UI**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit screen suite**

---

### Task 6: Real-Time Synchronization, Multi-Client Multiplayer Flow & End-to-End Testing
**Files:**
- Create: `server/test/multiplayerSimulation.test.ts`
- Create: `scripts/run-all-tests.bat`
- Create: `README.md` (Quickstart, architecture, features)
- Test: Multi-player concurrency simulation (2-8 simulated clients answering concurrently, verifying exact leaderboard calculations and zero desync).

- [ ] **Step 1: Write end-to-end multi-client simulation test**
- [ ] **Step 2: Run test to verify it passes against the real Socket.IO server**
- [ ] **Step 3: Test reconnection scenario and network drop recovery**
- [ ] **Step 4: Verify Web & Mobile bundle compilation**
- [ ] **Step 5: Final documentation, verification, and commit**
