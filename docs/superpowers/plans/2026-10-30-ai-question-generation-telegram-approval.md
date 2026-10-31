# AI Soru Üretimi, Telegram Onay Sistemi ve Misafir Oyun Akışı İyileştirmesi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix guest game loop & question result feedback, implement automated AI question generation with Google Gemini API, build a Telegram bot approval and management system for admins, expand database models with review statuses, and integrate an anti-repeat question selection engine.

**Architecture:** 
1. `server/src/db/`: Extended database schema for Questions, Categories, Generation Jobs, and Review History, with content hashing and review statuses (`pending_review`, `approved`, `published`, `rejected`).
2. `server/src/ai/`: Google Gemini AI Question Generator with category-tailored prompts, strict JSON schema output, and a 10-point automatic validation engine.
3. `server/src/telegram/`: Telegram Bot service supporting `/kategori`, `/soru_uret`, `/bekleyenler`, `/istatistik` with inline interactive buttons (Onayla, Reddet, Düzenle, Yeniden Üret, Doğrula) and admin ID security gating.
4. `server/src/routes/triviaRoutes.ts` & `server/src/engine/GameRoomManager.ts`: Authoritative single-player practice & guest game loop, answer validation endpoint (`/api/questions/submit`), timeout management, and anti-repeat history tracker.
5. `client/src/screens/QuizArenaScreen.tsx` & `client/src/navigation/RootNavigator.tsx`: Interactive feedback on answer tap (emerald green for correct, crimson red for wrong, timeout badge), explanation display, seamless question sequencing, and comprehensive post-game summary (correct, wrong, empty, score, accuracy).

**Tech Stack:** Node.js, Express, Socket.IO, Google Gemini API (`@google/genai`), Telegraf / node-telegram-bot-api, React Native / Expo, TypeScript, Jest.

**Spec:** User request: "Multiplayer Bilgi Yarışması, Yapay Zekâ Soru Üretimi ve Telegram Onay Sistemi"

## Global Constraints
- Do not break existing multiplayer socket handlers or working game architecture.
- Only questions with `reviewStatus: 'published'` can enter active game pools.
- AI generated questions MUST be saved as `pending_review` and never published without admin approval.
- Telegram bot operations must strictly verify `TELEGRAM_ADMIN_IDS`.
- Zero-client trust: client cannot declare points or correct answers; server evaluates correctness and timeouts authoritatively.
- Zero-downtime execution: if Gemini API key or Telegram token is omitted in dev, fall back gracefully to mock generators / simulation mode with clear admin notifications.

## Review Focus
1. Guest single player timeout: when timer reaches 0 without answer, server registers as empty/timeout, displays correct answer & explanation, and moves to next question.
2. Multiple answer attempts on the same question: server accepts only the first registered answer and ignores duplicates.
3. Telegram button callbacks: unauthorized Telegram user IDs attempting to click "✅ Onayla" or "❌ Reddet" receive an unauthorized alert.
4. AI JSON parsing & validation: questions with malformed options, missing correct option, or duplicate content hash are rejected before review.
5. Anti-repeat question selection: consecutive practice games for the same guest session do not repeat questions until category pool is exhausted.

---

### Task 1: Fix Guest Gameplay Flow & Authoritative Answer Validation
**Files:**
- Modify: `server/src/routes/triviaRoutes.ts`
- Modify: `server/src/db/dbAdapter.ts`
- Modify: `client/src/screens/QuizArenaScreen.tsx`
- Modify: `client/src/screens/AnswerFeedbackModal.tsx`
- Modify: `client/src/navigation/RootNavigator.tsx`
- Test: `server/test/practiceFlow.test.ts`

**Interfaces:**
- Consumes: `ClientQuestion`, `calculateScore`
- Produces: `POST /api/questions/submit` -> `{ isCorrect, correctOptionId, explanation, pointsAwarded, speedBonus, streak }`, client visual state (green/red/timeout), and end-of-game summary screen.

- [ ] **Step 1: Write test for single-player/guest answer submission and timeout verification**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement authoritative practice submit endpoint in `server/src/routes/triviaRoutes.ts`**
- [ ] **Step 4: Update `QuizArenaScreen.tsx` and `RootNavigator.tsx` to handle option locking, instant color reveal, timeout message, and final game summary**
- [ ] **Step 5: Run tests to verify it passes**
- [ ] **Step 6: Commit Task 1**

---

### Task 2: Extended Database Layer, Review Statuses & Anti-Repeat Engine
**Files:**
- Modify: `shared/src/types.ts`
- Modify: `server/src/db/dbAdapter.ts`
- Modify: `server/src/db/questionsData.ts`
- Test: `server/test/dbAdapter.test.ts`

**Interfaces:**
- Consumes: Question types
- Produces: `reviewStatus` (`pending_review`, `approved`, `published`, `rejected`), `getQuestionsWithAntiRepeat(category, difficulty, count, seenIds)`, `approveQuestion(id)`, `rejectQuestion(id)`, `updateQuestion(id, updates)`, `getStats()`.

- [ ] **Step 1: Write tests for review status transitions and anti-repeat question sampling**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement database models, status queries, content hashing, and anti-repeat history in `server/src/db/dbAdapter.ts`**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit Task 2**

---

### Task 3: AI Question Generation Engine with Google Gemini API & 10-Point Validator
**Files:**
- Create: `server/src/ai/geminiGenerator.ts`
- Create: `server/src/ai/questionValidator.ts`
- Modify: `server/src/server.ts`
- Test: `server/test/aiGenerator.test.ts`

**Interfaces:**
- Consumes: `GEMINI_API_KEY`, Category & Difficulty metadata
- Produces: `generateQuestions({ categoryId, difficulty, count })` -> validated questions saved to DB as `pending_review`.

- [ ] **Step 1: Write unit tests for question validator (10 checks: 4 options, 1 valid answer, non-empty text, duplicate hash)**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement `questionValidator.ts` and `geminiGenerator.ts` with structured prompts and fallback simulator**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit Task 3**

---

### Task 4: Telegram Bot Management & Admin Approval Workflow
**Files:**
- Create: `server/src/telegram/telegramBot.ts`
- Modify: `server/src/server.ts`
- Modify: `server/package.json`
- Test: `server/test/telegramBot.test.ts`

**Interfaces:**
- Consumes: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_IDS`, `DatabaseAdapter`, `GeminiGenerator`
- Produces: Commands `/kategori`, `/soru_uret`, `/bekleyenler`, `/istatistik`, and callback buttons `approve:<id>`, `reject:<id>`, `verify:<id>`, `regen:<id>`.

- [ ] **Step 1: Write unit tests for Telegram bot admin authorization, commands, and callback query handlers**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement `telegramBot.ts` with interactive inline keyboards and audit history logging**
- [ ] **Step 4: Run test to verify it passes**
- [ ] **Step 5: Commit Task 4**

---

### Task 5: End-to-End Verification & Full Regression Testing
**Files:**
- Modify: `scripts/run-all-tests.bat`
- Modify: `README.md`
- Test: Run all monorepo test suites across `shared`, `server`, and `client`.

- [ ] **Step 1: Run all test suites and verify 100% green passing status**
- [ ] **Step 2: Verify mobile Expo bundle and backend server health**
- [ ] **Step 3: Update documentation and finish execution**
