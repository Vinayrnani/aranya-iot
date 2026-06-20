// Environment variable placeholders for voice-server
// Copy .env.example to .env and fill in values

export const config = {
  // WebSocket server port
  wsPort: process.env.WS_PORT || 8080,

  // Groq API configuration
  groq: {
    apiKey: process.env.GROQ_API_KEY || "",
    sttModel: process.env.GROQ_STT_MODEL || "whisper-large-v3-turbo",
    llmModel: process.env.GROQ_LLM_MODEL || "llama-3.3-70b-versatile",
    ttsModel: process.env.GROQ_TTS_MODEL || "playai-tts",
  },
};
