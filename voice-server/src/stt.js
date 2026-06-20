import Groq from 'groq-sdk';
import { config } from './config.js';
import fs from 'fs';

const groq = new Groq({ apiKey: config.groq.apiKey });

export async function transcribeAudio(audioBuffer) {
  try {
    const tempPath = '/tmp/audio.wav';
    fs.writeFileSync(tempPath, audioBuffer);
    
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: config.groq.sttModel,
    });
    
    return transcription.text;
  } catch (error) {
    console.error('STT Error:', error);
    throw new Error('STT transcription failed');
  }
}
