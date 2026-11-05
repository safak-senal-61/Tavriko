---
name: project-understanding
description: Maps Tavriko architecture, traces data flow and dependencies, and maintains concise project documentation. Use for onboarding, broad feature work, or when architecture is unclear.
---
# Project Understanding

1. Read root `AGENTS.md` and only relevant existing docs.
2. Inspect repository tree while excluding dependencies, build outputs, generated files, caches, and assets.
3. Identify entry points, routes, modules, state management, API boundaries, database access, realtime transport, auth, and test commands from actual source.
4. For a feature, trace its path end-to-end: UI -> state/action -> API/service -> database/realtime -> UI result.
5. Prefer Serena symbol search/references and targeted file reads. Do not dump the repository.
6. Create/update only concise, verified docs:
   - `docs/ARCHITECTURE.md`
   - `docs/MODULE_MAP.md`
   - `docs/DATABASE.md`
   - `docs/REALTIME.md`
   - `docs/TESTING.md`
7. Separate verified facts from assumptions. Never guess schema or runtime behavior.
8. Do not change application code during a documentation-only discovery task.
9. Avoid copying source code into docs; record paths, responsibilities, contracts, and important relationships.
