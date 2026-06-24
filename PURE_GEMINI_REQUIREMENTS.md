# Pure Gemini Live Pipeline - Requirements Document

**Branch**: `pure_gemini`  
**Status**: In Development  

---

## Overview

Replace the multi-provider voice pipeline (Gemini generateContent + Edge TTS) with **Gemini 3 Flash Live API** for unified audio-to-audio processing. This eliminates Edge TTS and reduces provider dependencies to a single Gemini Live connection.

---

## Current Architecture (Baseline — committed on pure_gemini)

```
Client PCM (16kHz, 16-bit, mono)
    ↓
WebSocket → Server
    ↓
[Gemini generateContent] → JSON {action, device, value, tts_text, lang}
    ↓
[Edge TTS Python CLI] → WAV audio base64
    ↓
WebSocket ← Server
    ↓
Client: playAudio(base64WAV) OR speakViaBrowser()
```

## Target Architecture

```
Client PCM (16kHz, 16-bit, mono, base64)
    ↓
WebSocket → Server
    ↓
[Gemini Live WebSocket]
    ├─ sendRealtimeInput(audio) ──→ Live API
    │
    └─ onmessage callbacks ←──
        ├─ Audio chunks (streamed PCM)
        └─ Text JSON {action, device, value, tts_text, lang}
    ↓
Relay to Client:
    ├─ audio_chunk messages (for browser playback)
    └─ response message (action/device/value for hub)
```

---

## Implementation Scope

### Files to Modify
1. **`voice-server/src/config.js`**
   - Add `gemini.liveModel` config (default: `gemini-3-flash-live`)

2. **`voice-server/src/gemini.js`**
   - Add `GeminiLiveService` class
   - Methods: `connect()`, `sendAudio()`, `close()`
   - Callbacks: `onAudioChunk`, `onTextResponse`, `onError`

3. **`voice-server/src/ws-handler.js`**
   - Import `GeminiLiveService`
   - Refactor `audio_end` handler:
     - Replace Gemini generateContent + Edge TTS with Live API
     - Establish Live session on audio_end
     - Forward audio chunks to client in real-time
     - Extract JSON commands from text responses
   - Keep `transcript` (text input) path using generateContent

4. **`voice-server/src/index.js`**
   - Remove Edge TTS import
   - Update replay endpoint to use GeminiLiveService

5. **`aranya-hub/data/js/voice.js`**
   - Update `handleAudioWsMessage()` to handle `audio_chunk` messages
   - Audio chunks now streamed incrementally

### Files to Delete
- `voice-server/src/edge-tts.js` (no longer used)
- `voice-server/test/edge-tts.test.js` (unit tests for edge-tts)

### Files to Update (Tests)
- `voice-server/test/ws-handler.test.js`
  - Remove `EdgeTTSService` stub
  - Update assertions for Live API flow
- `voice-server/test/language-detection.test.js`
  - Update test expectations (audio now streamed, not single base64)
- `voice-server/test/replay.test.js`
  - Update to use GeminiLiveService instead of EdgeTTS

---

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Model ID | `gemini-3-flash-live` | Confirmed; supports audio I/O via Live API |
| Audio Format | Raw PCM (no WAV wrapper) | Live API accepts `audio/pcm;rate=16000` natively |
| Audio Rate | 16kHz, 16-bit, mono | Matches client capture rate |
| Text Path | Keep `generateContent()` | Text-only input doesn't need streaming |
| Response Modalities | `["AUDIO", "TEXT"]` | Get both audio output and JSON commands |
| System Prompt | Reuse existing | Keep current device validation |

---

## API Contract Changes

### Server → Client (New `audio_chunk` messages)
```javascript
// Streamed audio chunks (NEW)
{ type: 'audio_chunk', data: '<base64 PCM>' }

// Final response (same structure, tts_audio empty)
{ type: 'response', action, device, value, tts_text, lang, tts_audio: '' }
```

### Client → Server (UNCHANGED)
```javascript
{ type: 'audio_chunk', data: '<base64 PCM>' }
{ type: 'audio_end' }
{ type: 'transcript', text, lang? }
```

### Client Implications
Client already has `speakViaBrowser()` fallback for empty `tts_audio`.
New `audio_chunk` messages are played incrementally via AudioContext.

---

## Files to Keep As-Is
- `voice-server/src/config.js` — only add `liveModel` field
- `voice-server/.env.example` — no changes
- `voice-server/package.json` — already has `@google/genai ^2.9.0` which supports Live API
- Voice UI CSS files — no changes
