// Check what type the SDK sends for audio data
import WebSocket from 'ws';
import fs from 'fs';

const FIXTURE = new URL('test/fixtures/test_en.wav', import.meta.url);
const SERVER_URL = 'ws://127.0.0.1:8080/ws';

function resampleTo16k(wavBuf) {
  const pcm16 = wavBuf.slice(44);
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

const wavBuf = fs.readFileSync(FIXTURE);
const pcm16k = resampleTo16k(wavBuf);

let resolved = false;
const ws = new WebSocket(SERVER_URL);

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
    setImmediate(sendNext);
  }
  sendNext();
});

let chunkCount = 0;
let firstChunkType = null;

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === 'audio_chunk') {
    chunkCount++;
    if (chunkCount === 1) {
      firstChunkType = typeof msg.data;
      const isStr = typeof msg.data === 'string';
      const startsWithB64 = isStr ? msg.data.substring(0, 20) : 'N/A';
      const isObj = msg.data !== null && typeof msg.data === 'object';
      console.log('FIRST audio_chunk:');
      console.log('  typeof msg.data:', typeof msg.data);
      console.log('  is string:', isStr);
      console.log('  starts with:', startsWithB64);
      console.log('  is object:', isObj);
      if (isObj) {
        console.log('  keys:', Object.keys(msg.data));
        console.log('  has type:', msg.data?._type || msg.data?.type || 'no');
        console.log('  data length:', msg.data?.data?.length || 'no');
      }
      console.log('  JSON str length:', JSON.stringify(msg).length);
    }
  }
  if (msg.type === 'response' || msg.type === 'error') {
    resolved = true;
    ws.close();
    console.log(`\nTotal audio_chunks: ${chunkCount}`);
    console.log('Final msg:', msg.type, JSON.stringify(msg).slice(0, 200));
    process.exit(0);
  }
});

ws.on('error', (e) => {
  console.log('WS Error:', e.message);
  process.exit(1);
});

setTimeout(() => {
  console.log('TIMEOUT');
  process.exit(1);
}, 35000);
