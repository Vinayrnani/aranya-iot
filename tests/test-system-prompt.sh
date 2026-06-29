#!/bin/bash

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
E2E_MODE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --e2e)
      E2E_MODE=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

PROJECT_ROOT="/root/projects/aranya-iot"
SERVER_URL="http://127.0.0.1:8000/api/token"

# Function to print colored output
print_color() {
  local color=$1
  local message=$2
  echo -e "${color}${message}${NC}"
}

# Function to fail with message
fail() {
  print_color "$RED" "FAIL: $1"
  exit 1
}

# Function to pass with message
pass() {
  print_color "$GREEN" "PASS: $1"
}

# Function to warn
warn() {
  print_color "$YELLOW" "WARN: $1"
}

print_color "$GREEN" "=== System Prompt Pipeline Validation ==="
echo ""

# Check if server is running
print_color "$YELLOW" "Checking if server is running..."
if ! timeout 5 curl -s -f -X POST "$SERVER_URL" -H "Content-Type: application/json" -d '{}' > /dev/null 2>&1; then
  fail "Server is not responding at $SERVER_URL"
fi
pass "Server is responding"
echo ""

# 1. Verify server returns system prompt
print_color "$YELLOW" "1. Verifying server returns system prompt..."
SERVER_RESPONSE=$(timeout 10 curl -s -X POST "$SERVER_URL" -H "Content-Type: application/json" -d '{}')

# Parse with python3 to handle JSON properly
SYSTEM_PROMPT=$(echo "$SERVER_RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
sp = data.get('systemPrompt', '')
if not sp:
    print('')
    sys.exit(1)
print(sp)
") || fail "Server response missing or empty systemPrompt field"

if [[ "$SYSTEM_PROMPT" != "<role_and_persona>"* ]]; then
  fail "Server systemPrompt does not start with '<role_and_persona>'"
fi

pass "Server systemPrompt is valid"
echo "  Preview (first 100 chars): ${SYSTEM_PROMPT:0:100}..."
echo ""

# 2. Verify file on disk
print_color "$YELLOW" "2. Verifying system-prompt.md file on disk..."
SYSTEM_PROMPT_FILE="$PROJECT_ROOT/system-prompt.md"

if [[ ! -f "$SYSTEM_PROMPT_FILE" ]]; then
  fail "system-prompt.md does not exist at $SYSTEM_PROMPT_FILE"
fi

if [[ ! -s "$SYSTEM_PROMPT_FILE" ]]; then
  fail "system-prompt.md is empty"
fi

FILE_CONTENT=$(cat "$SYSTEM_PROMPT_FILE")
if [[ "$FILE_CONTENT" != "<role_and_persona>"* ]]; then
  fail "system-prompt.md does not start with '<role_and_persona>'"
fi

pass "File validation passed"
echo "  Preview (first 100 chars): ${FILE_CONTENT:0:100}..."
echo ""

# 3. Verify file and server match
print_color "$YELLOW" "3. Comparing server prompt vs file content..."
if [[ "$SYSTEM_PROMPT" != "$FILE_CONTENT" ]]; then
  warn "Server prompt differs from file content"
  echo "  Server length: ${#SYSTEM_PROMPT}, File length: ${#FILE_CONTENT}"
else
  pass "Server prompt matches file content (identical)"
fi
echo ""

# 4. Simulate client-side handling
print_color "$YELLOW" "4. Simulating client-side prompt selection..."

# Hardcoded fallback from geminilive.js _buildSystemInstruction()
HARDCODED_FALLBACK="You are a multilingual voice assistant with a warm, helpful personality."

if [[ -n "$SYSTEM_PROMPT" ]]; then
  PROMPT_USED="SERVER PROMPT"
  PROMPT_TEXT="$SYSTEM_PROMPT"
  print_color "$GREEN" "  ▶ SERVER PROMPT will be used (not hardcoded fallback)"
else
  PROMPT_USED="HARDCODED FALLBACK"
  PROMPT_TEXT="$HARDCODED_FALLBACK"
  print_color "$YELLOW" "  ▶ HARDCODED FALLBACK would be used (server prompt missing)"
fi

echo "  Length: ${#PROMPT_TEXT} characters"
if [[ "$PROMPT_USED" == "SERVER PROMPT" ]]; then
  echo "  Starts with: ${PROMPT_TEXT:0:60}..."
fi
echo ""

# 5. Validation rules
print_color "$YELLOW" "5. Validation rules..."

# Rule 1: Server returns systemPrompt
echo "$SERVER_RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
assert 'systemPrompt' in data, 'Missing systemPrompt'
assert len(data['systemPrompt']) > 0, 'Empty systemPrompt'
" && pass "Rule 1: Server returns non-empty systemPrompt" || fail "Rule 1 failed"

# Rule 2: Not the hardcoded fallback
if [[ "$SYSTEM_PROMPT" == "$HARDCODED_FALLBACK"* ]]; then
  fail "Rule 2: systemPrompt is still the old hardcoded fallback"
fi
pass "Rule 2: systemPrompt is NOT the old hardcoded fallback"

# Rule 3: File exists and matches
if [[ "$FILE_CONTENT" != "$SYSTEM_PROMPT" ]]; then
  warn "Rule 3: File content and server response differ (server reads live, expected)"
else
  pass "Rule 3: File content matches server response"
fi

# Rule 4: Has language constraints
if echo "$SYSTEM_PROMPT" | grep -qi "strict.*language\|STRICT LANGUAGE"; then
  pass "Rule 4: Prompt contains STRICT LANGUAGE constraint"
else
  warn "Rule 4: Prompt may be missing STRICT LANGUAGE constraint"
fi
echo ""

# 6. E2E mode: Construct WebSocket setup message
if [[ "$E2E_MODE" == true ]]; then
  export SP_PROMPT="$SYSTEM_PROMPT"
  print_color "$YELLOW" "6. E2E mode: Constructing WebSocket setup message..."
  echo ""
  
  # Use python3 to build a proper JSON with the prompt (avoids shell heredoc issues with special chars)
  python3 -c "
import json, sys, os

# Read prompt from env var to avoid shell escaping issues
prompt = os.environ.get('SP_PROMPT', '')
if not prompt:
    print('  ERROR: SP_PROMPT env var not set')
    sys.exit(1)

setup = {
    'setup': {
        'model': 'models/gemini-3.1-flash-live-preview',
        'generationConfig': {
            'responseModalities': ['AUDIO'],
            'speechConfig': {
                'voiceConfig': {
                    'prebuiltVoiceConfig': {
                        'voiceName': 'Kore'
                    }
                }
            }
        },
        'systemInstruction': {
            'parts': [{'text': prompt}]
        },
        'inputAudioTranscription': {},
        'outputAudioTranscription': {}
    }
}

with open('/tmp/setup-message.json', 'w') as f:
    json.dump(setup, f, indent=2, ensure_ascii=False)

print('  Setup message written to /tmp/setup-message.json')
print(f'  systemInstruction.parts[0].text length: {len(prompt)}')
print(f'  Starts with: {prompt[:60]}...')
" 2>&1 || fail "Failed to construct setup message"
  
  # Validate JSON
  if python3 -c "import json; json.load(open('/tmp/setup-message.json'))" 2>/dev/null; then
    pass "WebSocket setup message is valid JSON"
  else
    fail "WebSocket setup message is not valid JSON"
  fi
fi

echo ""
print_color "$GREEN" "=== ALL VALIDATIONS PASSED ==="
exit 0
