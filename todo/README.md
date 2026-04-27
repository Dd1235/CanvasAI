# `todo/` — Project status & extension docs

Catalogie of what is done and what is not.

## What's in here

| File                                                     | Purpose                                                                                                    |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [status.md](status.md)                                   | One-screen status: what's done, what's mocked, what needs DB. Every feature, every layer.                  |
| [architecture.md](architecture.md)                       | System diagram, request flow, LangGraph pipeline, per-feature data flow — all mermaid.                     |
| [extending.md](extending.md)                             | "How to add an X" recipes — agent, LLM provider, route, shadcn primitive, sidebar item, DB-backed feature. |
| [feature-canvas.md](feature-canvas.md)                   | Canvas turns, time machine, deck replay. Schema + DB plan.                                                 |
| [feature-active-recall.md](feature-active-recall.md)     | SM-2 cards, session-grouped review, generation pipeline, DB plan.                                          |
| [feature-chat.md](feature-chat.md)                       | Standalone learning chat, visualization tools, DB plan.                                                    |
| [feature-documents.md](feature-documents.md)             | Stubbed end-to-end: storage bucket, chunking, embeddings, pgvector, RAG.                                   |
| [feature-knowledge-graph.md](feature-knowledge-graph.md) | Current mock, missing endpoints, references [kd.md](kd.md).                                                |
| [feature-auth.md](feature-auth.md)                       | Supabase Auth wired; per-user data isolation is the next step.                                             |
| [done-v1.md](done-v1.md)                                 | Append-only log of completed work. Don't overwrite — append.                                               |
| [kd.md](kd.md)                                           | Knowledge-graph deep-dive notes (algorithm research, Neo4j vs Postgres tradeoffs).                         |

## Reading order for a new contributor

2. [status.md](status.md) — what works, what's faked.
3. [architecture.md](architecture.md) — mental model.
4. The `feature-*` doc for whatever you're touching.
5. [extending.md](extending.md) — for the "how do I add…" mechanics.

## Conventions used in these docs

- ✅ done · 🟡 mocked / partial · 🔴 missing.
- File references use clickable links (`[file.py](../path/to/file.py)`).
- Mermaid blocks render in GitHub, GitLab, VS Code, and Obsidian.
- Every "DB plan" section names the proposed Postgres tables and columns so the swap from in-memory is mechanical.
