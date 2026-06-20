import { expect } from 'chai';
import sinon from 'sinon';
import * as llmModule from '../src/llm.js';

describe('llm', () => {
  it('should return structured JSON', async () => {
    const stub = sinon.stub(llmModule, 'queryLLM').resolves({
      action: 'turn_on',
      device: 'light',
      value: 'on',
      tts_text: 'Turning on the light.'
    });
    const result = await llmModule.queryLLM('turn on the light');
    expect(result).to.deep.equal({
      action: 'turn_on',
      device: 'light',
      value: 'on',
      tts_text: 'Turning on the light.'
    });
    stub.restore();
  });
});
