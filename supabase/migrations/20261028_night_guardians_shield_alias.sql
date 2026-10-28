-- The approved Knight equipment sheet calls this hero T1 offhand
-- "영웅 1t 수호자의방패 (개인구매)" while the verified HQ icon catalog
-- names the same item "수호자의 대형방패". These names refer to one icon.
-- Do not merge large and small shield entries or modify ownership/history.
UPDATE public.equipment_item_catalog
SET aliases = (
  SELECT ARRAY(
    SELECT DISTINCT name
    FROM unnest(COALESCE(aliases, ARRAY[]::text[]) ||
                ARRAY['수호자의 방패','수호자의방패']::text[]) AS name
    WHERE btrim(name) <> ''
    ORDER BY name
  )
), updated_at = now()
WHERE item_id='hq_offhand_hero_00'
  AND item_name='수호자의 대형방패'
  AND slot='보조무기'
  AND rarity='hero'
  AND tier=1
  AND icon_verified=true;
