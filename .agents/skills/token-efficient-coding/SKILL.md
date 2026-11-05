---
name: token-efficient-coding
description: Reduces coding-agent context and token usage by retrieving only relevant symbols, files, and documentation while preserving implementation quality. Use for ordinary coding tasks and large repositories.
---
# Token-Efficient Coding

1. Start from `AGENTS.md`, task-specific docs, and the user's request.
2. Search filenames, symbols, imports, routes, and call sites before opening files.
3. Use Serena for symbol-level reads, references, and edits when connected; otherwise use targeted text search.
4. Read only the smallest code region that establishes behavior. Expand context only when dependencies require it.
5. Avoid whole-repository dumps, repeated summaries, and copying source into chat.
6. Use Context7 only for a library/API question where current version-specific docs matter.
7. Use Repomix only for broad architectural review or portable repository snapshots; exclude lockfiles, dependencies, build artifacts, generated files, secrets, and large assets.
8. Do not sacrifice tests, security, or necessary context just to reduce tokens.
9. In the final report, summarize findings and changed files rather than reproducing code.
