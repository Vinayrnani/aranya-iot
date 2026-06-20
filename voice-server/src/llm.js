import Groq from 'groq-sdk';
import { config } from './config.js';

const groq = new Groq({ apiKey: config.groq.apiKey });

export async function queryLLM(transcript) {
  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: 'You are a voice assistant for an IoT system. Return JSON only: {action, device, value, tts_text}.'
      },
      { role: 'user', content: transcript }
    ],
    model: config.groq.llmModel,
    response_format: { type: 'json_object' }
  });

  return JSON.parse(completion.choices[0].message.content);
}
