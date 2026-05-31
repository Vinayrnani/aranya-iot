#include "config.h"
#include <Arduino.h>

// Relay States
enum RelayState {
    RELAY_OFF = 0,  // Relay power off
    RELAY_ON = 1,   // Relay power on
    RELAY_TOGGLE = 2 // Toggle relay state
};

// Initialize relay pins
void initRelays() {
    pinMode(RELAY_BLINDS_PIN, OUTPUT);
    pinMode(RELAY_LIGHTS_PIN, OUTPUT);
    
    // Set initial state: both off
    digitalWrite(RELAY_BLINDS_PIN, LOW);
    digitalWrite(RELAY_LIGHTS_PIN, LOW);
}

// Control blinds relay
void controlBlinds(uint8_t action) {
    static bool blindsState = false;
    
    switch(action) {
        case RELAY_OFF:  // Open blinds (relay off)
            digitalWrite(RELAY_BLINDS_PIN, LOW);
            blindsState = false;
            break;
            
        case RELAY_ON:   // Close blinds (relay on)
            digitalWrite(RELAY_BLINDS_PIN, HIGH);
            blindsState = true;
            break;
            
        case RELAY_TOGGLE: // Toggle blinds
            blindsState = !blindsState;
            digitalWrite(RELAY_BLINDS_PIN, blindsState);
            break;
    }
}

// Control lights relay
void controlLights(uint8_t action) {
    // Simple on/off with optional dimming presets
    // For multi-level dimming, action is 0-100% brightness
    if (action == 0) {
        digitalWrite(RELAY_LIGHTS_PIN, LOW);
    } else if (action <= 33) {  // Low
        digitalWrite(RELAY_LIGHTS_PIN, HIGH);
    } else if (action <= 66) {  // Medium
        digitalWrite(RELAY_LIGHTS_PIN, HIGH);
    } else {                    // High
        digitalWrite(RELAY_LIGHTS_PIN, HIGH);
    }
}

// Set lighting scene
void setLightingScene(uint8_t scene) {
    switch(scene) {
        case 0: // Off
            controlLights(0);
            break;
            
        case 1: // Reading
            controlLights(50);
            break;
            
        case 2: // Relax
            controlLights(30);
            break;
            
        case 3: // Bright
            controlLights(100);
            break;
            
        case 4: // Night
            controlLights(10);
            break;
            
        default:
            controlLights(0);
            break;
    }
}

// Set multiple relays simultaneously
void setRelayGroup(uint8_t blindsAction, uint8_t lightsAction) {
    controlBlinds(blindsAction);
    setLightingScene(lightsAction);
}

// Emergency stop - turn off all relays
void emergencyStop() {
    digitalWrite(RELAY_BLINDS_PIN, LOW);
    digitalWrite(RELAY_LIGHTS_PIN, LOW);
}