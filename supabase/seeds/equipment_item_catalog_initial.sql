-- Initial known matches from the user's supplied icon set.
-- IMPORTANT: T1_H*, and T5 offhand files await exact item-name verification.
-- Do not guess image mapping based on tier alone.
insert into public.equipment_item_catalog (
 item_id,item_name,slot,rarity,tier,equipment_kind,job_class,aliases,
 icon_asset,sprite_index,icon_verified
) values
 ('assassin_dagger_hero_t2','영웅의 단검','무기','hero',2,'단검','어쌔신',ARRAY['영웅의 단검'],
 '/equipment/icons/assassin-sprite.webp',1,true),
 ('assassin_dagger_rare_t4','승리의 단검','무기','rare',4,'단검','어쌔신',ARRAY['승리의 단검'],
 '/equipment/icons/assassin-sprite.webp',2,true),
 ('assassin_dagger_rare_t5','찬란한 단검','무기','rare',5,'단검','어쌔신',ARRAY['찬란한 단검'],
 '/equipment/icons/assassin-sprite.webp',4,true),
 ('assassin_dagger_rare_t6','위대한 단검','무기','rare',6,'단검','어쌔신',ARRAY['위대한 단검'],
 '/equipment/icons/assassin-sprite.webp',5,true)
on conflict (item_id) do update set
  item_name=excluded.item_name,slot=excluded.slot,rarity=excluded.rarity,
  tier=excluded.tier,equipment_kind=excluded.equipment_kind,
  job_class=excluded.job_class,aliases=excluded.aliases,
  icon_asset=excluded.icon_asset,sprite_index=excluded.sprite_index,
  icon_verified=excluded.icon_verified,updated_at=now();
