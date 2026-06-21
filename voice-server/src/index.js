import 'dotenv/config';
import express from 'express';
import http from 'http';
import fs from 'fs';
import { execSync } from 'child_process';
import { WebSocketServer } from 'ws';
import { handleConnection, getConversationHistory } from './ws-handler.js';
import { config } from './config.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Auto-create .env from .env.example if missing
if (!fs.existsSync('.env')) {
  console.warn('\x1b[33mNo .env file found. Creating from .env.example...\x1b[0m');
  fs.copyFileSync('.env.example', '.env');
  console.warn('\x1b[33mPlease edit .env and set your GROQ_API_KEY.\x1b[0m');
}

// Startup validation checks
if (!process.env.GROQ_API_KEY) {
  console.warn('\x1b[33mWARNING: GROQ_API_KEY is not set. Voice features will fail.');
  console.warn('Copy .env.example to .env and set GROQ_API_KEY.\x1b[0m');
}

try {
  execSync('which piper', { stdio: 'ignore' });
} catch {
  console.warn('\x1b[33mWARNING: piper binary not found. TTS will fall back to OpenAI or return silent.\x1b[0m');
}

const app = express();
const server = http.createServer(app);

// Serve static files from aranya-hub/data
app.use(express.static(join(__dirname, '../../aranya-hub/data')));

// API: conversation history (last 10)
app.get('/api/voice-history', (req, res) => {
  res.json(getConversationHistory());
});

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', handleConnection);

server.listen(config.WS_PORT || 8080, () => {
    console.log(`Voice server and Dashboard listening on port ${config.WS_PORT || 8080}`);
});
