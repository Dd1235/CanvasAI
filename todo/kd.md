# Knowledge Graph TODO

## Done

- Added `/dashboard/knowledge` as a mock-backed knowledge graph page.
- Added a frontend API seam for `GET /knowledge-graph/current`.
- Added a canvas action that will call `POST /knowledge-graph/from-session/{session_id}` when the backend route exists.
- Added a left revision drawer: clicking a topic node opens topic summary, revision prompt, tags, evidence, and connected relationships.
- Added mock disconnected components so the graph can represent unrelated learning islands, not just one connected component.
- Removed the backend state contract from the visible graph surface; this file is now the working notes location.
- Added an adaptive Study Sprint modal that turns the graph into three review actions: retrieval practice, prerequisite repair, and interleaving.

## Current Frontend Contract

The frontend expects this shape from `GET /knowledge-graph/current`:

```ts
type KnowledgeGraphPayload = {
  graph_id: string;
  user_id: string;
  version: number;
  generated_at: string;
  source_summary: {
    sessions: number;
    documents: number;
    cards: number;
  };
  nodes: Array<{
    id: string;
    title: string;
    summary: string;
    revision_prompt: string;
    mastery: number;
    confidence: number;
    cluster: string;
    tags: string[];
    evidence: string[];
    source_session_ids: string[];
    position: { x: number; y: number };
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    relation: "prerequisite" | "extends" | "analogous" | "contrasts" | "debugs";
    strength: number;
    evidence: string;
    source_session_ids: string[];
  }>;
  update_plan: {
    trigger: "session_export" | "nightly_rebuild" | "manual_refresh";
    read_endpoint: string;
    write_endpoint: string;
    algorithm: string;
    notes: string[];
  };
};
```

Mock data lives in `frontend/lib/mock-knowledge-graph.ts`. Replace that fallback after backend graph storage is live.

## Backend Pipeline

1. Collect session artifacts.
   - Prompt text.
   - Final canvas nodes and edges.
   - Deck frames, if stored.
   - Active recall cards and review outcomes.
   - Retrieved document chunks used by the session.

2. Extract candidate concepts and relations.
   - Use an LLM with structured JSON output for topic candidates.
   - Extract relation candidates such as prerequisite, extends, analogous, contrasts, and debugs.
   - Require evidence ids on every topic and edge.

3. Canonicalize and merge.
   - Normalize topic names into stable ids.
   - Compare candidates against existing graph nodes with embeddings plus lexical aliases.
   - Merge when similarity is high; otherwise create a new node.
   - Keep disconnected components when there is no defensible relationship.

4. Score graph state.
   - `mastery`: combine recall review history, session performance, and confidence in generated evidence.
   - `confidence`: estimate how strongly the system believes the node/edge is correct and grounded.
   - `strength`: relation weight from extraction confidence, repeated co-occurrence, and graph algorithm support.

5. Run graph algorithms.
   - Community detection for clusters.
   - Node similarity or link prediction for suggested relationships.
   - PageRank/centrality for important concepts.
   - Layout computation server-side for stable positions, with manual override support later.

6. Persist and notify.
   - Store graph versions in the database.
   - Write topic and edge evidence separately so changes are auditable.
   - Trigger frontend reload by cache invalidation, polling, WebSocket, or SSE after export completes.

## Algorithm Notes

- Use LLMs for extraction, summarization, alias generation, and revision prompt generation.
- Do not let the LLM be the only source of truth for graph structure. Use deterministic merge rules and graph algorithms for stability.
- Allow disconnected components. A user may learn OAuth callbacks and gradient descent in the same week; those should not be forced into one connected graph.
- Recompute clusters after a batch of updates rather than after every single tiny edit, unless the user explicitly requests immediate refresh.
- Keep all nodes and edges evidence-backed. If an edge has no source session/document/card evidence, mark it as suggested rather than accepted.
- For learning recommendations, start with simple heuristics: weakest mastery first, then prerequisite gaps, then a different cluster for interleaving. Replace with a learned policy only after enough review/session data exists.

## Backend Work Remaining

- Add backend schemas for knowledge graph nodes, edges, graph versions, and evidence records.
- Add `GET /knowledge-graph/current`.
- Add `POST /knowledge-graph/from-session/{session_id}`.
- Add an async update job that extracts, merges, scores, persists, and returns a new graph version.
- Decide storage:
  - Supabase Postgres tables are enough for the hackathon and fit the current stack.
  - A graph database such as Neo4j becomes useful if graph algorithms and complex traversals become core product behavior.
- Add frontend refresh trigger after export:
  - Simple option: export endpoint returns `queued: true`; frontend polls `GET /knowledge-graph/current`.
  - Better option: backend emits graph update event over WebSocket/SSE.

## Useful References

- GraphRAG: LLM extraction plus graph communities for global sensemaking over private corpora: https://arxiv.org/abs/2404.16130
- LLM + KG roadmap: LLMs and knowledge graphs are complementary, not substitutes: https://arxiv.org/abs/2306.08302
- Node similarity for suggested relationships: https://neo4j.com/docs/graph-data-science/current/algorithms/node-similarity/
- Link prediction for missing edge suggestions: https://neo4j.com/docs/graph-data-science/current/algorithms/linkprediction/
- Bayesian Knowledge Tracing for mastery state updates: https://jedm.educationaldatamining.org/index.php/JEDM/article/view/35
