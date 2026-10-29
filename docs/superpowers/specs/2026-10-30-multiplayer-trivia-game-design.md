# Design Specification: Yeni Nesil Multiplayer Bilgi Yarışması (Next-Gen Multiplayer Trivia)

## 1. Executive Summary & Intent
A production-grade, highly engaging, competitive multiplayer trivia mobile game for iOS, Android, and Mobile Web built with Expo (React Native + TypeScript), Node.js (Socket.IO + Express), PostgreSQL/Prisma (with robust SQLite/memory fallbacks for zero-setup execution), and Redis (with memory cache fallback). The game feels like a modern mobile gaming studio product (Supercell / Trivia Crack 2.0 aesthetic): snappy 60fps animations, rich typography, custom sound/haptic cues, authoritative server-driven game loop, and comprehensive social features.

## 2. Core Architecture & Tech Stack
- **Monorepo Structure**:
  - `shared/`: Type definitions, Game Events, Scoring formulas, Trivia Question types, Room state machine types.
  - `server/`: Node.js, Express, Socket.IO, Prisma / TypeScript, Redis cache & PubSub adapter, bcrypt, jsonwebtoken, Jest test suite.
  - `client/`: Expo / React Native Web/iOS/Android, Expo Router, Lucide icons, Reanimated-ready smooth state animations, sound/haptic utilities, Socket.IO client, robust offline/reconnect handling.
- **Authoritative Server Engine**:
  - The client NEVER calculates scores or decides if answers are correct.
  - Synchronized question timers, server-enforced answer deadlines, anti-cheat answer hashing/verification.
  - State machine: `LOBBY` -> `STARTING_COUNTDOWN` -> `QUESTION_ACTIVE` -> `ANSWER_REVEAL` -> `INTERMISSION_LEADERBOARD` -> `ROUND_NEXT` / `MATCH_FINISHED`.
  - Reconnection recovery with full snapshot synchronization.
- **Database & Persistence**:
  - Users, Profiles, Categories (16 categories), Questions (with 4 difficulty tiers), MatchHistory, PlayerAnswers, Friends, DailyChallenges, Leaderboards, Achievements.
  - Seed script with rich question bank across all 16 specified categories in Turkish and English.

## 3. Game Modes
1. **Quick Match (Hızlı Eşleşme)**: 1-click matchmaking queue with radar animation, paired by MMR.
2. **Play with Friends (Arkadaşlarla Oyna)**: Custom private rooms with 6-character room codes, shareable links, host kick/start controls.
3. **Free-For-All (Herkes Herkese Karşı)**: 2-8 players competing simultaneously on synchronized questions.
4. **Team Battle (Takım Savaşı)**: Red vs Blue team competition with combined scores and MVP honors.
5. **Tournament (Turnuva)**: Knockout bracket rounds.
6. **Daily Challenge (Günlük Meydan Okuma)**: Single daily synchronized seed with global daily leaderboard.
7. **Single Player Practice (Tek Kişilik Pratik)**: Solo category practice with difficulty selection, explanations, and instant stat tracking.

## 4. Scoring Algorithm & Tie-Breakers
- Base Points: 1000 points per correct answer.
- Speed Multiplier: Remaining Time / Total Time bonus (up to +500 speed bonus points).
- Streak Bonus: Consecutive correct answers grant +50, +100, +200 bonus.
- Wrong Answer Penalty: Configurable per mode (0 for casual, -250 for competitive).
- Tie Breaker: Fastest average response time across all questions wins ties.
