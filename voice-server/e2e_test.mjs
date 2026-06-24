import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = '/root/projects/aranya-iot/voice-server';
const FIXTURES_DIR = path.join(PROJECT_DIR, 'test', 'fixtures');

// --- Resample utility ---
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

// --- WebSocket test function ---
async function testAudio(fileName, label) {
  const filePath = path.join(FIXTURES_DIR, fileName);
  if (!fs.existsSync(filePath)) return { label, result: 'MISSING' };

  const wavBuf = fs.readFileSync(filePath);
  const pcm16k = resampleTo16k(wavBuf);
  const totalChunks = Math.ceil(pcm16k.length / 8192);
  console.log(`[${label}] Sending ${totalChunks} chunks (${pcm16k.length} bytes PCM)`);

  return new Promise((resolve) => {
    const ws = new WebSocket('ws://127.0.0.1:18080/ws');
    const received = [];
    let audioChunkBytes = 0;
    const timeout = setTimeout(() => {
      ws.close();
      resolve({ label, result: 'TIMEOUT', received, audioChunkBytes });
    }, 90000);

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
        setTimeout(sendNext, 30);
      }
      sendNext();
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      received.push(msg);
      if (msg.type === 'audio_chunk') {
        const size = Buffer.from(msg.data, 'base64').length;
        audioChunkBytes += size;
      } else if (msg.type === 'command') {
        // Device command from toolCall — resolve with the command data
        clearTimeout(timeout);
        ws.close();
        resolve({ label, result: 'COMMAND', command: msg.data, audioChunkBytes, chunks: received.filter(m => m.type === 'audio_chunk').length });
      } else if (msg.type === 'response') {
        clearTimeout(timeout);
        ws.close();
        resolve({ label, result: 'RESPONSE', response: msg, audioChunkBytes, chunks: received.filter(m => m.type === 'audio_chunk').length });
      } else if (msg.type === 'error') {
        clearTimeout(timeout);
        ws.close();
        resolve({ label, result: 'ERROR', error: msg.message, received });
      }
    });
    ws.on('error', (e) => {
      clearTimeout(timeout);
      resolve({ label, result: 'WS_ERROR', error: e.message });
    });
  });
}

// --- Replay test ---
async function testReplay() {
  // First, get history
  try {
    const resp = await fetch('http://127.0.0.1:18080/api/voice-history');
    const history = await resp.json();
    if (!history || history.length === 0) {
      return { result: 'NO_HISTORY' };
    }
    const lastIdx = history.length - 1;
    const entry = history[lastIdx];
    // POST replay
    const replayResp = await fetch(`http://127.0.0.1:18080/api/voice-history/${lastIdx}/replay`, { method: 'POST' });
    const replayResult = await replayResp.json();
    return { result: 'REPLAY_OK', entry, replayResult, index: lastIdx };
  } catch (e) {
    return { result: 'REPLAY_ERROR', error: e.message };
  }
}

// --- Main ---
async function main() {
  // Start server on port 18080 to avoid conflicts
  const env = { ...process.env, WS_PORT: '18080' };
  const server = spawn('node', ['src/index.js'], {
    cwd: PROJECT_DIR,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Wait for server to be ready
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server start timeout')), 10000);
    server.stdout.on('data', (data) => {
      const text = data.toString();
      console.log('[SERVER]', text.trim());
      if (text.includes('listening on port')) {
        clearTimeout(timeout);
        setTimeout(resolve, 500); // extra settling time
      }
    });
    server.stderr.on('data', (data) => {
      console.error('[SERVER-ERR]', data.toString().trim());
    });
    server.on('error', (e) => { clearTimeout(timeout); reject(e); });
  });

  console.log('\n========================================');
  console.log('  E2E VOICE PIPELINE TEST');
  console.log('========================================\n');

  // Test English
  const en = await testAudio('test_en.wav', 'ENGLISH');
  console.log(`[${en.label}] => ${en.result}`, en.response || en.error || '');

  // Test Hindi (if first succeeded)
  let hi = null;
  if (en.result === 'RESPONSE') {
    hi = await testAudio('test_hi.wav', 'HINDI');
    console.log(`[${hi.label}] => ${hi.result}`, hi.response || hi.error || '');
  }

  // Test Telugu (if second succeeded)
  let te = null;
  if (hi && hi.result === 'RESPONSE') {
    te = await testAudio('test_te.wav', 'TELUGU');
    console.log(`[${te.label}] => ${te.result}`, te.response || te.error || '');
  }

  // Test replay
  if (en.result === 'RESPONSE' || en.result === 'COMMAND') {
    console.log('\n--- REPLAY TEST ---');
    const replay = await testReplay();
    console.log(`[REPLAY] => ${replay.result}`, replay.replayResult || replay.error || '');
  }

  // Summary
  console.log('\n========================================');
  console.log('  SUMMARY');
  console.log('========================================');
  const results = [en, hi, te].filter(Boolean);
  for (const r of results) {
    if (r.result === 'RESPONSE') {
      console.log(`✅ ${r.label}: lang=${r.response.lang}, action=${r.response.action}, device=${r.response.device}, chunks=${r.chunks}, audioBytes=${r.audioChunkBytes}`);
    } else if (r.result === 'COMMAND') {
      console.log(`✅ ${r.label}: action=${r.command.action}, device=${r.command.device}, value=${r.command.value}, chunks=${r.chunks}, audioBytes=${r.audioChunkBytes}`);
    } else {
      console.log(`❌ ${r.label}: ${r.result} ${r.error || ''}`);
    }
  }

  // Cleanup
  server.kill();
  console.log('\nServer stopped.');
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
