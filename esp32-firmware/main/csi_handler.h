/*
 * VitalScan ESP32 CSI Firmware — CSI Data Handler
 *
 * Registers the ESP-IDF WiFi CSI callback, extracts per-subcarrier
 * amplitudes from raw I/Q data, and pushes them into a FreeRTOS queue
 * for the WebSocket / Serial output task.
 */

#ifndef CSI_HANDLER_H
#define CSI_HANDLER_H

#include <stdint.h>
#include <stdbool.h>

/* Maximum subcarriers we extract (HT20 = 52 data+pilot, we keep all). */
#define CSI_MAX_SUBCARRIERS 64

/* Single CSI sample ready for transmission. */
typedef struct {
    uint32_t timestamp_ms;              /* millis() at capture time         */
    int      rssi;                      /* Received signal strength (dBm)   */
    uint8_t  channel;                   /* WiFi channel                     */
    int      subcarrier_count;          /* Number of valid amplitudes       */
    float    amplitudes[CSI_MAX_SUBCARRIERS]; /* Per-subcarrier amplitude   */
} csi_sample_t;

/**
 * Initialise the CSI subsystem and start collecting.
 * CSI samples are posted to an internal FreeRTOS queue.
 * Call csi_handler_get_sample() from another task to consume them.
 */
void csi_handler_init(void);

/**
 * Block up to `timeout_ms` waiting for the next CSI sample.
 * Returns true if a sample was received, false on timeout.
 */
bool csi_handler_get_sample(csi_sample_t *out, uint32_t timeout_ms);

#endif /* CSI_HANDLER_H */
