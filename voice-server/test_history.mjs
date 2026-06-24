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

const results = [];
let resolved = false;
const ws = new WebSocket(SERVER_URL);
const timeout = setTimeout(() => {
  if (!resolved) {
    resolved = true;
    ws.close();
    console.log('\n⚠️  TIMEOUT — no response after 35s');
    finish();
  }
}, 35000);

ws.on('open', () => {
  console.log('Connected\n');
  let off = 0;
  function sendNext() {
    if (off >= pcm16k.length) {
      ws.send(JSON.stringify({ type: 'audio_end' }));
      console.log('→ audio_end sent');
      return;
    }
    const chunk = pcm16k.slice(off, off + 8192);
    off += 8192;
    ws.send(JSON.stringify({ type: 'audio_chunk', data: chunk.toString('base64') }));
    setImmediate(sendNext);
  }
  sendNext();
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  results.push(msg);
  if (msg.type === 'audio_chunk') {
    // just counting
  } else {
    console.log('←', msg.type, JSON.stringify(msg).slice(0, 200));
  }
  if (msg.type === 'command' || msg.type === 'response' || msg.type === 'error') {
    clearTimeout(timeout);
    resolved = true;
    ws.close();
    setTimeout(finish, 500);
  }
});

ws.on('error', (e) => {
  console.log('WS Error:', e.message);
  clearTimeout(timeout);
  if (!resolved) { resolved = true; finish(); }
});

async function finish() {
  console.log('\n=== WEBSOCKET RESULTS ===');
  const nonAudio = results.filter(m => m.type !== 'audio_chunk');
  console.log(JSON.stringify(nonAudio, null, 2));
  const audioChunks = results.filter(m => m.type === 'audio_chunk').length;
  console.log('Audio chunks received:', audioChunks);

  console.log('\n=== VOICE HISTORY CHECK ===');
  try {
    const resp = await fetch('http://127.0.0.1:8080/api/voice-history');
    const hist = await resp.json();
    const last = hist[hist.length - 1];
    console.log('Last entry:');
    console.log('  timestamp:', last.timestamp);
    console.log('  status:', last.status);
    console.log('  hasInputAudio:', last.hasInputAudio);
    console.log('  hasOutputAudio:', last.hasOutputAudio);
    console.log('  latencyMs:', last.latencyMs);
    if (last.geminiResponse) console.log('  response:', JSON.stringify(last.geminiResponse, null, 2));
    if (last.transcript) console.log('  transcript:', last.transcript);

    // Replay test
    const lastIdx = hist.length - 1;
    console.log('\n=== REPLAY TEST (index ' + lastIdx + ') ===');
    const replayResp = await fetch('http://127.0.0.1:8080/api/voice-history/' + lastIdx + '/replay', { method: 'POST' });
    const replay = await replayResp.json();
    console.log('  action:', replay.action);
    console.log('  device:', replay.device);
    console.log('  value:', replay.value);
    console.log('  tts_text:', replay.tts_text);
    console.log('  has audio:', replay.tts_audio ? replay.tts_audio.length + ' chars base64' : 'no');

    // Audio endpoint
    const audioResp = await fetch('http://127.0.0.1:8080/api/voice-history/' + lastIdx + '/audio');
    const audioBuf = Buffer.from(await audioResp.arrayBuffer());
    console.log('\n=== AUDIO ENDPOINT ===');
    console.log('  Content-Type:', audioResp.headers.get('content-type'));
    console.log('  Size:', audioBuf.length, 'bytes');
    console.log('  Valid WAV:', audioBuf.length > 44 && audioBuf.slice(0, 4).toString() === 'RIFF' ? 'YES' : 'NO');
  } catch (e) {
    console.log('  Error:', e.message);
  }

  // Summary
  const success = results.some(m => m.type === 'command' || m.type === 'response');
  console.log('\n=== VERDICT ===');
  console.log(success ? '✅ PIPELINE OK' : '❌ PIPELINE FAILED');
  process.exit(0);
}
