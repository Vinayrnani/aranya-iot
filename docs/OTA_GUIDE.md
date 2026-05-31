# Aranya Hub OTA Update Guide

## Intro
Secure Over-the-Air (OTA) updates are critical for Aranya Hub deployments in off-grid environments. This guide explains how to configure and deploy OTA updates to ensure firmware integrity, minimize downtime, and enable remote recovery for devices in deep sleep.

## Storage Options
| Service       | Cost (per GB/month) | Latency | Best For               |
|---------------|---------------------|---------|------------------------|
| AWS S3        | $0.023              | Low     | Large-scale deployments |
| MinIO         | $0.01               | Medium  | Self-hosted setups     |
| Backblaze B2  | $0.005              | High    | Cost-sensitive farms   |

## Files Required
### 1. `otaVersion.json`
```json
{
  "version": "MAJOR.MINOR.PATCH",
  "firmwareUrl": "/secureUpdate?key={{CANONICAL_OTA_KEY}}",
  "releaseNotes": "Bug fixes for deep sleep wakeup",
  "minCompatibleVersion": "1.2.0"
}
```

### 2. `firmware.bin`
- Must be signed with Aranya's private key
- Max size: 1.5MB (ESP32 flash constraint)

### 3. `hash.json` (Optional)
```json
{
  "algorithm": "SHA256",
  "hash": "abcd1234...",
  "size": 1234567
}
```

## Wiring Guide
**ESP32 OTA Recovery Button**
| Pin | Function          | Notes                          |
|-----|-------------------|--------------------------------|
| D5  | OTA Force Trigger | Hold at boot for recovery mode |
| GND | Ground            | Connect to button              |

## Troubleshooting
### Common ESP Error Logs
```
E (1234) esp_image: Image length 123456 doesn't fit in partition
E (5678) ota: Signature verification failed
```

### Bypass Procedures
1. **Recovery Mode**: Hold D5 during boot → forces HTTP OTA from default URL
2. **Manual Flash**: Use `esptool.py --baud 921600 write_flash 0x1000 firmware.bin`