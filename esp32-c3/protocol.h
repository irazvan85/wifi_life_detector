#pragma once

#include <ArduinoJson.h>
#include <WiFi.h>
#include "config.h"

// ---------------------------------------------------------------------------
// protocol.h — JSON message builders
//
// Wire format (newline-delimited JSON, defined in src/hardware/csiProtocol.ts):
//
//   CSI sample:
//     {"type":"csi","ts":<millis>,"amps":[<f32>,…]}   // SUBCARRIER_COUNT floats
//
//   Board info (sent once per client on WS connect):
//     {"type":"info","board":"ESP32-C3","mac":"AA:BB:CC:DD:EE:FF",
//      "fw":"1.0.0","ch":6,"bw":"20 MHz","std":"802.11n",
//      "freq":"2.4 GHz","sc":30,"rate":20,"rssi":-45}
//
// IMPORTANT: Do not change field names — the browser parser matches them
// exactly (see src/hardware/csiProtocol.ts parseJSON()).
// ---------------------------------------------------------------------------

// Serialise doc to buf, append a newline, and return total bytes written
// (excluding null terminator). Returns 0 on overflow.
inline size_t serializeTo(const JsonDocument& doc, char* buf, size_t bufLen) {
    size_t written = serializeJson(doc, buf, bufLen - 1); // leave room for \n
    if (written == 0 || written >= bufLen - 1) return 0;
    buf[written]     = '\n';
    buf[written + 1] = '\0';
    return written + 1;
}

// Populate doc with the board info message.
// Call this once per connected WebSocket client.
inline void buildInfoMessage(JsonDocument& doc) {
    doc.clear();
    doc["type"]  = "info";
    doc["board"] = "ESP32-C3";

    // MAC address
    uint8_t mac[6];
    WiFi.macAddress(mac);
    char macStr[18];
    snprintf(macStr, sizeof(macStr), "%02X:%02X:%02X:%02X:%02X:%02X",
             mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
    doc["mac"] = macStr;

    doc["fw"]   = FW_VERSION;
    doc["ch"]   = WiFi.channel();
    doc["bw"]   = "20 MHz";
    doc["std"]  = "802.11n";
    doc["freq"] = "2.4 GHz";
    doc["sc"]   = SUBCARRIER_COUNT;
    doc["rate"] = SAMPLE_RATE_HZ;
    doc["rssi"] = (WiFi.status() == WL_CONNECTED) ? WiFi.RSSI() : 0;
}

// Populate doc with a CSI sample message.
// amps must point to at least `count` floats.
inline void buildCSIMessage(JsonDocument& doc, uint32_t ts, const float* amps, int count) {
    doc.clear();
    doc["type"] = "csi";
    doc["ts"]   = ts;
    JsonArray arr = doc["amps"].to<JsonArray>();
    for (int i = 0; i < count; i++) {
        // Round to 4 decimal places to keep JSON payload compact
        arr.add(roundf(amps[i] * 10000.0f) / 10000.0f);
    }
}
