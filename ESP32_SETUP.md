# ESP32 CSI Deployment Guide

Complete step-by-step guide to deploy VitalScan on real ESP32 hardware for contactless vital signs monitoring.

---

## Table of Contents

- [Overview](#overview)
- [What You Need](#what-you-need)
- [Step 1 — Install ESP-IDF](#step-1--install-esp-idf)
- [Step 2 — Build the Firmware](#step-2--build-the-firmware)
- [Step 3 — Flash the ESP32](#step-3--flash-the-esp32)
- [Step 4 — Verify the Firmware](#step-4--verify-the-firmware)
- [Step 5 — Connect the Web App](#step-5--connect-the-web-app)
  - [Option A — Phone via WebSocket (WiFi)](#option-a--phone-via-websocket-wifi)
  - [Option B — Desktop via Web Serial (USB)](#option-b--desktop-via-web-serial-usb)
- [Step 6 — Optimise for Your Environment](#step-6--optimise-for-your-environment)
- [Advanced Configuration](#advanced-configuration)
  - [Station Mode (Join Existing Network)](#station-mode-join-existing-network)
  - [Change WiFi Channel](#change-wifi-channel)
  - [Adjust Sample Rate](#adjust-sample-rate)
- [Architecture Overview](#architecture-overview)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

---

## Overview

This guide walks you through deploying VitalScan on an ESP32 microcontroller. When complete, you will have:

- An ESP32 collecting real WiFi CSI (Channel State Information) data
- A WebSocket server on the ESP32 streaming CSI to the VitalScan web app
- Real-time vital signs monitoring on your phone or computer

```
┌──────────────────────────────────────────────────────────────┐
│                      How It Works                            │
│                                                              │
│  ESP32                    WiFi Signal         Human Subject  │
│  ┌─────┐  ───────────►  ≋≋≋≋≋≋≋≋≋≋≋  ◄────►  🧍           │
│  │ CSI │  ◄───────────  ≋≋≋≋≋≋≋≋≋≋≋                        │
│  └──┬──┘                reflected off body                   │
│     │                                                        │
│     │ WebSocket / USB Serial                                 │
│     ▼                                                        │
│  ┌─────────────────┐                                         │
│  │ VitalScan PWA   │  Heart Rate, Breathing, Movement        │
│  │ (Phone/Desktop) │  Radar, Waveforms, Presence             │
│  └─────────────────┘                                         │
└──────────────────────────────────────────────────────────────┘
```

---

## What You Need

### Hardware

| Item | Recommendation | Notes |
|------|---------------|-------|
| **ESP32 board** | ESP32-DevKitC or ESP32-WROOM-32 | Any ESP32 with WiFi works. ESP32-S3 also supported |
| **USB cable** | Micro-USB or USB-C (match your board) | For flashing and optional serial data |
| **Computer** | Windows, macOS, or Linux | For building and flashing the firmware |
| **Phone/tablet** | Any device with a modern browser | For the VitalScan web app |

### Software

| Software | Version | Purpose |
|----------|---------|---------|
| **ESP-IDF** | v5.0 or later | Build toolchain for ESP32 firmware |
| **Python** | 3.8+ | Required by ESP-IDF build system |
| **Git** | Any recent version | Clone ESP-IDF and this repository |
| **Chrome or Edge** | Latest | For Web Serial (desktop only) |

> **Cost:** An ESP32-DevKitC board costs around $5–10 USD. No other hardware is needed.

---

## Step 1 — Install ESP-IDF

### Linux

```bash
# Install system dependencies
sudo apt-get install -y git wget flex bison gperf python3 python3-pip \
    python3-venv cmake ninja-build ccache libffi-dev libssl-dev \
    dfu-util libusb-1.0-0

# Clone ESP-IDF v5.4
mkdir -p ~/esp
cd ~/esp
git clone -b v5.4 --recursive https://github.com/espressif/esp-idf.git
cd esp-idf

# Install tools for ESP32
./install.sh esp32

# Activate ESP-IDF environment (run this in every new terminal)
source export.sh
```

### macOS

```bash
# Install Xcode command line tools (if not already installed)
xcode-select --install

# Install dependencies via Homebrew
brew install cmake ninja dfu-util python3

# Clone and install ESP-IDF
mkdir -p ~/esp
cd ~/esp
git clone -b v5.4 --recursive https://github.com/espressif/esp-idf.git
cd esp-idf
./install.sh esp32
source export.sh
```

### Windows

1. Download the [ESP-IDF Tools Installer](https://dl.espressif.com/dl/esp-idf/) (recommended: offline installer)
2. Run the installer and select **ESP-IDF v5.4** and **ESP32** target
3. After installation, open the **ESP-IDF Command Prompt** from the Start menu

> **Tip:** Add `source ~/esp/esp-idf/export.sh` (Linux/macOS) to your shell profile so it loads automatically.

---

## Step 2 — Build the Firmware

```bash
# Navigate to the firmware directory
cd esp32-firmware

# Set the target chip
idf.py set-target esp32

# (Optional) Customise settings via menuconfig
idf.py menuconfig
# Navigate to: VitalScan CSI Configuration
# Change WiFi SSID, password, channel, etc. as needed
# Save and exit (S, then Q)

# Build the firmware
idf.py build
```

A successful build shows:

```
Project build complete. To flash, run this command:
  idf.py -p (PORT) flash
```

Build time: 2–5 minutes on the first build (subsequent builds are faster).

---

## Step 3 — Flash the ESP32

### Find Your Serial Port

Connect the ESP32 to your computer via USB, then identify the port:

**Linux:**
```bash
ls /dev/ttyUSB* /dev/ttyACM* 2>/dev/null
# Usually /dev/ttyUSB0 or /dev/ttyACM0
```

**macOS:**
```bash
ls /dev/cu.usb*
# Usually /dev/cu.usbserial-XXXX or /dev/cu.SLAB_USBtoUART
```

**Windows:**
Open Device Manager → Ports (COM & LPT) → Look for `Silicon Labs CP210x` or `USB-SERIAL CH340` → Note the COM port (e.g., `COM3`)

### Flash and Monitor

```bash
# Flash firmware and open serial monitor
idf.py -p /dev/ttyUSB0 flash monitor

# On Windows:
# idf.py -p COM3 flash monitor
```

> **Tip:** Hold the **BOOT** button on the ESP32 while flashing if you see a connection timeout.

### Expected Serial Output

```
I (324) vitalscan: ╔══════════════════════════════════════╗
I (324) vitalscan: ║  VitalScan ESP32 CSI Firmware v1.0   ║
I (324) vitalscan: ╚══════════════════════════════════════╝
I (434) vitalscan: SoftAP started — SSID: VitalScan-ESP32, Channel: 6, IP: 192.168.4.1
I (434) vitalscan: Connect your device to WiFi: VitalScan-ESP32
I (444) vitalscan: Then open the web app and connect to ws://192.168.4.1:81
I (454) ws_server: WebSocket server started on port 81
I (464) csi_handler: CSI collection enabled
I (474) vitalscan: System ready — streaming CSI data
```

Press `Ctrl+]` to exit the serial monitor.

---

## Step 4 — Verify the Firmware

Before connecting the web app, verify that CSI data is flowing:

1. **Keep the serial monitor open** (`idf.py -p /dev/ttyUSB0 monitor`)
2. **Connect a device to the ESP32 WiFi** — join the `VitalScan-ESP32` network from your phone
3. **Generate traffic** — open a webpage or ping from the connected device:
   ```bash
   ping 192.168.4.1
   ```
4. **Watch the serial output** — you should see JSON lines:
   ```json
   {"type":"csi","ts":15234,"amps":[12.04,8.56,15.23,...]}
   {"type":"csi","ts":15284,"amps":[11.98,8.72,14.87,...]}
   ```

If you see CSI data flowing, the firmware is working correctly.

---

## Step 5 — Connect the Web App

### Option A — Phone via WebSocket (WiFi)

This is the recommended setup for portable use.

1. **Start the web app** on your computer:
   ```bash
   npm run dev
   ```
   Or use the hosted version at https://ai.studio/apps/848a2f46-8c77-4552-b0c7-2605771a40ab

2. **On your phone:**
   - Connect to the `VitalScan-ESP32` WiFi network (password: `vitalscan`)
   - Open the web app URL in your browser

3. **In the web app:**
   - Tap the **connection/settings** icon
   - Select **WebSocket** as the connection method
   - Enter the URL: `ws://192.168.4.1:81`
   - Tap **Connect**

4. **You should see:**
   - Connection status changes to **Connected**
   - Board info appears (ESP32, channel, MAC address)
   - Real-time CSI waveforms start plotting
   - Vital signs cards begin updating

### Option B — Desktop via Web Serial (USB)

This works when the ESP32 is plugged directly into your computer.

1. **Open the web app** in **Chrome** or **Edge** (Web Serial is not supported in other browsers)

2. **In the web app:**
   - Click the **connection/settings** icon
   - Select **Web Serial** as the connection method
   - Click **Connect**
   - A browser dialog appears — select the ESP32 serial port
   - Click **Connect** in the dialog

3. **You should see:**
   - Connection status changes to **Connected**
   - CSI data streams from the USB serial port
   - Waveforms and vital signs update in real time

> **Note:** Web Serial only works on desktop Chrome/Edge. It is not available on mobile browsers.

---

## Step 6 — Optimise for Your Environment

### Physical Setup

For best results when monitoring a person's vital signs:

```
                    1–3 metres
    ESP32  ◄────────────────────►  Person
    (on table/wall)                (sitting/standing)
```

- **Distance:** 1–3 metres between the ESP32 and the monitored person works best
- **Line of sight:** The WiFi signal should have a direct path to the person (avoid walls)
- **Minimal movement:** The person should stay relatively still for accurate breathing/heartbeat detection
- **Stable mounting:** Keep the ESP32 stationary (vibrations add noise)
- **Single person:** Start with one person in the sensing area for clearest signals

### WiFi Traffic

CSI data is only captured from received WiFi frames. More traffic = more CSI samples:

```bash
# From a device on the ESP32 network, generate steady ping traffic:
ping -i 0.05 192.168.4.1    # 20 Hz — matches the web app sample rate
```

The WebSocket connection itself generates some traffic, but additional pings improve the CSI rate.

---

## Advanced Configuration

### Station Mode (Join Existing Network)

By default, the ESP32 creates its own WiFi network (SoftAP mode). To join an existing network instead:

```bash
idf.py menuconfig
```

1. Navigate to **VitalScan CSI Configuration**
2. Disable **Use SoftAP mode**
3. Set **Station Mode WiFi SSID** to your network name
4. Set **Station Mode WiFi Password** to your network password
5. Save and exit, then rebuild and flash:

```bash
idf.py build
idf.py -p /dev/ttyUSB0 flash monitor
```

In Station mode, the ESP32's IP address is assigned by your router's DHCP. Check the serial output for the assigned IP:

```
I (1234) vitalscan: Got IP: 192.168.1.105
```

Then connect the web app to `ws://192.168.1.105:81`.

### Change WiFi Channel

The WiFi channel affects which nearby devices' frames trigger CSI collection. Channel 1, 6, or 11 is recommended (they are the non-overlapping 2.4 GHz channels):

```bash
idf.py menuconfig
# VitalScan CSI Configuration → SoftAP WiFi Channel → set to 1, 6, or 11
```

### Adjust Sample Rate

The default 50 ms (20 Hz) send rate matches the web app's simulation rate. To change it:

```bash
idf.py menuconfig
# VitalScan CSI Configuration → CSI Send Rate → set to desired ms
```

Lower values = higher rate but more CPU load. 50 ms is a good balance.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    ESP32 Firmware                    │
│                                                     │
│  ┌─────────────┐    ┌──────────────┐               │
│  │ WiFi Driver  │───►│ CSI Callback │               │
│  │ (SoftAP/STA) │    │ (csi_handler)│               │
│  └─────────────┘    └──────┬───────┘               │
│                            │ FreeRTOS Queue         │
│                            ▼                        │
│                    ┌───────────────┐                │
│                    │  CSI Stream   │                │
│                    │    Task       │                │
│                    └──┬────────┬──┘                │
│                       │        │                    │
│               ┌───────▼──┐  ┌──▼────────┐          │
│               │ WebSocket │  │ USB Serial │          │
│               │ Server    │  │  (printf)  │          │
│               │ (port 81) │  │ (115200)   │          │
│               └─────┬─────┘  └──────┬─────┘          │
└─────────────────────┼───────────────┼──────────────┘
                      │               │
              WiFi    │       USB     │
                      ▼               ▼
              ┌──────────────────────────────┐
              │     VitalScan Web App        │
              │  WebSocketAdapter  │ WebSerialAdapter
              │         │                │   │
              │         ▼                ▼   │
              │    csiProtocol.ts parser     │
              │         │                    │
              │         ▼                    │
              │  VitalSignsProcessor         │
              │  → Bandpass filters           │
              │  → Waveform visualisation     │
              └──────────────────────────────┘
```

### Data Format

The firmware outputs newline-delimited JSON compatible with `src/hardware/csiProtocol.ts`:

**CSI Sample** (sent at 20 Hz):
```json
{"type":"csi","ts":12345,"amps":[12.04,8.56,15.23,...]}
```

- `ts` — Timestamp in milliseconds (ESP32 uptime)
- `amps` — Per-subcarrier amplitude values (√(I² + Q²))

**Board Info** (sent once on WebSocket connection):
```json
{"type":"info","board":"ESP32","mac":"AA:BB:CC:DD:EE:FF","fw":"1.0.0","ch":6,"bw":"20 MHz","std":"802.11n","freq":"2.4 GHz","sc":64,"rate":20,"rssi":0}
```

---

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| **`idf.py` not found** | ESP-IDF not activated | Run `source ~/esp/esp-idf/export.sh` |
| **Build error: CSI not supported** | Wrong ESP-IDF version | Use ESP-IDF v5.0 or later |
| **Serial port not found** | Missing USB drivers | Install [CP210x](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers) or [CH340](http://www.wch-ic.com/downloads/CH341SER_ZIP.html) drivers |
| **Flash timeout** | ESP32 not in download mode | Hold **BOOT** button while flashing |
| **No CSI data on serial** | No WiFi traffic | Connect a device and ping the ESP32 |
| **WebSocket won't connect** | Wrong IP or not on ESP32 WiFi | Verify you're on the `VitalScan-ESP32` network; IP is `192.168.4.1` |
| **Web Serial not available** | Unsupported browser | Use desktop Chrome or Edge |
| **Low CSI sample rate** | Insufficient WiFi traffic | Run `ping -i 0.05 192.168.4.1` from a connected device |
| **Amplitudes all zero** | CSI not triggered on this frame type | Ensure `lltf_en` and `htltf_en` are true (default) |
| **Unstable readings** | Too much movement or interference | Ensure stable ESP32 mounting and minimal multi-path |

---

## FAQ

**Q: Which ESP32 boards work?**
A: Any ESP32 module with WiFi: ESP32-DevKitC, ESP32-WROOM-32, ESP32-WROVER, NodeMCU-32S, ESP32-S3-DevKitC. The original ESP32 (not S2/C3) is recommended for the best CSI support.

**Q: Do I need two ESP32 boards?**
A: No. A single ESP32 in SoftAP mode captures CSI from frames sent by any device connected to its network (your phone, laptop, etc.).

**Q: Can I use Arduino IDE instead of ESP-IDF?**
A: The Arduino ESP32 framework does not expose the CSI API. ESP-IDF is required for CSI collection.

**Q: How far can it detect?**
A: Typical range is 1–5 metres in line of sight. Signal quality decreases with distance and through walls.

**Q: Does it work through walls?**
A: WiFi signals penetrate thin walls, but accuracy drops significantly. Line of sight is best.

**Q: Can it monitor multiple people?**
A: The CSI signal contains combined contributions from all people in the sensing area. Multi-person separation requires advanced algorithms not yet implemented in the signal processor.

**Q: How accurate is the vital signs detection?**
A: With real CSI data, breathing rate detection is typically within ±2 breaths/minute. Heart rate detection is more challenging and depends on signal quality, distance, and environmental noise.
