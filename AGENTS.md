# AGENTS.md

## Repository Overview
Aranya IoT resort management system.

- `aranya-hub/`: Master firmware (ESP32).
- `aranya-node/`: Node firmware (ESP32/8266).
- `docs/`: CI/OTA guides.

## Build & Development
- **PlatformIO**: Standard `pio` tools.
    - `pio pkg install` (dependencies)
    - `pio run` (build)
    - `pio run --target upload` (flash)
- **Binaries**: Found in `.pio/build/<environment>/` after build.

## ESP-NOW Communication
- Struct: `EspNowPacket` (in `packet_struct.h`).
- **Crucial**: All ESP devices must be on the same channel (default 1).
- Integrity: Uses XOR checksum (`calculate_checksum()` / `verify_checksum()`).

## Web UI & Config
- `aranya-hub` serves a web dashboard.
- **Default AP Mode**: SSID `ARANYA_HUB` / Password `aranya123` at `http://192.168.4.1`.
- **Config**: `data/config.json` and `data/scenes.json`.
- **Admin Credentials**: `admin` / `aranya2024` (defined in `include/config.h`).

## OTA Updates
- Requires signed `.bin` firmware.
- **Recovery Mode**: Hold D5 pin during boot to force HTTP OTA.
- **Flash Constraint**: Max 1.5MB.

## CI/CD
- GitHub Actions workflows are in `.github/workflows/`.
- CI automation uses `act` for local testing.
