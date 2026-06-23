import { spawn } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFileSync, unlinkSync, readFileSync } from 'fs';

const VOICE_MAP = {
  en: 'en-US-JennyNeural',
  hi: 'hi-IN-SwaraNeural',
  te: 'te-IN-ShrutiNeural',
};

const api = {
  async synthesizeEdgeTTS(text, lang) {
    const voice = VOICE_MAP[lang] || VOICE_MAP.en;

    return new Promise((resolve) => {
      const outFile = join(tmpdir(), `edge-tts-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`);
      const proc = spawn('edge-tts', [
        '--text', text,
        '--voice', voice,
        '--write-media', outFile,
      ]);

      proc.on('error', (err) => {
        console.error('Edge TTS error:', err.message);
        try { unlinkSync(outFile); } catch (_) {}
        resolve(Buffer.alloc(44));
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          console.error(`Edge TTS exited with code ${code}`);
          try { unlinkSync(outFile); } catch (_) {}
          resolve(Buffer.alloc(44));
          return;
        }
        try {
          const audio = readFileSync(outFile);
          unlinkSync(outFile);
          resolve(audio);
        } catch (err) {
          console.error('Edge TTS read error:', err.message);
          try { unlinkSync(outFile); } catch (_) {}
          resolve(Buffer.alloc(44));
        }
      });
    });
  },
};

export default api;
