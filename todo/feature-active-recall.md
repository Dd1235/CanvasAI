# Feature — Active Recall

## What works ✅

- SM-2-style scheduling implemented for real in [`storage/active_recall.py:review()`](../backend/src/canvasai/storage/active_recall.py). Maps `again|hard|good|easy` to quality 1/3/4/5, recomputes `repetitions`, `ease_factor`, `interval_days`, `due_at`, `last_reviewed_at` exactly per the SM-2 paper (with `easy` boost and `hard` shrink).
- Card generation **per session** (not per turn): "Add recall" on the canvas calls `POST /active-recall/from-session/{id}`, which asks the LLM for a JSON array of card drafts, then falls back to deterministic drafts in [`storage/active_recall.py:fallback_drafts`](../backend/src/canvasai/storage/active_recall.py#L95-L123) when the model output is missing or invalid. Old cards for that session are replaced.
- Session grouping: `GET /active-recall/sessions` returns `[{session_id, session_title, card_count, due_count, cards: [...]}]`. UI in [`active-recall-board.tsx`](../frontend/components/recall/active-recall-board.tsx) groups review by session.
- Stats endpoint: `GET /active-recall/stats` → `{total_cards, due_cards, sessions}`. Surfaced on the dashboard.
- Delete-by-session: `DELETE /active-recall/sessions/{id}` clears all cards for one session.

## What's mocked 🟡

- **Storage is in-memory.** `_CARDS` dict in [`storage/active_recall.py`](../backend/src/canvasai/storage/active_recall.py). Lost on restart.
- LLM card generation only runs when `OPENAI_API_KEY` is valid. Otherwise the deterministic fallback runs — same shape, smaller card count.

## What's missing 🔴

- Persistence (Postgres).
- Per-user scoping.
- Tag-based filtering (UI doesn't expose it; tags are stored).
- Spaced reminders (Inngest job).

## API surface

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/active-recall/cards` | All cards (filter by `session_id`, `due_only`). |
| `GET` | `/active-recall/sessions` | Cards grouped by session. |
| `GET` | `/active-recall/stats` | Dashboard counters. |
| `POST` | `/active-recall/from-session/{id}` | (Re)generate cards for a session. |
| `POST` | `/active-recall/cards/{id}/review` | Submit `{ rating }` → returns updated card. |
| `DELETE` | `/active-recall/sessions/{id}` | Drop all cards for one session. |

Schemas: [`schemas.py`](../backend/src/canvasai/schemas.py) — `ActiveRecallCard`, `ActiveRecallCardDraft`, `ActiveRecallSessionGroup`, `ActiveRecallStats`, `ActiveRecallReviewRequest`.

## Generation flow

```mermaid
flowchart LR
  Trigger[Canvas → Add recall] --> POST[POST /active-recall/from-session/:id]
  POST --> Sources[Pull session prompt + nodes + edges + recent turns]
  Sources --> LLM[LLM call: produce JSON array of {front, back, tags}]
  LLM -->|valid JSON| Drafts[Card drafts]
  LLM -->|invalid / no key / error| Fallback[fallback_drafts]
  Drafts --> Replace[active_recall.replace_for_session]
  Fallback --> Replace
  Replace --> Cards[(_CARDS dict)]
  Cards --> Resp[ActiveRecallBuildResponse]
```

## SM-2 implementation notes

The implementation in [`storage/active_recall.py:review()`](../backend/src/canvasai/storage/active_recall.py#L133-L177):

| Rating | Quality | Effect |
|---|---|---|
| `again` | 1 | `repetitions = 0`, `interval = 1`, ease drops most |
| `hard` | 3 | `repetitions += 1`, interval × 0.6 (min 1) |
| `good` | 4 | `repetitions += 1`, normal SM-2 interval growth |
| `easy` | 5 | `repetitions += 1`, interval × 1.3 (and at least +2 days) |

Ease floor at 1.3 (matches SM-2). New cards get `due_at = now`, `interval_days = 0`, `ease_factor = 2.5`, `repetitions = 0`.

## DB plan

```sql
create table public.recall_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.canvas_sessions(id) on delete cascade,
  front text not null,
  back text not null,
  tags text[] not null default '{}',
  ease_factor numeric(4,2) not null default 2.5,
  interval_days int not null default 0,
  repetitions int not null default 0,
  due_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recall_cards_due_idx on public.recall_cards(user_id, due_at);
create index recall_cards_session_idx on public.recall_cards(session_id);
```

RLS:
```sql
alter table public.recall_cards enable row level security;
create policy "owner crud cards" on public.recall_cards
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

## TODO checklist

- [ ] Apply the SQL + RLS.
- [ ] Replace `_CARDS` access in [`storage/active_recall.py`](../backend/src/canvasai/storage/active_recall.py) with Supabase queries (signatures stay the same).
- [ ] Move card generation into an Inngest job so the LLM call doesn't block the canvas request.
- [ ] Add tag filter to the recall page UI.
- [ ] Add scheduled reminder (Inngest cron: each morning, list users with `due_cards > 0`, send email or in-app notif).
- [ ] When persistence lands, replace `cards-stats` polling with realtime updates via Supabase subscriptions.
