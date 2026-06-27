#!/usr/bin/env python3
"""
Viva Voice E2E Audio Test — Audio Analyzer

Analyzes captured Gemini response audio for correctness:
  - Valid PCM 16-bit format
  - Energy/amplitude profile (not silence)
  - Zero-crossing rate (speech vs noise detection)
  - Frequency content (speech band energy)
  - Dynamic range (natural vs clipped/static)

Usage:
  python3 analyze-audio.py --input captured.b64  --sample-rate 24000
  python3 analyze-audio.py --input captured.b64  --sample-rate 24000 --json  # machine-readable
"""

import base64
import math
import struct
import sys
import json
import os
import argparse
import wave
from typing import List, Tuple, Optional


# ─── PCM Decoding ───────────────────────────────────────────────────────────


def decode_pcm16(data: bytes) -> List[int]:
    """Decode raw PCM 16-bit little-endian bytes to int samples."""
    if len(data) % 2 != 0:
        raise ValueError(f"PCM data length {len(data)} is odd — not valid 16-bit PCM")
    return list(struct.unpack_from(f"<{len(data)//2}h", data))


def pcm_to_float(samples: List[int]) -> List[float]:
    """Convert int16 samples to float range [-1.0, 1.0]."""
    return [s / 32768.0 for s in samples]


def write_wav(samples: List[int], sample_rate: int, filepath: str):
    """Write PCM samples to a WAV file for manual inspection."""
    with wave.open(filepath, 'w') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)  # 16-bit
        wav.setframerate(sample_rate)
        wav.writeframes(struct.pack(f"<{len(samples)}h", *samples))


# ─── Quality Metrics ────────────────────────────────────────────────────────


def rms_energy(samples: List[float]) -> float:
    """Root-mean-square energy: measure of loudness."""
    if not samples:
        return 0.0
    sq_sum = sum(s * s for s in samples)
    return math.sqrt(sq_sum / len(samples))


def peak_amplitude(samples: List[float]) -> float:
    """Maximum absolute amplitude."""
    return max(abs(s) for s in samples) if samples else 0.0


def zero_crossing_rate(samples: List[float], frame_rate: int) -> float:
    """
    Zero-crossing rate (ZCR) — number of sign changes per second.
    - Speech:     ~100-300 Hz
    - White noise: ~5000+ Hz
    - Static/noise: very high
    """
    if len(samples) < 2:
        return 0.0
    crossings = sum(
        1 for i in range(1, len(samples))
        if (samples[i] >= 0) != (samples[i - 1] >= 0)
    )
    duration_sec = len(samples) / frame_rate
    return crossings / duration_sec if duration_sec > 0 else 0.0


def dc_offset(samples: List[float]) -> float:
    """Mean value — should be near zero for clean audio."""
    return sum(samples) / len(samples) if samples else 0.0


def spectral_centroid(samples: List[float], frame_rate: int) -> float:
    """
    Approximate spectral centroid using simple DFT on sub-bands.
    Approximates the 'center of mass' of the frequency spectrum.
    - Speech:     300-3000 Hz
    - Static:     spread across entire spectrum
    - Silence:    near 0
    """
    n = len(samples)
    if n < 4:
        return 0.0

    # Simple FFT-based centroid for the full signal
    # Use Goertzel-like approach: compute energy in speech band vs total
    # Since we don't have numpy, we'll use a simple heuristic:
    # Check correlation with sine waves at different frequencies

    # Simple approach: compute energy distribution
    # by looking at differences between adjacent samples (high-freq energy)
    diff_energy = sum((samples[i] - samples[i - 1]) ** 2 for i in range(1, n)) / (n - 1)
    total_energy = sum(s * s for s in samples) / n if n > 0 else 0

    # Ratio of high-frequency energy to total energy
    if total_energy < 1e-10:
        return 0.0

    hf_ratio = diff_energy / (total_energy * 4.0)  # normalize
    # Rough centroid estimate: 0 = DC, 1 = Nyquist
    centroid_norm = min(1.0, hf_ratio)
    return centroid_norm * (frame_rate / 2.0)


def energy_in_band(samples: List[float], frame_rate: int,
                   low_hz: float, high_hz: float) -> float:
    """
    Compute energy in a frequency band using a simple band-pass filter
    implemented as a difference-of-averages (crude but works for detection).
    """
    # Period in samples for the center frequency
    center_hz = (low_hz + high_hz) / 2.0
    period = frame_rate / center_hz if center_hz > 0 else len(samples)

    # If period is very short relative to signal, use FFT approximation
    # Simple approach: check if the signal oscillates at the target rate
    # by looking at autocorrelation at the target lag
    lag = max(1, int(period))

    if len(samples) < lag * 2:
        return 0.0

    # Autocorrelation at the target lag as a proxy for band energy
    corr = sum(samples[i] * samples[i + lag] for i in range(len(samples) - lag))
    corr /= max(1e-10, sum(s * s for s in samples))

    # Also check half-period (for harmonics)
    half_lag = max(1, lag // 2)
    if len(samples) >= half_lag * 2:
        corr2 = sum(samples[i] * samples[i + half_lag] for i in range(len(samples) - half_lag))
        corr2 /= max(1e-10, sum(s * s for s in samples))
        corr = max(corr, corr2 * 0.5)

    return max(0.0, corr)


def dynamic_range(samples: List[float], frame_rate: int) -> float:
    """
    Dynamic range in dB — difference between peak and noise floor.
    Natural speech: 20-40 dB
    Compressed/noise: < 10 dB or > 50 dB
    """
    # Split into frames
    frame_len = int(frame_rate * 0.025)  # 25ms frames
    if len(samples) < frame_len:
        return 0.0

    frame_energies = []
    for start in range(0, len(samples) - frame_len + 1, frame_len // 2):
        frame = samples[start:start + frame_len]
        energy = sum(s * s for s in frame) / frame_len
        frame_energies.append(energy)

    if not frame_energies:
        return 0.0

    frame_energies.sort()
    # Peak = top 10%, noise floor = bottom 30%
    peak = frame_energies[int(len(frame_energies) * 0.9)]
    floor = frame_energies[int(len(frame_energies) * 0.3)]

    if floor <= 0:
        return 60.0  # Very clean signal

    dr = 10.0 * math.log10(peak / floor)
    return dr


# ─── Static Detection ───────────────────────────────────────────────────────


def detect_noise_type(samples: List[float], frame_rate: int) -> Tuple[str, float]:
    """
    Classify the audio as 'speech', 'silence', 'static', or 'unknown'.
    Returns (classification, confidence 0-1).
    """
    if not samples:
        return 'silence', 1.0

    rms = rms_energy(samples)
    zcr = zero_crossing_rate(samples, frame_rate)
    dc = abs(dc_offset(samples))
    peak = peak_amplitude(samples)
    dr = dynamic_range(samples, frame_rate)

    scores = {}

    # Silence: very low energy
    if rms < 0.001:
        return 'silence', min(1.0, (1.0 - rms * 1000))

    # Static: very high ZCR + low dynamic range
    static_score = 0.0
    if zcr > 3000:
        static_score += 0.4
    if dr < 8:
        static_score += 0.3
    if dc > 0.05:
        static_score += 0.2
    if rms > 0.1 and zcr > 4000:
        static_score += 0.3
    static_score = min(1.0, static_score)
    scores['static'] = static_score

    # Speech: moderate ZCR + good dynamic range + moderate energy
    speech_score = 0.0
    if 50 < zcr < 800:
        speech_score += 0.3
    if 10 < dr < 50:
        speech_score += 0.25
    if 0.01 < rms < 0.3:
        speech_score += 0.15
    if dc < 0.02:
        speech_score += 0.1

    # Check for speech-band energy
    speech_band_energy = energy_in_band(samples, frame_rate, 300, 3400)
    if speech_band_energy > 0.2:
        speech_score += 0.2

    speech_score = min(1.0, speech_score)
    scores['speech'] = speech_score

    # Audio tone (single frequency, not speech)
    tone_score = 0.0
    if zcr < 50 and rms > 0.01:
        tone_score += 0.5
    if dr > 40:
        tone_score += 0.3
    tone_score = min(1.0, tone_score)
    scores['tone'] = tone_score

    best = ''
    best_score = -1.0
    for k, v in scores.items():
        if v > best_score:
            best_score = v
            best = k
    return best, best_score


# ─── Report ─────────────────────────────────────────────────────────────────


class AudioTestReport:
    """Test report with pass/fail criteria."""

    def __init__(self, sample_rate: int):
        self.sample_rate = sample_rate
        self.metrics = {}
        self.classification = 'unknown'
        self.confidence = 0.0
        self.passed = False
        self.errors = []
        self.duration_sec = 0.0
        self.total_samples = 0

    def analyze(self, samples: List[int]):
        """Run all analyses on PCM samples."""
        self.total_samples = len(samples)
        self.duration_sec = len(samples) / self.sample_rate

        if not samples:
            self.errors.append("No audio data captured")
            return

        floats = pcm_to_float(samples)

        # Basic validation
        if min(samples) < -32768 or max(samples) > 32767:
            self.errors.append(f"Samples out of 16-bit range: [{min(samples)}, {max(samples)}]")

        # Metrics
        self.metrics['total_samples'] = len(samples)
        self.metrics['duration_sec'] = round(self.duration_sec, 3)
        self.metrics['rms_energy'] = round(rms_energy(floats), 6)
        self.metrics['peak_amplitude'] = round(peak_amplitude(floats), 6)
        self.metrics['zero_crossing_rate_hz'] = round(zero_crossing_rate(floats, self.sample_rate), 1)
        self.metrics['dc_offset'] = round(dc_offset(floats), 6)
        self.metrics['dynamic_range_db'] = round(dynamic_range(floats, self.sample_rate), 1)
        self.metrics['spectral_centroid_hz'] = round(spectral_centroid(floats, self.sample_rate), 1)
        self.metrics['speech_band_energy'] = round(energy_in_band(floats, self.sample_rate, 300, 3400), 4)

        self.classification, self.confidence = detect_noise_type(floats, self.sample_rate)
        self.metrics['classification'] = self.classification
        self.metrics['classification_confidence'] = round(self.confidence, 3)
        self.metrics['min_sample'] = int(min(samples))
        self.metrics['max_sample'] = int(max(samples))
        self.metrics['mean_sample'] = round(sum(samples) / len(samples), 1)

        # Pass/fail logic
        self._evaluate()

    def _evaluate(self):
        """Determine pass/fail based on metrics."""
        failures = []

        # 1. Must have audio data
        if self.total_samples == 0:
            failures.append("No audio data")
        elif self.duration_sec < 0.5:
            failures.append(f"Audio too short: {self.duration_sec:.2f}s (min 0.5s)")

        # 2. Must not be silence
        if self.metrics.get('rms_energy', 0) < 0.001:
            failures.append("Audio is silence (RMS too low)")

        # 3. Must not be static/noise
        if self.classification == 'static' and self.confidence > 0.5:
            failures.append(f"Audio classified as static/noise (confidence={self.confidence})")

        # 4. Should be speech or have clear signal
        if self.classification == 'unknown' and self.confidence < 0.3:
            failures.append("Audio signal type unclear")

        # 5. ZCR shouldn't be extremely high (noise)
        if self.metrics.get('zero_crossing_rate_hz', 0) > 10000:
            failures.append("Extremely high zero-crossing rate — likely noise")

        # 6. DC offset should be reasonable
        if abs(self.metrics.get('dc_offset', 0)) > 0.1:
            failures.append("High DC offset — possible corruption")

        if failures:
            self.passed = False
            self.errors.extend(failures)
        else:
            self.passed = True

    def to_dict(self) -> dict:
        return {
            'passed': self.passed,
            'sample_rate': self.sample_rate,
            'duration_sec': self.duration_sec,
            'total_samples': self.total_samples,
            'classification': self.classification,
            'confidence': self.confidence,
            'metrics': self.metrics,
            'errors': self.errors,
        }

    def print_summary(self):
        """Human-readable report."""
        status = "✅ PASS" if self.passed else "❌ FAIL"
        print(f"\n{'='*60}")
        print(f"  Audio Analysis Report — {status}")
        print(f"{'='*60}")
        print(f"  Duration:       {self.duration_sec:.2f}s")
        print(f"  Sample Rate:    {self.sample_rate} Hz")
        print(f"  Samples:        {self.total_samples}")
        print(f"  Classification: {self.classification} (confidence: {self.confidence:.2f})")
        print(f"{'─'*60}")
        print(f"  Metrics:")
        print(f"    RMS Energy:          {self.metrics.get('rms_energy', 'N/A')}")
        print(f"    Peak Amplitude:      {self.metrics.get('peak_amplitude', 'N/A')}")
        print(f"    Zero-Crossing Rate:  {self.metrics.get('zero_crossing_rate_hz', 'N/A')} Hz")
        print(f"    DC Offset:           {self.metrics.get('dc_offset', 'N/A')}")
        print(f"    Dynamic Range:       {self.metrics.get('dynamic_range_db', 'N/A')} dB")
        print(f"    Spectral Centroid:   {self.metrics.get('spectral_centroid_hz', 'N/A')} Hz")
        print(f"    Speech Band Energy:  {self.metrics.get('speech_band_energy', 'N/A')}")
        print(f"    Sample Range:        [{self.metrics.get('min_sample', 'N/A')}, {self.metrics.get('max_sample', 'N/A')}]")
        print(f"{'─'*60}")
        if self.errors:
            print(f"  Errors:")
            for e in self.errors:
                print(f"    • {e}")
            print(f"{'─'*60}")
        print(f"{'='*60}\n")


# ─── CLI ────────────────────────────────────────────────────────────────────


def load_base64_pcm(filepath: str) -> bytes:
    """Load base64-encoded PCM from file, return decoded bytes."""
    with open(filepath) as f:
        content = f.read().strip()
    return base64.b64decode(content)


def main():
    parser = argparse.ArgumentParser(description='Analyze captured Gemini audio')
    parser.add_argument('--input', '-i', required=True,
                        help='Input file: base64 PCM data')
    parser.add_argument('--sample-rate', '-r', type=int, default=24000,
                        help='PCM sample rate in Hz (default: 24000)')
    parser.add_argument('--json', action='store_true',
                        help='Output as JSON')
    parser.add_argument('--wav', '-w',
                        help='Write WAV file to this path for manual inspection')
    args = parser.parse_args()

    try:
        raw_data = load_base64_pcm(args.input)
    except FileNotFoundError:
        print(f"❌ File not found: {args.input}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Failed to load audio: {e}")
        sys.exit(1)

    try:
        samples = decode_pcm16(raw_data)
    except ValueError as e:
        print(f"❌ Invalid PCM data: {e}")
        sys.exit(1)

    report = AudioTestReport(args.sample_rate)
    report.analyze(samples)

    # Optionally write WAV
    if args.wav:
        write_wav(samples, args.sample_rate, args.wav)
        print(f"  WAV written to: {args.wav}")

    if args.json:
        print(json.dumps(report.to_dict(), indent=2))
    else:
        report.print_summary()

    sys.exit(0 if report.passed else 1)


if __name__ == '__main__':
    main()
