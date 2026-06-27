#!/usr/bin/env bash
set -euo pipefail

# ─── Viva Voice — Conversation Replay Test ────────────────────────────────
# Replays the most recent N conversations from the server's saved history
# through the Gemini Live pipeline and validates the output audio.
#
# Usage:
#   ./tests/replay-test.sh                          # replay last 12
#   ./tests/replay-test.sh --count 5                # replay last 5
#   ./tests/replay-test.sh --list                   # list available

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$SCRIPT_DIR/output"
SERVER_URL="${SERVER_URL:-http://127.0.0.1:8000}"
SAMPLE_RATE=24000

mkdir -p "$OUTPUT_DIR"

LIST_ONLY=0
COUNT=12

while [[ $# -gt 0 ]]; do
  case "$1" in
    --list) LIST_ONLY=1; shift ;;
    --count) COUNT="$2"; shift 2 ;;
    *) echo "Unknown: $1"; exit 1 ;;
  esac
done

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     Viva Voice — Conversation Replay Test           ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ─── Step 1: Verify server ──────────────────────────────────────────────────
echo "🔍 Checking server..."
if ! curl -sf "$SERVER_URL/api/health" > /dev/null 2>&1; then
    echo "  ❌ Server not running at $SERVER_URL"
    echo "  Start it with: python3 server.py"
    exit 1
fi
echo "  ✅ Server OK"

# ─── Step 2: Fetch conversation list ────────────────────────────────────────
echo ""
echo "📋 Fetching recent $COUNT conversations..."
CONVERSATIONS=$(curl -sf "$SERVER_URL/api/conversations?limit=$COUNT" 2>/dev/null || echo "[]")
CONV_COUNT=$(echo "$CONVERSATIONS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

if [ "$CONV_COUNT" -eq 0 ]; then
    echo "  ⚠️  No saved conversations found."
    echo ""
    echo "  To record conversations:"
    echo "    1. Open the app in a browser"
    echo "    2. Speak into the mic (conversations record automatically)"
    echo "    3. Export them:"
    echo "       open browser console and run:"
    echo "       app.recorder.exportToServer()"
    echo ""
    echo "  Or use the E2E test to generate fixtures."
    exit 0
fi

echo "  ✅ Found $CONV_COUNT conversations"

if [ "$LIST_ONLY" -eq 1 ]; then
    echo ""
    echo "  Conversations:"
    echo "$CONVERSATIONS" | python3 -c "
import sys, json
convs = json.load(sys.stdin)
for c in convs:
    lang = c.get('language', '?')
    inp = c.get('inputTranscript', '')[:60]
    out = c.get('outputTranscript', '')[:60]
    dur = c.get('durationMs', 0) / 1000
    print(f'    {c[\"id\"]}  [{lang}]  {dur:.1f}s')
    print(f'      In:  {inp}')
    print(f'      Out: {out}')
    print()
"
    exit 0
fi

# ─── Step 3: Download each conversation's audio ─────────────────────────────
echo ""
echo "📥 Downloading conversation audio files..."

TEMP_DIR="$OUTPUT_DIR/replay_$$"
export TEMP_DIR
mkdir -p "$TEMP_DIR"

echo "$CONVERSATIONS" | python3 -c "
import sys, json, os, subprocess

convs = json.load(sys.stdin)
server = os.environ.get('SERVER_URL', 'http://127.0.0.1:8000')
out = os.environ.get('TEMP_DIR', '/tmp')

for c in convs:
    cid = c['id']
    cdir = os.path.join(out, cid)
    os.makedirs(cdir, exist_ok=True)

    # Save manifest
    with open(os.path.join(cdir, 'manifest.json'), 'w') as f:
        json.dump(c, f, indent=2, ensure_ascii=False)

    # Download audio
    for fname in ('input.pcm', 'output.pcm'):
        url = f'{server}/api/conversations/{cid}/{fname}'
        dest = os.path.join(cdir, fname)
        code = os.system(f'curl -sf \"{url}\" -o \"{dest}\" 2>/dev/null')
        if code == 0 and os.path.getsize(dest) > 0:
            print(f'  Downloaded {cid}/{fname}')
        else:
            if os.path.exists(dest):
                os.remove(dest)
" 2>&1 | while read line; do echo "    $line"; done

echo "  ✅ Audio files downloaded to $TEMP_DIR"

# ─── Step 5: Analysis Report ────────────────────────────────────────────────
echo ""
echo "📊 Analyzing all replay audio..."
echo ""

PASS_COUNT=0
FAIL_COUNT=0
TOTAL=0

for conv_dir in "$TEMP_DIR"/*/; do
    [ -d "$conv_dir" ] || continue
    CID=$(basename "$conv_dir")
    MANIFEST="$conv_dir/manifest.json"
    OUTPUT_PCM="$conv_dir/output.pcm"

    [ -f "$MANIFEST" ] || continue

    LANG=$(python3 -c "import json; print(json.load(open('$MANIFEST')).get('language','?'))" 2>/dev/null)
    TRANS=$(python3 -c "import json; t=json.load(open('$MANIFEST')).get('outputTranscript','')[:60]; print(t)" 2>/dev/null)

    if [ ! -f "$OUTPUT_PCM" ] || [ ! -s "$OUTPUT_PCM" ]; then
        echo "  ⚠️  [$CID] No output audio — skipping"
        continue
    fi

    TOTAL=$((TOTAL + 1))

    # Convert PCM to base64 for the analyzer
    OUTPUT_B64="$conv_dir/output.b64"
    base64 "$OUTPUT_PCM" > "$OUTPUT_B64"

    # Analyze
    REPORT="$conv_dir/report.json"
    python3 "$SCRIPT_DIR/analyze-audio.py" \
        --input "$OUTPUT_B64" \
        --sample-rate "$SAMPLE_RATE" \
        --json > "$REPORT" 2>&1 || true

    # Check result
    RESULT=$(python3 -c "
import json
try:
    r = json.load(open('$REPORT'))
    print('PASS' if r.get('passed') else 'FAIL')
    print(r.get('classification','?'))
    print(r.get('confidence',0))
    print(r.get('duration_sec',0))
except: print('ERROR')
" 2>/dev/null)

    STATUS=$(echo "$RESULT" | sed -n '1p')
    CLASS=$(echo "$RESULT" | sed -n '2p')
    CONF=$(echo "$RESULT" | sed -n '3p')
    DUR=$(echo "$RESULT" | sed -n '4p')

    ICON="✅"
    if [ "$STATUS" = "PASS" ]; then
        ICON="✅"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        ICON="❌"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi

    echo "  $ICON [$CID] lang=$LANG class=$CLASS conf=$CONF dur=${DUR}s"
done

echo ""
echo "──────────────────────────────────────────────────"
echo "  Results:  $PASS_COUNT passed  /  $FAIL_COUNT failed  /  $TOTAL total"
echo "──────────────────────────────────────────────────"

# Cleanup
rm -rf "$TEMP_DIR"

exit $FAIL_COUNT