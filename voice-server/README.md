# voice-server

WebSocket-based voice server for Aranya IoT, using Groq for STT, LLM, and TTS.

## Prerequisites

- Node.js 18+
- A [Groq](https://console.groq.com) API key

## Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your GROQ_API_KEY
```

## Usage

```bash
# Start the server
npm start

# Run tests
npm test
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `WS_PORT` | `8080` | WebSocket server port |
| `GROQ_API_KEY` | — | Groq API key (required) |
| `GROQ_STT_MODEL` | `whisper-large-v3-turbo` | STT model |
| `GROQ_LLM_MODEL` | `llama-3.3-70b-versatile` | LLM model |
| `GROQ_TTS_MODEL` | `playai-tts` | TTS model |

## Project Structure

```
voice-server/
├── src/
│   ├── config.js      # Environment config
│   ├── index.js        # Entry point
│   ├── ws-handler.js   # WebSocket connection handler
│   ├── stt.js          # Speech-to-Text
│   ├── llm.js          # LLM query
│   └── tts.js          # Text-to-Speech
└── test/
    └── scaffold.test.js  # Module scaffold tests
```
