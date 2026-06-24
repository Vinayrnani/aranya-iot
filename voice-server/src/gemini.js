import { GoogleGenAI } from '@google/genai';
import { config } from './config.js';

const VALID_DEVICES = ['ac', 'blinds', 'light', 'led', 'scene'];
const VALID_ACTIONS = ['turn_on', 'turn_off', 'set', 'open', 'close', 'toggle'];

// System prompt for the Legacy (non-Live) pipeline that uses generateContent with JSON output
const legacySystemPrompt = `You are an IoT voice assistant for the Aranya resort. You ONLY handle device commands.

RULES:
1. Device MUST be one of: ${VALID_DEVICES.join(', ')}. Never invent devices.
2. Action MUST be one of: ${VALID_ACTIONS.join(', ')}.
3. Value: use "on"/"off" for lights/blinds, 16-30 for AC temperature, 0-2 for LED scenes, "open"/"close" for blinds. Never null.
4. For greetings, questions, or anything NOT a device command: action="none", device="", value="".
5. Respond in the user's language (te, hi, or en). Set "lang" accordingly.
6. "tts_text" must be your spoken response in the detected language.

Return ONLY valid JSON: {"action": string, "device": string, "value": string, "tts_text": string, "lang": "en"|"hi"|"te"}`;

// System prompt for the Live API pipeline that uses function calling (control_device tool)
const liveSystemPrompt = `You are an IoT voice assistant for the Aranya resort. Support English, Hindi, and Telugu.

LANGUAGE: Detect the user's language and respond in the same language (te, hi, or en).

DEVICE CONTROL — Call 'control_device' tool for these:
- ac: set temperature 16-30°C, turn on/off
- blinds: open, close, toggle
- light: turn on, turn off
- led: scene 0=campfire, 1=poolside, 2=movie
- scene: set to normal, silent, or dnd

For greetings, questions, or anything not a device command: respond helpfully in user's language. Do NOT call tools. Do NOT say "Sorry, I did not understand."`;

function rawPcmToWav(pcmBuffer, sampleRate = 16000) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const dataSize = pcmBuffer.length;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  pcmBuffer.copy(buffer, 44);

  return buffer;
}

export class GeminiLiveService {
  constructor() {
    this.session = null;
    this.client = null;
  }

  /**
   * Establishes a Live API session with Gemini using function calling.
   *
   * @param {object} options
   * @param {function(string): void} options.onAudioChunk - Called with base64 PCM audio
   * @param {function(object[]): void} options.onToolCall - Called with FunctionCall[] from model
   * @param {function(): void} options.onTurnComplete - Called when model turn finishes
   * @param {function(string): void} options.onModelText - Called with model's spoken text from serverContent
   * @param {function(string): void} options.onError - Called with error message
   */
  async connect({ onAudioChunk, onToolCall, onTurnComplete, onModelText, onError }) {
    this.client = new GoogleGenAI({ apiKey: config.gemini.apiKey });

    const modelToUse = config.gemini.liveModel;

    const configData = {
      responseModalities: ['AUDIO'],
      systemInstruction: { parts: [{ text: liveSystemPrompt }] },
      temperature: 0.8,
      outputAudioTranscription: {},
      inputAudioTranscription: {},
      tools: [{
        functionDeclarations: [{
          name: 'control_device',
          description: 'Controls physical smart home devices based on voice commands',
          parametersJsonSchema: {
            type: 'object',
            properties: {
              device: {
                type: 'string',
                description: 'Device to control: ac, blinds, light, led, or scene',
              },
              action: {
                type: 'string',
                description: 'Action: turn_on, turn_off, set, open, close, or toggle',
              },
              value: {
                type: 'string',
                description: 'Additional action value',
              },
            },
            required: ['device', 'action'],
          },
        }],
      }],
    };

    console.log('[GeminiLive] Connection config:', JSON.stringify(configData, null, 2));

    this.session = await this.client.live.connect({
      model: modelToUse,
      config: configData,
      callbacks: {
        onopen: () => {
          console.log('GeminiLive: session connected');
        },
        onmessage: (msg) => {
          if (msg.setupComplete) {
            console.log('[GeminiLive] SETUP COMPLETED. Message body:', JSON.stringify(msg, (k, v) => v instanceof Buffer ? '<Buffer>' : v, 2));
          }
          if (msg.toolCall) {
            console.log('[GeminiLive] TOOL CALL RECEIVED:', JSON.stringify(msg.toolCall, null, 2));
            onToolCall(msg.toolCall.functionCalls);
          }
          if (msg.serverContent?.modelTurn?.parts) {
            for (const part of msg.serverContent.modelTurn.parts) {
              if (part.text && typeof onModelText === 'function') {
                onModelText(part.text);
              }
            }
          }
          if (msg.data) {
            onAudioChunk(msg.data);
          }
          if (msg.serverContent?.turnComplete) {
            onTurnComplete();
          }
        },
        onerror: (e) => {
          onError(e.message || String(e));
        },
        onclose: (closeEvent) => {
          const reason = closeEvent?.reason || 'none';
          const code = closeEvent?.code || 'none';
          console.log(`GeminiLive: session closed (code=${code}, reason=${reason})`);
          this.session = null;
        },
      },
    });

    console.log('GeminiLive: connected');
  }

  /**
   * Sends a PCM audio chunk to the Live API.
   * @param {string} pcmBase64 - Base64-encoded 16kHz mono PCM audio
   */
  async sendAudio(pcmBase64) {
    if (!this.session) {
      console.warn('GeminiLive: cannot send audio — no active session');
      return;
    }
    await this.session.sendRealtimeInput({
      audio: { data: pcmBase64, mimeType: 'audio/pcm;rate=16000' },
    });
  }

  /**
   * Sends a tool response (function result) back to the Live API.
   * Required after receiving a toolCall to unblock the model's audio generation.
   *
   * @param {Array<{id: string, name: string, response: object}>} functionResponses
   */
  sendToolResponse(functionResponses) {
    if (!this.session) {
      console.warn('GeminiLive: cannot send tool response — no active session');
      return;
    }
    this.session.sendToolResponse({ functionResponses });
  }

  /**
   * Signals the end of the user's turn, prompting the model to generate a response.
   * Uses sendClientContent({ turnComplete: true }) which is the correct SDK API
   * for turn completion — NOT sendRealtimeInput with empty mediaChunks.
   */
  async sendEndOfTurn() {
    if (!this.session) return;
    try {
      console.log('[GeminiLive] Sending endOfTurn via sendClientContent');
      await this.session.sendClientContent({ turnComplete: true });
    } catch (e) {
      console.error('[GeminiLive] Failed endOfTurn:', e.message);
    }
  }

  /**
   * Closes the Live API session.
   */
  close() {
    if (!this.session) {
      console.warn('GeminiLive: no session to close');
      return;
    }
    this.session.close();
    this.session = null;
  }
}

const api = {
  async processAudioWithGemini(pcmBuffer) {
    try {
      const wavBuffer = rawPcmToWav(pcmBuffer);
      const base64EncodedWav = wavBuffer.toString('base64');

      const client = new GoogleGenAI({ apiKey: config.gemini.apiKey });

      const response = await client.models.generateContent({
        model: config.gemini.model,
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: 'audio/wav', data: base64EncodedWav } },
              { text: legacySystemPrompt },
            ],
          },
        ],
        config: { responseMimeType: 'application/json' },
      });

      const text = response.text;
      return JSON.parse(text);
    } catch (err) {
      throw new Error(`Gemini: ${err.message}`);
    }
  },

  async processTextWithGemini(text) {
    try {
      const client = new GoogleGenAI({ apiKey: config.gemini.apiKey });

      const response = await client.models.generateContent({
        model: config.gemini.model,
        contents: [
          {
            role: 'user',
            parts: [
              { text: `${legacySystemPrompt}\n\nUser said: "${text}"` },
            ],
          },
        ],
        config: { responseMimeType: 'application/json' },
      });

      return JSON.parse(response.text);
    } catch (err) {
      throw new Error(`Gemini: ${err.message}`);
    }
  },
};

export default api;
