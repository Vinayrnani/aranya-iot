// Environment variable placeholders for voice-server
// Copy .env.example to .env and fill in values

export const config = {
  // WebSocket server port
  wsPort: process.env.WS_PORT || 8080,

  // Gemini API configuration
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || "",
    model: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
    liveModel: process.env.GEMINI_LIVE_MODEL || "gemini-3-flash-live",
  },
};
