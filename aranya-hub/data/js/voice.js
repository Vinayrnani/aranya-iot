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

  // ================================================================
  // DOM CACHE
  // ================================================================

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  const dom = {};

    /**
     * Cache DOM elements.
     * @private
     */
    function cacheDom () {
      dom.voiceFab = $('#voiceFab');
    }

    /**
     * Wire up UI event handlers.
     * @private
     */
    function bindEvents () {
      if (!dom.voiceFab) return;

      var start = function (e) {
        e.preventDefault();
        VoiceAssistant.startListening('en');
        dom.voiceFab.className = 'voice-fab voice-listening';
      };

      var stop = function (e) {
        e.preventDefault();
        VoiceAssistant.stopListening();
        dom.voiceFab.className = 'voice-fab voice-processing';
      };

      // Mouse
      dom.voiceFab.addEventListener('mousedown', start);
      dom.voiceFab.addEventListener('mouseup', stop);
      dom.voiceFab.addEventListener('mouseleave', stop);

      // Touch
      dom.voiceFab.addEventListener('touchstart', start, { passive: false });
      dom.voiceFab.addEventListener('touchend', stop);
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
      var transcript = '';
      for (var i = e.resultIndex; i < e.results.length; ++i) {
        if (e.results[i].isFinal) {
          transcript += e.results[i][0].transcript;
        }
      }
      if (transcript) {
        VoiceAssistant._onTranscript(transcript.trim());
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

  function resetSilenceTimer() {
    if (silenceTimer) clearTimeout(silenceTimer);
    silenceTimer = setTimeout(stopListening, SILENCE_TIMEOUT);
  }

  // ================================================================
  // INTERNAL — Audio WebSocket
  // ================================================================

  /**
   * Connect the audio WebSocket to the hub voice endpoint.
   * @param {string} [url] - WebSocket URL (defaults to auto-detect).
   */
  function connectAudioWs (url) {
    if (audioWs && (audioWs.readyState === WebSocket.OPEN || audioWs.readyState === WebSocket.CONNECTING)) return;

    var wsUrl = url || 'ws://' + location.hostname + '/voice';

    try {
      audioWs = new WebSocket(wsUrl);
    } catch (e) {
      scheduleWsReconnect();
      return;
    }

    audioWs.onopen = function () {
      // Stub: audio WS connected
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
      console.log('Voice module loaded');
    },

    // --------------------------------------------------------------
    // Speech Recognition
    // --------------------------------------------------------------

    /**
     * Start listening for voice commands.
     * @param {string} [langCode='en'] - Language code (en, te, hi).
     * @returns {boolean} True if recognition started successfully.
     */
    startListening: function (langCode) {
      if (isListening) return true;
      recognition = createRecognition(langCode || 'en');
      if (!recognition) return false;

      try {
        recognition.start();
        isListening = true;
        resetSilenceTimer();
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
    stopListening: function () {
      if (silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
      }
      if (recognition && isListening) {
        try { recognition.stop(); } catch (_) { /* ignore */ }
      }
      isListening = false;
    },

    /**
     * Callback for transcript results.
     * @param {string} text - The recognized text.
     * @private
     */
    _onTranscript: function (text) {
      console.log('Transcript:', text);
      // Stub: handle transcript
    },

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
