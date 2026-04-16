#pragma once

#include <math.h>
#include <esp_random.h>
#include "config.h"

// ---------------------------------------------------------------------------
// csi_source.h — CSI amplitude source abstraction
//
// Two implementations selected at compile time via USE_REAL_CSI:
//
//   CSISynthetic (default)
//     Mirrors the math in src/simulation/csiEngine.ts.
//     Produces 30 subcarrier amplitudes at 20 Hz with simulated breathing,
//     heartbeat, and hardware-TRNG noise. No second AP required.
//
//   CSIReal (requires #define USE_REAL_CSI in config.h)
//     Hooks the ESP-IDF CSI receive callback to capture genuine LLTF
//     subcarrier amplitudes from incoming WiFi packets. Requires STA mode
//     and a partner AP. Packet rate may be irregular; the tick() method
//     re-uses the last captured frame when no new packet has arrived.
//
// Usage (both variants share the same interface):
//   CSISource csiSource;
//   csiSource.init();
//   float amps[SUBCARRIER_COUNT];
//   csiSource.tick(amps, SUBCARRIER_COUNT);  // call every SAMPLE_INTERVAL_MS
// ---------------------------------------------------------------------------

#ifndef USE_REAL_CSI

// ===========================================================================
// SYNTHETIC CSI
// ===========================================================================

class CSISource {
public:
    void init() {
        _t      = 0.0f;
        _dt     = 1.0f / SAMPLE_RATE_HZ;  // 0.05 s
        _phase1 = 0.0f;  // breathing phase accumulator
        _phase2 = 0.0f;  // heartbeat phase accumulator
    }

    // Fill `out` with `count` synthetic subcarrier amplitudes.
    // Mirrors csiEngine.ts generateSample() for a single subject.
    void tick(float* out, int count) {
        // Advance phase accumulators (avoids floating-point drift from
        // accumulating t × frequency products over thousands of samples)
        _phase1 += 2.0f * M_PI * SIM_BREATHING_HZ * _dt;
        if (_phase1 > 2.0f * M_PI) _phase1 -= 2.0f * M_PI;

        _phase2 += 2.0f * M_PI * SIM_HEARTBEAT_HZ * _dt;
        if (_phase2 > 2.0f * M_PI) _phase2 -= 2.0f * M_PI;

        for (int sc = 0; sc < count; sc++) {
            float breathing = SIM_BREATHING_AMP *
                              sinf(_phase1 + sc * 0.1f);
            float heartbeat = SIM_HEARTBEAT_AMP *
                              sinf(_phase2 + sc * 0.05f);

            // Hardware-TRNG noise in range [-SIM_NOISE_SCALE, +SIM_NOISE_SCALE]
            float noise = ((float)(esp_random() & 0xFFFF) / 32767.5f - 1.0f)
                          * SIM_NOISE_SCALE;

            out[sc] = 1.0f + breathing + heartbeat + noise;
        }

        _t += _dt;
    }

private:
    float _t;
    float _dt;
    float _phase1;
    float _phase2;
};

#else  // USE_REAL_CSI

// ===========================================================================
// REAL IDF CSI
// ===========================================================================
// Requires:
//   - Board in STA mode and associated with an AP
//   - arduino-esp32 core >= 2.x (exposes esp_wifi.h & esp_wifi_types.h)
//   - A partner device sending WiFi packets at sufficient rate
//
// The callback fires asynchronously on the WiFi task; we guard the shared
// buffer with a volatile flag (no mutex needed on single-core C3).
// ===========================================================================

#include <esp_wifi.h>
#include <esp_wifi_types.h>

class CSISource {
public:
    void init() {
        memset(const_cast<float*>(_lastFrame), 0, sizeof(_lastFrame));
        _newFrame = false;

        // Request CSI for every received frame
        wifi_csi_config_t cfg = {};
        cfg.lltf_en     = true;
        cfg.htltf_en    = false;
        cfg.stbc_htltf2_en = false;
        cfg.ltf_merge_en   = true;
        cfg.channel_filter_en = true;
        cfg.manu_scale   = false;
        cfg.shift        = 0;
        esp_wifi_set_csi_config(&cfg);
        esp_wifi_set_csi_rx_cb(_csiCallback, this);
        esp_wifi_set_csi(true);
    }

    // Copy the latest CSI frame into `out`.
    // If no new packet arrived since the last call, the previous frame is
    // re-used (common when the AP is quiet).
    void tick(float* out, int count) {
        _newFrame = false;  // consume
        int copy = (count < SUBCARRIER_COUNT) ? count : SUBCARRIER_COUNT;
        for (int i = 0; i < copy; i++) {
            out[i] = _lastFrame[i];
        }
        // Zero-fill any remaining slots if count > SUBCARRIER_COUNT
        for (int i = copy; i < count; i++) {
            out[i] = 0.0f;
        }
    }

private:
    // Shared between WiFi ISR and main loop — volatile to prevent
    // the compiler from caching values in registers
    volatile float _lastFrame[SUBCARRIER_COUNT];
    volatile bool  _newFrame;

    static void _csiCallback(void* ctx, wifi_csi_info_t* info) {
        if (!ctx || !info || !info->buf) return;
        CSISource* self = static_cast<CSISource*>(ctx);

        // LLTF imaginary parts are at fixed offsets in the CSI buffer.
        // Each subcarrier entry is 2 bytes: [imag(int8), real(int8)].
        // We use |imag| as a proxy for amplitude magnitude.
        const int8_t* buf = reinterpret_cast<const int8_t*>(info->buf);
        int available = info->len / 2;  // number of complex pairs
        int count = (available < SUBCARRIER_COUNT) ? available : SUBCARRIER_COUNT;

        for (int i = 0; i < count; i++) {
            float re = buf[i * 2 + 1];
            float im = buf[i * 2];
            self->_lastFrame[i] = sqrtf(re * re + im * im) / 128.0f;
        }
        self->_newFrame = true;
    }
};

#endif  // USE_REAL_CSI
