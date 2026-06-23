/* ================================================================
   Aranya Resort — Voice Assistant Module
   AudioContext PCM capture + Gladia streaming STT via WebSocket
   ================================================================ */

(function () {
  'use strict';

  // ================================================================
  // CONFIGURATION
  // ================================================================

  var WS_RECONNECT_DELAY = 2000;
  var MAX_RECORDING_TIME = 30000;
  var PCM_SAMPLE_RATE = 16000;
  var CHUNK_FRAMES = 4096;

  // ================================================================
  // STATE
  // ================================================================

  var audioContext = null;
  var scriptProcessor = null;
  var sourceNode = null;
  var capturedStream = null;
  var isListening = false;
  var isStopping = false;
  var recordingActive = false;
  var audioWs = null;
  var wsReconnectTimer = null;
  var processingTimer = null;
  var transcriptOverlayTimer = null;
  var lastTranscriptText = '';
  var recordingTimer = null;

  // Timing instrumentation
  var timing = {
    fabPressed: null,
    getUserMediaStart: null,
    getUserMediaEnd: null,
    audioContextCreated: null,
    firstChunkSent: null,
    audioEndSent: null,
    responseReceived: null,
    chunkCount: 0
  };

  // ================================================================
  // DOM CACHE
  // ================================================================

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); };

  var dom = {};
  dom.voiceFab = null;
  dom.voiceTranscript = null;
  dom.vtUserText = null;
  dom.vtResponseText = null;
  dom.vtDots = null;

  function cacheDom () {
    dom.voiceFab = $('#voiceFab');
    createTranscriptOverlay();
  }

  function bindEvents () {
    console.log('VoiceAssistant bindEvents called');
    if (!dom.voiceFab) {
      console.warn('VoiceAssistant: voiceFab not found');
      return;
    }

    dom.voiceFab.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      timing.fabPressed = Date.now();
      timing.chunkCount = 0;
      console.log('[TIMING] FAB pressed @', timing.fabPressed);
      if (isListening) return;
      VoiceAssistant.startListening();
      dom.voiceFab.className = 'voice-fab voice-listening';
    });

    dom.voiceFab.addEventListener('pointerup', function () {
      console.log('Voice FAB released');
      if (!isListening) return;
      stopListening();
    });

    dom.voiceFab.addEventListener('pointerleave', function () {
      if (!isListening) return;
      stopListening();
    });
  }

  // ================================================================
  // TRANSCRIPT OVERLAY
  // ================================================================

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

  function clearTranscriptTimer () {
    if (transcriptOverlayTimer) {
      clearTimeout(transcriptOverlayTimer);
      transcriptOverlayTimer = null;
    }
  }

  function showTranscriptOverlay () {
    clearTranscriptTimer();
    dom.voiceTranscript.className = 'voice-transcript';
  }

  function hideTranscriptOverlay () {
    clearTranscriptTimer();
    dom.voiceTranscript.className = 'voice-transcript voice-transcript-hidden';
  }

  function setTranscriptState (state, text) {
    if (!dom.voiceTranscript) return;
    showTranscriptOverlay();

    switch (state) {
      case 'listening':
        dom.vtUserText.textContent = '';
        dom.vtDots.style.display = 'none';
        dom.vtResponseText.textContent = '\uD83C\uDFA4 Listening...';
        break;

      case 'partial':
        lastTranscriptText = text || lastTranscriptText;
        dom.vtUserText.textContent = lastTranscriptText;
        dom.vtResponseText.textContent = '...';
        dom.vtDots.style.display = '';
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
        clearTranscriptTimer();
        transcriptOverlayTimer = setTimeout(function () {
          hideTranscriptOverlay();
        }, 5000);
        break;
    }
  }

  // ================================================================
  // PCM CAPTURE via AudioContext (16 kHz mono Int16)
  // ================================================================

  function float32ToBase64Pcm (samples) {
    var len = samples.length;
    var buffer = new ArrayBuffer(len * 2);
    var view = new DataView(buffer);
    for (var i = 0; i < len; i++) {
      var s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    var bytes = new Uint8Array(buffer);
    var binary = '';
    for (var i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function startPCMCapture () {
    if (audioContext) return false;

    try {
      timing.getUserMediaStart = Date.now();
      console.log('[TIMING] getUserMedia start @', timing.getUserMediaStart);

      navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
        timing.getUserMediaEnd = Date.now();
        var getUserMediaDelay = timing.getUserMediaEnd - timing.getUserMediaStart;
        console.log('[TIMING] getUserMedia complete [' + getUserMediaDelay + 'ms]');

        if (!dom.voiceFab || dom.voiceFab.className.indexOf('voice-listening') === -1) {
          stream.getTracks().forEach(function (t) { t.stop(); });
          return;
        }

        capturedStream = stream;

        audioContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: PCM_SAMPLE_RATE
        });
        timing.audioContextCreated = Date.now();
        console.log('[TIMING] AudioContext created [' + (timing.audioContextCreated - timing.getUserMediaEnd) + 'ms]');

        sourceNode = audioContext.createMediaStreamSource(stream);
        scriptProcessor = audioContext.createScriptProcessor(CHUNK_FRAMES, 1, 1);

        scriptProcessor.onaudioprocess = function (e) {
          if (!recordingActive) return;
          var input = e.inputBuffer.getChannelData(0);
          var base64 = float32ToBase64Pcm(input);
          timing.chunkCount++;
          if (timing.chunkCount === 1) {
            timing.firstChunkSent = Date.now();
            console.log('[TIMING] First audio chunk sent [' + (timing.firstChunkSent - timing.fabPressed) + 'ms from FAB press]');
          }
          sendChunk(base64);
        };

        sourceNode.connect(scriptProcessor);
        scriptProcessor.connect(audioContext.destination);

        recordingActive = true;
        isListening = true;
        lastTranscriptText = '';
        showTranscriptOverlay();
        setTranscriptState('listening');
        console.log('PCM capture started @ ' + PCM_SAMPLE_RATE + ' Hz');

        recordingTimer = setTimeout(function () {
          if (isListening) stopListening();
        }, MAX_RECORDING_TIME);
      }).catch(function (err) {
        console.error('getUserMedia error:', err.message);
        window.toast('Microphone access denied', 'error');
        resetFabToIdle();
      });

      return true;
    } catch (e) {
      console.error('Failed to start PCM capture:', e);
      return false;
    }
  }

  function stopPCMCapture () {
    recordingActive = false;

    if (scriptProcessor) {
      try { scriptProcessor.disconnect(); } catch (_) { /* ignore */ }
      scriptProcessor = null;
    }
    if (sourceNode) {
      try { sourceNode.disconnect(); } catch (_) { /* ignore */ }
      sourceNode = null;
    }
    if (audioContext) {
      audioContext.close().catch(function () {});
      audioContext = null;
    }
    if (capturedStream) {
      capturedStream.getTracks().forEach(function (t) { t.stop(); });
      capturedStream = null;
    }
    if (recordingTimer) {
      clearTimeout(recordingTimer);
      recordingTimer = null;
    }
  }

  // ================================================================
  // WebSocket Communications
  // ================================================================

  function resetFabToIdle () {
    dom.voiceFab.className = 'voice-fab voice-idle';
    hideTranscriptOverlay();
    isListening = false;
  }

  function sendChunk (base64Pcm) {
    if (audioWs && audioWs.readyState === WebSocket.OPEN) {
      audioWs.send(JSON.stringify({ type: 'audio_chunk', data: base64Pcm }));
    }
  }

  function sendAudioEnd () {
    if (audioWs && audioWs.readyState === WebSocket.OPEN) {
      timing.audioEndSent = Date.now();
      var recordingDuration = timing.audioEndSent - timing.fabPressed;
      console.log('[TIMING] audio_end sent [' + recordingDuration + 'ms recording, ' + timing.chunkCount + ' chunks]');
      audioWs.send(JSON.stringify({ type: 'audio_end' }));
      setProcessingTimeout();
      dom.voiceFab.className = 'voice-fab voice-processing';
      setTranscriptState('processing');
    } else {
      console.error('WS not connected on audio_end');
      window.toast('Voice server disconnected', 'error');
      resetFabToIdle();
    }
  }

  function clearProcessingTimer () {
    if (processingTimer) {
      clearTimeout(processingTimer);
      processingTimer = null;
    }
  }

  function setProcessingTimeout () {
    clearProcessingTimer();
    processingTimer = setTimeout(function () {
      console.warn('Voice processing timeout');
      window.toast('Voice server timeout', 'error');
      dom.voiceFab.className = 'voice-fab voice-idle';
      processingTimer = null;
    }, 30000);
  }

  function stopListening () {
    if (isStopping) return;
    isStopping = true;

    clearProcessingTimer();
    isListening = false;

    if (recordingTimer) {
      clearTimeout(recordingTimer);
      recordingTimer = null;
    }

    stopPCMCapture();

    if (dom.voiceTranscript) {
      sendAudioEnd();
    }

    isStopping = false;
  }

  function isSilentAudio (base64str) {
    var decoded;
    try { decoded = window.atob(base64str); } catch (e) { return true; }
    if (decoded.length < 100) return true;
    for (var i = 44; i < decoded.length && i < 64; i++) {
      if (decoded.charCodeAt(i) !== 0) return false;
    }
    return decoded.length <= 44;
  }

  function speakViaBrowser (text, lang) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    var utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang || 'en';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
  }

  function handleAudioWsMessage (msg) {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'partial':
        setTranscriptState('partial', msg.text);
        break;

      case 'response':
        timing.responseReceived = Date.now();
        var totalPipeline = timing.responseReceived - timing.audioEndSent;
        var totalFromFAB = timing.responseReceived - timing.fabPressed;
        console.log('[TIMING] Response received [' + totalPipeline + 'ms from audio_end, ' + totalFromFAB + 'ms total from FAB press]');
        console.log('[TIMING] Breakdown: getUserMedia=' + (timing.getUserMediaEnd - timing.getUserMediaStart) + 'ms, firstChunk=' + (timing.firstChunkSent - timing.fabPressed) + 'ms, recording=' + (timing.audioEndSent - timing.fabPressed) + 'ms');
        clearProcessingTimer();
        if (msg.tts_audio) {
          if (isSilentAudio(msg.tts_audio)) {
            speakViaBrowser(msg.tts_text, msg.lang || 'en');
          } else {
            VoiceAssistant.playAudio(msg.tts_audio);
          }
        }
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

  function connectAudioWs (url) {
    if (audioWs && (audioWs.readyState === WebSocket.OPEN || audioWs.readyState === WebSocket.CONNECTING)) return;

    var wsUrl = url || 'ws://' + location.hostname + ':8080/ws';

    try {
      audioWs = new WebSocket(wsUrl);
    } catch (e) {
      scheduleWsReconnect();
      return;
    }

    audioWs.onopen = function () {};

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

  var VoiceAssistant = {

    init: function () {
      cacheDom();
      bindEvents();
      connectAudioWs();
      console.log('Voice module loaded');
    },

    startListening: function () {
      clearProcessingTimer();
      if (dom.voiceTranscript) {
        hideTranscriptOverlay();
      }
      if (isListening) return true;

      return startPCMCapture();
    },

    stopListening: stopListening,

    connectVoiceWs: function (url) {
      connectAudioWs(url);
    },

    playAudio: function (input) {
      if (typeof input === 'string') {
        if (input.indexOf('base64,') !== -1 || input.length > 1000) {
          var base64 = input.indexOf(',') !== -1 ? input.split(',')[1] : input;
          this._playBase64Wav(base64);
        } else {
          var audio = new Audio(input);
          audio.play().catch(function () {});
        }
      } else if (input instanceof ArrayBuffer) {
        this._playArrayBuffer(input);
      }
    },

    _playBase64Wav: function (base64) {
      var binaryString = window.atob(base64);
      var len = binaryString.length;
      var bytes = new Uint8Array(len);
      for (var i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      this._playArrayBuffer(bytes.buffer);
    },

    _playArrayBuffer: function (buffer) {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();

      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      ctx.decodeAudioData(buffer, function (audioBuffer) {
        var source = ctx.createBufferSource();
        var gainNode = ctx.createGain();

        source.buffer = audioBuffer;
        gainNode.gain.value = 0.8;

        var now = ctx.currentTime;
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.8, now + 0.1);
        gainNode.gain.setValueAtTime(0.8, now + audioBuffer.duration - 0.1);
        gainNode.gain.linearRampToValueAtTime(0, now + audioBuffer.duration);

        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        source.start(0);
      }, function (e) {
        console.error('Error decoding audio', e);
      });
    },
  };

  window.VoiceAssistant = VoiceAssistant;

})();
