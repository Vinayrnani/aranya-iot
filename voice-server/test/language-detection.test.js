import { describe, it } from 'mocha';
import { expect } from 'chai';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

const TEST_TIMEOUT = 60000;

function resampleTo16k(wavBuf) {
  const pcm16 = wavBuf.slice(44); // skip WAV header
  const srcRate = 22050;
  const dstRate = 16000;
  const ratio = srcRate / dstRate;
  const srcSamples = Math.floor(pcm16.length / 2);
  const outLen = Math.floor(srcSamples / ratio);
  const out = Buffer.alloc(outLen * 2);
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const a = pcm16.readInt16LE(idx * 2);
    const b = (idx + 1) < srcSamples ? pcm16.readInt16LE((idx + 1) * 2) : a;
    out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(a + (b - a) * frac))), i * 2);
  }
  return out;
}

function sendAudioStream(fileName) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(FIXTURES_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      reject(new Error(`Fixture not found: ${filePath}`));
      return;
    }

    const wavBuf = fs.readFileSync(filePath);
    const pcm16k = resampleTo16k(wavBuf);
    const ws = new WebSocket('ws://127.0.0.1:8080/ws');

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('WebSocket timeout'));
    }, TEST_TIMEOUT);

    ws.on('open', () => {
      let off = 0;
      function sendNext() {
        if (off >= pcm16k.length) {
          ws.send(JSON.stringify({ type: 'audio_end' }));
          return;
        }
        const chunk = pcm16k.slice(off, off + 8192);
        off += 8192;
        ws.send(JSON.stringify({ type: 'audio_chunk', data: chunk.toString('base64') }));
        setTimeout(sendNext, 50);
      }
      sendNext();
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'response' || msg.type === 'error') {
          clearTimeout(timeout);
          ws.close();
          resolve(msg);
        }
      } catch (e) {
        clearTimeout(timeout);
        ws.close();
        reject(e);
      }
    });

    ws.on('error', (e) => {
      clearTimeout(timeout);
      reject(e);
    });
  });
}

describe('Gemini Voice Pipeline Language Detection', function () {
  this.timeout(TEST_TIMEOUT);

  it('should detect English audio as lang=en', async () => {
    const msg = await sendAudioStream('test_en.wav');
    expect(msg).to.have.property('type', 'response');
    expect(msg).to.have.property('lang');
    expect(msg.lang).to.equal('en');
  });

  it('should detect Hindi audio as lang=hi', async () => {
    const msg = await sendAudioStream('test_hi.wav');
    expect(msg).to.have.property('type', 'response');
    expect(msg).to.have.property('lang');
    expect(msg.lang).to.equal('hi');
  });

  it('should detect Telugu audio as lang=te', async () => {
    const msg = await sendAudioStream('test_te.wav');
    expect(msg).to.have.property('type', 'response');
    expect(msg).to.have.property('lang');
    expect(msg.lang).to.equal('te');
  });

  it('should include tts_audio in response', async () => {
    const msg = await sendAudioStream('test_en.wav');
    expect(msg).to.have.property('tts_audio');
    // With Gemini Live API, TTS audio is streamed as audio_chunk messages, not in the response
    expect(msg.tts_audio).to.equal('');
  });

  it('should include tts_text in response', async () => {
    const msg = await sendAudioStream('test_en.wav');
    expect(msg).to.have.property('tts_text');
    expect(msg.tts_text.length).to.be.greaterThan(0);
  });
});
