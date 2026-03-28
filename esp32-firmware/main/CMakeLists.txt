idf_component_register(
    SRCS "main.c" "csi_handler.c" "ws_server.c"
    INCLUDE_DIRS "."
    REQUIRES nvs_flash esp_wifi esp_http_server esp_event esp_netif driver
)
