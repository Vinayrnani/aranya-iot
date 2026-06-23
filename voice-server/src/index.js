import 'dotenv/config';
import express from 'express';
import http from 'http';
import fs from 'fs';
import { WebSocketServer } from 'ws';
import { handleConnection, getConversationHistory, getConversationAudio } from './ws-handler.js';
import { config } from './config.js';
import GeminiService from './gemini.js';
import EdgeTTSService from './edge-tts.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Auto-create .env from .env.example if missing
if (!fs.existsSync('.env')) {
  console.warn('\x1b[33mNo .env file found. Creating from .env.example...\x1b[0m');
  fs.copyFileSync('.env.example', '.env');
  console.warn('\x1b[33mPlease edit .env and set your GEMINI_API_KEY.\x1b[0m');
}

// Startup validation checks
if (!config.gemini.apiKey) {
  console.warn('\x1b[33mWARNING: GEMINI_API_KEY is not set. Voice features will fail.');
  console.warn('Copy .env.example to .env and set GEMINI_API_KEY.\x1b[0m');
}

const app = express();
const server = http.createServer(app);

// Serve static files from aranya-hub/data
app.use(express.static(join(__dirname, '../../aranya-hub/data')));

// API: conversation history (last 15)
app.get('/api/voice-history', (req, res) => {
  res.json(getConversationHistory());
});

// Wrap raw PCM (16-bit, 16kHz, mono) in a WAV header for the browser
function pcmToWav(pcmBuffer) {
  const sampleRate = 16000;
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

// API: serve output/input audio for a history entry
app.get('/api/voice-history/:index/audio', (req, res) => {
  const index = parseInt(req.params.index, 10);
  const type = req.query.type === 'input' ? 'inputAudio' : 'outputAudio';
  const audio = getConversationAudio(index);
  if (!audio || !audio[type]) {
    return res.status(404).send('Audio not found');
  }
  let data = audio[type];
  // Input audio is raw PCM (16-bit, 16kHz, mono) — wrap in WAV header
  if (type === 'inputAudio') {
    data = pcmToWav(data);
  }
  res.set('Content-Type', 'audio/wav');
  res.send(data);
});

// API: replay a voice history entry through the pipeline
app.post('/api/voice-history/:index/replay', async (req, res) => {
  try {
    const index = parseInt(req.params.index, 10);
    const audio = getConversationAudio(index);
    if (!audio || !audio.inputAudio) {
      return res.status(404).json({ error: 'Entry not found or no input audio' });
    }

    const response = await GeminiService.processAudioWithGemini(audio.inputAudio);
    const ttsAudio = await EdgeTTSService.synthesizeEdgeTTS(response.tts_text, response.lang);

    res.json({
      ...response,
      tts_audio: ttsAudio.toString('base64')
    });
  } catch (err) {
    console.error('[REPLAY] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', handleConnection);

server.listen(config.wsPort || 8080, () => {
    console.log(`Voice server and Dashboard listening on port ${config.wsPort || 8080}`);
    console.log(`Gemini model: ${config.gemini.model}`);
});
