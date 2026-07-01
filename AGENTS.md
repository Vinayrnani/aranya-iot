# Viva Voice — AGENTS.md

Not an IoT project despite the directory name. This is **Viva Voice**, a trilingual (EN/HI/TE) voice AI assistant using Google's Gemini Live API for a resort/hospitality setting.

## Stack

- **Backend**: Python aiohttp (`server.py`, 368 lines). Token proxy + static file server + conversation recording API.
- **Frontend**: Vanilla JS (no framework/bundler/transpiler). 6 JS files, 1 CSS, 1 HTML PWA shell.
- **PWA**: Service worker (`sw.js`) + manifest (`manifest.json`).
- **Dependencies** (`requirements.txt`): `aiohttp>=3.9,<4`, `python-dotenv>=1.0`. Nothing else.
- **System prompt**: External `system-prompt.md` (100 lines, XML-tagged). Live-read every time server provisions a token.

## Run

```bash
pip install aiohttp python-dotenv
python server.py                          # http://0.0.0.0:8000
# or
./start.sh                                # PID-managed via .server.pid, nohup, logs to server.log
```

Requires `GEMINI_API_KEY` in `.env` (copy from `.env.example`). Get one at https://aistudio.google.com/apikey.

## Architecture

```
Browser ──POST /api/token──▶ Python server (reads system-prompt.md, provisions ephemeral token)
Browser ──wss://.../────────▶ Gemini Live API (direct WebSocket, no audio through server)
```

The Python server is **only a token proxy** — all audio streaming is browser↔Gemini direct.

System prompt flow:
```
system-prompt.md (on disk) → server reads on every POST /api/token
  → returned as tokenData.systemPrompt
  → client passes it to GeminiLiveClient.connect(..., systemPrompt)
  → injected into WebSocket setup message (systemInstruction.parts[0].text)
```

If server returns no prompt, client falls back to a hardcoded multilingual prompt in `geminilive.js:97-109`.

## Project structure

```
├── server.py                  # aiohttp server (368 lines, 11 routes)
├── requirements.txt
├── start.sh                   # PID-managed restart
├── system-prompt.md           # Live-loaded system prompt (XML-tagged, 100 lines)
├── .env / .env.example        # GEMINI_API_KEY
├── conversations/             # Saved conversation recordings (input/output PCM + transcripts)
├── frontend/
│   ├── index.html             # PWA shell, cache-bust via ?v=N on scripts/styles
│   ├── app.js                 # UI state machine, event bindings (658 lines)
│   ├── geminilive.js          # Gemini Live API WebSocket client (424 lines)
│   ├── audio-handler.js       # AudioCapture + AudioPlayer (251 lines)
│   ├── audio-worklet-processor.js  # AudioWorklet for mic input (75 lines)
│   ├── conversations.js       # Conversation recording + server save (181 lines)
│   ├── style.css              # Design system (837 lines)
│   ├── manifest.json
│   └── sw.js                  # Service Worker (85 lines)
├── tests/
│   ├── analyze-audio.py       # Audio quality analyzer (PCM validation, speech vs noise)
│   ├── run-e2e-test.sh        # E2E: opens app, captures audio, runs analysis
│   ├── replay-test.sh         # Replay saved conversations from server
│   ├── test-system-prompt.sh  # Validates system prompt delivery pipeline
│   └── fixtures/              # Synthetic test audio (speech-chirp.b64)
├── test_server.py             # Python: start server, verify /api/token returns systemPrompt
├── test_server_simple.sh      # Bash: same test via curl
├── test_simple.sh             # Quick smoke test (curl token endpoint)
└── FEATURES.md                # Future ideas (booking-based sessions, etc.)
```

## Important details an agent would miss

### Server
- **Single-file backend**: All Python logic in one file. Add routes to `create_app()` (line 329).
- **Token request is minimal**: Server sends `{"uses": 1}` — no `responseModalities` or config. The **client** sends `responseModalities: ["AUDIO"]` in its WebSocket setup (`geminilive.js:156`). If the Gemini API rejects it, the proto field name is the most likely failure point.
- **System prompt is live-reloaded**: `load_system_prompt()` reads `system-prompt.md` from disk on every `/api/token` call. Edits take effect immediately — no server restart needed.
- **Default model**: `gemini-3.1-flash-live-preview` hardcoded at `server.py:47`.
- **.env is committed** (no `.gitignore`). Don't leak the API key.
- **No migrations, no codegen, no database**.

### Frontend
- **Cache-busting** via `?v=N` query params on `<script>` and `<link>` tags in `index.html`. Current: css `v=7`, app.js `v=15`, geminilive.js `v=9`, audio-handler.js `v=5`, conversations.js `v=1`. Bump when changing files.
- **Voices**: Puck, Charon, Kore (default), Fenrir, Aoede — Gemini prebuilt voices. Set in settings panel and `geminilive.js:29`.
- **Audio format**: Mic input = PCM 16-bit 16 kHz mono (via AudioWorklet). Playback = PCM 16-bit 24 kHz mono (Gemini output rate).
- **Conversation recording**: `conversations.js` captures every turn (input/output PCM + transcripts) and POSTs to server on turn end or disconnect. Saved to `conversations/<id>/` on disk.

### System Prompt (`system-prompt.md`)
- XML-tagged sections: `<role_and_persona>`, `<location_context>`, `<local_knowledge_and_search>`, `<capabilities_and_implicit_commands>`, `<unsupported_and_faqs>`, `<compound_commands>`, `<domain_boundaries_and_emergencies>`, `<hardware_desync_and_frustration>`, `<language_rules>`, `<behavioral_constraints>`, `<critical_voice_rules>`.
- **Critical rule**: Voice model must never end turn with a question or filler (`<critical_voice_rules>`). This is the most frequently violated constraint — test specifically for it.
- Trilingual: English, Hindi, Telugu. Preference order: Telugu > Hindi > English.
- Resort/hospitality persona with specific local knowledge (temple distances, timings).

### API routes (server.py)
| Route | Method | Purpose |
|---|---|---|
| `/api/token` | POST | Provision ephemeral Gemini token + system prompt |
| `/api/health` | GET | Health check |
| `/api/conversations/save` | POST | Save recorded conversation |
| `/api/conversations` | GET | List saved conversations |
| `/api/conversations/{id}/{filename}` | GET | Serve conversation audio/manifest |
| `/api/conversations/{id}` | DELETE | Delete a conversation |
| `/` | GET | Serve index.html |
| `/{filename}` | GET | Serve static frontend files |

Static frontend files are individually routed (no catch-all). Add new files to the `FRONTEND_FILES` list in `create_app()` (`server.py:343`).

## Testing

### System prompt delivery test
```bash
./test_server.py              # Python: starts server, verifies systemPrompt in token response
./test_server_simple.sh       # Bash: same test via curl
./test_simple.sh              # Quick smoke test (no assertions)
./tests/test-system-prompt.sh # Full pipeline validation (server, file, client fallback, E2E mode)
```

### Audio quality test
```bash
./tests/run-e2e-test.sh                 # Opens app via Playwright, captures Gemini response, analyzes
./tests/run-e2e-test.sh --analyze-only output.b64  # Re-analyze previously captured audio
```

### Conversation replay test (requires server running with saved conversations)
```bash
./tests/replay-test.sh                    # Replay last 12 conversations
./tests/replay-test.sh --count 5         # Replay last 5
./tests/replay-test.sh --list            # List available conversations without replaying
```

### System prompt validation framework

Structured testing framework for validating Gemini Live responses against `system-prompt.md` rules.

#### How it works

```
start.sh → browser → speak into mic → Gemini responds
                                         ↓
                              conversation auto-saved to conversations/<id>/
                                         ↓
  ./tests/run-validation.sh polls server, fetches transcript, runs compliance rules
                                         ↓
                              report_v<N>.md with pass/fail per rule per turn
```

#### Files

| File | Purpose |
|------|---------|
| `tests/scenarios/scenarios.json` | 9 multi-turn guest scenarios (37 turns), natural dialogue |
| `tests/compliance_rules.py` | 14 rule handlers checking transcripts against system prompt rules |
| `tests/compliance_report.py` | Markdown report generator with per-turn detail, aggregate, trend analysis |
| `tests/run-validation.sh` | Interactive orchestrator: prints turn script → waits for speech → fetches transcript → runs rules |
| `tests/demo_run.py` | Simulated run using hardcoded responses (no Gemini API needed) |

#### Running a validation session

```bash
# 1. Start server
./start.sh

# 2. Open http://localhost:8000 in a browser, connect

# 3. Run validation (default: all 9 scenarios, report_v1.md)
./tests/run-validation.sh

# Single scenario only
./tests/run-validation.sh --scenario language_adherence

# Subsequent runs: use increasing iteration number
./tests/run-validation.sh --iteration 2

# Resume a partial session
./tests/run-validation.sh --resume sessions/<id>
```

Each turn: read the guest script aloud → wait 3s → framework fetches transcript from server → runs rules → shows pass/fail. Takes ~30s per scenario.

#### Validation rules (compliance_rules.py)

| Rule | What it checks |
|------|---------------|
| `no_trailing_question` | Response ends with "Anything else?", "What would you like?", etc. |
| `no_filler` | Contains "let me know if you need", "is there anything else", etc. |
| `language_consistent` | Response matches guest's language (TE/HI/EN) |
| `language_code_switch` | Expected language code-switch occurs |
| `hardware_brief` | Hardware command gets brief response (≤20 words) |
| `first_greeting_only` | Greeting with capabilities only on turn 1 |
| `domain_boundary` | Off-domain questions declined politely |
| `implicit_command` | Implicit intent ("I'm cold") inferred vs literal response |
| `compound_command` | Multi-part requests addressed (≥2 action words) |
| `emergency_referral` | Emergency/help requests referred to front desk |
| `no_argument` | Hardware failure gets graceful suggestion, not argument |
| `night_mode` | Late-night requests get ambiance-aware response |
| `no_greeting_repeat` | No repeated "welcome to Viva" on subsequent turns |

#### Report format

Reports go to `tests/output/session_<id>/report_v<N>.md` with:
- Executive summary (pass/fail counts per scenario)
- Per-turn expandable detail (pass/fail per rule with evidence)
- Aggregate issue analysis sorted by frequency
- Trend analysis (degradation across turns within a scenario)

### If adding tests
- Add new scenarios to `tests/scenarios/scenarios.json`
- Add new rules to `tests/compliance_rules.py` as a `check_<rule>()` function
- Register in `RULE_HANDLERS` dict and `RULE_DESCRIPTIONS` dict
- See `compliance_rules.py` for existing rule patterns

## If adding deps
Update both `requirements.txt` and the inline `pip install` in `start.sh`.
