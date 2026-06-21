import Groq from 'groq-sdk';
import { config } from './config.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const groq = new Groq({ apiKey: config.groq.apiKey });

const LANG_NAME_TO_CODE = {
  english: 'en',
  hindi: 'hi',
  telugu: 'te',
};

export async function transcribeAudio(audioBuffer) {
  const rand = crypto.randomBytes(4).toString('hex');
  const tempPath = path.join(os.tmpdir(), `voice-${Date.now()}-${rand}.webm`);

  try {
    fs.writeFileSync(tempPath, audioBuffer);

    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: config.groq.sttModel,
      response_format: 'verbose_json',
      temperature: 0.0,
    });

    const text = transcription.text || '';
    const langName = (transcription.language || '').toLowerCase().trim();
    const language = LANG_NAME_TO_CODE[langName] || 'en';

    console.log(`[STT] Whisper detected: "${langName}" → code: "${language}" | text: "${text.slice(0, 80)}"`);

    return { text, language };
  } finally {
    try { fs.unlinkSync(tempPath); } catch (_) { /* ignore */ }
  }
}
