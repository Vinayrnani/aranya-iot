import { spawn, execSync } from 'child_process';
import OpenAI from 'openai';

let openai;

function getOpenAI() {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

function isPiperAvailable() {
  try {
    execSync('which piper', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export async function synthesize(text, lang, dependencies = { spawn, getOpenAI, execSync }) {
  try {
    // Try Piper for supported languages
    if (['en', 'hi', 'te'].includes(lang)) {
      try {
        return await synthesizePiper(text, lang, dependencies.spawn, dependencies.execSync);
      } catch (piperError) {
        console.warn(`Piper TTS failed (${piperError.message}), trying OpenAI...`);
        // Fall through to OpenAI fallback
      }
    }
    // Try OpenAI fallback (for all languages including Piper-fallback)
    try {
      return await synthesizeOpenAI(text, dependencies.getOpenAI);
    } catch (openaiError) {
      console.warn(`OpenAI TTS failed (${openaiError.message}), returning silent audio`);
      return emptyWav();
    }
  } catch (error) {
    console.error('TTS synthesis failed:', error);
    return emptyWav();
  }
}

function emptyWav() {
  // Return minimal valid WAV header (44 bytes, empty audio data)
  return Buffer.alloc(44);
}

function rawPcmToWav(pcmBuffer, sampleRate) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

const VOICE_CONFIG = {
  en: { sampleRate: 22050, lengthScale: 1.0 },
  hi: { sampleRate: 22050, lengthScale: 1.2 },
  te: { sampleRate: 22050, lengthScale: 1.2 },
};

async function synthesizePiper(text, lang, spawnFn, execSyncFn) {
  // Check piper availability first (use injected execSync or fallback to real one)
  const checkExecSync = execSyncFn || execSync;
  try {
    checkExecSync('which piper', { stdio: 'ignore' });
  } catch {
    throw new Error('Piper binary not found');
  }

  const cfg = VOICE_CONFIG[lang] || VOICE_CONFIG.en;

  return new Promise((resolve, reject) => {
    const piper = spawnFn('piper', [
      '--model', `models/${lang}.onnx`,
      '--output-raw',
      '--length-scale', String(cfg.lengthScale),
    ]);
    const chunks = [];
    piper.stdout.on('data', (chunk) => chunks.push(chunk));

    let rejected = false;
    const rejectOnce = (err) => { if (!rejected) { rejected = true; reject(err); } };

    piper.stderr.on('data', (data) => console.error(`Piper error: ${data}`));
    piper.on('error', (err) => rejectOnce(new Error(`Piper spawn error: ${err.message}`)));
    piper.on('close', (code) => {
      if (rejected) return;
      if (code === 0) {
        const rawPcm = Buffer.concat(chunks);
        resolve(rawPcmToWav(rawPcm, cfg.sampleRate));
      } else {
        rejectOnce(new Error(`Piper exited with code ${code}`));
      }
    });
    piper.stdin.write(text);
    piper.stdin.end();
  });
}

async function synthesizeOpenAI(text, getOpenAIFn) {
  const client = getOpenAIFn();
  const mp3 = await client.audio.speech.create({
    model: "tts-1",
    voice: "alloy",
    input: text,
  });
  return Buffer.from(await mp3.arrayBuffer());
}
