import { transcribeAudio } from './stt.js';
import { queryLLM } from './llm.js';
import { synthesize } from './tts.js';

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
        console.log(`[PIPELINE] DONE → ${(ttsAudio.length / 1024).toFixed(0)}KB audio`);

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
