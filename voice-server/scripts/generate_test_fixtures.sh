#!/bin/bash
# Regenerate test audio fixtures for STT language detection tests
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
FIXTURES_DIR="$PROJECT_DIR/test/fixtures"
MODELS_DIR="$PROJECT_DIR/models"

mkdir -p "$FIXTURES_DIR"

echo "=== Generating test audio fixtures ==="

# English
echo "turn on the lights" | piper \
  --model "$MODELS_DIR/en.onnx" \
  --output-raw \
  --length-scale 1.0 2>/dev/null | \
python3 -c "
import sys, wave
raw = sys.stdin.buffer.read()
with wave.open('$FIXTURES_DIR/test_en.wav', 'w') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(22050)
    w.writeframes(raw)
print(f'  test_en.wav ({len(raw)} bytes)')
"

# Hindi
echo "लाइट चालू करो" | piper \
  --model "$MODELS_DIR/hi.onnx" \
  --output-raw \
  --length-scale 1.2 2>/dev/null | \
python3 -c "
import sys, wave
raw = sys.stdin.buffer.read()
with wave.open('$FIXTURES_DIR/test_hi.wav', 'w') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(22050)
    w.writeframes(raw)
print(f'  test_hi.wav ({len(raw)} bytes)')
"

# Telugu
echo "లైట్ ఆన్ చేయండి" | piper \
  --model "$MODELS_DIR/te.onnx" \
  --output-raw \
  --length-scale 1.2 2>/dev/null | \
python3 -c "
import sys, wave
raw = sys.stdin.buffer.read()
with wave.open('$FIXTURES_DIR/test_te.wav', 'w') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(22050)
    w.writeframes(raw)
print(f'  test_te.wav ({len(raw)} bytes) — NOTE: Piper Telugu voice not recognized by Whisper as Telugu'
)

echo "=== Done ==="
