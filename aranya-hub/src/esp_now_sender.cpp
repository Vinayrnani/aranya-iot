#include "esp_now_sender.h"
#include <esp_now.h>
#include <WiFi.h>

EspNowSender::EspNowSender() : _esp_now_channel(ESP_NOW_CHANNEL) {
    _queue_mutex = xSemaphoreCreateMutex();
}

EspNowSender::~EspNowSender() {
    if (_queue_mutex) {
        vSemaphoreDelete(_queue_mutex);
    }
}

bool EspNowSender::begin() {
    if (_initialized) {
        return true;
    }

    WiFi.mode(WIFI_STA);
    WiFi.disconnect();

    if (esp_now_init() != ESP_OK) {
        Serial.println("Error initializing ESP-NOW");
        return false;
    }

    // Set callback for send status
    esp_now_register_send_cb([](const uint8_t* mac_addr, esp_now_send_status_t status) {
        if (status == ESP_NOW_SEND_SUCCESS) {
            Serial.printf("ESP-NOW packet sent successfully to %02X:%02X:%02X:%02X:%02X:%02X\n",
                         mac_addr[0], mac_addr[1], mac_addr[2],
                         mac_addr[3], mac_addr[4], mac_addr[5]);
        } else {
            Serial.printf("ESP-NOW send failed\n");
        }
    });

    // Register send callback for status checking
    esp_now_register_send_cb([](const uint8_t* mac_addr, esp_now_send_status_t status) {
        // This is handled by process_queue()
    });

    // Set channel
    if (esp_now_set_channel(_esp_now_channel) != ESP_OK) {
        Serial.println("Error setting ESP-NOW channel");
        return false;
    }

    _initialized = true;
    Serial.println("ESP-NOW sender initialized");
    return true;
}

bool EspNowSender::set_destination(const uint8_t* mac) {
    if (!_initialized) {
        return false;
    }

    memcpy(_mac_address, mac, 6);
    return true;
}

void EspNowSender::set_broadcast(bool enable) {
    _broadcast_enabled = enable;
}

bool EspNowSender::queue_packet(const EspNowPacket& packet) {
    QueuedPacket queued;
    queued.packet = packet;
    queued.sent_time = millis();
    queued.retry_count = 0;

    if (xSemaphoreTake(_queue_mutex, portMAX_DELAY) == pdTRUE) {
        _send_queue.push(queued);
        xSemaphoreGive(_queue_mutex);
        return true;
    }
    return false;
}

bool EspNowSender::send_packet_with_retry(const EspNowPacket& packet) {
    int retries = 0;
    unsigned long timeout_start = millis();

    while (retries < _max_retries) {
        esp_err_t result = esp_now_send(_broadcast_enabled ? nullptr : _mac_address,
                                       (uint8_t*)&packet, sizeof(packet));

        if (result == ESP_OK) {
            return true;
        }

        retries++;
        Serial.printf("ESP-NOW send attempt %d failed, retrying...\n", retries);

        if (retries < _max_retries) {
            delay(50);  // Brief delay before retry
        }
    }

    Serial.printf("ESP-NOW send failed after %d retries\n", _max_retries);
    return false;
}

bool EspNowSender::send_ac_control(uint8_t room_id, uint8_t temperature) {
    if (!_initialized) {
        return false;
    }

    if (temperature < MIN_TEMP || temperature > MAX_TEMP) {
        Serial.printf("Invalid temperature: %d (valid: %d-%d)\n",
                     temperature, MIN_TEMP, MAX_TEMP);
        return false;
    }

    EspNowPacket packet;
    packet.room_id = room_id;
    packet.device_type = DEVICE_TYPE_AC;
    packet.action_value = temperature;
    packet.calculate_checksum();

    Serial.printf("Sending AC control: Room %d, Temp %d°C\n", room_id, temperature);
    return send_packet_with_retry(packet);
}

bool EspNowSender::send_blinds_control(uint8_t room_id, uint8_t position) {
    if (!_initialized) {
        return false;
    }

    if (position > 1) {
        Serial.println("Invalid blinds position: must be 0 (close) or 1 (open)");
        return false;
    }

    EspNowPacket packet;
    packet.room_id = room_id;
    packet.device_type = DEVICE_TYPE_BLINDS;
    packet.action_value = position;
    packet.calculate_checksum();

    Serial.printf("Sending blinds control: Room %d, Position %d\n", room_id, position);
    return send_packet_with_retry(packet);
}

bool EspNowSender::send_light_control(uint8_t room_id, uint8_t preset) {
    if (!_initialized) {
        return false;
    }

    if (preset > LIGHT_PRESET_DUSK) {
        Serial.println("Invalid light preset");
        return false;
    }

    EspNowPacket packet;
    packet.room_id = room_id;
    packet.device_type = DEVICE_TYPE_LIGHT;
    packet.action_value = preset;
    packet.calculate_checksum();

    Serial.printf("Sending light control: Room %d, Preset %d\n", room_id, preset);
    return send_packet_with_retry(packet);
}

bool EspNowSender::send_led_control(uint8_t room_id, uint8_t scene) {
    if (!_initialized) {
        return false;
    }

    if (scene > LED_SCENE_MOVIE) {
        Serial.println("Invalid LED scene");
        return false;
    }

    EspNowPacket packet;
    packet.room_id = room_id;
    packet.device_type = DEVICE_TYPE_LED;
    packet.action_value = scene;
    packet.calculate_checksum();

    Serial.printf("Sending LED control: Room %d, Scene %d\n", room_id, scene);
    return send_packet_with_retry(packet);
}

bool EspNowSender::send_scene(uint8_t room_id, uint8_t scene_id) {
    if (!_initialized) {
        return false;
    }

    if (scene_id > LED_SCENE_MOVIE) {
        Serial.println("Invalid scene ID");
        return false;
    }

    EspNowPacket packet;
    packet.room_id = room_id;
    packet.device_type = DEVICE_TYPE_SCENE;
    packet.action_value = scene_id;
    packet.calculate_checksum();

    Serial.printf("Sending scene activation: Room %d, Scene %d\n", room_id, scene_id);
    return send_packet_with_retry(packet);
}

bool EspNowSender::send_service_request(uint8_t room_id, uint8_t service_type) {
    if (!_initialized) {
        return false;
    }

    if (service_type > SERVICE_DND) {
        Serial.println("Invalid service type");
        return false;
    }

    EspNowPacket packet;
    packet.room_id = room_id;
    packet.device_type = DEVICE_TYPE_SERVICE;
    packet.action_value = service_type;
    packet.calculate_checksum();

    const char* service_names[] = {"Normal", "Silent", "Do Not Disturb"};
    Serial.printf("Sending service request: Room %d, %s\n", room_id, service_names[service_type]);
    return send_packet_with_retry(packet);
}

void EspNowSender::process_queue() {
    if (_send_queue.empty()) {
        return;
    }

    if (xSemaphoreTake(_queue_mutex, 0) != pdTRUE) {
        return;
    }

    while (!_send_queue.empty()) {
        QueuedPacket& queued = _send_queue.front();

        unsigned long elapsed = millis() - queued.sent_time;

        if (elapsed > _packet_timeout && queued.retry_count < _max_retries) {
            queued.retry_count++;
            queued.sent_time = millis();

            if (send_packet_with_retry(queued.packet)) {
                _send_queue.pop();
            }
        } else if (queued.retry_count >= _max_retries) {
            Serial.printf("Dropping packet after max retries: Room %d\n",
                         queued.packet.room_id);
            _send_queue.pop();
        }
    }

    xSemaphoreGive(_queue_mutex);
}

size_t EspNowSender::get_queue_size() const {
    return _send_queue.size();
}

void EspNowSender::clear_queue() {
    if (xSemaphoreTake(_queue_mutex, portMAX_DELAY) == pdTRUE) {
        while (!_send_queue.empty()) {
            _send_queue.pop();
        }
        xSemaphoreGive(_queue_mutex);
    }
}
