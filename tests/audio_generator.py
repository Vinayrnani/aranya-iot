#!/usr/bin/env python3
"""
Viva Voice — Audio Fixture Generator

Generates speech-like PCM audio for testing the Gemini Live API.
Uses formant synthesis to create vowel-like sounds that mimic
simple speech patterns (not intelligible words, but speech-like enough
for the API to process).

Output: base64-encoded PCM 16-bit 16kHz mono (same format as mic input).
"""

import math
import struct
import base64
import argparse
import os
from typing import List


# Formant frequencies for basic vowels (F1, F2, F3 in Hz)
# These create distinguishable vowel-like sounds
VOWELS = {
    "aa": (700, 1200, 2800),   # "father"
    "ee": (350, 2000, 2800),   # "see"
    "ii": (300, 2200, 3000),   # "sit"
    "oo": (450, 1000, 2600),   # "food"
    "uh": (600, 1200, 2700),   # "but"
    "ae": (650, 1800, 2700),   # "cat"
    "er": (500, 1400, 2600),   # "bird"
}


def generate_audio(
    phrase: str = "hello",
    sample_rate: int = 16000,
    duration_sec: float = 1.5,
    amplitude: float = 0.25,
    noise_floor: float = 0.002,
) -> bytes:
    """
    Generate speech-like PCM audio using formant synthesis.
    
    Maps each character in phrase to a vowel-like sound,
    creating a simple speech-like signal.

    Returns raw PCM 16-bit bytes.
    """
    num_samples = int(sample_rate * duration_sec)
    samples: List[float] = []

    # Create a simple envelope
    attack = int(0.05 * sample_rate)
    decay = int(0.1 * sample_rate)
    release = int(0.15 * sample_rate)

    for i in range(num_samples):
        t = i / sample_rate

        # Determine which vowel to use based on character position
        char_idx = int(i / sample_rate * len(phrase) / duration_sec) % len(phrase)
        char = phrase[char_idx].lower()
        vowel_key = "uh"  # default
        if char in "aeiou":
            for k in ["aa", "ee", "ii", "oo", "uh", "ae"]:
                if char in k:
                    vowel_key = k
                    break

        f1, f2, f3 = VOWELS.get(vowel_key, VOWELS["uh"])

        # Generate formants
        signal = 0.0
        for freq, weight in [(f1, 1.0), (f2, 0.6), (f3, 0.3)]:
            # Add some frequency modulation to make it more natural
            vibrato = 1.0 + 0.02 * math.sin(2 * math.pi * 5 * t)
            signal += weight * math.sin(2 * math.pi * freq * vibrato * t)

        # Add pitch
        pitch_freq = 120 + 20 * math.sin(2 * math.pi * 3 * t)  # ~120 Hz with variation
        pitch = math.sin(2 * math.pi * pitch_freq * t) * 0.5 + 0.5
        signal *= pitch

        # Amplitude envelope
        env = 1.0
        if i < attack:
            env = i / attack
        elif i > num_samples - release:
            env = (num_samples - i) / release

        # Natural decay
        env *= max(0.0, 1.0 - (t / duration_sec) * 0.3)

        # Add noise floor
        noise = noise_floor * (2 * math.random() - 1) if hasattr(__builtins__, '_') else 0.0
        # Use deterministic noise instead
        noise = noise_floor * math.sin(1000 * t) * 0.1

        val = signal * amplitude * env
        samples.append(val)

    # Normalize
    max_val = max(abs(s) for s in samples) if samples else 1.0
    if max_val > 0:
        samples = [s / max_val * amplitude for s in samples]

    # Convert to PCM 16-bit
    pcm = struct.pack(f"<{len(samples)}h", *[int(s * 32767) for s in samples])
    return pcm


def generate_phrase_audio(
    phrases: List[str],
    sample_rate: int = 16000,
    gap_sec: float = 0.3,
) -> bytes:
    """Generate multiple phrases with gaps between them."""
    all_pcm = b""
    gap_samples = int(sample_rate * gap_sec)
    gap = struct.pack(f"<{gap_samples}h", *[0] * gap_samples)

    for phrase in phrases:
        pcm = generate_audio(phrase, sample_rate)
        all_pcm += pcm + gap

    return all_pcm


def pcm_to_base64(pcm_bytes: bytes) -> str:
    """Encode PCM bytes to base64 string."""
    return base64.b64encode(pcm_bytes).decode("ascii")


def save_fixture(pcm_bytes: bytes, filepath: str):
    """Save PCM data to a base64 file for use with the test framework."""
    b64 = pcm_to_base64(pcm_bytes)
    with open(filepath, "w") as f:
        f.write(b64)
    print(f"  Saved {len(pcm_bytes)} PCM bytes → {filepath}")


def generate_scenario_audio(phrase_map: dict, output_dir: str):
    """
    Generate audio fixtures for all scenario turns.
    
    phrase_map: {scenario_id: {turn_id: "phrase text"}}
    """
    os.makedirs(output_dir, exist_ok=True)
    for scenario_id, turns in phrase_map.items():
        for turn_id, phrase in turns.items():
            pcm = generate_audio(phrase)
            filepath = os.path.join(output_dir, f"{scenario_id}_{turn_id}.b64")
            save_fixture(pcm, filepath)


# ─── CLI ────────────────────────────────────────────────────────────────────


def main():
    parser = argparse.ArgumentParser(description="Generate speech-like audio fixtures")
    parser.add_argument("--phrase", default="hello there", help="Phrase to synthesize")
    parser.add_argument("--duration", type=float, default=1.5, help="Duration in seconds")
    parser.add_argument("--output", "-o", default=None, help="Output base64 file")
    parser.add_argument("--wav", default=None, help="Output WAV file (for inspection)")
    parser.add_argument("--ls", action="store_true", help="List available vowels")
    args = parser.parse_args()

    if args.ls:
        print("Available vowel presets:")
        for k, (f1, f2, f3) in sorted(VOWELS.items()):
            print(f"  {k}: F1={f1} F2={f2} F3={f3}")
        return

    pcm = generate_audio(args.phrase, duration_sec=args.duration)

    if args.output:
        save_fixture(pcm, args.output)

    if args.wav:
        import wave
        with wave.open(args.wav, "w") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(16000)
            wav.writeframes(pcm)
        print(f"  WAV: {args.wav}")

    if not args.output and not args.wav:
        print(pcm_to_base64(pcm)[:80] + "...")


if __name__ == "__main__":
    main()
