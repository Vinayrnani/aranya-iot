/**
 * Viva Voice — Conversation Recorder
 *
 * Records every step of the audio pipeline to be saved directly to the server:
 *   - Input audio (mic PCM 16kHz)
 *   - Input transcription (what Gemini heard)
 *   - Output audio (Gemini response PCM 24kHz)
 *   - Output transcription (what Gemini said)
 *   - Language, voice, timestamps, duration
 *
 * Saves conversations directly to the server via HTTP POST.
 */

class ConversationRecorder {

  constructor() {
    // Current conversation being recorded
    this._currentId = null;
    this._inputChunks = [];   // Uint8Array[]
    this._outputChunks = [];  // Uint8Array[]
    this._inputTranscript = '';
    this._outputTranscript = '';
    this._startTime = 0;
    this._language = '';
    this._voice = '';
  }

  // ─── Conversation lifecycle ─────────────────────────────────────────────

  /**
   * Start recording a new conversation.
   * @param {string} language - BCP-47 code ('en', 'hi', 'te')
   * @param {string} voice - Prebuilt voice name ('Kore', 'Puck', etc.)
   */
  startConversation(language, voice) {
    // Reset state for a fresh conversation
    this._inputChunks = [];
    this._outputChunks = [];
    this._inputTranscript = '';
    this._outputTranscript = '';
    this._startTime = Date.now();
    this._language = language || 'en';
    this._voice = voice || 'Kore';
    this._currentId = `conv_${this._startTime}`;
  }

  /** Record an input audio chunk (base64 PCM 16kHz from mic). */
  addInputAudio(base64PCM) {
    if (!this._currentId) return;
    try {
      const bytes = this._base64ToBytes(base64PCM);
      this._inputChunks.push(bytes);
    } catch (e) {
      // Ignore decode failures for individual chunks
    }
  }

  /** Record the input transcription (what Gemini heard). */
  setInputTranscript(text) {
    if (!text) return;
    if (this._inputTranscript) {
      this._inputTranscript += ' ' + text;
    } else {
      this._inputTranscript = text;
    }
  }

  /** Record an output audio chunk (base64 PCM 24kHz from Gemini). */
  addOutputAudio(base64PCM) {
    if (!this._currentId) return;
    try {
      const bytes = this._base64ToBytes(base64PCM);
      this._outputChunks.push(bytes);
    } catch (e) {
      // Ignore decode failures
    }
  }

  /** Record the output transcription (what Gemini said). */
  setOutputTranscript(text) {
    if (!text) return;
    if (this._outputTranscript) {
      this._outputTranscript += ' ' + text;
    } else {
      this._outputTranscript = text;
    }
  }

  /**
   * End and save the current conversation to the server.
   * Returns the saved conversation id.
   */
  async endConversation() {
    if (!this._currentId) return null;

    const id = this._currentId;
    // Null immediately so callbacks between here and startConversation()
    // don't leak data into a conversation that's being closed.
    this._currentId = null;

    const duration = Date.now() - this._startTime;

    // Build Blobs from accumulated chunks
    const inputBlob = this._chunksToBlob(this._inputChunks);
    const outputBlob = this._chunksToBlob(this._outputChunks);

    // Convert Blobs to base64
    const inputB64 = await this._blobToBase64(inputBlob);
    const outputB64 = await this._blobToBase64(outputBlob);

    const payload = {
      id,
      timestamp: this._startTime,
      language: this._language,
      voice: this._voice,
      inputTranscript: this._inputTranscript || '',
      outputTranscript: this._outputTranscript || '',
      inputPCM_b64: inputB64,
      outputPCM_b64: outputB64,
    };

    const saveUrl = `${window.location.origin}/api/conversations/save`;

    const response = await fetch(saveUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Server save failed: ${response.status}`);
    }

    return (await response.json()).id;
  }

  /**
   * Cancel the current conversation recording without saving.
   */
  cancelConversation() {
    this._currentId = null;
    this._inputChunks = [];
    this._outputChunks = [];
    this._inputTranscript = '';
    this._outputTranscript = '';
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /** Convert base64 string to Uint8Array. */
  _base64ToBytes(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  /** Concatenate Uint8Array chunks into a single Blob. */
  _chunksToBlob(chunks) {
    if (chunks.length === 0) return new Blob([]);
    return new Blob(chunks, { type: 'application/octet-stream' });
  }

  /** Convert a Blob to a base64 string. */
  _blobToBase64(blob) {
    if (!blob || blob.size === 0) return '';
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Result is "data:application/octet-stream;base64,..." - strip prefix
        const dataUrl = reader.result;
        const comma = dataUrl.indexOf(',');
        resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }
}
