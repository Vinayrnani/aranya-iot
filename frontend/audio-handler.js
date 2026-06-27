/**
 * Audio Handler for Gemini Live API
 *
 * Provides:
 * - AudioCapture: Capture mic audio, resample to 16kHz PCM, provide chunks
 * - AudioPlayer: Play back 24kHz PCM audio from base64 data
 */

class AudioCapture {
  constructor() {
    this.stream = null;
    this.audioContext = null;
    this.source = null;
    this.processor = null;
    this.isCapturing = false;
    this.onChunk = null; // callback(base64PCMChunk)
    this.onError = null;

    // Resampling state
    this._inputSampleRate = 48000; // Default, will be set from context
    this._targetSampleRate = 16000;
    this._resampleBuffer = [];
  }

  /**
   * Start capturing microphone audio.
   * @param {object} options
   * @param {number} options.chunkDurationMs - Duration of each chunk (default 100ms @ 16kHz = 1600 samples)
   * @param {string} options.deviceId - Specific mic device ID (optional)
   */
  async start({ chunkDurationMs = 100, deviceId = null } = {}) {
    if (this.isCapturing) {
      console.warn('Already capturing');
      return;
    }

    try {
      // Get microphone access
      const constraints = {
        audio: deviceId
          ? { deviceId: { exact: deviceId }, sampleRate: 48000, echoCancellation: true, noiseSuppression: true }
          : { sampleRate: 48000, echoCancellation: true, noiseSuppression: true },
      };
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Create audio context at device rate
      this.audioContext = new AudioContext();
      this._inputSampleRate = this.audioContext.sampleRate;

      this.source = this.audioContext.createMediaStreamSource(this.stream);

      // Use ScriptProcessorNode for PCM access
      const bufferSize = 4096; // ~85ms at 48kHz
      this.processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

      this._chunkSamples = Math.floor(this._targetSampleRate * (chunkDurationMs / 1000));

      this.processor.onaudioprocess = (event) => {
        if (!this.isCapturing) return;

        const inputData = event.inputBuffer.getChannelData(0); // Float32 at device rate
        const resampled = this._resample(inputData, this._inputSampleRate, this._targetSampleRate);

        // Accumulate resampled chunks
        this._resampleBuffer.push(...resampled);

        // Flush when we have enough samples
        const samplesNeeded = this._chunkSamples;
        while (this._resampleBuffer.length >= samplesNeeded) {
          const chunk = this._resampleBuffer.splice(0, samplesNeeded);
          const base64 = this._float32ToBase64PCM(chunk);
          if (this.onChunk) {
            this.onChunk(base64);
          }
        }
      };

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      this.isCapturing = true;

    } catch (err) {
      console.error('Failed to start audio capture:', err);
      if (this.onError) this.onError(err);
      throw err;
    }
  }

  /**
   * Stop capturing microphone audio.
   */
  stop() {
    this.isCapturing = false;

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }

    this._resampleBuffer = [];
  }

  /**
   * Simple linear resampling to target sample rate.
   */
  _resample(inputData, fromRate, toRate) {
    if (fromRate === toRate) return Array.from(inputData);

    const ratio = fromRate / toRate;
    const outputLength = Math.floor(inputData.length / ratio);
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const pos = i * ratio;
      const idx = Math.floor(pos);
      const frac = pos - idx;
      if (idx + 1 < inputData.length) {
        output[i] = inputData[idx] * (1 - frac) + inputData[idx + 1] * frac;
      } else {
        output[i] = inputData[idx] || 0;
      }
    }
    return Array.from(output);
  }

  /**
   * Convert Float32 audio array (-1 to 1) to base64-encoded 16-bit PCM.
   */
  _float32ToBase64PCM(samples) {
    const int16Array = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      // Clamp to [-1, 1] and convert to 16-bit integer
      const s = Math.max(-1, Math.min(1, samples[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    // Convert to base64
    const bytes = new Uint8Array(int16Array.buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Get available audio input devices.
   */
  static async getAudioDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((d) => d.kind === 'audioinput');
    } catch {
      return [];
    }
  }
}


class AudioPlayer {
  constructor() {
    this.audioContext = null;
    this.isPlaying = false;
    this._queue = [];
    this._isProcessing = false;
    this._sampleRate = 24000; // Gemini outputs at 24kHz
  }

  /**
   * Initialize the audio context (must be called from user gesture).
   */
  async init() {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  /**
   * Queue base64 PCM audio for playback.
   * @param {string} base64PCM - Base64-encoded raw PCM 16-bit 24kHz audio
   */
  play(base64PCM) {
    this._queue.push(base64PCM);
    if (!this._isProcessing) {
      this._processQueue();
    }
  }

  /**
   * Process the playback queue.
   */
  async _processQueue() {
    this._isProcessing = true;

    while (this._queue.length > 0) {
      const base64PCM = this._queue.shift();
      await this._playChunk(base64PCM);
    }

    this._isProcessing = false;
  }

  /**
   * Play a single PCM chunk.
   */
  async _playChunk(base64PCM) {
    try {
      await this.init();

      // Decode base64 to PCM samples
      const binaryStr = atob(base64PCM);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      // Convert 16-bit PCM to Float32
      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7FFF);
      }

      // Create an AudioBuffer and play it
      const audioBuffer = this.audioContext.createBuffer(1, float32Array.length, this._sampleRate);
      audioBuffer.getChannelData(0).set(float32Array);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);

      return new Promise((resolve) => {
        source.onended = () => resolve();
        source.start();
      });
    } catch (err) {
      console.error('Audio playback error:', err);
    }
  }

  /**
   * Stop playback and clear the queue.
   */
  stop() {
    this._queue = [];
    this._isProcessing = false;
    // Close and recreate to stop everything
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
  }

  /**
   * Clear the playback queue (used on interruption).
   */
  clearQueue() {
    this._queue = [];
  }
}
