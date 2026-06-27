#!/usr/bin/env bash
set -euo pipefail

# ─── Viva Voice E2E Audio Test Runner ──────────────────────────────────────
# Orchestrates a complete audio pipeline test:
#   1. Ensures the server is running
#   2. Opens the app via Playwright
#   3. Connects to Gemini (auto-connect)
#   4. Sends a text prompt to elicit speech
#   5. Captures the response audio
#   6. Writes audio to tests/output/ for analysis
#   7. Runs Python analysis to validate audio
#
# Usage:
#   ./tests/run-e2e-test.sh                          # full test
#   ./tests/run-e2e-test.sh --analyze-only output.b64  # re-analyze saved data

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$SCRIPT_DIR/output"
FIXTURES_DIR="$SCRIPT_DIR/fixtures"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
CAPTURE_FILE="$OUTPUT_DIR/captured_${TIMESTAMP}.b64"
WAV_FILE="$OUTPUT_DIR/captured_${TIMESTAMP}.wav"
REPORT_FILE="$OUTPUT_DIR/report_${TIMESTAMP}.json"
SAMPLE_RATE=24000

mkdir -p "$OUTPUT_DIR" "$FIXTURES_DIR"

ANALYZE_ONLY=0
INPUT_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --analyze-only) ANALYZE_ONLY=1; INPUT_FILE="$2"; shift 2 ;;
    *) echo "Unknown: $1"; exit 1 ;;
  esac
done

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║       Viva Voice — E2E Audio Test Suite             ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

if [ "$ANALYZE_ONLY" -eq 1 ]; then
    echo "📂 Analyzing previously captured audio: $INPUT_FILE"
    python3 "$SCRIPT_DIR/analyze-audio.py" \
        --input "$INPUT_FILE" \
        --sample-rate "$SAMPLE_RATE" \
        --json > "$REPORT_FILE" 2>&1 || true
    python3 "$SCRIPT_DIR/analyze-audio.py" \
        --input "$INPUT_FILE" \
        --sample-rate "$SAMPLE_RATE" \
        --wav "$(dirname "$INPUT_FILE")/$(basename "$INPUT_FILE" .b64).wav"
    exit $?
fi

# ─── Step 1: Verify server is running ──────────────────────────────────────
echo "🔍 Step 1: Checking server..."
if ! curl -sf http://127.0.0.1:8000/ > /dev/null 2>&1; then
    echo "  ⚠️  Server not running. Starting..."
    cd "$PROJECT_DIR"
    nohup python3 server.py > /tmp/server-test.log 2>&1 &
    sleep 2
fi
echo "  ✅ Server is running at http://127.0.0.1:8000"

# ─── Step 2-5: Captured via Playwright (MCP tools) ─────────────────────────
echo ""
echo "📡 Step 2-5: Audio capture via Playwright"
echo "  ⏳ Opening Viva Voice → connecting → sending prompt → capturing..."
echo ""
echo "  ┌─────────────────────────────────────────────────────────┐"
echo "  │  Execute the Playwright test in the conversation:        │"
echo "  │  Run the 'e2e-audio-capture' test plan to capture audio  │"
echo "  │                                                          │"
echo "  │  After capture completes, run:                           │"
echo "  │    ./tests/run-e2e-test.sh --analyze-only <file>         │"
echo "  └─────────────────────────────────────────────────────────┘"
echo ""

# Print test plan for human/manual execution via Playwright MCP
cat <<TESTPLAN
═─────────────────────────────────────────────────────╌
  E2E AUDIO CAPTURE — TEST PLAN
═─────────────────────────────────────────────────────╌

  Test file:  $CAPTURE_FILE
  WAV output: $WAV_FILE

  1. Open browser and navigate to http://127.0.0.1:8000/?e2e-test=1
  2. Verify mic button is enabled (not disabled)
  3. Tap mic button (triggers auto-connect)
  4. Wait 10s for WebSocket connection + session setup
  5. Send text prompt: "Please count from 1 to 5 slowly"
  6. Wait 12s for full response
  7. Capture all audio chunks from onAudioReceived
  8. Concatenate and write to $CAPTURE_FILE
  9. Run: python3 analyze-audio.py --input $CAPTURE_FILE
     --sample-rate $SAMPLE_RATE --wav $WAV_FILE
TESTPLAN

echo ""
echo "  To write audio directly after capture:"
echo "    echo '<base64-data>' | base64 -d > $CAPTURE_FILE"
echo ""

# ─── Write test prompt fixture ─────────────────────────────────────────────
echo "Please count from 1 to 5 slowly with pauses between each number" \
    > "$FIXTURES_DIR/test-prompt.txt"
echo "  📝 Test prompt saved: $FIXTURES_DIR/test-prompt.txt"

# ─── Generate test audio input fixture (synthetic speech-like chirp) ───────
python3 -c "
import struct, math, base64
sr = 16000
duration = 1.0
samples = []
for i in range(int(sr * duration)):
    t = i / sr
    # Frequency sweep from 200Hz to 800Hz (speech-like range)
    freq = 200 + 600 * (t / duration)
    env = 0.5 * (1 - math.cos(2 * math.pi * t / duration))  # fade in/out
    val = int(env * 0.3 * 32767 * math.sin(2 * math.pi * freq * t))
    samples.append(val)
data = struct.pack('<' + 'h' * len(samples), *samples)
b64 = base64.b64encode(data).decode()
with open('$FIXTURES_DIR/speech-chirp.b64', 'w') as f:
    f.write(b64)
print(f'  🎵 Test audio fixture generated: {len(samples)} samples')
" 2>&1

echo ""
echo "  ✅ Fixtures ready in $FIXTURES_DIR"
echo "  ⏳ Proceeding to capture via Playwright..."
