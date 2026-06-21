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
 * Get the conversation history array (read-only snapshot).
 * @returns {Array<{timestamp: string, input: string, llm: Object, ttsLang: string, ttsText: string, audioSize: number}>}
 */
export function getConversationHistory() {
  return conversationHistory.slice();
}

// ================================================================
// WebSocket Handler
// ================================================================

export function handleConnection(ws) {
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);
      let transcript;
      if (message.type === 'audio') {
        transcript = await transcribeAudio(Buffer.from(message.data, 'base64'));
        console.log(`[PIPELINE] STT → "${transcript}"`);
      } else if (message.type === 'transcript') {
        transcript = message.text;
        console.log(`[PIPELINE] INPUT → "${transcript}" (lang=${message.lang || 'none'})`);
      }

      if (transcript) {
        const response = await queryLLM(transcript);
        console.log(`[PIPELINE] LLM →`, JSON.stringify(response));

        const ttsLang = response.lang || message.lang || 'en';
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
          audioSizeKB: Number(audioSizeKB)
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
