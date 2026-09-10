-- Boss timer state isolation by Discord guild.
-- Run once in Supabase SQL Editor BEFORE deploying the API branch.
-- Boss configuration (boss_timers) stays global by name.
-- Only mutable timer state is separated per Discord guild.

begin;

alter table public.boss_timer_states
  add column if not exists guild_id text;

update public.boss_timer_states
set guild_id = 'legacy'
where guild_id is null or btrim(guild_id) = '';

alter table public.boss_timer_states
  alter column guild_id set default 'legacy';

alter table public.boss_timer_states
  alter column guild_id set not null;

-- Remove the old boss_id-only unique constraint so each guild can have its own state.
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
      and t.relname = 'boss_timer_states'
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) ~* '^UNIQUE \(boss_id\)$'
  loop
    execute format('alter table public.boss_timer_states drop constraint %I', r.conname);
  end loop;
end $$;

create unique index if not exists boss_timer_states_boss_guild_uidx
  on public.boss_timer_states (boss_id, guild_id);

create index if not exists boss_timer_states_guild_id_idx
  on public.boss_timer_states (guild_id);

-- Keep event history attributable to the originating Discord guild.
alter table public.boss_timer_events
  add column if not exists guild_id text;

update public.boss_timer_events
set guild_id = 'legacy'
where guild_id is null or btrim(guild_id) = '';

alter table public.boss_timer_events
  alter column guild_id set default 'legacy';

create index if not exists boss_timer_events_guild_id_idx
  on public.boss_timer_events (guild_id);

commit;

-- Verification:
-- select boss_id, guild_id, next_spawn_at, updated_at
-- from public.boss_timer_states
-- order by boss_id, guild_id;
