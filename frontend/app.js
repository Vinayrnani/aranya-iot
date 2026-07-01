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
  language: 'te',
  isMicOn: false,
  conversation: [],
  sessionToken: null,
  _isFirstTurn: true,     // Track first user turn per WebSocket session

  // Caption bar state
  captionLines: [],         // Finalized lines: [{ role, text, dimmed }]
  activeCaption: null,      // Current streaming: { role, text } | null
  _captionTimer: null,      // Auto-clear timer for system messages

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
    captionBar: document.getElementById('caption-bar'),
    micBtn: document.getElementById('mic-btn'),
    micIcon: document.getElementById('mic-icon'),

    settingsPanel: document.getElementById('settings-panel'),
    settingsToggle: document.getElementById('settings-toggle'),
    voiceSelect: document.getElementById('voice-select'),
    settingsBackdrop: document.getElementById('settings-backdrop'),
    errorToast: document.getElementById('error-toast'),
    errorMessage: document.getElementById('error-message'),
    pwaInstall: document.getElementById('pwa-install'),
    siriOrb: document.getElementById('siri-orb'),
  };

  // Create core instances
  this.client = new GeminiLiveClient();
  this.capture = new AudioCapture();
  this.player = new AudioPlayer();
  this.recorder = new ConversationRecorder();

  // Expose for E2E export: app.recorder.exportAllToServer()
  window.__recorder = this.recorder;

  // Pre-fetch an ephemeral token in the background so the first
  // connect skips the token API round-trip.
  this.client.prefetchToken();

  // Bind events
  this._bindEvents();

  // Check for PWA install prompt
  this._setupPWAInstall();

  // Update status
  this._setStatus('idle', 'Ready');

  // Auto-connect in background so the WebSocket is ready when
  // the user taps the mic.
  this._autoConnect();

  // Re-acquire wake lock if user returns to the page
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && this.sessionToken) {
      this._requestWakeLock();
    }
  });
};

/**
 * Bind all UI event handlers.
 */
app._bindEvents = function () {
  // Mic button
  this.els.micBtn.addEventListener('click', () => this._toggleMic());

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
 * Auto-connect on page load (background).
 */
app._autoConnect = async function () {
  this._connectPromise = this._connect();
  await this._connectPromise;
  this._connectPromise = null;
};

/**
 * Connect to Gemini Live API.
 */
app._connect = async function () {
  this.state = 'connecting';
  this._setStatus('connecting', 'Connecting...');
  this.els.micBtn.disabled = true;

  try {
    // Fetch ephemeral token from our backend
    this._setStatus('connecting', 'Fetching token...');
    const tokenData = await this.client.fetchToken();

    this._setStatus('connecting', 'Connecting to Gemini...');

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
      this._updateCaption('user', text);
      this.recorder.setInputTranscript(text);
    };

    this.client.onOutputTranscription = (text) => {
      this._updateCaption('ai', text);
      this.recorder.setOutputTranscript(text);
    };

    this.client.onInterrupted = () => {
      this.player.clearQueue();
      this.recorder.cancelConversation();
    };

    this.client.onTurnComplete = () => {
      // Dim the caption bar
      this._dimCaptions();

      // Persist the completed turn, then always start fresh for the
      // next one — even if the write failed (the app recovers instead
      // of stalling).
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

    // Connect to the Live API (pass server-managed system prompt if provided)
    await this.client.connect(tokenData.token, this.language, {}, tokenData.systemPrompt);

    // Success
    this.sessionToken = tokenData.token;
    this._setStatus('connected', 'Connected');
    this.els.micBtn.disabled = false;

    // Add welcome message
    this._showCaptionNotification('Connected. Tap the mic button or press Space to start.');

    // Show orb in idle state
    this.els.siriOrb.className = 'siri-orb idle';

    // Keep screen on while using the voice assistant
    this._requestWakeLock();

  } catch (err) {
    console.error('Connection failed:', err);
    this._setStatus('error', 'Connection failed');
    this.els.micBtn.disabled = false;
    this._showError(err.message || 'Failed to connect');
  }
};

app._handleDisconnect = function () {
  this._isFirstTurn = true;
  this._setStatus('idle', 'Disconnected');
  this.els.micBtn.classList.remove('active');
  this.els.siriOrb.className = 'siri-orb';
  this.isMicOn = false;
  this.sessionToken = null;
  this._connectPromise = null;
  this._releaseWakeLock();
};

// ─── Screen Wake Lock (keep screen on during voice interaction) ─────────────

app._wakeLock = null;

app._requestWakeLock = async function () {
  if (!navigator.wakeLock) return; // API not supported
  try {
    if (this._wakeLock) return; // already held
    this._wakeLock = await navigator.wakeLock.request('screen');
    this._wakeLock.addEventListener('release', () => {
      this._wakeLock = null;
    });
  } catch (err) {
    // Not critical — silently ignore (user may have low battery / power-save mode)
    console.warn('Wake Lock request denied:', err.message);
  }
};

app._releaseWakeLock = function () {
  if (this._wakeLock) {
    this._wakeLock.release();
    this._wakeLock = null;
  }
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
    // If auto-connect is in progress, wait for it
    if (this._connectPromise) {
      await this._connectPromise;
      this._connectPromise = null;
      if (!this.client.isConnected()) {
        this._showError('Auto-connect failed. Tap again.');
        return;
      }
    } else if (this.state === 'connecting') {
      return; // Another manual connect in progress
    } else {
      await this._connect();
      if (!this.client.isConnected()) return;
    }
  }

  try {
    // Initialize audio player context (needs user gesture)
    await this.player.init();

    // Start recording this conversation
    this.recorder.startConversation(this.language, this.els.voiceSelect?.value || 'Kore');

    // Clear caption bar for a fresh turn
    this._clearCaptions();

    // Send session flag before the first audio of each turn.
    // Gemini uses this to decide greeting protocol per behavioral_constraints.
    if (this._isFirstTurn) {
      this.client.sendText('[SESSION_START = TRUE]');
      this._isFirstTurn = false;
    } else {
      this.client.sendText('[SESSION_START = FALSE]');
    }

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
    this.els.siriOrb.className = 'siri-orb active';
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
  this.player.clearQueue();
  this.isMicOn = false;
  this.els.micBtn.classList.remove('active');
  this.els.siriOrb.className = 'siri-orb idle';
  this._setStatus('connected', 'Connected');

  // Save the conversation to server (fire-and-forget)
  this.recorder.endConversation().then((id) => {
    if (id) console.log('Conversation saved:', id);
  }).catch((err) => {
    console.warn('Failed to save conversation:', err);
  });
};

/**
 * Update the caption bar with incoming transcription text.
 *
 * The Gemini Live API sends incremental text fragments, so we append
 * to the active caption rather than replace.  When the role switches
 * (user→ai or ai→user), the previous line is finalized and dimmed.
 */
app._updateCaption = function (role, text) {
  if (!text) return;

  // Role switched — finalize the previous active caption
  if (this.activeCaption && this.activeCaption.role !== role) {
    this.captionLines.push({
      role: this.activeCaption.role,
      text: this.activeCaption.text,
    });
    // Keep only the most recent finalized line to avoid overflow
    if (this.captionLines.length > 1) {
      this.captionLines = this.captionLines.slice(-1);
    }
    this.activeCaption = null;
  }

  // Append incremental text fragment to the active caption
  if (!this.activeCaption) {
    this.activeCaption = { role, text };
  } else {
    this.activeCaption.text += ' ' + text;
  }

  this._renderCaptions();
};

/**
 * Show a temporary system/notification caption.
 * Auto-dims after a few seconds.
 */
app._showCaptionNotification = function (text) {
  clearTimeout(this._captionTimer);
  this._clearCaptions();
  this.activeCaption = { role: 'system', text };
  this._renderCaptions();

  // Auto-dim after 4 seconds
  this._captionTimer = setTimeout(() => {
    this._dimCaptions();
  }, 4000);
};

/**
 * Finalize the active caption and dim all lines.
 * Called on turn complete.
 */
app._dimCaptions = function () {
  if (this.activeCaption) {
    this.captionLines.push({
      role: this.activeCaption.role,
      text: this.activeCaption.text,
    });
    if (this.captionLines.length > 1) {
      this.captionLines = this.captionLines.slice(-1);
    }
    this.activeCaption = null;
  }
  this._renderCaptions();
};

/**
 * Clear all captions (fresh turn).
 */
app._clearCaptions = function () {
  clearTimeout(this._captionTimer);
  this.captionLines = [];
  this.activeCaption = null;
  this._renderCaptions();
};

/**
 * Render the caption bar using incremental DOM updates.
 *
 * Key optimization: during streaming (the common case ~10 updates/sec),
 * we only update textContent on the existing active element — no DOM
 * creation, no destruction, no flash.  Structural changes (role switch,
 * turn complete) use targeted DOM manipulation instead of innerHTML.
 */
app._renderCaptions = function () {
  const bar = this.els.captionBar;
  if (!bar) return;

  const hasContent = this.captionLines.length > 0 ||
    (this.activeCaption && this.activeCaption.text);

  if (!hasContent) {
    bar.textContent = '';
    bar.classList.remove('caption-bar--visible');
    return;
  }

  bar.classList.add('caption-bar--visible');

  // Phase 1: Sync finalized (dimmed) lines.
  // The first N children should match captionLines[].
  let i = 0;

  for (; i < this.captionLines.length; i++) {
    const line = this.captionLines[i];
    const child = bar.children[i];

    if (!child || child.dataset.cr !== 'f') {
      // This slot needs a finalized element but doesn't have one.
      // If the existing child is the active caption, convert it.
      if (child && child.dataset.cr === 'a') {
        child.dataset.cr = 'f';
        child.classList.add('caption-line--dim');
        child.classList.remove('caption-line--system');
        const textEl = child.querySelector('.caption-text');
        if (textEl) textEl.textContent = line.text;
      } else {
        // Mismatch — full rebuild (rare: only on structural edge cases)
        this._rebuildCaptionDom(bar);
        return;
      }
    } else {
      // Existing finalized element — update text only
      const textEl = child.querySelector('.caption-text');
      if (textEl) textEl.textContent = line.text;
    }
  }

  // Remove any extra finalized children (past captionLines.length)
  while (i < bar.children.length) {
    const child = bar.children[i];
    if (child.dataset.cr === 'a') break; // active comes after finalized
    bar.removeChild(child);
  }

  // Phase 2: Sync the active (streaming) caption line
  if (this.activeCaption && this.activeCaption.text) {
    const isSystem = this.activeCaption.role === 'system';
    let activeEl = i < bar.children.length ? bar.children[i] : null;

    if (activeEl && activeEl.dataset.cr === 'a') {
      // Update existing active element — textContent only, no flash
      const textEl = activeEl.querySelector('.caption-text');
      if (textEl) textEl.textContent = this.activeCaption.text;
      activeEl.classList.toggle('caption-line--system', isSystem);
    } else {
      // Create a fresh active element
      while (i < bar.children.length) {
        bar.removeChild(bar.children[i]);
      }
      activeEl = this._createCaptionLineEl(
        this.activeCaption.text, isSystem
      );
      bar.appendChild(activeEl);
    }
  } else {
    // No active caption — remove dangling active element if present
    if (i < bar.children.length && bar.children[i].dataset.cr === 'a') {
      bar.removeChild(bar.children[i]);
    }
  }
};

/**
 * Full DOM rebuild (rare — only on structural edge cases where
 * the incremental sync can't reconcile children).
 */
app._rebuildCaptionDom = function (bar) {
  bar.textContent = '';
  for (const line of this.captionLines) {
    bar.appendChild(
      this._createCaptionLineEl(line.text, false, true)
    );
  }
  if (this.activeCaption && this.activeCaption.text) {
    const isSystem = this.activeCaption.role === 'system';
    bar.appendChild(
      this._createCaptionLineEl(this.activeCaption.text, isSystem)
    );
  }
};

/**
 * Create a caption line DOM element (avoids innerHTML).
 * @param {string} text   - Caption text
 * @param {boolean} isSystem - System notification styling
 * @param {boolean} dimmed  - Dimmed (finalized) styling
 */
app._createCaptionLineEl = function (text, isSystem, dimmed) {
  const el = document.createElement('div');
  el.dataset.cr = dimmed ? 'f' : 'a';
  el.className = 'caption-line' +
    (dimmed ? ' caption-line--dim' : '') +
    (isSystem ? ' caption-line--system' : '');

  const textEl = document.createElement('span');
  textEl.className = 'caption-text';
  textEl.textContent = text;
  el.appendChild(textEl);

  return el;
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

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => app.init());
