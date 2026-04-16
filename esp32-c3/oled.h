#pragma once

#include <driver/gpio.h>
#include <U8g2lib.h>
#include "config.h"

// ---------------------------------------------------------------------------
// oled.h — 0.42" SSD1306 72×40 display helpers
//
// Board wiring (confirmed by ABRobot schematic + emalliab.wordpress.com):
//   SDA → GPIO5   (pulled HIGH via onboard resistor)
//   SCL → GPIO6   (pulled HIGH via onboard resistor)
//   I2C address : 0x3C
//   GPIO8 = onboard LED only (NOT I2C)
//   GPIO9 = BOOT button only (NOT I2C)
//
// Uses SOFTWARE I2C (bitbang). HW_I2C also works on GPIO5/6 but SW_I2C
// avoids IDF5 Wire driver quirks during boot.
//
// Display geometry:
//   The SSD1306 controller has a 132×64 GDDRAM buffer. The physical 72×40
//   panel is centred within it. U8g2 128×64 NONAME mode maps GDDRAM columns
//   0-127, so the visible area is at:
//     xOffset = (132 - 72) / 2 = 30
//     yOffset = (64  - 40) / 2 = 12
//   All drawStr/drawBox calls must add these offsets.
//
// Display layout (font u8g2_font_5x8_tr, y = baseline):
//   Row 1 (yOffset+10 = 22): IP address or "AP mode"
//   Row 2 (yOffset+22 = 34): "WS:<clients>  <rssi>dBm"
//   Row 3 (yOffset+34 = 46): "Smp:<count>"
// ---------------------------------------------------------------------------

// Physical display geometry — see comment block above.
static const int _OLED_W  = 72;   // physical pixel width
static const int _OLED_H  = 40;   // physical pixel height
static const int _OLED_X0 = 30;   // (132 - 72) / 2 — left edge in GDDRAM
static const int _OLED_Y0 = 12;   // (64  - 40) / 2 — top  edge in GDDRAM

// Single U8G2 instance: 128×64 NONAME maps the full SSD1306 GDDRAM.
// GPIO5=SDA, GPIO6=SCL confirmed by ABRobot schematic.
// Constructor args: rotation, clock_pin(SCL), data_pin(SDA), reset_pin
static U8G2_SSD1306_128X64_NONAME_F_SW_I2C _u8g2_full(U8G2_R0, 6, 5, U8X8_PIN_NONE);

static bool  _oledOK = false;
static U8G2* _u8g2   = nullptr;

// ---------------------------------------------------------------------------
// Bit-bang I2C probe — uses IDF GPIO_MODE_INPUT_OUTPUT_OD (true open-drain).
// Arduino INPUT_PULLUP/OUTPUT toggling is NOT reliable on ESP32-C3 because:
//   - GPIO9 is shared with the BOOT button and has strapping-pin behavior.
//   - Switching between INPUT_PULLUP and OUTPUT leaves a floating window that
//     corrupts the ACK sample.
// IDF open-drain mode: gpio_set_level(pin,1) = release (pulled high),
//                      gpio_set_level(pin,0) = drive low.
// Returns true if a device ACKs at addr7 (7-bit address).
// ---------------------------------------------------------------------------
static void _bbCfgOD(gpio_num_t pin) {
    gpio_config_t c = {};
    c.pin_bit_mask  = 1ULL << pin;
    c.mode          = GPIO_MODE_INPUT_OUTPUT_OD;
    c.pull_up_en    = GPIO_PULLUP_ENABLE;
    c.pull_down_en  = GPIO_PULLDOWN_DISABLE;
    c.intr_type     = GPIO_INTR_DISABLE;
    gpio_config(&c);
    gpio_set_level(pin, 1);  // idle HIGH
}

static bool bbI2CProbe(uint8_t sdaPin, uint8_t sclPin, uint8_t addr7) {
    gpio_num_t sda = (gpio_num_t)sdaPin;
    gpio_num_t scl = (gpio_num_t)sclPin;

    _bbCfgOD(sda);
    _bbCfgOD(scl);
    delayMicroseconds(500);  // let pull-ups fully charge (45kΩ × 100pF ≈ 5µs × 10 safety)

    // START: SDA HIGH→LOW while SCL HIGH
    gpio_set_level(sda, 0); delayMicroseconds(100);
    gpio_set_level(scl, 0); delayMicroseconds(100);

    // Clock out 8 bits: 7-bit address + write bit (0)
    uint8_t b = (addr7 << 1) | 0;
    for (int i = 7; i >= 0; i--) {
        gpio_set_level(sda, (b >> i) & 1);
        delayMicroseconds(50);
        gpio_set_level(scl, 1); delayMicroseconds(100);
        gpio_set_level(scl, 0); delayMicroseconds(50);
    }

    // ACK: release SDA, let pull-up charge, clock SCL, sample SDA
    gpio_set_level(sda, 1); delayMicroseconds(100);  // wait for line to float high
    gpio_set_level(scl, 1); delayMicroseconds(100);
    bool ack = (gpio_get_level(sda) == 0);  // device pulls low = ACK
    gpio_set_level(scl, 0); delayMicroseconds(50);

    // STOP: SDA LOW→HIGH while SCL HIGH
    gpio_set_level(sda, 0); delayMicroseconds(50);
    gpio_set_level(scl, 1); delayMicroseconds(100);
    gpio_set_level(sda, 1); delayMicroseconds(100);

    return ack;
}

// Full I2C bus scan on given pin pair: logs every address that ACKs (0x08–0x77).
// Returns first hit address (0 = nothing found).
static uint8_t bbI2CScan(uint8_t sdaPin, uint8_t sclPin) {
    uint8_t found = 0;
    for (uint8_t a = 0x08; a < 0x78; a++) {
        if (bbI2CProbe(sdaPin, sclPin, a)) {
            Serial.printf("[OLED] I2C scan GPIO%d/GPIO%d: device at 0x%02X\n", sdaPin, sclPin, a);
            if (found == 0) found = a;
        }
        delayMicroseconds(200);
    }
    if (found == 0)
        Serial.printf("[OLED] I2C scan GPIO%d/GPIO%d: no devices (0x08-0x77)\n", sdaPin, sclPin);
    return found;
}

// Scan multiple candidate pin pairs and return the first that has a device.
// Writes the winning SDA/SCL pins to *outSda / *outScl.
static uint8_t bbFindOLED(uint8_t* outSda, uint8_t* outScl) {
    // Ordered by likelihood:
    //   {5,6} = confirmed by ABRobot schematic (SDA=5, SCL=6, pulled HIGH)
    //   {6,5} = same pair swapped, in case silkscreen is reversed
    //   {8,9} / {9,8} = what the pinout diagram incorrectly shows
    const uint8_t pairs[][2] = {
        {5, 6},   // GPIO5=SDA, GPIO6=SCL — ABRobot schematic, confirmed correct
        {6, 5},   // swapped
        {8, 9},   // GPIO8=SDA, GPIO9=SCL — pinout diagram (actually LED+BOOT)
        {9, 8},   // swapped
    };
    for (auto& p : pairs) {
        Serial.printf("[OLED] Probing SDA=GPIO%d SCL=GPIO%d ...\n", p[0], p[1]);
        uint8_t addr = bbI2CScan(p[0], p[1]);
        if (addr != 0) {
            *outSda = p[0];
            *outScl = p[1];
            return addr;
        }
    }
    *outSda = 5; *outScl = 6;  // default to confirmed-correct pair on failure
    return 0;
}

class OledDisplay {
public:
    void init() {
        delay(200);   // Allow OLED PSU to stabilise after power-on
        Serial.println("[OLED] Initializing (SW I2C, SDA=GPIO5 SCL=GPIO6)...");

        // ------ Step 0: Multi-pair I2C scan — find pins AND address ---------
        // Full scan on GPIO8/GPIO9 showed no devices. Try all common pin pairs
        // used across ESP32-C3 SuperMini board revisions.
        Serial.println("[OLED] Scanning all candidate pin pairs for I2C device...");
        uint8_t sdaPin = 8, sclPin = 9;
        uint8_t foundAddr = bbFindOLED(&sdaPin, &sclPin);
        if (foundAddr != 0)
            Serial.printf("[OLED] Found at SDA=GPIO%d SCL=GPIO%d addr=0x%02X\n",
                          sdaPin, sclPin, foundAddr);

        if (foundAddr == 0) {
            Serial.println("[OLED] No I2C device found on any pin pair — OLED disabled");
            Serial.println("[OLED] Check: 3.3V power to display, pull-up resistors on SDA/SCL");
            return;
        }

        // Configure the U8g2 instance with the discovered address and pins.
        // setI2CAddress() takes the 8-bit shifted address (addr7 << 1).
        if (foundAddr != 0x3C)
            _u8g2_full.setI2CAddress(foundAddr << 1);

        // Reconfigure pin assignments if the display is not on GPIO8/GPIO9.
        if (sdaPin != 5 || sclPin != 6) {
            u8x8_SetPin(_u8g2_full.getU8x8(), U8X8_PIN_I2C_CLOCK, sclPin);
            u8x8_SetPin(_u8g2_full.getU8x8(), U8X8_PIN_I2C_DATA,  sdaPin);
            Serial.printf("[OLED] U8g2 reconfigured: SDA=GPIO%d SCL=GPIO%d\n", sdaPin, sclPin);
        }

        // Init U8g2: 128×64 NONAME maps the full SSD1306 GDDRAM.
        // The physical 72×40 panel is centred at xOffset=30, yOffset=12.
        Serial.printf("[OLED] begin() SSD1306 128x64 @ 0x%02X ...\n", foundAddr);
        if (!_u8g2_full.begin()) {
            Serial.println("[OLED] begin() failed — OLED disabled");
            return;
        }

        _u8g2_full.setContrast(255);     // maximum brightness
        _u8g2_full.setBusClock(400000);  // 400 kHz fast mode
        _u8g2_full.setFont(u8g2_font_5x8_tr);

        // Diagnostic: draw a frame around the visible 72×40 area
        _u8g2_full.clearBuffer();
        _u8g2_full.drawFrame(_OLED_X0, _OLED_Y0, _OLED_W, _OLED_H);
        _u8g2_full.sendBuffer();
        Serial.println("[OLED] Diagnostic frame sent");
        delay(1000);

        _oledOK = true;
        _u8g2   = &_u8g2_full;
        Serial.println("[OLED] Ready — showing splash");
        _splash();
    }

    // Call this every OLED_UPDATE_INTERVAL_MS.
    // ip        : IP address string (e.g. "192.168.1.42") or nullptr for AP mode
    // wsClients : number of currently connected WebSocket clients
    // rssi      : RSSI in dBm (pass 0 in AP mode)
    // samples   : rolling sample counter (wraps at 9999)
    // apMode    : true when running as Access Point
    void update(const char* ip, uint8_t wsClients, int8_t rssi,
                uint32_t samples, bool apMode) {
        if (!_oledOK || !_u8g2) return;

        char line1[20];
        char line2[20];
        char line3[20];

        if (apMode || ip == nullptr) {
            snprintf(line1, sizeof(line1), "AP mode");
        } else {
            snprintf(line1, sizeof(line1), "%s", ip);
        }

        if (apMode) {
            snprintf(line2, sizeof(line2), "WS:%-2u", wsClients);
        } else {
            snprintf(line2, sizeof(line2), "WS:%-2u %ddBm", wsClients, rssi);
        }

        snprintf(line3, sizeof(line3), "Smp:%lu", (unsigned long)(samples % 10000));

        _u8g2->clearBuffer();
        _u8g2->setFont(u8g2_font_5x8_tr);
        // All coordinates offset into the physical 72×40 visible area.
        _u8g2->drawStr(_OLED_X0,     _OLED_Y0 + 10, line1);
        _u8g2->drawStr(_OLED_X0,     _OLED_Y0 + 22, line2);
        _u8g2->drawStr(_OLED_X0,     _OLED_Y0 + 34, line3);
        _u8g2->sendBuffer();
    }

private:
    void _splash() {
        _u8g2->clearBuffer();
        _u8g2->setFont(u8g2_font_5x8_tr);
        _u8g2->drawStr(_OLED_X0, _OLED_Y0 + 10, "VitalScan");
        _u8g2->drawStr(_OLED_X0, _OLED_Y0 + 22, "Connecting");
        _u8g2->drawStr(_OLED_X0, _OLED_Y0 + 34, "...");
        _u8g2->sendBuffer();
        Serial.println("[OLED] Splash sent");
    }
};
