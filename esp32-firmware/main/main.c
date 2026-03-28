/*
 * VitalScan ESP32 CSI Firmware — Main Entry Point
 *
 * Sets up WiFi (SoftAP or Station mode), starts the WebSocket server,
 * enables CSI collection, and runs the main loop that reads CSI samples
 * from the handler queue and broadcasts them.
 *
 * Protocol output (matches src/hardware/csiProtocol.ts):
 *   {"type":"csi","ts":<ms>,"amps":[<a0>,<a1>,...]}
 *   {"type":"info","board":"ESP32","mac":"...","fw":"1.0.0",...}
 *
 * Build:  idf.py build
 * Flash:  idf.py -p /dev/ttyUSB0 flash monitor
 */

#include <stdio.h>
#include <string.h>
#include <inttypes.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"

#include "esp_system.h"
#include "esp_log.h"
#include "esp_event.h"
#include "esp_wifi.h"
#include "esp_netif.h"
#include "nvs_flash.h"

#include "csi_handler.h"
#include "ws_server.h"

static const char *TAG = "vitalscan";

/* Event group for WiFi connection state. */
static EventGroupHandle_t s_wifi_event_group;
#define WIFI_CONNECTED_BIT BIT0

/* ------------------------------------------------------------------ */
/*  WiFi event handlers                                               */
/* ------------------------------------------------------------------ */

static void wifi_event_handler(void *arg, esp_event_base_t event_base,
                               int32_t event_id, void *event_data)
{
    if (event_base == WIFI_EVENT) {
        switch (event_id) {
            case WIFI_EVENT_AP_STACONNECTED: {
                wifi_event_ap_staconnected_t *e = event_data;
                ESP_LOGI(TAG, "Station connected: " MACSTR, MAC2STR(e->mac));
                break;
            }
            case WIFI_EVENT_AP_STADISCONNECTED: {
                wifi_event_ap_stadisconnected_t *e = event_data;
                ESP_LOGI(TAG, "Station disconnected: " MACSTR, MAC2STR(e->mac));
                break;
            }
            case WIFI_EVENT_STA_START:
                esp_wifi_connect();
                break;
            case WIFI_EVENT_STA_DISCONNECTED:
                ESP_LOGW(TAG, "WiFi disconnected, reconnecting...");
                esp_wifi_connect();
                xEventGroupClearBits(s_wifi_event_group, WIFI_CONNECTED_BIT);
                break;
            default:
                break;
        }
    } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t *e = event_data;
        ESP_LOGI(TAG, "Got IP: " IPSTR, IP2STR(&e->ip_info.ip));
        xEventGroupSetBits(s_wifi_event_group, WIFI_CONNECTED_BIT);
    }
}

/* ------------------------------------------------------------------ */
/*  WiFi initialisation                                               */
/* ------------------------------------------------------------------ */

static void wifi_init_softap(void)
{
    esp_netif_create_default_wifi_ap();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    ESP_ERROR_CHECK(esp_event_handler_instance_register(
        WIFI_EVENT, ESP_EVENT_ANY_ID, &wifi_event_handler, NULL, NULL));

    wifi_config_t wifi_cfg = {
        .ap = {
#ifdef CONFIG_VITALSCAN_SOFTAP_SSID
            .ssid           = CONFIG_VITALSCAN_SOFTAP_SSID,
#else
            .ssid           = "VitalScan-ESP32",
#endif
#ifdef CONFIG_VITALSCAN_SOFTAP_PASS
            .password       = CONFIG_VITALSCAN_SOFTAP_PASS,
#else
            .password       = "vitalscan",
#endif
#ifdef CONFIG_VITALSCAN_SOFTAP_CHANNEL
            .channel        = CONFIG_VITALSCAN_SOFTAP_CHANNEL,
#else
            .channel        = 6,
#endif
            .max_connection = 4,
            .authmode       = WIFI_AUTH_WPA2_PSK,
        },
    };

    /* Use open auth if password is empty. */
    if (strlen((const char *)wifi_cfg.ap.password) == 0) {
        wifi_cfg.ap.authmode = WIFI_AUTH_OPEN;
    }

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_AP));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_AP, &wifi_cfg));
    ESP_ERROR_CHECK(esp_wifi_start());

    ESP_LOGI(TAG, "SoftAP started — SSID: %s, Channel: %d, IP: 192.168.4.1",
             wifi_cfg.ap.ssid, wifi_cfg.ap.channel);
}

static void wifi_init_sta(void)
{
    esp_netif_create_default_wifi_sta();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    ESP_ERROR_CHECK(esp_event_handler_instance_register(
        WIFI_EVENT, ESP_EVENT_ANY_ID, &wifi_event_handler, NULL, NULL));
    ESP_ERROR_CHECK(esp_event_handler_instance_register(
        IP_EVENT, IP_EVENT_STA_GOT_IP, &wifi_event_handler, NULL, NULL));

    wifi_config_t wifi_cfg = {
        .sta = {
#ifdef CONFIG_VITALSCAN_STA_SSID
            .ssid     = CONFIG_VITALSCAN_STA_SSID,
#else
            .ssid     = "YourWiFiNetwork",
#endif
#ifdef CONFIG_VITALSCAN_STA_PASS
            .password = CONFIG_VITALSCAN_STA_PASS,
#else
            .password = "YourWiFiPassword",
#endif
        },
    };

    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_cfg));
    ESP_ERROR_CHECK(esp_wifi_start());

    ESP_LOGI(TAG, "Station mode — connecting to SSID: %s ...", wifi_cfg.sta.ssid);

    /* Wait for connection (up to 15 seconds). */
    EventBits_t bits = xEventGroupWaitBits(s_wifi_event_group,
        WIFI_CONNECTED_BIT, pdFALSE, pdFALSE, pdMS_TO_TICKS(15000));

    if (bits & WIFI_CONNECTED_BIT) {
        ESP_LOGI(TAG, "Connected to WiFi");
    } else {
        ESP_LOGW(TAG, "WiFi connection timeout — continuing anyway");
    }
}

/* ------------------------------------------------------------------ */
/*  CSI streaming task                                                */
/* ------------------------------------------------------------------ */

static void csi_stream_task(void *arg)
{
    csi_sample_t sample;

#ifdef CONFIG_VITALSCAN_CSI_SEND_RATE_MS
    const uint32_t rate_ms = CONFIG_VITALSCAN_CSI_SEND_RATE_MS;
#else
    const uint32_t rate_ms = 50;
#endif

    ESP_LOGI(TAG, "CSI streaming task started (rate=%" PRIu32 " ms)", rate_ms);

    for (;;) {
        if (csi_handler_get_sample(&sample, rate_ms)) {
            ws_server_broadcast_csi(&sample);
        }
        /* Yield to other tasks. */
        vTaskDelay(pdMS_TO_TICKS(1));
    }
}

/* ------------------------------------------------------------------ */
/*  app_main — entry point                                            */
/* ------------------------------------------------------------------ */

void app_main(void)
{
    ESP_LOGI(TAG, "╔══════════════════════════════════════╗");
    ESP_LOGI(TAG, "║  VitalScan ESP32 CSI Firmware v1.0   ║");
    ESP_LOGI(TAG, "╚══════════════════════════════════════╝");

    /* Initialise NVS (required by WiFi driver). */
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES ||
        ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    /* Initialise networking stack. */
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());

    s_wifi_event_group = xEventGroupCreate();

    /* Start WiFi. */
#ifdef CONFIG_VITALSCAN_WIFI_MODE_SOFTAP
    wifi_init_softap();
    ESP_LOGI(TAG, "Connect your device to WiFi: VitalScan-ESP32");
    ESP_LOGI(TAG, "Then open the web app and connect to ws://192.168.4.1:81");
#else
    wifi_init_sta();
    ESP_LOGI(TAG, "Open the web app and connect via the ESP32's IP on port 81");
#endif

    /* Start WebSocket server. */
    if (!ws_server_start()) {
        ESP_LOGE(TAG, "Failed to start WebSocket server — halting");
        return;
    }

    /* Enable CSI data collection. */
    csi_handler_init();

    /* Start the CSI streaming task on core 1 (if dual-core). */
    xTaskCreatePinnedToCore(
        csi_stream_task,     /* Task function         */
        "csi_stream",        /* Task name             */
        4096,                /* Stack size (bytes)    */
        NULL,                /* Parameter             */
        5,                   /* Priority              */
        NULL,                /* Task handle (unused)  */
        1                    /* Core ID (1 = APP CPU) */
    );

    ESP_LOGI(TAG, "System ready — streaming CSI data");
}
