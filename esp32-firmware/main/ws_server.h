/*
 * VitalScan ESP32 CSI Firmware — WebSocket Server
 *
 * Runs an HTTP server with WebSocket upgrade on the configured port.
 * Broadcasts CSI JSON messages to all connected WebSocket clients.
 */

#ifndef WS_SERVER_H
#define WS_SERVER_H

#include <stdbool.h>
#include "csi_handler.h"

/**
 * Start the HTTP + WebSocket server on CONFIG_VITALSCAN_WS_PORT.
 * Returns true on success.
 */
bool ws_server_start(void);

/**
 * Stop the server and close all connections.
 */
void ws_server_stop(void);

/**
 * Broadcast a CSI sample as JSON to every connected WebSocket client.
 * Also prints to serial if CONFIG_VITALSCAN_SERIAL_OUTPUT is enabled.
 */
void ws_server_broadcast_csi(const csi_sample_t *sample);

/**
 * Send board info JSON to a specific client (called on new connection).
 */
void ws_server_send_board_info(int fd);

#endif /* WS_SERVER_H */
