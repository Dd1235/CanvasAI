# Feature — Canvas (sessions, turns, time machine)

## What works ✅

- React Flow canvas at [`/dashboard/canvas/[id]`](../frontend/app/dashboard/canvas/%5Bid%5D/page.tsx).
- Local interactivity: drag nodes, connect edges, delete via React Flow's built-in handlers.
- "Run turn" opens a WebSocket to `ws://.../ws/sessions/:id`, streams agent status, and replaces the canvas with the final `{nodes, edges}` payload.
- Deck replay: every turn becomes a clickable step in the side panel.
- "+ New session" dialog: dashboard header, dashboard "Recent sessions" card, and a `+` action in the sidebar's "Sessions" group. All three open the same dialog and call `POST /sessions`.
- Backend graceful degradation: pipeline failures (bad OpenAI key, network) now fall back to deterministic stubs and the WS sends a clean `error` frame instead of dropping the connection.

## What's mocked 🟡

- Storage: in-memory `_LEDGER` and `_SESSIONS` dicts in [`storage/sessions.py`](../backend/src/canvasai/storage/sessions.py). Lost on restart.
- "Restore" button on the workbench resets to the seeded mock state, not to a backend snapshot.
- Frontend canvas seeds new sessions from [`mock-data.ts:getCanvasSession`](../frontend/lib/mock-data.ts#L250-L265) — a session id we've never seen synthesizes a topic from the id and reuses the BST nodes/edges as a starting state.

## What's missing 🔴

- Time machine UI button. The endpoint `POST /sessions/{id}/revert/{turn_index}` exists but no UI calls it. Deck replay only navigates frames visually; it doesn't truncate the backend ledger.
- Per-user scoping. Any signed-in user can list/read every session.
- Persistence across restarts.

## API surface (today)

| Method | Path | File |
|---|---|---|
| `GET` | `/sessions` | [`routes/sessions.py`](../backend/src/canvasai/api/routes/sessions.py) |
| `POST` | `/sessions` | same |
| `GET` | `/sessions/{id}` | same |
| `GET` | `/sessions/{id}/history` | same |
| `POST` | `/sessions/{id}/revert/{turn_index}` | same |
| `WS` | `/ws/sessions/{id}` | [`routes/ws.py`](../backend/src/canvasai/api/routes/ws.py) |

Pydantic models: see [`schemas.py`](../backend/src/canvasai/schemas.py) `SessionSummary`, `SessionDetail`, `SessionTurn`, `CanvasPayload`.

## Turn flow

```mermaid
flowchart TD
  Start[User edits prompt + clicks Run turn] --> Open[Open WebSocket]
  Open --> Send[Send { prompt, nodes, edges }]
  Send --> Status[Stream 4 status frames]
  Status --> Payload[Receive payload frame]
  Payload --> Apply[setNodes, setEdges, push deck frame]
  Apply --> Persist[Backend appends turn to in-memory ledger]
  Open -. timeout / error .-> Fallback[runLocalTurn — append a synthetic node + edge]
```

## DB plan (when we move off in-memory)

Table sketch:

```sql
create table public.canvas_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.canvas_turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.canvas_sessions(id) on delete cascade,
  turn_index int not null,
  prompt text not null,
  payload jsonb not null,           -- {nodes, edges}
  created_at timestamptz not null default now(),
  unique (session_id, turn_index)
);

create index canvas_turns_session_idx on public.canvas_turns(session_id, turn_index);
```

RLS:

```sql
alter table public.canvas_sessions enable row level security;
alter table public.canvas_turns enable row level security;

create policy "owner can read sessions" on public.canvas_sessions
  for select using (user_id = auth.uid());
create policy "owner can write sessions" on public.canvas_sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "owner can read turns" on public.canvas_turns
  for select using (
    exists (select 1 from public.canvas_sessions s where s.id = session_id and s.user_id = auth.uid())
  );
create policy "owner can write turns" on public.canvas_turns
  for all using (
    exists (select 1 from public.canvas_sessions s where s.id = session_id and s.user_id = auth.uid())
  );
```

Replace functions in [`storage/sessions.py`](../backend/src/canvasai/storage/sessions.py) one-for-one. Keep the same signatures — routes don't need to change.

## Time-machine implementation note

Truncating `canvas_turns` (the ledger) is destructive. Two options:

1. **Hard delete** turns ≥ N. Simple, matches today's in-memory `_LEDGER[session_id] = log[: turn_index + 1]` behavior.
2. **Soft branch**: `canvas_turns` gets a `parent_turn_id` and a `branch_id`. Time-traveling forks. Truer to the spec's "Time Machine" framing but more complex.

Hackathon recommendation: **hard delete**. Add branching only if it becomes a UX requirement.

## TODO checklist (sequenced)

- [ ] Add a "Revert" button per deck step that calls `POST /sessions/:id/revert/:turn_index`.
- [ ] Apply the SQL above + RLS.
- [ ] Swap `_LEDGER` / `_SESSIONS` for Supabase queries in [`storage/sessions.py`](../backend/src/canvasai/storage/sessions.py).
- [ ] Pass JWT from frontend → backend (see [feature-auth.md](feature-auth.md)).
- [ ] After persistence: drop the `getCanvasSession` synth fallback in [`mock-data.ts`](../frontend/lib/mock-data.ts) and let the canvas page redirect to `/dashboard` if the id doesn't exist.
- [ ] (Optional) Investigate branching turns if the team wants forkable canvases.
