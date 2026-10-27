-- Catalog sprites can represent up to 200 verified 48px frames.
-- Existing seven-frame assassin icons continue using the default (7).
ALTER TABLE public.equipment_item_catalog
  ADD COLUMN IF NOT EXISTS sprite_columns smallint NOT NULL DEFAULT 7
  CHECK (sprite_columns BETWEEN 1 AND 200);
ALTER TABLE public.equipment_item_catalog
  DROP CONSTRAINT IF EXISTS equipment_icon_consistency;
ALTER TABLE public.equipment_item_catalog
  ADD CONSTRAINT equipment_icon_consistency CHECK (
    (icon_asset IS NULL AND sprite_index IS NULL) OR
    (icon_asset IS NOT NULL AND (sprite_index IS NULL OR sprite_index BETWEEN 0 AND 199))
  );
