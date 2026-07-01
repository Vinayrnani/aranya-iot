#!/usr/bin/env bash
set -euo pipefail

# ─── Viva Voice — System Prompt Validation Framework ──────────────────────
# Orchestrates multi-turn guest scenarios to test system prompt compliance.
#
# For each scenario turn:
#   1. Prints the guest script (what YOU should say)
#   2. Waits for you to actually say it + press Enter when done
#   3. Polls the server for the newly saved conversation
#   4. Runs compliance rules on the response transcript
#   5. Appends results to the report
#
# Usage:
#   ./tests/run-validation.sh                     # Run all scenarios
#   ./tests/run-validation.sh --scenario lang-adherence  # Single scenario
#   ./tests/run-validation.sh --list              # List available scenarios

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCENARIOS_FILE="$SCRIPT_DIR/scenarios/scenarios.json"
REPORT_DIR="$SCRIPT_DIR/output"

SERVER_URL="http://127.0.0.1:8000"
POLL_INTERVAL=2
POLL_TIMEOUT=60

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

SESSION_ID=""
RUN_ALL=true
SPECIFIC_SCENARIO=""
LIST_ONLY=false
ITERATION=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --scenario) SPECIFIC_SCENARIO="$2"; RUN_ALL=false; shift 2 ;;
    --list) LIST_ONLY=true; shift ;;
    --iteration) ITERATION="$2"; shift 2 ;;
    *) echo "Unknown: $1"; exit 1 ;;
  esac
done

mkdir -p "$REPORT_DIR"

info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
pass()    { echo -e "${GREEN}[PASS]${NC} $1"; }
fail()    { echo -e "${RED}[FAIL]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
header()  { echo -e "\n${BOLD}━━━ $1 ━━━${NC}\n"; }

check_server() {
  if ! curl -sf "$SERVER_URL/api/health" > /dev/null 2>&1; then
    fail "Server not running at $SERVER_URL"
    echo "  Start it with: python3 server.py"
    exit 1
  fi
  info "Server OK at $SERVER_URL"
}

get_last_conv_id() {
  curl -sf "$SERVER_URL/api/conversations?limit=1" 2>/dev/null | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if d else '')" 2>/dev/null || echo ""
}

get_conv_field() {
  local conv_id="$1"
  local field="$2"
  curl -sf "$SERVER_URL/api/conversations/$conv_id/manifest.json" 2>/dev/null | \
    python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    val = d.get('$field', '')
    # Escape for shell
    val = val.replace('\\\\', '\\\\\\\\').replace(\"'\", \"\\\\'\").replace('\\n', '\\\\n')
    print(val)
except:
    print('')
" 2>/dev/null || echo ""
}

# Write a JSON string to a temp file and return the filename.
# Avoids shell escaping issues with complex JSON.
write_json_temp() {
  local content="$1"
  local tmpfile
  tmpfile=$(mktemp /tmp/viva_scenario_XXXXXX.json)
  echo "$content" > "$tmpfile"
  echo "$tmpfile"
}

wait_for_new_conversation() {
  local before_id="$1"
  local waited=0
  while [[ $waited -lt $POLL_TIMEOUT ]]; do
    local current_id
    current_id=$(get_last_conv_id)
    if [[ -n "$current_id" && "$current_id" != "$before_id" ]]; then
      echo "$current_id"
      return 0
    fi
    sleep "$POLL_INTERVAL"
    waited=$((waited + POLL_INTERVAL))
  done
  echo ""
  return 1
}

run_scenario() {
  local tmpfile="$1"  # temp file with scenario JSON

  local scenario_id
  scenario_id=$(python3 -c "import json; print(json.load(open('$tmpfile'))['id'])")
  local scenario_name
  scenario_name=$(python3 -c "import json; print(json.load(open('$tmpfile'))['name'])")
  local guest_profile
  guest_profile=$(python3 -c "import json; print(json.load(open('$tmpfile')).get('guest_profile',''))")
  local turns_count
  turns_count=$(python3 -c "import json; print(len(json.load(open('$tmpfile'))['turns']))")

  header "Scenario: $scenario_name ($scenario_id)"
  info "Guest: $guest_profile"
  info "Turns: $turns_count"

  local last_conv_id
  last_conv_id=$(get_last_conv_id)
  info "Last conversation: ${last_conv_id:-none}"

  local scenario_results_file="$REPORT_DIR/${SESSION_ID}_${scenario_id}.json"
  local turn_results="[]"

  for ((i=0; i<turns_count; i++)); do
    echo ""
    echo "━━━ Turn $((i+1)) of $turns_count ━━━"
    echo ""

    local turn_id
    turn_id=$(python3 -c "import json; print(json.load(open('$tmpfile'))['turns'][$i]['id'])")
    local guest_says
    guest_says=$(python3 -c "
import json
t = json.load(open('$tmpfile'))['turns'][$i]
print(t['guest_says'])
")
    local context
    context=$(python3 -c "import json; print(json.load(open('$tmpfile'))['turns'][$i]['context'])")
    local rules
    rules=$(python3 -c "
import json
r = json.load(open('$tmpfile'))['turns'][$i]['rules']
print(json.dumps(r))
")

    echo -e "${CYAN}📢 Guest says:${NC}"
    echo -e "${BOLD}\"$guest_says\"${NC}"
    echo ""
    echo "   $context"
    echo ""
    echo -e "${YELLOW}⏳ Say this into the mic, wait for Gemini's response, then press Enter${NC}"
    read -r -p "→ Press Enter when the response finishes: " dummy
    echo ""

    echo -n "  Waiting for conversation save..."
    local new_conv_id
    new_conv_id=$(wait_for_new_conversation "$last_conv_id") || {
        echo ""
        warn "Timed out waiting. You may need to reconnect the app."
        echo "  Current conversations:"
        curl -sf "$SERVER_URL/api/conversations?limit=3" | python3 -m json.tool 2>/dev/null || true
        continue
    }
    echo " $new_conv_id"
    last_conv_id="$new_conv_id"

    echo -n "  Fetching output transcript..."
    local transcript
    transcript=$(get_conv_field "$new_conv_id" "outputTranscript")
    echo " done"

    if [[ -z "$transcript" ]]; then
      warn "No output transcript in conversation $new_conv_id"
      transcript="(no transcript available)"
    fi

    echo ""
    echo -e "${GREEN}🤖 Gemini said:${NC}"
    echo "  $transcript"
    echo ""

    echo "  Running compliance checks..."

    # Write turn data + transcript to temp file to avoid shell escaping issues
    local turn_tmpfile
    turn_tmpfile=$(mktemp /tmp/viva_turn_XXXXXX.json)
    local transcript_tmpfile
    transcript_tmpfile=$(mktemp /tmp/viva_transcript_XXXXXX.txt)
    echo "$transcript" > "$transcript_tmpfile"

    python3 -c "
import json
t = json.load(open('$tmpfile'))['turns'][$i]
json.dump(t, open('$turn_tmpfile', 'w'))
"

    # Run compliance check (transcript read from file, not shell args)
    local result_json
    result_json=$(python3 -c "
import sys, json
sys.path.insert(0, '$SCRIPT_DIR')
from compliance_rules import check_scenario_turn

turn = json.load(open('$turn_tmpfile'))
transcript = open('$transcript_tmpfile').read()
result = check_scenario_turn(transcript, turn, $i)
print(json.dumps(result))
")
    rm -f "$turn_tmpfile" "$transcript_tmpfile"

    # Display results
    local failures
    failures=$(echo "$result_json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('failures', 0))")
    local unknowns
    unknowns=$(echo "$result_json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('unknowns', 0))")

    # Print human-readable
    python3 -c "
import sys, json
sys.path.insert(0, '$SCRIPT_DIR')
from compliance_rules import format_human_readable
result = json.loads('''$result_json''')
print(format_human_readable(result))
"

    if [[ "$failures" -gt 0 ]]; then
      fail "Turn $((i+1)): $failures violation(s)"
    elif [[ "$unknowns" -gt 0 ]]; then
      warn "Turn $((i+1)): $unknowns unclear — review needed"
    else
      pass "Turn $((i+1)): All rules passed"
    fi

    # Accumulate
    turn_results=$(python3 -c "
import json
existing = json.loads('''$turn_results''')
new = json.loads('''$result_json''')
existing.append(new)
print(json.dumps(existing))
")
  done

  # Trend analysis
  echo ""
  echo "  Trend analysis..."
  local trend
  trend=$(python3 -c "
import sys, json
sys.path.insert(0, '$SCRIPT_DIR')
from compliance_rules import generate_trend_analysis
turns = json.loads('''$turn_results''')
trend = generate_trend_analysis(turns)
print(json.dumps(trend))
")

  echo "$trend" | python3 -c "
import sys, json
t = json.load(sys.stdin)
for note in t.get('trend_notes', []):
    print(f'  {note}')
"

  # Save scenario results
  python3 -c "
import json
turns = json.loads('''$turn_results''')
trend = json.loads('''$trend''')
payload = {'scenario_id': '$scenario_id', 'scenario_name': '$scenario_name', 'turns': turns, 'trend': trend}
with open('$scenario_results_file', 'w') as f:
    json.dump(payload, f, indent=2)
print('  Results saved')
"
}

# ─── Main ───────────────────────────────────────────────────────────────────

SESSION_ID=$(date +%Y%m%d_%H%M%S)
SESSION_DIR="$REPORT_DIR/session_${SESSION_ID}"
mkdir -p "$SESSION_DIR"
REPORT_FILE="$SESSION_DIR/report_v${ITERATION}.md"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     Viva Voice — System Prompt Validation           ║"
echo "║     Multi-Turn Compliance Testing Framework         ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "Session: $SESSION_ID"
echo "Server:  $SERVER_URL"
echo "Output:  $SESSION_DIR"
echo "Report:  $REPORT_FILE"
echo ""

# List mode?
if [[ "$LIST_ONLY" == true ]]; then
  echo ""
  echo "Available Scenarios:"
  echo "──────────────────────────────────────────────────────"
  python3 -c "
import json
with open('$SCENARIOS_FILE') as f:
    data = json.load(f)
for i, s in enumerate(data['scenarios'], 1):
    print(f'  {i:2d}. {s[\"id\"]:<30s} {len(s[\"turns\"])} turns')
    print(f'      {s[\"name\"]}')
    print()
"
  exit 0
fi

# Check server
check_server

# Instructions
echo ""
echo -e "${YELLOW}${BOLD}How it works:${NC}"
echo "  1. Open http://localhost:8000 in your browser"
echo "  2. Connect the app (it auto-connects on page load)"
echo "  3. For each turn, read the 'Guest says' line and speak it into the mic"
echo "  4. Wait for Gemini to finish responding"
echo "  5. Press Enter — the framework checks the transcript against rules"
echo ""
read -r -p "Ready? Press Enter to start the first scenario... " dummy

# Determine which scenarios to run
if [[ "$RUN_ALL" == true ]]; then
  SCENARIO_IDS=$(python3 -c "
import json
with open('$SCENARIOS_FILE') as f:
    data = json.load(f)
print(' '.join(s['id'] for s in data['scenarios']))
")
elif [[ -n "$SPECIFIC_SCENARIO" ]]; then
  SCENARIO_IDS="$SPECIFIC_SCENARIO"
fi

for scenario_id in $SCENARIO_IDS; do
  echo ""
  echo "──────────────────────────────────────────────────────────────"
  read -r -p "Ready for '$scenario_id'? Press Enter (or type 'skip'): " answer
  if [[ "$answer" == "skip" ]]; then
    warn "Skipped"
    continue
  fi

  # Check scenario exists
  tmpfile=$(mktemp /tmp/viva_scenario_XXXXXX.json)
  python3 -c "
import json
with open('$SCENARIOS_FILE') as f:
    data = json.load(f)
for s in data['scenarios']:
    if s['id'] == '$scenario_id':
        json.dump(s, open('$tmpfile', 'w'))
        exit(0)
print('NOT_FOUND')
exit(1)
" 2>/dev/null && run_scenario "$tmpfile" || {
    fail "Scenario '$scenario_id' not found"
    rm -f "$tmpfile"
    continue
  }
  rm -f "$tmpfile"

  echo ""
  echo -e "${GREEN}✓ Scenario '$scenario_id' complete${NC}"
done

# ─── Generate Report ────────────────────────────────────────────────────────
echo ""
header "Generating Compliance Report"

# Collect all scenario results
ALL_RESULTS_FILE="$SESSION_DIR/all_results.json"
python3 -c "
import json, os, glob

results = {}
pattern = '$REPORT_DIR/${SESSION_ID}_*.json'
for f in glob.glob(pattern):
    sid = os.path.basename(f).replace('${SESSION_ID}_', '').replace('.json', '')
    with open(f) as fp:
        results[sid] = json.load(fp)

with open('$ALL_RESULTS_FILE', 'w') as fp:
    json.dump(results, fp, indent=2)

print(f'  Collected {len(results)} scenario result(s)')
"

info "Results saved to $ALL_RESULTS_FILE"

# Generate markdown report
python3 "$SCRIPT_DIR/compliance_report.py" \
  --results "$ALL_RESULTS_FILE" \
  --scenarios "$SCENARIOS_FILE" \
  --output "$REPORT_FILE" \
  --iteration 1

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  Session complete!                                   ║"
echo "║                                                      ║"
echo "║  Report:  $REPORT_FILE                                ║"
echo "║  Session: $SESSION_DIR                               ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "Review the report. Issues found will need your approval before fixes."
echo ""
