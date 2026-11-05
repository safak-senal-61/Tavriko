---
name: bug-investigation
description: Investigates Tavriko bugs by reproducing behavior, tracing state and event flow, identifying root causes, and validating minimal fixes. Use for defects, regressions, race conditions, and unexpected UI behavior.
---
# Bug Investigation

1. Convert the report into exact expected vs actual behavior and a reproducible sequence.
2. Find the relevant screen/component, state owner, handlers, service/API, persistence, and tests.
3. Search callers and references before changing a symbol.
4. Check lifecycle, stale state, async ordering, duplicate events, cleanup, timers, and error paths where relevant.
5. State the evidence-backed root cause; do not patch symptoms blindly.
6. Implement the smallest complete fix and add/update a regression test when feasible.
7. Verify normal, boundary, cancellation/unmount, retry, and failure paths as relevant.
8. Run targeted checks; report commands and actual outcomes.
9. Do not refactor unrelated modules.
