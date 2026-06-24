import { expect } from 'chai';
import sinon from 'sinon';
import { handleConnection, getConversationHistory, sanitizeResponse } from '../src/ws-handler.js';
import GeminiService, { GeminiLiveService } from '../src/gemini.js';

const mockGeminiResponse = {
  action: 'turn_on',
  device: 'light',
  value: 'on',
  tts_text: 'Turning on the light.',
  lang: 'en'
};

describe('ws-handler', () => {
  beforeEach(() => {
    sinon.stub(GeminiService, 'processAudioWithGemini').resolves(mockGeminiResponse);
    sinon.stub(GeminiService, 'processTextWithGemini').resolves(mockGeminiResponse);
    // Stub GeminiLiveService to avoid real API calls in unit tests
    sinon.stub(GeminiLiveService.prototype, 'connect').callsFake(function(onAudioChunk, onTextResponse) {
      return Promise.resolve().then(() => onTextResponse(mockGeminiResponse));
    });
    sinon.stub(GeminiLiveService.prototype, 'sendAudio').resolves();
    sinon.stub(GeminiLiveService.prototype, 'close');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should handle transcript message and return response', (done) => {
    const mockWs = {
      on: (event, callback) => {
        if (event === 'message') {
          callback(JSON.stringify({ type: 'transcript', text: 'turn on the light' }));
        }
      },
      send: (msg) => {
        const response = JSON.parse(msg);
        expect(response.type).to.equal('response');
        expect(response.action).to.equal('turn_on');
        expect(response.tts_audio).to.equal('');
        done();
      }
    };
    handleConnection(mockWs);
  });

  it('should handle audio_end and return response', (done) => {
    const mockWs = {
      on: (event, callback) => {
        if (event === 'message') {
          callback(JSON.stringify({ type: 'audio_chunk', data: Buffer.from([0, 1, 2, 3]).toString('base64') }));
          setTimeout(() => {
            callback(JSON.stringify({ type: 'audio_end' }));
          }, 10);
        }
      },
      send: (msg) => {
        const response = JSON.parse(msg);
        if (response.type === 'response') {
          expect(response.type).to.equal('response');
          expect(response.lang).to.equal('en');
          done();
        }
      }
    };
    handleConnection(mockWs);
  });

  it('should create conversation history entry on audio_end', (done) => {
    const mockWs = {
      on: (event, callback) => {
        if (event === 'message') {
          callback(JSON.stringify({ type: 'audio_chunk', data: Buffer.from([0, 1, 2, 3]).toString('base64') }));
          setTimeout(() => {
            callback(JSON.stringify({ type: 'audio_end' }));
          }, 10);
        }
      },
      send: (msg) => {
        const parsed = JSON.parse(msg);
        if (parsed.type === 'response') {
          const history = getConversationHistory();
          expect(history.length).to.be.greaterThan(0);
          expect(history[history.length - 1]).to.have.property('status');
          done();
        }
      }
    };
    handleConnection(mockWs);
  });
});

describe('sanitizeResponse', () => {
  it('should fix null action', () => {
    const r = sanitizeResponse({ action: null, device: 'invalid', value: 'null', tts_text: 'hi', lang: 'en' });
    expect(r.action).to.equal('none');
    expect(r.device).to.equal('');
    expect(r.value).to.equal('');
    expect(r.tts_text).to.equal('hi');
  });

  it('should pass valid response unchanged', () => {
    const r = sanitizeResponse({ action: 'turn_on', device: 'light', value: 'on', tts_text: 'ok', lang: 'en' });
    expect(r.action).to.equal('turn_on');
    expect(r.device).to.equal('light');
    expect(r.value).to.equal('on');
  });

  it('should handle null input', () => {
    const r = sanitizeResponse(null);
    expect(r.action).to.equal('none');
    expect(r.tts_text).to.equal('Sorry, I did not understand.');
  });

  it('should reject unknown devices', () => {
    const r = sanitizeResponse({ action: 'check_status', device: 'marriage', value: null, tts_text: 'married?', lang: 'te' });
    expect(r.action).to.equal('none');
    expect(r.device).to.equal('');
  });

  it('should reject unknown lang', () => {
    const r = sanitizeResponse({ action: 'turn_off', device: 'ac', value: '', tts_text: 'bye', lang: 'fr' });
    expect(r.lang).to.equal('en');
  });
});
