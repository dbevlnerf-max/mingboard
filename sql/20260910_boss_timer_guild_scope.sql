-- Boss timers: separate data by Discord guild.
-- Run this once in Supabase SQL Editor BEFORE deploying the API branch.

begin;

alter table public.boss_timers
  add column if not exists guild_id text;

-- Preserve old rows without guessing which Discord guild owns them.
update public.boss_timers
set guild_id = 'legacy'
where guild_id is null or btrim(guild_id) = '';

alter table public.boss_timers
  alter column guild_id set default 'legacy';

alter table public.boss_timers
  alter column guild_id set not null;

-- Remove old name-only unique constraints if present.
do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'boss_timers'
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) ~* '^UNIQUE \(name\)$'
  loop
    execute format('alter table public.boss_timers drop constraint %I', r.conname);
  end loop;
end $$;

create unique index if not exists boss_timers_guild_id_name_uidx
  on public.boss_timers (guild_id, name);

create index if not exists boss_timers_guild_id_idx
  on public.boss_timers (guild_id);

commit;

-- Optional check:
-- select guild_id, name, count(*)
-- from public.boss_timers
-- group by guild_id, name
-- order by guild_id, name;
