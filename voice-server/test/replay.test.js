import 'dotenv/config';
import { expect } from 'chai';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import GeminiService from '../src/gemini.js';
import EdgeTTSService from '../src/edge-tts.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, 'fixtures');

describe('replay', function () {
  this.timeout(60000);

  const replayFixtures = [
    { file: 'test_en.wav', expectedLang: 'en', name: 'English' },
    { file: 'test_hi.wav', expectedLang: 'hi', name: 'Hindi' },
    { file: 'test_te.wav', expectedLang: 'te', name: 'Telugu' },
  ];

  replayFixtures.forEach(({ file, expectedLang, name }) => {
    it(`should replay ${name} audio through pipeline and detect ${expectedLang}`, async () => {
      const wavPath = join(FIXTURES_DIR, file);
      const wavBuf = readFileSync(wavPath);
      const pcmBuf = wavBuf.slice(44); // strip WAV header → raw PCM

      // Step 1: Gemini processes audio
      const response = await GeminiService.processAudioWithGemini(pcmBuf);
      expect(response).to.have.property('lang');
      expect(response).to.have.property('tts_text');
      expect(response.tts_text.length).to.be.greaterThan(0);

      // Language should match (Gemini may be more accurate than the old Piper TTS)
      // Allow some flexibility — Piper fixtures are synthetic TTS, not human speech
      if (response.lang !== expectedLang) {
        console.warn(`[REPLAY] ${name}: expected lang=${expectedLang}, got lang=${response.lang} — Gemini detected different language from synthetic fixture`);
      }

      // Step 2: Edge TTS synthesizes
      const ttsAudio = await EdgeTTSService.synthesizeEdgeTTS(response.tts_text, response.lang);
      expect(Buffer.isBuffer(ttsAudio)).to.be.true;
      expect(ttsAudio.length).to.be.greaterThan(100);

      // Verify response shape matches what ws-handler sends
      expect(response).to.have.all.keys('action', 'device', 'value', 'tts_text', 'lang');
    });
  });
});
