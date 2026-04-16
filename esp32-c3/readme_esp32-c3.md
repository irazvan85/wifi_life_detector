# ESP32-C3 SuperMini — Development Board

## Overview

The ESP32-C3 SuperMini is a compact development board based on the ESP32-C3FN4/FH4 chip with 4 MB integrated flash. It features dual-mode WiFi and Bluetooth with a built-in antenna, and includes a 0.42" OLED display. Programming and power are provided via USB.

Suitable for small IoT projects, wearables, and smart home applications.

## Specifications

| Feature        | Details                              |
|----------------|--------------------------------------|
| MCU            | ESP32-C3FN4 / ESP32-C3FH4            |
| Flash          | 4 MB (integrated)                    |
| Wireless       | WiFi 802.11 b/g/n + Bluetooth 5 (LE) |
| Display        | 0.42" OLED (I2C)                     |
| USB            | USB-C (power + programming)          |
| I2C            | 1×                                   |
| SPI            | 1×                                   |
| UART           | 2×                                   |
| GPIO (PWM)     | 11×                                  |
| ADC            | 4×                                   |

> **Serial monitor:** USB COM5, 115200 baud

---

## Pin Layout

### Left Side (top → bottom)

| Pin Label | GPIO    | Notes                  |
|-----------|---------|------------------------|
| 5V        | —       | Power input (USB 5V)   |
| GND       | —       | Ground                 |
| 3V3       | —       | 3.3 V regulated output |
| RX        | GPIO20  | UART0 RX               |
| TX        | GPIO21  | UART0 TX               |
| A2        | GPIO2   | ADC1 channel 2         |
| A1        | GPIO1   | ADC1 channel 1         |
| A0        | GPIO0   | ADC1 channel 0         |

### Right Side (top → bottom)

| Pin Label | GPIO   | Alternate Function           |
|-----------|--------|------------------------------|
| —         | GPIO10 | —                            |
| SCL       | GPIO9  | BOOT button (NOT OLED SCL)   |
| SDA       | GPIO8  | Onboard LED (NOT OLED SDA)   |
| SS        | GPIO7  | SPI Chip Select              |
| MOSI      | GPIO6  | **OLED SCL** / SPI MOSI      |
| A5 / MISO | GPIO5  | **OLED SDA** / SPI MISO      |
| A4        | GPIO4  | ADC channel 4          |
| A3        | GPIO3  | ADC channel 3          |

### Onboard Components

| Component    | Details                                      |
|--------------|----------------------------------------------|
| OLED display | 0.42 inch, I2C (**SDA → GPIO5, SCL → GPIO6**, addr 0x3C) — confirmed by ABRobot schematic |
| BOOT button  | Connected to GPIO9 / GND — enter flash mode  |
| RST button   | Hardware reset                               |
| Blue LED     | Power indicator                              |
| Red LED      | Status / user LED                            |

### Key Interfaces Summary

| Interface | Pins                              |
|-----------|-----------------------------------|
| I2C (OLED)| **SDA = GPIO5, SCL = GPIO6** (pulled HIGH on board) |
| SPI       | MOSI = GPIO6, MISO = GPIO5, SS = GPIO7 |
| UART0     | TX = GPIO21, RX = GPIO20          |
| ADC       | GPIO0–GPIO5 (A0–A5)               |
| PWM       | All GPIO pins support PWM         |