-- Süreli kozmetikler: envanterdeki kopyanın kuşanım süresi (saat).
-- Süre seçimi (1 saat / 1 gün / 3 gün / 1 hafta / 30 gün) satın almada belirlenir.
ALTER TABLE "user_inventory_items" ADD COLUMN "durationHours" INTEGER;
