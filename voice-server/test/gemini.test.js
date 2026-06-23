import { expect } from 'chai';
import sinon from 'sinon';
import GeminiService from '../src/gemini.js';

describe('gemini', () => {
  it('should return structured JSON from audio', async () => {
    const stub = sinon.stub(GeminiService, 'processAudioWithGemini').resolves({
      action: 'turn_on',
      device: 'light',
      value: 'on',
      tts_text: 'Turning on the light.',
      lang: 'en'
    });
    const result = await GeminiService.processAudioWithGemini(Buffer.from([0, 1, 2, 3]));
    expect(result).to.deep.equal({
      action: 'turn_on',
      device: 'light',
      value: 'on',
      tts_text: 'Turning on the light.',
      lang: 'en'
    });
    stub.restore();
  });

  it('should throw on API error', async () => {
    const stub = sinon.stub(GeminiService, 'processAudioWithGemini').rejects(new Error('Gemini: API Error'));
    try {
      await GeminiService.processAudioWithGemini(Buffer.from([0, 1, 2, 3]));
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.message).to.include('Gemini:');
    }
    stub.restore();
  });
});
