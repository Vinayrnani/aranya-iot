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
      sendToolResponse: sinon.stub(),
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
    await service.connect({
      onAudioChunk: () => {},
      onToolCall: () => {},
      onTurnComplete: () => {},
      onError: () => {},
    });

    expect(mockLive.connect.calledOnce).to.be.true;
    expect(service.client).to.be.instanceOf(GoogleGenAI);
    expect(service.session).to.equal(mockSession);
  });

  it('connect() passes model, config with tools, and callbacks to live.connect', async () => {
    await service.connect({
      onAudioChunk: () => {},
      onToolCall: () => {},
      onTurnComplete: () => {},
      onError: () => {},
    });

    const args = mockLive.connect.firstCall.args[0];
    expect(args).to.have.property('model');
    expect(args).to.have.property('config');
    expect(args.config).to.have.property('systemInstruction');
    expect(args.config).to.have.property('responseModalities');
    expect(args.config.responseModalities).to.deep.equal(['AUDIO']);
    // Verify function calling tools are configured
    expect(args.config).to.have.property('tools');
    expect(args.config.tools).to.be.an('array').with.lengthOf(1);
    expect(args.config.tools[0]).to.have.property('functionDeclarations');
    expect(args.config.tools[0].functionDeclarations[0].name).to.equal('control_device');
    expect(args).to.have.property('callbacks');
    expect(args.callbacks).to.have.all.keys('onopen', 'onmessage', 'onerror', 'onclose');
  });

  it('sendAudio() invokes session.sendRealtimeInput with correct payload', async () => {
    await service.connect({
      onAudioChunk: () => {},
      onToolCall: () => {},
      onTurnComplete: () => {},
      onError: () => {},
    });

    const pcmBase64 = 'dGVzdCBhdWRpbw==';
    await service.sendAudio(pcmBase64);

    expect(mockSession.sendRealtimeInput.calledOnce).to.be.true;
    expect(mockSession.sendRealtimeInput.firstCall.args[0]).to.deep.equal({
      audio: { data: pcmBase64, mimeType: 'audio/pcm;rate=16000' },
    });
  });

  it('sendToolResponse() invokes session.sendToolResponse with function responses', async () => {
    await service.connect({
      onAudioChunk: () => {},
      onToolCall: () => {},
      onTurnComplete: () => {},
      onError: () => {},
    });

    const responses = [{ id: 'call1', name: 'control_device', response: { result: 'success' } }];
    service.sendToolResponse(responses);

    expect(mockSession.sendToolResponse.calledOnce).to.be.true;
    expect(mockSession.sendToolResponse.firstCall.args[0]).to.deep.equal({
      functionResponses: responses,
    });
  });

  it('sendToolResponse() does not throw when no session exists', () => {
    expect(() => service.sendToolResponse([{ id: '1', name: 'test', response: {} }])).to.not.throw();
  });

  it('close() invokes session.close() and nullifies session', async () => {
    await service.connect({
      onAudioChunk: () => {},
      onToolCall: () => {},
      onTurnComplete: () => {},
      onError: () => {},
    });

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
    await service.connect({
      onAudioChunk,
      onToolCall: () => {},
      onTurnComplete: () => {},
      onError: () => {},
    });

    const callbacks = mockLive.connect.firstCall.args[0].callbacks;
    const audioData = Buffer.from([0, 1, 2, 3]);
    callbacks.onmessage({ data: audioData });

    expect(onAudioChunk.calledOnce).to.be.true;
    expect(onAudioChunk.firstCall.args[0]).to.equal(audioData);
  });

  it('onToolCall is invoked with functionCalls when msg.toolCall exists', async () => {
    const onToolCall = sinon.stub();
    await service.connect({
      onAudioChunk: () => {},
      onToolCall,
      onTurnComplete: () => {},
      onError: () => {},
    });

    const callbacks = mockLive.connect.firstCall.args[0].callbacks;
    const functionCalls = [
      { id: 'call1', name: 'control_device', args: { device: 'light', action: 'turn_on' } },
    ];
    callbacks.onmessage({ toolCall: { functionCalls } });

    expect(onToolCall.calledOnce).to.be.true;
    expect(onToolCall.firstCall.args[0]).to.deep.equal(functionCalls);
  });

  it('onTurnComplete is invoked when msg.serverContent.turnComplete is true', async () => {
    const onTurnComplete = sinon.stub();
    await service.connect({
      onAudioChunk: () => {},
      onToolCall: () => {},
      onTurnComplete,
      onError: () => {},
    });

    const callbacks = mockLive.connect.firstCall.args[0].callbacks;
    callbacks.onmessage({ serverContent: { turnComplete: true } });

    expect(onTurnComplete.calledOnce).to.be.true;
  });

  it('both onAudioChunk and onToolCall can fire from the same message', async () => {
    const onAudioChunk = sinon.stub();
    const onToolCall = sinon.stub();
    await service.connect({
      onAudioChunk,
      onToolCall,
      onTurnComplete: () => {},
      onError: () => {},
    });

    const callbacks = mockLive.connect.firstCall.args[0].callbacks;
    const audioData = Buffer.from([10, 20, 30]);
    const functionCalls = [
      { id: 'call2', name: 'control_device', args: { device: 'ac', action: 'set', value: 22 } },
    ];
    callbacks.onmessage({ data: audioData, toolCall: { functionCalls } });

    expect(onAudioChunk.calledOnce).to.be.true;
    expect(onAudioChunk.firstCall.args[0]).to.equal(audioData);
    expect(onToolCall.calledOnce).to.be.true;
    expect(onToolCall.firstCall.args[0]).to.deep.equal(functionCalls);
  });

  it('onAudioChunk, onToolCall, and onTurnComplete can all fire in sequence', async () => {
    const onAudioChunk = sinon.stub();
    const onToolCall = sinon.stub();
    const onTurnComplete = sinon.stub();
    await service.connect({
      onAudioChunk,
      onToolCall,
      onTurnComplete,
      onError: () => {},
    });

    const callbacks = mockLive.connect.firstCall.args[0].callbacks;

    // Audio arrives
    callbacks.onmessage({ data: 'audio1' });
    expect(onAudioChunk.calledOnce).to.be.true;

    // Tool call arrives
    callbacks.onmessage({ toolCall: { functionCalls: [{ id: 'c1', name: 'control_device', args: {} }] } });
    expect(onToolCall.calledOnce).to.be.true;

    // More audio
    callbacks.onmessage({ data: 'audio2' });
    expect(onAudioChunk.calledTwice).to.be.true;

    // Turn completes
    callbacks.onmessage({ serverContent: { turnComplete: true } });
    expect(onTurnComplete.calledOnce).to.be.true;
  });

  it('onError is invoked with the error message string when stream error occurs', async () => {
    const onError = sinon.stub();
    await service.connect({
      onAudioChunk: () => {},
      onToolCall: () => {},
      onTurnComplete: () => {},
      onError,
    });

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
      await service.connect({
        onAudioChunk: () => {},
        onToolCall: () => {},
        onTurnComplete: () => {},
        onError: () => {},
      });
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).to.equal(connectError);
    }
  });

  it('onclose callback nullifies service.session', async () => {
    await service.connect({
      onAudioChunk: () => {},
      onToolCall: () => {},
      onTurnComplete: () => {},
      onError: () => {},
    });
    expect(service.session).to.equal(mockSession);

    const callbacks = mockLive.connect.firstCall.args[0].callbacks;
    callbacks.onclose();

    expect(service.session).to.be.null;
  });

  it('uses config.gemini.liveModel when calling live.connect', async () => {
    await service.connect({
      onAudioChunk: () => {},
      onToolCall: () => {},
      onTurnComplete: () => {},
      onError: () => {},
    });

    expect(mockLive.connect.calledOnce).to.be.true;
    const connectArg = mockLive.connect.firstCall.args[0];
    expect(connectArg).to.have.property('model');
  });

  it('onAudioChunk is not called when msg has no data', async () => {
    const onAudioChunk = sinon.stub();
    await service.connect({
      onAudioChunk,
      onToolCall: () => {},
      onTurnComplete: () => {},
      onError: () => {},
    });

    const callbacks = mockLive.connect.firstCall.args[0].callbacks;
    callbacks.onmessage({ toolCall: { functionCalls: [{ id: 'c1', name: 'test', args: {} }] } });

    expect(onAudioChunk.called).to.be.false;
  });

  it('onTurnComplete is not called when no turnComplete in message', async () => {
    const onTurnComplete = sinon.stub();
    await service.connect({
      onAudioChunk: () => {},
      onToolCall: () => {},
      onTurnComplete,
      onError: () => {},
    });

    const callbacks = mockLive.connect.firstCall.args[0].callbacks;
    callbacks.onmessage({ data: 'audio' });
    callbacks.onmessage({ toolCall: { functionCalls: [] } });
    callbacks.onmessage({ serverContent: { modelTurn: { parts: [] } } });

    expect(onTurnComplete.called).to.be.false;
  });

  it('multiple connect calls create new sessions each time', async () => {
    const secondSession = {
      sendRealtimeInput: sinon.stub().resolves(),
      sendToolResponse: sinon.stub(),
      close: sinon.stub(),
    };
    mockLive.connect.onSecondCall().resolves(secondSession);

    const opts = {
      onAudioChunk: () => {},
      onToolCall: () => {},
      onTurnComplete: () => {},
      onError: () => {},
    };

    await service.connect(opts);
    const firstSession = service.session;
    expect(mockLive.connect.calledOnce).to.be.true;

    await service.connect(opts);
    expect(mockLive.connect.calledTwice).to.be.true;
    expect(service.session).to.equal(secondSession);
    expect(service.session).to.not.equal(firstSession);
  });
});
