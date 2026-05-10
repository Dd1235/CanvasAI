#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
SQL_FILE="$BACKEND_DIR/sql/knowledge_graph.sql"
PIDS=()

cleanup() {
  echo ""
  echo "Stopping Knowledge Graph dev services..."
  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      pkill -P "$pid" 2>/dev/null || true
    fi
  done
}
trap cleanup INT TERM EXIT

if [[ ! -f "$SQL_FILE" ]]; then
  echo "Missing SQL file: $SQL_FILE"
  exit 1
fi

echo "Before first run, apply this SQL in Supabase SQL Editor:"
echo "  $SQL_FILE"
echo ""

echo "Checking backend env without printing secrets..."
(
  cd "$BACKEND_DIR"
  uv run python -c "from canvasai.config import get_settings; s=get_settings(); key=s.openai_api_key or ''; checks={'SUPABASE_URL': bool(s.supabase_url), 'SUPABASE_ANON_KEY': bool(s.supabase_anon_key), 'SUPABASE_SERVICE_ROLE_KEY': bool(s.supabase_service_role_key), 'OPENAI_API_KEY': bool(key), 'INNGEST_APP_ID': bool(s.inngest_app_id), 'INNGEST_EVENT_KEY': bool(s.inngest_event_key), 'INNGEST_SIGNING_KEY': bool(s.inngest_signing_key)}; missing=[k for k,v in checks.items() if not v and k not in {'INNGEST_EVENT_KEY','INNGEST_SIGNING_KEY'}]; [print(f'{k}={v}') for k,v in checks.items()]; print(f'OPENAI_MODEL={s.openai_model}'); print(f'LLM_PROVIDER={s.llm_provider}'); print('OPENAI_KEY_FORMAT_OK=' + str(key.startswith('sk-') or key.startswith('sk-proj-'))); print('LOCAL_INNGEST_KEYS_OK=' + str(not checks['INNGEST_EVENT_KEY'] and not checks['INNGEST_SIGNING_KEY'])); raise SystemExit('Missing required env: ' + ', '.join(missing) if missing else 0)"
)

echo ""
echo "Starting backend on http://127.0.0.1:8000 ..."
(
  cd "$BACKEND_DIR"
  INNGEST_DEV=1 uv run uvicorn canvasai.main:app --reload
) &
PIDS+=("$!")

sleep 3

echo "Starting Inngest Dev Server on http://localhost:8288 ..."
npx --ignore-scripts=false inngest-cli@latest dev \
  -u http://127.0.0.1:8000/api/inngest \
  --no-discovery &
PIDS+=("$!")

echo "Starting frontend on http://localhost:3000 ..."
(
  cd "$FRONTEND_DIR"
  pnpm dev
) &
PIDS+=("$!")

printf "%s\n" "${PIDS[@]}" > "$ROOT_DIR/.run-kg.pids"

echo ""
echo "Knowledge Graph dev stack:"
echo "  Frontend: http://localhost:3000/dashboard/knowledge"
echo "  Backend:  http://127.0.0.1:8000"
echo "  Inngest:  http://localhost:8288"
echo ""
echo "Press Ctrl+C to stop."

wait
