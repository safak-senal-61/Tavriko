---
name: prompt-optimizer
description: Converts vague feature requests into concise, implementation-ready coding tasks with scope, verified context, edge cases, and acceptance criteria. Use when asked to improve or write a prompt for an AI coding agent.
---
# Prompt Optimizer

Turn the user's request into a prompt that is concise but complete.

Include:
- Goal and observable expected behavior.
- Relevant module paths only after verifying them in the repository.
- Current behavior/problem, if supplied.
- Constraints and behaviors that must remain unchanged.
- Important edge cases and failure states.
- Acceptance criteria that can be tested.
- Required checks and a short final report format.

Do not:
- invent file paths, schema, APIs, or implementation details.
- demand a full-project scan for a localized task.
- repeat generic instructions already covered by `AGENTS.md`.
- prescribe a technology before checking the existing architecture.
- inflate the prompt with redundant roleplay or motivational language.

If key information is missing, ask one essential question; otherwise state a reasonable, clearly labeled assumption.
