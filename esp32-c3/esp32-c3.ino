// =============================================================================
// esp32-c3.ino — VitalScan firmware for ESP32-C3 SuperMini
//
// Streams newline-delimited JSON CSI data to:
//   • USB Serial at SERIAL_BAUD (115200) — for Web Serial (desktop Chrome/Edge)
//   • WebSocket server on WS_PORT (81)    — for WebSocket mode (any browser)
//
// WiFi strategy: tries STA mode first (WIFI_STA_TIMEOUT_MS). If the STA
// connect fails, falls back to AP mode (AP_SSID / AP_PASSWORD).
//
// CSI source: synthetic 20 Hz by default. Define USE_REAL_CSI in config.h
// to switch to genuine IDF CSI callback (requires STA + partner AP).
//
// Required Arduino libraries (install via Library Manager):
//   - WebSockets         (Links2004) — IDF5-compatible WebSocket server
//   - ArduinoJson        (bblanchon) — version 7.x
//   - U8g2               (olikraus)
//
// Board: "ESP32C3 Dev Module" in Arduino IDE (or PlatformIO esp32 target).
// =============================================================================

#include <Arduino.h>
#include <WiFi.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>
#include <esp_wifi.h>      // IDF-level config: force WPA2-PSK/AES, manual retry

#include "config.h"
#include "protocol.h"
#include "csi_source.h"
#include "oled.h"

// ---------------------------------------------------------------------------
// Globals
// ---------------------------------------------------------------------------
WebSocketsServer webSocket(WS_PORT);

CSISource  csiSource;
OledDisplay oled;

static bool     g_apMode       = false;
static uint8_t  g_wsClients    = 0;    // active WebSocket client count
static uint32_t g_sampleCount  = 0;
static uint32_t g_lastSample   = 0;   // millis() of last CSI tick
static uint32_t g_lastOled     = 0;   // millis() of last OLED refresh

// Reusable JSON document (allocated once, cleared per message)
static JsonDocument g_doc;

// Output buffer sized for worst-case CSI JSON:
//   {"type":"csi","ts":4294967295,"amps":[1.0000, …×30]} ≈ 350 bytes + \n
static char g_txBuf[512];

// ---------------------------------------------------------------------------
// WebSocket event handler
// ---------------------------------------------------------------------------
void webSocketEvent(uint8_t num, WStype_t type, uint8_t* payload, size_t length)
{
    switch (type) {
        case WStype_CONNECTED:
            Serial.printf("[WS] Client #%u connected\n", num);
            g_wsClients++;
            // Send board info immediately on connect
            buildInfoMessage(g_doc);
            serializeTo(g_doc, g_txBuf, sizeof(g_txBuf));
            webSocket.sendTXT(num, g_txBuf);
            break;

        case WStype_DISCONNECTED:
            Serial.printf("[WS] Client #%u disconnected\n", num);
            if (g_wsClients > 0) g_wsClients--;
            break;

        default:
            break;
    }
}

// ---------------------------------------------------------------------------
// WiFi event handler — captures IDF disconnect reason codes
// ---------------------------------------------------------------------------
void wifiEventHandler(WiFiEvent_t event, WiFiEventInfo_t info) {
    switch (event) {
        case ARDUINO_EVENT_WIFI_STA_START:
            Serial.println("[WiFi-EV] STA started");
            break;
        case ARDUINO_EVENT_WIFI_STA_CONNECTED:
            Serial.println("[WiFi-EV] STA connected to AP");
            break;
        case ARDUINO_EVENT_WIFI_STA_DISCONNECTED: {
            uint8_t r = info.wifi_sta_disconnected.reason;
            // Reason codes: 802.11-2020 Table 9-49 (1-46) + ESP-IDF internal (200-212)
            // esp_wifi_types.h WIFI_REASON_* enum (IDF 5.x):
            const char* name =
                r == 1   ? "UNSPECIFIED"              :
                r == 2   ? "AUTH_EXPIRE"               :   // wrong PSK / auth timer expired
                r == 3   ? "AUTH_LEAVE"                :
                r == 4   ? "ASSOC_EXPIRE"              :
                r == 5   ? "ASSOC_TOOMANY"             :
                r == 6   ? "NOT_AUTHED"                :
                r == 7   ? "NOT_ASSOCED"               :
                r == 8   ? "ASSOC_LEAVE"               :
                r == 15  ? "4WAY_HANDSHAKE_TIMEOUT"    :   // wrong PSK (confirmed)
                r == 16  ? "GROUP_KEY_UPDATE_TIMEOUT"  :
                r == 17  ? "IE_IN_4WAY_DIFFERS"        :
                r == 23  ? "802_1X_AUTH_FAILED"        :
                r == 24  ? "CIPHER_SUITE_REJECTED"     :
                r == 34  ? "MISSING_ACKS"              :
                r == 36  ? "STA_REQUESTING_LEAVE"      :   // NOT invalid-IE; STA-initiated
                r == 200 ? "BEACON_TIMEOUT"            :   // IDF internal
                r == 201 ? "NO_AP_FOUND"               :   // IDF internal
                r == 202 ? "AUTH_FAIL"                 :   // IDF internal
                r == 203 ? "ASSOC_FAIL"                :   // IDF internal
                r == 204 ? "HANDSHAKE_TIMEOUT"         :   // IDF internal — wrong PSK
                r == 205 ? "CONNECTION_FAIL"           :   // IDF internal
                r == 210 ? "NO_AP_COMPATIBLE_SECURITY" :   // IDF internal
                r == 211 ? "NO_AP_IN_AUTHMODE_THRESHOLD": "UNKNOWN";
            Serial.printf("[WiFi-EV] Disconnected, reason: %d (%s)\n", r, name);
            break;
        }
        case ARDUINO_EVENT_WIFI_STA_GOT_IP:
            Serial.printf("[WiFi-EV] Got IP: %s\n",
                          IPAddress(info.got_ip.ip_info.ip.addr).toString().c_str());
            break;
        default:
            Serial.printf("[WiFi-EV] Event: %d\n", event);
            break;
    }
}

// ---------------------------------------------------------------------------
// WiFi helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// WiFi helpers
// ---------------------------------------------------------------------------

bool connectSTA() {
    WiFi.onEvent(wifiEventHandler);
    WiFi.persistent(false);
    WiFi.mode(WIFI_STA);
    // Disable modem sleep: delays association frames → AUTH_EXPIRE (reason 2).
    esp_wifi_set_ps(WIFI_PS_NONE);
    // Let the library manage reconnect so it doesn't fight our retry loop.
    WiFi.setAutoReconnect(false);

    Serial.printf("[WiFi] STA MAC: %s\n", WiFi.macAddress().c_str());

    // Diagnostic scan — log what the AP advertises (channel + authmode).
    // We do NOT pass the channel as a hint to WiFi.begin(); that pin causes
    // issues when the AP briefly switches secondary channels.
    Serial.printf("[WiFi] Scanning for SSID '%s'...\n", WIFI_SSID);
    int    nFound   = WiFi.scanNetworks(false, false);
    int8_t bestRssi = -128;
    for (int i = 0; i < nFound; i++) {
        if (WiFi.SSID(i) == WIFI_SSID && (int8_t)WiFi.RSSI(i) > bestRssi) {
            bestRssi = (int8_t)WiFi.RSSI(i);
            const char* encName =
                WiFi.encryptionType(i) == WIFI_AUTH_OPEN         ? "OPEN"          :
                WiFi.encryptionType(i) == WIFI_AUTH_WEP          ? "WEP"           :
                WiFi.encryptionType(i) == WIFI_AUTH_WPA_PSK      ? "WPA-PSK"       :
                WiFi.encryptionType(i) == WIFI_AUTH_WPA2_PSK     ? "WPA2-PSK"      :
                WiFi.encryptionType(i) == WIFI_AUTH_WPA_WPA2_PSK ? "WPA/WPA2-PSK"  :
                WiFi.encryptionType(i) == WIFI_AUTH_WPA3_PSK     ? "WPA3-PSK"      :
                WiFi.encryptionType(i) == WIFI_AUTH_WPA2_WPA3_PSK? "WPA2/WPA3-PSK" : "OTHER";
            Serial.printf("[WiFi] Found '%s' ch=%d RSSI=%d dBm authmode=%s(%d)\n",
                          WIFI_SSID, (int)WiFi.channel(i), bestRssi,
                          encName, (int)WiFi.encryptionType(i));
        }
    }
    WiFi.scanDelete();
    if (bestRssi == -128)
        Serial.printf("[WiFi] SSID '%s' not found in scan\n", WIFI_SSID);

    // Use WiFi.begin() — the Arduino library sets up the RSNE, PMF, and auth
    // negotiation correctly without needing manual IDF calls.
    // If AUTH_EXPIRE (reason 2) or HANDSHAKE_TIMEOUT (reason 204) persists,
    // the password in config.h does not match the AP's configured PSK.
    Serial.printf("[WiFi] Connecting to '%s'...\n", WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    uint32_t start = millis();
    while (WiFi.status() != WL_CONNECTED) {
        if (millis() - start > WIFI_STA_TIMEOUT_MS) {
            Serial.printf("[WiFi] STA timeout after %lu ms (status=%d)\n",
                          millis() - start, (int)WiFi.status());
            WiFi.disconnect(true);
            return false;
        }
        delay(500);
        Serial.printf("[WiFi]   status=%d  elapsed=%lu ms\n",
                      (int)WiFi.status(), millis() - start);
    }
    Serial.printf("[WiFi] STA connected. IP: %s  RSSI: %d dBm\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
    return true;
}

void startAP() {
    Serial.printf("[WiFi] Starting AP: %s\n", AP_SSID);
    // Stop STA cleanly — do NOT call WiFi.mode(WIFI_AP) before softAP().
    // WiFi.mode(WIFI_AP) starts the AP subsystem, and then softAP() calls
    // esp_wifi_set_mode(AP) + restarts it internally, producing the
    // AP_START → AP_STOP → AP_START event storm that leaves the AP in an
    // indeterminate state and invisible to scanners.
    // Correct sequence: stop WiFi, then let softAP() handle mode + start.
    WiFi.mode(WIFI_OFF);
    delay(500);                          // full radio power-down settle
    // softAP() sets mode to WIFI_AP and starts the radio itself.
    // Channel 6 — non-overlapping standard channel, matches area scan.
    // max_connection = 4 (default), hidden = 0 (broadcast SSID).
    WiFi.softAP(AP_SSID, AP_PASSWORD, 6, 0, 4);
    delay(200);                          // let beacons start
    Serial.printf("[WiFi] AP IP: %s\n",
                  WiFi.softAPIP().toString().c_str());
    g_apMode = true;
}

// ---------------------------------------------------------------------------
// setup()
// ---------------------------------------------------------------------------
void setup() {
    Serial.begin(SERIAL_BAUD);
    // Give the host a moment to open the serial monitor
    delay(500);
    Serial.println("[Boot] VitalScan ESP32-C3 firmware starting");

    // OLED — show splash while connecting
    oled.init();

    // WiFi
    if (!connectSTA()) {
        startAP();
    }

    // CSI source
    csiSource.init();

    // WebSocket server
    webSocket.begin();
    webSocket.onEvent(webSocketEvent);
    Serial.printf("[WS] WebSocket server started on port %d\n", WS_PORT);

    // Prime the sampling timer so the first tick fires immediately
    g_lastSample = millis() - SAMPLE_INTERVAL_MS;
    g_lastOled   = millis();

    // Initial OLED update
    String _ipStr0 = g_apMode ? WiFi.softAPIP().toString() : WiFi.localIP().toString();
    oled.update(_ipStr0.c_str(), g_wsClients, WiFi.RSSI(), 0, g_apMode);
}

// ---------------------------------------------------------------------------
// loop()
// ---------------------------------------------------------------------------
void loop() {
    // Process WebSocket events (must be called every loop iteration)
    webSocket.loop();

    uint32_t now = millis();

    // ---- 20 Hz CSI tick ------------------------------------------------
    // Drift-correct by advancing lastSample in fixed steps, not by setting
    // it to `now`. This prevents the interval from creeping when loop() is
    // briefly delayed.
    if (now - g_lastSample >= SAMPLE_INTERVAL_MS) {
        g_lastSample += SAMPLE_INTERVAL_MS;

        // 1. Acquire amplitudes
        float amps[SUBCARRIER_COUNT];
        csiSource.tick(amps, SUBCARRIER_COUNT);

        // 2. Build JSON
        buildCSIMessage(g_doc, millis(), amps, SUBCARRIER_COUNT);
        size_t n = serializeTo(g_doc, g_txBuf, sizeof(g_txBuf));
        if (n == 0) {
            Serial.println("[ERR] JSON serialization overflow — skipping frame");
            return;
        }

        // 3. Broadcast — Serial first (always), then WS clients (if any)
        Serial.write(reinterpret_cast<const uint8_t*>(g_txBuf), n);
        if (g_wsClients > 0) {
            webSocket.broadcastTXT(g_txBuf, n);
        }

        g_sampleCount++;
    }

    // ---- 1 Hz OLED update ----------------------------------------------
    if (now - g_lastOled >= OLED_UPDATE_INTERVAL_MS) {
        g_lastOled += OLED_UPDATE_INTERVAL_MS;

        String _ipStr = g_apMode ? WiFi.softAPIP().toString() : WiFi.localIP().toString();
        int8_t rssi = g_apMode ? 0 : (int8_t)WiFi.RSSI();

        oled.update(_ipStr.c_str(), g_wsClients, rssi, g_sampleCount, g_apMode);
    }
}
