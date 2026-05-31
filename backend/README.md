# CanvasAI Engine (Backend)

The intelligence layer for CanvasAI. Built for extreme low latency and resilience using FastAPI, LangGraph, and WebSockets.

## 🛠 Tech Stack
* **Runtime:** Python 3.12+ (Managed via `uv`)
* **API:** FastAPI + Uvicorn ASGI
* **Orchestration:** LangGraph (StateGraph multi-agent routing)
* **LLM:** Google Gemini 1.5 Flash (`gemini_provider.py`)
* **Background Jobs:** Inngest
* **Schema Validation:** Pydantic (Strict Structured Outputs)

## 🚀 Setup & Execution

We use `uv` for lightning-fast package management.

```bash
# 1. Clone environment
cp .env.example .env

# 2. Sync dependencies
uv sync

# 3. Start the server
uv run uvicorn canvasai.main:app --reload --port 8000

```

## 🧠 Core Architecture Rules

* **The Code Array Rule:** To prevent LLM grammar crashes with `\n` characters in Python/C++ scripts, the `code` field in Pydantic is defined strictly as `list[str]`. The frontend maps this to `<pre>` blocks natively.
* **Python Text Injection:** To prevent generation timeouts, `ai_response` and `step_title` properties are injected into the final payload natively via Python in `schema_enforcer.py`, bypassing the final heavy JSON LLM step.
* **Graceful Degradation:** The WebSocket pipeline handles provider failures gracefully. If an API key fails, it returns deterministic stub outputs via `error` frames without dropping the client connection.