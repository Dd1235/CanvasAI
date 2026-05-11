#!/usr/bin/env bash

# Boots backend (uvicorn), Inngest dev server, and frontend (pnpm dev) together.
# Ctrl+C tears down all three, including their child processes.
#
# If Ctrl+C ever leaves stragglers, run:
#   ./scripts/stop_knowledge_graph_dev.sh
# or manually:
#   lsof -ti:8000 -ti:3000 -ti:8288 | xargs kill -9
#   pkill -f "uvicorn canvasai" ; pkill -f "next dev" ; pkill -f "inngest-cli"

set -euo pipefail
set -m  # job control: every backgrounded command gets its own process group

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
SQL_FILE="$BACKEND_DIR/sql/knowledge_graph.sql"
PID_FILE="$ROOT_DIR/.run-kg.pids"

BACKEND_PID=""
INNGEST_PID=""
FRONTEND_PID=""
CLEANED_UP=0

# Kill the process group led by $1 (TERM, then KILL after a short grace period).
# Falls back to a plain PID kill if the group kill fails.
kill_group() {
  local pid="$1"
  [[ -z "$pid" ]] && return 0
  if ! kill -0 "$pid" 2>/dev/null; then return 0; fi
  kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
}

force_kill_group() {
  local pid="$1"
  [[ -z "$pid" ]] && return 0
  if ! kill -0 "$pid" 2>/dev/null; then return 0; fi
  kill -KILL -- "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
}

cleanup() {
  if [[ "$CLEANED_UP" == "1" ]]; then return 0; fi
  CLEANED_UP=1
  trap - INT TERM EXIT  # prevent re-entry

  echo ""
  echo "Stopping Knowledge Graph dev services..."

  kill_group "$FRONTEND_PID"
  kill_group "$INNGEST_PID"
  kill_group "$BACKEND_PID"

  # Give graceful shutdown a moment, then force.
  sleep 2
  force_kill_group "$FRONTEND_PID"
  force_kill_group "$INNGEST_PID"
  force_kill_group "$BACKEND_PID"

  # Belt-and-braces: anything still bound to the dev ports gets killed.
  local stragglers
  stragglers="$(lsof -ti:8000 -ti:3000 -ti:8288 2>/dev/null || true)"
  if [[ -n "$stragglers" ]]; then
    echo "Killing stragglers on dev ports: $stragglers"
    echo "$stragglers" | xargs kill -9 2>/dev/null || true
  fi

  rm -f "$PID_FILE"
  echo "All Knowledge Graph dev services stopped."
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
# `exec` so the captured PID *is* uvicorn's PID, which is also the new
# process group leader. Killing -PID then takes uvicorn's reload-spawned
# children with it.
(cd "$BACKEND_DIR" && exec env INNGEST_DEV=1 uv run uvicorn canvasai.main:app --reload) &
BACKEND_PID=$!

sleep 3

echo "Starting Inngest Dev Server on http://localhost:8288 ..."
(exec npx --ignore-scripts=false inngest-cli@latest dev \
  -u http://127.0.0.1:8000/api/inngest \
  --no-discovery) &
INNGEST_PID=$!

echo "Starting frontend on http://localhost:3000 ..."
(cd "$FRONTEND_DIR" && exec pnpm dev) &
FRONTEND_PID=$!

printf "%s\n" "$BACKEND_PID" "$INNGEST_PID" "$FRONTEND_PID" > "$PID_FILE"

echo ""
echo "Knowledge Graph dev stack:"
echo "  Frontend: http://localhost:3000/dashboard/knowledge"
echo "  Backend:  http://127.0.0.1:8000"
echo "  Inngest:  http://localhost:8288"
echo ""
echo "Press Ctrl+C to stop all three (cleanup is process-group aware)."

wait
