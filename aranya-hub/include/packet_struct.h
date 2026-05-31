#pragma once
#include <Arduino.h>

// ESP-NOW Packet Structure
struct __attribute__((packed)) EspNowPacket {
    uint8_t room_id;      // 0-255 (room identifier)
    uint8_t device_type;  // 0=AC, 1=Blinds, 2=Light, 3=LED, 4=Scene
    uint8_t action_value; // 0-255 (depends on device_type)
    uint8_t checksum;     // Simple XOR checksum

    // Calculate checksum
    void calculate_checksum() {
        checksum = room_id ^ device_type ^ action_value;
    }

    // Verify checksum
    bool verify_checksum() const {
        uint8_t calc_checksum = room_id ^ device_type ^ action_value;
        return (calc_checksum == checksum);
    }

    // Convert to JSON string
    String to_json() const {
        StaticJsonDocument<64> doc;
        doc["room_id"] = room_id;
        doc["device_type"] = device_type;
        doc["action_value"] = action_value;
        doc["checksum"] = checksum;
        String json;
        serializeJson(doc, json);
        return json;
    }
};

// WebSocket message types
enum class WSMessageType : uint8_t {
    STATUS_UPDATE = 0,
    NODE_UPDATE = 1,
    DEVICE_UPDATE = 2,
    ERROR = 3,
    ACK = 4
};

// WebSocket message structure
struct __attribute__((packed)) WebSocketMessage {
    WSMessageType type;
    uint8_t data_length;
    char data[128];
};

// Configuration node structure
struct NodeConfig {
    uint8_t mac[6];
    String name;
    bool online;
    bool connected;
    uint8_t last_seen;
};
