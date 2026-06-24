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
console.log('Fixture: test_en.wav');
console.log('PCM 16kHz:', pcm16k.length, 'bytes');

// Browser uses CHUNK_FRAMES=4096 at 16kHz -> 4096*2 = 8192 bytes per chunk, every ~256ms
const CHUNK_SIZE = 8192;  // 4096 frames * 2 bytes per sample

let resolved = false;
const ws = new WebSocket(SERVER_URL);
let startTime;
let chunkCount = 0;
const results = [];

ws.on('open', () => {
  console.log('Connected');
  startTime = Date.now();
  let offset = 0;

  function sendNext() {
    if (offset >= pcm16k.length) {
      // Send audio_end like browser
      ws.send(JSON.stringify({ type: 'audio_end' }));
      const endTime = Date.now();
      console.log(`→ audio_end sent after ${endTime - startTime}ms (${chunkCount} chunks)`);
      return;
    }
    const chunk = pcm16k.slice(offset, offset + CHUNK_SIZE);
    offset += CHUNK_SIZE;
    chunkCount++;
    ws.send(JSON.stringify({ type: 'audio_chunk', data: chunk.toString('base64') }));
    // Browser sends chunks every ~256ms (4096 frames @ 16kHz)
    setTimeout(sendNext, 256);
  }
  sendNext();
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  results.push(msg);
  if (msg.type === 'audio_chunk') {
    // just counting
  } else {
    const elapsed = Date.now() - startTime;
    console.log(`← [${elapsed}ms] ${msg.type}:`, JSON.stringify(msg).slice(0, 150));
  }
  if (msg.type === 'response' || msg.type === 'error') {
    resolved = true;
    ws.close();
    setTimeout(finish, 500);
  }
});

ws.on('error', (e) => {
  console.log('WS Error:', e.message);
  if (!resolved) { resolved = true; finish(); }
});

const timeout = setTimeout(() => {
  if (!resolved) {
    resolved = true;
    console.log('\n⚠️ TIMEOUT — no response after 35s');
    finish();
  }
}, 35000);

async function finish() {
  const audioChunks = results.filter(m => m.type === 'audio_chunk').length;
  const totalTime = Date.now() - startTime;
  console.log(`\n=== RESULTS (${totalTime}ms total) ===`);
  console.log('Audio chunks received:', audioChunks);
  const nonAudio = results.filter(m => m.type !== 'audio_chunk');
  console.log('Messages:', JSON.stringify(nonAudio, null, 2));

  const success = results.some(m => m.type === 'response');
  console.log('\n=== VERDICT ===');
  console.log(success ? '✅ PIPELINE OK' : `❌ PIPELINE FAILED (received types: ${[...new Set(results.map(m=>m.type))].join(', ') || 'none'})`);
  process.exit(0);
}
