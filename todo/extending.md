# Extending CanvasAI — recipes

Each recipe is a checklist. Do them top-to-bottom; you should never need to invent new patterns.

---

## Add a new agent to the LangGraph pipeline

1. Create `backend/src/canvasai/agents/<your_agent>.py` subclassing `AgentBase`. Set `role` and `system_prompt`. Implement `__call__(state) -> dict[str, Any]`.
2. Add new keys to `GraphState` in [`graph/state.py`](../backend/src/canvasai/graph/state.py) for any new state fields you read or write.
3. Wire it in [`graph/builder.py`](../backend/src/canvasai/graph/builder.py): import, instantiate, `g.add_node("name", agent)`, `g.add_edge(prev, "name")`, `g.add_edge("name", next)`.
4. (Optional) Append a status frame for the WS by calling `self._trace(state, "...")` — `ws.py` already streams whatever you append.
5. Smoke test:
   ```bash
   cd backend
   uv run python -c "
   import asyncio; from canvasai.graph.builder import build_graph
   asyncio.run(build_graph().ainvoke({'prompt':'hi','nodes':[],'edges':[],'trace':[]}))"
   ```

---

## Add a new LLM provider (Anthropic, Gemini, local Ollama, …)

1. New file `backend/src/canvasai/llm/<name>_provider.py`. Match the `LLMProvider` Protocol (it's structural — just expose `name` and `async def complete(*, system, user) -> str`). **Always degrade to a stub on errors** — see [`openai_provider.py`](../backend/src/canvasai/llm/openai_provider.py) for the pattern.
2. Register it in [`llm/provider.py:_REGISTRY`](../backend/src/canvasai/llm/provider.py).
3. Add any new env vars to `Settings` in [`config.py`](../backend/src/canvasai/config.py) and to `.env.example`.
4. Set `LLM_PROVIDER=<name>` in `.env`. Done — agents pick it up because they only ever call `get_provider()`.

---

## Add a new FastAPI route

1. New file `backend/src/canvasai/api/routes/<area>.py` with an `APIRouter(prefix="/<area>")`.
2. Mount it in [`main.py:create_app()`](../backend/src/canvasai/main.py): `app.include_router(<area>.router)`.
3. Define request/response models in [`schemas.py`](../backend/src/canvasai/schemas.py). Don't return raw dicts — use pydantic models so the OpenAPI docs at `/docs` stay accurate.
4. Add a typed client wrapper in [`frontend/lib/canvasai-api.ts`](../frontend/lib/canvasai-api.ts) (one function per route) and types in [`frontend/lib/canvasai-types.ts`](../frontend/lib/canvasai-types.ts).
5. (Optional) For fallback-while-backend-is-down behavior, follow the pattern in [`canvas-workbench.tsx`](../frontend/components/canvas/canvas-workbench.tsx): call the API in `useEffect`, swallow errors, keep the mock visible.

---

## Add a new shadcn primitive

```bash
cd frontend
pnpm dlx shadcn@latest add <name>
```

That's it. New file lands in [`components/ui/`](../frontend/components/ui/). Don't hand-write anything in `components/ui/` — let shadcn own it.

---

## Add a new Tailark-style block

1. New file `frontend/components/blocks/<your-block>.tsx`.
2. Compose **only** shadcn primitives + Tailwind utilities. No custom CSS.
3. Use `AnimatedGroup` from [`components/ui/animated-group.tsx`](../frontend/components/ui/animated-group.tsx) when you want stagger/blur entry animations.
4. Drop into a page. Marketing/landing pages compose blocks; don't over-abstract.

---

## Add a new sidebar item or new section

Edit `NAV` in [`components/blocks/dashboard-sidebar.tsx`](../frontend/components/blocks/dashboard-sidebar.tsx). Each item is `{ href, label, icon }`. The `pathname` matcher already handles nested routes.

---

## Persist a feature that's currently in-memory

The pattern (proven by mental model — not yet executed in this repo):

1. Decide the table shape. Each `feature-*.md` doc proposes one. If you don't have one, write it now and link from the proposal.
2. Apply the migration. Recommended for hackathon: Supabase Studio → SQL Editor → paste a `CREATE TABLE` from the per-feature doc.
3. Add Row Level Security policies that scope rows to `auth.uid()`. Without RLS, any authed user reads everyone's data.
4. Replace the in-memory functions in `backend/src/canvasai/storage/<feature>.py` one at a time. Keep the function signatures identical — routes don't change.
5. Pass the JWT from frontend so the backend can `auth.uid()` the user. See [feature-auth.md](feature-auth.md).
6. Delete the in-memory dict and the seed function once the DB-backed version is the default.

---

## Add a recurring background job (Inngest)

1. Add a function to [`backend/src/canvasai/inngest_app/functions.py`](../backend/src/canvasai/inngest_app/functions.py): `@inngest_client.create_function(fn_id="...", trigger=inngest.TriggerEvent(event="canvasai/<event>")) async def my_job(ctx): ...`.
2. Append it to the `functions` list in that file.
3. Mount the serve handler on the FastAPI app (not yet wired — add `inngest.fast_api.serve(app, inngest_client, functions)` in [`main.py`](../backend/src/canvasai/main.py)).
4. Trigger from anywhere with `inngest_client.send(events=[inngest.Event(name="canvasai/<event>", data={...})])`.

Use cases that fit Inngest: knowledge-graph rebuild, document chunking + embedding, batched recall reminders, scheduled session digests.

---

## Re-skin the entire app (Tweakcn)

1. Open [tweakcn.com](https://tweakcn.com), pick a palette, export CSS variables.
2. Replace **only** the block between `/* === TWEAKCN TOKENS START ===` and `=== TWEAKCN TOKENS END === */` in [`frontend/app/globals.css`](../frontend/app/globals.css).
3. Don't touch `@theme inline { ... }` above it (those are token *names*, not values) and don't add component CSS anywhere else.

---

## Surface a new page in the dashboard

1. Create `frontend/app/dashboard/<area>/page.tsx`. The dashboard layout wraps it with the sidebar + topbar automatically.
2. Add the page to `NAV` in the sidebar (recipe above).
3. If the page needs server-side auth, the layout already redirects unauth'd users to `/login`. Just call `createClient()` from [`lib/supabase/server.ts`](../frontend/lib/supabase/server.ts) if you need the user object.

---

## Things to NOT do

- **Don't add CSS files.** Tailwind utilities + the one tokens block in `globals.css` is the rule.
- **Don't write custom UI primitives** when shadcn has one. `pnpm dlx shadcn@latest add <name>` first; only diverge when shadcn doesn't ship the primitive.
- **Don't import a concrete LLM provider in an agent.** Always go through `get_provider()`.
- **Don't put secrets in the frontend.** Anon key only. Service-role key stays in `backend/.env`.
- **Don't return raw dicts from FastAPI routes.** Use pydantic models so the OpenAPI schema and the typed frontend client stay in sync.
