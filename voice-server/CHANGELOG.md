# Voice Server Changelog

## 2026-06-24 — Fix: sendEndOfTurn uses correct SDK API

### Problem
Gemini Live API pipeline connected and sent audio but the model never responded — always hit 30s timeout returning "Sorry, I did not understand."

### Root Cause
`sendEndOfTurn()` in `src/gemini.js` was calling `this.session.sendRealtimeInput({ mediaChunks: [] })` which sends an empty realtime audio input — this does NOT signal turn completion. The model kept waiting for more audio.

### Fix
Changed to `this.session.sendClientContent({ turnComplete: true })` — the correct SDK v2.0.0 method for signaling the end of a user turn. `sendClientContent()` sends a `clientContent` WebSocket message with `turnComplete: true`, which tells the model "user is done speaking, generate a response."

### Files Changed
- `src/gemini.js` — `sendEndOfTurn()` method (line 172-182)
- `src/ws-handler.js` — Removed emergency mock command injection (lines 290-295) that was faking `turn_on light` when model didn't call tool
- `src/index.js` — Fixed startup log to show live model name instead of non-Live model name
