#!/usr/bin/env bash

# Boots backend, Inngest, and frontend in SEPARATE terminal windows.
# Perfect for debugging. Closing a window kills that specific service.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

echo "Checking backend env..."
(
  cd "$BACKEND_DIR"
  uv run python -c "from canvasai.config import get_settings; s=get_settings(); key=s.openai_api_key or ''; checks={'SUPABASE_URL': bool(s.supabase_url), 'SUPABASE_ANON_KEY': bool(s.supabase_anon_key)}; missing=[k for k,v in checks.items() if not v]; raise SystemExit('Missing required env: ' + ', '.join(missing) if missing else 0)"
)

echo "Spawning separate terminal windows..."

# 1. Start Backend in a new window
# Using 'start' opens a new command prompt/mintty window. 
# We add 'exec bash' so the window stays open to show errors if it crashes.
echo "Launching Backend..."
start "CanvasAI Backend" bash -c "cd '$BACKEND_DIR' && INNGEST_DEV=1 uv run uvicorn canvasai.main:app --reload; echo 'Backend stopped.'; read -p 'Press Enter to close...'"

sleep 3

# 2. Start Inngest in a new window
echo "Launching Inngest..."
start "Inngest Dev Server" bash -c "npx --ignore-scripts=false inngest-cli@latest dev -u http://127.0.0.1:8000/api/inngest --no-discovery; echo 'Inngest stopped.'; read -p 'Press Enter to close...'"

# 3. Start Frontend in a new window
echo "Launching Frontend..."
start "CanvasAI Frontend" bash -c "cd '$FRONTEND_DIR' && pnpm dev; echo 'Frontend stopped.'; read -p 'Press Enter to close...'"

echo ""
echo "✅ All services launched in separate windows!"
echo "To stop a service, just close its window or press Ctrl+C inside it."