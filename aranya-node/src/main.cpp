#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <espnow.h>
#include <Ticker.h>
#include <EEPROM.h>
#include <FastLED.h>
#include <IRremoteESP8266.h>
#include <IRsend.h>
#include "config.h"
#include "packet_struct.h"

// Global Objects
IRsend irSender(IR_SEND_PIN);  // IR Blaster
CRGB leds[NUM_LEDS];          // LED Strip
Ticker watchdogTimer;         // Watchdog timer
Ticker statusLedTimer;       // Status LED timer

// System State
bool nodeActive = false;
unsigned long lastActivityTime = 0;

// Checksum Calculation
uint8_t calculateChecksum(const EspNowPacket& packet) {
    uint8_t checksum = 0;
    checksum ^= packet.room_id;
    checksum ^= packet.device_type;
    checksum ^= packet.action_value; // This works for both legacy and extended formats
    return checksum;
}

// Validate Packet
bool validatePacket(const EspNowPacket& packet) {
    if (calculateChecksum(packet) != packet.checksum) {
        return false;
    }
    return (packet.room_id == NODE_ID);
}

// Handle AC Command
void handleAcCommand(const EspNowPacket& packet) {
    // Check if using extended AC format
    if (packet.isExtendedAcFormat()) {
        // Extract parameters from extended format
        bool power = packet.ac_payload.power;
        int temp = packet.ac_payload.temp + 16; // Convert from 0-14 offset to 16-30°C
        int fan = packet.ac_payload.fan_speed;
        int mode = packet.ac_payload.mode;
        
        #if DEBUG_SERIAL
            Serial.printf("AC Extended Command: power=%d, temp=%d, fan=%d, mode=%d\n", 
                         power, temp, fan, mode);
        #endif
        
        // Send complete AC configuration
        sendAcConfig(power ? 1 : 0, temp, fan, mode);
    } else {
        // Legacy format - maintain backward compatibility
        switch(packet.action_value) {
            case 0: irSender.sendNEC(0x00FF, 32); break; // Power Off
            case 1: irSender.sendNEC(0x00FE, 32); break; // Power On
            case 2: irSender.sendNEC(0x40BF, 32); break; // Temp Up
            case 3: irSender.sendNEC(0xC03F, 32); break; // Temp Down
            case 4: irSender.sendNEC(0x807F, 32); break; // Fan Speed
            case 5: irSender.sendNEC(0x02FD, 32); break; // Mode
            default: break;
        }
        #if DEBUG_SERIAL
            Serial.printf("AC Command (Legacy): %d\n", packet.action_value);
        #endif
    }
}

// Handle Blinds Command
void handleBlindsCommand(uint8_t action) {
    static uint8_t lastBlindsState = 0;
    
    // Invert logic: 0=open (relay off), 1=closed (relay on)
    if (action == 0) {
        digitalWrite(RELAY_BLINDS_PIN, LOW);
        lastBlindsState = 0;
    } else if (action == 1) {
        digitalWrite(RELAY_BLINDS_PIN, HIGH);
        lastBlindsState = 1;
    } else if (action == 2) {
        // Toggle
        lastBlindsState = !lastBlindsState;
        digitalWrite(RELAY_BLINDS_PIN, lastBlindsState);
    }
    
    #if DEBUG_SERIAL
        Serial.printf("Blinds Command: %d, State: %d\n", action, lastBlindsState);
    #endif
}

// Handle Light Command
void handleLightCommand(uint8_t action) {
    // Action maps to light presets
    digitalWrite(RELAY_LIGHTS_PIN, action > 0 ? HIGH : LOW);
    
    #if DEBUG_SERIAL
        Serial.printf("Light Command: %d\n", action);
    #endif
}

// Handle LED Command
void handleLedCommand(uint8_t action) {
    switch(action) {
        case 0:  // Off
            fill_solid(leds, NUM_LEDS, CRGB::Black);
            break;
        case 1:  // Warm White
            fill_solid(leds, NUM_LEDS, CRGB::Wheat);
            break;
        case 2:  // Cool White
            fill_solid(leds, NUM_LEDS, CRGB(200, 220, 255));
            break;
        case 3:  // Sunset
            fill_gradient_RGB(leds, NUM_LEDS, CRGB::Orange, CRGB::DeepPink);
            break;
        case 4:  // Ocean
            fill_gradient_RGB(leds, NUM_LEDS, CRGB::Blue, CRGB::Cyan);
            break;
        case 5:  // Forest
            fill_gradient_RGB(leds, NUM_LEDS, CRGB::Green, CRGB::DarkGreen);
            break;
        case 6:  // Party
            for (int i = 0; i < NUM_LEDS; i++) {
                leds[i] = CHSV(random8(), 255, 255);
            }
            break;
        case 7:  // Fire
            for (int i = 0; i < NUM_LEDS; i++) {
                leds[i] = HeatColor(random8(128, 255));
            }
            break;
        default:
            fill_solid(leds, NUM_LEDS, CRGB::Black);
            break;
    }
    FastLED.show();
    
    #if DEBUG_SERIAL
        Serial.printf("LED Command: %d\n", action);
    #endif
}

// Handle Service Request
void handleServiceRequest(uint8_t action) {
    static uint8_t flashCount = 0;
    
    // Flash status LED to indicate service request
    if (action > 0) {
        flashCount = 10;
    }
    
    #if DEBUG_SERIAL
        Serial.printf("Service Request: %d\n", action);
    #endif
}

// ESP-NOW receive callback
void onEspNowReceived(uint8_t *mac_addr, uint8_t *data, uint8_t len) {
    // Check packet length
    if (len != sizeof(EspNowPacket)) {
        #if DEBUG_SERIAL
            Serial.println("Invalid packet size");
        #endif
        return;
    }
    
    // Copy packet data
    EspNowPacket packet;
    memcpy(&packet, data, sizeof(EspNowPacket));
    
    // Validate packet
    if (!validatePacket(packet)) {
        #if DEBUG_SERIAL
            Serial.println("Packet validation failed");
        #endif
        return;
    }
    
    // Update activity time
    lastActivityTime = millis();
    nodeActive = true;
    
     // Handle based on device type
     switch(packet.device_type) {
         case DEVICE_AC:
             handleAcCommand(packet);
             break;
         case DEVICE_BLINDS:
             handleBlindsCommand(packet.action_value);
             break;
         case DEVICE_LIGHT:
             handleLightCommand(packet.action_value);
             break;
         case DEVICE_LED:
             handleLedCommand(packet.action_value);
             break;
         case DEVICE_SCENE:
             handleServiceRequest(packet.action_value);
             break;
         default:
             #if DEBUG_SERIAL
                 Serial.printf("Unknown device type: %d\n", packet.device_type);
             #endif
             break;
     }
}

// Watchdog callback
void watchdogHandler() {
    // Reset if no activity for too long
    if (millis() - lastActivityTime > WATCHDOG_TIMEOUT) {
        #if DEBUG_SERIAL
            Serial.println("Watchdog timeout - resetting");
        #endif
        ESP.restart();
    }
    
    // Feed the hardware watchdog
    ESP.wdtFeed();
}

// Status LED callback
void statusLedHandler() {
    static bool ledState = false;
    static uint8_t flashCount = 0;
    
    // Handle service request flashing
    if (flashCount > 0) {
        ledState = !ledState;
        digitalWrite(LED_STATUS_PIN, ledState);
        flashCount--;
        return;
    }
    
    // Normal status indication
    if (nodeActive) {
        // Activity blink
        ledState = !ledState;
        digitalWrite(LED_STATUS_PIN, ledState);
        nodeActive = false;
    } else {
        // Idle state
        digitalWrite(LED_STATUS_PIN, HIGH); // Active low
    }
}

// Setup function
void setup() {
    #if DEBUG_SERIAL
        Serial.begin(DEBUG_BAUD);
        Serial.println("Aranya Resort IoT Node - Initializing");
        Serial.printf("Node ID: %d\n", NODE_ID);
    #endif
    
    // Initialize pins
    pinMode(RELAY_BLINDS_PIN, OUTPUT);
    pinMode(RELAY_LIGHTS_PIN, OUTPUT);
    pinMode(LED_STATUS_PIN, OUTPUT);
    
    // Initialize relays to off
    digitalWrite(RELAY_BLINDS_PIN, LOW);
    digitalWrite(RELAY_LIGHTS_PIN, LOW);
    digitalWrite(LED_STATUS_PIN, HIGH); // Active low
    
    // Initialize IR sender
    irSender.begin();
    
    // Initialize LED strip
    FastLED.addLeds<LED_TYPE, LED_DATA_PIN, COLOR_ORDER>(leds, NUM_LEDS);
    FastLED.setBrightness(BRIGHTNESS);
    fill_solid(leds, NUM_LEDS, CRGB::Black);
    FastLED.show();
    
    // Initialize ESP-NOW
    WiFi.disconnect();
    WiFi.mode(WIFI_STA);
    
    if (esp_now_init() != 0) {
        #if DEBUG_SERIAL
            Serial.println("ESP-NOW initialization failed");
        #endif
        ESP.restart();
    }
    
    // Set ESP-NOW receive callback
    esp_now_set_self_role(ESP_NOW_ROLE_SLAVE);
    esp_now_register_recv_cb(onEspNowReceived);
    
    // Set encryption key
    uint8_t key[16] = ESPNOW_KEY;
    esp_now_set_kok(key, 16);
    
    #if DEBUG_SERIAL
        Serial.println("ESP-NOW initialized");
    #endif
    
    // Initialize watchdog timer
    watchdogTimer.attach_ms(WATCHDOG_TIMEOUT / 4, watchdogHandler);
    statusLedTimer.attach_ms(STATUS_LED_BLINK_INTERVAL, statusLedHandler);
    
    // Initialize EEPROM (for flash recovery pattern)
    EEPROM.begin(32);
    
    // Mark successful boot
    lastActivityTime = millis();
    
    #if DEBUG_SERIAL
        Serial.println("Initialization complete");
    #endif
}

// Main loop
void loop() {
    // Feed the watchdog
    ESP.wdtFeed();
    
    // Small delay to prevent watchdog issues
    delay(10);
}