#include <Arduino.h>
#include "aranya-node/include/packet_struct.h"

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\nTesting packet size...");
  Serial.print("Size of EspNowPacket: ");
  Serial.println(sizeof(EspNowPacket));
  Serial.println("Expected: 4 bytes");
  
  // Test the union
  EspNowPacket packet;
  packet.room_id = 1;
  packet.device_type = 0; // AC
  packet.action_value = 0xFF; // Extended format flag
  packet.checksum = 0;
  
  packet.calculate_checksum();
  
  Serial.print("Calculated checksum: ");
  Serial.println(packet.checksum, HEX);
  
  // Test extended format detection
  if (packet.isExtendedAcFormat()) {
    Serial.println("Detected extended AC format");
    packet.ac_payload.power = 1;
    packet.ac_payload.temp = 20; // Would be 20+16=36°C (but we'll constrain it)
    packet.ac_payload.fan_speed = 2; // Medium
    packet.ac_payload.mode = 0; // Cool
    packet.ac_payload.extended = 1;
  }
  
  Serial.print("Power: ");
  Serial.println(packet.ac_payload.power);
  Serial.print("Temp offset: ");
  Serial.println(packet.ac_payload.temp);
  Serial.print("Fan speed: ");
  Serial.println(packet.ac_payload.fan_speed);
  Serial.print("Mode: ");
  Serial.println(packet.ac_payload.mode);
  Serial.print("Extended flag: ");
  Serial.println(packet.ac_payload.extended);
}

void loop() {
  // Nothing here
}