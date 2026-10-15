# Kolls Autotronics - AI Vehicle Health Monitoring System
## ESP32 Telematics & Edge CAN Gateway Firmware (v1.0)

Production-grade Arduino firmware for the **Kolls Autotronics Vehicle Health Monitor** IoT edge node. The node interfaces directly with standard commercial vehicle OBD-II / J1939 CAN networks, captures live powertrain parameters, visualizes diagnostics on an onboard 1.8" color TFT display, and broadcasts structured telemetry payloads over WiFi via MQTT.

---

## 1. System Features

- **Hardware CAN Controller (TWAI):** Utilizes the ESP32 built-in Two-Wire Automotive Interface (TWAI) at 500 kbps (ISO 11898-2) paired with a 3.3V SN65HVD230 transceiver.
- **OBD-II Parameter Decoding:** Native decoding for Standard OBD-II Mode 01 PIDs:
  - `0x0C` Engine RPM
  - `0x05` Coolant Temperature
  - `0x04` Calculated Engine Load
  - `0x0F` Intake Air Temperature (IAT)
  - `0x42` Control Module / System Voltage
  - `0x06` Short-Term Fuel Trim (STFT)
  - `0x07` Long-Term Fuel Trim (LTFT)
- **Automatic Simulation Engine:** Automatically transitions to realistic physics simulation if the vehicle CAN bus is offline, enabling standalone bench testing and client demonstrations.
- **1.8" ST7735 Color TFT Display:** 128x160 portrait dashboard with geometric data cards, color-coded health indicators, and flicker-free partial redrawing.
- **Sliding-Window Anti-Tamper:** Monitors battery voltage dynamics over a 5-sample sliding window. Instantaneous drops from `>12.0V` to `<10.0V` trigger a high-priority `POWER TAMPER` security alert and screen strobe to detect OBD-II dongle removal.
- **MQTT Telematics Reporting:** Publishes structured JSON payloads every 2 seconds to `kolls/vehicle/telemetry` and listens for remote diagnostic commands on `kolls/vehicle/{VEHICLE_ID}/commands`.

---

## 2. Hardware Wiring & Pinout Guide

### A. ESP32 to SN65HVD230 (3.3V CAN Transceiver)

| SN65HVD230 Pin | ESP32 Pin | Description |
| :--- | :--- | :--- |
| **3V3** | 3V3 | Power supply (3.3V regulated) |
| **GND** | GND | Common ground |
| **CTX / D** | **GPIO 5** | TWAI Transmit (TX) |
| **CRX / R** | **GPIO 4** | TWAI Receive (RX) |
| **CANH** | OBD-II Pin 6 | CAN High differential bus line (with 120Ω termination) |
| **CANL** | OBD-II Pin 14 | CAN Low differential bus line (with 120Ω termination) |

> [!IMPORTANT]
> Always verify that your vehicle's CAN bus has proper 120Ω termination resistance between CANH and CANL (measured across CAN lines when the vehicle is powered down should read ~60Ω with two terminating resistors).

---

### B. ESP32 to 1.8" ST7735 SPI Color TFT Display (128x160)

| ST7735 Pin | ESP32 Pin | Default Wiring / Notes |
| :--- | :--- | :--- |
| **VCC** | 3V3 or 5V | Module dependent (usually 3.3V or 5V with LDO) |
| **GND** | GND | Common ground |
| **CS** | **GPIO 15** | SPI Chip Select |
| **RESET / RST** | **GPIO 16** | Hardware Reset *(Note: Reassigned to GPIO 16 to avoid conflict with GPIO 4 CAN RX)* |
| **A0 / DC** | **GPIO 2** | Data / Command select |
| **SDA / MOSI** | **GPIO 23** | Hardware VSPI Master Out Slave In |
| **SCK / SCLK** | **GPIO 18** | Hardware VSPI Serial Clock |
| **LED / BLK** | 3V3 (via 100Ω) | Backlight power (or connect to GPIO for PWM dimming) |

> [!NOTE]
> In some default sample pinouts, `TFT_RST` is suggested on GPIO 4. However, since the ESP32 TWAI driver uses `GPIO 4` for `CAN_RX_PIN`, `TFT_RST` is mapped to **GPIO 16** in this firmware to eliminate hardware pin collision.

---

### C. Standard Vehicle OBD-II Port (J1962 16-Pin)

| OBD-II Pin | Function | Wiring Connection |
| :--- | :--- | :--- |
| **Pin 4** | Chassis Ground | Connect to ESP32 GND & Transceiver GND |
| **Pin 5** | Signal Ground | Connect to ESP32 GND & Transceiver GND |
| **Pin 6** | CAN High (ISO 15765-4) | Connect to SN65HVD230 CANH |
| **Pin 14** | CAN Low (ISO 15765-4) | Connect to SN65HVD230 CANL |
| **Pin 16** | Battery Power (+12V Unswitched) | Step down to 5V / 3.3V via automotive DC-DC buck converter |

---

## 3. Arduino IDE Setup Instructions

### Step 1: Install ESP32 Board Core
1. Open **Arduino IDE** (v1.8.19 or v2.x).
2. Go to **File -> Preferences**.
3. Under **Additional Boards Manager URLs**, add:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
4. Navigate to **Tools -> Board -> Boards Manager**, search for `esp32`, and install **esp32 by Espressif Systems** (version 2.0.11 or newer).
5. Under **Tools -> Board**, select **ESP32 Dev Module**.

### Step 2: Install Required Libraries
Open **Sketch -> Include Library -> Manage Libraries...** and install:
1. `PubSubClient` by Nick O'Leary (v2.8.0 or newer)
2. `ArduinoJson` by Benoit Blanchon (v6.x or v7.x supported)
3. `Adafruit GFX Library` by Adafruit
4. `Adafruit ST7735 and ST7789 Library` by Adafruit

*(Optional): If you prefer `TFT_eSPI` by Bodmer for hardware DMA acceleration, set `#define USE_ADAFRUIT_ST7735 0` in the sketch and configure `User_Setup.h` within the library folder.*

---

## 4. Configuration Block

At the top of `ESP32_Vehicle_Prototype.ino`, customize the configuration block for your deployment:

```cpp
// ============== CONFIGURATION ==============
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASS     = "YOUR_WIFI_PASSWORD";
const char* MQTT_BROKER   = "broker.hivemq.com";
const int   MQTT_PORT     = 1883;
const char* MQTT_TOPIC    = "kolls/vehicle/telemetry";
const char* VEHICLE_ID    = "KA-TRUCK-001";

// CAN Bus Pins (SN65HVD230 connections)
#define CAN_TX_PIN GPIO_NUM_5
#define CAN_RX_PIN GPIO_NUM_4

// TFT Display Pins (1.8" ST7735 SPI)
#define TFT_CS    15
#define TFT_RST   16    
#define TFT_DC    2
```

---

## 5. MQTT Telemetry Schema

Every 2 seconds, the firmware transmits a JSON payload to `kolls/vehicle/telemetry`:

```json
{
  "vehicle_id": "KA-TRUCK-001",
  "timestamp_ms": 142850,
  "uptime_sec": 142,
  "can_feed": "HARDWARE_CAN",
  "metrics": {
    "rpm": 2450,
    "coolant_c": "88.4",
    "oil_c": "95.2",
    "battery_v": "13.82",
    "load_pct": 45,
    "stft_pct": "+1.2",
    "ltft_pct": "-0.8",
    "iat_c": "29.0"
  },
  "diagnostics": {
    "status": "NOMINAL",
    "severity": 0,
    "tamper_alert": false
  }
}
```

### Remote Inbound Commands
The node subscribes to `kolls/vehicle/KA-TRUCK-001/commands`.
Supported payloads:
- `PING`: Responds with `{"response":"PONG","status":"ONLINE"}`.
- `RESET_TAMPER`: Resets the anti-tamper latch and returns the display to `NOMINAL` mode.

---

## 6. TFT Display Layout (128x160 Portrait)

```
+------------------------------------+ (y: 0)
| KOLLS DYNAMICS                (O)  |  <- Brand & MQTT Status LED
+------------------------------------+ (y: 22)
| [RPM]                    2450 RPM  |  <- Block 1: RPM (Color: Grn/Yel/Red)
+------------------------------------+ (y: 48)
| [COOLANT]                  88.5 C  |  <- Block 2: Coolant Temp
+------------------------------------+ (y: 72)
| [SYS VOLT]                 13.8 V  |  <- Block 3: Battery Voltage
+------------------------------------+ (y: 96)
| [LOAD %]                     45 %  |  <- Block 4: Engine Load
+------------------------------------+ (y: 120)
|              NOMINAL               |  <- Block 5: Status & Health
|          ALL SYSTEMS OK            |     (Green/Yellow/Flashing Red)
+------------------------------------+ (y: 160)
```

---

## 7. Anti-Tamper Security Mechanism

1. **Sliding Window:** Tracks the last 5 voltage readings at 2-second intervals.
2. **Transient Detection:** If voltage was above `12.0V` and abruptly plummets below `10.0V`, the firmware classifies the event as an unauthorized physical disconnection from the vehicle OBD-II power port.
3. **Alert Actions:**
   - Immediately sets `status = "POWER TAMPER"`, `severity = 2` (CRITICAL).
   - Engages high-contrast flashing alarm on the ST7735 screen.
   - Logs security alert over Serial at 115200 baud.
   - Transmits `tamper_alert: true` in the MQTT telemetry packet.
