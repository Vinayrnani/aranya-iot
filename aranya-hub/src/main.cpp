#include <Arduino.h>
#include "config.h"
#include "esp_now_sender.h"
#include "web_server.h"
#include <esp_now.h>

// Global components
EspNowSender* esp_now_sender;
WebServer* web_server;

// System state
struct {
    unsigned long last_status_send = 0;
    unsigned long last_node_check = 0;
    bool wifi_connected = false;
    bool ap_mode = false;
} system_state;

// Function prototypes
void setup_wifi();
void print_wakeup_reason();
void on_esp_now_receive(const uint8_t *mac_addr, const uint8_t *data, int len);
bool validate_packet(const EspNowPacket& packet);
void process_node_message(const uint8_t *mac_addr, const EspNowPacket& packet);

void setup() {
    // Serial initialization
    Serial.begin(115200);
    Serial.println("\n=== Aranya Resort IoT Master Hub ===\n");
    print_wakeup_reason();
    
    // Initialize components
    esp_now_sender = new EspNowSender();
    web_server = new WebServer(esp_now_sender);
    
    // Initialize WiFi and ESP-NOW
    setup_wifi();
    if (!esp_now_sender->begin()) {
        Serial.println("Critical: ESP-NOW initialization failed!");
        ESP.restart();
    }
    
    // Register ESP-NOW receive callback
    esp_now_register_recv_cb(on_esp_now_receive);
    
    // Start web server
    if (!web_server->begin()) {
        Serial.println("Critical: Web server initialization failed!");
        ESP.restart();
    }
    
    Serial.println("System initialized successfully");
    Serial.printf("STA MAC: %s\n", WiFi.macAddress().c_str());
    Serial.printf("AP MAC: %s\n", WiFi.softAPmacAddress().c_str());
}

void loop() {
    // Handle all components
    web_server->handle_client();
    esp_now_sender->process_queue();
    web_server->update();
    
    // Check WiFi status
    bool current_wifi_status = (WiFi.status() == WL_CONNECTED);
    if (current_wifi_status != system_state.wifi_connected) {
        system_state.wifi_connected = current_wifi_status;
        Serial.printf("WiFi %s\n", current_wifi_status ? "connected" : "disconnected");
    }
    
    // Periodic status updates
    unsigned long now = millis();
    if (now - system_state.last_status_send > 10000) {
        system_state.last_status_send = now;
        if (current_wifi_status) {
            Serial.printf("Status: WiFi RSSI %d dBm, Free Heap: %d bytes\n",
                         WiFi.RSSI(), ESP.getFreeHeap());
        } else {
            Serial.println("Status: Running in AP-only mode");
        }
    }
    
    // Node status checks
    if (now - system_state.last_node_check > 30000) {
        system_state.last_node_check = now;
        // Web server handles node timeout detection
    }
    
    // Small delay to prevent watchdog reset
    delay(10);
}

void setup_wifi() {
    WiFi.mode(WIFI_AP_STA);
    
    // Set host name
    WiFi.setHostname("aranya-master-hub");
    
    // Connect to existing network first
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    Serial.printf("Connecting to WiFi: %s\n", WIFI_SSID);
    
    int wifi_attempts = 0;
    while (WiFi.status() != WL_CONNECTED && wifi_attempts < 20) {
        delay(500);
        Serial.print(".");
        wifi_attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\nWiFi connected");
        Serial.print("IP: ");
        Serial.println(WiFi.localIP());
        system_state.wifi_connected = true;
    } else {
        Serial.println("\nFailed to connect to WiFi");
        system_state.wifi_connected = false;
    }
    
    // Start AP regardless of STA status
    WiFi.softAP(WIFI_AP_SSID, WIFI_AP_PASSWORD);
    Serial.println("WiFi AP started");
    Serial.print("AP IP: ");
    Serial.println(WiFi.softAPIP());
    system_state.ap_mode = true;
}

void print_wakeup_reason() {
    esp_sleep_wakeup_cause_t wakeup_reason = esp_sleep_get_wakeup_cause();
    
    switch(wakeup_reason) {
        case ESP_SLEEP_WAKEUP_EXT0: 
            Serial.println("Wakeup: External signal (RTC_IO)"); break;
        case ESP_SLEEP_WAKEUP_EXT1:
            Serial.println("Wakeup: External signal (RTC_CNTL)"); break;
        case ESP_SLEEP_WAKEUP_TIMER:
            Serial.println("Wakeup: Timer"); break;
        case ESP_SLEEP_WAKEUP_TOUCHPAD:
            Serial.println("Wakeup: Touchpad"); break;
        case ESP_SLEEP_WAKEUP_ULP:
            Serial.println("Wakeup: ULP program"); break;
        default:
            Serial.printf("Wakeup: Power-on (not from sleep), reason=%d\n", wakeup_reason);
            break;
    }
}

void on_esp_now_receive(const uint8_t *mac_addr, const uint8_t *data, int len) {
    // Basic length check
    if (len != sizeof(EspNowPacket)) {
        Serial.printf("Invalid packet size: %d bytes (expected %d)\n", len, sizeof(EspNowPacket));
        return;
    }
    
    // Make a copy of the packet
    EspNowPacket packet;
    memcpy(&packet, data, sizeof(EspNowPacket));
    
    // Validate packet integrity
    if (!validate_packet(packet)) {
        Serial.println("Packet validation failed!");
        return;
    }
    
    // Add node to system if new
    web_server->add_node(mac_addr, "Node-" + String(packet.room_id));
    
    // Update node status
    web_server->set_node_online(mac_addr, true);
    
    // Process the message
    process_node_message(mac_addr, packet);
}

bool validate_packet(const EspNowPacket& packet) {
    // Check room ID
    if (packet.room_id < MIN_ROOM_ID || packet.room_id > MAX_ROOM_ID) {
        Serial.printf("Invalid room_id: %d\n", packet.room_id);
        return false;
    }
    
    // Check device type
    if (packet.device_type > DEVICE_TYPE_SERVICE) {
        Serial.printf("Invalid device_type: %d\n", packet.device_type);
        return false;
    }
    
    // Check action value based on device type
    switch (packet.device_type) {
        case DEVICE_TYPE_AC:
            if (packet.action_value < MIN_TEMP || packet.action_value > MAX_TEMP) {
                Serial.printf("Invalid AC temperature: %d\n", packet.action_value);
                return false;
            }
            break;
            
        case DEVICE_TYPE_BLINDS:
            if (packet.action_value > 1) {
                Serial.printf("Invalid blinds position: %d\n", packet.action_value);
                return false;
            }
            break;
            
        case DEVICE_TYPE_LIGHT:
            if (packet.action_value > LIGHT_PRESET_DUSK) {
                Serial.printf("Invalid light preset: %d\n", packet.action_value);
                return false;
            }
            break;
            
        case DEVICE_TYPE_LED:
            if (packet.action_value > LED_SCENE_MOVIE) {
                Serial.printf("Invalid LED scene: %d\n", packet.action_value);
                return false;
            }
            break;
            
        case DEVICE_TYPE_SERVICE:
            if (packet.action_value > SERVICE_DND) {
                Serial.printf("Invalid service request: %d\n", packet.action_value);
                return false;
            }
            break;
    }
    
    // Check checksum
    if (!packet.verify_checksum()) {
        Serial.printf("Checksum verification failed!\n");
        return false;
    }
    
    return true;
}

void process_node_message(const uint8_t *mac_addr, const EspNowPacket& packet) {
    Serial.printf("Processing message from Room %d: Device %d, Action %d\n",
                 packet.room_id, packet.device_type, packet.action_value);
    
    // Send acknowledgment (if reliable messaging is implemented)
    // Send to dashboard via WebSocket
    DynamicJsonDocument doc(256);
    doc["type"] = "device_update";
    doc["room_id"] = packet.room_id;
    doc["device_type"] = packet.device_type;
    doc["action_value"] = packet.action_value;
    String json;
    serializeJson(doc, json);
    
    // Broadcast to all WebSocket clients
    web_server->_ws_broadcast(json);
}
