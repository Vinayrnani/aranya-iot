#pragma once
#include <Arduino.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>
#include <LittleFS.h>
#include <vector>
#include "packet_struct.h"
#include "esp_now_sender.h"

class WebServer {
private:
    AsyncWebServer* _server;
    AsyncWebSocket* _ws;
    EspNowSender* _esp_now;
    
    // Client management
    std::vector<AsyncWebSocketClient*> _clients;
    SemaphoreHandle_t _clients_mutex;
    
    // Authentication
    const char* _admin_username = "admin";
    const char* _admin_password = "aranya2024";
    
    // State
    String _wifi_ssid = WIFI_SSID;
    String _wifi_password = WIFI_PASSWORD;
    String _ap_ssid = WIFI_AP_SSID;
    String _ap_password = WIFI_AP_PASSWORD;
    
    // Node management
    struct NodeConfig {
        uint8_t mac[6];
        String name;
        bool online;
        uint32_t last_seen;
    };
    std::vector<NodeConfig> _nodes;
    
    // Scenes
    struct ScenePreset {
        String name;
        String description;
        JsonArray devices; // Array of device configurations
    };
    std::vector<ScenePreset> _scenes;
    
    // Methods
    bool _check_auth(AsyncWebServerRequest *request);
    void _handle_not_found(AsyncWebServerRequest *request);
    void _on_ws_event(AsyncWebSocket *server, AsyncWebSocketClient *client, 
                     AwsEventType type, void *arg, uint8_t *data, size_t len);
    void _ws_send_status_update();
    void _ws_broadcast(const String& message);
    void _handle_api_status(AsyncWebServerRequest *request);
    void _handle_api_scene(AsyncWebServerRequest *request);
    void _handle_api_room_control(AsyncWebServerRequest *request);
    void _handle_api_service(AsyncWebServerRequest *request);
    void _handle_api_nodes(AsyncWebServerRequest *request);
    void _handle_api_config(AsyncWebServerRequest *request);
    void _serve_static_files();
    void _load_config();
    void _save_config();
    void _load_scenes();
    void _save_scenes();
    void _update_node_status(uint8_t* mac, bool online);
    
public:
    WebServer(EspNowSender* esp_now);
    ~WebServer();
    
    bool begin();
    void handle_client();
    void update();
    
    // Node management
    void add_node(const uint8_t* mac, const String& name);
    void remove_node(const uint8_t* mac);
    void set_node_online(const uint8_t* mac, bool online);
    
    // Scene management
    void add_scene(const String& name, const String& description, JsonArray& devices);
    void remove_scene(const String& name);
};
