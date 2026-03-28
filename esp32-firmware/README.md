# VitalScan ESP32 CSI Firmware

ESP-IDF firmware for the ESP32 that collects WiFi Channel State Information (CSI) and streams it to the [VitalScan web app](../README.md) over WebSocket and USB serial.

## What It Does

1. **Creates a WiFi access point** (`VitalScan-ESP32`) or joins an existing network
2. **Collects raw CSI data** from WiFi frames using the ESP-IDF CSI API
3. **Extracts per-subcarrier amplitudes** from I/Q pairs
4. **Streams data** as newline-delimited JSON over:
   - **WebSocket** on port 81 (for phones/tablets via the web app)
   - **USB serial** at 115200 baud (for desktop via Web Serial)

## Protocol

The firmware outputs JSON matching the format expected by `src/hardware/csiProtocol.ts`:

```json
{"type":"csi","ts":12345,"amps":[1.02,0.98,1.15,...]}
{"type":"info","board":"ESP32","mac":"AA:BB:CC:DD:EE:FF","fw":"1.0.0","ch":6,"bw":"20 MHz","std":"802.11n","freq":"2.4 GHz","sc":64,"rate":20,"rssi":-45}
```

## Requirements

| Item | Details |
|------|---------|
| **Board** | ESP32-WROOM-32, ESP32-DevKitC, ESP32-S3, or any ESP32 with WiFi |
| **Framework** | ESP-IDF v5.0 or later |
| **USB cable** | Micro-USB or USB-C (depending on board) |
| **Computer** | Windows, macOS, or Linux for building and flashing |

> **Note:** ESP32-C3 and ESP32-S2 also support CSI but have limited subcarrier count. ESP32-WROOM-32 is recommended.

## Quick Start

### 1. Install ESP-IDF

Follow the official guide: https://docs.espressif.com/projects/esp-idf/en/latest/esp32/get-started/

**Linux/macOS:**
```bash
mkdir -p ~/esp
cd ~/esp
git clone -b v5.4 --recursive https://github.com/espressif/esp-idf.git
cd esp-idf
./install.sh esp32
source export.sh
```

**Windows:**
Download the [ESP-IDF Tools Installer](https://dl.espressif.com/dl/esp-idf/) and run it.

### 2. Build the Firmware

```bash
cd esp32-firmware
idf.py set-target esp32
idf.py build
```

### 3. Flash to ESP32

Connect the ESP32 via USB, then:

```bash
idf.py -p /dev/ttyUSB0 flash monitor
```

Replace `/dev/ttyUSB0` with your serial port:
- **Linux:** `/dev/ttyUSB0` or `/dev/ttyACM0`
- **macOS:** `/dev/cu.usbserial-*` or `/dev/cu.SLAB_USBtoUART`
- **Windows:** `COM3` (check Device Manager)

### 4. Connect the Web App

**Option A — Phone/tablet (WebSocket):**
1. Connect your phone to the `VitalScan-ESP32` WiFi network (password: `vitalscan`)
2. Open the VitalScan web app
3. Tap the connection icon and select **WebSocket**
4. Enter `ws://192.168.4.1:81` and tap **Connect**

**Option B — Desktop (Web Serial):**
1. Keep the ESP32 plugged in via USB
2. Open the VitalScan web app in Chrome or Edge
3. Click the connection icon and select **Web Serial**
4. Click **Connect** and select the ESP32 serial port

## Configuration

Use `idf.py menuconfig` to change settings under **VitalScan CSI Configuration**:

| Setting | Default | Description |
|---------|---------|-------------|
| WiFi Mode | SoftAP | SoftAP (creates network) or Station (joins network) |
| SoftAP SSID | `VitalScan-ESP32` | Name of the created WiFi network |
| SoftAP Password | `vitalscan` | WiFi password (empty = open network) |
| SoftAP Channel | 6 | WiFi channel (1–13) |
| Station SSID | — | WiFi network to join (Station mode only) |
| Station Password | — | WiFi password (Station mode only) |
| WebSocket Port | 81 | Port for WebSocket server |
| CSI Send Rate | 50 ms | Data rate (50 ms = 20 Hz) |
| Serial Output | Enabled | Stream data over USB serial |

## Project Structure

```
esp32-firmware/
├── CMakeLists.txt          # ESP-IDF project file
├── sdkconfig.defaults      # Default build configuration
├── README.md               # This file
└── main/
    ├── CMakeLists.txt      # Component registration
    ├── Kconfig.projbuild   # Menuconfig options
    ├── main.c              # Entry point — WiFi init, task creation
    ├── csi_handler.h       # CSI collection API
    ├── csi_handler.c       # CSI callback, I/Q → amplitude extraction
    ├── ws_server.h         # WebSocket server API
    └── ws_server.c         # HTTP + WebSocket server, JSON formatting
```

## How CSI Works

WiFi CSI (Channel State Information) describes the channel frequency response between a transmitter and receiver. The ESP32 can extract CSI from every received WiFi frame:

1. **Each WiFi frame** contains training fields (LTF) that the receiver uses to estimate the channel
2. **The ESP-IDF CSI API** provides the raw I/Q (in-phase/quadrature) values for each OFDM subcarrier
3. **Amplitude** = √(I² + Q²) for each subcarrier — this is what the web app visualises
4. **Human presence** causes periodic fluctuations in these amplitudes due to body micro-movements (breathing, heartbeat)

For a 20 MHz channel (HT20), the ESP32 reports up to 64 subcarrier pairs.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **Build fails** | Ensure ESP-IDF v5.0+ is installed and `source export.sh` has been run |
| **No serial port found** | Install USB-to-UART drivers: [CP210x](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers) or [CH340](http://www.wch-ic.com/downloads/CH341SER_ZIP.html) |
| **No CSI data** | CSI requires WiFi traffic. In SoftAP mode, connect a device and generate traffic (e.g., ping) |
| **WebSocket won't connect** | Verify the phone is on the ESP32's WiFi network and the IP is `192.168.4.1` |
| **Low CSI rate** | Increase WiFi traffic — CSI is only captured on received frames |
| **Web Serial unsupported** | Web Serial only works in Chrome/Edge on desktop (not mobile) |

## Generating WiFi Traffic for CSI

CSI data is captured from **received WiFi frames**. In SoftAP mode, you need a client device to generate traffic:

- **Ping:** From the connected phone, ping `192.168.4.1`
- **Web app connection:** The WebSocket connection itself generates frames
- **Active scanning:** The ESP32 captures probe request/response frames from nearby devices

For continuous CSI at 20 Hz, a steady stream of ping packets works well:

```bash
# From a device connected to VitalScan-ESP32
ping -i 0.05 192.168.4.1    # 20 pings/second
```

## License

This firmware is part of the [VitalScan — WiFi Life Detector](../README.md) project.
