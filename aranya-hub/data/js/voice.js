/* ================================================================
   Aranya Resort — Voice Assistant Module
   Speech recognition, WebSocket audio, and voice playback stubs
   ================================================================ */

(function () {
  'use strict';

  // ================================================================
  // CONFIGURATION
  // ================================================================

  /** @constant {number} WebSocket reconnect delay on close/error (ms) */
  const WS_RECONNECT_DELAY = 2000;

  /** @constant {Object} Supported languages */
  const LANGUAGES = {
    'en': 'en-IN',
    'te': 'te-IN',
    'hi': 'hi-IN'
  };

  /** @constant {number} Silence timeout (ms) */
  const SILENCE_TIMEOUT = 10000;

  // ================================================================
  // STATE
  // ================================================================

  /** @type {SpeechRecognition|null} */
  let recognition = null;

  /** @type {boolean} */
  let isListening = false;

  /** @type {number|null} */
  let silenceTimer = null;

  /** @type {WebSocket|null} */
  let audioWs = null;

  /** @type {number|null} */
  let wsReconnectTimer = null;

  /** @type {number|null} */
  let processingTimer = null;

  /** @type {number|null} */
  let transcriptOverlayTimer = null;

  /** @type {string} */
  let lastTranscriptText = '';

  /** @type {boolean} */
  let sentToServer = false;

  /** @type {string} */
  let speechBuffer = '';

  /** @type {boolean} */
  let isStopping = false;

  /** @type {string} */
  let currentLang = 'en';

  // ================================================================
  // DOM CACHE
  // ================================================================

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  const dom = {};

  /** @type {HTMLElement|null} */
  dom.voiceTranscript = null;
  /** @type {HTMLElement|null} */
  dom.vtUserText = null;
  /** @type {HTMLElement|null} */
  dom.vtResponseText = null;
  /** @type {HTMLElement|null} */
  dom.vtDots = null;

    /**
     * Cache DOM elements.
     * @private
     */
    function cacheDom () {
      dom.voiceFab = $('#voiceFab');
      dom.voiceLangBar = $('#voiceLang');
      dom.voiceLangBtns = dom.voiceLangBar
        ? Array.from(dom.voiceLangBar.querySelectorAll('.voice-lang-btn'))
        : [];
      createTranscriptOverlay();
    }

    /**
     * Wire up UI event handlers.
     * @private
     */
    function bindEvents () {
      console.log('VoiceAssistant bindEvents called');
      if (!dom.voiceFab) {
        console.warn('VoiceAssistant: voiceFab not found');
        return;
      }

      // Language selector
      dom.voiceLangBtns.forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          dom.voiceLangBtns.forEach(function (b) { b.classList.remove('active'); });
          btn.classList.add('active');
          currentLang = btn.getAttribute('data-lang');
        });
      });

      // Voice FAB toggle
      dom.voiceFab.addEventListener('click', function(e) {
        console.log('Voice FAB clicked');
        if (isListening) stopListening();
        else {
          VoiceAssistant.startListening(currentLang);
          dom.voiceFab.className = 'voice-fab voice-listening';
        }
      });
    }

  // ================================================================
  // TRANSCRIPT OVERLAY
  // ================================================================

  /**
   * Create the floating transcript overlay DOM and append to body.
   * @private
   */
  function createTranscriptOverlay () {
    var el = document.createElement('div');
    el.id = 'voiceTranscript';
    el.className = 'voice-transcript voice-transcript-hidden';
    el.innerHTML =
      '<div class="voice-transcript-inner">' +
        '<div class="vt-you">' +
          '<span class="vt-label">You</span>' +
          '<span class="vt-text" id="vtUserText"></span>' +
        '</div>' +
        '<div class="vt-divider"></div>' +
        '<div class="vt-response">' +
          '<span class="vt-label">Assistant</span>' +
          '<span class="vt-text" id="vtResponseText"></span>' +
          '<span class="vt-dots" id="vtDots"></span>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
    dom.voiceTranscript = el;
    dom.vtUserText = document.getElementById('vtUserText');
    dom.vtResponseText = document.getElementById('vtResponseText');
    dom.vtDots = document.getElementById('vtDots');
  }

  /**
   * Clear the auto-dismiss timer for the transcript overlay.
   * @private
   */
  function clearTranscriptTimer () {
    if (transcriptOverlayTimer) {
      clearTimeout(transcriptOverlayTimer);
      transcriptOverlayTimer = null;
    }
  }

  /**
   * Show the transcript overlay (remove hidden class).
   * @private
   */
  function showTranscriptOverlay () {
    clearTranscriptTimer();
    dom.voiceTranscript.className = 'voice-transcript';
  }

  /**
   * Hide the transcript overlay (add hidden class).
   * @private
   */
  function hideTranscriptOverlay () {
    clearTranscriptTimer();
    dom.voiceTranscript.className = 'voice-transcript voice-transcript-hidden';
  }

  /**
   * Update the transcript overlay content based on state.
   * @param {string} state - 'listening', 'processing', or 'response'.
   * @param {string|Object} [text] - Text or object with tts_text for response.
   * @private
   */
  function setTranscriptState (state, text) {
    if (!dom.voiceTranscript) return;

    showTranscriptOverlay();

    switch (state) {
      case 'listening':
        dom.vtUserText.textContent = '';
        dom.vtDots.style.display = 'none';
        if (text) {
          dom.vtResponseText.textContent = '\uD83C\uDFA4 Listening... \u201C' + text + '\u201D';
        } else {
          dom.vtResponseText.textContent = '\uD83C\uDFA4 Listening...';
        }
        break;

      case 'processing':
        lastTranscriptText = text || lastTranscriptText;
        dom.vtUserText.textContent = lastTranscriptText;
        dom.vtResponseText.textContent = 'Thinking...';
        dom.vtDots.style.display = '';
        break;

      case 'response':
        dom.vtUserText.textContent = lastTranscriptText;
        dom.vtDots.style.display = 'none';
        if (typeof text === 'object' && text !== null) {
          dom.vtResponseText.textContent = text.tts_text || '';
        } else {
          dom.vtResponseText.textContent = text || '';
        }
        // Auto-dismiss after 5 seconds
        clearTranscriptTimer();
        transcriptOverlayTimer = setTimeout(function () {
          hideTranscriptOverlay();
        }, 5000);
        break;
    }
  }


  // ================================================================
  // UTILITY
  // ================================================================

  /**
   * Check browser support for the Web Speech API.
   * @returns {boolean} True if SpeechRecognition is available.
   */
  function isSpeechSupported () {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    return typeof SR === 'function';
  }

  // ================================================================
  // INTERNAL — Speech Recognition
  // ================================================================

  /**
   * Create and configure a SpeechRecognition instance.
   * @param {string} langCode - Language code (en, te, hi).
   * @returns {SpeechRecognition|null}
   */
  function createRecognition (langCode) {
    if (!isSpeechSupported()) return null;

    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    var sr = new SR();
    sr.lang = LANGUAGES[langCode] || LANGUAGES['en'];
    sr.continuous = true;
    sr.interimResults = true; // Enabled for feedback

    sr.onresult = function (e) {
      resetSilenceTimer();
      var finalChunk = '';
      var interimTranscript = '';
      for (var i = e.resultIndex; i < e.results.length; ++i) {
        if (e.results[i].isFinal) {
          finalChunk = e.results[i][0].transcript;
        } else {
          interimTranscript = e.results[i][0].transcript;
        }
      }
      if (interimTranscript) {
        setTranscriptState('listening', interimTranscript);
      }
      if (finalChunk) {
        speechBuffer = finalChunk.trim();
      }
    };

    sr.onerror = function (e) {
      console.error('Speech recognition error', e.error);
      stopListening();
    };

    sr.onend = function () {
      stopListening();
    };

    return sr;
  }

  function stopListening () {
    // Guard against re-entrancy: recognition.stop() triggers onend -> stopListening
    if (isStopping) return;
    isStopping = true;

    clearProcessingTimer();
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }
    isListening = false;

    // Send accumulated speech buffer (whole sentence) to server
    if (speechBuffer && !sentToServer) {
      VoiceAssistant._onTranscript(speechBuffer);
    }
    speechBuffer = '';

    if (recognition) {
      try { recognition.stop(); } catch (_) { /* ignore */ }
    }

    if (sentToServer) {
      dom.voiceFab.className = 'voice-fab voice-processing';
      setProcessingTimeout();
      if (!lastTranscriptText && dom.voiceTranscript) {
        hideTranscriptOverlay();
      }
    }

    isStopping = false;
  }

  function resetSilenceTimer() {
    if (silenceTimer) clearTimeout(silenceTimer);
    silenceTimer = setTimeout(stopListening, SILENCE_TIMEOUT);
  }

  function clearProcessingTimer() {
    if (processingTimer) {
      clearTimeout(processingTimer);
      processingTimer = null;
    }
  }

  function setProcessingTimeout() {
    clearProcessingTimer();
    processingTimer = setTimeout(function () {
      console.warn('Voice processing timeout — no server response');
      window.toast('Voice server timeout', 'error');
      dom.voiceFab.className = 'voice-fab voice-idle';
      processingTimer = null;
    }, 30000);
  }

  function isSilentAudio(base64str) {
    // Empty WAV is 44 zero-bytes -> base64 ~60 chars of mostly 'A'
    var decoded;
    try { decoded = window.atob(base64str); } catch (e) { return true; }
    if (decoded.length < 100) return true; // too small for real audio
    // Check if it's padded with silence (all zeros after WAV header)
    for (var i = 44; i < decoded.length && i < 64; i++) {
      if (decoded.charCodeAt(i) !== 0) return false;
    }
    return decoded.length <= 44; // header-only = silent
  }

  function speakViaBrowser(text, lang) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    var utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang || 'en';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
  }

  function handleAudioWsMessage(msg) {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'response':
        console.log('Voice response:', msg);
        clearProcessingTimer();
        if (msg.tts_audio) {
          if (isSilentAudio(msg.tts_audio)) {
            speakViaBrowser(msg.tts_text, msg.lang || 'en');
          } else {
            VoiceAssistant.playAudio(msg.tts_audio);
          }
        }
        // Handle command if needed
        if (msg.action) {
           // Logic to trigger device command via ESP32 WS
        }
        dom.voiceFab.className = 'voice-fab voice-idle';
        setTranscriptState('response', msg);
        break;
      case 'error':
        console.error('Voice server error:', msg.message);
        clearProcessingTimer();
        dom.voiceFab.className = 'voice-fab voice-idle';
        setTranscriptState('response', { tts_text: 'Error: ' + (msg.message || 'Unknown error') });
        break;
    }
  }

  /**
   * Connect the audio WebSocket to the hub voice endpoint.
   * @param {string} [url] - WebSocket URL (defaults to auto-detect).
   */
  function connectAudioWs (url) {
    if (audioWs && (audioWs.readyState === WebSocket.OPEN || audioWs.readyState === WebSocket.CONNECTING)) return;

    var wsUrl = url || 'ws://' + location.hostname + ':8080/ws';

    try {
      audioWs = new WebSocket(wsUrl);
    } catch (e) {
      scheduleWsReconnect();
      return;
    }

    audioWs.onopen = function () {
      sentToServer = false;
    };

    audioWs.onmessage = function (e) {
      try {
        var msg = JSON.parse(e.data);
        handleAudioWsMessage(msg);
      } catch (err) {
        console.error('Error parsing WS message', err);
      }
    };

    audioWs.onclose = function () {
      audioWs = null;
      scheduleWsReconnect();
    };

    audioWs.onerror = function () {
      if (audioWs) audioWs.close();
    };
  }

  /**
   * Schedule a reconnection attempt for the audio WebSocket.
   */
  function scheduleWsReconnect () {
    if (wsReconnectTimer) return;
    wsReconnectTimer = setTimeout(function () {
      wsReconnectTimer = null;
      connectAudioWs();
    }, WS_RECONNECT_DELAY);
  }

  // ================================================================
  // PUBLIC API — VoiceAssistant
  // ================================================================

  /**
   * @namespace VoiceAssistant
   * @description Aranya voice control module. Exposed as window.VoiceAssistant.
   */

  var VoiceAssistant = {

    // --------------------------------------------------------------
    // Lifecycle
    // --------------------------------------------------------------

    /**
     * Initialise the voice module. Call once on page load.
     * @returns {void}
     */
    init: function () {
      cacheDom();
      bindEvents();
      connectAudioWs(); // Connect on init
      console.log('Voice module loaded');
    },

    /**
     * Callback for transcript results.
     * @param {string} text - The recognized text.
     * @private
     */
    _onTranscript: function (text) {
      console.log('Transcript:', text);
      if (audioWs && audioWs.readyState === WebSocket.OPEN) {
        audioWs.send(JSON.stringify({ type: 'transcript', text: text, lang: currentLang }));
        sentToServer = true;
        setProcessingTimeout();
        dom.voiceFab.className = 'voice-fab voice-processing';
        setTranscriptState('processing', text);
      } else {
        console.error('Audio WS not connected');
        window.toast('Voice server disconnected', 'error');
        dom.voiceFab.className = 'voice-fab voice-idle';
        sentToServer = false;
        setTranscriptState('response', 'Voice server disconnected');
      }
    },

    /**
     * Start listening for voice commands.
     * @param {string} [langCode='en'] - Language code (en, te, hi).
     * @returns {boolean} True if recognition started successfully.
     */
    startListening: function (langCode) {
      clearProcessingTimer();
      // Restart overlay fresh for new session
      if (dom.voiceTranscript) {
        hideTranscriptOverlay();
      }
      if (isListening) return true;
      currentLang = langCode || 'en';
      recognition = createRecognition(currentLang);
      if (!recognition) return false;

      try {
        recognition.start();
        isListening = true;
        resetSilenceTimer();
        lastTranscriptText = '';
        sentToServer = false;
        speechBuffer = '';
        showTranscriptOverlay();
        setTranscriptState('listening');
        return true;
      } catch (e) {
        console.error('Failed to start recognition', e);
        return false;
      }
    },

    /**
     * Stop listening for voice commands.
     * @returns {void}
     */
    stopListening: stopListening,


    // --------------------------------------------------------------
    // Audio WebSocket
    // --------------------------------------------------------------

    /**
     * Connect the audio WebSocket to the hub voice endpoint.
     * @param {string} [url] - Optional custom WebSocket URL.
     * @returns {void}
     */
    connectVoiceWs: function (url) {
      connectAudioWs(url);
    },

    // --------------------------------------------------------------
    // Playback
    // --------------------------------------------------------------

    /**
     * Play an audio buffer or URL through the browser.
     * @param {string|ArrayBuffer} input - Audio URL string or raw buffer.
     * @returns {void}
     */
    playAudio: function (input) {
      if (typeof input === 'string') {
        // Check if it's a base64 string (simple check)
        if (input.startsWith('data:audio/wav;base64,') || input.length > 1000) {
          var base64 = input.includes(',') ? input.split(',')[1] : input;
          this._playBase64Wav(base64);
        } else {
          var audio = new Audio(input);
          audio.play().catch(function () {});
        }
      } else if (input instanceof ArrayBuffer) {
        this._playArrayBuffer(input);
      }
    },

    /**
     * Decode and play base64 WAV.
     * @param {string} base64 - Base64 encoded WAV.
     * @private
     */
    _playBase64Wav: function (base64) {
      var binaryString = window.atob(base64);
      var len = binaryString.length;
      var bytes = new Uint8Array(len);
      for (var i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      this._playArrayBuffer(bytes.buffer);
    },

    /**
     * Decode and play ArrayBuffer.
     * @param {ArrayBuffer} buffer - Audio buffer.
     * @private
     */
    _playArrayBuffer: function (buffer) {
      var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      audioCtx.decodeAudioData(buffer, function (audioBuffer) {
        var source = audioCtx.createBufferSource();
        var gainNode = audioCtx.createGain();
        
        source.buffer = audioBuffer;
        
        // Volume normalization (set to 0.8)
        gainNode.gain.value = 0.8;
        
        // Fade in/out
        var now = audioCtx.currentTime;
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.8, now + 0.1);
        gainNode.gain.setValueAtTime(0.8, now + audioBuffer.duration - 0.1);
        gainNode.gain.linearRampToValueAtTime(0, now + audioBuffer.duration);
        
        source.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        source.start(0);
      }, function (e) {
        console.error('Error decoding audio data', e);
      });
    },
  };

  // ================================================================
  // EXPORT
  // ================================================================

  window.VoiceAssistant = VoiceAssistant;

})();
