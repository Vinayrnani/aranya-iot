#include "web_server.h"
#include <WiFi.h>
#include <FS.h>
#include <LittleFS.h>

WebServer::WebServer(EspNowSender* esp_now) : _esp_now(esp_now) {
    _clients_mutex = xSemaphoreCreateMutex();
    _server = new AsyncWebServer(SERVER_PORT);
    _ws = new AsyncWebSocket("/ws");
}

WebServer::~WebServer() {
    if (_server) delete _server;
    if (_ws) delete _ws;
    if (_clients_mutex) vSemaphoreDelete(_clients_mutex);
}

bool WebServer::begin() {
    // Initialize LittleFS
    if (!LittleFS.begin(true)) {
        Serial.println("Failed to mount LittleFS");
        return false;
    }
    
    // Load configuration
    _load_config();
    _load_scenes();
    
    // Connect to WiFi
    WiFi.begin(_wifi_ssid.c_str(), _wifi_password.c_str());
    Serial.println("Connecting to WiFi...");
    
    int wifi_attempts = 0;
    while (WiFi.status() != WL_CONNECTED && wifi_attempts < 20) {
        delay(500);
        Serial.print(".");
        wifi_attempts++;
    }
    
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("\nFailed to connect to WiFi, starting AP mode");
        WiFi.softAP(_ap_ssid.c_str(), _ap_password.c_str());
        Serial.printf("AP started. IP: %s\n", WiFi.softAPIP().toString().c_str());
    } else {
        Serial.println("\nWiFi connected");
        Serial.printf("STA IP: %s\n", WiFi.localIP().toString().c_str());
        WiFi.softAP(_ap_ssid.c_str(), _ap_password.c_str());
        Serial.printf("AP IP: %s\n", WiFi.softAPIP().toString().c_str());
    }
    
    // Set up WebSocket
    _ws->onEvent([this](AsyncWebSocket *server, AsyncWebSocketClient *client,
                        AwsEventType type, void *arg, uint8_t *data, size_t len) {
        _on_ws_event(server, client, type, arg, data, len);
    });
    _server->addHandler(_ws);
    
    // API endpoints
    _server->on("/api/status", HTTP_GET, [this](AsyncWebServerRequest *request) {
        _handle_api_status(request);
    });
    
    _server->on("/api/scene", HTTP_POST, [this](AsyncWebServerRequest *request) {
        _handle_api_scene(request);
    });
    
    _server->on("/api/room/:id/control", HTTP_POST, [this](AsyncWebServerRequest *request) {
        _handle_api_room_control(request);
    });
    
    _server->on("/api/service", HTTP_POST, [this](AsyncWebServerRequest *request) {
        _handle_api_service(request);
    });
    
    _server->on("/api/nodes", HTTP_GET, [this](AsyncWebServerRequest *request) {
        _handle_api_nodes(request);
    });
    
    _server->on("/api/nodes", HTTP_POST, [this](AsyncWebServerRequest *request) {
        if (!_check_auth(request)) {
            return request->requestAuthentication();
        }
        _handle_api_nodes(request);
    });
    
    _server->on("/api/config", HTTP_POST, [this](AsyncWebServerRequest *request) {
        if (!_check_auth(request)) {
            return request->requestAuthentication();
        }
        _handle_api_config(request);
    });
    
    // Admin routes with auth
    _server->on("/admin", HTTP_GET, [this](AsyncWebServerRequest *request) {
        if (!_check_auth(request)) {
            return request->requestAuthentication();
        }
        request->send(LittleFS, "/admin.html", "text/html");
    });
    
    _server->on("/admin/*", HTTP_GET, [this](AsyncWebServerRequest *request) {
        if (!_check_auth(request)) {
            return request->requestAuthentication();
        }
        _serve_static_files();
    });
    
    // Serve static files
    _server->onNotFound([this](AsyncWebServerRequest *request) {
        _handle_not_found(request);
    });
    _serve_static_files();
    
    // Start server
    _server->begin();
    Serial.println("HTTP server started");
    return true;
}

bool WebServer::_check_auth(AsyncWebServerRequest *request) {
    if (!request->hasHeader("Authorization")) {
        return false;
    }
    
    String auth = request->getHeader("Authorization")->value();
    
    if (auth.startsWith("Basic")) {
        auth = auth.substring(6);
        auth.trim();
        
        // Base64 decode
        String credentials = String(base64_decode(auth));
        
        if (credentials == String(_admin_username) + ":" + String(_admin_password)) {
            return true;
        }
    }
    
    return false;
}

void WebServer::_on_ws_event(AsyncWebSocket *server, AsyncWebSocketClient *client, 
                            AwsEventType type, void *arg, uint8_t *data, size_t len) {
    switch (type) {
        case WS_EVT_CONNECT:
            {
                if (xSemaphoreTake(_clients_mutex, portMAX_DELAY) == pdTRUE) {
                    _clients.push_back(client);
                    xSemaphoreGive(_clients_mutex);
                }
                
                _ws_send_status_update();
                Serial.printf("WebSocket client connected: %u\n", client->id());
            }
            break;
            
        case WS_EVT_DISCONNECT:
            {
                if (xSemaphoreTake(_clients_mutex, portMAX_DELAY) == pdTRUE) {
                    for (auto it = _clients.begin(); it != _clients.end(); ++it) {
                        if (*it == client) {
                            _clients.erase(it);
                            break;
                        }
                    }
                    xSemaphoreGive(_clients_mutex);
                }
                Serial.printf("WebSocket client disconnected: %u\n", client->id());
            }
            break;
            
        case WS_EVT_DATA:
            {
                AwsFrameInfo *info = (AwsFrameInfo*)arg;
                if (info->final && info->index == 0 && info->len == len) {
                    data[len] = 0;
                    String message = String((char*)data);
                    DynamicJsonDocument doc(256);
                    DeserializationError error = deserializeJson(doc, message);
                    
                    if (!error && doc.containsKey("type")) {
                        // Handle WebSocket commands (if any)
                        _ws_send_status_update();
                    }
                }
            }
            break;
            
        case WS_EVT_PONG:
        case WS_EVT_ERROR:
            break;
    }
}

void WebServer::_ws_send_status_update() {
    DynamicJsonDocument doc(512);
    doc["type"] = "status_update";
    
    JsonObject wifi = doc.createNestedObject("wifi");
    wifi["status"] = (WiFi.status() == WL_CONNECTED) ? "connected" : "disconnected";
    wifi["rssi"] = WiFi.RSSI();
    
    JsonArray nodes = doc.createNestedArray("nodes");
    if (xSemaphoreTake(_clients_mutex, portMAX_DELAY) == pdTRUE) {
        for (const auto& node : _nodes) {
            JsonObject node_obj = nodes.createNestedObject();
            node_obj["mac"] = String(node.mac[0], HEX) + ":" +
                              String(node.mac[1], HEX) + ":" +
                              String(node.mac[2], HEX) + ":" +
                              String(node.mac[3], HEX) + ":" +
                              String(node.mac[4], HEX) + ":" +
                              String(node.mac[5], HEX);
            node_obj["name"] = node.name;
            node_obj["online"] = node.online;
        }
        xSemaphoreGive(_clients_mutex);
    }
    
    String json;
    serializeJson(doc, json);
    _ws_broadcast(json);
}

void WebServer::_ws_broadcast(const String& message) {
    if (xSemaphoreTake(_clients_mutex, portMAX_DELAY) == pdTRUE) {
        for (auto client : _clients) {
            client->text(message);
        }
        xSemaphoreGive(_clients_mutex);
    }
}

void WebServer::_handle_not_found(AsyncWebServerRequest *request) {
    if (request->url().startsWith("/admin/") && !_check_auth(request)) {
        return request->requestAuthentication();
    }
    
    if (request->url() == "/") {
        request->send(LittleFS, "/index.html", "text/html");
    } else {
        request->send(404, "text/plain", "Not found");
    }
}

void WebServer::_serve_static_files() {
    // Serve CSS
    _server->on("/css/style.css", HTTP_GET, [](AsyncWebServerRequest *request) {
        request->send(LittleFS, "/css/style.css", "text/css");
    });
    
    // Serve JS
    _server->on("/js/app.js", HTTP_GET, [](AsyncWebServerRequest *request) {
        request->send(LittleFS, "/js/app.js", "application/javascript");
    });
    
    _server->on("/js/admin.js", HTTP_GET, [this](AsyncWebServerRequest *request) {
        if (!_check_auth(request)) {
            return request->requestAuthentication();
        }
        request->send(LittleFS, "/js/admin.js", "application/javascript");
    });
    
    // Serve config files
    _server->on("/config.json", HTTP_GET, [this](AsyncWebServerRequest *request) {
        request->send(LittleFS, "/config.json", "application/json");
    });
    
    _server->on("/scenes.json", HTTP_GET, [this](AsyncWebServerRequest *request) {
        request->send(LittleFS, "/scenes.json", "application/json");
    });
}

void WebServer::_handle_api_status(AsyncWebServerRequest *request) {
    DynamicJsonDocument doc(1024);
    
    JsonObject system = doc.createNestedObject("system");
    system["uptime"] = millis() / 1000;
    system["heap_free"] = ESP.getFreeHeap();
    system["heap_min_free"] = ESP.getMinFreeHeap();
    system["fs_used"] = LittleFS.usedBytes();
    system["fs_total"] = LittleFS.totalBytes();
    
    JsonObject wifi = doc.createNestedObject("wifi");
    wifi["status"] = (WiFi.status() == WL_CONNECTED) ? "connected" : "disconnected";
    if (WiFi.status() == WL_CONNECTED) {
        wifi["ssid"] = WiFi.SSID();
        wifi["rssi"] = WiFi.RSSI();
        wifi["ip"] = WiFi.localIP().toString();
    } else {
        wifi["ap_ip"] = WiFi.softAPIP().toString();
    }

    JsonObject esp_now = doc.createNestedObject("esp_now");
    esp_now["initialized"] = _esp_now->is_initialized();
    esp_now["queue_size"] = _esp_now->get_queue_size();
    
    String json;
    serializeJson(doc, json);
    request->send(200, "application/json", json);
}

void WebServer::_handle_api_scene(AsyncWebServerRequest *request) {
    if (request->method() != HTTP_POST) {
        return request->send(405, "text/plain", "Method Not Allowed");
    }
    
    AsyncWebParameter* scene_param = request->getParam("scene", true);
    AsyncWebParameter* room_param = request->getParam("room", true);
    
    if (!scene_param || !room_param) {
        return request->send(400, "text/plain", "Missing scene or room parameter");
    }
    
    uint8_t scene_id = scene_param->value().toInt();
    uint8_t room_id = room_param->value().toInt();
    
    if (!_esp_now->send_scene(room_id, scene_id)) {
        return request->send(500, "text/plain", "Failed to send scene command");
    }
    
    _ws_send_status_update();
    request->send(200, "text/plain", "OK");
}

void WebServer::_handle_api_room_control(AsyncWebServerRequest *request) {
    if (request->method() != HTTP_POST) {
        return request->send(405, "text/plain", "Method Not Allowed");
    }
    
    int room_id = request->pathArg("id").toInt();
    if (room_id < MIN_ROOM_ID || room_id > MAX_ROOM_ID) {
        return request->send(400, "text/plain", "Invalid room ID");
    }
    
    AsyncWebParameter* device_param = request->getParam("device", true);
    AsyncWebParameter* action_param = request->getParam("action", true);
    
    if (!device_param || !action_param) {
        return request->send(400, "text/plain", "Missing device or action parameter");
    }
    
    String device = device_param->value();
    String action = action_param->value();
    bool success = false;
    
    if (device == "ac") {
        uint8_t temp = action.toInt();
        success = _esp_now->send_ac_control(room_id, temp);
    } else if (device == "blinds") {
        uint8_t position = action.toInt();
        success = _esp_now->send_blinds_control(room_id, position);
    } else if (device == "light") {
        uint8_t preset = action.toInt();
        success = _esp_now->send_light_control(room_id, preset);
    } else if (device == "led") {
        uint8_t scene = action.toInt();
        success = _esp_now->send_led_control(room_id, scene);
    }
    
    if (!success) {
        return request->send(500, "text/plain", "Failed to send command");
    }
    
    _ws_send_status_update();
    request->send(200, "text/plain", "OK");
}

void WebServer::_handle_api_service(AsyncWebServerRequest *request) {
    if (request->method() != HTTP_POST) {
        return request->send(405, "text/plain", "Method Not Allowed");
    }
    
    AsyncWebParameter* room_param = request->getParam("room", true);
    AsyncWebParameter* type_param = request->getParam("type", true);
    
    if (!room_param || !type_param) {
        return request->send(400, "text/plain", "Missing room or type parameter");
    }
    
    uint8_t room_id = room_param->value().toInt();
    uint8_t service_type = type_param->value().toInt();
    
    if (!_esp_now->send_service_request(room_id, service_type)) {
        return request->send(500, "text/plain", "Failed to send service request");
    }
    
    _ws_send_status_update();
    request->send(200, "text/plain", "OK");
}

void WebServer::_handle_api_nodes(AsyncWebServerRequest *request) {
    if (request->method() == HTTP_GET) {
        // Return list of nodes
        DynamicJsonDocument doc(2048);
        JsonArray nodes = doc.to<JsonArray>();
        
        if (xSemaphoreTake(_clients_mutex, portMAX_DELAY) == pdTRUE) {
            for (const auto& node : _nodes) {
                JsonObject node_obj = nodes.createNestedObject();
                node_obj["mac"] = String(node.mac[0], HEX) + ":" +
                                  String(node.mac[1], HEX) + ":" +
                                  String(node.mac[2], HEX) + ":" +
                                  String(node.mac[3], HEX) + ":" +
                                  String(node.mac[4], HEX) + ":" +
                                  String(node.mac[5], HEX);
                node_obj["name"] = node.name;
                node_obj["online"] = node.online;
            }
            xSemaphoreGive(_clients_mutex);
        }
        
        String json;
        serializeJson(doc, json);
        request->send(200, "application/json", json);
    } else if (request->method() == HTTP_POST) {
        // Update/add node
        if (request->contentType() != "application/json") {
            return request->send(400, "text/plain", "Content-Type must be application/json");
        }
        
        String body = request->_tempObject;
        DynamicJsonDocument doc(512);
        DeserializationError error = deserializeJson(doc, body);
        
        if (error || !doc.containsKey("mac") || !doc.containsKey("name")) {
            return request->send(400, "text/plain", "Invalid JSON: missing mac or name");
        }
        
        uint8_t mac[6];
        String mac_str = doc["mac"];
        sscanf(mac_str.c_str(), "%2hhx:%2hhx:%2hhx:%2hhx:%2hhx:%2hhx", 
               &mac[0], &mac[1], &mac[2], &mac[3], &mac[4], &mac[5]);
        
        String name = doc["name"];
        add_node(mac, name);
        
        _save_config();
        _ws_send_status_update();
        request->send(200, "text/plain", "OK");
    }
}

void WebServer::_handle_api_config(AsyncWebServerRequest *request) {
    if (request->contentType() != "application/json") {
        return request->send(400, "text/plain", "Content-Type must be application/json");
    }
    
    String body = request->_tempObject;
    DynamicJsonDocument doc(512);
    DeserializationError error = deserializeJson(doc, body);
    
    if (error) {
        return request->send(400, "text/plain", "Invalid JSON");
    }
    
    if (doc.containsKey("wifi_ssid")) {
        _wifi_ssid = doc["wifi_ssid"].as<String>();
    }
    
    if (doc.containsKey("wifi_password")) {
        _wifi_password = doc["wifi_password"].as<String>();
    }
    
    if (doc.containsKey("admin_password")) {
        _admin_password = doc["admin_password"].as<String>();
    }
    
    _save_config();
    request->send(200, "text/plain", "Config updated");
}

void WebServer::handle_client() {
    _ws->cleanupClients();
}

void WebServer::update() {
    // Periodic cleanup and status updates
    handle_client();
    
    // Check node timeouts
    bool nodes_changed = false;
    if (xSemaphoreTake(_clients_mutex, portMAX_DELAY) == pdTRUE) {
        for (auto& node : _nodes) {
            if (node.online && (millis() - node.last_seen) > 30000) {
                node.online = false;
                nodes_changed = true;
            }
        }
        xSemaphoreGive(_clients_mutex);
    }
    
    if (nodes_changed) {
        _ws_send_status_update();
    }
}

void WebServer::add_node(const uint8_t* mac, const String& name) {
    bool found = false;
    
    if (xSemaphoreTake(_clients_mutex, portMAX_DELAY) == pdTRUE) {
        for (auto& node : _nodes) {
            if (memcmp(node.mac, mac, 6) == 0) {
                node.name = name;
                node.online = true;
                node.last_seen = millis();
                found = true;
                break;
            }
        }
        
        if (!found) {
            NodeConfig new_node;
            memcpy(new_node.mac, mac, 6);
            new_node.name = name;
            new_node.online = true;
            new_node.last_seen = millis();
            _nodes.push_back(new_node);
        }
        
        xSemaphoreGive(_clients_mutex);
    }
}

void WebServer::remove_node(const uint8_t* mac) {
    if (xSemaphoreTake(_clients_mutex, portMAX_DELAY) == pdTRUE) {
        for (auto it = _nodes.begin(); it != _nodes.end(); ++it) {
            if (memcmp(it->mac, mac, 6) == 0) {
                _nodes.erase(it);
                break;
            }
        }
        xSemaphoreGive(_clients_mutex);
        _save_config();
    }
}

void WebServer::set_node_online(const uint8_t* mac, bool online) {
    bool changed = false;
    
    if (xSemaphoreTake(_clients_mutex, portMAX_DELAY) == pdTRUE) {
        for (auto& node : _nodes) {
            if (memcmp(node.mac, mac, 6) == 0) {
                if (node.online != online) {
                    node.online = online;
                    node.last_seen = millis();
                    changed = true;
                }
                break;
            }
        }
        xSemaphoreGive(_clients_mutex);
    }
    
    if (changed) {
        _ws_send_status_update();
    }
}

void WebServer::add_scene(const String& name, const String& description, JsonArray& devices) {
    // Check if scene exists
    for (auto& scene : _scenes) {
        if (scene.name == name) {
            scene.description = description;
            scene.devices = devices;
            _save_scenes();
            return;
        }
    }
    
    // Add new scene
    ScenePreset new_scene;
    new_scene.name = name;
    new_scene.description = description;
    new_scene.devices = devices;
    _scenes.push_back(new_scene);
    _save_scenes();
}

void WebServer::remove_scene(const String& name) {
    for (auto it = _scenes.begin(); it != _scenes.end(); ++it) {
        if (it->name == name) {
            _scenes.erase(it);
            _save_scenes();
            return;
        }
    }
}

void WebServer::_load_config() {
    if (!LittleFS.exists("/config.json")) {
        // Create default config
        DynamicJsonDocument doc(1024);
        doc["wifi_ssid"] = _wifi_ssid;
        doc["wifi_password"] = _wifi_password;
        doc["admin_password"] = _admin_password;
        
        File file = LittleFS.open("/config.json", "w");
        if (file) {
            serializeJson(doc, file);
            file.close();
        }
        return;
    }
    
    File file = LittleFS.open("/config.json", "r");
    if (file) {
        DynamicJsonDocument doc(1024);
        DeserializationError error = deserializeJson(doc, file);
        if (!error) {
            if (doc.containsKey("wifi_ssid")) {
                _wifi_ssid = doc["wifi_ssid"].as<String>();
            }
            if (doc.containsKey("wifi_password")) {
                _wifi_password = doc["wifi_password"].as<String>();
            }
            if (doc.containsKey("admin_password")) {
                _admin_password = doc["admin_password"].as<String>();
            }
            
            // Load nodes
            if (doc.containsKey("nodes")) {
                JsonArray nodes = doc["nodes"].as<JsonArray>();
                for (JsonObject node_obj : nodes) {
                    NodeConfig node;
                    String mac = node_obj["mac"];
                    sscanf(mac.c_str(), "%2hhx:%2hhx:%2hhx:%2hhx:%2hhx:%2hhx", 
                           &node.mac[0], &node.mac[1], &node.mac[2], 
                           &node.mac[3], &node.mac[4], &node.mac[5]);
                    node.name = node_obj["name"].as<String>();
                    node.online = false;
                    node.last_seen = 0;
                    _nodes.push_back(node);
                }
            }
        }
        file.close();
    }
}

void WebServer::_save_config() {
    DynamicJsonDocument doc(2048);
    doc["wifi_ssid"] = _wifi_ssid;
    doc["wifi_password"] = _wifi_password;
    doc["admin_password"] = _admin_password;
    
    JsonArray nodes = doc.createNestedArray("nodes");
    if (xSemaphoreTake(_clients_mutex, portMAX_DELAY) == pdTRUE) {
        for (const auto& node : _nodes) {
            JsonObject node_obj = nodes.createNestedObject();
            node_obj["mac"] = String(node.mac[0], HEX) + ":" +
                              String(node.mac[1], HEX) + ":" +
                              String(node.mac[2], HEX) + ":" +
                              String(node.mac[3], HEX) + ":" +
                              String(node.mac[4], HEX) + ":" +
                              String(node.mac[5], HEX);
            node_obj["name"] = node.name;
        }
        xSemaphoreGive(_clients_mutex);
    }
    
    File file = LittleFS.open("/config.json", "w");
    if (file) {
        serializeJson(doc, file);
        file.close();
    }
}

void WebServer::_load_scenes() {
    if (!LittleFS.exists("/scenes.json")) {
        // Create default scenes
        DynamicJsonDocument doc(1024);
        JsonArray scenes = doc.to<JsonArray>();
        
        // Morning scene
        JsonObject morning = scenes.createNestedObject();
        morning["name"] = "Morning";
        morning["description"] = "Morning settings";
        JsonArray morning_devices = morning.createNestedArray("devices");
        morning_devices.add(create_device("blinds", 1)); // Open
        morning_devices.add(create_device("light", LIGHT_PRESET_SUNRISE));
        morning_devices.add(create_device("ac", 24));
        
        // Evening scene
        JsonObject evening = scenes.createNestedObject();
        evening["name"] = "Evening";
        evening["description"] = "Evening settings";
        JsonArray evening_devices = evening.createNestedArray("devices");
        evening_devices.add(create_device("blinds", 0)); // Close
        evening_devices.add(create_device("light", LIGHT_PRESET_DUSK));
        evening_devices.add(create_device("led", LED_SCENE_POOLSIDE));
        
        File file = LittleFS.open("/scenes.json", "w");
        if (file) {
            serializeJson(doc, file);
            file.close();
        }
        return;
    }
    
    File file = LittleFS.open("/scenes.json", "r");
    if (file) {
        DynamicJsonDocument doc(1024);
        DeserializationError error = deserializeJson(doc, file);
        if (!error) {
            _scenes.clear();
            for (JsonObject scene_obj : doc.as<JsonArray>()) {
                ScenePreset scene;
                scene.name = scene_obj["name"].as<String>();
                scene.description = scene_obj["description"].as<String>();
                scene.devices = scene_obj["devices"].as<JsonArray>();
                _scenes.push_back(scene);
            }
        }
        file.close();
    }
}

void WebServer::_save_scenes() {
    DynamicJsonDocument doc(1024);
    JsonArray scenes = doc.to<JsonArray>();
    
    for (const auto& scene : _scenes) {
        JsonObject scene_obj = scenes.createNestedObject();
        scene_obj["name"] = scene.name;
        scene_obj["description"] = scene.description;
        scene_obj["devices"] = scene.devices;
    }
    
    File file = LittleFS.open("/scenes.json", "w");
    if (file) {
        serializeJson(doc, file);
        file.close();
    }
}

void WebServer::_update_node_status(uint8_t* mac, bool online) {
    set_node_online(mac, online);
}

// Helper function to create device JSON
JsonObject create_device(const String& type, uint8_t value) {
    DynamicJsonDocument doc(64);
    JsonObject device = doc.to<JsonObject>();
    device["type"] = type;
    device["value"] = value;
    return device;
}

// Expose WiFi to esp_now_sender
uint8_t* get_ap_mac() {
    static uint8_t mac[6];
    WiFi.softAPmacAddress(mac);
    return mac;
}