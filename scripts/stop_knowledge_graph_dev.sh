#!/usr/bin/env bash

# Manual cleanup escape hatch. Tears down anything left over from
# run_knowledge_graph_dev.sh: kills the recorded PIDs (and their process
# groups), then kills anything still listening on the dev ports.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$ROOT_DIR/.run-kg.pids"

kill_group() {
  local pid="$1"
  [[ -z "$pid" ]] && return 0
  if ! kill -0 "$pid" 2>/dev/null; then return 0; fi
  echo "Stopping process group $pid"
  kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
}

force_kill_group() {
  local pid="$1"
  [[ -z "$pid" ]] && return 0
  if ! kill -0 "$pid" 2>/dev/null; then return 0; fi
  kill -KILL -- "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
}

if [[ -f "$PID_FILE" ]]; then
  while IFS= read -r pid; do
    kill_group "$pid"
  done < "$PID_FILE"

  sleep 2

  while IFS= read -r pid; do
    force_kill_group "$pid"
  done < "$PID_FILE"

  rm -f "$PID_FILE"
else
  echo "No PID file found — falling through to port-based cleanup."
fi

# Always sweep the dev ports — covers the case where the PID file is stale
# (script crashed) or the user started services some other way.
stragglers="$(lsof -ti:8000 -ti:3000 -ti:8288 2>/dev/null || true)"
if [[ -n "$stragglers" ]]; then
  echo "Killing stragglers on dev ports: $stragglers"
  echo "$stragglers" | xargs kill -9 2>/dev/null || true
else
  echo "No processes left on ports 8000 / 3000 / 8288."
fi

# Last-ditch by name in case something changed ports.
pkill -f "uvicorn canvasai" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
pkill -f "inngest-cli" 2>/dev/null || true

echo "Cleanup complete."
