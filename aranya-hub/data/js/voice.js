/* ================================================================
   Aranya Resort — Voice Assistant Module
   MediaRecorder audio capture + WebSocket pipeline + speech playback
   ================================================================ */

(function () {
  'use strict';

  // ================================================================
  // CONFIGURATION
  // ================================================================

  var WS_RECONNECT_DELAY = 2000;
  var MAX_RECORDING_TIME = 30000;

  // ================================================================
  // STATE
  // ================================================================

  var mediaRecorder = null;
  var mediaStream = null;
  var isListening = false;
  var audioChunks = [];
  var audioWs = null;
  var wsReconnectTimer = null;
  var processingTimer = null;
  var transcriptOverlayTimer = null;
  var lastTranscriptText = '';
  var sentToServer = false;
  var isStopping = false;
  var recordingTimer = null;
  var cancelPendingCapture = false;

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

    // Hold-to-talk: press to record, release to send.
    dom.voiceFab.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      console.log('Voice FAB pressed');
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
  // MEDIA RECORDER HELPERS
  // ================================================================

  function getBestMimeType () {
    var types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4;codecs=mp4a.40.2'
    ];
    for (var i = 0; i < types.length; i++) {
      if (MediaRecorder.isTypeSupported(types[i])) return types[i];
    }
    return '';
  }

  function startCapture (onCaptured) {
    if (mediaRecorder) return false;

    try {
      cancelPendingCapture = false;
      var constraints = { audio: true };
      navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
        if (cancelPendingCapture) {
          stream.getTracks().forEach(function (t) { t.stop(); });
          return;
        }

        mediaStream = stream;
        audioChunks = [];

        var mimeType = getBestMimeType();
        var options = {};
        if (mimeType) options.mimeType = mimeType;

        mediaRecorder = new MediaRecorder(stream, options);
        console.log('MediaRecorder: ' + (mediaRecorder.mimeType || 'default'));

        mediaRecorder.ondataavailable = function (e) {
          if (e.data && e.data.size > 0) {
            audioChunks.push(e.data);
          }
        };

        mediaRecorder.onstop = function () {
          if (mediaStream) {
            mediaStream.getTracks().forEach(function (t) { t.stop(); });
            mediaStream = null;
          }

          if (audioChunks.length > 0) {
            var blob = new Blob(audioChunks, { type: mediaRecorder ? mediaRecorder.mimeType : 'audio/webm' });
            audioChunks = [];

            var reader = new FileReader();
            reader.onloadend = function () {
              var base64 = reader.result.split(',')[1];
              if (onCaptured) onCaptured(base64);
            };
            reader.onerror = function () {
              console.error('FileReader error');
              resetFabToIdle();
            };
            reader.readAsDataURL(blob);
          } else {
            console.warn('No audio captured');
            resetFabToIdle();
          }

          mediaRecorder = null;
        };

        mediaRecorder.onerror = function () {
          console.error('MediaRecorder error');
          cleanupRecording();
          resetFabToIdle();
        };

        mediaRecorder.start();
        isListening = true;
        lastTranscriptText = '';
        sentToServer = false;
        showTranscriptOverlay();
        setTranscriptState('listening');
        console.log('Recording started');

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
      console.error('Failed to start capture:', e);
      return false;
    }
  }

  // ================================================================
  // INTERNAL — Recorded Audio Handling
  // ================================================================

  function resetFabToIdle () {
    dom.voiceFab.className = 'voice-fab voice-idle';
    hideTranscriptOverlay();
    isListening = false;
  }

  function sendAudioToServer (base64Audio) {
    if (isStopping) return;

    if (audioWs && audioWs.readyState === WebSocket.OPEN) {
      console.log('Sending audio (' + base64Audio.length + 'B base64)');
      audioWs.send(JSON.stringify({ type: 'audio', data: base64Audio }));
      sentToServer = true;
      setProcessingTimeout();
      dom.voiceFab.className = 'voice-fab voice-processing';
      setTranscriptState('processing');
    } else {
      console.error('Audio WS not connected');
      window.toast('Voice server disconnected', 'error');
      dom.voiceFab.className = 'voice-fab voice-idle';
      sentToServer = false;
      setTranscriptState('response', 'Voice server disconnected');
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

  function cleanupRecording () {
    if (mediaStream) {
      mediaStream.getTracks().forEach(function (t) { t.stop(); });
      mediaStream = null;
    }
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.stop(); } catch (_) { /* ignore */ }
    }
    mediaRecorder = null;
    audioChunks = [];
    if (recordingTimer) {
      clearTimeout(recordingTimer);
      recordingTimer = null;
    }
  }

  function stopListening () {
    if (isStopping) return;
    isStopping = true;
    cancelPendingCapture = true;

    clearProcessingTimer();
    isListening = false;

    if (recordingTimer) {
      clearTimeout(recordingTimer);
      recordingTimer = null;
    }

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.stop(); } catch (_) { /* ignore */ }
    } else {
      cleanupRecording();
      if (dom.voiceTranscript) hideTranscriptOverlay();
      dom.voiceFab.className = 'voice-fab voice-idle';
    }

    if (sentToServer && dom.voiceTranscript) {
      dom.voiceFab.className = 'voice-fab voice-processing';
      setProcessingTimeout();
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

      return startCapture(function (base64Audio) {
        lastTranscriptText = '';
        sendAudioToServer(base64Audio);
      });
    },

    stopListening: stopListening,

    connectVoiceWs: function (url) {
      connectAudioWs(url);
    },

    playAudio: function (input) {
      if (typeof input === 'string') {
        if (input.startsWith('data:audio/wav;base64,') || input.length > 1000) {
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
      var audioCtx = new (window.AudioContext || window.webkitAudioContext)();

      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      audioCtx.decodeAudioData(buffer, function (audioBuffer) {
        var source = audioCtx.createBufferSource();
        var gainNode = audioCtx.createGain();

        source.buffer = audioBuffer;
        gainNode.gain.value = 0.8;

        var now = audioCtx.currentTime;
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.8, now + 0.1);
        gainNode.gain.setValueAtTime(0.8, now + audioBuffer.duration - 0.1);
        gainNode.gain.linearRampToValueAtTime(0, now + audioBuffer.duration);

        source.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        source.start(0);
      }, function (e) {
        console.error('Error decoding audio', e);
      });
    },
  };

  window.VoiceAssistant = VoiceAssistant;

})();
