#include "config.h"
#include <FastLED.h>

extern CRGB leds[];

// LED Scene Constants
enum LedScene {
    SCENE_OFF = 0,        // Off
    SCENE_WARM_WHITE = 1, // Warm white
    SCENE_COOL_WHITE = 2, // Cool white
    SCENE_SUNSET = 3,     // Sunset gradient
    SCENE_OCEAN = 4,      // Ocean gradient
    SCENE_FOREST = 5,     // Forest gradient
    SCENE_PARTY = 6,      // Party mode
    SCENE_FIRE = 7        // Fire simulation
};

// Initialize LED strip
void initLedStrip() {
    FastLED.addLeds<LED_TYPE, LED_DATA_PIN, COLOR_ORDER>(leds, NUM_LEDS);
    FastLED.setBrightness(BRIGHTNESS);
    clearLeds();
}

// Clear all LEDs
void clearLeds() {
    fill_solid(leds, NUM_LEDS, CRGB::Black);
    FastLED.show();
}

// Set LED scene
void setLedScene(uint8_t scene) {
    switch(scene) {
        case SCENE_OFF:
            clearLeds();
            break;
            
        case SCENE_WARM_WHITE:
            fill_solid(leds, NUM_LEDS, CRGB::Wheat);
            FastLED.show();
            break;
            
        case SCENE_COOL_WHITE:
            fill_solid(leds, NUM_LEDS, CRGB(200, 220, 255));
            FastLED.show();
            break;
            
        case SCENE_SUNSET:
            fill_gradient_RGB(leds, NUM_LEDS, CRGB::Orange, CRGB::DeepPink);
            FastLED.show();
            break;
            
        case SCENE_OCEAN:
            fill_gradient_RGB(leds, NUM_LEDS, CRGB::Blue, CRGB::Cyan);
            FastLED.show();
            break;
            
        case SCENE_FOREST:
            fill_gradient_RGB(leds, NUM_LEDS, CRGB::Green, CRGB::DarkGreen);
            FastLED.show();
            break;
            
        case SCENE_PARTY:
            for (int i = 0; i < NUM_LEDS; i++) {
                leds[i] = CHSV(random8(), 255, 255);
            }
            FastLED.show();
            break;
            
        case SCENE_FIRE:
            fillFire();
            FastLED.show();
            break;
            
        default:
            clearLeds();
            break;
    }
}

// Fill with fire gradient
void fillFire() {
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i] = HeatColor(random8(128, 255));
    }
}

// Set individual LED color
void setLedColor(uint16_t index, uint8_t r, uint8_t g, uint8_t b) {
    if (index < NUM_LEDS) {
        leds[index] = CRGB(r, g, b);
        FastLED.show();
    }
}

// Set LED brightness
void setLedBrightness(uint8_t brightness) {
    if (brightness <= 255) {
        FastLED.setBrightness(brightness);
        FastLED.show();
    }
}

// Rainbow effect
void effectRainbow() {
    for (int i = 0; i < NUM_LEDS; i++) {
        leds[i] = CHSV((i * 256 / NUM_LEDS) + millis() / 10, 255, 255);
    }
    FastLED.show();
    delay(20);
}

// Chase effect
void effectChase(CRGB color) {
    static uint16_t currentLed = 0;
    
    clearLeds();
    leds[currentLed] = color;
    currentLed = (currentLed + 1) % NUM_LEDS;
    FastLED.show();
    delay(30);
}

// Sparkle effect
void effectSparkle(uint8_t density) {
    clearLeds();
    for (int i = 0; i < density; i++) {
        int pos = random16(NUM_LEDS);
        leds[pos] = CHSV(random8(), 255, 255);
    }
    FastLED.show();
    delay(20);
}