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
      } else if (message.type === 'transcript') {
        transcript = message.text;
      }

      if (transcript) {
        const response = await queryLLM(transcript);
        const ttsAudio = await synthesize(response.tts_text, message.lang || 'en');
        ws.send(JSON.stringify({ 
          type: 'response', 
          ...response, 
          tts_audio: ttsAudio.toString('base64') 
        }));
      }
    } catch (error) {
      console.error('WS Handler Error:', error);
      ws.send(JSON.stringify({ type: 'error', message: error.message }));
    }
  });
}
