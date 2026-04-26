#!/bin/bash

# Stop CanvasAI dev servers started by run.sh.

if [ -f .run.pids ]; then
  read -r FRONTEND_PID BACKEND_PID < .run.pids
  echo "Stopping frontend (pid $FRONTEND_PID) and backend (pid $BACKEND_PID)..."
  [ -n "$FRONTEND_PID" ] && pkill -P "$FRONTEND_PID" 2>/dev/null
  [ -n "$BACKEND_PID" ] && pkill -P "$BACKEND_PID" 2>/dev/null
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null
  rm -f .run.pids
fi

# Fallback: kill anything still listening on the dev ports.
for port in 3000 8000; do
  pids=$(lsof -ti tcp:$port 2>/dev/null)
  if [ -n "$pids" ]; then
    echo "Killing leftover process on port $port: $pids"
    kill $pids 2>/dev/null
  fi
done

echo "Stopped."
