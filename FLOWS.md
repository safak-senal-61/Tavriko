# Visual refresh acceptance and regression checks

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

## Verification record
- Expo web export completed using Node 22. The repository's existing client test suites passed: 3 suites, 8 tests.
- TypeScript baseline was checked in an untouched worktree at `3276973`: 14 diagnostics. The edited version has the same 14 pre-existing diagnostics, with no new diagnostics.
- Browser checks used the real exported application, not recreated screen mockups. Profile and duel used a synthetic local QA user and intercepted API/WebSocket traffic; no production account or data was modified.
- Passed: guest browsing, promotion back to authentication, register/login tab cycle, password-reset view/back, category search, category modal open/close, group filter, all five profile tabs, character drawer open/close, six achievements with two earned/four locked, duel searching, seven-second bot fallback display and cancellation/re-entry.
- Checked 375px mobile, 320px narrow mobile and 1280px desktop. Reduced-motion was enabled during matchmaking; content and timer remained available. No uncaught JavaScript errors or horizontal page overflow appeared in the exercised flows.
- Existing real sign-in, account mutations, native iOS/Android runtime and actual two-player multiplayer were not exercised.
