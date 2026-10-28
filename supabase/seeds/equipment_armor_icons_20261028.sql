-- User-supplied verified armor images, 2026-10-28.
-- Replace only armor icons in the item dictionary. Character inventory,
-- equipment ownership/GID, distribution history, and weapon/jewelry icons are untouched.
-- Idempotent; adds catalog records for gloves previously missing in the catalog.
WITH new_icons(item_name, slot, rarity, tier, icon_asset, sprite_index, sprite_columns) AS (
  VALUES
  ('수호자의 망토', '망토', 'hero', 1, '/equipment/icons/armor-hero-20261028.webp', 0, 18),
  ('수호자의 상의', '상의', 'hero', 1, '/equipment/icons/armor-hero-20261028.webp', 1, 18),
  ('수호자의 신발', '신발', 'hero', 1, '/equipment/icons/armor-hero-20261028.webp', 2, 18),
  ('수호자의 장갑', '장갑', 'hero', 1, '/equipment/icons/armor-hero-20261028.webp', 3, 18),
  ('수호자의 투구', '투구', 'hero', 1, '/equipment/icons/armor-hero-20261028.webp', 4, 18),
  ('수호자의 하의', '하의', 'hero', 1, '/equipment/icons/armor-hero-20261028.webp', 5, 18),
  ('학살자의 망토', '망토', 'hero', 1, '/equipment/icons/armor-hero-20261028.webp', 6, 18),
  ('학살자의 상의', '상의', 'hero', 1, '/equipment/icons/armor-hero-20261028.webp', 7, 18),
  ('학살자의 신발', '신발', 'hero', 1, '/equipment/icons/armor-hero-20261028.webp', 8, 18),
  ('학살자의 장갑', '장갑', 'hero', 1, '/equipment/icons/armor-hero-20261028.webp', 9, 18),
  ('학살자의 투구', '투구', 'hero', 1, '/equipment/icons/armor-hero-20261028.webp', 10, 18),
  ('학살자의 하의', '하의', 'hero', 1, '/equipment/icons/armor-hero-20261028.webp', 11, 18),
  ('영웅의 망토', '망토', 'hero', 2, '/equipment/icons/armor-hero-20261028.webp', 12, 18),
  ('영웅의 상의', '상의', 'hero', 2, '/equipment/icons/armor-hero-20261028.webp', 13, 18),
  ('영웅의 신발', '신발', 'hero', 2, '/equipment/icons/armor-hero-20261028.webp', 14, 18),
  ('영웅의 장갑', '장갑', 'hero', 2, '/equipment/icons/armor-hero-20261028.webp', 15, 18),
  ('영웅의 투구', '투구', 'hero', 2, '/equipment/icons/armor-hero-20261028.webp', 16, 18),
  ('영웅의 하의', '하의', 'hero', 2, '/equipment/icons/armor-hero-20261028.webp', 17, 18),
  ('승리의 망토', '망토', 'rare', 4, '/equipment/icons/armor-rare-20261028.webp', 0, 30),
  ('승리의 상의', '상의', 'rare', 4, '/equipment/icons/armor-rare-20261028.webp', 1, 30),
  ('승리의 신발', '신발', 'rare', 4, '/equipment/icons/armor-rare-20261028.webp', 2, 30),
  ('승리의 장갑', '장갑', 'rare', 4, '/equipment/icons/armor-rare-20261028.webp', 3, 30),
  ('승리의 투구', '투구', 'rare', 4, '/equipment/icons/armor-rare-20261028.webp', 4, 30),
  ('승리의 하의', '하의', 'rare', 4, '/equipment/icons/armor-rare-20261028.webp', 5, 30),
  ('영광의 망토', '망토', 'rare', 4, '/equipment/icons/armor-rare-20261028.webp', 6, 30),
  ('영광의 상의', '상의', 'rare', 4, '/equipment/icons/armor-rare-20261028.webp', 7, 30),
  ('영광의 신발', '신발', 'rare', 4, '/equipment/icons/armor-rare-20261028.webp', 8, 30),
  ('영광의 장갑', '장갑', 'rare', 4, '/equipment/icons/armor-rare-20261028.webp', 9, 30),
  ('영광의 투구', '투구', 'rare', 4, '/equipment/icons/armor-rare-20261028.webp', 10, 30),
  ('영광의 하의', '하의', 'rare', 4, '/equipment/icons/armor-rare-20261028.webp', 11, 30),
  ('숭고한 망토', '망토', 'rare', 5, '/equipment/icons/armor-rare-20261028.webp', 12, 30),
  ('숭고한 상의', '상의', 'rare', 5, '/equipment/icons/armor-rare-20261028.webp', 13, 30),
  ('숭고한 신발', '신발', 'rare', 5, '/equipment/icons/armor-rare-20261028.webp', 14, 30),
  ('숭고한 장갑', '장갑', 'rare', 5, '/equipment/icons/armor-rare-20261028.webp', 15, 30),
  ('숭고한 투구', '투구', 'rare', 5, '/equipment/icons/armor-rare-20261028.webp', 16, 30),
  ('숭고한 하의', '하의', 'rare', 5, '/equipment/icons/armor-rare-20261028.webp', 17, 30),
  ('찬란한 망토', '망토', 'rare', 5, '/equipment/icons/armor-rare-20261028.webp', 18, 30),
  ('찬란한 상의', '상의', 'rare', 5, '/equipment/icons/armor-rare-20261028.webp', 19, 30),
  ('찬란한 신발', '신발', 'rare', 5, '/equipment/icons/armor-rare-20261028.webp', 20, 30),
  ('찬란한 장갑', '장갑', 'rare', 5, '/equipment/icons/armor-rare-20261028.webp', 21, 30),
  ('찬란한 투구', '투구', 'rare', 5, '/equipment/icons/armor-rare-20261028.webp', 22, 30),
  ('찬란한 하의', '하의', 'rare', 5, '/equipment/icons/armor-rare-20261028.webp', 23, 30),
  ('위대한 망토', '망토', 'rare', 6, '/equipment/icons/armor-rare-20261028.webp', 24, 30),
  ('위대한 상의', '상의', 'rare', 6, '/equipment/icons/armor-rare-20261028.webp', 25, 30),
  ('위대한 신발', '신발', 'rare', 6, '/equipment/icons/armor-rare-20261028.webp', 26, 30),
  ('위대한 장갑', '장갑', 'rare', 6, '/equipment/icons/armor-rare-20261028.webp', 27, 30),
  ('위대한 투구', '투구', 'rare', 6, '/equipment/icons/armor-rare-20261028.webp', 28, 30),
  ('위대한 하의', '하의', 'rare', 6, '/equipment/icons/armor-rare-20261028.webp', 29, 30)
)
UPDATE public.equipment_item_catalog AS c
SET icon_asset = n.icon_asset,
    sprite_index = n.sprite_index,
    sprite_columns = n.sprite_columns,
    icon_verified = true,
    updated_at = now()
FROM new_icons AS n
WHERE c.item_name = n.item_name
  AND c.slot = n.slot
  AND c.rarity = n.rarity
  AND c.tier = n.tier;

WITH new_icons(item_name, slot, rarity, tier, icon_asset, sprite_index, sprite_columns) AS (
  VALUES
  ('수호자의 망토', '망토', 'hero', 1, '/equipment/icons/armor-hero-20261028.webp', 0, 18),
  ('수호자의 상의', '상의', 'hero', 1, '/equipment/icons/armor-hero-20261028.webp', 1, 18),
  ('수호자의 신발', '신발', 'hero', 1, '/equipment/icons/armor-hero-20261028.webp', 2, 18),
  ('수호자의 장갑', '장갑', 'hero', 1, '/equipment/icons/armor-hero-20261028.webp', 3, 18),
  ('수호자의 투구', '투구', 'hero', 1, '/equipment/icons/armor-hero-20261028.webp', 4, 18),
  ('수호자의 하의', '하의', 'hero', 1, '/equipment/icons/armor-hero-20261028.webp', 5, 18),
  ('학살자의 망토', '망토', 'hero', 1, '/equipment/icons/armor-hero-20261028.webp', 6, 18),
  ('학살자의 상의', '상의', 'hero', 1, '/equipment/icons/armor-hero-20261028.webp', 7, 18),
  ('학살자의 신발', '신발', 'hero', 1, '/equipment/icons/armor-hero-20261028.webp', 8, 18),
  ('학살자의 장갑', '장갑', 'hero', 1, '/equipment/icons/armor-hero-20261028.webp', 9, 18),
  ('학살자의 투구', '투구', 'hero', 1, '/equipment/icons/armor-hero-20261028.webp', 10, 18),
  ('학살자의 하의', '하의', 'hero', 1, '/equipment/icons/armor-hero-20261028.webp', 11, 18),
  ('영웅의 망토', '망토', 'hero', 2, '/equipment/icons/armor-hero-20261028.webp', 12, 18),
  ('영웅의 상의', '상의', 'hero', 2, '/equipment/icons/armor-hero-20261028.webp', 13, 18),
  ('영웅의 신발', '신발', 'hero', 2, '/equipment/icons/armor-hero-20261028.webp', 14, 18),
  ('영웅의 장갑', '장갑', 'hero', 2, '/equipment/icons/armor-hero-20261028.webp', 15, 18),
  ('영웅의 투구', '투구', 'hero', 2, '/equipment/icons/armor-hero-20261028.webp', 16, 18),
  ('영웅의 하의', '하의', 'hero', 2, '/equipment/icons/armor-hero-20261028.webp', 17, 18),
  ('승리의 망토', '망토', 'rare', 4, '/equipment/icons/armor-rare-20261028.webp', 0, 30),
  ('승리의 상의', '상의', 'rare', 4, '/equipment/icons/armor-rare-20261028.webp', 1, 30),
  ('승리의 신발', '신발', 'rare', 4, '/equipment/icons/armor-rare-20261028.webp', 2, 30),
  ('승리의 장갑', '장갑', 'rare', 4, '/equipment/icons/armor-rare-20261028.webp', 3, 30),
  ('승리의 투구', '투구', 'rare', 4, '/equipment/icons/armor-rare-20261028.webp', 4, 30),
  ('승리의 하의', '하의', 'rare', 4, '/equipment/icons/armor-rare-20261028.webp', 5, 30),
  ('영광의 망토', '망토', 'rare', 4, '/equipment/icons/armor-rare-20261028.webp', 6, 30),
  ('영광의 상의', '상의', 'rare', 4, '/equipment/icons/armor-rare-20261028.webp', 7, 30),
  ('영광의 신발', '신발', 'rare', 4, '/equipment/icons/armor-rare-20261028.webp', 8, 30),
  ('영광의 장갑', '장갑', 'rare', 4, '/equipment/icons/armor-rare-20261028.webp', 9, 30),
  ('영광의 투구', '투구', 'rare', 4, '/equipment/icons/armor-rare-20261028.webp', 10, 30),
  ('영광의 하의', '하의', 'rare', 4, '/equipment/icons/armor-rare-20261028.webp', 11, 30),
  ('숭고한 망토', '망토', 'rare', 5, '/equipment/icons/armor-rare-20261028.webp', 12, 30),
  ('숭고한 상의', '상의', 'rare', 5, '/equipment/icons/armor-rare-20261028.webp', 13, 30),
  ('숭고한 신발', '신발', 'rare', 5, '/equipment/icons/armor-rare-20261028.webp', 14, 30),
  ('숭고한 장갑', '장갑', 'rare', 5, '/equipment/icons/armor-rare-20261028.webp', 15, 30),
  ('숭고한 투구', '투구', 'rare', 5, '/equipment/icons/armor-rare-20261028.webp', 16, 30),
  ('숭고한 하의', '하의', 'rare', 5, '/equipment/icons/armor-rare-20261028.webp', 17, 30),
  ('찬란한 망토', '망토', 'rare', 5, '/equipment/icons/armor-rare-20261028.webp', 18, 30),
  ('찬란한 상의', '상의', 'rare', 5, '/equipment/icons/armor-rare-20261028.webp', 19, 30),
  ('찬란한 신발', '신발', 'rare', 5, '/equipment/icons/armor-rare-20261028.webp', 20, 30),
  ('찬란한 장갑', '장갑', 'rare', 5, '/equipment/icons/armor-rare-20261028.webp', 21, 30),
  ('찬란한 투구', '투구', 'rare', 5, '/equipment/icons/armor-rare-20261028.webp', 22, 30),
  ('찬란한 하의', '하의', 'rare', 5, '/equipment/icons/armor-rare-20261028.webp', 23, 30),
  ('위대한 망토', '망토', 'rare', 6, '/equipment/icons/armor-rare-20261028.webp', 24, 30),
  ('위대한 상의', '상의', 'rare', 6, '/equipment/icons/armor-rare-20261028.webp', 25, 30),
  ('위대한 신발', '신발', 'rare', 6, '/equipment/icons/armor-rare-20261028.webp', 26, 30),
  ('위대한 장갑', '장갑', 'rare', 6, '/equipment/icons/armor-rare-20261028.webp', 27, 30),
  ('위대한 투구', '투구', 'rare', 6, '/equipment/icons/armor-rare-20261028.webp', 28, 30),
  ('위대한 하의', '하의', 'rare', 6, '/equipment/icons/armor-rare-20261028.webp', 29, 30)
)
INSERT INTO public.equipment_item_catalog
  (item_id, item_name, slot, rarity, tier, equipment_kind, job_class,
   icon_asset, sprite_index, sprite_columns, icon_verified)
SELECT 'armor_uploaded_' || md5(n.item_name || ':' || n.slot || ':' || n.rarity || ':' || n.tier::text),
       n.item_name, n.slot, n.rarity, n.tier, n.slot, '',
       n.icon_asset, n.sprite_index, n.sprite_columns, true
FROM new_icons AS n
WHERE NOT EXISTS (
  SELECT 1 FROM public.equipment_item_catalog AS c
  WHERE c.item_name = n.item_name AND c.slot = n.slot
    AND c.rarity = n.rarity AND c.tier = n.tier
);