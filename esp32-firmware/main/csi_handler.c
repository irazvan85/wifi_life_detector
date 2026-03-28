/*
 * VitalScan ESP32 CSI Firmware — CSI Data Handler
 *
 * Extracts per-subcarrier amplitudes from raw WiFi CSI I/Q pairs
 * and queues them for the output task.
 */

#include "csi_handler.h"

#include <math.h>
#include <string.h>

#include "esp_log.h"
#include "esp_wifi.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"

static const char *TAG = "csi_handler";

/* Queue depth — 10 samples buffered before oldest is dropped. */
#define CSI_QUEUE_DEPTH 10

static QueueHandle_t s_csi_queue = NULL;

/* ------------------------------------------------------------------ */
/*  CSI receive callback (runs in WiFi task context — keep it short)  */
/* ------------------------------------------------------------------ */
static void csi_rx_callback(void *ctx, wifi_csi_info_t *info)
{
    if (!info || !info->buf || info->len == 0) {
        return;
    }

    csi_sample_t sample;
    memset(&sample, 0, sizeof(sample));

    sample.timestamp_ms = (uint32_t)(esp_timer_get_time() / 1000ULL);
    sample.rssi         = info->rx_ctrl.rssi;
    sample.channel      = info->rx_ctrl.channel;

    /*
     * Raw CSI buffer layout: pairs of [imaginary, real] (int8_t each).
     * Number of I/Q pairs = info->len / 2.
     * For HT20 this is typically 64 (including null/pilot subcarriers)
     * but the actual number varies by PHY mode.
     */
    int num_pairs = info->len / 2;
    if (num_pairs > CSI_MAX_SUBCARRIERS) {
        num_pairs = CSI_MAX_SUBCARRIERS;
    }
    sample.subcarrier_count = num_pairs;

    const int8_t *buf = info->buf;
    for (int i = 0; i < num_pairs; i++) {
        float imag = (float)buf[i * 2];
        float real = (float)buf[i * 2 + 1];
        sample.amplitudes[i] = sqrtf(real * real + imag * imag);
    }

    /* Non-blocking enqueue — drop oldest if full. */
    if (xQueueIsQueueFullFromISR(s_csi_queue)) {
        csi_sample_t discard;
        xQueueReceive(s_csi_queue, &discard, 0);
    }
    xQueueSend(s_csi_queue, &sample, 0);
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

void csi_handler_init(void)
{
    s_csi_queue = xQueueCreate(CSI_QUEUE_DEPTH, sizeof(csi_sample_t));
    if (!s_csi_queue) {
        ESP_LOGE(TAG, "Failed to create CSI queue");
        return;
    }

    /* Configure which CSI components to collect. */
    wifi_csi_config_t csi_cfg = {
        .lltf_en           = true,   /* Legacy Long Training Field     */
        .htltf_en          = true,   /* HT Long Training Field         */
        .stbc_htltf2_en    = true,   /* STBC HT-LTF2                  */
        .ltf_merge_en      = true,   /* Merge multiple LTF             */
        .channel_filter_en = true,   /* Apply channel filter           */
        .manu_scale        = false,  /* No manual scaling              */
        .shift             = false,  /* No bit shift                   */
    };

    ESP_ERROR_CHECK(esp_wifi_set_csi_config(&csi_cfg));
    ESP_ERROR_CHECK(esp_wifi_set_csi_rx_cb(csi_rx_callback, NULL));
    ESP_ERROR_CHECK(esp_wifi_set_csi(true));

    ESP_LOGI(TAG, "CSI collection enabled");
}

bool csi_handler_get_sample(csi_sample_t *out, uint32_t timeout_ms)
{
    if (!s_csi_queue || !out) {
        return false;
    }
    return xQueueReceive(s_csi_queue, out,
                         pdMS_TO_TICKS(timeout_ms)) == pdTRUE;
}
