#!/usr/bin/env bash
set -e

# Viva Voice - Quick start/restart script

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Check for .env
if [ ! -f "$SCRIPT_DIR/.env" ]; then
  echo "No .env found. Copy .env.example to .env and add your GEMINI_API_KEY."
  exit 1
fi

# Kill existing server if running
PID_FILE="$SCRIPT_DIR/.server.pid"
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "Stopping existing server (PID $OLD_PID)..."
    kill "$OLD_PID" 2>/dev/null || true
    sleep 1
  fi
  rm -f "$PID_FILE"
fi

# Install deps if needed
pip install -q aiohttp python-dotenv 2>/dev/null || {
  echo "Installing dependencies..."
  pip install aiohttp python-dotenv
}

LOG_FILE="$SCRIPT_DIR/server.log"
echo "Starting Viva Voice on http://0.0.0.0:8000 (log: $LOG_FILE)"
nohup python "$SCRIPT_DIR/server.py" > "$LOG_FILE" 2>&1 &
PID=$!
echo $PID > "$PID_FILE"
echo "Server started (PID $PID)"
