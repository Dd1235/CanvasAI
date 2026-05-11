-- Knowledge Graph Embeddings (pgvector)
-- Adds embedding vectors to kg_nodes for semantic node merging.
-- Apply AFTER knowledge_graph.sql.
--
-- Requires the pgvector extension. On Supabase: enable from
-- Dashboard > Database > Extensions > vector.

create extension if not exists vector;

alter table public.kg_nodes
  add column if not exists embedding vector(1536);

-- Approximate-nearest-neighbour index. Cosine distance is the natural
-- match for OpenAI embeddings (already L2-normalised, so cosine ~ inner product).
-- Lists=100 is fine for hackathon-scale data; increase as the graph grows.
create index if not exists kg_nodes_embedding_cosine_idx
  on public.kg_nodes
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
