/**
 * Audio Handler for Gemini Live API
 *
 * Provides:
 * - AudioCapture: Capture mic audio, offload resampling to AudioWorklet,
 *   encode chunks to base64 for WebSocket transport
 * - AudioPlayer: Play back 24kHz PCM audio from base64 data
 */

// ─── Audio Capture ─────────────────────────────────────────────────────────

class AudioCapture {
  constructor() {
    this.stream = null;
    this.audioContext = null;
    this.source = null;
    this.workletNode = null;
    this.isCapturing = false;
    this.onChunk = null; // callback(base64PCMChunk)
    this.onError = null;
  }

  /**
   * Start capturing microphone audio via AudioWorklet (off-main-thread).
   * @param {object} options
   * @param {number} options.chunkDurationMs - Duration of each chunk (default 100ms @ 16kHz)
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

      // Create audio context
      this.audioContext = new AudioContext();
      this.source = this.audioContext.createMediaStreamSource(this.stream);

      // Load and instantiate AudioWorklet (off-main-thread audio processing)
      await this.audioContext.audioWorklet.addModule('/audio-worklet-processor.js');

      this.workletNode = new AudioWorkletNode(
        this.audioContext,
        'pcm-resample-processor',
        {
          processorOptions: {
            sampleRate: this.audioContext.sampleRate,
          },
        }
      );

      // Receive resampled Int16 PCM chunks from the worklet thread
      this.workletNode.port.onmessage = (event) => {
        if (!this.isCapturing) return;
        const msg = event.data;
        if (msg.type === 'pcm-chunk' && msg.data) {
          const base64 = AudioCapture._arrayBufferToBase64(msg.data);
          if (this.onChunk) {
            this.onChunk(base64);
          }
        }
      };

      // Connect into the audio graph so the worklet keeps processing
      this.source.connect(this.workletNode);
      this.workletNode.connect(this.audioContext.destination);

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

    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
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
  }

  /**
   * Efficient Int16 ArrayBuffer → base64.
   * Called on the main thread for each worklet chunk (~10/sec).
   */
  static _arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const len = bytes.length;
    for (let i = 0; i < len; i++) {
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


// ─── Audio Player ──────────────────────────────────────────────────────────

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

      // Decode base64 → PCM bytes → Float32
      const float32Array = AudioPlayer._base64ToFloat32(base64PCM);

      // Create an AudioBuffer and schedule it
      const audioBuffer = this.audioContext.createBuffer(
        1, float32Array.length, this._sampleRate
      );
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
   * Decode base64 PCM (16-bit, 24kHz) to Float32Array.
   */
  static _base64ToFloat32(base64PCM) {
    const binaryStr = atob(base64PCM);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7FFF);
    }
    return float32Array;
  }

  /**
   * Stop playback and clear the queue.
   */
  stop() {
    this._queue = [];
    this._isProcessing = false;
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
