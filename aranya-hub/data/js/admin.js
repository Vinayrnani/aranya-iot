/* ================================================================
   Aranya Resort — Admin Dashboard JS
   Handles authentication, API calls, form validation, and UI updates
   ================================================================ */

(function () {
  'use strict';

  // ================================================================
  // CONFIGURATION
  // ================================================================

  const CREDENTIALS = {
    username: 'admin',
    password: 'aranya2024',
  };

  const API_BASE = ''; // same-origin
  const POLL_INTERVAL = 5000; // 5s for activity log
  const TOAST_DURATION = 3000; // 3s auto-dismiss for success

  // ================================================================
  // STATE
  // ================================================================

  let authToken = null; // base64 "username:password"
  let logPollTimer = null;
  let isLoggedIn = false;

  // ================================================================
  // DOM CACHE
  // ================================================================

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  const dom = {};

  function cacheDom () {
    dom.loginOverlay    = $('#loginOverlay');
    dom.loginForm       = $('#loginForm');
    dom.loginUser       = $('#loginUser');
    dom.loginPass       = $('#loginPass');
    dom.loginBtn        = $('#loginBtn');
    dom.loginBtnText    = $('#loginBtnText');
    dom.loginBtnSpinner = $('#loginBtnSpinner');
    dom.loginError      = $('#loginError');

    dom.confirmModal    = $('#confirmModal');
    dom.confirmTitle    = $('#confirmTitle');
    dom.confirmBody     = $('#confirmBody');
    dom.confirmOk       = $('#confirmOk');
    dom.confirmCancel   = $('#confirmCancel');

    dom.logoutBtn       = $('#logoutBtn');

    // status
    dom.statusBadge     = $('#statusBadge');
    dom.statHub         = $('#statHub');
    dom.statNodes       = $('#statNodes');
    dom.statUpdated     = $('#statUpdated');
    dom.statNetwork     = $('#statNetwork');

    // nodes
    dom.nodeList        = $('#nodeList');
    dom.saveNodesBtn    = $('#saveNodesBtn');
    dom.refreshNodesBtn = $('#refreshNodesBtn');
    dom.nodeCountBadge  = $('#nodeCountBadge');

    // network
    dom.wifiSsid        = $('#wifiSsid');
    dom.wifiPass        = $('#wifiPass');
    dom.updateConfigBtn = $('#updateConfigBtn');

    // log
    dom.logContainer    = $('#logContainer');
    dom.clearLogBtn     = $('#clearLogBtn');
    dom.autoRefreshInd  = $('#autoRefreshIndicator');

    dom.toastContainer  = $('#toastContainer');
  }

  // ================================================================
  // AUTHENTICATION
  // ================================================================

  function getStoredAuth () {
    try {
      return localStorage.getItem('aranya_admin_token');
    } catch (_) { return null; }
  }

  function storeAuth (token) {
    try { localStorage.setItem('aranya_admin_token', token); } catch (_) {}
  }

  function clearAuth () {
    try { localStorage.removeItem('aranya_admin_token'); } catch (_) {}
  }

  function buildToken (username, password) {
    return btoa(username + ':' + password);
  }

  function getAuthHeaders () {
    const headers = new Headers();
    headers.set('Authorization', 'Basic ' + authToken);
    headers.set('Content-Type', 'application/json');
    return headers;
  }

  // ================================================================
  // API HELPER
  // ================================================================

  async function apiFetch (path, options) {
    const url = API_BASE + path;
    const opts = options || {};
    const headers = getAuthHeaders();

    if (opts.headers) {
      opts.headers.forEach((v, k) => headers.set(k, v));
    }

    const merged = {
      headers,
      ...opts,
    };
    // Let fetch use native Headers — no mutation of serialised form
    delete merged.headers; // we pass headers separately
    const resp = await fetch(url, { ...merged, headers });

    if (resp.status === 401) {
      handleUnauthorized();
      throw new Error('Unauthorized — check credentials');
    }

    if (!resp.ok) {
      let msg = 'Request failed';
      try { const body = await resp.json(); msg = body.error || body.message || msg; } catch (_) {}
      throw new Error(msg + ' (HTTP ' + resp.status + ')');
    }

    // Some endpoints may return empty body (204)
    const text = await resp.text();
    return text ? JSON.parse(text) : {};
  }

  function apiGet (path) {
    return apiFetch(path, { method: 'GET' });
  }

  function apiPost (path, body) {
    return apiFetch(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  function handleUnauthorized () {
    isLoggedIn = false;
    clearAuth();
    authToken = null;
    stopLogPolling();
    showLogin();
    toast('Session expired. Please sign in again.', 'error');
  }

  // ================================================================
  // LOGIN FLOW
  // ================================================================

  function showLogin () {
    dom.loginOverlay.classList.remove('hidden');
    dom.loginForm.reset();
    dom.loginUser.value = 'admin';
    dom.loginPass.value = '';
    dom.loginError.style.display = 'none';
    dom.loginBtn.disabled = false;
    dom.loginBtnText.textContent = 'Sign In';
    dom.loginBtnSpinner.style.display = 'none';
    dom.loginUser.focus();
  }

  function hideLogin () {
    dom.loginOverlay.classList.add('hidden');
  }

  function attemptLogin (username, password) {
    const token = buildToken(username, password);
    authToken = token;

    // Test with a lightweight call
    return apiGet('/api/status')
      .then(function () {
        storeAuth(token);
        isLoggedIn = true;
        hideLogin();
        startApp();
      })
      .catch(function (err) {
        authToken = null;
        clearAuth();
        throw err;
      });
  }

  function tryStoredAuth () {
    const stored = getStoredAuth();
    if (!stored) return false;

    authToken = stored;
    // quick validation
    return apiGet('/api/status')
      .then(function () {
        isLoggedIn = true;
        hideLogin();
        startApp();
        return true;
      })
      .catch(function () {
        authToken = null;
        clearAuth();
        showLogin();
        return false;
      });
  }

  // ================================================================
  // TOAST NOTIFICATIONS
  // ================================================================

  function toast (message, type, duration) {
    type = type || 'success';
    duration = duration || (type === 'error' ? 0 : TOAST_DURATION);

    var container = dom.toastContainer;
    var toastEl = document.createElement('div');
    toastEl.className = 'toast toast-' + type;

    var icon = type === 'success' ? 'check-circle' : 'exclamation-circle';
    toastEl.innerHTML =
      '<i class="fas fa-' + icon + '"></i>' +
      '<span class="toast-body">' + escapeHtml(message) + '</span>' +
      '<button class="toast-close" onclick="void((function(el){el.parentElement.classList.add(\'toast-out\');setTimeout(function(){el.parentElement.remove()},300);})(this))">&times;</button>';

    container.appendChild(toastEl);

    if (duration > 0) {
      setTimeout(function () {
        if (toastEl.parentNode) {
          toastEl.classList.add('toast-out');
          setTimeout(function () { if (toastEl.parentNode) toastEl.remove(); }, 300);
        }
      }, duration);
    }
  }

  function escapeHtml (str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ================================================================
  // CONFIRM DIALOG
  // ================================================================

  function confirm (title, body) {
    return new Promise(function (resolve) {
      dom.confirmTitle.textContent = title;
      dom.confirmBody.textContent = body;
      dom.confirmModal.classList.remove('hidden');

      var cleanup = function () {
        dom.confirmModal.classList.add('hidden');
        dom.confirmOk.removeEventListener('click', onOk);
        dom.confirmCancel.removeEventListener('click', onCancel);
      };

      var onOk = function () { cleanup(); resolve(true); };
      var onCancel = function () { cleanup(); resolve(false); };

      dom.confirmOk.addEventListener('click', onOk);
      dom.confirmCancel.addEventListener('click', onCancel);
    });
  }

  // ================================================================
  // FORM VALIDATION
  // ================================================================

  var validators = {
    mac: function (val) {
      return /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(val.trim());
    },
    ssid: function (val) {
      return val.trim().length >= 1;
    },
    password: function (val) {
      return val.trim().length >= 8;
    },
    required: function (val) {
      return val.trim().length > 0;
    },
  };

  var macErrorMessage = 'Invalid MAC address (format: XX:XX:XX:XX:XX:XX)';
  var ssidErrorMessage = 'SSID must be at least 1 character';
  var passErrorMessage = 'Password must be at least 8 characters';

  function validateField (input, validatorFn, errorEl, errorMsg) {
    var valid = validatorFn(input.value);
    var parent = input.closest('.form-group') || input.closest('.node-item');
    if (!valid) {
      parent.classList.add('has-error');
      if (errorEl) {
        errorEl.textContent = errorMsg || 'Invalid value';
        errorEl.style.display = 'block';
      }
    } else {
      parent.classList.remove('has-error');
      if (errorEl) {
        errorEl.textContent = '';
        errorEl.style.display = 'none';
      }
    }
    return valid;
  }

  // ================================================================
  // SYSTEM STATUS
  // ================================================================

  function fetchStatus () {
    return apiGet('/api/status')
      .then(function (data) {
        var hub = data.hub || data.status || 'unknown';
        var nodes = data.connected_nodes || data.nodes || 0;
        var updated = data.last_update || data.updated || '—';
        var network = data.network || data.wifi || '—';

        dom.statHub.textContent = hub;
        dom.statHub.className = 's-value' + (hub === 'online' ? ' online' : ' offline');
        dom.statNodes.textContent = nodes;
        dom.statUpdated.textContent = updated;
        dom.statNetwork.textContent = network;
        dom.statusBadge.textContent = hub === 'online' ? 'Online' : 'Offline';
        dom.statusBadge.style.background = hub === 'online' ? 'var(--primary)' : '#b14a3a';
      });
  }

  // ================================================================
  // NODE MAPPING
  // ================================================================

  function fetchNodes () {
    dom.nodeList.innerHTML =
      '<div class="text-center" style="padding:1rem;color:#999;"><i class="fas fa-spinner fa-spin"></i> Loading nodes…</div>';

    return apiGet('/api/nodes')
      .then(function (data) {
        var nodes = data.nodes || data || [];
        renderNodes(nodes);
      })
      .catch(function (err) {
        dom.nodeList.innerHTML =
          '<div class="text-center" style="padding:1rem;color:#d1453b;"><i class="fas fa-exclamation-triangle"></i> Failed to load nodes: ' + escapeHtml(err.message) + '</div>';
        throw err;
      });
  }

  function renderNodes (nodes) {
    if (!nodes || nodes.length === 0) {
      dom.nodeList.innerHTML =
        '<div class="log-empty"><i class="fas fa-microchip"></i> No nodes configured</div>';
      dom.nodeCountBadge.textContent = '0 nodes';
      return;
    }

    var html = '';
    nodes.forEach(function (node, idx) {
      var nodeId = node.node_id || node.id || ('node_' + (idx + 1));
      var room   = node.room || node.room_name || '';
      var mac    = node.mac || node.mac_address || '';

      html +=
        '<div class="node-item" data-node-id="' + escapeHtml(nodeId) + '">' +
          '<div class="node-id">' + escapeHtml(nodeId) + '</div>' +
          '<div class="node-input-wrap">' +
            '<input type="text" class="node-room" placeholder="Room name" value="' + escapeHtml(room) + '">' +
          '</div>' +
          '<div class="node-input-wrap">' +
            '<input type="text" class="node-mac" placeholder="XX:XX:XX:XX:XX:XX" value="' + escapeHtml(mac) + '">' +
            '<div class="input-error">' + macErrorMessage + '</div>' +
          '</div>' +
        '</div>';
    });

    dom.nodeList.innerHTML = html;
    dom.nodeCountBadge.textContent = nodes.length + ' node' + (nodes.length !== 1 ? 's' : '');

    // Attach validation on input
    $$('.node-mac', dom.nodeList).forEach(function (input) {
      input.addEventListener('input', function () {
        var parent = input.closest('.node-item');
        var errEl = parent.querySelector('.input-error');
        validateField(input, validators.mac, errEl, macErrorMessage);
      });
    });
  }

  function collectNodeData () {
    var items = $$('.node-item', dom.nodeList);
    var nodes = [];

    items.forEach(function (item) {
      var nodeId = item.getAttribute('data-node-id');
      var room   = item.querySelector('.node-room').value.trim();
      var mac    = item.querySelector('.node-mac').value.trim();
      nodes.push({
        node_id: nodeId,
        room: room,
        mac_address: mac,
      });
    });

    return nodes;
  }

  function validateNodes (nodes) {
    var valid = true;
    $$('.node-item', dom.nodeList).forEach(function (item) {
      var macInput = item.querySelector('.node-mac');
      var errEl = item.querySelector('.input-error');
      var ok = validateField(macInput, validators.mac, errEl, macErrorMessage);
      if (!ok) valid = false;
    });
    return valid;
  }

  function saveNodes () {
    var nodes = collectNodeData();

    if (!validateNodes(nodes)) {
      toast('Please fix validation errors before saving', 'error');
      return Promise.reject(new Error('Validation failed'));
    }

    dom.saveNodesBtn.disabled = true;
    dom.saveNodesBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';

    return apiPost('/api/nodes', { nodes: nodes })
      .then(function (result) {
        toast('Node mapping saved successfully', 'success');
        return fetchNodes();
      })
      .catch(function (err) {
        toast('Failed to save nodes: ' + err.message, 'error');
        throw err;
      })
      .finally(function () {
        dom.saveNodesBtn.disabled = false;
        dom.saveNodesBtn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
      });
  }

  // ================================================================
  // NETWORK CONFIG
  // ================================================================

  function validateNetworkForm () {
    var ssidOk = true;
    var passOk = true;

    var ssidGroup = dom.wifiSsid.closest('.form-group');
    var passGroup = dom.wifiPass.closest('.form-group');

    if (!validators.ssid(dom.wifiSsid.value)) {
      ssidGroup.classList.add('has-error');
      ssidOk = false;
    } else {
      ssidGroup.classList.remove('has-error');
    }

    if (!validators.password(dom.wifiPass.value)) {
      passGroup.classList.add('has-error');
      passOk = false;
    } else {
      passGroup.classList.remove('has-error');
    }

    return ssidOk && passOk;
  }

  function clearNetworkErrors () {
    dom.wifiSsid.closest('.form-group').classList.remove('has-error');
    dom.wifiPass.closest('.form-group').classList.remove('has-error');
  }

  function updateNetworkConfig () {
    clearNetworkErrors();

    if (!validateNetworkForm()) {
      toast('Please fix validation errors before updating', 'error');
      return;
    }

    var ssid = dom.wifiSsid.value.trim();
    var pass = dom.wifiPass.value.trim();

    confirm(
      'Update Network Configuration?',
      'This will apply new WiFi settings (' + ssid + ') to the hub. The network may temporarily disconnect.'
    ).then(function (confirmed) {
      if (!confirmed) {
        toast('Network update cancelled', 'success');
        return;
      }

      dom.updateConfigBtn.disabled = true;
      dom.updateConfigBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating…';

      apiPost('/api/config', { wifi_ssid: ssid, wifi_password: pass })
        .then(function (result) {
          toast('Network configuration updated successfully', 'success');
          fetchStatus();
        })
        .catch(function (err) {
          toast('Failed to update network: ' + err.message, 'error');
        })
        .finally(function () {
          dom.updateConfigBtn.disabled = false;
          dom.updateConfigBtn.innerHTML = '<i class="fas fa-cog"></i> Update Network';
        });
    });
  }

  // ================================================================
  // ACTIVITY LOG
  // ================================================================

  function fetchLog () {
    return apiGet('/api/log')
      .then(function (data) {
        var entries = data.log || data.entries || data || [];
        renderLog(entries);
      })
      .catch(function (err) {
        dom.logContainer.innerHTML =
          '<div class="log-empty"><i class="fas fa-exclamation-triangle"></i> Failed to load log: ' + escapeHtml(err.message) + '</div>';
      });
  }

  function renderLog (entries) {
    if (!entries || entries.length === 0) {
      dom.logContainer.innerHTML =
        '<div class="log-empty"><i class="fas fa-inbox"></i> No log entries yet</div>';
      return;
    }

    var html = '';
    entries.forEach(function (entry) {
      var time = entry.timestamp || entry.time || entry.ts || '—';
      var msg  = entry.message || entry.description || entry.event || '—';

      // Format timestamp if it looks like ISO
      if (time.length > 10 && time.indexOf('T') > 0) {
        try {
          var d = new Date(time);
          time = d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        } catch (_) {}
      }

      html +=
        '<div class="log-entry">' +
          '<span class="log-time">' + escapeHtml(time) + '</span>' +
          '<span class="log-msg">' + escapeHtml(msg) + '</span>' +
        '</div>';
    });

    dom.logContainer.innerHTML = html;
    dom.logContainer.scrollTop = 0;
  }

  function startLogPolling () {
    stopLogPolling();
    logPollTimer = setInterval(function () {
      fetchLog().catch(function () {});
    }, POLL_INTERVAL);
    dom.autoRefreshInd.classList.add('active');
  }

  function stopLogPolling () {
    if (logPollTimer) {
      clearInterval(logPollTimer);
      logPollTimer = null;
    }
    dom.autoRefreshInd.classList.remove('active');
  }

  function clearLog () {
    confirm('Clear Activity Log?', 'This will permanently remove all log entries.')
      .then(function (confirmed) {
        if (!confirmed) return;
        dom.logContainer.innerHTML =
          '<div class="text-center" style="padding:1rem;color:#999;"><i class="fas fa-spinner fa-spin"></i> Clearing…</div>';
        apiPost('/api/log', { action: 'clear' })
          .then(function () {
            toast('Activity log cleared', 'success');
            fetchLog();
          })
          .catch(function (err) {
            toast('Failed to clear log: ' + err.message, 'error');
            fetchLog();
          });
      });
  }

  // ================================================================
  // APP LIFECYCLE
  // ================================================================

  function startApp () {
    // Initial fetches in parallel
    Promise.all([
      fetchStatus(),
      fetchNodes(),
      fetchLog(),
    ]).catch(function () {
      // partial failures handled per-function
    });

    // Start polling log
    startLogPolling();

    // Periodically refresh status
    setInterval(function () {
      fetchStatus().catch(function () {});
    }, POLL_INTERVAL * 2);
  }

  function init () {
    cacheDom();

    // --- Login form ---
    dom.loginForm.addEventListener('submit', function (e) {
      e.preventDefault();

      var user = dom.loginUser.value.trim();
      var pass = dom.loginPass.value;

      // Validate login fields
      var userGroup = dom.loginUser.closest('.form-group');
      var passGroup = dom.loginPass.closest('.form-group');
      var hasError = false;

      if (!validators.required(user)) {
        userGroup.classList.add('has-error');
        hasError = true;
      } else {
        userGroup.classList.remove('has-error');
      }

      if (!validators.required(pass)) {
        passGroup.classList.add('has-error');
        hasError = true;
      } else {
        passGroup.classList.remove('has-error');
      }

      if (hasError) return;

      dom.loginBtn.disabled = true;
      dom.loginBtnText.textContent = 'Signing In…';
      dom.loginBtnSpinner.style.display = 'inline-block';
      dom.loginError.style.display = 'none';

      attemptLogin(user, pass)
        .catch(function (err) {
          dom.loginError.textContent = err.message || 'Invalid credentials';
          dom.loginError.style.display = 'block';
        })
        .finally(function () {
          dom.loginBtn.disabled = false;
          dom.loginBtnText.textContent = 'Sign In';
          dom.loginBtnSpinner.style.display = 'none';
        });
    });

    // --- Login field realtime validation ---
    dom.loginUser.addEventListener('input', function () {
      var g = dom.loginUser.closest('.form-group');
      if (validators.required(dom.loginUser.value)) g.classList.remove('has-error');
    });
    dom.loginPass.addEventListener('input', function () {
      var g = dom.loginPass.closest('.form-group');
      if (validators.required(dom.loginPass.value)) g.classList.remove('has-error');
    });

    // --- Logout ---
    dom.logoutBtn.addEventListener('click', function (e) {
      e.preventDefault();
      confirm('Sign Out?', 'You will need to sign in again to access the admin panel.')
        .then(function (confirmed) {
          if (!confirmed) return;
          isLoggedIn = false;
          clearAuth();
          authToken = null;
          stopLogPolling();
          showLogin();
          toast('Signed out successfully', 'success');
        });
    });

    // --- Save nodes ---
    dom.saveNodesBtn.addEventListener('click', function () {
      saveNodes().catch(function () {});
    });

    // --- Refresh nodes ---
    dom.refreshNodesBtn.addEventListener('click', function () {
      dom.refreshNodesBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
      fetchNodes()
        .catch(function () {})
        .finally(function () {
          dom.refreshNodesBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
        });
    });

    // --- Update network config ---
    dom.updateConfigBtn.addEventListener('click', function () {
      updateNetworkConfig();
    });

    // --- Network form realtime validation ---
    dom.wifiSsid.addEventListener('input', function () {
      var g = dom.wifiSsid.closest('.form-group');
      if (validators.ssid(dom.wifiSsid.value)) g.classList.remove('has-error');
    });
    dom.wifiPass.addEventListener('input', function () {
      var g = dom.wifiPass.closest('.form-group');
      if (validators.password(dom.wifiPass.value)) g.classList.remove('has-error');
    });

    // --- Clear log ---
    dom.clearLogBtn.addEventListener('click', function () {
      clearLog();
    });

    // --- Bootstrap auth ---
    // Try stored token first, otherwise show login
    var stored = getStoredAuth();
    if (stored) {
      authToken = stored;
      apiGet('/api/status')
        .then(function () {
          isLoggedIn = true;
          hideLogin();
          startApp();
        })
        .catch(function () {
          authToken = null;
          clearAuth();
          showLogin();
        });
    } else {
      showLogin();
    }
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
