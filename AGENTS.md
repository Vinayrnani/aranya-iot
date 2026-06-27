# Viva Voice — AGENTS.md

Not an IoT project despite the directory name. This is **Viva Voice**, a trilingual (EN/HI/TE) voice AI assistant using Google's Gemini Live API.

## Stack

- **Backend**: Python aiohttp (single file: `server.py`). Serves static frontend + provisions ephemeral Gemini tokens.
- **Frontend**: Vanilla JS, CSS3, HTML. No framework, no bundler, no transpiler.
- **PWA**: Service worker (`sw.js`) + manifest (`manifest.json`). Offline-capable app shell.
- **Dependencies** (Python, `requirements.txt`): `aiohttp>=3.9,<4`, `python-dotenv>=1.0`.

## Run

```bash
pip install aiohttp python-dotenv
python server.py                          # http://0.0.0.0:8000
# or
./start.sh                                # PID-managed, nohup background, logs to server.log
```

Requires `GEMINI_API_KEY` in `.env` (copy from `.env.example`). Get one at https://aistudio.google.com/apikey.

## Architecture

```
Browser ──POST /api/token──▶ Python server ──▶ Gemini API (ephemeral token)
Browser ──wss://.../────────▶ Gemini Live API (direct, no media through server)
```

The Python server is **only a token proxy**. All audio streaming is browser↔Gemini via WebSocket.

## Important details an agent would miss

- **No build, test, lint, or typecheck tooling.** There is nothing to install beyond `pip`. No npm, no package.json, no CI.
- **Frontend cache-busting** uses `?v=3` query params on script/style tags in `index.html`. Bump the number when changing JS/CSS.
- **Default model**: `gemini-3.1-flash-live-preview` (hardcoded in `server.py:38`).
- **Voices** (in settings): Puck, Charon, Kore (default), Fenrir, Aoede — Gemini prebuilt voices.
- **Audio format**: Mic input = PCM 16-bit 16 kHz mono. Playback = PCM 16-bit 24 kHz mono (Gemini output rate).
- **Known API quirk**: `server.py:100` sends `"responseModalities": ["AUDIO"]` in the token request. If the Gemini Live API rejects it, the field name may differ from what the proto expects — this is the most likely failure point.
- **`.env` is committed** (no `.gitignore`). Be careful not to leak the API key.
- **No git repository** in this checkout (`.git/` is absent).

## Project structure

```
├── server.py                  # Python aiohttp server (179 lines, 4 routes)
├── requirements.txt
├── start.sh                   # PID-managed restart script
├── .env / .env.example        # GEMINI_API_KEY
├── frontend/
│   ├── index.html             # PWA shell
│   ├── app.js                 # UI state machine, event bindings (444 lines)
│   ├── geminilive.js          # Gemini Live API WebSocket client (374 lines)
│   ├── audio-handler.js       # AudioCapture + AudioPlayer (275 lines)
│   ├── style.css              # Full design system (959 lines)
│   ├── manifest.json          # PWA manifest
│   └── sw.js                  # Service Worker (76 lines)
└── .playwright-mcp/           # Exploratory browser automation logs (not a test suite)
```

## Guidelines

- **Single-file backend**: All Python logic is in `server.py`. Add routes to `create_app()`.
- **No generated code, no migrations, no codegen.**
- **Trilingual system prompt**: The app instructs Gemini to echo the user's selected language (en/hi/te). Language state is tracked in `app.js`.
- **If adding deps**: Update both `requirements.txt` and the inline `pip install` in `start.sh`.
- **Testing**: None exists. Only exploratory Playwright MCP logs in `.playwright-mcp/`. If adding tests, start from scratch.
