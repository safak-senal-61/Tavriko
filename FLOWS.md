# Visual refresh acceptance and regression checks

## Responsive player web app
- At 1032×1376 (13-inch iPad Pro in portrait), Home shows a full-width game banner above the four mode cards. Rotate to landscape: the banner and modes sit side by side. The fixed bottom row must not cover scrollable content in either orientation.
- At 768px, 1032px, 1376px, and 1920px, switch through Oyna, Keşfet, Liderler, Arkadaşlar, and Profil: the outer frame and bottom navigation must keep the same horizontal and vertical position. Test the Lig Puanı and Toplam XP tabs and scroll to the last player. At desktop width check both columns; portrait tablet keeps the list below the podium.
- Open `/app` signed out: verify the complete splash artwork and that the desktop utility panel does not appear over it. Dismiss the analytics prompt; in a short window both choices must remain reachable without zooming out.
- Cycle through Giriş Yap, Kayıt Ol and Şifremi Unuttum?; enter Misafir olarak göz at, search in Keşfet, open and close a category, and use the guest sign-in card to return to login. Resize without losing text entered in the form.
- With a synthetic signed-in player, verify HIZLI EŞLEŞME and all four game modes, the daily streak, five feature tiles and five bottom tabs. Check inbox and return, open/cancel matchmaking, open the room creation/join tabs and verify quiz answers remain reachable in a short landscape viewport.
- Check portrait mobile (320px and 375px), tablets (768px and 1024px), desktop (1280px and 1568px) and a short desktop window. Keep the phone design, use two columns where there is room, prevent horizontal page overflow, and keep the bottom navigation clear of scrollable content. On desktop, check the QR and both developer shortcuts.
- Check all 30 player routes against `client/src/navigation/webLayout.ts`: dashboard shell, centered workspace, and game/recovery focus layouts. A focus screen can hide the QR panel, but its background fills the frame and the content remains readable. A dashboard or workspace does not leave an empty QR lane.
- Profil: confirm the identity card, the five profile tabs and the summary grid share the same left and right edges. Open Ustalık, Unvan, Ayar and Hesap; open Karakter and Düzenle; resize and check the last field and save button can be reached without changing account data.
- Özel Oda: on desktop and wide iPad, rules and privacy controls sit side by side in Oda Kur; code input and open rooms sit side by side in Odaya Katıl. On a narrow tablet, stack the same sections. Change question count, toggle Oda Şifresi, open/cancel category selection, and verify the form can scroll to Odayı Oluştur. Check empty and populated room lists using fixtures.
- Open Mağaza, Etkinlik, Envanter, Pro Lig and Sezon and check all visible tabs, card columns, and bottom navigation. Open Ayarlar, Bildirimler, Günlük Görev, Arkadaş Profili and practice setup from their entry points; check the last control is reachable by scrolling. Check room lobby, question, intermission, results and recovery states with local fixture data.

## Web guest reload and friend code entry
- Login: dismiss the analytics prompt, switch between “Giriş Yap” and “Kayıt Ol”, and return to login. Select “Misafir olarak göz at” and expect Keşfet and the guest sign-in card, without a registered-user notification badge.
- Reload in Keşfet after entering as a server guest, after the guest endpoint fails, and while it is still pending. Keep the guest restriction and show Keşfet, not the login screen. Existing locally stored `guest_local_` profiles must also restore as guests. Intentionally tapping the guest sign-in card must still open login.
- Friends: with an isolated account, open “+ Arkadaş Ekle”. The code field shows a fixed `TV-`, uppercases typed input, accepts a full pasted code without duplicating its prefix, and leaves `TV-` visible after select-all/backspace or a successful send. An empty suffix does not make a request.
- Switch to “Kullanıcı adıyla ekle” and back. Username submission keeps its original text, and only code submissions get a `TV-` prefix. Verify the API payload, success/error feedback, and check the form at desktop and 375px. Do not send real requests to production accounts.
- Local Chromium QA: confirmed all four guest reload cases (including the legacy profile), deliberate account sign-in and reload, and both friend request modes at 1280px and 375px. Used intercepted API responses and synthetic accounts.

## Mobile room invitations and notification actions
- Home and Friends: one unread notification shows a compact round `1` against the bell; zero hides the badge and wider counts remain readable. Tap the bell to open the inbox and return with the badge cleared.
- Inbox: private room, duel and friend notices get different primary labels. Verify accept and decline dispatch the correct action, only the tapped action shows progress, and an error leaves the invitation actionable.
- Private lobby: create a room, open “Arkadaş Davet Et”, invite a synthetic friend and close/reopen. Check that the frame and divider stay aligned, including a long scrollable list and a narrow viewport.
- Native: expand an Android/iOS push to check OS-rendered labels. Tap “Reddet” and verify the invitation is declined, never joined. Check background and cold-start behavior on a device.
- Browser fixtures verified home/Friends badge geometry and `99+`, the inbox's action labels, accept navigation and decline retry, and creating a room and sending a mock invitation. The 14-friend list stayed inside the dialog at 320px, 375px and desktop widths. No real account or notification was used.
- Client and focused server tests cover native action routing, push payloads, and recipient-only notification updates; actual Android/iOS system notification UI and live push delivery still need device QA.

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
- Deployment verification caught that the legacy Node function deployment continued serving tracked old `client/dist`/`server/dist` despite a successful Git status. Add the documented Node `vercel-build` hook and refresh the intentionally tracked build artifacts. Never treat a successful deployment status alone as proof of updated production code.

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

## Site health and payments

- Kullanıcılar baseline: portal login returns to `/admin/kullanicilar`; eleven canonical links remain visible. The old account table listed only the latest ten records. New workspace must support search, filtering, paging, detail close and profile correction without exposing private account data in the list.
- Account metrics: verify seven Istanbul calendar days (current day labeled partial), independent HTTP telemetry, empty/error states and responsive charts. Test profile cancel, no-op, success, stale-edit handling and insufficient access using synthetic accounts only.
- Accounts workspace verification: desktop and 375px fixture browser exercised charts, filtering, sorting, paging, account lookup, copy ID, matches, no-op, review cancellation and confirmed profile correction. In the isolated Express app, verified sign-in to the original deep link, no-database/telemetry states, all eleven admin routes and logout. API tests cover origin, session, payload allowlist and stale writes. No live records were changed.
- Sign in at `/admin/login`; opening any protected admin route before signing in must return to that exact route after login.
- From `/admin`, navigate through Oyun, Mobil ve QR, Kozmetikler, API Araçları, Canlı Loglar, Kullanıcılar, Moderasyon, Bildirimler, Telegram and Site Sağlığı. Every link has its own URL, active marker, page heading and reload/back behavior. Old `#tab-*` bookmarks resolve to the new URLs.
- Check the simulator/QR, cosmetics previews, a read-only API call, log filters, user/device table overflow, local moderation and push templates, Telegram read-only tools, health pause/refresh and logout. Use synthetic accounts and never send production notifications, mutate production data or perform a new payment during UI QA.
- Verify navigation, content and controls at desktop, 375px and 320px; only wide table containers may scroll horizontally. The public `/app` and Telegram Mini App are not redesigned.
- Open `/admin/health` for protected per-instance diagnostics and Sandbox-only checkout.
- See [Sandbox setup and telemetry scope](docs/polar-sandbox-and-site-health.md). Checkout never grants game items, and TRY purchases are disabled until a separate production integration is approved.

## Admin account operations

- Sign in as support: only the account workspace is visible. Open a synthetic account, save an internal note, then start a compensation above the rolling direct limit. The timeline shows the requester and reason; the balance stays unchanged while pending.
- Sign in as a different approver: open the queue, inspect the account and approve with a reason. Check the balance, both timeline entries and the empty queue. Verify repeat submissions, self-review, expired requests, unrelated roles and over-cap requests are rejected or idempotent as appropriate.
- As moderator: warn, restrict for a fixed time, and lift. Verify the player notification never contains the internal reason. In a staging Worker and backend with the flag enabled, check queue, room entry, active-message recheck, expiry and backend unavailability using synthetic accounts.
- Seed registered completions inside and outside the seven Istanbul days. Verify deduplication, weekly unique/returning counts, new sign-ups with a first match, separate HTTP telemetry and readable mobile charts.
- Use a local `*_qa` PostgreSQL URL in `ADMIN_OPERATIONS_TEST_DATABASE_URL` for database integration tests. See [deployment order, staff roles and limits](docs/admin-accounts.md) before enabling enforcement. Do not verify with production user accounts.
- From player account settings, submit a support request and an appeal using a synthetic account. Verify another player cannot list the request or appeal that moderation event. Assign, start and resolve from the appropriate staff queue; only the public resolution reaches the player.
- Enroll synthetic staff in TOTP, verify the challenge, valid login, rejection of concurrent code replay, pre-enrollment cookies and password-only Basic. Validate the recovery procedure in staging before forcing enrollment.
- Create five distinct compensations across accounts in an hour. Check one pending alert with linked records and independent review; idempotent replays do not count. Seed cohort points at Istanbul midnight and check D1, D7 and incomplete denominators.
# Destek konuşması, personel oturumları ve ilk düello

- Oyuncu destek talebini açar; görevli aynı talepte bilgi ister. Oyuncu konuşmayı yenileyip cevaplar; kayıt görevli kuyruğunda tekrar işlem bekler. Başka oyuncunun mesajları görünmez; kapalı talep yeni yanıt almaz.
- İlk yanıt hedefi geçen açık talepler ekip sorumlusunun gecikenler görünümünde yer alır; yalnızca dahili işlem veya atama süreyi durdurmaz.
- Personel kendi oturumlarını listeler ve başka bir oturumu kapatır. Portal sahibi diğer personelin oturumlarını da kapatabilir. Passkey kurulumu ve doğrulanmış oturumla yeniden giriş, mevcut parola/TOTP seçeneğini bozmaz.
- Hızlı Düello hunisi kayıt, seçim, doğrulanmış eşleşme ve aynı odada tamamlanan maç sayılarını gösterir. Kapsam başlangıcı veya olgunlaşmış kayıt yoksa oran göstermez.
