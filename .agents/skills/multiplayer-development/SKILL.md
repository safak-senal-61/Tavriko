---
name: multiplayer-development
description: Designs and debugs Tavriko matchmaking, rooms, WebSocket/realtime events, multiplayer game sessions, synchronization, timers, and scoring. Use for multiplayer or realtime changes.
---
# Multiplayer Development

1. Identify the authoritative server/service and current transport from source; do not assume WebSocket, Supabase Realtime, or Durable Objects are already wired.
2. Trace room lifecycle: create -> join/queue -> match -> start -> answer/progress -> finish -> disconnect/cancel.
3. Define state ownership and allowed transitions. Reject invalid or duplicate transitions.
4. Treat client messages as untrusted; validate identity, room membership, payload, sequence, and permissions server-side.
5. Consider reconnects, late messages, duplicate delivery, race conditions, timeouts, abandoned rooms, and cleanup.
6. Use server-authoritative timestamps/scoring where competitive integrity requires it; do not trust client timers or scores.
7. Keep 10-question and 20-question modes driven by actual configured question count. Derive progress denominator and completion from the session configuration, never hardcode one mode.
8. Ensure cancel/leave stops timers, listeners, subscriptions, and background session progression.
9. Add tests for transitions, simultaneous joins, disconnect/reconnect, cancellation, duplicate events, and both supported game lengths.
10. Document event names and payload contracts only after verifying implementation.
