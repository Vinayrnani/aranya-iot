#!/bin/bash
set -euo pipefail

echo "Testing server..."
curl -s -X POST http://127.0.0.1:8000/api/token -H "Content-Type: application/json" -d '{"model":"gemini-3.1-flash-live-preview"}' | head -c 200
echo ""
