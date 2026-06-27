/**
 * PCM Resample AudioWorkletProcessor
 *
 * Lives on the audio rendering thread — NOT the main thread.
 * Receives Float32 PCM at device sample rate (48kHz), resamples to 16kHz,
 * converts to 16-bit Int16, and sends chunks back to the main thread
 * via transferable ArrayBuffers (zero-copy).
 *
 * No DOM, no btoa/atob, no base64 — that's handled on the main thread.
 */

class PCMResampleProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const procOpts = options.processorOptions || {};
    this._inputSampleRate = procOpts.sampleRate || 48000;
    this._targetSampleRate = 16000;
    this._chunkSamples = 1600; // 100ms at 16kHz
    this._buffer = [];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) {
      return true; // keep processor alive
    }

    const inputData = input[0]; // Float32Array at device rate

    // Linear resample from device rate → 16kHz
    if (this._inputSampleRate !== this._targetSampleRate) {
      const ratio = this._inputSampleRate / this._targetSampleRate;
      const outLen = Math.floor(inputData.length / ratio);
      for (let i = 0; i < outLen; i++) {
        const pos = i * ratio;
        const idx = Math.floor(pos);
        const frac = pos - idx;
        if (idx + 1 < inputData.length) {
          this._buffer.push(
            inputData[idx] * (1 - frac) + inputData[idx + 1] * frac
          );
        } else {
          this._buffer.push(inputData[idx] || 0);
        }
      }
    } else {
      // Same rate: copy directly
      for (let i = 0; i < inputData.length; i++) {
        this._buffer.push(inputData[i]);
      }
    }

    // Flush full chunks to the main thread
    while (this._buffer.length >= this._chunkSamples) {
      const chunk = this._buffer.splice(0, this._chunkSamples);

      // Float32 → Int16 PCM
      const int16 = new Int16Array(chunk.length);
      for (let i = 0; i < chunk.length; i++) {
        const s = Math.max(-1, Math.min(1, chunk[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }

      // Transfer the ArrayBuffer (zero-copy on postMessage)
      this.port.postMessage(
        { type: 'pcm-chunk', data: int16.buffer },
        [int16.buffer]
      );
    }

    return true; // keep alive
  }
}

registerProcessor('pcm-resample-processor', PCMResampleProcessor);
