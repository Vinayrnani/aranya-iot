import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import GeminiService from './gemini.js';
import EdgeTTSService from './edge-tts.js';

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
    entry.status = 'gemini_ok';
    entry.latencyMs = Date.now() - startTime;
    scheduleSave();
    console.log(`[PIPELINE] Gemini → [${entry.latencyMs}ms] ${JSON.stringify(sanitized)}`);

    const ttsLang = sanitized.lang || lang;
    const ttsAudio = await EdgeTTSService.synthesizeEdgeTTS(sanitized.tts_text, ttsLang);
    entry.outputAudio = ttsAudio;
    entry.ttsText = sanitized.tts_text;
    entry.ttsLang = ttsLang;
    entry.status = 'complete';
    scheduleSave();
    const audioSizeKB = (ttsAudio.length / 1024).toFixed(0);
    console.log(`[PIPELINE] TTS → ${audioSizeKB}KB audio`);

    sendFn({
      type: 'response',
      ...sanitized,
      tts_audio: ttsAudio.toString('base64')
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
          const startTime = Date.now();

          // Create history entry immediately with input audio
          const entry = {
            timestamp: new Date().toISOString(),
            inputAudio: allPcm,
            status: 'processing',
          };
          conversationHistory.push(entry);
          if (conversationHistory.length > MAX_HISTORY) conversationHistory.shift();
          scheduleSave();

          // Step 1: Process audio through Gemini
          let rawResponse;
          let sanitized;
          try {
            rawResponse = await GeminiService.processAudioWithGemini(allPcm);
            sanitized = sanitizeResponse(rawResponse);
            entry.geminiResponse = sanitized;
            entry.transcript = sanitized.tts_text;
            entry.status = 'gemini_ok';
            entry.latencyMs = Date.now() - startTime;
            scheduleSave();
            console.log(`[PIPELINE] Gemini done [${Date.now() - startTime}ms]`);
          } catch (geminiErr) {
            entry.error = 'Gemini: ' + geminiErr.message;
            entry.status = 'gemini_failed';
            scheduleSave();
            console.error('[PIPELINE] Gemini error:', geminiErr.message);
            sendToClient({ type: 'error', message: geminiErr.message });
            return;
          }

          // Step 2: Synthesize speech with Edge TTS
          try {
            const ttsLang = sanitized.lang || 'en';
            const ttsAudio = await EdgeTTSService.synthesizeEdgeTTS(sanitized.tts_text, ttsLang);
            entry.outputAudio = ttsAudio;
            entry.ttsText = sanitized.tts_text;
            entry.ttsLang = ttsLang;
            entry.status = 'complete';
            scheduleSave();
            const audioSizeKB = (ttsAudio.length / 1024).toFixed(0);
            console.log(`[PIPELINE] TTS done [${audioSizeKB}KB]`);

            console.log(`[PIPELINE] ROUNDTRIP [${Date.now() - audioEndTime}ms]`);

            sendToClient({
              type: 'response',
              ...sanitized,
              tts_audio: ttsAudio.toString('base64')
            });
          } catch (ttsErr) {
            entry.error = 'TTS: ' + ttsErr.message;
            entry.status = 'tts_failed';
            scheduleSave();
            console.error('[PIPELINE] TTS error:', ttsErr.message);

            sendToClient({
              type: 'response',
              ...sanitized,
              tts_audio: ''
            });
          }
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
  });

  ws.on('error', () => {
    connectionAlive = false;
    isRecording = false;
    sttBusy = false;
  });
}
