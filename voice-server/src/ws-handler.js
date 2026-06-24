import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import GeminiService, { GeminiLiveService } from './gemini.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HISTORY_FILE = path.join(__dirname, '..', 'voice-history-data.json');

const MAX_HISTORY = 20;
const conversationHistory = [];

const MAX_LLM_PER_MIN = 30;
const llmTimestamps = [];

const VALID_DEVICES = ['ac', 'blinds', 'light', 'led', 'scene'];
const VALID_ACTIONS = ['turn_on', 'turn_off', 'set', 'open', 'close', 'toggle', 'none'];
const VALID_LANGS = ['en', 'hi', 'te'];

export function sanitizeResponse(response) {
  if (!response || typeof response !== 'object') {
    return { action: 'none', device: '', value: '', tts_text: 'Sorry, I did not understand.', lang: 'en' };
  }
  const out = { ...response };
  if (!VALID_ACTIONS.includes(out.action)) out.action = 'none';
  if (!VALID_DEVICES.includes(out.device)) out.device = '';
  if (out.value === null || out.value === undefined || out.value === 'null' || String(out.value).toLowerCase() === 'none') {
    out.value = '';
  } else {
    out.value = String(out.value);
  }
  if (!out.tts_text || typeof out.tts_text !== 'string') out.tts_text = 'Sorry, I did not understand.';
  if (!VALID_LANGS.includes(out.lang)) out.lang = 'en';
  return out;
}

// ---- History Persistence ----

let saveTimer = null;
let saveScheduled = false;

function serializeEntry(entry) {
  const cloned = { ...entry };
  if (cloned.inputAudio && Buffer.isBuffer(cloned.inputAudio)) {
    cloned.inputAudio = { _type: 'Buffer', data: cloned.inputAudio.toString('base64') };
  }
  if (cloned.outputAudio && Buffer.isBuffer(cloned.outputAudio)) {
    cloned.outputAudio = { _type: 'Buffer', data: cloned.outputAudio.toString('base64') };
  }
  return cloned;
}

function deserializeEntry(entry) {
  const cloned = { ...entry };
  if (cloned.inputAudio && cloned.inputAudio._type === 'Buffer') {
    cloned.inputAudio = Buffer.from(cloned.inputAudio.data, 'base64');
  }
  if (cloned.outputAudio && cloned.outputAudio._type === 'Buffer') {
    cloned.outputAudio = Buffer.from(cloned.outputAudio.data, 'base64');
  }
  return cloned;
}

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        conversationHistory.length = 0;
        for (const entry of data) {
          conversationHistory.push(deserializeEntry(entry));
        }
        console.log(`[HISTORY] Loaded ${conversationHistory.length} entries from disk`);
      }
    }
  } catch (err) {
    console.error('[HISTORY] Failed to load history:', err.message);
  }
}

function scheduleSave() {
  if (saveScheduled) return;
  saveScheduled = true;
  saveTimer = setTimeout(() => {
    try {
      const serialized = conversationHistory.map(serializeEntry);
      fs.writeFileSync(HISTORY_FILE, JSON.stringify(serialized, null, 2), 'utf-8');
      console.log(`[HISTORY] Saved ${conversationHistory.length} entries to disk`);
    } catch (err) {
      console.error('[HISTORY] Failed to save history:', err.message);
    } finally {
      saveScheduled = false;
      saveTimer = null;
    }
  }, 500);
}

// Load persisted history on module init
loadHistory();

function llmRateAllowed() {
  const now = Date.now();
  while (llmTimestamps.length && now - llmTimestamps[0] > 60000) {
    llmTimestamps.shift();
  }
  if (llmTimestamps.length >= MAX_LLM_PER_MIN) return false;
  llmTimestamps.push(now);
  return true;
}

export function getConversationHistory() {
  return conversationHistory.map(({ outputAudio, inputAudio, ...rest }) => ({
    ...rest,
    hasOutputAudio: !!outputAudio,
    hasInputAudio: !!inputAudio
  }));
}

export function getConversationAudio(index) {
  const entry = conversationHistory[index];
  if (!entry) return null;
  return {
    outputAudio: entry.outputAudio || null,
    inputAudio: entry.inputAudio || null
  };
}

async function processTextInput(text, lang, sendFn) {
  const startTime = Date.now();
  if (!llmRateAllowed()) {
    sendFn({
      type: 'error',
      message: 'Rate limit: too many requests. Please wait a moment.',
    });
    return;
  }

  console.log(`[PIPELINE] TEXT INPUT → "${text}" (lang=${lang})`);

  const entry = {
    timestamp: new Date().toISOString(),
    input: text,
    status: 'processing',
  };
  conversationHistory.push(entry);
  if (conversationHistory.length > MAX_HISTORY) conversationHistory.shift();
  scheduleSave();

  try {
    const response = await GeminiService.processTextWithGemini(text);
    const sanitized = sanitizeResponse(response);
    entry.geminiResponse = sanitized;
    entry.transcript = sanitized.tts_text;
    entry.status = 'complete';
    entry.latencyMs = Date.now() - startTime;
    scheduleSave();
    console.log(`[PIPELINE] Gemini → [${entry.latencyMs}ms] ${JSON.stringify(sanitized)}`);

    sendFn({
      type: 'response',
      ...sanitized,
      tts_audio: ''
    });
  } catch (err) {
    entry.error = err.message;
    entry.status = 'failed';
    scheduleSave();
    console.error('[PIPELINE] Error:', err.message);
    sendFn({ type: 'error', message: err.message });
  }
}

export function handleConnection(ws) {
  let inputAudioChunks = [];
  let connectionAlive = true;
  let isRecording = false;
  let sttBusy = false;
  let liveService = null;

  function sendToClient(msg) {
    if (connectionAlive) {
      try { ws.send(JSON.stringify(msg)); } catch (_) {}
    }
  }

  ws.on('message', (data) => {
    if (!connectionAlive) return;
    handleMessage(JSON.parse(data));
  });

  async function handleMessage(message) {
    try {
      if (message.type === 'audio_chunk') {
        if (!isRecording) {
          isRecording = true;
          inputAudioChunks = [];
        }
        inputAudioChunks.push(Buffer.from(message.data, 'base64'));
        return;
      }

      if (message.type === 'audio_end') {
        if (!isRecording) {
          sendToClient({ type: 'error', message: 'No audio received' });
          return;
        }

        if (sttBusy) {
          sendToClient({ type: 'error', message: 'STT busy processing previous request' });
          return;
        }

        if (!llmRateAllowed()) {
          isRecording = false;
          sendToClient({ type: 'error', message: 'Rate limit: too many requests. Please wait a moment.' });
          return;
        }

        isRecording = false;
        sttBusy = true;
        const audioEndTime = Date.now();
        const allChunks = inputAudioChunks;
        inputAudioChunks = [];

        console.log(`[PIPELINE] audio_end — ${allChunks.length} chunks`);

        try {
          const allPcm = Buffer.concat(allChunks);

          // Create history entry immediately with input audio
          const entry = {
            timestamp: new Date().toISOString(),
            inputAudio: allPcm,
            status: 'processing',
          };
          conversationHistory.push(entry);
          if (conversationHistory.length > MAX_HISTORY) conversationHistory.shift();
          scheduleSave();

          // Split PCM into chunks for streaming (8192 bytes each)
          const CHUNK_SIZE = 8192;
          const pcmChunks = [];
          for (let i = 0; i < allPcm.length; i += CHUNK_SIZE) {
            pcmChunks.push(allPcm.slice(i, i + CHUNK_SIZE));
          }

          // Stream audio via Gemini Live API with function calling
          const audioChunks = [];
          let sanitized;
          try {
            const live = new GeminiLiveService();
            liveService = live;
            const modelTextParts = [];
            const response = await new Promise((resolve, reject) => {
              let resolved = false;
              let commandResult = null;

              live.connect({
                onAudioChunk: (base64Pcm) => {
                  audioChunks.push(Buffer.from(base64Pcm, 'base64'));
                  sendToClient({ type: 'audio_chunk', data: base64Pcm });
                },
                onToolCall: (functionCalls) => {
                  for (const call of functionCalls) {
                    if (call.name === 'control_device') {
                      const args = call.args || {};
                      console.log('[PIPELINE] Device command:', JSON.stringify(args));

                      // Send tool response back so model continues generating audio
                      live.sendToolResponse([{
                        id: call.id,
                        name: call.name,
                        response: { result: 'success' },
                      }]);

                      // Build command result for frontend
                      commandResult = {
                        action: String(args.action || 'none'),
                        device: String(args.device || ''),
                        value: args.value !== undefined && args.value !== null ? String(args.value) : '',
                        tts_text: '',
                        lang: 'en',
                      };

                      // Send command to frontend immediately
                      sendToClient({ type: 'command', data: commandResult });
                    }
                  }
                },
                onModelText: (text) => {
                  modelTextParts.push(text);
                },
                onTurnComplete: () => {
                  if (!resolved) {
                    resolved = true;
                    const modelText = modelTextParts.join(' ');
                    if (commandResult) {
                      // Preserve model's spoken text even when tool was called
                      commandResult.tts_text = modelText || commandResult.tts_text;
                      resolve(commandResult);
                    } else {
                      resolve({
                        action: 'none',
                        device: '',
                        value: '',
                        tts_text: modelText || '',
                        lang: 'en',
                      });
                    }
                  }
                },
                onError: (errMsg) => {
                  if (!resolved) { resolved = true; reject(new Error(errMsg)); }
                },
                }).then(() => {
                  // Connected — send chunks.
                  (async () => {
                    for (let i = 0; i < pcmChunks.length; i++) {
                      const chunk = pcmChunks[i];
                      live.sendAudio(chunk.toString('base64'));
                      await new Promise(r => setTimeout(r, 100)); // Increased interval
                    }
                    console.log('[PIPELINE] All audio sent, signaling endOfTurn');
                    await live.sendEndOfTurn();
                  })();
                }).catch((err) => {
                if (!resolved) { resolved = true; reject(err); }
              });

              // Safety timeout: 30s
              setTimeout(() => {
                if (!resolved) {
                  resolved = true;
                  resolve(commandResult || {
                    action: 'none',
                    device: '',
                    value: '',
                    tts_text: '',
                    lang: 'en',
                  });
                }
              }, 30000);
            });

            sanitized = sanitizeResponse(response);
            entry.geminiResponse = sanitized;
            entry.transcript = sanitized.tts_text || '(voice response)';
            entry.status = 'complete';
            entry.outputAudio = audioChunks.length > 0 ? Buffer.concat(audioChunks) : null;
            entry.latencyMs = Date.now() - audioEndTime;
            scheduleSave();
            console.log(`[PIPELINE] Gemini Live done [${entry.latencyMs}ms]`);
          } catch (liveErr) {
            entry.error = 'Gemini Live: ' + liveErr.message;
            entry.status = 'failed';
            scheduleSave();
            console.error('[PIPELINE] Gemini Live error:', liveErr.message);
            sendToClient({ type: 'error', message: liveErr.message });
            return;
          } finally {
            if (liveService) { liveService.close(); liveService = null; }
          }

          sendToClient({
            type: 'response',
            ...sanitized,
            tts_audio: ''
          });
        } catch (err) {
          console.error('[PIPELINE] Error:', err.message);
          sendToClient({ type: 'error', message: err.message });
        } finally {
          sttBusy = false;
        }
        return;
      }

      if (message.type === 'transcript') {
        const transcript = message.text;
        console.log(`[PIPELINE] INPUT → "${transcript}" (lang=${message.lang || 'none'})`);
        await processTextInput(transcript, message.lang || 'en', sendToClient);
        return;
      }
    } catch (error) {
      console.error('[PIPELINE] ERROR:', error);
      sendToClient({ type: 'error', message: error.message });
      isRecording = false;
      sttBusy = false;
    }
  }

  ws.on('close', () => {
    connectionAlive = false;
    isRecording = false;
    sttBusy = false;
    if (liveService) { liveService.close(); liveService = null; }
  });

  ws.on('error', () => {
    connectionAlive = false;
    isRecording = false;
    sttBusy = false;
    if (liveService) { liveService.close(); liveService = null; }
  });
}
