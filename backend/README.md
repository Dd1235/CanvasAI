# CanvasAI Backend

FastAPI + LangGraph backend for CanvasAI.

## Run

```bash
cp .env.example .env
uv sync
uv run uvicorn canvasai.main:app --reload
```

## Core Endpoints

- `GET /health`
- `GET /sessions`
- `POST /sessions`
- `GET /sessions/{session_id}/history`
- `POST /sessions/{session_id}/revert/{turn_index}`
- `WS /ws/sessions/{session_id}`
- `POST /chat/sessions`
- `GET /chat/sessions/{session_id}/messages`
- `POST /chat/sessions/{session_id}/messages`
- `GET /active-recall/cards`
- `GET /active-recall/sessions`
- `POST /active-recall/from-session/{session_id}`
- `POST /active-recall/cards/{card_id}/review`

Session, chat, and active recall storage are currently in-memory. Frontend auth
uses Supabase, and the backend has a lazy Supabase client, but the backend
stores still need Supabase-backed implementations once the schema is ready.

## LLM

Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL`. Without a key, the provider
returns deterministic stub text so local smoke tests still run. With a key, the
agents call the OpenAI Chat Completions API; JSON parsing fallbacks keep canvas
and recall flows usable when model output is invalid.
