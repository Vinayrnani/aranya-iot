import { expect } from 'chai';
import sinon from 'sinon';
import { synthesize } from '../src/tts.js';

describe('tts', () => {
  it('should call piper for supported languages', async () => {
    let closeCb = null;
    const spawnStub = sinon.stub().returns({
      stdout: { on: (event, cb) => { if (event === 'data') cb(Buffer.from('wav-data')); } },
      stderr: { on: () => {} },
      on: (event, cb) => { if (event === 'close') closeCb = cb; if (event === 'error') { /* no-op, don't register error */ } },
      stdin: { write: () => {}, end: () => {} }
    });
    const execSyncStub = sinon.stub().returns(Buffer.from(''));
    
    const resultPromise = synthesize('hello', 'en', { spawn: spawnStub, getOpenAI: () => {}, execSync: execSyncStub });
    // Simulate piper closing successfully
    closeCb(0);
    const result = await resultPromise;
    expect(result).to.deep.equal(Buffer.from('wav-data'));
    expect(spawnStub.calledOnce).to.be.true;
  });

  it('should fall back to OpenAI when piper is unavailable', async () => {
    const execSyncStub = sinon.stub().throws(new Error('not found'));
    const getOpenAIStub = sinon.stub().returns({
      audio: {
        speech: {
          create: async () => ({
            arrayBuffer: async () => new Uint8Array([0, 1, 2, 3]).buffer
          })
        }
      }
    });
    
    const result = await synthesize('hello', 'en', { spawn: () => {}, getOpenAI: getOpenAIStub, execSync: execSyncStub });
    expect(result).to.deep.equal(Buffer.from([0, 1, 2, 3]));
  });

  it('should return empty wav when both piper and OpenAI fail', async () => {
    const execSyncStub = sinon.stub().throws(new Error('not found'));
    const getOpenAIStub = sinon.stub().throws(new Error('No API key'));
    
    const result = await synthesize('hello', 'en', { spawn: () => {}, getOpenAI: getOpenAIStub, execSync: execSyncStub });
    expect(result).to.deep.equal(Buffer.alloc(44));
  });

  it('should call OpenAI directly for unsupported languages', async () => {
    const getOpenAIStub = sinon.stub().returns({
      audio: {
        speech: {
          create: async () => ({
            arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer
          })
        }
      }
    });
    
    const result = await synthesize('hello', 'fr', { spawn: () => {}, getOpenAI: getOpenAIStub, execSync: () => {} });
    expect(result).to.deep.equal(Buffer.from([1, 2, 3]));
  });
});
