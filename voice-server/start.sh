#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/server.log"
PID_FILE="${SCRIPT_DIR}/server.pid"
PORT="${PORT:-8080}"

# Kill existing server if running
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    echo "Stopping existing server (PID $OLD_PID)..."
    kill "$OLD_PID" 2>/dev/null || true
    # Wait up to 5s for graceful shutdown
    for i in $(seq 1 5); do
      if ! kill -0 "$OLD_PID" 2>/dev/null; then break; fi
      sleep 1
    done
    # Force kill if still alive
    kill -9 "$OLD_PID" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
fi

# Make sure port is free
if command -v fuser &>/dev/null; then
  fuser -k "${PORT}/tcp" 2>/dev/null || true
fi

cd "$SCRIPT_DIR"

echo "Starting voice server on port ${PORT}..."
nohup node src/index.js > "$LOG_FILE" 2>&1 &
NEW_PID=$!
echo "$NEW_PID" > "$PID_FILE"

# Wait for server to be ready (up to 10s)
for i in $(seq 1 10); do
  if curl -s -o /dev/null -w '' --connect-timeout 1 "http://localhost:${PORT}/" 2>/dev/null; then
    echo "Server started (PID $NEW_PID) — ready on port ${PORT}"
    tail -3 "$LOG_FILE"
    exit 0
  fi
  sleep 1
done

# Timed out — show logs
echo "ERROR: Server failed to start within 10s. Logs:"
cat "$LOG_FILE"
exit 1
