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

## Keşfet kategori görselleri (2026-11)

`cat_*.png` (28 adet, 288px, şeffaf zemin) ve `hero_discover.png` (960px, 16:9)
Keşfet ekranı için üretilmiştir: parlak 3D oyun ikonu stili, altın kenar,
her kategori kendi `primaryColor` rengiyle uyumlu palet. Görseller
`client/src/components/DiscoverArtwork.tsx` içindeki
`DISCOVER_CATEGORY_IMG` ve `HERO_DISCOVER_IMG` ile eşlenir; Keşfet ekranı
(CategoryExploreScreen) bu haritayı kullanır. Sayılar ve metinler uygulama
kodunda render edilir, görsellere gömülmez.

## Alt kategori görselleri (2026-11)

`subs/<alt-kategori-id>.png` — 377 adet, 128px, şeffaf zemin. 4x4 sprite
sayfaları halinde üretilip hücrelere bölünmüştür; alt kategori id'leri
`shared/src/categories.ts` kataloğundaki `subCategories[].id` ile birebir
eşleşir. Eşleme `DiscoverArtwork.tsx` içindeki `DISCOVER_SUBCATEGORY_IMG`
haritası üzerinden Keşfet alt sayfasındaki çiplerde kullanılır. Görselde
metin bulunmaz; soru sayıları uygulama kodunda render edilir.
