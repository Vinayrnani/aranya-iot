#ifndef CONFIG_H
#define CONFIG_H

// CHANGE THIS FOR EACH NODE before flashing
#define NODE_ID 1  // Room/Glass Room A
// #define NODE_ID 2  // Room B
// #define NODE_ID 3  // Amphitheater
// #define NODE_ID 4  // Pool Area

// GPIO Pin Assignments
#define RELAY_BLINDS_PIN 5    // D1
#define RELAY_LIGHTS_PIN 4    // D2
#define LED_STATUS_PIN 2      // D4 (built-in LED)
#define LED_DATA_PIN 12       // D6 (WS2812 data)
#define IR_SEND_PIN 14        // D5 (IR LED output)

// WLED Configuration
#define NUM_LEDS 30           // Number of LEDs in strip
#define LED_TYPE WS2812B
#define COLOR_ORDER GRB
#define BRIGHTNESS 128        // Default brightness (0-255)

// ESP-NOW Configuration
#define ESPNOW_CHANNEL 1      // WiFi channel for ESP-NOW
#define ESPNOW_KEY {0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF, 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99}

// System Configuration
#define WATCHDOG_TIMEOUT 8000 // Watchdog timeout in milliseconds
#define STATUS_LED_BLINK_INTERVAL 500 // Status LED blink interval in ms
#define DEBOUNCE_DELAY 50     // Debounce delay for inputs

// Debug Settings
#define DEBUG_SERIAL true     // Enable serial debug output
#define DEBUG_BAUD 115200     // Serial debug baud rate

#endif // CONFIG_H