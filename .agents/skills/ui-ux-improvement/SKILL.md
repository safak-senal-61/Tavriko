---
name: ui-ux-improvement
description: Improves Tavriko interface quality, visual hierarchy, accessibility, responsive behavior, animations, and perceived performance without breaking existing product behavior.
---
# UI and UX Improvement

1. Inspect the target screen, shared design tokens, component library, navigation, and nearby screens before proposing changes.
2. Preserve Tavriko's established visual identity; avoid generic template redesigns and arbitrary new colors.
3. Define hierarchy, spacing, typography, states, responsive behavior, and accessibility.
4. Include loading, empty, error, disabled, selected, success, and reduced-motion states where applicable.
5. Prefer performant CSS/native animations and existing dependencies. Avoid adding animation libraries without a clear need.
6. Respect platform conventions and the actual runtime (web vs React Native); never copy web-only APIs into native code.
7. Keep interaction behavior intact and test keyboard/touch targets, overflow, and smaller screens.
8. Make only the requested screen/module changes unless shared components genuinely require updates.
