# Aranya Resort IoT Master Hub

Complete firmware for the ESP32 Master Hub that coordinates all IoT devices in the Aranya Resort using ESP-NOW and WebSocket technology.

## Project Structure

```
aranya-hub/
├── include/
│   ├── config.h           # System configuration constants
│   └── packet_struct.h    # ESP-NOW packet structure
├── src/
│   ├── main.cpp           # Main entry point
│   ├── esp_now_sender.cpp # ESP-NOW transmission implementation
│   ├── esp_now_sender.h   # ESP-NOW sender interface
│   ├── web_server.cpp     # HTTP/WebSocket server
│   └── web_server.h       # Server interface
├── data/
│   ├── index.html         # Guest dashboard
│   ├── admin.html         # Admin panel
│   ├── css/style.css      # Guest styling
│   ├── js/app.js          # Guest JavaScript
│   ├── js/admin.js        # Admin JavaScript
│   ├── config.json        # Node configuration
│   └── scenes.json        # Scene presets
└── platformio.ini         # PlatformIO configuration

```

## Features

### ESP-NOW Communication
- Reliable wireless communication between ESP32 nodes
- Queue-based retry mechanism for robust packet delivery
- XOR checksum validation for packet integrity
- Configurable packet timeout and retry limits

### Web Server & WebSocket
- Async HTTP server using ESPAsyncWebServer
- Real-time WebSocket for dashboard updates
- RESTful API endpoints:
  - `GET /api/status` - System status
  - `POST /api/scene` - Activate scene
  - `POST /api/room/:id/control` - Room device control
  - `POST /api/service` - Service request
  - `GET /api/nodes` - Node mapping
  - `POST /api/nodes` - Update node mapping
  - `POST /api/config` - Network config (admin)

### Device Control
- **AC Control**: Temperature (16-30°C)
- **Blinds Control**: Open/Close (0=close, 1=open)
- **Light Control**: Presets (0=sunrise, 1=reading, 2=dusk)
- **LED Control**: Scenes (0=campfire, 1=poolside, 2=movie)
- **Service Requests**: Normal/Silent/Do Not Disturb

### Admin Features
- HTTP Basic Authentication
- Node management (add/remove nodes)
- Scene configuration
- Network settings
- Real-time activity logging

## Installation

### 1. Install PlatformIO

```bash
pip install platformio
```

### 2. Clone or Copy Project

```bash
cd aranya-hub
```

### 3. Install Dependencies

```bash
pio pkg install
```

### 4. Upload Firmware

```bash
pio run --target upload
```

## Configuration

### WiFi Setup

Edit `include/config.h`:

```cpp
#define WIFI_SSID "your_network_name"
#define WIFI_PASSWORD "your_network_password"
#define WIFI_AP_SSID "ARANYA_HUB"
#define WIFI_AP_PASSWORD "your_ap_password"
```

### Admin Credentials

Default credentials in `config.h`:

```cpp
#define ADMIN_USERNAME "admin"
#define ADMIN_PASSWORD "aranya2024"
```

## Node Configuration

Nodes are configured via the web interface or directly in `data/config.json`:

```json
{
  "wifi_ssid": "ARANYA_WIFI",
  "wifi_password": "aranya2024",
  "ap_ssid": "ARANYA_HUB",
  "ap_password": "aranya123",
  "admin_password": "aranya2024",
  "nodes": [
    { "mac": "AA:BB:CC:DD:EE:01", "name": "Room 101" }
  ]
}
```

## Scene Configuration

Scenes are defined in `data/scenes.json`:

```json
{
  "scenes": [
    {
      "name": "Morning",
      "description": "Wake up with natural light",
      "devices": [
        { "type": "blinds", "value": 1 },
        { "type": "light", "value": 0 },
        { "type": "ac", "value": 24 }
      ]
    }
  ]
}
```

## Building

```bash
pio run
```

## Testing

1. **Flash firmware to ESP32**
2. **Connect to WiFi AP**: `ARANYA_HUB` with password `aranya123`
3. **Access dashboard**: http://192.168.4.1
4. **Access admin panel**: http://192.168.4.1/admin (credentials: admin/aranya2024)
5. **Add nodes** via admin panel
6. **Control devices** via dashboard or API

## API Endpoints

### System Status
```bash
curl http://192.168.4.1/api/status
```

### Activate Scene
```bash
curl -X POST http://192.168.4.1/api/scene?scene=0&room=1
```

### Control Device
```bash
curl -X POST http://192.168.4.1/api/room/1/control?device=ac&action=24
```

### Service Request
```bash
curl -X POST http://192.168.4.1/api/service?room=1&type=1
```

### Get Nodes
```bash
curl http://192.168.4.1/api/nodes
```

## Troubleshooting

### WiFi Connection Issues
- Check WiFi SSID and password
- Ensure AP mode fallback is enabled
- Reset the device and try again

### ESP-NOW Issues
- Verify all ESP32 devices are on same channel (default: 1)
- Check MAC addresses in node configuration
- Monitor serial output for error messages

### Web Server Issues
- Clear browser cache
- Check WebSocket connection in browser console
- Verify network connectivity

## Security Considerations

- Change default admin password immediately
- Use HTTPS in production environment
- Implement rate limiting for API endpoints
- Regular firmware updates for security patches

## License

Proprietary - Aranya Resort

## Support

For issues and support, contact the resort IT department.
