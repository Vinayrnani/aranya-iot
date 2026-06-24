# voice-server

WebSocket-based voice assistant server for Aranya IoT, using **Gemini Live API** for real-time bidirectional voice + intent understanding. Has two pipelines:

**Legacy (non-Live)**: Audio PCM → Gemini 3.1 Flash Lite (STT + LLM) → Edge TTS → WAV
**Live (current)**: Audio PCM → Gemini 3 Flash Live (real-time bidirectional) → audio chunks streamed back

## Pipeline (Live API)

```
Audio PCM (16kHz mono chunks)
  → Gemini 3 Flash Live (real-time bidirectional audio streaming)
    → Audio chunks streamed back to client via WebSocket
    → JSON text responses: { action, device, value, tts_text, lang }
```

## Prerequisites

- Node.js 18+
- A [Gemini API key](https://aistudio.google.com/apikey) (free tier) with Live API access

## Setup

```bash
# Install Node.js dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

## Usage

```bash
# Start the server (listens on port 8080)
npm start

# Run tests
npm test
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `WS_PORT` | `8080` | WebSocket server port |
| `GEMINI_API_KEY` | — | Gemini API key (required) |
| `GEMINI_MODEL` | `gemini-3.1-flash-lite` | Non-Live Gemini model for legacy pipeline |
| `GEMINI_LIVE_MODEL` | `gemini-3.1-flash-live-preview` | Live API model for real-time bidirectional voice (BidiGenerateContent) |

## Language Support

The pipeline supports English (`en`), Hindi (`hi`), and Telugu (`te`) with code-switching via Gemini's native multilingual understanding. The Live API streams back audio directly without needing external TTS.

## Project Structure

```
voice-server/
├── src/
│   ├── config.js       # Environment config (gemini.apiKey, gemini.model, gemini.liveModel)
│   ├── index.js        # Entry point (Express + WebSocket server)
│   ├── ws-handler.js   # WebSocket pipeline orchestration
│   ├── gemini.js       # Gemini wrapper: GeminiLiveService (Live API) + legacy processAudio/Gemini
│   └── edge-tts.js     # (removed — replaced by Live API's built-in audio output)
├── test/
│   ├── gemini.test.js           # Non-Live STT+LLM unit tests
│   ├── gemini-live.test.js      # GeminiLiveService unit tests (Live API)
│   ├── ws-handler.test.js       # Pipeline orchestration tests
│   ├── language-detection.test.js # E2E pipeline tests (requires API key)
│   └── replay.test.js           # History replay tests
└── .env.example
```

## Conversation History

The server stores the last 15 conversation entries with per-sub-step recording (audio → Gemini). Access via `GET /api/voice-history` and replay via `POST /api/voice-history/:index/replay`.

## Web UI

Served from `../../aranya-hub/data/`. Guest dashboard at `http://localhost:8080`, admin panel at `http://localhost:8080/admin`.
