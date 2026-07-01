#!/usr/bin/env python3
"""
Viva Voice — Gemini Live API Test Client

Connects directly to the Gemini Live API (no browser), sends audio fixtures,
and captures response transcripts for compliance analysis.

Usage:
    # Single test
    python3 live_test_client.py --audio-file audio.b64 --output transcript.txt

    # Test a turn from scenarios.json
    python3 live_test_client.py --scenario lang-adherence --turn 0 --output results/

Protocol (mirrors geminilive.js):
    1. POST /api/token → ephemeral token + system prompt
    2. WebSocket wss://.../BidiGenerateContentConstrained?access_token={token}
    3. Send setup (binary JSON, first byte 0x7B)
    4. Send audio (binary PCM 16-bit 16kHz)
    5. Receive responses (binary JSON or PCM)
    6. Extract outputTranscription from serverContent messages
    7. Disconnect
"""

import asyncio
import base64
import json
import os
import struct
import sys
import time
from typing import Optional, Dict, Any, List

import aiohttp
from aiohttp import web
import websockets

# Default server
SERVER_URL = "http://127.0.0.1:8000"
SAMPLE_RATE = 16000  # Mic input rate


class GeminiLiveTestClient:
    """Test client for the Gemini Live API."""

    def __init__(self, server_url: str = SERVER_URL):
        self.server_url = server_url
        self.token: Optional[str] = None
        self.model: str = "gemini-3.1-flash-live-preview"
        self.system_prompt: Optional[str] = None
        self.ws: Optional[websockets.WebSocketClientProtocol] = None
        self.session_active = False

        # Collected response data
        self.output_transcript: str = ""
        self.input_transcript: str = ""
        self.audio_chunks: List[bytes] = []
        self.turn_complete = False
        self.error: Optional[str] = None

    async def fetch_token(self) -> Dict[str, Any]:
        """Get an ephemeral token + system prompt from our server."""
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.server_url}/api/token",
                json={"model": self.model},
            ) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    raise RuntimeError(f"Token API returned {resp.status}: {text}")
                data = await resp.json()

        self.token = data.get("token", "")
        self.model = data.get("model", self.model)
        self.system_prompt = data.get("systemPrompt", "")

        if not self.token:
            raise RuntimeError("No token in server response")

        print(f"  Token obtained: {self.token[:20]}...")
        print(f"  System prompt: {len(self.system_prompt)} chars")
        print(f"  Model: {self.model}")
        return data

    async def connect(self, system_prompt_override: Optional[str] = None):
        """Connect to Gemini Live API WebSocket."""
        if not self.token:
            await self.fetch_token()

        prompt = system_prompt_override or self.system_prompt

        ws_url = (
            "wss://generativelanguage.googleapis.com/ws/"
            "google.ai.generativelanguage.v1alpha.GenerativeService."
            f"BidiGenerateContentConstrained?access_token={self.token}"
        )

        print(f"  Connecting to Gemini Live API...")
        self.ws = await websockets.connect(ws_url, ping_interval=None)

        # Send setup message as binary JSON
        setup = {
            "setup": {
                "model": f"models/{self.model}",
                "generationConfig": {
                    "responseModalities": ["AUDIO"],
                    "speechConfig": {
                        "voiceConfig": {
                            "prebuiltVoiceConfig": {
                                "voiceName": "Kore",
                            },
                        },
                    },
                },
                "systemInstruction": {
                    "parts": [{"text": prompt}],
                },
                "inputAudioTranscription": {},
                "outputAudioTranscription": {},
            },
        }

        setup_json = json.dumps(setup)
        await self.ws.send(setup_json.encode("utf-8"))
        print(f"  Setup sent ({len(setup_json)} bytes)")
        return True

    async def send_audio(self, pcm_bytes: bytes):
        """Send raw PCM 16-bit audio data as binary."""
        if not self.ws:
            raise RuntimeError("Not connected")
        await self.ws.send(pcm_bytes)
        print(f"  Audio sent: {len(pcm_bytes)} bytes")

    async def send_audio_from_base64(self, b64_file: str):
        """Load base64 PCM from file and send it."""
        with open(b64_file) as f:
            b64_data = f.read().strip()
        pcm = base64.b64decode(b64_data)
        await self.send_audio(pcm)

    async def send_silence(self, duration_ms: int = 500):
        """Send silence (placeholder to trigger response)."""
        num_samples = int(SAMPLE_RATE * duration_ms / 1000)
        pcm = struct.pack(f"<{num_samples}h", *[0] * num_samples)
        await self.send_audio(pcm)

    async def send_end_of_turn(self):
        """Signal end of turn (not always needed - Gemini detects silence)."""
        # The Gemini Live API doesn't use explicit end-of-turn signals
        # for audio; it detects end of speech from silence.
        # Just send a brief silence and wait.
        await self.send_silence(300)

    async def receive_response(self, timeout: float = 15.0) -> Dict[str, Any]:
        """
        Receive and process Gemini response messages.
        Returns collected transcripts and metadata.
        """
        if not self.ws:
            raise RuntimeError("Not connected")

        self.output_transcript = ""
        self.input_transcript = ""
        self.audio_chunks = []
        self.turn_complete = False

        start_time = time.time()

        while time.time() - start_time < timeout:
            try:
                message = await asyncio.wait_for(
                    self.ws.recv(), timeout=min(timeout, 5.0)
                )
            except asyncio.TimeoutError:
                if self.turn_complete:
                    break
                continue

            # All messages from Gemini Live API are binary
            if isinstance(message, bytes):
                if len(message) == 0:
                    continue

                # First byte determines type: 0x7B ('{') = JSON, else = PCM audio
                if message[0] == 0x7B:
                    try:
                        msg = json.loads(message.decode("utf-8"))
                    except (json.JSONDecodeError, UnicodeDecodeError):
                        continue

                    await self._handle_message(msg)

                    # Stop if we have a complete transcript
                    if self.turn_complete and self.output_transcript:
                        break
                else:
                    # PCM audio data
                    self.audio_chunks.append(message)
            else:
                # Text message (fallback)
                try:
                    msg = json.loads(message)
                    await self._handle_message(msg)
                except json.JSONDecodeError:
                    pass

        return {
            "output_transcript": self.output_transcript,
            "input_transcript": self.input_transcript,
            "audio_chunks": len(self.audio_chunks),
            "audio_bytes": sum(len(c) for c in self.audio_chunks),
            "turn_complete": self.turn_complete,
            "error": self.error,
        }

    async def _handle_message(self, msg: Dict[str, Any]):
        """Process a JSON message from Gemini."""
        # Setup complete
        if msg.get("setupComplete"):
            self.session_active = True
            print(f"  ✅ Session active")

        # Server content (audio + transcriptions)
        sc = msg.get("serverContent")
        if sc:
            # Input transcription (what Gemini heard)
            if sc.get("inputTranscription", {}).get("text"):
                text = sc["inputTranscription"]["text"]
                self.input_transcript += text
                print(f"  🎤 Heard: {text[:80]}...")

            # Output transcription (what Gemini said)
            if sc.get("outputTranscription", {}).get("text"):
                text = sc["outputTranscription"]["text"]
                self.output_transcript += (" " + text).strip()
                print(f"  🤖 Said: {text[:80]}...")

            # Turn complete
            if sc.get("turnComplete"):
                self.turn_complete = True
                print(f"  ✅ Turn complete")

            # Interrupted
            if sc.get("interrupted"):
                print(f"  ⚠️ Interrupted")

        # Errors
        if msg.get("error"):
            self.error = msg["error"].get("message", str(msg["error"]))
            print(f"  ❌ Error: {self.error}")

        # Token usage
        if msg.get("usageMetadata"):
            usage = msg["usageMetadata"]
            print(f"  📊 Tokens: {usage}")

    async def run_turn(
        self,
        audio_file: Optional[str] = None,
        pcm_bytes: Optional[bytes] = None,
        timeout: float = 15.0,
    ) -> Dict[str, Any]:
        """
        Complete a single test turn: send audio, receive response.
        
        Args:
            audio_file: Path to base64 PCM file
            pcm_bytes: Raw PCM bytes (alternative to audio_file)
            timeout: Max wait time for response
        
        Returns:
            Dict with response data
        """
        if not self.session_active:
            raise RuntimeError("Session not active. Call connect() first.")

        # Send audio
        if audio_file:
            await self.send_audio_from_base64(audio_file)
        elif pcm_bytes:
            await self.send_audio(pcm_bytes)
        else:
            await self.send_silence(1000)

        # Small wait for processing
        await asyncio.sleep(0.5)

        # End turn (Gemini needs silence to detect turn end)
        await self.send_end_of_turn()

        # Receive response
        result = await self.receive_response(timeout=timeout)
        return result

    async def disconnect(self):
        """Close the WebSocket connection."""
        if self.ws:
            await self.ws.close()
            self.ws = None
            self.session_active = False
            print(f"  Disconnected")

    async def run_full_turn(
        self,
        audio_file: Optional[str] = None,
        pcm_bytes: Optional[bytes] = None,
        system_prompt_override: Optional[str] = None,
        timeout: float = 20.0,
    ) -> Dict[str, Any]:
        """
        Full turn: connect, send audio, receive response, disconnect.
        
        Returns dict with output_transcript, input_transcript, etc.
        """
        try:
            await self.fetch_token()
            await self.connect(system_prompt_override)
            
            # Wait for setup to complete
            await asyncio.sleep(2.0)
            
            if not self.session_active:
                # Wait for setupComplete message
                result = await self.receive_response(timeout=5.0)
                if not self.session_active:
                    print(f"  ⚠️ Session did not activate, proceeding anyway")
                    self.session_active = True

            result = await self.run_turn(
                audio_file=audio_file,
                pcm_bytes=pcm_bytes,
                timeout=timeout,
            )
            return result

        finally:
            await self.disconnect()


# ─── CLI ────────────────────────────────────────────────────────────────────


async def main():
    import argparse
    parser = argparse.ArgumentParser(description="Gemini Live API Test Client")
    parser.add_argument("--audio-file", "-a", help="Base64 PCM audio file to send")
    parser.add_argument("--output", "-o", help="Output file for transcript")
    parser.add_argument("--server", default=SERVER_URL, help="Server URL")
    parser.add_argument("--timeout", type=float, default=20.0, help="Response timeout")
    parser.add_argument("--phrase", help="Generate audio from phrase on the fly")
    parser.add_argument("--duration", type=float, default=2.0, help="Audio duration")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    client = GeminiLiveTestClient(server_url=args.server)

    # Generate audio if phrase provided
    pcm_bytes = None
    if args.phrase:
        from audio_generator import generate_audio
        print(f"  Generating audio for: '{args.phrase}'")
        pcm_bytes = generate_audio(args.phrase, duration_sec=args.duration)

    # Run test
    print(f"\n{'='*60}")
    print(f"  Gemini Live API Test")
    print(f"{'='*60}")
    print()

    result = await client.run_full_turn(
        audio_file=args.audio_file,
        pcm_bytes=pcm_bytes,
        timeout=args.timeout,
    )

    print()
    print(f"{'='*60}")
    print(f"  Result:")
    print(f"  Input transcription:  {result['input_transcript'][:100] or '(none)'}")
    print(f"  Output transcription: {result['output_transcript'][:200] or '(none)'}")
    print(f"  Turn complete:        {result['turn_complete']}")
    print(f"  Audio received:       {result['audio_bytes']} bytes in {result['audio_chunks']} chunks")
    print(f"{'='*60}")
    print()

    # Save output
    if args.output:
        with open(args.output, "w") as f:
            if args.json:
                import json as j
                j.dump(result, f, indent=2)
            else:
                f.write(result.get("output_transcript", ""))
        print(f"  Output saved to {args.output}")

    # Return exit code
    if result["output_transcript"]:
        sys.exit(0)
    else:
        print(f"  ⚠️ No output transcript received")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
