# AGENTS.md

## Repository Overview

Aranya IoT resort management system with three sub-projects in one repo:

- `aranya-hub/` — Master hub firmware (ESP32, PlatformIO, Arduino framework)
- `aranya-node/` — Node firmware (ESP8266 NodeMCUv2, PlatformIO, Arduino framework)
- `voice-server/` — Voice assistant server (Node.js, ESM, Groq STT/LLM/TTS)

**Key architecture**: Hub is the central coordinator. Nodes are lightweight receivers. Voice server doubles as the HTTP server for the hub's web UI (serves static files from `aranya-hub/data/`).

## Build & Development

### Firmware (PlatformIO)

```bash
# Build/upload for hub
cd aranya-hub && pio pkg install && pio run
pio run --target upload && pio device monitor

# Build/upload for node (must set NODE_ID in include/config.h first)
cd aranya-node && pio run --target upload
```

Both subprojects have their own `platformio.ini`. **CI bug**: the workflow runs bare `pio run` from repo root, but no `platformio.ini` exists there. CI will fail unless run from the subdirectory. To test locally: `act -j build` from the hub or node dir.

- **Hub binary**: `.pio/build/esp32dev/firmware.bin`
- **Node binary**: `.pio/build/nodemcuv2/firmware.bin`
- **Flash constraint**: Max 1.5MB

### Voice Server (Node.js)

```bash
cd voice-server
npm install              # deps: express, ws, groq-sdk, openai, dotenv
npm start                # entry: src/index.js, listens on port 8080
npm test                 # Mocha + Chai + Sinon (3 test files)
```

`voice-server/src/index.js` auto-creates `.env` from `.env.example` if missing and serves static files from `../../aranya-hub/data`. Requires `GROQ_API_KEY` in `.env`.

**Casing bug**: `src/config.js` exports `config.wsPort` but `src/index.js` reads `config.WS_PORT` — both default to 8080, so it works, but agents should not rely on this behavior.

### Test Details

```bash
# Run all
npm test

# Test files: llm.test.js (stubbed), tts.test.js (piper/OpenAI/fallback), ws-handler.test.js
# Also: test_e2e.js (manual E2E, requires running server)
```

Tests are stub-heavy (sinon). Real E2E requires `GROQ_API_KEY` and a running server. `test_e2e.js` opens real WebSocket connections against `localhost:8080`.

### Pre-commit / Lint / Format

None configured. No formatter, no linter, no type checker. Do not assume any.

## ESP-NOW Packet Structure

Two **different** files — DO NOT assume they are identical:

- `aranya-hub/include/packet_struct.h` — Simple 4-byte packet (room_id, device_type, action_value, checksum)
- `aranya-node/include/packet_struct.h` — Extended packet with `ac_payload` bitfield union for structured AC commands (power, temp, fan_speed, mode, extended flag)

Both use XOR checksum (only over room_id, device_type, action_value). The node checks `packet.room_id == NODE_ID`. Both must be on the same ESP-NOW channel (default: 1). The node uses `ESPNOW_KEY` encryption key (set in `include/config.h`).

## Device Types & Control Values

| Type | Code | Hub sends | Node handles |
|------|------|-----------|--------------|
| AC | 0 | Temp 16-30°C | Legacy IR codes OR extended bitfield (if `extended==1`): power(1bit)+temp(7bit)+fan(2bit)+mode(3bit) |
| Blinds | 1 | 0=close, 1=open | 0=close, 1=open, 2=toggle |
| Light | 2 | 0=sunrise, 1=reading, 2=dusk | On/off relay (action > 0 = HIGH) |
| LED | 3 | 0=campfire, 1=poolside, 2=movie | 8 scenes via FastLED (off, warm, cool, sunset, ocean, forest, party, fire) |
| Scene/Service | 4 | 0=Normal, 1=Silent, 2=DND | Service request (flashes status LED) |

Node LED scenes (vs hub's 3): node has 8 scenes. Hub sends 0-2.

## Web UI

Served by the voice server. Access at `http://localhost:8080`.

**Guest dashboard** (`index.html`): scene selector, room controls (AC/blinds/light/LED), lighting presets, service request, voice FAB. Loads `js/app.js` + `js/voice.js` + `css/style.css` + `css/voice.css`.

**Admin panel** (`/admin` served from `admin.html`): node management, network config, activity log. Protected by HTTP Basic Auth (`admin` / `aranya2024`).

**Config files** (on hub's LittleFS, served via ESP32): `config.json` (node mappings + ws_url), `scenes.json` (scene presets with target_node, presets).

**WebSocket**: Connects to `ws://localhost:8080/ws`. Messages: `{type, room_id, device_type, action_value}`. The hub ESP32 broadcasts node messages via `_ws_broadcast()`.

## Voice Pipeline

audio → `Groq STT (whisper-large-v3-turbo)` → `Groq LLM (llama-3.3-70b-versatile)` → `TTS (Piper→OpenAI→silent fallback)`

**Piper**: requires `models/{lang}.onnx` files and `piper` binary on PATH. Supports en, hi, te. If unavailable, falls to OpenAI TTS (`OPENAI_API_KEY`). If that fails, returns 44-byte empty WAV.

**STT**: writes audio to `/tmp/audio.wav`, sends to Groq, deletes nothing (pileup possible).

**LLM**: instructed to return JSON: `{action, device, value, tts_text}`. Uses `response_format: json_object`.

## Hub & Node Details

### Hub (aranya-hub)
- **Board**: ESP32 dev module, framework=arduino
- **Deps**: ESPAsyncWebServer, AsyncTCP, ArduinoJson, esp_now, LittleFS
- **Dual WiFi mode**: STA + AP always. Default STA: `ARANYA_WIFI` / `aranya2024`. Default AP: `ARANYA_HUB` / `aranya123`
- **Serial**: 115200 baud, monitor filter `esp32_exception_decoder`
- **Max nodes**: 32, max packet queue: 64
- **ESP-NOW retry**: 3 attempts, 2s timeout
- **Node timeout**: 30s (no packet → marked offline)
- **Status broadcast**: every 10s on serial, 30s node check
- **OTA**: `include/config.h` has `{{OTA_SERVER_URL}}` placeholders — the template vars are NOT filled. No functional OTA endpoint in code. Recovery: hold D5 at boot.
- **API endpoints**: `GET /api/status`, `POST /api/scene?scene=&room=`, `POST /api/room/:id/control?device=&action=`, `POST /api/service?room=&type=`, `GET/POST /api/nodes`, `POST /api/config`

### Node (aranya-node)
- **Board**: NodeMCUv2 (ESP8266), framework=arduino
- **Deps**: IRremoteESP8266, FastLED
- **Build flags**: `ENABLE_IR`, `ENABLE_RELAY`, `ENABLE_LED`, `ENABLE_ESPNOW`
- **Upload**: 921600 baud to `/dev/ttyUSB0`
- **Watchdog**: 8s timeout via Ticker — resets if no ESP-NOW packet received for 8s
- **Must set `NODE_ID` in `include/config.h`** before flashing (1=Glass Room A, 2=Room B, 3=Amphitheater, 4=Pool Area)
- **ESP-NOW encryption key**: `ESPNOW_KEY` in `config.h` (16-byte)
- IR sender uses NEC protocol (32-bit) for AC control
- GPIO: D1=blinds relay, D2=lights relay, D4=status LED, D6=WS2812 data, D5=IR LED
- Blinds relay: inverted logic (LOW=open, HIGH=closed)

## CI/CD

- `.github/workflows/ci_placeholder.yml` — triggers on push/PR to `main`/`master`
- Builds firmware via PlatformIO, uploads artifacts (.bin, .elf, .hex)
- **Known issue**: runs `pio run` from repo root, but no root `platformio.ini` exists. Needs `working-directory:` set to `aranya-hub` or `aranya-node`.
- Commented-out upload blocks for S3, GitHub Releases, Backblaze B2
- Local test: `act -j build`

## Important Gotchas

- `voice-server/src/index.js:38` serves `../../aranya-hub/data` — this path must resolve correctly relative to `src/`, not the package root.
- `voice-server/src/index.js:44` reads `config.WS_PORT` but `src/config.js:6` exports `wsPort` (lowercase 'p'). Both default to 8080 — the mismatch has no runtime effect but is technically wrong.
- Hub `include/config.h` has `{{OTA_SERVER_URL}}` and `{{CANONICAL_OTA_KEY}}` placeholders that were never populated — the firmware boots fine but OTA update will try to HTTP GET from a literal URL containing `{{...}}`.
- Node `include/config.h` has `NODE_ID 1` uncommented by default. **Change this before every flash.**
- The CI workflow will fail on `pio run` from repo root — it needs `cd aranya-hub && pio run` (or per-env CI split).
