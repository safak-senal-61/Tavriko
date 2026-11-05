# Tavriko — Agent Operating Rules

## Mission
Work as a careful senior engineer on the existing Tavriko codebase. Understand before changing. Preserve working behavior and minimize unrelated edits.

## Context efficiency
- Start with this file and the relevant `docs/` files; do not scan the whole repository for routine tasks.
- Search symbols, imports, routes, API callers, and tests before opening large files.
- Read only relevant ranges. Prefer targeted searches and Serena symbol tools when available.
- Do not generate or attach a full repository dump unless the task genuinely requires architectural discovery.
- Load a skill only when its description matches the current task.
- Do not repeat completed discovery. Update concise docs when architecture changes.
- Never paste secrets, `.env` values, tokens, service-role keys, or credentials into prompts, logs, docs, or commits.

## Engineering rules
- Verify the actual stack, package scripts, file layout, and current implementation before assuming them.
- Do not invent tables, columns, endpoints, environment variables, functions, or business rules.
- Trace a change from UI through state, API, persistence, and realtime effects where applicable.
- Keep changes scoped. Avoid rewrites and new dependencies unless justified.
- Preserve existing authentication, authorization, validation, and security boundaries.
- Treat client input and realtime messages as untrusted.
- Never expose Supabase service-role credentials in client code.
- Use current installed package versions and Context7 when version-specific API details matter.
- Follow existing naming, formatting, error-handling, and testing conventions.

## Required workflow
1. Restate the expected behavior and acceptance criteria briefly.
2. Inspect only relevant files and dependencies; identify the source of truth.
3. Explain the root cause or implementation plan before risky changes.
4. Implement the smallest complete fix.
5. Run relevant tests, type checks, lint, and build scripts that exist.
6. Review the diff for regressions, unrelated edits, secrets, and dead code.
7. Report changed files, verification performed, remaining risks, and anything not tested.

## Do not
- Claim tests passed unless they were actually run.
- silently change database schema or production data.
- alter unrelated screens or modules.
- remove existing functionality to make a test pass.
- assume a feature works merely because a UI element exists.

## Documentation
Keep `docs/` concise and evidence-based. Mark uncertain or unverified behavior explicitly. Update only the relevant document when a meaningful architecture or contract changes.
