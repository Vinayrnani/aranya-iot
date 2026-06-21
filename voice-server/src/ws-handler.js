import { transcribeAudio } from './stt.js';
import { queryLLM } from './llm.js';
import { synthesize } from './tts.js';

// ================================================================
// Conversation History (last 10)
// ================================================================

const MAX_HISTORY = 10;
const conversationHistory = [];

function addToHistory(entry) {
  conversationHistory.push(entry);
  if (conversationHistory.length > MAX_HISTORY) {
    conversationHistory.shift();
  }
}

/**
 * Get the conversation history array (read-only snapshot, no audio buffers).
 * @returns {Array<{timestamp, input, llm, ttsLang, ttsText, audioSizeKB}>}
 */
export function getConversationHistory() {
  return conversationHistory.map(({ outputAudio, inputAudio, ...rest }) => ({
    ...rest,
    hasOutputAudio: !!outputAudio,
    hasInputAudio: !!inputAudio
  }));
}

/**
 * Get the output audio buffer for a history entry.
 * @param {number} index
 * @returns {{ outputAudio: Buffer|null, inputAudio: Buffer|null }|null}
 */
export function getConversationAudio(index) {
  const entry = conversationHistory[index];
  if (!entry) return null;
  return {
    outputAudio: entry.outputAudio || null,
    inputAudio: entry.inputAudio || null
  };
}

// ================================================================
// WebSocket Handler
// ================================================================

export function handleConnection(ws) {
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);
      let transcript;
      let inputAudioBuffer = null;
      let sttLang = null;
      if (message.type === 'audio') {
        inputAudioBuffer = Buffer.from(message.data, 'base64');
        const sttResult = await transcribeAudio(inputAudioBuffer);
        transcript = sttResult.text;
        sttLang = sttResult.language;
        console.log(`[PIPELINE] STT → "${transcript}" (detected=${sttLang})`);
      } else if (message.type === 'transcript') {
        transcript = message.text;
        console.log(`[PIPELINE] INPUT → "${transcript}" (lang=${message.lang || 'none'})`);
      }

      if (transcript) {
        const response = await queryLLM(transcript);
        console.log(`[PIPELINE] LLM →`, JSON.stringify(response));

        const ttsLang = sttLang || response.lang || message.lang || 'en';
        console.log(`[PIPELINE] TTS  → lang=${ttsLang} text="${response.tts_text}"`);

        const ttsAudio = await synthesize(response.tts_text, ttsLang);
        const audioSizeKB = (ttsAudio.length / 1024).toFixed(0);
        console.log(`[PIPELINE] DONE → ${audioSizeKB}KB audio`);

        addToHistory({
          timestamp: new Date().toISOString(),
          input: transcript,
          llm: response,
          ttsLang,
          ttsText: response.tts_text,
          audioSizeKB: Number(audioSizeKB),
          outputAudio: ttsAudio,
          inputAudio: inputAudioBuffer
        });

        ws.send(JSON.stringify({ 
          type: 'response', 
          ...response, 
          tts_audio: ttsAudio.toString('base64') 
        }));
      }
    } catch (error) {
      console.error('[PIPELINE] ERROR:', error);
      ws.send(JSON.stringify({ type: 'error', message: error.message }));
    }
  });
}
