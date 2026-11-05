---
name: code-review
description: Reviews Tavriko code changes for correctness, regressions, security, performance, maintainability, and missing tests. Use after implementation or when reviewing a pull request/diff.
---
# Code Review

1. Inspect the diff first, then read surrounding code only where needed.
2. Prioritize concrete bugs, security issues, data loss, race conditions, and regressions.
3. Check authorization/RLS, input validation, async cleanup, realtime ordering, and error handling when relevant.
4. Check whether tests cover the changed behavior and meaningful edge cases.
5. Avoid style-only comments unless they affect consistency or maintainability.
6. Report findings by severity with file and line references. If no findings, say so and list checks performed.
7. Do not modify code unless explicitly asked to fix findings.
