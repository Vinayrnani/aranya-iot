import { GoogleGenAI } from '@google/genai';
import { config } from './config.js';

const VALID_DEVICES = ['ac', 'blinds', 'light', 'led', 'scene'];
const VALID_ACTIONS = ['turn_on', 'turn_off', 'set', 'open', 'close', 'toggle'];

const systemPrompt = `You are an IoT voice assistant for the Aranya resort. You ONLY handle device commands.

RULES:
1. Device MUST be one of: ${VALID_DEVICES.join(', ')}. Never invent devices.
2. Action MUST be one of: ${VALID_ACTIONS.join(', ')}.
3. Value: use "on"/"off" for lights/blinds, 16-30 for AC temperature, 0-2 for LED scenes, "open"/"close" for blinds. Never null.
4. For greetings, questions, or anything NOT a device command: action="none", device="", value="".
5. Respond in the user's language (te, hi, or en). Set "lang" accordingly.
6. "tts_text" must be your spoken response in the detected language.

Return ONLY valid JSON: {"action": string, "device": string, "value": string, "tts_text": string, "lang": "en"|"hi"|"te"}`;

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
   * Establishes a Live API session with Gemini.
   * @param {function(base64PcmString): void} onAudioChunk - Called when audio data arrives
   * @param {function(object): void} onTextResponse - Called when parsed JSON text arrives
   * @param {function(string): void} onError - Called on errors with error message
   */
  async connect(onAudioChunk, onTextResponse, onError) {
    this.client = new GoogleGenAI({ apiKey: config.gemini.apiKey });

    const live = this.client.live;

    this.session = await live.connect({
      model: config.gemini.liveModel,
      config: {
        responseModalities: ['AUDIO', 'TEXT'],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { temperature: 0.8 },
      },
      callbacks: {
        onopen: () => {
          console.log('GeminiLive: session connected');
        },
        onmessage: (msg) => {
          if (msg.data) {
            onAudioChunk(msg.data);
          }
          if (msg.text) {
            try {
              const parsed = JSON.parse(msg.text);
              onTextResponse(parsed);
            } catch (e) {
              console.log('GeminiLive: failed to parse text response', e.message);
            }
          }
        },
        onerror: (e) => {
          onError(e.message || String(e));
        },
        onclose: () => {
          console.log('GeminiLive: session closed');
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
              { text: systemPrompt },
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
              { text: `${systemPrompt}\n\nUser said: "${text}"` },
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
