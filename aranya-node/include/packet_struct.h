#pragma once
#include <Arduino.h>
#include <config.h>

// Extended ESP-NOW Packet Structure for AC command orchestration
struct __attribute__((packed)) EspNowPacket {
    uint8_t room_id;      // 0-255 (room identifier)
    uint8_t device_type;  // 0=AC, 1=Blinds, 2=Light, 3=LED, 4=Scene
    union {
        uint8_t action_value; // Legacy: 0-255 (depends on device_type)
        struct {
            // Structured AC command payload (when device_type == DEVICE_AC and extended flag is set)
            uint8_t power     : 1;  // 0=off, 1=on
            uint8_t temp      : 7;  // Temperature (16-30°C, needs offset)
            uint8_t fan_speed : 2;  // 0=auto, 1=low, 2=medium, 3=high
            uint8_t mode      : 3;  // 0=cool, 1=heat, 2=dry, 3=fan, 4=auto
            uint8_t extended  : 1;  // Flag: 0=legacy format, 1=extended format
            uint8_t reserved  : 2;  // Reserved for future use
        } ac_payload;
    };
    uint8_t checksum;     // Simple XOR checksum

    // Calculate checksum (only covers room_id, device_type, and the first byte of union)
    void calculate_checksum() {
        checksum = room_id ^ device_type ^ *(uint8_t*)&action_value;
    }

    // Verify checksum
    bool verify_checksum() const {
        uint8_t calc_checksum = room_id ^ device_type ^ *(uint8_t*)&action_value;
        return (calc_checksum == checksum);
    }

    // Check if using extended AC format
    bool isExtendedAcFormat() const {
        return (device_type == DEVICE_AC) && (ac_payload.extended == 1);
    }
};

// Device Type Constants
enum DeviceType {
    DEVICE_AC = 0,      // Air Conditioner
    DEVICE_BLINDS = 1,  // Motorized Blinds
    DEVICE_LIGHT = 2,   // Room Light
    DEVICE_LED = 3,     // Addressable LEDs
    DEVICE_SCENE = 4    // Service Request
};

// AC Mode Constants
enum AcMode {
    AC_MODE_COOL = 0,
    AC_MODE_HEAT = 1,
    AC_MODE_DRY = 2,
    AC_MODE_FAN = 3,
    AC_MODE_AUTO = 4
};

// Special action_value for indicating extended AC format
constexpr uint8_t AC_FULL = 0xFF;  // Flag to indicate orchestrated payload