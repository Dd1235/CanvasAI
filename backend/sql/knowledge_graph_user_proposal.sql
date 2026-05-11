-- Allow `user_proposal` as a kg_build_jobs.source_type so the two-phase
-- extract/review/merge flow can enqueue post-review jobs.
-- Apply AFTER knowledge_graph.sql.

alter table public.kg_build_jobs
  drop constraint if exists kg_build_jobs_source_type_check;

alter table public.kg_build_jobs
  add constraint kg_build_jobs_source_type_check
  check (source_type in ('session_export', 'manual_facts', 'user_proposal'));
