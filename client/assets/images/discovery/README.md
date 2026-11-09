# Discovery and duel artwork

Original AI-generated artwork created for Tavriko's purple, gold and mint visual style.
These are decorative illustrations, not generated interface screenshots.

- `guest_explorer.png`: trimmed transparent compass and trivia portal, up to 384px.
- `badge_*.png`: six individually cropped transparent achievement emblems, 192px each.
- `duel_arena.webp`: 640px arena artwork, compressed for mobile delivery.

The six emblems deliberately match the existing achievement rules: first victory,
response speed, correct-answer streak, 100 correct answers, level five and inventory
collection. Artwork does not determine whether an achievement has been earned.

The components use the operating system's reduced-motion preference. Infinite
animations are stopped on unmount; text and static artwork remain visible.
## Follow-up illustrations

`settings.webp`, `bell.webp`, `robot.webp` and `social.webp` were generated specifically for Tavriko as a transparent four-cell illustration sheet, with the existing guest explorer used only as a visual-style reference. Each cell was cropped and optimized to at most 384 px with transparent WebP compression. Notification counts, settings switches, text and countdowns are rendered by application code, not baked into artwork.
