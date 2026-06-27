/**
 * Gemini Live API Client
 *
 * Manages WebSocket connection to the Gemini Live API using ephemeral tokens.
 * Handles audio/text input streaming and receives audio responses + transcriptions.
 */
class GeminiLiveClient {
  constructor() {
    this.ws = null;
    this.token = null;
    this.model = 'gemini-3.1-flash-live-preview';
    this.connected = false;
    this.sessionActive = false;

    // Callbacks - set by the app
    this.onConnected = null;
    this.onDisconnected = null;
    this.onError = null;
    this.onAudioReceived = null;         // callback(base64PCM)
    this.onInputTranscription = null;     // callback(text)
    this.onOutputTranscription = null;    // callback(text)
    this.onInterrupted = null;
    this.onTurnComplete = null;
    this.onSetupComplete = null;
    this.onTokenCount = null;             // callback(usageMetadata)

    // Internal
    this._languageCode = 'en';
    this._voices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede'];
    this._selectedVoice = 'Kore';
  }

  /**
   * Pre-fetch an ephemeral token in the background (during page load).
   * The cached token will be used by fetchToken() to skip the API call
   * when the user connects.
   */
  async prefetchToken(modelOverride) {
    try {
      const model = modelOverride || this.model;
      const resp = await fetch('/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model }),
      });
      if (!resp.ok) return;
      const data = await resp.json();
      this._cachedTokenData = data;
    } catch (e) {
      // Prefetch failure is non-fatal — fetchToken will retry on demand
    }
  }

  /**
   * Fetch an ephemeral token from the backend.
   * Uses a pre-fetched cached token if one is available and still valid.
   */
  async fetchToken(modelOverride) {
    // Use cached token if still valid (within 1 min of expiry)
    if (this._cachedTokenData) {
      const cached = this._cachedTokenData;
      if (cached.expire_time) {
        const expiresAt = new Date(cached.expire_time).getTime();
        if (Date.now() < expiresAt - 60000) {
          this._cachedTokenData = null;
          this.token = cached.token;
          this.model = cached.model;
          return cached;
        }
      }
      this._cachedTokenData = null;
    }

    const model = modelOverride || this.model;
    const resp = await fetch('/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model }),
    });
    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.error || 'Failed to fetch token');
    }
    const data = await resp.json();
    this.token = data.token;
    this.model = data.model;
    return data;
  }

  /**
   * Build the system instruction for multilingual support.
   */
  _buildSystemInstruction() {
    return `You are a multilingual voice assistant with a warm, helpful personality.
You speak English, Hindi (हिन्दी), and Telugu (తెలుగు) fluently.

RESPONSE RULES:
- Listen carefully to the language the user speaks and ALWAYS respond in the same language.
- If the user speaks Telugu, respond fluently in Telugu.
- If the user speaks Hindi, respond fluently in Hindi.
- If the user speaks English, respond fluently in English.
- Never explain that you are switching languages — just respond naturally.
- Keep your responses conversational and concise — speak like a human, not a document.
- Be warm, engaging, and natural in your speech.`;
  }

  /**
   * Connect to the Gemini Live API WebSocket.
   * @param {string} token - Ephemeral access token
   * @param {string} languageCode - BCP-47 language code (default 'en')
   * @param {object} config - Additional config overrides
   * @param {string|null} systemPrompt - Override the hardcoded system instruction (from server)
   */
  async connect(token, languageCode = 'en', config = {}, systemPrompt = null) {
    if (this.ws) {
      await this.disconnect();
    }

    this.token = token || this.token;
    if (!this.token) {
      throw new Error('No ephemeral token available. Call fetchToken() first.');
    }

    this._languageCode = languageCode || 'en';

    // Build WebSocket URL with ephemeral token
    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${this.token}`;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(wsUrl);
      } catch (e) {
        reject(e);
        return;
      }

      this.ws.binaryType = 'arraybuffer';

        this.ws.onopen = () => {
        this.connected = true;
        if (this.onConnected) this.onConnected();

        // Determine which system prompt to use
        const promptText = systemPrompt || this._buildSystemInstruction();
        console.log('[SYSTEM PROMPT]', promptText.substring(0, 120) + '...');

        // Send the setup message
        const setup = {
          setup: {
            model: `models/${this.model}`,
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: this._selectedVoice,
                  },
                },
              },
            },
            systemInstruction: {
              parts: [{ text: promptText }],
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            ...config,
          },
        };

        this.ws.send(JSON.stringify(setup));
      };

      // The Gemini Live API sends EVERY frame as binary WebSocket
      // data (binaryType=arraybuffer). We peek at the first byte to
      // distinguish JSON messages ({) from raw PCM audio frames.
      this.ws.onmessage = (event) => {
        try {
          const data = event.data;

          // Binary frame — check if it's JSON or raw PCM
          if (data instanceof ArrayBuffer || data instanceof Blob) {
            const bytes = new Uint8Array(data);
            if (bytes.length > 0 && bytes[0] === 0x7B) {
              // JSON message sent as binary frame
              const jsonStr = new TextDecoder().decode(bytes);
              const msg = JSON.parse(jsonStr);

              if (msg.setupComplete && !this.sessionActive) {
                this.sessionActive = true;
                clearTimeout(setupTimeout);
                if (this.onSetupComplete) this.onSetupComplete();
                resolve();
              }

              this._handleMessage(msg);
            } else {
              // Raw PCM audio frame
              this._handleBinary(event.data);
            }
            return;
          }

          // Text frame (fallback for non-binary WebSocket)
          const msg = JSON.parse(data);
          if (msg.setupComplete && !this.sessionActive) {
            this.sessionActive = true;
            clearTimeout(setupTimeout);
            if (this.onSetupComplete) this.onSetupComplete();
            resolve();
          }
          this._handleMessage(msg);
        } catch (e) {
          console.error('Failed to parse message:', e);
        }
      };

      this.ws.onerror = (event) => {
        console.error('WebSocket error:', event);
        if (this.onError) this.onError('WebSocket connection error');
        if (!this.connected) {
          reject(new Error('WebSocket connection failed'));
        }
      };

      this.ws.onclose = (event) => {
        this.connected = false;
        this.sessionActive = false;
        if (this.onDisconnected) {
          this.onDisconnected(event.code, event.reason);
        }
      };

      // Resolve once setup is confirmed (or after timeout)
      const setupTimeout = setTimeout(() => {
        if (!this.sessionActive) {
          this.sessionActive = true;
          resolve();
        }
      }, 5000);
    });
  }

  /**
   * Handle incoming server messages.
   */
  _handleMessage(msg) {
    // Setup complete
    if (msg.setupComplete) {
      this.sessionActive = true;
      if (this.onSetupComplete) this.onSetupComplete();
      return;
    }

    // Server content (audio + transcriptions)
    if (msg.serverContent) {
      const sc = msg.serverContent;

      // Audio data from model — base64-encoded PCM in JSON frames
      if (sc.modelTurn && sc.modelTurn.parts) {
        for (const part of sc.modelTurn.parts) {
          if (part.inlineData && part.inlineData.mimeType?.startsWith('audio/')) {
            const base64Audio = part.inlineData.data;
            if (this.onAudioReceived) {
              this.onAudioReceived(base64Audio);
            }
          }
        }
      }

      // User speech transcription
      if (sc.inputTranscription && sc.inputTranscription.text) {
        if (this.onInputTranscription) {
          this.onInputTranscription(sc.inputTranscription.text);
        }
      }

      // Model speech transcription
      if (sc.outputTranscription && sc.outputTranscription.text) {
        if (this.onOutputTranscription) {
          this.onOutputTranscription(sc.outputTranscription.text);
        }
      }

      // Turn complete signal
      if (sc.turnComplete) {
        if (this.onTurnComplete) this.onTurnComplete();
      }

      // Interruption
      if (sc.interrupted) {
        if (this.onInterrupted) this.onInterrupted();
      }
    }

    // Tool calls
    if (msg.toolCall) {
      console.log('Tool call received:', msg.toolCall);
    }

    // Usage metadata (token counts)
    if (msg.usageMetadata) {
      if (this.onTokenCount) this.onTokenCount(msg.usageMetadata);
    }

    // Session resumption
    if (msg.sessionResumptionUpdate) {
      console.log('Session resumption update:', msg.sessionResumptionUpdate);
    }

    // GoAway
    if (msg.goAway) {
      console.log('GoAway received, timeLeft:', msg.goAway.timeLeft);
    }
  }

  /**
   * Handle raw PCM binary WebSocket frames.
   * Most audio arrives as base64 inlineData in JSON frames, but the
   * API may also send raw PCM binary frames. Converts to base64.
   */
  _handleBinary(data) {
    // Convert ArrayBuffer to base64
    let bytes;
    if (data instanceof ArrayBuffer) {
      bytes = new Uint8Array(data);
    } else if (data instanceof Blob) {
      // Blob should not be used with binaryType=arraybuffer, but handle anyway
      return;
    } else {
      return;
    }

    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    if (this.onAudioReceived) {
      this.onAudioReceived(base64);
    }
  }

  /**
   * Send a text message (realtime input).
   */
  sendText(text) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('Cannot send text - WebSocket not open');
      return;
    }
    this.ws.send(JSON.stringify({
      realtimeInput: { text },
    }));
  }

  /**
   * Send an audio chunk (base64-encoded PCM 16-bit 16kHz).
   */
  sendAudio(base64PCM) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('Cannot send audio - WebSocket not open');
      return;
    }
    this.ws.send(JSON.stringify({
      realtimeInput: {
        audio: {
          data: base64PCM,
          mimeType: 'audio/pcm;rate=16000',
        },
      },
    }));
  }

  /**
   * Send an audio stream end signal (when mic is paused).
   */
  sendAudioStreamEnd() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      realtimeInput: { audioStreamEnd: true },
    }));
  }

  /**
   * Disconnect from the Live API.
   */
  async disconnect() {
    if (this.ws) {
      try {
        this.ws.close(1000, 'User disconnected');
      } catch (e) {
        // Ignore close errors
      }
      this.ws = null;
    }
    this.connected = false;
    this.sessionActive = false;
  }

  /**
   * Set the voice for speech output.
   */
  setVoice(voiceName) {
    this._selectedVoice = voiceName;
  }

  /**
   * Check if the client is connected.
   */
  isConnected() {
    return this.connected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

// Export for module usage or global scope
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GeminiLiveClient };
}
