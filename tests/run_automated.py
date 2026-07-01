#!/usr/bin/env python3
"""
Viva Voice — Automated Full-Pipeline Validation Runner

Orchestrates end-to-end validation of Gemini Live responses against
system-prompt.md compliance rules. Fully automated: generates audio
from scenario guest scripts, sends via WebSocket to Gemini, captures
response transcripts, runs compliance rules, and produces a report.

Usage:
    # Run all scenarios (starts fresh session each scenario)
    python3 tests/run_automated.py

    # Run with specific iteration number for report naming
    python3 tests/run_automated.py --iteration 2

    # Skip scenarios that did NOT pass all rules (for regression focus)
    python3 tests/run_automated.py --failures-only

    # Resume from a specific scenario
    python3 tests/run_automated.py --resume unsupported-demand
"""

import asyncio
import base64
import json
import os
import struct
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

import aiohttp
import websockets

# Local imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.dirname(__file__))

try:
    from audio_generator import generate_audio
except ImportError:
    generate_audio = None

# Try to import TTS for real speech synthesis
try:
    import edge_tts
    HAS_TTS = True
except ImportError:
    HAS_TTS = False
    
from compliance_rules import check_scenario_turn, generate_trend_analysis, format_human_readable
from compliance_report import generate_report


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SCENARIOS_FILE = os.path.join(SCRIPT_DIR, "scenarios", "scenarios.json")
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "output")
SERVER_URL = "http://127.0.0.1:8000"
SAMPLE_RATE = 16000


def load_scenarios():
    """Load all scenarios from scenarios.json."""
    with open(SCENARIOS_FILE) as f:
        return json.load(f)["scenarios"]


def load_scenario(scenario_id: str) -> Optional[Dict]:
    """Load a single scenario by ID."""
    for s in load_scenarios():
        if s["id"] == scenario_id:
            return s
    return None


def pcm_to_base64(pcm_bytes: bytes) -> str:
    """Encode raw PCM 16-bit 16kHz to base64 string."""
    return base64.b64encode(pcm_bytes).decode("ascii")


async def fetch_token(server_url: str) -> Dict[str, Any]:
    """Get ephemeral token + system prompt from our server."""
    async with aiohttp.ClientSession() as session:
        async with session.post(f"{server_url}/api/token", json={}) as resp:
            if resp.status != 200:
                text = await resp.text()
                raise RuntimeError(f"Token API returned {resp.status}: {text}")
            return await resp.json()


async def connect_gemini(
    token: str,
    model: str = "gemini-3.1-flash-live-preview",
    system_prompt: str = "",
):
    """Connect to Gemini Live API WebSocket."""
    ws_url = (
        "wss://generativelanguage.googleapis.com/ws/"
        "google.ai.generativelanguage.v1alpha.GenerativeService."
        f"BidiGenerateContentConstrained?access_token={token}"
    )

    ws = await asyncio.wait_for(
        websockets.connect(ws_url, ping_interval=None, close_timeout=5),
        timeout=15,
    )

    # Send setup message (minimal — speechConfig can cause setup hang)
    setup = {
        "setup": {
            "model": f"models/{model}",
            "generationConfig": {
                "responseModalities": ["AUDIO"],
            },
            "systemInstruction": {
                "parts": [{"text": system_prompt}],
            },
            "inputAudioTranscription": {},
            "outputAudioTranscription": {},
        },
    }

    await ws.send(json.dumps(setup))
    print(f"    Setup sent ({len(json.dumps(setup))} chars)")

    # Wait for setupComplete (with timeout)
    start = time.time()
    while time.time() - start < 15:
        try:
            msg = await asyncio.wait_for(ws.recv(), timeout=10.0)
        except asyncio.TimeoutError:
            continue

        # Handle both bytes and str messages
        if isinstance(msg, str):
            try:
                parsed = json.loads(msg)
            except json.JSONDecodeError:
                continue
            if "setupComplete" in parsed:
                print("    ✅ Setup complete — session active")
                return ws
            if parsed.get("error"):
                raise RuntimeError(f"Setup error: {parsed['error']}")
            continue

        if isinstance(msg, bytes) and len(msg) > 0 and msg[0] == 0x7B:
            try:
                parsed = json.loads(msg.decode("utf-8"))
            except (json.JSONDecodeError, UnicodeDecodeError):
                continue

            if "setupComplete" in parsed:
                print("    ✅ Setup complete — session active")
                return ws

            if parsed.get("error"):
                raise RuntimeError(f"Setup error: {parsed['error']}")

    raise RuntimeError("Timed out waiting for setupComplete")


async def generate_speech_audio(text: str) -> bytes:
    """
    Generate realistic speech PCM audio from text using edge-tts.
    Falls back to formant synthesis if TTS is unavailable.
    
    Returns raw PCM 16-bit 16kHz mono bytes.
    """
    if HAS_TTS:
        try:
            voice = "en-US-AriaNeural"
            # Detect language for voice selection
            # For Hindi, Telugu use language-appropriate voice
            has_hindi = any('\u0900' <= c <= '\u097F' for c in text)
            has_telugu = any('\u0C00' <= c <= '\u0C7F' for c in text)
            if has_hindi:
                voice = "hi-IN-SwaraNeural"
            elif has_telugu:
                voice = "te-IN-ShrutiNeural"
            
            communicate = edge_tts.Communicate(text, voice=voice)
            
            # Use subprocess + ffmpeg to convert MP3 → PCM 16kHz s16le
            import subprocess
            import tempfile
            
            mp3_path = tempfile.mktemp(suffix='.mp3')
            pcm_path = tempfile.mktemp(suffix='.pcm')
            
            try:
                await communicate.save(mp3_path)
                
                subprocess.run([
                    'ffmpeg', '-y', '-i', mp3_path,
                    '-f', 's16le', '-acodec', 'pcm_s16le',
                    '-ar', str(SAMPLE_RATE), '-ac', '1',
                    pcm_path,
                ], capture_output=True, timeout=30)
                
                with open(pcm_path, 'rb') as f:
                    pcm = f.read()
                
                if len(pcm) > 100:
                    return pcm
            finally:
                for p in [mp3_path, pcm_path]:
                    try:
                        os.remove(p)
                    except OSError:
                        pass
        except Exception as e:
            print(f"      ⚠️ TTS failed ({e}), falling back to formant synthesis")
    
    # Fallback: formant synthesis
    if generate_audio:
        duration = max(1.0, min(4.0, len(text) * 0.08))
        return generate_audio(text, duration_sec=duration)
    
    # Last resort: silence
    return struct.pack(f"<{SAMPLE_RATE}h", *[0] * SAMPLE_RATE)


async def send_audio_turn(
    ws,
    guest_text: str,
    timeout: float = 30.0,
) -> str:
    """
    Send audio generated from guest text, then receive and return the 
    Gemini response transcript.
    
    Returns:
        The output transcription text from Gemini (or empty string if none).
    """
    # Generate real speech audio using TTS
    pcm = await generate_speech_audio(guest_text)

    # Send as JSON-wrapped base64 (same as browser)
    b64_audio = pcm_to_base64(pcm)
    audio_msg = {
        "realtimeInput": {
            "audio": {
                "data": b64_audio,
                "mimeType": "audio/pcm;rate=16000",
            },
        },
    }
    await ws.send(json.dumps(audio_msg).encode("utf-8"))
    print(f"    Audio sent: {len(pcm)} bytes ({len(guest_text)} chars text)")

    # Wait for Gemini to process the speech
    await asyncio.sleep(1.5)

    # Send stream end to signal turn complete
    end_msg = json.dumps({"realtimeInput": {"audioStreamEnd": True}})
    await ws.send(end_msg.encode("utf-8"))
    await asyncio.sleep(0.5)

    # Receive response — collect transcript
    output_transcript = ""
    input_transcript = ""
    turn_complete = False
    audio_chunks = 0
    start_time = time.time()

    while time.time() - start_time < timeout:
        try:
            msg = await asyncio.wait_for(ws.recv(), timeout=min(timeout, 3.0))
        except asyncio.TimeoutError:
            if turn_complete and output_transcript:
                break
            continue

        if isinstance(msg, bytes):
            if len(msg) == 0:
                continue

            if msg[0] == 0x7B:
                # JSON message
                try:
                    parsed = json.loads(msg.decode("utf-8"))
                except (json.JSONDecodeError, UnicodeDecodeError):
                    continue

                sc = parsed.get("serverContent", {})

                # Input transcription (what Gemini heard)
                if sc.get("inputTranscription", {}).get("text"):
                    text = sc["inputTranscription"]["text"]
                    input_transcript += text
                    if len(text) > 3 and text != guest_text[:len(text)]:
                        print(f"      🎤 Heard: {text[:80]}")

                # Output transcription (what Gemini says)
                if sc.get("outputTranscription", {}).get("text"):
                    text = sc["outputTranscription"]["text"]
                    output_transcript += (" " + text).strip()
                    print(f"      🤖 Said: {text[:100]}")

                # Turn complete
                if sc.get("turnComplete"):
                    turn_complete = True
                    print(f"      ✅ Turn complete")

                # Error
                if parsed.get("error"):
                    err_msg = parsed["error"].get("message", str(parsed["error"]))
                    print(f"      ❌ API Error: {err_msg}")
            else:
                # Raw PCM audio from Gemini
                audio_chunks += 1

    if not turn_complete and output_transcript:
        print(f"      ⚠️ Turn not marked complete but has transcript")

    print(f"      📊 Input heard: {input_transcript[:80] or '(none)'}")
    print(f"      📊 Output: {output_transcript[:80] or '(none)'} ({audio_chunks} audio chunks)")

    return output_transcript.strip()


async def run_scenario(
    ws,
    scenario: Dict,
    results: Dict[str, Any],
):
    """Run all turns of a single scenario through one WebSocket connection."""
    sid = scenario["id"]
    sname = scenario["name"]
    turns = scenario["turns"]
    
    print(f"\n  ── Scenario: {sname} ({sid}) — {len(turns)} turns ──")

    turn_results = []

    for i, turn in enumerate(turns):
        tid = turn["id"]
        guest_says = turn["guest_says"]
        rules = turn.get("rules", [])

        print(f"\n  Turn {i+1}/{len(turns)} ({tid}):")
        print(f"    Guest: {guest_says[:100]}")

        # Send audio, get response
        response = await send_audio_turn(ws, guest_says)

        if not response:
            print(f"    ⚠️ No response from Gemini — marking as empty")
            response = ""

        # Run compliance checks
        result = check_scenario_turn(response, turn, i)
        turn_results.append(result)

        # Show pass/fail summary
        for r in result["rules"]:
            icon = "✅" if r.get("passed") is True else ("❌" if r.get("passed") is False else "❓")
            print(f"    {icon} {r['rule']}: {r['evidence'][:60]}")

    # Trend analysis
    if turn_results:
        trend = generate_trend_analysis(turn_results)
        print(f"\n  ── Trend: {trend.get('overall_verdict', '?')} ──")
        for note in trend.get("trend_notes", []):
            print(f"    {note}")

        results[sid] = {
            "scenario_id": sid,
            "scenario_name": sname,
            "turns": turn_results,
            "trend": trend,
        }

    return turn_results


async def run_validation(
    iteration: int = 1,
    failures_only: bool = False,
    resume_from: Optional[str] = None,
):
    """Run the full automated validation pipeline."""
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    session_dir = os.path.join(OUTPUT_DIR, f"session_{session_id}")
    os.makedirs(session_dir, exist_ok=True)
    report_file = os.path.join(session_dir, f"report_v{iteration}.md")

    print(f"\n{'='*70}")
    print(f"  Viva Voice — Automated Validation Run (Iteration {iteration})")
    print(f"  Session: {session_id}")
    print(f"  Report:  {report_file}")
    print(f"{'='*70}")

    # Load scenarios
    all_scenarios = load_scenarios()
    scenarios_to_run = all_scenarios

    if resume_from:
        found = False
        for i, s in enumerate(scenarios_to_run):
            if s["id"] == resume_from:
                scenarios_to_run = scenarios_to_run[i:]
                found = True
                break
        if not found:
            print(f"  ❌ Scenario '{resume_from}' not found")
            return

    print(f"\n  Scenarios: {len(scenarios_to_run)} ({sum(len(s['turns']) for s in scenarios_to_run)} turns)")

    all_results: Dict[str, Any] = {}
    session_token = None
    session_model = None
    session_prompt = None
    ws = None

    try:
        for scenario_idx, scenario in enumerate(scenarios_to_run):
            sid = scenario["id"]
            sname = scenario["name"]

            # Each scenario gets a fresh connection (ensures clean state)
            if ws:
                try:
                    await ws.close(1000, "Scenario complete")
                except Exception:
                    pass
                ws = None
                # Delay between connections to avoid policy violations
                await asyncio.sleep(3.0)

            print(f"\n{'─'*60}")
            print(f"  [{scenario_idx+1}/{len(scenarios_to_run)}] {sname}")

            # Get fresh token
            token_data = await fetch_token(SERVER_URL)
            session_token = token_data.get("token", "")
            session_model = token_data.get("model", "gemini-3.1-flash-live-preview")
            session_prompt = token_data.get("systemPrompt", "")

            if not session_token:
                print(f"  ❌ No token from server")
                continue

            # Connect directly (inline — module-function issue with ws.recv)
            try:
                ws_url = (
                    "wss://generativelanguage.googleapis.com/ws/"
                    "google.ai.generativelanguage.v1alpha.GenerativeService."
                    f"BidiGenerateContentConstrained?access_token={session_token}"
                )
                ws = await asyncio.wait_for(
                    websockets.connect(ws_url, ping_interval=None, close_timeout=5),
                    timeout=15,
                )

                setup_msg = json.dumps({
                    "setup": {
                        "model": f"models/{session_model}",
                        "generationConfig": {"responseModalities": ["AUDIO"]},
                        "systemInstruction": {"parts": [{"text": session_prompt}]},
                        "inputAudioTranscription": {},
                        "outputAudioTranscription": {},
                    }
                })
                await ws.send(setup_msg)
                print(f"    Setup sent ({len(setup_msg)} chars)")

                # Wait for setupComplete
                setup_start = time.time()
                while time.time() - setup_start < 15:
                    try:
                        msg = await asyncio.wait_for(ws.recv(), timeout=10.0)
                    except asyncio.TimeoutError:
                        continue

                    if isinstance(msg, str) and msg.strip().startswith("{"):
                        try:
                            parsed = json.loads(msg)
                        except json.JSONDecodeError:
                            continue
                        if "setupComplete" in parsed:
                            print("    ✅ Setup complete — session active")
                            break
                        if parsed.get("error"):
                            raise RuntimeError(f"Setup error: {parsed['error']}")
                        continue

                    if isinstance(msg, bytes) and len(msg) > 0 and msg[0] == 0x7B:
                        try:
                            parsed = json.loads(msg.decode("utf-8"))
                        except (json.JSONDecodeError, UnicodeDecodeError):
                            continue

                        if "setupComplete" in parsed:
                            print("    ✅ Setup complete — session active")
                            break

                        if parsed.get("error"):
                            raise RuntimeError(f"Setup error: {parsed['error']}")
                        continue
                else:
                    raise RuntimeError("Timed out waiting for setupComplete")

                await asyncio.sleep(1.0)
                await run_scenario(ws, scenario, all_results)

            except (websockets.exceptions.WebSocketException, asyncio.TimeoutError) as e:
                print(f"  ❌ Connection error: {e}")
                if ws:
                    try:
                        await ws.close()
                    except Exception:
                        pass
                    ws = None
                continue

            # Brief cooldown between scenarios
            await asyncio.sleep(0.5)

    except KeyboardInterrupt:
        print(f"\n\n  ⚠️ Interrupted by user")
    except Exception:
        import traceback
        traceback.print_exc()
    finally:
        if ws:
            try:
                await ws.close(1000, "Run complete")
            except Exception:
                pass

    # Generate report
    if all_results:
        print(f"\n\n{'='*70}")
        print(f"  Generating Report...")
        print(f"{'='*70}")

        report = generate_report(all_results, SCENARIOS_FILE, iteration=iteration)
        with open(report_file, "w") as f:
            f.write(report)
        print(f"  ✅ Report: {report_file}")

        # Summary
        total_fails = sum(
            sum(t["failures"] for t in sdata["turns"])
            for sdata in all_results.values()
        )
        total_turns = sum(len(sdata["turns"]) for sdata in all_results.values())
        print(f"\n  📊 {len(all_results)} scenarios, {total_turns} turns, {total_fails} failures")
    else:
        print(f"\n  ❌ No results collected")

    print()


async def main():
    import argparse
    parser = argparse.ArgumentParser(description="Viva Voice — Automated Validation Runner")
    parser.add_argument("--iteration", "-i", type=int, default=1, help="Iteration number")
    parser.add_argument("--failures-only", action="store_true", help="Only show scenarios with failures")
    parser.add_argument("--resume", help="Resume from a specific scenario ID")
    args = parser.parse_args()

    try:
        await run_validation(
            iteration=args.iteration,
            failures_only=args.failures_only,
            resume_from=args.resume,
        )
    except Exception as e:
        import traceback
        print(f"\n  ❌ Fatal error: {e}")
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    # Reset event loop policy (workaround for websockets 16.0 TLS issue)
    asyncio.set_event_loop_policy(asyncio.DefaultEventLoopPolicy())
    asyncio.run(main())
