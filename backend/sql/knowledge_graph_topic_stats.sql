-- Per-user-per-topic learning stats that survive across kg_versions rebuilds.
-- node_id is the canonicalized topic key (stable across versions thanks to
-- merge.normalize_topic_key + alias-based reuse), so practice_count carries
-- forward even when a new graph version is appended.
--
-- Also opts kg_versions into the Supabase Realtime publication so the
-- frontend can subscribe to inserts and animate freshly-arrived graph builds
-- without polling.
--

create table if not exists public.kg_topic_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  node_id text not null,
  practice_count int not null default 0,
  last_practiced_at timestamptz,
  last_principle text,
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, node_id)
);

create index if not exists kg_topic_stats_user_practiced_idx
  on public.kg_topic_stats(user_id, last_practiced_at desc nulls last);

alter table public.kg_topic_stats enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'kg_topic_stats'
      and policyname = 'owner crud kg topic stats'
  ) then
    create policy "owner crud kg topic stats" on public.kg_topic_stats
      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

-- Realtime: let the frontend subscribe to kg_versions inserts so the board
-- can refresh + animate new nodes the instant a build finishes. Wrapped in
-- a guard so re-running this migration is a no-op.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'kg_versions'
    ) then
      alter publication supabase_realtime add table public.kg_versions;
    end if;
  end if;
end $$;
