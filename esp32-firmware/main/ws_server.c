/*
 * VitalScan ESP32 CSI Firmware — WebSocket Server
 *
 * Uses the ESP-IDF HTTP server with WebSocket support to stream
 * CSI data in the JSON format expected by the VitalScan web app:
 *
 *   {"type":"csi","ts":<ms>,"amps":[<a0>,<a1>,...]}
 *   {"type":"info","board":"ESP32",...}
 */

#include "ws_server.h"

#include <stdio.h>
#include <string.h>
#include <math.h>

#include "esp_log.h"
#include "esp_wifi.h"
#include "esp_mac.h"
#include "esp_http_server.h"

static const char *TAG = "ws_server";

/* ------------------------------------------------------------------
 *  Connected clients tracking
 * ------------------------------------------------------------------ */

#define MAX_WS_CLIENTS 4

static httpd_handle_t s_server = NULL;
static int            s_client_fds[MAX_WS_CLIENTS];
static int            s_client_count = 0;

static void add_client(int fd)
{
    if (s_client_count < MAX_WS_CLIENTS) {
        s_client_fds[s_client_count++] = fd;
        ESP_LOGI(TAG, "Client connected (fd=%d, total=%d)", fd, s_client_count);
    } else {
        ESP_LOGW(TAG, "Max clients reached, rejecting fd=%d", fd);
    }
}

static void remove_client(int fd)
{
    for (int i = 0; i < s_client_count; i++) {
        if (s_client_fds[i] == fd) {
            s_client_fds[i] = s_client_fds[--s_client_count];
            ESP_LOGI(TAG, "Client disconnected (fd=%d, total=%d)", fd, s_client_count);
            return;
        }
    }
}

/* ------------------------------------------------------------------
 *  JSON formatting helpers
 * ------------------------------------------------------------------ */

/*
 * Format a CSI sample as a JSON line.
 * Output: {"type":"csi","ts":12345,"amps":[1.02,0.98,...]}\n
 */
static int format_csi_json(char *buf, size_t buf_len, const csi_sample_t *s)
{
    int off = snprintf(buf, buf_len, "{\"type\":\"csi\",\"ts\":%lu,\"amps\":[",
                       (unsigned long)s->timestamp_ms);
    if (off < 0 || (size_t)off >= buf_len) return -1;

    for (int i = 0; i < s->subcarrier_count; i++) {
        int n;
        if (i > 0) {
            n = snprintf(buf + off, buf_len - off, ",%.2f", s->amplitudes[i]);
        } else {
            n = snprintf(buf + off, buf_len - off, "%.2f", s->amplitudes[i]);
        }
        if (n < 0 || (size_t)(off + n) >= buf_len) return -1;
        off += n;
    }

    int n = snprintf(buf + off, buf_len - off, "]}\n");
    if (n < 0 || (size_t)(off + n) >= buf_len) return -1;
    off += n;

    return off;
}

/*
 * Format board info as a JSON line matching the web app protocol.
 */
static int format_board_info_json(char *buf, size_t buf_len)
{
    uint8_t mac[6];
    esp_wifi_get_mac(WIFI_IF_AP, mac);

    wifi_country_t country;
    esp_wifi_get_country(&country);

    int off = snprintf(buf, buf_len,
        "{\"type\":\"info\","
        "\"board\":\"ESP32\","
        "\"mac\":\"%02X:%02X:%02X:%02X:%02X:%02X\","
        "\"fw\":\"1.0.0\","
        "\"ch\":%d,"
        "\"bw\":\"20 MHz\","
        "\"std\":\"802.11n\","
        "\"freq\":\"2.4 GHz\","
        "\"sc\":64,"
        "\"rate\":20,"
        "\"rssi\":0"
        "}\n",
        mac[0], mac[1], mac[2], mac[3], mac[4], mac[5],
#ifdef CONFIG_VITALSCAN_SOFTAP_CHANNEL
        CONFIG_VITALSCAN_SOFTAP_CHANNEL
#else
        6
#endif
    );
    return (off > 0 && (size_t)off < buf_len) ? off : -1;
}

/* ------------------------------------------------------------------
 *  WebSocket handler
 * ------------------------------------------------------------------ */

static esp_err_t ws_handler(httpd_req_t *req)
{
    /* Handle new connection (HTTP upgrade). */
    if (req->method == HTTP_GET) {
        int fd = httpd_req_to_sockfd(req);
        add_client(fd);

        /* Send board info to the new client. */
        ws_server_send_board_info(fd);
        return ESP_OK;
    }

    /* Read incoming WebSocket frame (we don't expect client data,
       but we must consume it to keep the connection alive). */
    httpd_ws_frame_t ws_pkt;
    memset(&ws_pkt, 0, sizeof(ws_pkt));
    ws_pkt.type = HTTPD_WS_TYPE_TEXT;

    esp_err_t ret = httpd_ws_recv_frame(req, &ws_pkt, 0);
    if (ret != ESP_OK) {
        ESP_LOGW(TAG, "ws recv error: %s", esp_err_to_name(ret));
        remove_client(httpd_req_to_sockfd(req));
    }

    return ret;
}

/* ------------------------------------------------------------------
 *  Public API
 * ------------------------------------------------------------------ */

bool ws_server_start(void)
{
    httpd_config_t config = HTTPD_DEFAULT_CONFIG();

#ifdef CONFIG_VITALSCAN_WS_PORT
    config.server_port = CONFIG_VITALSCAN_WS_PORT;
#else
    config.server_port = 81;
#endif
    config.ctrl_port   = config.server_port + 1;

    /* Allow WebSocket upgrade on "/" */
    config.max_open_sockets = MAX_WS_CLIENTS + 1;

    esp_err_t ret = httpd_start(&s_server, &config);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to start HTTP server: %s", esp_err_to_name(ret));
        return false;
    }

    /* Register WebSocket URI handler at "/" */
    static const httpd_uri_t ws_uri = {
        .uri       = "/",
        .method    = HTTP_GET,
        .handler   = ws_handler,
        .user_ctx  = NULL,
        .is_websocket = true,
        .handle_ws_control_frames = true,
    };

    httpd_register_uri_handler(s_server, &ws_uri);
    ESP_LOGI(TAG, "WebSocket server started on port %d", config.server_port);

    s_client_count = 0;
    return true;
}

void ws_server_stop(void)
{
    if (s_server) {
        httpd_stop(s_server);
        s_server = NULL;
        s_client_count = 0;
        ESP_LOGI(TAG, "WebSocket server stopped");
    }
}

void ws_server_broadcast_csi(const csi_sample_t *sample)
{
    /* 64 subcarriers × ~7 chars each + JSON overhead ≈ 600 bytes max. */
    static char json_buf[1024];

    int len = format_csi_json(json_buf, sizeof(json_buf), sample);
    if (len <= 0) {
        return;
    }

    /* Serial output (also used by Web Serial adapter). */
#ifdef CONFIG_VITALSCAN_SERIAL_OUTPUT
    printf("%s", json_buf);
#endif

    /* Broadcast to all WebSocket clients. */
    if (!s_server || s_client_count == 0) {
        return;
    }

    httpd_ws_frame_t ws_pkt = {
        .type    = HTTPD_WS_TYPE_TEXT,
        .payload = (uint8_t *)json_buf,
        .len     = len - 1,  /* Exclude trailing newline for WS frame */
    };

    for (int i = 0; i < s_client_count; /* no increment */) {
        esp_err_t ret = httpd_ws_send_frame_async(s_server, s_client_fds[i], &ws_pkt);
        if (ret != ESP_OK) {
            ESP_LOGW(TAG, "Send failed to fd=%d, removing", s_client_fds[i]);
            remove_client(s_client_fds[i]);
            /* Don't increment i — the array was compacted. */
        } else {
            i++;
        }
    }
}

void ws_server_send_board_info(int fd)
{
    static char info_buf[512];

    int len = format_board_info_json(info_buf, sizeof(info_buf));
    if (len <= 0) {
        return;
    }

    /* Also print to serial on first connection. */
#ifdef CONFIG_VITALSCAN_SERIAL_OUTPUT
    printf("%s", info_buf);
#endif

    if (!s_server) return;

    httpd_ws_frame_t ws_pkt = {
        .type    = HTTPD_WS_TYPE_TEXT,
        .payload = (uint8_t *)info_buf,
        .len     = len - 1,
    };

    esp_err_t ret = httpd_ws_send_frame_async(s_server, fd, &ws_pkt);
    if (ret != ESP_OK) {
        ESP_LOGW(TAG, "Failed to send board info to fd=%d", fd);
    }
}
