import { expect } from 'chai';
import sinon from 'sinon';
import { GoogleGenAI } from '@google/genai';
import { GeminiLiveService } from '../src/gemini.js';

describe('GeminiLiveService', () => {
  let mockSession;
  let mockLive;
  let service;

  beforeEach(() => {
    sinon.stub(console, 'log');
    sinon.stub(console, 'warn');

    mockSession = {
      sendRealtimeInput: sinon.stub().resolves(),
      close: sinon.stub(),
    };

    mockLive = {
      connect: sinon.stub().resolves(mockSession),
    };

    // GoogleGenAI sets this.live = new Live(...) in its constructor.
    // Define a getter/setter on the prototype so every instance shares
    // our mockLive, and the constructor assignment is a no-op.
    Object.defineProperty(GoogleGenAI.prototype, 'live', {
      get: () => mockLive,
      set: () => {},
      configurable: true,
    });

    service = new GeminiLiveService();
  });

  afterEach(() => {
    sinon.restore();
    // Restore the original live descriptor
    delete GoogleGenAI.prototype.live;
  });

  it('constructor creates instance with null session and client', () => {
    expect(service).to.be.instanceOf(GeminiLiveService);
    expect(service.session).to.be.null;
    expect(service.client).to.be.null;
  });

  it('connect() establishes session via live.connect and stores it', async () => {
    await service.connect(() => {}, () => {}, () => {});

    expect(mockLive.connect.calledOnce).to.be.true;
    expect(service.client).to.be.instanceOf(GoogleGenAI);
    expect(service.session).to.equal(mockSession);
  });

  it('connect() passes model, config, and callbacks to live.connect', async () => {
    await service.connect(() => {}, () => {}, () => {});

    const args = mockLive.connect.firstCall.args[0];
    expect(args).to.have.property('model');
    expect(args).to.have.property('config');
    expect(args.config).to.have.property('systemInstruction');
    expect(args.config).to.have.property('responseModalities');
    expect(args.config.responseModalities).to.deep.equal(['AUDIO', 'TEXT']);
    expect(args).to.have.property('callbacks');
    expect(args.callbacks).to.have.all.keys('onopen', 'onmessage', 'onerror', 'onclose');
  });

  it('sendAudio() invokes session.sendRealtimeInput with correct payload', async () => {
    await service.connect(() => {}, () => {}, () => {});

    const pcmBase64 = 'dGVzdCBhdWRpbw==';
    await service.sendAudio(pcmBase64);

    expect(mockSession.sendRealtimeInput.calledOnce).to.be.true;
    expect(mockSession.sendRealtimeInput.firstCall.args[0]).to.deep.equal({
      audio: { data: pcmBase64, mimeType: 'audio/pcm;rate=16000' },
    });
  });

  it('close() invokes session.close() and nullifies session', async () => {
    await service.connect(() => {}, () => {}, () => {});

    service.close();

    expect(mockSession.close.calledOnce).to.be.true;
    expect(service.session).to.be.null;
  });

  it('close() does not throw when no session exists', () => {
    expect(() => service.close()).to.not.throw();
  });

  it('sendAudio() does not throw when no session exists and does not call sendRealtimeInput', async () => {
    await service.sendAudio('dGVzdA==');
    expect(mockSession.sendRealtimeInput.called).to.be.false;
  });

  it('onAudioChunk is invoked with the message data when msg.data exists', async () => {
    const onAudioChunk = sinon.stub();
    await service.connect(onAudioChunk, () => {}, () => {});

    const callbacks = mockLive.connect.firstCall.args[0].callbacks;
    const audioData = Buffer.from([0, 1, 2, 3]);
    callbacks.onmessage({ data: audioData });

    expect(onAudioChunk.calledOnce).to.be.true;
    expect(onAudioChunk.firstCall.args[0]).to.equal(audioData);
  });

  it('onTextResponse is invoked with parsed JSON when msg.text is valid JSON', async () => {
    const onTextResponse = sinon.stub();
    await service.connect(() => {}, onTextResponse, () => {});

    const callbacks = mockLive.connect.firstCall.args[0].callbacks;
    const validJson = { action: 'turn_on', device: 'light', value: 'on', tts_text: 'ok', lang: 'en' };
    callbacks.onmessage({ text: JSON.stringify(validJson) });

    expect(onTextResponse.calledOnce).to.be.true;
    expect(onTextResponse.firstCall.args[0]).to.deep.equal(validJson);
  });

  it('onTextResponse is not called for non-JSON text', async () => {
    const onTextResponse = sinon.stub();
    await service.connect(() => {}, onTextResponse, () => {});

    const callbacks = mockLive.connect.firstCall.args[0].callbacks;
    callbacks.onmessage({ text: 'Hello, how can I help you?' });

    expect(onTextResponse.called).to.be.false;
  });

  it('onError is invoked with the error message string when stream error occurs', async () => {
    const onError = sinon.stub();
    await service.connect(() => {}, () => {}, onError);

    const callbacks = mockLive.connect.firstCall.args[0].callbacks;
    const testError = new Error('Stream error');
    callbacks.onerror(testError);

    expect(onError.calledOnce).to.be.true;
    expect(onError.firstCall.args[0]).to.equal('Stream error');
  });

  it('connect() propagates rejection when live.connect fails', async () => {
    const connectError = new Error('Connection failed');
    mockLive.connect.rejects(connectError);

    try {
      await service.connect(() => {}, () => {}, () => {});
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).to.equal(connectError);
    }
  });

  it('onclose callback nullifies service.session', async () => {
    await service.connect(() => {}, () => {}, () => {});
    expect(service.session).to.equal(mockSession);

    const callbacks = mockLive.connect.firstCall.args[0].callbacks;
    callbacks.onclose();

    expect(service.session).to.be.null;
  });

  it('uses config.gemini.liveModel when calling live.connect', async () => {
    await service.connect(() => {}, () => {}, () => {});

    expect(mockLive.connect.calledOnce).to.be.true;
    const connectArg = mockLive.connect.firstCall.args[0];
    expect(connectArg).to.have.property('model');
  });

  it('both onAudioChunk and onTextResponse can fire from the same message', async () => {
    const onAudioChunk = sinon.stub();
    const onTextResponse = sinon.stub();
    await service.connect(onAudioChunk, onTextResponse, () => {});

    const callbacks = mockLive.connect.firstCall.args[0].callbacks;
    const audioData = Buffer.from([10, 20, 30]);
    const validJson = { action: 'set', device: 'ac', value: '22', tts_text: 'ok', lang: 'en' };
    callbacks.onmessage({ data: audioData, text: JSON.stringify(validJson) });

    expect(onAudioChunk.calledOnce).to.be.true;
    expect(onAudioChunk.firstCall.args[0]).to.equal(audioData);
    expect(onTextResponse.calledOnce).to.be.true;
    expect(onTextResponse.firstCall.args[0]).to.deep.equal(validJson);
  });

  it('session.sendRealtimeInput rejection propagates from sendAudio', async () => {
    await service.connect(() => {}, () => {}, () => {});

    const sendError = new Error('Send failed');
    mockSession.sendRealtimeInput.rejects(sendError);

    try {
      await service.sendAudio('dGVzdA==');
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).to.equal(sendError);
    }
  });

  it('onAudioChunk is not called when msg has no data', async () => {
    const onAudioChunk = sinon.stub();
    await service.connect(onAudioChunk, () => {}, () => {});

    const callbacks = mockLive.connect.firstCall.args[0].callbacks;
    callbacks.onmessage({ text: JSON.stringify({ action: 'none' }) });

    expect(onAudioChunk.called).to.be.false;
  });

  it('multiple connect calls create new sessions each time', async () => {
    const secondSession = {
      sendRealtimeInput: sinon.stub().resolves(),
      close: sinon.stub(),
    };
    mockLive.connect.onSecondCall().resolves(secondSession);

    await service.connect(() => {}, () => {}, () => {});
    const firstSession = service.session;
    expect(mockLive.connect.calledOnce).to.be.true;

    await service.connect(() => {}, () => {}, () => {});
    expect(mockLive.connect.calledTwice).to.be.true;
    expect(service.session).to.equal(secondSession);
    expect(service.session).to.not.equal(firstSession);
  });
});
