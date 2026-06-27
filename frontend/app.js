/**
 * Viva Voice - Main Application
 *
 * Ties together the Gemini Live API client, audio capture/playback,
 * and the user interface for a multilingual conversational AI PWA.
 */

const app = {
  // Core modules
  client: null,
  capture: null,
  player: null,
  recorder: null,

  // State
  state: 'idle', // idle | connecting | connected | speaking | listening | error
  language: 'en',
  isMicOn: false,
  conversation: [],
  sessionToken: null,

  // DOM element references (set in init)
  els: {},
};

/**
 * Initialize the application.
 */
app.init = async function () {
  // Cache DOM elements
  this.els = {
    statusDot: document.getElementById('status-dot'),
    statusText: document.getElementById('status-text'),
    transcript: document.getElementById('transcript'),
    transcriptList: document.getElementById('transcript-list'),
    transcriptEmpty: document.getElementById('transcript-empty'),
    micBtn: document.getElementById('mic-btn'),
    micIcon: document.getElementById('mic-icon'),
    connectBtn: document.getElementById('connect-btn'),
    langBtns: document.querySelectorAll('.lang-btn'),
    langIndicator: document.getElementById('lang-indicator'),
    settingsPanel: document.getElementById('settings-panel'),
    settingsToggle: document.getElementById('settings-toggle'),
    voiceSelect: document.getElementById('voice-select'),
    settingsBackdrop: document.getElementById('settings-backdrop'),
    errorToast: document.getElementById('error-toast'),
    errorMessage: document.getElementById('error-message'),
    pwaInstall: document.getElementById('pwa-install'),
  };

  // Create core instances
  this.client = new GeminiLiveClient();
  this.capture = new AudioCapture();
  this.player = new AudioPlayer();
  this.recorder = new ConversationRecorder();

  // Expose for E2E export: app.recorder.exportAllToServer()
  window.__recorder = this.recorder;

  // Bind events
  this._bindEvents();

  // Check for PWA install prompt
  this._setupPWAInstall();

  // Update status
  this._setStatus('idle', 'Ready');
};

/**
 * Bind all UI event handlers.
 */
app._bindEvents = function () {
  // Connect button
  this.els.connectBtn.addEventListener('click', () => this._toggleConnection());

  // Mic button
  this.els.micBtn.addEventListener('click', () => this._toggleMic());

  // Language buttons
  this.els.langBtns.forEach((btn) => {
    btn.addEventListener('click', () => this._setLanguage(btn.dataset.lang));
  });

  // Settings toggle
  this.els.settingsToggle.addEventListener('click', () => {
    this._toggleSettings();
  });

  // Settings backdrop click to close
  if (this.els.settingsBackdrop) {
    this.els.settingsBackdrop.addEventListener('click', () => {
      this._closeSettings();
    });
  }

  // Settings handle drag indicator click to close
  const handle = this.els.settingsPanel?.querySelector('.settings-handle');
  if (handle) {
    handle.addEventListener('click', () => {
      this._closeSettings();
    });
  }

  // Voice selector
  this.els.voiceSelect.addEventListener('change', (e) => {
    if (this.client) {
      this.client.setVoice(e.target.value);
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Space bar to toggle mic (when not typing in an input)
    if (e.code === 'Space' && !e.target.matches('input, textarea, select')) {
      e.preventDefault();
      if (this.state === 'connected' || this.state === 'listening' || this.state === 'speaking') {
        this._toggleMic();
      }
    }
  });
};

/**
 * Set the active language.
 */
app._setLanguage = function (langCode) {
  this.language = langCode;

  const langNames = { en: 'English', hi: 'हिन्दी', te: 'తెలుగు' };
  const shortNames = { en: 'EN', hi: 'HI', te: 'TE' };

  // Update button styles
  this.els.langBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === langCode);
  });

  // Update indicator
  if (this.els.langIndicator) {
    this.els.langIndicator.textContent = shortNames[langCode] || langCode;
  }

  // Update document lang
  document.documentElement.lang = langCode;

  console.log(`Language set to ${langNames[langCode] || langCode}`);
};

/**
 * Toggle WebSocket connection to Gemini Live API.
 */
app._toggleConnection = async function () {
  if (this.state === 'connected') {
    await this._disconnect();
    return;
  }

  if (this.state === 'connecting') return;

  await this._connect();
};

/**
 * Connect to Gemini Live API.
 */
app._connect = async function () {
  this._setStatus('connecting', 'Connecting...');
  this.els.connectBtn.disabled = true;
  this.els.connectBtn.textContent = 'Connecting...';

  try {
    // Fetch ephemeral token from our backend
    const tokenData = await this.client.fetchToken();

    // Apply voice setting
    this.client.setVoice(this.els.voiceSelect?.value || 'Kore');

    // Set up callbacks
    this.client.onConnected = () => {
      console.log('WebSocket connected');
    };

    this.client.onSetupComplete = () => {
      console.log('Live session ready');
    };

    this.client.onAudioReceived = (base64PCM) => {
      this.player.play(base64PCM);
      this.recorder.addOutputAudio(base64PCM);
    };

    this.client.onInputTranscription = (text) => {
      this._addMessage('user', text);
      this.recorder.setInputTranscript(text);
    };

    this.client.onOutputTranscription = (text) => {
      this._addMessage('ai', text);
      this.recorder.setOutputTranscript(text);
    };

    this.client.onInterrupted = () => {
      this.player.clearQueue();
      this.recorder.cancelConversation();
    };

    this.client.onTurnComplete = () => {
      // Persist the completed turn, then always start fresh for the
      // next one — even if the write failed (the app recovers instead
      // of stalling).  The save itself is retried once internally.
      if (this.isMicOn && this.recorder._currentId) {
        const prevId = this.recorder._currentId;
        this.recorder.endConversation().then((id) => {
          if (id) console.log('Turn saved:', id);
        }).catch((err) => {
          console.warn('Turn save failed (turn data lost):', prevId, err);
        }).finally(() => {
          // Recovery: always start fresh regardless of save outcome
          this.recorder.startConversation(
            this.language,
            this.els.voiceSelect?.value || 'Kore'
          );
        });
      }
    };

    this.client.onDisconnected = (code, reason) => {
      console.log('Disconnected:', code, reason);
      // Save any in-progress turn — the WS dropped before
      // onTurnComplete could fire.
      if (this.recorder._currentId) {
        this.recorder.endConversation().then((id) => {
          if (id) console.log('Disconnect-saved turn:', id);
        }).catch(() => {});
      }
      this._handleDisconnect();
    };

    this.client.onError = (err) => {
      console.error('Client error:', err);
      this._showError(err);
    };

    // Connect to the Live API
    await this.client.connect(tokenData.token, this.language);

    // Success
    this.sessionToken = tokenData.token;
    this._setStatus('connected', 'Connected');
    this.els.connectBtn.textContent = 'Disconnect';
    this.els.connectBtn.disabled = false;
    this.els.connectBtn.classList.add('connected');
    this.els.micBtn.disabled = false;

    // Add welcome message
    this._addSystemMessage('Connected. Press the mic button or Space to start speaking.');

  } catch (err) {
    console.error('Connection failed:', err);
    this._setStatus('error', 'Connection failed');
    this.els.connectBtn.textContent = 'Connect';
    this.els.connectBtn.disabled = false;
    this._showError(err.message || 'Failed to connect');
  }
};

/**
 * Disconnect from Gemini Live API.
 */
app._disconnect = async function () {
  if (this.isMicOn) {
    await this._stopMic();
  }

  await this.client.disconnect();
  this._handleDisconnect();
};

app._handleDisconnect = function () {
  this._setStatus('idle', 'Disconnected');
  this.els.connectBtn.textContent = 'Connect';
  this.els.connectBtn.classList.remove('connected');
  this.els.micBtn.classList.remove('active');
  this.isMicOn = false;
  this.sessionToken = null;
};

/**
 * Toggle microphone on/off.
 */
app._toggleMic = async function () {
  if (this.isMicOn) {
    await this._stopMic();
  } else {
    await this._startMic();
  }
};

/**
 * Start microphone capture.
 */
app._startMic = async function () {
  if (!this.client.isConnected()) {
    // Auto-connect: tap to talk, no manual Connect step needed
    if (this.state === 'connecting') return; // Already in progress
    await this._connect();
    if (!this.client.isConnected()) return; // Connection failed, error shown
  }

  try {
    // Initialize audio player context (needs user gesture)
    await this.player.init();

    // Start recording this conversation
    this.recorder.startConversation(this.language, this.els.voiceSelect?.value || 'Kore');

    // Set up audio capture
    this.capture.onChunk = (base64PCM) => {
      this.client.sendAudio(base64PCM);
      this.recorder.addInputAudio(base64PCM);
    };

    this.capture.onError = (err) => {
      console.error('Capture error:', err);
      this._showError('Microphone error');
    };

    await this.capture.start({ chunkDurationMs: 100 });

    this.isMicOn = true;
    this.els.micBtn.classList.add('active');
    this._setStatus('listening', 'Listening...');

  } catch (err) {
    console.error('Failed to start mic:', err);
    this.recorder.cancelConversation();
    this._showError('Microphone access denied or unavailable');
  }
};

/**
 * Stop microphone capture.
 */
app._stopMic = async function () {
  this.capture.stop();
  this.client.sendAudioStreamEnd();
  this.isMicOn = false;
  this.els.micBtn.classList.remove('active');
  this._setStatus('connected', 'Connected');

  // Save the recorded conversation to IndexedDB (fire-and-forget)
  this.recorder.endConversation().then((id) => {
    if (id) console.log('Conversation saved:', id);
  }).catch((err) => {
    console.warn('Failed to save conversation:', err);
  });
};

/**
 * Add a message to the transcript display.
 */
app._addMessage = function (role, text) {
  // Hide empty state
  if (this.els.transcriptEmpty) {
    this.els.transcriptEmpty.style.display = 'none';
  }

  const isUser = role === 'user';
  const roleLabel = isUser ? 'You' : 'Gemini';

  // Create message element
  const msgEl = document.createElement('div');
  msgEl.className = `message ${role}-msg`;

  let avatar = '🧑';
  if (role === 'ai') avatar = '🤖';
  if (role === 'system') avatar = 'ℹ️';

  msgEl.innerHTML = `
    <div class="msg-avatar">${avatar}</div>
    <div class="msg-content">
      <div class="msg-role">${roleLabel}</div>
      <div class="msg-text">${this._escapeHtml(text)}</div>
    </div>
  `;

  this.els.transcriptList.appendChild(msgEl);
  this.els.transcript.scrollTop = this.els.transcript.scrollHeight;
};

app._addSystemMessage = function (text) {
  const msgEl = document.createElement('div');
  msgEl.className = 'message system-msg';
  msgEl.innerHTML = `
    <div class="msg-content">
      <div class="msg-text" style="color: var(--text-muted); font-style: italic; font-size: 0.85em;">${this._escapeHtml(text)}</div>
    </div>
  `;
  this.els.transcriptList.appendChild(msgEl);
  this.els.transcript.scrollTop = this.els.transcript.scrollHeight;
};

/**
 * Set the connection status indicator.
 */
app._setStatus = function (state, text) {
  this.state = state;
  if (this.els.statusDot) {
    this.els.statusDot.className = `status-dot ${state}`;
  }
  if (this.els.statusText) {
    this.els.statusText.textContent = text;
  }
};

/**
 * Toggle settings panel open/closed.
 */
app._toggleSettings = function () {
  this.els.settingsPanel.classList.toggle('open');
  this.els.settingsToggle.classList.toggle('active');
};

/**
 * Close the settings panel.
 */
app._closeSettings = function () {
  this.els.settingsPanel.classList.remove('open');
  this.els.settingsToggle.classList.remove('active');
};

/**
 * Show an error toast.
 */
app._showError = function (message) {
  if (this.els.errorMessage) {
    this.els.errorMessage.textContent = message;
  }
  if (this.els.errorToast) {
    this.els.errorToast.classList.add('show');
    setTimeout(() => {
      this.els.errorToast.classList.remove('show');
    }, 4000);
  }
};

/**
 * Set up PWA install prompt.
 */
app._setupPWAInstall = function () {
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (this.els.pwaInstall) {
      this.els.pwaInstall.style.display = 'flex';
      this.els.pwaInstall.addEventListener('click', async () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          const result = await deferredPrompt.userChoice;
          console.log('PWA install result:', result.outcome);
          deferredPrompt = null;
          this.els.pwaInstall.style.display = 'none';
        }
      });
    }
  });

  window.addEventListener('appinstalled', () => {
    console.log('PWA installed');
    if (this.els.pwaInstall) {
      this.els.pwaInstall.style.display = 'none';
    }
  });
};

/**
 * Escape HTML to prevent XSS.
 */
app._escapeHtml = function (text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => app.init());
