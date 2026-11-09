# Visual refresh acceptance and regression checks

## Referral links, daily challenge and equipped-title artwork
- Preserve the purple/gold Tavriko design and existing artwork/fonts. Restore only the selected unlocked title's artwork beside the profile name; the title pill stays text-only.
- Redesign daily challenge without changing configuration, rewards, completion or practice callbacks. Inspect pending/completed states and seven-day tracker at 320px, 375px and desktop/reduced motion.
- Invite-and-earn lives in Friends. Generate a durable opaque personal link with authenticated API access. Capture incoming link before auth/OAuth, persist it safely for up to seven days, then open Friends with a separate inviter preview card, NOT an accepted friend.
- Only explicit "Daveti gönder" confirms mutual friendship. Dismiss clears the pending link; errors preserve it for retry. Self-links and invalid links cannot mutate data.
- Award the inviter 100 in-game coins once per newly registered invited account (created after the link). Existing accounts may connect but earn no referral reward. Database transaction, row locks and unique invitee ledger prevent duplicate/concurrent rewards.
- Read live schema before additive migration. Enable RLS on the new tables with no anonymous policies; do not change existing rows or schemas. Compare existing user/notification row counts before and after migration.
- Verify authenticated ownership, public-preview privacy, invalid/self/deleted links, existing friendship, repeated confirmation, concurrent confirmation and rollback with backend tests; local PostgreSQL integration if available. No real production friendships or wallets may be changed during QA.
- Regression: login/register/reset/guest/category exploration; profile tabs/equip title/settings; notifications seen count; private create/join, matchmaking cancel; friends/code/request actions. Test export and server/client suites, then merge/publish to the existing Vercel project under the user's standing authorization.

### Referral release verification
- Client: 6 suites / 33 tests pass. New referral service/routes: 2 suites / 11 tests pass, including serialization retry and authenticated ownership. Server build and Node 22 Expo web export pass. Client typecheck retains the 11 pre-existing diagnostics, with no new diagnostics.
- Real isolated PostgreSQL: 7 integration tests pass against the checked-in migration, including durable two-way friendship, concurrent repeat confirmations, competing inviters, one reward per new invitee, older accounts, rollback, and anonymous access denial.
- Full server suite: 13 suites pass (73 tests); 3 tests fail in the existing Telegram leaderboard, multiplayer simulation and Prisma fixture suites. All three failures reproduce on untouched main commit `630297d` under the same isolated environment. The PostgreSQL suite is opt-in and skipped without its isolated test URL.
- Browser uses the real exported app with intercepted APIs/WebSockets and synthetic accounts. Verified link capture before login, persistence across reload and login, post-login separate inviter preview, no automatic confirmation, failed confirmation preserving the token, successful confirmation clearing it and refreshing Friends, preview/link error retry, dismissal, personal-link copy and share payload.
- Visually inspected the title artwork beside the name and the text-only title pill. Daily day 1 opens the real five-question challenge; completed day 7 shows Mega Sandık and the explicitly unrewarded practice callback. Checked narrow 320px, 375px and desktop 1280px/reduced-motion layouts; no horizontal page/link overflow or uncaught browser errors in exercised flows.
- Applied the exact additive migration to the existing Tavriko Supabase project. Before/after: 13 users and 13 existing notifications, unchanged; both new tables empty and RLS enabled. No production accounts, friendships, coins or notifications were modified by QA.
- Native iOS/Android runtime, real Google OAuth and real cross-device notification delivery were not exercised. Web persistence is verified; native process-restart persistence is not claimed.

## Seen notifications, plain profile title and private rooms
- Updated behavior: opening the inbox marks all currently loaded notifications seen immediately. New HTTP or WebSocket arrivals are also marked seen while the inbox is open. Invitation acceptance/decline remains a separate explicit action.
- Outside the inbox, a new notification increases the shared badge as before. Check 5 → inbox → 0, new arrivals while open, dismissal of the banner, and persistence after reload.
- Profile identity and home identity must use a known selected unlocked title with plain text only. Remove the decorative image beside the profile name and the icon beside the title; keep collection artwork and unrelated XP/stat icons.
- Private room create/join screens reuse original Tavriko artwork, animated hero illustration, purple cards, live setup summary and responsive six-character code boxes. Preserve all category, difficulty, privacy, password, player-count and room callbacks.
- Verify create parameters, password-required error, join validation and normalized code, public room refresh/selection, category modal, tab cycles, 320px/375px/desktop and reduced-motion layout. Use isolated fixtures only.
- Current automated checks: 5 suites, 27 tests pass. Web export succeeds; the same 11 pre-existing TypeScript diagnostics remain.
- Browser fixtures verified 5 unread → open inbox → 0, a new WebSocket invitation while open remaining seen with its accept action intact, and zero badge after returning/reloading.
- Verified a lower selected unlocked title instead of the level-derived default, switching to another unlocked title, shared home/profile text, zero image beside the profile name and zero icon inside its title pill.
- Verified empty join validation, protected public-room password validation/cancel, normalized join code `AB12CD` reaching the local socket, category selection, room-password validation, and created-room parameters (6 players, 14 questions, 40 seconds, hard difficulty).
- Captured create/join/profile screenshots from the exported app. Both room tabs fit at 320px, and desktop/reduced-motion rendering remained visible without horizontal overflow or uncaught page errors. All traffic used synthetic account/API/WebSocket fixtures; no production account mutations or real multiplayer test.
- Public-room cards now separate readable title/category content from capacity/join controls. Rechecked the complete room title at 320px and protected-room selection after the layout fix; recaptured screenshots with all referenced images loaded.
- Current deployment is included in the user's instruction to publish Tavriko updates directly without repeating approval for this scope.

## Settings, notification and versus follow-up
- Baseline: inspected the real exported settings screen with a synthetic local profile. All audio, game, privacy, sync, password and delete controls exist and must remain accessible.
- Settings: modern illustrated header, compact account summary, sound/game/privacy/account tabs, animated accessible switches. Exercise off/on, volume/difficulty segments, save feedback, sync, password validation/cancel and delete dialog cancel only. Do not mutate production accounts.
- Profile quick settings must use the same switches and artwork and remain linked to advanced settings.
- The requested post-seven-second screen is `DuelVersusScreen`, not the radar. Inspect both bot and real-player variants, player names, countdown, sound toggle and cancellation. Retain the server-owned transition into the quiz.
- All notification bells (home and shared top bar across screens) must show exact unread counts: 0 hides badge, then 1, 2; duplicate IDs must not inflate counts. Cap display at 99+ with an exact accessible label.
- Notification list: illustrated empty/populated/error states, all/unread/invitation filters, explicit read and mark-all-read, accepted/declined statuses, working friend/duel actions with failure rollback.
- New notification events update the shared store immediately and show a dismissible in-app banner. Socket and HTTP duplicates must not create duplicate cards, sounds or banners.
- Read receipts are account-specific on this web device; no database schema migration or cross-device read-sync is included. Test reload, account switching and blocked browser storage.
- Check 320px, 375px, desktop, reduced motion, long notification copy, failed responses, and late HTTP snapshots arriving after a socket event.
- Regression: auth login/register/reset views, guest browsing, category search/filter/modal, all profile tabs and drawer, radar cancel/re-entry.
- Production publication is separate from local verification and requires approval for this new update.

## Follow-up verification record
- Expo web export succeeds under Node 22. All 4 Jest suites and 20 tests pass, including 12 new inbox tests covering duplicate arrivals, stale snapshots, read persistence, account isolation, blocked storage, banner dismissal and failed requests.
- TypeScript still reports 11 pre-existing diagnostics elsewhere in the application. This follow-up introduces no new diagnostics; it also resolves the two missing profile-refresh references and invalid haptic preview argument from the previously recorded baseline of 14.
- Browser checks use the real exported app with an isolated synthetic account and intercepted HTTP/WebSocket traffic. No production account, password, friendships or wallet was changed.
- Verified home badge 0 → 1 → 2, duplicate delivery remaining at 2, one-item read, mark-all-read, reload retaining zero unread, and 101 unread displaying `99+` while exposing the exact accessible count. The shared friends-screen bell uses the same count.
- Verified illustrated inbox and toast, all/unread/invitation filters, accepted and declined invitation state changes, failed invitation responses retaining the action instead of reporting success, and refresh failure preserving the existing cards with a working retry.
- Opening the inbox dismisses the pending banner without implicitly reading the notification; explicit read actions also clear a matching banner. Returning to settings must not replay a stale banner.
- Verified all four settings tabs, switch state exposed to web assistive technology, sound off/on, saved 50% sound volume, sync request, profile quick-settings entry, password validation/cancel and delete-dialog cancel. No password-change or delete request was made.
- Verified bot and real-player versus variants through mocked matchmaking events, Turkish category name, 3-to-0 countdown and honest server-waiting state, sound off/on, cancellation/re-entry, long opponent name, 320px mobile and 1280px desktop layouts, and reduced-motion rendering.
- Screenshots were captured from the application at 375px. Referenced artwork loaded successfully, and no uncaught page errors appeared in these exercised flows.
- Rechecked login/register switching, password-reset view/back, guest browsing and category search against the final exported bundle. Guest mode showed no unread notification badge.
- Native iOS/Android behavior, actual two-player delivery, real credentials and cross-device read synchronization remain untested. The seven-second server matchmaking contract is unchanged; no local fake opponent or question transition was added.
- These follow-up changes are not production-published until the user approves this update.

## Baseline
- Production login opens with login/register tabs, password reset, Google entry and guest browsing.
- Guest browsing opens category exploration, with sign-in promotion, search, group filters and category/subcategory picker.
- Profile has overview, mastery, titles, settings and account tabs; character chooser, edit and share actions.
- Duel matchmaking has player/opponent cards, radar, 7-second bot fallback information and cancellation.

## Requested visual changes
- Login guest browsing uses a dedicated explorer illustration, readable copy and subtle motion.
- Guest promotion has illustrated features, animated artwork and a working sign-in action. Guest permissions remain unchanged.
- All six achievements have individual artwork and explicit unlocked/locked states without changing their rules.
- Four profile stat tiles and five profile tabs have matching visuals. Existing numbers and actions remain unchanged.
- Duel waiting has arena artwork, sonar motion, readable status/progress and cancellation. No changes to matchmaking/network contracts or fallback timing.

## Browser checks
- Login: switch login/register, open/close password reset, inspect guest CTA and enter guest exploration.
- Exploration: sign-in CTA returns to login; search/filter categories and open/close a category.
- Profile: inspect overview, all six achievement states, all five tabs and character drawer with a synthetic local QA user. Do not write production data.
- Duel: inspect searching and bot fallback states; cancel; leave/re-enter and verify timers clean up.
- Viewports: 375px, 320px and desktop; verify no horizontal clipping. Reduced-motion mode keeps artwork and content visible.
- Check console errors and image loading. Authentication/network multiplayer with real accounts requires credentials and is excluded from local fixture testing.

## Initial visual refresh verification record
- Expo web export completed using Node 22. The repository's existing client test suites passed: 3 suites, 8 tests.
- TypeScript baseline was checked in an untouched worktree at `3276973`: 14 diagnostics. The edited version has the same 14 pre-existing diagnostics, with no new diagnostics.
- Browser checks used the real exported application, not recreated screen mockups. Profile and duel used a synthetic local QA user and intercepted API/WebSocket traffic; no production account or data was modified.
- Passed: guest browsing, promotion back to authentication, register/login tab cycle, password-reset view/back, category search, category modal open/close, group filter, all five profile tabs, character drawer open/close, six achievements with two earned/four locked, duel searching, seven-second bot fallback display and cancellation/re-entry.
- Checked 375px mobile, 320px narrow mobile and 1280px desktop. Reduced-motion was enabled during matchmaking; content and timer remained available. No uncaught JavaScript errors or horizontal page overflow appeared in the exercised flows.
- Existing real sign-in, account mutations, native iOS/Android runtime and actual two-player multiplayer were not exercised.
