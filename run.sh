#!/bin/bash

set -e

cleanup() {
  echo ""
  echo "Stopping..."
  trap - INT TERM EXIT
  [ -n "$FRONTEND_PID" ] && pkill -P "$FRONTEND_PID" 2>/dev/null
  [ -n "$BACKEND_PID" ] && pkill -P "$BACKEND_PID" 2>/dev/null
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null
  wait 2>/dev/null
  exit 0
}
trap cleanup INT TERM EXIT

echo "Starting frontend..."
cd frontend || exit
pnpm dev &
FRONTEND_PID=$!
cd ..

echo "Starting backend..."
cd backend || exit
uv run uvicorn canvasai.main:app --reload &
BACKEND_PID=$!
cd ..

echo "$FRONTEND_PID $BACKEND_PID" > .run.pids

sleep 3

echo "Opening browser..."
open http://localhost:3000

echo ""
echo "Press Ctrl+C to stop, or run ./stop.sh from another terminal."

wait $FRONTEND_PID $BACKEND_PID
