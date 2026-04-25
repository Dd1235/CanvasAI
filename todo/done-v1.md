# CanvasAI Done V1

## Frontend

- Dashboard shell with authenticated routes, sidebar navigation, topbar, and overview page.
- Canvas workbench with React Flow visualization, prompt box, backend WebSocket streaming, local fallback, agent trace, and seeded demo sessions.
- Deck replay for canvas sessions: each prompt result becomes a step frame with previous/next navigation and clickable replay list.
- Active recall page with session-grouped card review, due counts, SM-2 style review actions, and delete-by-session.
- Chat playground with backend chat session creation and message sending.
- Documents page with staged document library UI.
- Knowledge graph page at `/dashboard/knowledge`.
- Mock knowledge graph payload with topics, relationships, evidence, mastery, confidence, source sessions, disconnected components, and graph update plan.
- Knowledge graph left revision drawer: clicking a topic opens summary, revision prompt, tags, relationships, and evidence.
- Adaptive Study Sprint modal on the knowledge graph:
  - retrieval practice for the weakest topic,
  - prerequisite repair based on prerequisite edges,
  - interleaving by switching to another graph cluster.
- Canvas "Export graph" action wired to the future `POST /knowledge-graph/from-session/{session_id}` endpoint with graceful fallback while backend is missing.
- Frontend API seam for `GET /knowledge-graph/current`.
- Dark-mode React Flow node fix so default canvas nodes use app card background and readable foreground.

## Backend

- FastAPI app with CORS and route registration.
- Canvas sessions API:
  - `GET /sessions`
  - `POST /sessions`
  - `GET /sessions/{session_id}`
  - `GET /sessions/{session_id}/history`
  - `POST /sessions/{session_id}/revert/{turn_index}`
- WebSocket canvas session route at `WS /ws/sessions/{session_id}`.
- LangGraph pipeline with retrieval, context synthesizer, pedagogical architect, and schema enforcer agents.
- OpenAI provider seam:
  - calls OpenAI when `OPENAI_API_KEY` or `OPEN_AI_API` is set,
  - returns deterministic stub output when no key is present.
- Schema enforcer now attempts to parse model JSON for React Flow payloads and falls back to deterministic demo graph when output is invalid.
- Chat API:
  - `POST /chat/sessions`
  - `GET /chat/sessions`
  - `GET /chat/sessions/{session_id}/messages`
  - `POST /chat/sessions/{session_id}/messages`
- Active recall API:
  - `GET /active-recall/cards`
  - `GET /active-recall/sessions`
  - `GET /active-recall/stats`
  - `POST /active-recall/from-session/{session_id}`
  - `POST /active-recall/cards/{card_id}/review`
  - `DELETE /active-recall/sessions/{session_id}`
- Active recall generation is now session-level, not one card per turn.
- Active recall generation asks the LLM for a useful number of cards and falls back to deterministic cards when model output is missing or invalid.
- SM-2 style review scheduling updates repetitions, ease factor, interval, due date, and last-reviewed timestamp.
- Supabase client seam exists for future backend persistence.

## Current Gaps

- Backend session, chat, active recall, and knowledge graph stores are still in-memory or mocked.
- Backend knowledge graph endpoints are not implemented yet:
  - `GET /knowledge-graph/current`
  - `POST /knowledge-graph/from-session/{session_id}`
- Retrieval agent and document vector search are still stubs.
- Document upload/search is not connected to real storage, chunking, embeddings, or pgvector.
- Frontend Supabase auth is wired, but backend user-specific data isolation is not implemented yet.
- Knowledge graph update job is documented but not implemented.

## Learning Science Principles Integrated

- Retrieval practice: Study Sprint asks the user to answer before rereading.
- Spacing: active recall review scheduling uses spaced review intervals.
- Interleaving: Study Sprint switches to a different graph cluster after focused review.
- Prerequisite repair: graph edges identify weak prerequisite relationships before advancing.
- Evidence-backed learning map: every graph node and edge carries source ids for future auditability.

## Verification Run

- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `uv run python -m compileall src`
- FastAPI active recall smoke test
- `uv build`
