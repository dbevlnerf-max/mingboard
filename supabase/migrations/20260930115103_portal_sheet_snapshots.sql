-- Additive cache only. No existing guild, member, participation or distribution
-- table is updated. Back up existing schema before applying in production.
create table if not exists public.portal_sheet_snapshots (
  guild_id text not null,
  source_key text not null,
  query_key text not null,
  action text not null check (action in ('guild', 'distributionList', 'search')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and payload->>'success' = 'true'),
  fetched_at timestamptz not null,
  invalidated_at timestamptz,
  primary key (guild_id, source_key, query_key)
);
alter table public.portal_sheet_snapshots enable row level security;
revoke all on public.portal_sheet_snapshots from public, anon, authenticated;
grant select, insert, update, delete on public.portal_sheet_snapshots to service_role;

-- Older in-flight reads may finish after a newer read. Do not let them overwrite it.
create or replace function public.store_portal_sheet_snapshot(
  p_guild_id text, p_source_key text, p_query_key text, p_action text,
  p_payload jsonb, p_fetched_at timestamptz
) returns void language sql security invoker set search_path = public as $$
  insert into public.portal_sheet_snapshots as snapshot
    (guild_id, source_key, query_key, action, payload, fetched_at, invalidated_at)
  values (p_guild_id, p_source_key, p_query_key, p_action, p_payload, p_fetched_at, null)
  on conflict (guild_id, source_key, query_key) do update
    set action = excluded.action, payload = excluded.payload,
        fetched_at = excluded.fetched_at, invalidated_at = null
    where excluded.fetched_at >= snapshot.fetched_at
      and (snapshot.invalidated_at is null or excluded.fetched_at >= snapshot.invalidated_at);
$$;
revoke all on function public.store_portal_sheet_snapshot(text,text,text,text,jsonb,timestamptz)
  from public, anon, authenticated;
grant execute on function public.store_portal_sheet_snapshot(text,text,text,text,jsonb,timestamptz)
  to service_role;

-- Rollback after reverting the application commit:
-- drop function public.store_portal_sheet_snapshot(text,text,text,text,jsonb,timestamptz);
-- drop table public.portal_sheet_snapshots;
