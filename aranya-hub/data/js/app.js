/* ================================================================
   Aranya Resort — Guest Dashboard JS
   Scene control, room management, WebSocket, & UI
   ================================================================ */

(function () {
  'use strict';

  // ================================================================
  // CONFIGURATION
  // ================================================================

  const CONFIG_PATH = 'config.json';
  const SCENES_PATH = 'scenes.json';
  const WS_RECONNECT_DELAY = 3000;
  const TOAST_DURATION = 3500;

  // ================================================================
  // STATE
  // ================================================================

  let config = null;
  let scenes = null;
  let ws = null;
  let wsReconnectTimer = null;
  let clockInterval = null;
  let selectedRoomId = null;
  let activeSceneId = null;
  let currentTemp = 24;
  let acOn = false;
  let blindsState = {};
  let activeLighting = null;
  let activeService = null;

  // ================================================================
  // DOM CACHE
  // ================================================================

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  const dom = {};

  function cacheDom () {
    dom.clockTime       = $('#clockTime');
    dom.clockDate       = $('#clockDate');
    dom.connDot         = $('#connDot');
    dom.connText        = $('#connText');
    dom.connBar         = $('#connBar');
    dom.scenesGrid      = $('#scenesGrid');
    dom.refreshScenes   = $('#refreshScenes');
    dom.roomSelector    = $('#roomSelector');
    dom.roomControls    = $('#roomControls');
    dom.roomStatus      = $('#roomStatus');
    dom.lightingGrid    = $('#lightingGrid');
    dom.lightStatus     = $('#lightStatus');
    dom.serviceGrid     = $('#serviceGrid');
    dom.serviceStatus   = $('#serviceStatus');
    dom.toastContainer  = $('#toastContainer');
    dom.svcModal        = $('#svcModal');
    dom.svcModalIcon    = $('#svcModalIcon');
    dom.svcModalTitle   = $('#svcModalTitle');
    dom.svcModalDesc    = $('#svcModalDesc');
    dom.svcModalTime    = $('#svcModalTime');
    dom.svcModalBtn     = $('#svcModalBtn');
  }

  // ================================================================
  // UTILITY
  // ================================================================

  function escapeHtml (str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function pad (n) { return n < 10 ? '0' + n : '' + n; }

  function now () { return new Date(); }

  function formatTime (d) {
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function formatDate (d) {
    var opts = { weekday: 'short', month: 'short', day: 'numeric' };
    return d.toLocaleDateString('en-US', opts);
  }

  function timeAgo (date) {
    var diff = Math.floor((now() - date) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return formatTime(date);
  }

  // ================================================================
  // TOAST
  // ================================================================

  function toast (message, type) {
    type = type || 'success';
    var container = dom.toastContainer;
    var el = document.createElement('div');
    el.className = 'toast toast-' + type;

    var icons = { success: '\u2713', error: '\u2717', info: '\u24D8' };
    var icon = icons[type] || '\u24D8';

    el.innerHTML =
      '<span class="toast-icon">' + icon + '</span>' +
      '<span class="toast-body">' + escapeHtml(message) + '</span>';

    container.appendChild(el);

    setTimeout(function () {
      el.classList.add('toast-out');
      setTimeout(function () { if (el.parentNode) el.remove(); }, 300);
    }, TOAST_DURATION);
  }

  // ================================================================
  // CLOCK
  // ================================================================

  function updateClock () {
    var d = now();
    dom.clockTime.textContent = formatTime(d);
    dom.clockDate.textContent = formatDate(d);
  }

  function startClock () {
    updateClock();
    clockInterval = setInterval(updateClock, 10000);
  }

  // ================================================================
  // DATA LOADING
  // ================================================================

  function loadConfig () {
    return fetch(CONFIG_PATH)
      .then(function (r) { if (!r.ok) throw new Error('Failed to load config'); return r.json(); })
      .then(function (data) { config = data; return data; });
  }

  function loadScenes () {
    return fetch(SCENES_PATH)
      .then(function (r) { if (!r.ok) throw new Error('Failed to load scenes'); return r.json(); })
      .then(function (data) { scenes = data; return data; });
  }

  // ================================================================
  // WEBSOCKET
  // ================================================================

  function setConnState (state) {
    dom.connDot.className = 'conn-dot ' + state;
    var labels = {
      connected: 'Connected',
      connecting: 'Connecting...',
      disconnected: 'Disconnected'
    };
    dom.connText.textContent = labels[state] || state;
  }

  function connectWs () {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

    setConnState('connecting');

    var url = config && config.ws_url ? config.ws_url : 'ws://farmhouse.local/ws';

    try {
      ws = new WebSocket(url);
    } catch (e) {
      setConnState('disconnected');
      scheduleReconnect();
      return;
    }

    ws.onopen = function () {
      setConnState('connected');
      toast('Connected to resort system', 'success');
    };

    ws.onmessage = function (e) {
      try {
        var msg = JSON.parse(e.data);
        handleWsMessage(msg);
      } catch (_) {}
    };

    ws.onclose = function () {
      setConnState('disconnected');
      ws = null;
      scheduleReconnect();
    };

    ws.onerror = function () {
      if (ws) ws.close();
    };
  }

  function scheduleReconnect () {
    if (wsReconnectTimer) return;
    wsReconnectTimer = setTimeout(function () {
      wsReconnectTimer = null;
      connectWs();
    }, WS_RECONNECT_DELAY);
  }

  function wsSend (data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  function handleWsMessage (msg) {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'state':
        // { type: "state", room_id: N, device_type: N, action_value: N }
        if (msg.room_id !== undefined && msg.device_type !== undefined) {
          updateDeviceState(msg.room_id, msg.device_type, msg.action_value);
        }
        break;

      case 'ack':
        // Server acknowledged our command
        if (msg.message) toast(msg.message, 'info');
        break;

      case 'error':
        if (msg.message) toast(msg.message, 'error');
        break;

      default:
        break;
    }
  }

  function updateDeviceState (roomId, deviceType, value) {
    // Update UI based on received state
    if (roomId == selectedRoomId) {
      switch (Number(deviceType)) {
        case 1: // Light
          // Handled by lighting presets
          break;
        case 2: // AC
          acOn = value > 0;
          currentTemp = value > 0 ? value : currentTemp;
          renderAcControls();
          break;
        case 3: // Blind
          blindsState[roomId] = value ? 'open' : 'close';
          renderBlindControls();
          break;
        case 4: // Service
          handleServiceState(value);
          break;
      }
    }
  }

  function handleServiceState (value) {
    // value: 0 = none, 1 = silent service, 2 = do not disturb
    var svcMap = { 0: null, 1: 'silent', 2: 'dnd' };
    activeService = svcMap[value] || null;
    renderServiceBar();

    if (activeService) {
      var labels = { silent: 'Silent Service active', dnd: 'Do Not Disturb active' };
      dom.serviceStatus.textContent = labels[activeService] || 'Active';
    } else {
      dom.serviceStatus.textContent = 'None active';
    }
  }

  // ================================================================
  // SCENE RENDER
  // ================================================================

  function renderScenes () {
    if (!scenes || !scenes.scenes) {
      dom.scenesGrid.innerHTML = '<div class="loading-overlay">No scenes available</div>';
      return;
    }

    var html = '';
    scenes.scenes.forEach(function (scene) {
      var active = scene.id === activeSceneId ? ' active' : '';
      html +=
        '<div class="scene-card' + active + '" data-scene-id="' + scene.id + '">' +
          '<div class="scene-icon">' + (scene.icon || '\u{1F306}') + '</div>' +
          '<div class="scene-name">' + escapeHtml(scene.name) + '</div>' +
          '<div class="scene-desc">' + escapeHtml(scene.description || '') + '</div>' +
        '</div>';
    });

    dom.scenesGrid.innerHTML = html;

    // Attach click handlers
    $$('.scene-card', dom.scenesGrid).forEach(function (card) {
      card.addEventListener('click', function () {
        var id = parseInt(card.getAttribute('data-scene-id'), 10);
        activateScene(id);
      });
    });
  }

  function activateScene (sceneId) {
    if (!scenes || !scenes.scenes) return;

    var scene = scenes.scenes.filter(function (s) { return s.id === sceneId; })[0];
    if (!scene) return;

    activeSceneId = sceneId;
    renderScenes();

    // Apply scene presets locally
    if (scene.presets) {
      if (scene.presets.lighting) {
        setLightingPreset(scene.presets.lighting);
      }
      if (scene.presets.ac !== undefined) {
        currentTemp = scene.presets.ac;
        acOn = true;
        renderAcControls();
      }
      if (scene.presets.blinds) {
        if (selectedRoomId) {
          blindsState[selectedRoomId] = scene.presets.blinds;
          renderBlindControls();
        }
      }
    }

    // Send scene command via WebSocket
    var sent = wsSend({ type: 'scene', scene_id: sceneId });
    if (!sent) toast('Scene queued (offline)', 'info');

    toast('Activating ' + scene.name + '...', 'success');
  }

  // ================================================================
  // ROOM SELECTOR
  // ================================================================

  function renderRoomSelector () {
    if (!config || !config.nodes) return;

    var html = '<option value="">-- Select a room --</option>';
    config.nodes.forEach(function (node) {
      var sel = node.id === selectedRoomId ? ' selected' : '';
      html += '<option value="' + node.id + '"' + sel + '>' + escapeHtml(node.name) + '</option>';
    });

    dom.roomSelector.innerHTML = html;
  }

  function selectRoom (roomId) {
    selectedRoomId = roomId;
    renderRoomSelector();
    renderRoomControls();
  }

  // ================================================================
  // ROOM CONTROLS
  // ================================================================

  function renderRoomControls () {
    if (!selectedRoomId) {
      dom.roomControls.innerHTML =
        '<div class="loading-overlay" style="padding:1rem;font-size:0.8rem;">Select a room to control</div>';
      dom.roomStatus.textContent = '';
      return;
    }

    var roomName = '';
    if (config && config.nodes) {
      var node = config.nodes.filter(function (n) { return n.id === selectedRoomId; })[0];
      if (node) roomName = node.name;
    }

    dom.roomStatus.textContent = roomName;

    var html = '';
    // AC Control
    html += '<div class="temp-dial-wrap">' +
              '<div class="temp-dial" id="tempDial">' +
                '<svg viewBox="0 0 120 120">' +
                  '<circle class="track" cx="60" cy="60" r="55"/>' +
                  '<circle class="arc" id="tempArc" cx="60" cy="60" r="55"/>' +
                '</svg>' +
                '<div class="knob" id="tempKnob">' + currentTemp + '\u00B0</div>' +
              '</div>' +
              '<div class="temp-display">' +
                '<span class="temp-value" id="tempValue">' + currentTemp + '</span>' +
                '<span class="temp-unit">&deg;C</span>' +
              '</div>' +
              '<div class="temp-status" id="acStatus">' + (acOn ? 'AC On \u00B7 Cooling' : 'AC Off') + '</div>' +
              '<div class="temp-controls">' +
                '<button class="temp-btn" id="tempDown">&minus;</button>' +
                '<button class="temp-btn" id="tempToggle">' + (acOn ? '\u2744' : '\u2600') + '</button>' +
                '<button class="temp-btn" id="tempUp">+</button>' +
              '</div>' +
            '</div>';

    // Blind Controls
    html += '<div class="control-row">' +
              '<span class="control-label">Blinds <span class="hint">Curtain position</span></span>' +
              '<div class="blind-controls" id="blindControls">' +
                '<button class="blind-btn" data-blind="open">' +
                  '<span class="blind-icon">&#9788;</span>Open' +
                '</button>' +
                '<button class="blind-btn" data-blind="close">' +
                  '<span class="blind-icon">&#9789;</span>Close' +
                '</button>' +
              '</div>' +
            '</div>';

    dom.roomControls.innerHTML = html;

    // Attach AC event handlers
    renderAcControls();
    renderBlindControls();

    // Temp buttons
    $('#tempDown').addEventListener('click', function () { adjustTemp(-1); });
    $('#tempUp').addEventListener('click', function () { adjustTemp(1); });
    $('#tempToggle').addEventListener('click', function () {
      acOn = !acOn;
      sendAcCommand();
      renderAcControls();
      toast(acOn ? 'AC turned on' : 'AC turned off', acOn ? 'success' : 'info');
    });

    // Temp dial drag
    setupTempDial();

    // Blind buttons
    $$('.blind-btn', dom.roomControls).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.getAttribute('data-blind');
        blindsState[selectedRoomId] = action;
        renderBlindControls();
        sendBlindCommand(action);
        toast('Blinds ' + action + 'ed', 'success');
      });
    });
  }

  // ================================================================
  // AC TEMPERATURE DIAL
  // ================================================================

  function getTempArc (temp) {
    var min = 16, max = 30;
    var fraction = (temp - min) / (max - min);
    var circumference = 2 * Math.PI * 55; // r=55
    var offset = circumference * (1 - fraction);
    return { circumference: circumference, offset: offset, fraction: fraction };
  }

  function updateTempArc (temp) {
    var arc = $('#tempArc');
    var val = $('#tempValue');
    var knob = $('#tempKnob');
    if (!arc || !val || !knob) return;

    var t = getTempArc(temp);
    arc.style.strokeDasharray = t.circumference;
    arc.style.strokeDashoffset = t.offset;

    val.textContent = temp;
    if (knob) knob.textContent = temp + '\u00B0';

    var status = $('#acStatus');
    if (status) {
      status.textContent = acOn ? 'AC On \u00B7 ' + temp + '\u00B0C' : 'AC Off';
    }
  }

  function renderAcControls () {
    updateTempArc(currentTemp);

    var toggle = $('#tempToggle');
    var status = $('#acStatus');
    if (toggle) toggle.textContent = acOn ? '\u2744' : '\u2600';
    if (status) status.textContent = acOn ? 'AC On \u00B7 ' + currentTemp + '\u00B0C' : 'AC Off';
  }

  function adjustTemp (delta) {
    var newTemp = currentTemp + delta;
    if (newTemp < 16) newTemp = 16;
    if (newTemp > 30) newTemp = 30;
    if (newTemp === currentTemp) return;
    currentTemp = newTemp;
    acOn = true;
    updateTempArc(currentTemp);
    sendAcCommand();

    var toggle = $('#tempToggle');
    if (toggle) toggle.textContent = '\u2744';
  }

  function sendAcCommand () {
    if (!selectedRoomId) return;
    var value = acOn ? currentTemp : 0;
    wsSend({
      type: 'control',
      room_id: selectedRoomId,
      device_type: 2,
      action_value: value
    });
  }

  function sendBlindCommand (action) {
    if (!selectedRoomId) return;
    wsSend({
      type: 'control',
      room_id: selectedRoomId,
      device_type: 3,
      action_value: action === 'open' ? 1 : 0
    });
  }

  // ================================================================
  // TEMPERATURE DIAL DRAG
  // ================================================================

  function setupTempDial () {
    var dial = $('#tempDial');
    var knob = $('#tempKnob');
    if (!dial || !knob) return;

    var isDragging = false;

    function getTempFromEvent (clientX, clientY) {
      var rect = dial.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var dx = clientX - cx;
      var dy = clientY - cy;
      var angle = Math.atan2(dy, dx) * (180 / Math.PI);
      // Map angle to temp: -135deg = 16C, 135deg = 30C
      var minAngle = -135, maxAngle = 135;
      var clamped = Math.max(minAngle, Math.min(maxAngle, angle));
      var fraction = (clamped - minAngle) / (maxAngle - minAngle);
      var temp = Math.round(16 + fraction * 14);
      return Math.max(16, Math.min(30, temp));
    }

    function onStart (e) {
      e.preventDefault();
      isDragging = true;
      var point = e.touches ? e.touches[0] : e;
      var temp = getTempFromEvent(point.clientX, point.clientY);
      currentTemp = temp;
      acOn = true;
      updateTempArc(currentTemp);
      if (knob) knob.style.cursor = 'grabbing';
    }

    function onMove (e) {
      if (!isDragging) return;
      e.preventDefault();
      var point = e.touches ? e.touches[0] : e;
      var temp = getTempFromEvent(point.clientX, point.clientY);
      if (temp !== currentTemp) {
        currentTemp = temp;
        acOn = true;
        updateTempArc(currentTemp);
      }
    }

    function onEnd () {
      if (!isDragging) return;
      isDragging = false;
      if (knob) knob.style.cursor = 'grab';
      sendAcCommand();
    }

    // Mouse events
    knob.addEventListener('mousedown', onStart);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);

    // Touch events
    knob.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  }

  // ================================================================
  // BLIND CONTROLS
  // ================================================================

  function renderBlindControls () {
    if (!selectedRoomId) return;
    var state = blindsState[selectedRoomId];
    $$('.blind-btn', dom.roomControls).forEach(function (btn) {
      var action = btn.getAttribute('data-blind');
      btn.classList.toggle('active', action === state);
    });
  }

  // ================================================================
  // LIGHTING PRESETS
  // ================================================================

  var lightingPresets = [
    { id: 'sunrise', icon: '\u{1F305}', label: 'Sunrise', desc: 'Warm glow' },
    { id: 'reading', icon: '\u{1F4DA}', label: 'Reading', desc: 'Bright focus' },
    { id: 'dusk', icon: '\u{1F319}', label: 'Dusk', desc: 'Soft amber' }
  ];

  function renderLighting () {
    var html = '';
    lightingPresets.forEach(function (p) {
      var active = p.id === activeLighting ? ' active' : '';
      html +=
        '<button class="lighting-btn' + active + '" data-lighting="' + p.id + '">' +
          '<span class="lt-icon">' + p.icon + '</span>' +
          '<span class="lt-label">' + p.label + '</span>' +
        '</button>';
    });

    dom.lightingGrid.innerHTML = html;

    $$('.lighting-btn', dom.lightingGrid).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-lighting');
        setLightingPreset(id);
      });
    });
  }

  function setLightingPreset (id) {
    activeLighting = id;
    renderLighting();

    var labels = { sunrise: 'Sunrise', reading: 'Reading', dusk: 'Dusk' };
    dom.lightStatus.textContent = labels[id] || 'Custom';

    // Send lighting command
    if (selectedRoomId) {
      wsSend({
        type: 'control',
        room_id: selectedRoomId,
        device_type: 1,
        action_value: lightingPresets.findIndex(function (p) { return p.id === id; }) + 1
      });
    }

    toast(labels[id] + ' lighting activated', 'success');
  }

  // ================================================================
  // SERVICE BAR
  // ================================================================

  var services = [
    { id: 'silent', icon: '\u{1F507}', label: 'Silent Service', desc: 'No housekeeping' },
    { id: 'dnd', icon: '\u{1F6AB}', label: 'Do Not Disturb', desc: 'Privacy please' }
  ];

  function renderServiceBar () {
    var html = '';
    services.forEach(function (svc) {
      var active = svc.id === activeService ? ' active' : '';
      html +=
        '<button class="service-btn' + active + '" data-service="' + svc.id + '">' +
          '<span class="svc-icon">' + svc.icon + '</span>' +
          '<span class="svc-label">' + svc.label + '</span>' +
          '<span class="svc-desc">' + svc.desc + '</span>' +
        '</button>';
    });

    dom.serviceGrid.innerHTML = html;

    $$('.service-btn', dom.serviceGrid).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-service');
        toggleService(id);
      });
    });
  }

  function toggleService (id) {
    var newState = activeService === id ? null : id;
    activeService = newState;
    renderServiceBar();

    // Map service to action value
    // 0 = none, 1 = silent service, 2 = do not disturb
    var valMap = { silent: 1, dnd: 2 };
    var value = newState ? (valMap[newState] || 0) : 0;

    wsSend({
      type: 'service',
      action: value
    });

    if (newState) {
      var labels = { silent: 'Silent Service', dnd: 'Do Not Disturb' };
      var icons = { silent: '\u{1F507}', dnd: '\u{1F6AB}' };
      dom.serviceStatus.textContent = labels[newState] + ' active';

      // Show modal
      dom.svcModalIcon.textContent = icons[newState];
      dom.svcModalTitle.textContent = labels[newState] + ' ON';
      dom.svcModalDesc.textContent = labels[newState] === 'Silent Service'
        ? 'Housekeeping will not disturb you. Please use the front desk for requests.'
        : 'Your privacy is respected. Staff will not knock or call.';
      dom.svcModalTime.textContent = 'Activated ' + formatTime(now());
      dom.svcModal.classList.add('active');

      toast(labels[newState] + ' activated', 'info');
    } else {
      dom.serviceStatus.textContent = 'None active';
      toast('Service request cancelled', 'info');
    }
  }

  // ================================================================
  // INITIALIZATION
  // ================================================================

  function init () {
    cacheDom();

    // Integration check — VoiceAssistant should be provided by voice.js
    if (typeof window.VoiceAssistant !== 'object') {
      console.warn('[Voice] VoiceAssistant not found — voice.js may be missing');
    } else {
      console.log('[Voice] VoiceAssistant detected, version:', Object.keys(window.VoiceAssistant).join(', '));
    }

    startClock();

    // Load data
    Promise.all([loadConfig(), loadScenes()])
      .then(function () {
        renderScenes();
        renderRoomSelector();
        renderLighting();
        renderServiceBar();

        // Connect WebSocket after config loaded
        connectWs();
      })
      .catch(function (err) {
        toast('Failed to load: ' + err.message, 'error');
        // Try connecting anyway
        connectWs();
      });

    // Room selector change
    dom.roomSelector.addEventListener('change', function () {
      var val = dom.roomSelector.value;
      selectRoom(val ? parseInt(val, 10) : null);
    });

    // Refresh scenes
    dom.refreshScenes.addEventListener('click', function () {
      loadScenes().then(function () {
        renderScenes();
        toast('Scenes refreshed', 'success');
      }).catch(function () {
        toast('Failed to refresh scenes', 'error');
      });
    });

    // Service modal dismiss
    dom.svcModalBtn.addEventListener('click', function () {
      dom.svcModal.classList.remove('active');
    });
    dom.svcModal.addEventListener('click', function (e) {
      if (e.target === dom.svcModal) dom.svcModal.classList.remove('active');
    });
  }

  // ================================================================
  // BOOT
  // ================================================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
