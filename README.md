# CanvasAI

Visual, multi-agent tutor that turns a learner's prompts into a live React Flow canvas, a knowledge graph, and a spaced-repetition deck — all backed by real Supabase data, no mock fallback.

## Run

```
chmod +x run_dev.sh
./run_dev.sh
```

Frontend: Next.js 16 (app router, RSC) · Backend: FastAPI + LangGraph + Inngest · Storage: Supabase (Postgres + Realtime).

---

## System design

### Frontend

- **Real-data-first.** The dashboard, sidebar, documents, and knowledge graph all read live state from the FastAPI/Supabase backend on first render. No `mock-data` or `mock-knowledge-graph` files remain; empty states render an explicit "nothing here yet" with a primary action.
- **Tanstack-style query cache (`frontend/lib/session-cache.ts`).** A tiny per-tab in-memory store keyed by stringified `queryKey` gives us:
  - **Stale-while-revalidate** — `staleTime`-gated reads serve the cached payload instantly, then refetch in the background.
  - **Request deduplication** — concurrent `useQuery` / `fetchQuery` calls for the same key share a single in-flight promise.
  - **Cross-component subscriptions** — every entry maintains a `Set<subscriber>`; mutating the cache via `setCached(...)` re-renders every consumer in O(subscribers) without prop-drilling.
  - **Prefetch primitives** — `prefetchSessionHistory(id)` and `prefetchTopSessions(list, n=3)` warm the cache before the user navigates.
- **Hover/focus prefetching** in the sidebar (`onMouseEnter` / `onFocus` on each session row) populates the canvas history cache the moment the user hovers a link. Combined with `prefetchTopSessions(_, 3)` on every sidebar render and on the dashboard home, the 2–3 most recent canvases hydrate without a network round-trip when the user clicks in.
- **Cache + WebSocket synthesis on the canvas page.** New turns streamed over the WebSocket are pushed back into the cache via `setCached(...)`, so re-entering a canvas (e.g. after a branch redirect) hydrates from the latest deck instead of refetching.
- **Realtime + light polling fallback for the knowledge graph.** A Supabase Realtime subscription on `kg_versions` triggers an immediate refetch when an async LLM merge completes; a 15-second silent poll covers environments where Realtime isn't published.
- **Tooltips everywhere.** Radix tooltips (with `delayDuration={150}`) hang off every actionable surface — sidebar nav, canvas workbench buttons (Latest, Recall, Graph, Bookmark, Revert, Branch, Send), KG actions (Add facts, Study sprint, Refresh), recall ratings (Again/Hard/Good/Easy with SRS hints), document staging/select, theme toggle, logout. The score pills in the KG revision panel also expose hover hints explaining what mastery vs. confidence mean.

### Backend (recap)

- **LangGraph multi-agent canvas turn**: Retrieval → Synthesizer → Architect → Schema Enforcer streamed via WebSocket frames (`status` updates, then a terminal `payload` frame).
- **Async knowledge-graph jobs via Inngest**: canvas exports and reviewed proposals enqueue `KNOWLEDGE_GRAPH_REBUILD_EVENT`. The frontend learns about completion either via the Realtime `kg_versions` insert or by polling the build-id.
- **Per-node practice scoring**: `/knowledge-graph/practice` recomputes mastery & confidence on each review and live-patches the latest version's `kg_nodes` row so the UI updates without waiting for a full rebuild.

### Notable UX fixes

- **Mastery / confidence sync.** The KG graph node displays mastery as its top-right percentage; the side panel previously labelled the same area `confidence`, which read as "the two numbers don't match." The revision panel now leads with mastery (matching the node pill) and shows confidence as a second clearly-labelled pill, with hover tooltips explaining each metric.
- **Branch redirects warm the new session's cache** before `router.push`, so the destination canvas paints with its history already loaded.

---

## Tech stack

Next.js 16 · React 19 · Tanstack-style hand-rolled query cache · @xyflow/react · Radix UI · Tailwind v4 · Sonner · Supabase JS · FastAPI · LangGraph · Inngest · Pydantic.
