-- Knowledge Graph Persisted MVP
-- This only creates kg_* tables, indexes, and RLS policies

create table if not exists public.kg_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version int not null,
  generated_at timestamptz not null default now(),
  source_summary jsonb not null default '{"sessions":0,"documents":0,"cards":0}'::jsonb,
  update_plan jsonb not null default '{}'::jsonb,
  unique (user_id, version)
);

create table if not exists public.kg_build_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null default 'session_export'
    check (source_type in ('session_export', 'manual_facts', 'user_proposal')),
  session_id uuid references public.canvas_sessions(id) on delete set null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed')),
  request_payload jsonb not null default '{}'::jsonb,
  graph_version_id uuid references public.kg_versions(id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create table if not exists public.kg_nodes (
  graph_version_id uuid not null references public.kg_versions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  title text not null,
  summary text not null,
  revision_prompt text not null,
  mastery numeric(3,2) not null check (mastery >= 0 and mastery <= 1),
  confidence numeric(3,2) not null check (confidence >= 0 and confidence <= 1),
  cluster text not null,
  tags text[] not null default '{}',
  evidence text[] not null default '{}',
  source_session_ids text[] not null default '{}',
  position jsonb not null,
  aliases text[] not null default '{}',
  primary key (graph_version_id, id)
);

create table if not exists public.kg_edges (
  graph_version_id uuid not null references public.kg_versions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  source text not null,
  target text not null,
  relation text not null check (relation in ('prerequisite','extends','analogous','contrasts','debugs')),
  strength numeric(3,2) not null check (strength >= 0 and strength <= 1),
  evidence text not null,
  source_session_ids text[] not null default '{}',
  primary key (graph_version_id, id),
  foreign key (graph_version_id, source) references public.kg_nodes(graph_version_id, id) on delete cascade,
  foreign key (graph_version_id, target) references public.kg_nodes(graph_version_id, id) on delete cascade
);

create index if not exists kg_versions_user_latest_idx
  on public.kg_versions(user_id, version desc);

create index if not exists kg_build_jobs_user_status_idx
  on public.kg_build_jobs(user_id, status, created_at desc);

create index if not exists kg_nodes_user_version_idx
  on public.kg_nodes(user_id, graph_version_id);

create index if not exists kg_edges_user_version_idx
  on public.kg_edges(user_id, graph_version_id);

alter table public.kg_versions enable row level security;
alter table public.kg_build_jobs enable row level security;
alter table public.kg_nodes enable row level security;
alter table public.kg_edges enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'kg_versions' and policyname = 'owner crud kg versions'
  ) then
    create policy "owner crud kg versions" on public.kg_versions
      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'kg_build_jobs' and policyname = 'owner crud kg build jobs'
  ) then
    create policy "owner crud kg build jobs" on public.kg_build_jobs
      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'kg_nodes' and policyname = 'owner crud kg nodes'
  ) then
    create policy "owner crud kg nodes" on public.kg_nodes
      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'kg_edges' and policyname = 'owner crud kg edges'
  ) then
    create policy "owner crud kg edges" on public.kg_edges
      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;
