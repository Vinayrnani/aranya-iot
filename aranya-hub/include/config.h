#pragma once

#include <Arduino.h>
#include <vector>
#include <string>

// System Configuration
#define WIFI_SSID "ARANYA_WIFI"
#define WIFI_PASSWORD "aranya2024"
#define WIFI_AP_SSID "ARANYA_HUB"
#define WIFI_AP_PASSWORD "aranya123"

#define SERVER_PORT 80
#define WEBSOCKET_BUFFER_SIZE 1024

#define ESP_NOW_CHANNEL 1
#define MAX_ESP_NOW_RETRIES 3
#define ESP_NOW_PACKET_TIMEOUT 2000

#define MAX_NODES 32
#define MAX_PACKET_QUEUE 64

// Device Types
#define DEVICE_TYPE_AC 0
#define DEVICE_TYPE_BLINDS 1
#define DEVICE_TYPE_LIGHT 2
#define DEVICE_TYPE_LED 3
#define DEVICE_TYPE_SCENE 4
#define DEVICE_TYPE_SERVICE 4

// Service Request Types
#define SERVICE_NORMAL 0
#define SERVICE_SILENT 1
#define SERVICE_DND 2

// Light Presets
#define LIGHT_PRESET_SUNRISE 0
#define LIGHT_PRESET_READING 1
#define LIGHT_PRESET_DUSK 2

// LED Scenes
#define LED_SCENE_CAMPFIRE 0
#define LED_SCENE_POOLSIDE 1
#define LED_SCENE_MOVIE 2

// Valid ranges
#define MIN_TEMP 16
#define MAX_TEMP 30
#define MIN_ROOM_ID 1
#define MAX_ROOM_ID 255

// OTA Configuration
#define OTA_SERVER_URL "{{OTA_SERVER_URL}}"
#define OTA_VERSION_ENDPOINT "{{OTA_SERVER_URL}}/otaVersion.json"
#define OTA_FIRMWARE_ENDPOINT "{{OTA_SERVER_URL}}/firmware.bin"
#define OTA_SECURE_UPDATE_ENDPOINT "{{OTA_SERVER_URL}}/secureUpdate?key={{CANONICAL_OTA_KEY}}"
