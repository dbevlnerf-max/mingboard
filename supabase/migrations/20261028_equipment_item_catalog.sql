-- Equipment item dictionary; source equipment snapshots remain unchanged.
-- Server-only: access mediated by the ADMIN/MASTER equipment API.
create table if not exists public.equipment_item_catalog (
  item_id text primary key,
  item_name text not null,
  slot text not null check (slot in ('무기','보조무기','투구','상의','장갑','망토','신발','하의','귀걸이','허리띠','목걸이','반지')),
  rarity text not null check (rarity in ('rare','hero','legendary')),
  tier smallint not null check (tier between 1 and 9),
  equipment_kind text not null default '',
  job_class text not null default '',
  aliases text[] not null default '{}',
  icon_asset text,
  sprite_index smallint,
  icon_verified boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint equipment_icon_consistency check (
    (icon_asset is null and sprite_index is null) or
    (icon_asset is not null and (sprite_index is null or sprite_index between 0 and 40))
  )
);
create index if not exists equipment_item_catalog_lookup_idx
  on public.equipment_item_catalog (slot, rarity, tier);
alter table public.equipment_item_catalog enable row level security;
revoke all on table public.equipment_item_catalog from anon, authenticated;
grant select, insert, update, delete on table public.equipment_item_catalog to service_role;
