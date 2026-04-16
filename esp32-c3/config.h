#pragma once

// ---------------------------------------------------------------------------
// WiFi — Station credentials
// Edit these before flashing.
// ---------------------------------------------------------------------------
#define WIFI_SSID     "IOT"
#define WIFI_PASSWORD "Zaq!12345"

// STA connect timeout (ms). If unreached, firmware falls back to AP mode.
#define WIFI_STA_TIMEOUT_MS 60000

// ---------------------------------------------------------------------------
// WiFi — Access-Point fallback (used when STA connect fails)
// ---------------------------------------------------------------------------
#define AP_SSID     "VitalScan-ESP32"
#define AP_PASSWORD "vitalscan"

// ---------------------------------------------------------------------------
// WebSocket server
// ---------------------------------------------------------------------------
#define WS_PORT 81

// ---------------------------------------------------------------------------
// Serial
// ---------------------------------------------------------------------------
#define SERIAL_BAUD 115200

// ---------------------------------------------------------------------------
// CSI sampling
// Both Serial and WebSocket streams use the same timing.
// The browser-side IIR filter coefficients are hard-coded for 20 Hz.
// Do NOT change SAMPLE_INTERVAL_MS without recalculating filter coefficients.
// ---------------------------------------------------------------------------
#define SAMPLE_RATE_HZ     20
#define SAMPLE_INTERVAL_MS 50
#define SUBCARRIER_COUNT   30   // must match "sc" field in info message

// ---------------------------------------------------------------------------
// Firmware version (sent in the info message on WS connect)
// ---------------------------------------------------------------------------
#define FW_VERSION "1.0.0"

// ---------------------------------------------------------------------------
// CSI source selection
// Comment out the line below for the default synthetic CSI.
// Uncomment to enable the real ESP-IDF CSI callback (STA mode only;
// requires an associated AP sending packets fast enough for 20 Hz).
// ---------------------------------------------------------------------------
#define USE_REAL_CSI

// ---------------------------------------------------------------------------
// Synthetic CSI parameters (ignored when USE_REAL_CSI is defined)
// Mirrors the math in src/simulation/csiEngine.ts
// ---------------------------------------------------------------------------
#define SIM_BREATHING_HZ   0.25f   // ~15 br/min
#define SIM_HEARTBEAT_HZ   1.2f    // ~72 bpm
#define SIM_BREATHING_AMP  0.15f
#define SIM_HEARTBEAT_AMP  0.04f
#define SIM_NOISE_SCALE    0.08f   // peak noise amplitude (via esp_random)

// ---------------------------------------------------------------------------
// OLED display update interval (ms)
// Keep at 1000 ms — updating faster wastes CPU cycles on the CSI loop.
// ---------------------------------------------------------------------------
#define OLED_UPDATE_INTERVAL_MS 1000
