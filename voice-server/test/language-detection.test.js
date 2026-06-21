import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

// Longer timeout for API calls
const TEST_TIMEOUT = 20000;

function sendAudioFile(fileName) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(FIXTURES_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      reject(new Error(`Fixture not found: ${filePath}`));
      return;
    }

    const audioBuf = fs.readFileSync(filePath);
    const b64 = audioBuf.toString('base64');
    const ws = new WebSocket('ws://127.0.0.1:8080/ws');

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('WebSocket timeout'));
    }, TEST_TIMEOUT);

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'audio', data: b64 }));
    });

    ws.on('message', (data) => {
      clearTimeout(timeout);
      try {
        const msg = JSON.parse(data.toString());
        ws.close();
        resolve(msg);
      } catch (e) {
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

describe('STT Language Detection (verbose_json)', function () {
  this.timeout(TEST_TIMEOUT * 3);

  it('should detect English audio as lang=en', async () => {
    const msg = await sendAudioFile('test_en.wav');
    expect(msg).to.have.property('type', 'response');
    expect(msg).to.have.property('lang');
    expect(msg.lang).to.equal('en');
  });

  it('should detect Hindi audio as lang=hi', async () => {
    const msg = await sendAudioFile('test_hi.wav');
    expect(msg).to.have.property('type', 'response');
    expect(msg).to.have.property('lang');
    expect(msg.lang).to.equal('hi');
  });

  it('should include tts_audio in response', async () => {
    const msg = await sendAudioFile('test_en.wav');
    expect(msg).to.have.property('tts_audio');
    expect(msg.tts_audio.length).to.be.greaterThan(100);
  });

  it('should include tts_text in response', async () => {
    const msg = await sendAudioFile('test_en.wav');
    expect(msg).to.have.property('tts_text');
    expect(msg.tts_text.length).to.be.greaterThan(0);
  });
});
