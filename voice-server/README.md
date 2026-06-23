# voice-server

WebSocket-based voice assistant server for Aranya IoT, using **Gemini 2.5 Flash Preview** for STT + intent understanding and **Edge TTS** for speech synthesis.

## Pipeline

```
Audio PCM (16kHz mono)
  → Gemini 3.1 Flash Lite (STT + LLM in one call)
    → JSON: { action, device, value, tts_text, lang }
  → Edge TTS (Python CLI, free, no API key)
    → WAV audio → client
```

## Prerequisites

- Node.js 18+
- Python 3.x with `edge-tts` (`pip install edge-tts`)
- A [Gemini API key](https://aistudio.google.com/apikey) (free tier)

## Setup

```bash
# Install Node.js dependencies
npm install

# Install Edge TTS
pip install edge-tts

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
| `GEMINI_MODEL` | `gemini-2.5-flash-preview` | Model override (see alternatives in `.env.example`) |

## Language Support

The pipeline supports English (`en`), Hindi (`hi`), and Telugu (`te`) with code-switching via Gemini's native multilingual understanding. Edge TTS voices:

- `en-US-JennyNeural`
- `hi-IN-SwaraNeural`
- `te-IN-ShrutiNeural`

## Project Structure

```
voice-server/
├── src/
│   ├── config.js       # Environment config (gemini.apiKey, gemini.model)
│   ├── index.js        # Entry point (Express + WebSocket server)
│   ├── ws-handler.js   # WebSocket pipeline orchestration
│   ├── gemini.js       # Gemini 2.5 Flash wrapper (audio + text)
│   └── edge-tts.js     # Edge TTS CLI wrapper
├── test/
│   ├── gemini.test.js           # STT+LLM unit tests
│   ├── edge-tts.test.js         # TTS real integration tests
│   ├── ws-handler.test.js       # Pipeline orchestration tests
│   ├── language-detection.test.js # E2E pipeline tests (requires API key)
│   └── replay.test.js           # History replay tests
└── .env.example
```

## Conversation History

The server stores the last 15 conversation entries with per-sub-step recording (audio → Gemini → TTS). Access via `GET /api/voice-history` and replay via `POST /api/voice-history/:index/replay`.

## Web UI

Served from `../../aranya-hub/data/`. Guest dashboard at `http://localhost:8080`, admin panel at `http://localhost:8080/admin`.
