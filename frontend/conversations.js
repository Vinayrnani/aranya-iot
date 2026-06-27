/**
 * Viva Voice — Conversation Recorder
 *
 * Records every step of the audio pipeline to IndexedDB for replay testing:
 *   - Input audio (mic PCM 16kHz)
 *   - Input transcription (what Gemini heard)
 *   - Output audio (Gemini response PCM 24kHz)
 *   - Output transcription (what Gemini said)
 *   - Language, voice, timestamps, duration
 *
 * Retains up to 50 conversations. Provides export for server-side replay.
 */

class ConversationRecorder {

  static get DB_NAME() { return 'VivaVoiceConversations'; }
  static get DB_VERSION() { return 1; }
  static get STORE_NAME() { return 'conversations'; }
  static get MAX_CONVERSATIONS() { return 50; }

  constructor() {
    this._db = null;
    this._dbReady = this._openDB();

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

  // ─── IndexedDB ───────────────────────────────────────────────────────────

  async _openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(ConversationRecorder.DB_NAME, ConversationRecorder.DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(ConversationRecorder.STORE_NAME)) {
          const store = db.createObjectStore(ConversationRecorder.STORE_NAME, {
            keyPath: 'id',
          });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this._db = event.target.result;
        resolve();
      };

      request.onerror = (event) => {
        console.error('ConversationRecorder: Failed to open DB', event.target.error);
        reject(event.target.error);
      };
    });
  }

  async _ensureDB() {
    await this._dbReady;
    if (!this._db) throw new Error('IndexedDB not available');
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
   * End and save the current conversation to IndexedDB.
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

    const conversation = {
      id,
      timestamp: this._startTime,
      language: this._language,
      voice: this._voice,
      durationMs: duration,
      inputTranscript: this._inputTranscript,
      outputTranscript: this._outputTranscript,
      inputAudioSize: this._inputChunks.reduce((s, c) => s + c.length, 0),
      outputAudioSize: this._outputChunks.reduce((s, c) => s + c.length, 0),
      inputAudio: inputBlob,
      outputAudio: outputBlob,
    };

    await this._ensureDB();

    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(ConversationRecorder.STORE_NAME, 'readwrite');
      const store = tx.objectStore(ConversationRecorder.STORE_NAME);

      const request = store.put(conversation);
      request.onsuccess = () => {
        this._prune(); // Fire-and-forget
        resolve(id);
      };
      request.onerror = (event) => {
        console.error('ConversationRecorder: Save failed', event.target.error);
        reject(event.target.error);
      };
    });
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

  // ─── History access ──────────────────────────────────────────────────────

  /**
   * Get the most recent N conversations from IndexedDB.
   * Returns a list of conversation metadata (without audio Blobs).
   */
  async getHistory(count = 12) {
    await this._ensureDB();

    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(ConversationRecorder.STORE_NAME, 'readonly');
      const store = tx.objectStore(ConversationRecorder.STORE_NAME);
      const index = store.index('timestamp');

      // Get all, sorted by timestamp descending
      const request = index.openCursor(null, 'prev');
      const results = [];

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && results.length < count) {
          const entry = cursor.value;
          // Omit audio blobs from list results (too large for simple listing)
          results.push({
            id: entry.id,
            timestamp: entry.timestamp,
            language: entry.language,
            voice: entry.voice,
            durationMs: entry.durationMs,
            inputTranscript: entry.inputTranscript,
            outputTranscript: entry.outputTranscript,
            inputAudioSize: entry.inputAudioSize,
            outputAudioSize: entry.outputAudioSize,
          });
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  /**
   * Get a single conversation by ID, including audio Blobs.
   */
  async getConversation(id) {
    await this._ensureDB();

    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(ConversationRecorder.STORE_NAME, 'readonly');
      const store = tx.objectStore(ConversationRecorder.STORE_NAME);
      const request = store.get(id);

      request.onsuccess = (event) => {
        resolve(event.target.result || null);
      };
      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  /**
   * Get the total number of stored conversations.
   */
  async getCount() {
    await this._ensureDB();

    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(ConversationRecorder.STORE_NAME, 'readonly');
      const store = tx.objectStore(ConversationRecorder.STORE_NAME);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  /**
   * Export a conversation's audio as downloadable PCM files.
   * Returns { id, inputPCM: Blob, outputPCM: Blob, manifest: object }
   */
  async exportConversation(id) {
    const conv = await this.getConversation(id);
    if (!conv) return null;

    return {
      id: conv.id,
      manifest: {
        id: conv.id,
        timestamp: conv.timestamp,
        language: conv.language,
        voice: conv.voice,
        durationMs: conv.durationMs,
        inputTranscript: conv.inputTranscript,
        outputTranscript: conv.outputTranscript,
        inputAudioSize: conv.inputAudioSize,
        outputAudioSize: conv.outputAudioSize,
        inputSampleRate: 16000,
        outputSampleRate: 24000,
      },
      inputPCM: conv.inputAudio,
      outputPCM: conv.outputAudio,
    };
  }

  // ─── Pruning ─────────────────────────────────────────────────────────────

  /**
   * Remove old conversations beyond MAX_CONVERSATIONS.
   */
  async _prune() {
    try {
      await this._ensureDB();

      const count = await this.getCount();
      if (count <= ConversationRecorder.MAX_CONVERSATIONS) return;

      const excess = count - ConversationRecorder.MAX_CONVERSATIONS;

      const tx = this._db.transaction(ConversationRecorder.STORE_NAME, 'readwrite');
      const store = tx.objectStore(ConversationRecorder.STORE_NAME);
      const index = store.index('timestamp');
      const request = index.openCursor(null, 'asc'); // Oldest first

      let deleted = 0;
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && deleted < excess) {
          store.delete(cursor.primaryKey);
          deleted++;
          cursor.continue();
        }
      };
    } catch (e) {
      console.warn('ConversationRecorder: Prune failed', e);
    }
  }

  /**
   * Delete all conversation history.
   */
  async clearHistory() {
    await this._ensureDB();

    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(ConversationRecorder.STORE_NAME, 'readwrite');
      const store = tx.objectStore(ConversationRecorder.STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event.target.error);
    });
  }

  /**
   * Delete a single conversation by ID.
   */
  async deleteConversation(id) {
    await this._ensureDB();

    return new Promise((resolve, reject) => {
      const tx = this._db.transaction(ConversationRecorder.STORE_NAME, 'readwrite');
      const store = tx.objectStore(ConversationRecorder.STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event.target.error);
    });
  }

  // ─── Server export (for E2E replay tests) ───────────────────────────────

  /**
   * Export a conversation to the server for replay testing.
   * Sends the conversation data to POST /api/conversations/save.
   * @param {string} id - Conversation ID (defaults to last saved)
   * @param {string} serverUrl - Server base URL (default: derived from location)
   */
  async exportToServer(id, serverUrl) {
    const conv = await this.getConversation(id);
    if (!conv) throw new Error(`Conversation ${id} not found`);

    const baseUrl = serverUrl || (window.location.origin + '');
    const saveUrl = `${baseUrl}/api/conversations/save`;

    // Convert Blobs to base64
    const inputB64 = await this._blobToBase64(conv.inputAudio);
    const outputB64 = await this._blobToBase64(conv.outputAudio);

    const payload = {
      id: conv.id,
      timestamp: conv.timestamp,
      language: conv.language,
      voice: conv.voice,
      inputTranscript: conv.inputTranscript || '',
      outputTranscript: conv.outputTranscript || '',
      inputPCM_b64: inputB64,
      outputPCM_b64: outputB64,
    };

    const response = await fetch(saveUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Server export failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Export all unsaved conversations to the server.
   * Compares with server's list to avoid re-exporting.
   */
  async exportAllToServer(serverUrl) {
    const baseUrl = serverUrl || (window.location.origin + '');

    // Get server's existing conversation IDs
    let serverIds = [];
    try {
      const resp = await fetch(`${baseUrl}/api/conversations?limit=100`);
      if (resp.ok) {
        const list = await resp.json();
        serverIds = list.map(c => c.id);
      }
    } catch (e) {
      // Server may not be running; that's OK
    }

    // Get all local conversations (newest first)
    const local = await this.getHistory(100);
    const results = { exported: 0, skipped: 0, errors: 0 };

    for (const conv of local) {
      if (serverIds.includes(conv.id)) {
        results.skipped++;
        continue;
      }
      try {
        await this.exportToServer(conv.id, baseUrl);
        results.exported++;
      } catch (e) {
        console.warn('Export failed:', conv.id, e);
        results.errors++;
      }
    }

    return results;
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
