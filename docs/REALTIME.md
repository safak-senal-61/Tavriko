# Tavriko — Verified Realtime, Matchmaking & Game Session Architecture

## 1. Dual Realtime Implementations (Edge Production vs Node Fallback)
Tavriko contains two parallel implementations of the multiplayer state machine:
1. **Production Edge (Active by Default)**: Cloudflare Workers + Durable Objects in [`cloudflare/src/`](file:///c:/Users/%C3%96mer%20faruk%20%C5%9Fener/.gemini/antigravity/scratch/gmae/cloudflare/src) (`wss://tavriko-realtime.uncertainidentity8.workers.dev`). Configured in [`client/src/config.ts`](file:///c:/Users/%C3%96mer%20faruk%20%C5%9Fener/.gemini/antigravity/scratch/gmae/client/src/config.ts) via `DEFAULT_REALTIME_URL`.
2. **Local Node Engine (Dev & Unit Tests)**: [`server/src/engine/GameRoomManager.ts`](file:///c:/Users/%C3%96mer%20faruk%20%C5%9Fener/.gemini/antigravity/scratch/gmae/server/src/engine/GameRoomManager.ts) + [`server/src/engine/Matchmaker.ts`](file:///c:/Users/%C3%96mer%20faruk%20%C5%9Fener/.gemini/antigravity/scratch/gmae/server/src/engine/Matchmaker.ts) + [`server/src/socket/socketHandler.ts`](file:///c:/Users/%C3%96mer%20faruk%20%C5%9Fener/.gemini/antigravity/scratch/gmae/server/src/socket/socketHandler.ts).

## Oda ve düello davetlerinin teslimi

Backend daveti önce PostgreSQL'e kaydeder. Ardından Cloudflare `/api/notify` WebSocket
aktarımı ve cihaz push'u (Expo/FCM) paralel başlar; Vercel yanıtı ikisi de denendikten
sonra döner. Cloudflare yalnızca doğrulanmış alıcı bağlantılarına gönderir. İstemci,
bağlantı yeniden açıldığında kaçan kayıtları bildirim kutusundan alır. Uygulama
arka plandaysa veya kapalıysa WebSocket yerine işletim sistemi push'u kullanılır.

Dağıtımda Vercel ve `tavriko-realtime` Worker'ında `INTERNAL_API_SECRET` aynı
olmalıdır. Worker'ın `JWT_SECRET` değeri backend'in oturum imzalama anahtarıyla
eşleşmelidir. Varsayılan Cloudflare adresini değiştirmek için backend'de
`REALTIME_HTTP_URL`, istemcide `EXPO_PUBLIC_REALTIME_WS_URL` ayarlanabilir.

## 2. Wire Protocol (`cloudflare/src/websocket/protocol.ts`)
All messages over native WebSockets use JSON envelopes:
```json
{
  "event": "string",
  "requestId": "optional_string",
  "payload": {},
  "timestamp": 1762380000000
}
```

## 3. Global Presence & Matchmaking (`MatchmakerDO`)
Implemented in [`cloudflare/src/durable-objects/Matchmaker.ts`](file:///c:/Users/%C3%96mer%20faruk%20%C5%9Fener/.gemini/antigravity/scratch/gmae/cloudflare/src/durable-objects/Matchmaker.ts) (`idFromName('global_matchmaker')`):
- **Live Presence (`/ws/presence`)**:
  - Connecting clients are tagged with `player:<userId>` and `presence` (not auto-enqueued into 1v1 matchmaking).
  - Immediately receives `presence:snapshot` (`{ onlineUserIds, presences }`) and broadcasts `presence:update` and `user:online` to all connected clients.
  - On `webSocketClose`, if no other sockets remain for `player:<userId>`, broadcasts `presence:update` (`online: false`) and `user:offline`.
  - Relays targeted real-time social events (`social:notify` -> `notification:new`, `friends:update`, `notification:update`) to `player:<targetUserId>`.
- **1v1 Matchmaking (`/ws/matchmaking` or `matchmaking:find`)**:
  - Searches `this.queue` for another human player (`findMatchingCandidate`).
  - Schedules a Durable Object alarm for **7 seconds (`MATCH_TIMEOUT_MS = 7000`)**.
  - If a human match is found, calls `createMatch(playerA, playerB)`. If 7 seconds elapse without a human opponent, calls `createBotMatch(entry)` with a Turkish bot persona (`BOT_PROFILES`).
  - Initializes the target `GameRoomDO` via internal `POST https://internal/create-match` and sends `matchmaking:found` (`{ roomCode, mode, category, opponent }`) to the matched player(s).

## 4. Authoritative Game Room Lifecycle (`GameRoomDO`)
Implemented in [`cloudflare/src/durable-objects/GameRoom.ts`](file:///c:/Users/%C3%96mer%20faruk%20%C5%9Fener/.gemini/antigravity/scratch/gmae/cloudflare/src/durable-objects/GameRoom.ts) (`idFromName(roomCode)`):
1. **`lobby`**:
   - Players join via `/ws/room/:code` (`room:create` or `room:join`).
   - Custom rooms (`mode: 'friends'` / `'public'`) strip any bots (`pruneBotsInCustomRoom`) and allow host configuration (`room:update_settings`, `room:kick_player`, `room:toggle_ready`, `room:lobby_chat`).
   - Broadcasts `room:state_sync` (`{ room }`) on every state change.
2. **`countdown`**:
   - Triggered automatically when all duel players connect, or when the host sends `room:start_game`.
   - Loads questions through `ApiService.fetchRoomQuestions` (`POST /api/internal/room-questions`), with built-in questions as a fallback for non-subcategory rooms. If there are fewer unique questions than requested, the room uses the actual count rather than repeating prompts.
   - Runs a 3-second countdown (`COUNTDOWN_DURATION_SEC = 3`) via Durable Object alarms, emitting `game:countdown_tick`.
3. **`question`**:
   - Advances `room.currentRound`, sets `roundStartTimestamp = Date.now()`, resets `hasAnsweredCurrentRound = false` for all players, and broadcasts `game:question_start` with `ClientQuestion` (`correctOptionId` stripped).
   - Schedules a `round_end` Durable Object alarm for `questionTimeSec * 1000` (default 15s).
   - If a bot is in the room (`mode === 'duel'`), schedules a simulated bot answer (`scheduleBotAnswers`).
   - When a player sends `game:submit_answer` (`{ roomCode, playerId, roundNumber, selectedOptionId }`):
     - Rejects submissions for an earlier round when `roundNumber` is included. Older clients may omit it.
     - Rejects duplicate submissions (`player.hasAnsweredCurrentRound === true`).
     - Computes elapsed time server-side (`Date.now() - room.roundStartTimestamp`).
     - Broadcasts `game:player_answered` (`{ playerId, hasAnswered: true }`) **without** broadcasting `room:state_sync` mid-round, preventing premature race-bar movement before all players have answered.
     - Once all connected players have answered (or the `round_end` alarm fires), transitions to `evaluateRound()`.
4. **`round_result`**:
   - `evaluateRound()` calculates each player's points using `calculateScore`, increments `player.correctAnswersCount` by `+1` for a correct answer (`+0` for wrong/timeout), and broadcasts `game:round_result` (`RoundResult` including `correctOptionId`, `explanation`, `playerAnswers`, and `leaderboard` with `correctAnswersCount`).
   - Schedules an `intermission` alarm (`ROUND_INTERMISSION_SEC = 3.5`s) before the next question or game end.
5. **`finished`**:
   - `finishGame()` computes final standings (`calculateRankings`), constructs `FinalMatchSummary` (`podium`, `rankings`, `playedAt`), broadcasts `game:game_over`, and reports the match to `POST /api/matches/complete`.
6. **1v1 leave & quit penalty** (`mode: 'duel' | 'quick_match'`):
   - `create-match` pre-adds matched humans with `isConnected: false`; the countdown starts only after every human has opened the room socket. A `join_timeout` alarm (10 s) cancels the match if someone never connects (`game:opponent_left`, `reason: 'no_show'`, no penalty).
   - `room:leave` in `lobby`/`countdown` cancels the match (`status: 'game_over'`, no match report) and sends `game:opponent_left` (`phase: 'before_start'`) to the other player. In `question_active`/`round_result` it sends `phase: 'in_game'` and finishes the match for the remaining player.
   - Leaving an unfinished match calls `POST /api/internal/duel-quit-penalty`; the backend deducts `DUEL_QUIT_PENALTY_COINS` (10 altın, never below zero) once per `matchId` using a `gameplay_reward_claims` row `duel_quit:<matchId>`. The leaver receives `game:quit_penalty` (`{ amount, balance }`) before its socket closes. A socket drop (not an explicit leave) is never penalized.
   - The client detaches the room socket on leave so it no longer auto-reconnects (and silently rejoins) the room it just left.
7. **Reconnection**:
   - An active duel stores reconnect deadlines separately from the phase deadline, then sets the single Durable Object alarm to the earliest outstanding deadline. A disconnect never replaces the current round or intermission deadline.
   - A reconnecting player receives the room state and the current question with the server's remaining time, without restarting the countdown.
