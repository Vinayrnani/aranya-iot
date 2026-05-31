#include "config.h"
#include <IRremoteESP8266.h>
#include <IRsend.h>

extern IRsend irSender;

// IR Command Constants for Generic AC
#define IR_AC_POWER_ON     0x00FE  // Power On
#define IR_AC_POWER_OFF    0x00FF  // Power Off
#define IR_AC_TEMP_UP      0x40BF  // Temperature Up
#define IR_AC_TEMP_DOWN    0xC03F  // Temperature Down
#define IR_AC_FAN_HIGH     0x807F  // Fan High
#define IR_AC_FAN_MED      0x02FD  // Fan Medium
#define IR_AC_FAN_LOW      0x22DD  // Fan Low
#define IR_AC_MODE_COOL    0x02FD  // Cool Mode
#define IR_AC_MODE_HEAT    0xA25D  // Heat Mode
#define IR_AC_MODE_DRY     0x629D  // Dry Mode
#define IR_AC_MODE_FAN     0xE01F  // Fan Mode
#define IR_AC_MODE_AUTO    0x22DD  // Auto Mode

// Send AC Power Command
void sendAcPower(bool on) {
    if (on) {
        irSender.sendNEC(IR_AC_POWER_ON, 32);
    } else {
        irSender.sendNEC(IR_AC_POWER_OFF, 32);
    }
}

// Send AC Temperature Command
void sendAcTemp(int temp, bool up) {
    if (up) {
        irSender.sendNEC(IR_AC_TEMP_UP, 32);
    } else {
        irSender.sendNEC(IR_AC_TEMP_DOWN, 32);
    }
}

// Send AC Fan Speed Command
void sendAcFanSpeed(int speed) {
    switch(speed) {
        case 1:
            irSender.sendNEC(IR_AC_FAN_LOW, 32);
            break;
        case 2:
            irSender.sendNEC(IR_AC_FAN_MED, 32);
            break;
        case 3:
            irSender.sendNEC(IR_AC_FAN_HIGH, 32);
            break;
        default:
            irSender.sendNEC(IR_AC_FAN_MED, 32);
            break;
    }
}

// Send AC Mode Command
void sendAcMode(int mode) {
    switch(mode) {
        case 0: // Cool
            irSender.sendNEC(IR_AC_MODE_COOL, 32);
            break;
        case 1: // Heat
            irSender.sendNEC(IR_AC_MODE_HEAT, 32);
            break;
        case 2: // Dry
            irSender.sendNEC(IR_AC_MODE_DRY, 32);
            break;
        case 3: // Fan
            irSender.sendNEC(IR_AC_MODE_FAN, 32);
            break;
        case 4: // Auto
            irSender.sendNEC(IR_AC_MODE_AUTO, 32);
            break;
        default:
            irSender.sendNEC(IR_AC_MODE_COOL, 32);
            break;
    }
}

// Send Complete AC Configuration
void sendAcConfig(uint8_t power, int temp, int fan, int mode) {
    if (power) {
        sendAcPower(true);
        delay(100);
    }

    // Adjust temperature based on mode
    if (mode == 0) { // Cool
        for (int i = 0; i < (temp - 16); i++) {
            sendAcTemp(true);
            delay(150);
        }
    } else if (mode == 1) { // Heat
        for (int i = 0; i < (30 - temp); i++) {
            sendAcTemp(false);
            delay(150);
        }
    } else {
        sendAcFanSpeed(fan);
        delay(100);
    }

    sendAcMode(mode);
    delay(100);
}

// Send Power Toggle
void sendAcTogglePower() {
    static bool lastPowerState = false;
    lastPowerState = !lastPowerState;
    sendAcPower(lastPowerState);
}

// Send Full System Reset (turn off, wait, turn on)
void sendAcSystemReset() {
    sendAcPower(false);
    delay(500);
    sendAcPower(true);
    delay(1000);
}