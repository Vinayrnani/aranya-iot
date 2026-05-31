#pragma once
#include <Arduino.h>
#include <vector>
#include <queue>
#include "packet_struct.h"

class EspNowSender {
private:
    bool _initialized = false;
    bool _broadcast_enabled = true;
    uint8_t _mac_address[6];
    uint8_t _esp_now_channel;

    // Retry configuration
    int _max_retries = MAX_ESP_NOW_RETRIES;
    unsigned long _packet_timeout = ESP_NOW_PACKET_TIMEOUT;

    // Packet queue for retry mechanism
    struct QueuedPacket {
        EspNowPacket packet;
        unsigned long sent_time;
        int retry_count;
    };
    std::queue<QueuedPacket> _send_queue;
    SemaphoreHandle_t _queue_mutex;

    // Send packet with retry logic
    bool send_packet_with_retry(const EspNowPacket& packet);

    // Add packet to queue
    bool queue_packet(const EspNowPacket& packet);

public:
    EspNowSender();
    ~EspNowSender();

    // Initialize ESP-NOW
    bool begin();

    // Set destination MAC address
    bool set_destination(const uint8_t* mac);

    // Enable/disable broadcast mode
    void set_broadcast(bool enable);

    // Send AC control command
    bool send_ac_control(uint8_t room_id, uint8_t temperature);

    // Send blinds control command
    bool send_blinds_control(uint8_t room_id, uint8_t position);

    // Send light control command
    bool send_light_control(uint8_t room_id, uint8_t preset);

    // Send LED control command
    bool send_led_control(uint8_t room_id, uint8_t scene);

    // Send scene activation
    bool send_scene(uint8_t room_id, uint8_t scene_id);

    // Send service request
    bool send_service_request(uint8_t room_id, uint8_t service_type);

    // Process send queue (call in loop)
    void process_queue();

    // Get initialization status
    bool is_initialized() const { return _initialized; }

    // Get queue size
    size_t get_queue_size() const;

    // Clear queue
    void clear_queue();
};
