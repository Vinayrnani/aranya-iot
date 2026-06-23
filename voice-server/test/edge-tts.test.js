import { expect } from 'chai';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import EdgeTTSService from '../src/edge-tts.js';

describe('edge-tts', function () {
  this.timeout(30000);

  it('should return audio buffer for English', async () => {
    const result = await EdgeTTSService.synthesizeEdgeTTS('Hello, how can I help you?', 'en');
    expect(Buffer.isBuffer(result)).to.be.true;
    expect(result.length).to.be.greaterThan(100);
    // Should start with MP3 header (0xFF 0xFB or 0xFF 0xF3) or be large enough
    expect(result.length).to.be.greaterThan(1000);
  });

  it('should return audio buffer for Hindi', async () => {
    const result = await EdgeTTSService.synthesizeEdgeTTS('नमस्ते, आप कैसे हैं?', 'hi');
    expect(Buffer.isBuffer(result)).to.be.true;
    expect(result.length).to.be.greaterThan(1000);
  });

  it('should return audio buffer for Telugu', async () => {
    const result = await EdgeTTSService.synthesizeEdgeTTS('నమస్కారం, ఎలా ఉన్నారు?', 'te');
    expect(Buffer.isBuffer(result)).to.be.true;
    expect(result.length).to.be.greaterThan(1000);
  });

  it('should return empty wav on error for unknown lang (falls back to english)', async () => {
    // Unsupported lang falls back to en-US-JennyNeural, should still produce audio
    const result = await EdgeTTSService.synthesizeEdgeTTS('Hello', 'xh');
    expect(Buffer.isBuffer(result)).to.be.true;
    expect(result.length).to.be.greaterThan(1000);
  });

  it('should not leave temp files after completion', async () => {
    const result = await EdgeTTSService.synthesizeEdgeTTS('test file cleanup', 'en');
    expect(result.length).to.be.greaterThan(1000);

    const stray = readdirSync(tmpdir());
    const leftOvers = stray.filter(f => f.startsWith('edge-tts-'));
    expect(leftOvers.length).to.equal(0, `Stale temp files: ${leftOvers.join(', ')}`);
  });
});
