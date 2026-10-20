/*
 * ==============================================================================================
 *                       KOLLS AUTOTRONICS - VEHICLE HEALTH MONITOR
 *                       FIRMWARE VERSION 2.0  (BATTERY EDITION)
 * ==============================================================================================
 *  Target Board:     ESP32 Dev Module / NodeMCU-32S / ESP32-WROOM-32
 *  Power Source:     EXTERNAL BATTERY ONLY (18650 pack via DC-DC converter, 5.0V -> ESP32 VIN)
 *                    The vehicle OBD-II port is used for DATA ONLY - no power is drawn
 *                    from OBD pin 16. Purple wire / AMS1117 remain unused by this build.
 *
 *  Host Adapter:     MS309-3 V:1.5 scanner mainboard (donor board):
 *                      - 8-pin CAN transceiver ABOVE the rainbow socket:
 *                          pin 1 (TXD)  -> ESP32 GPIO 5   (TXD trace to on-board MCU CUT!)
 *                          pin 2 (GND)  -> ESP32 GND / vehicle ground
 *                          pin 3 (VCC)  -> ESP32 3V3      (trace to on-board AMS1117 CUT!)
 *                          pin 4 (RXD)  -> ESP32 GPIO 4
 *                          pin 8 (RS)   -> GND            (high-speed mode, never standby)
 *                      - Harness wires (with rainbow plug installed):
 *                          Pin 1  Black   -> GND  (OBD pin 4/5)
 *                          Pin 4  Orange  -> CANH (OBD pin 6)
 *                          Pin 5  Yellow  -> CANL (OBD pin 14)
 *                          Pin 7  Blue    -> GND  (OBD pin 4/5)
 *                          Pin 8  Purple  -> +12V (OBD pin 16)  ... LEFT UNCONNECTED (data-only)
 *                      - COMMON GROUND IS MANDATORY: wire ESP32 GND to OBD pin 4/5 (black),
 *                        otherwise CAN reception will fail.
 *
 *  Features:         - Hardware CAN / TWAI Bus Controller (ISO 11898-2, 500 kbps OBD-II)
 *                    - Active Mode-01 PID polling (rpm, coolant, load, IAT, voltage, fuel trims)
 *                    - MQTT telemetry to public HiveMQ broker (consumed by the web dashboard)
 *                    - Battery-power OBD-UNPLUG / disconnect detection (CAN-silence latch)
 *                    - Device battery fuel gauge (ADC divider) with low-battery escalation
 *                    - Automatic Fallback CAN Simulation Engine for bench testing
 *                    - Optional 1.8" ST7735 TFT live gauge display (compile-time toggle)
 *
 *  REQUIRED LIBRARIES (Arduino Library Manager):
 *    1. "PubSubClient"   by Nick O'Leary    (v2.8.0+)
 *    2. "ArduinoJson"    by Benoit Blanchon (v6.x or v7.x)
 *    3. "Adafruit GFX"   + "Adafruit ST7735 and ST7789" (if USE_TFT = 1)
 * ==============================================================================================
 */

// ==============================================================================================
//                                   SYSTEM INCLUDES
// ==============================================================================================
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "driver/twai.h"

#define USE_TFT 1                 // Set 0 for a bare telemetry node (no display attached)
#define DEVICE_BATT_MONITOR 1     // Set 0 if no ADC divider is wired yet

#if USE_TFT
  #include <SPI.h>
  #include <Adafruit_GFX.h>
  #include <Adafruit_ST7735.h>
#endif

// ==============================================================================================
//                                   CONFIGURATION
// ==============================================================================================
// Network & telematics endpoint (the "backend endpoint" consumed by the web dashboard app).
const char* WIFI_SSID     = "ORION";
const char* WIFI_PASS     = "12345678";
const char* MQTT_BROKER   = "broker.hivemq.com";
const int   MQTT_PORT     = 1883;
const char* MQTT_TOPIC    = "kolls/vehicle/telemetry";
const char* MQTT_CMD_FMT  = "kolls/vehicle/%s/commands";   // printf-style with VEHICLE_ID
const char* MQTT_APP_FMT  = "kolls/vehicle/%s/app";        // app-shaped payload (mirrors the web app data model)
const char* VEHICLE_ID    = "KA-TRUCK-001";
const char* VEHICLE_NAME  = "Kolls Autotronics Test Vehicle";  // shown by the web app
const uint16_t TANK_RANGE_KM_FULL = 600;   // estimated km on a full tank (used for the "range" figure)

// ----------------------------------------------------------------------------------------------
// CAN bus pins (ESP32 -> MS309 donor-board transceiver)
// ----------------------------------------------------------------------------------------------
#define CAN_TX_PIN GPIO_NUM_5   // -> transceiver TXD (pin 1)
#define CAN_RX_PIN GPIO_NUM_4   // <- transceiver RXD (pin 4)

// ----------------------------------------------------------------------------------------------
// Device battery fuel gauge (ADC divider on GPIO34; input-only pin, ADC1)
// With 2x 100k divider: measured mV at pin is HALF battery voltage -> ratio 2.0
// ----------------------------------------------------------------------------------------------
#if DEVICE_BATT_MONITOR
  #define DEVICE_BATT_ADC_PIN   GPIO_NUM_34
  #define DEVICE_BATT_RATIO     2.0f           // (Rtop + Rbottom) / Rbottom
  #define DEVICE_BATT_WARN_V    3.40f          // 18650 low  (~20%)
  #define DEVICE_BATT_CRIT_V    3.10f          // 18650 critical - charge immediately
  #define DEVICE_BATT_MIN_V     3.20f          // 0%
  #define DEVICE_BATT_MAX_V     4.20f          // 100%
#endif

// ----------------------------------------------------------------------------------------------
// TFT display pins (1.8" ST7735 SPI) - identical to firmware v1.0
// ----------------------------------------------------------------------------------------------
#define TFT_CS    15
#define TFT_RST   16
#define TFT_DC    2

// ----------------------------------------------------------------------------------------------
// Timing & system constants
// ----------------------------------------------------------------------------------------------
const unsigned long TELEMETRY_INTERVAL_MS   = 2000;  // publish cadence
const unsigned long CAN_TIMEOUT_MS          = 3500;  // fall back to simulation after this
const unsigned long OBD_DETACH_TIMEOUT_MS   = 6000;  // OBD silence latch (unplug detection)
const unsigned long OBD_REQUEST_INTERVAL_MS = 100;   // one PID request per 100ms
const unsigned long WIFI_RETRY_INTERVAL     = 10000;
const uint8_t       WIFI_MAX_BOOT_RETRIES   = 20;
const uint8_t       MQTT_MAX_BOOT_RETRIES   = 3;

// Vehicle thresholds (these watch the CAR's system voltage from PID 0x42,
// not our device battery - that is tracked separately above)
#define WARNING_VOLT_THRES  11.8f

// 16-bit color palette (RGB565) - matches v1.0 dashboard theme
#define COLOR_BLACK       0x0000
#define COLOR_WHITE       0xFFFF
#define COLOR_CYAN        0x07FF
#define COLOR_KOLLS_BLUE  0x03FF
#define COLOR_GREEN       0x07E0
#define COLOR_YELLOW      0xFFE0
#define COLOR_RED         0xF800
#define COLOR_GRAY        0x7BEF
#define COLOR_DARK_GRAY   0x2104

// ==============================================================================================
//                                   DATA STRUCTURES
// ==============================================================================================
struct TelemetryData {
  uint16_t rpm;
  float    coolant_temp;
  float    oil_temp;
  float    battery_voltage;    // VEHICLE system voltage (PID 0x42)
  uint8_t  engine_load;
  float    stft;
  float    ltft;
  float    intake_air_temp;
  String   status;
  uint8_t  severity;           // 0 NOMINAL, 1 WARNING, 2 CRITICAL
  bool     tamper_detected;    // latched OBD-unplug (anti-tamper) alert
  bool     using_sim_data;     // true when CAN is offline -> simulator feeds the values
  // ---- v2.1 : fields the web app renders but that v2.0 did not supply ----
  int16_t  fuel_level_pct;     // PID 0x2F, -1 = ECU does not report it
  uint32_t odometer_km;        // PID 0x31
  bool     odometer_valid;     // true once PID 0x31 has been decoded
  uint8_t  health_score;       // composite 0-100 (drives the app's health ring)
  uint8_t  sys_engine;         // derived subsystem scores 0-100
  uint8_t  sys_cooling;
  uint8_t  sys_electrical;
  uint8_t  sys_brakes;
};

struct DeviceState {
  float    device_v;           // our 18650 pack voltage (ADC divider)
  uint8_t  device_pct;         // estimated state of charge 0-100%
  bool     device_low;         // below warn threshold
  bool     device_critical;    // below critical threshold
  bool     obd_detached;       // latched: was receiving OBD data, then went silent
  uint16_t disconnect_count;   // total OBD dropout events since boot
  bool     everSawOBD;         // have we EVER decoded a Mode-01 response?
};

// ==============================================================================================
//                                   GLOBAL STATE
// ==============================================================================================
WiFiClient espClient;
PubSubClient mqttClient(espClient);

#if USE_TFT
  Adafruit_ST7735 tft = Adafruit_ST7735(TFT_CS, TFT_DC, TFT_RST);
#endif

TelemetryData telemetry;
DeviceState   device;

// Timing
unsigned long lastPublishTime    = 0;
unsigned long lastCANMsgTime     = 0;   // last ANY CAN frame (bus traffic)
unsigned long lastOBDDataTime    = 0;   // last decoded OBD Mode-01 response
unsigned long lastWifiCheck      = 0;
unsigned long lastFlashToggle    = 0;
unsigned long lastOBDRequestTime = 0;
bool          flashState         = false;

// Connection / driver flags
bool wifiConnected      = false;
bool mqttConnected      = false;
bool canDriverInstalled = false;

// OBD-II PID rotation
const uint8_t OBD_REQUEST_PIDS[] = {
  0x0C,  // Engine RPM
  0x05,  // Coolant temperature
  0x04,  // Calculated engine load
  0x0F,  // Intake air temperature
  0x42,  // Control module / system voltage
  0x06,  // Short-term fuel trim (Bank 1)
  0x07,  // Long-term fuel trim (Bank 1)
  0x2F,  // Fuel tank level (%)          -> app "fuel"
  0x31   // Odometer (km)                -> app service intervals
};
const uint8_t OBD_PID_COUNT = sizeof(OBD_REQUEST_PIDS) / sizeof(OBD_REQUEST_PIDS[0]);
uint8_t currentPIDIndex = 0;

// Display redraw cache (flicker suppression)
uint16_t lastDrawnRpm       = 9999;
int16_t  lastDrawnCoolant   = -999;
int16_t  lastDrawnVoltage   = -999;
int16_t  lastDrawnDevice    = -999;
uint8_t  lastDrawnLoad      = 255;
uint8_t  lastDrawnSeverity  = 255;
String   lastDrawnStatus    = "";
bool     lastDrawnMqttState = false;

char mqttCmdTopic[64];
char mqttAppTopic[64];

// ==============================================================================================
//                                   FORWARD DECLARATIONS
// ==============================================================================================
void initCANBus();
void sendOBDRequest(uint8_t pid);
void cycleOBDRequests();
void readCANBus();
void simulateCANData();
void updateDeviceBattery();
void checkObdDetach(unsigned long now);
void evaluateSystemHealth();
void computeHealthModel();
void connectWiFi();
bool connectMQTT();
void mqttCallback(char* topic, byte* payload, unsigned int length);
void publishTelemetry();
void publishAppPayload();
void printTelemetrySerial();
#if USE_TFT
  void displayBootScreen();
  void uiInit();
  void renderPage(uint8_t page, Adafruit_GFX& g);
  void uiTick(unsigned long now);
  void drawFooter(bool force = false);
#endif

// ==============================================================================================
//                                       SETUP
// ==============================================================================================
void setup() {
  Serial.begin(115200);
  delay(200);

  Serial.println(F("\n================================================================================"));
  Serial.println(F("        KOLLS AUTOTRONICS - VEHICLE HEALTH MONITOR v2.0 BATTERY"));
  Serial.println(F("        Battery-powered MS309-3 donor-board CAN gateway"));
  Serial.println(F("================================================================================"));
  Serial.printf("[INIT] Vehicle ID: %s | Free heap: %u bytes\n", VEHICLE_ID, ESP.getFreeHeap());

#if USE_TFT
  tft.initR(INITR_BLACKTAB);
  tft.setRotation(0);
  displayBootScreen();
#endif

#if DEVICE_BATT_MONITOR
  analogSetPinAttenuation(DEVICE_BATT_ADC_PIN, ADC_11db);
#endif

  connectWiFi();

  snprintf(mqttCmdTopic, sizeof(mqttCmdTopic), MQTT_CMD_FMT, VEHICLE_ID);
  snprintf(mqttAppTopic, sizeof(mqttAppTopic), MQTT_APP_FMT, VEHICLE_ID);
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(640);

  initCANBus();

  randomSeed(esp_random());

  // Seed telemetry with plausible defaults (replaced by real data once the ECU answers)
  telemetry.rpm             = 0;
  telemetry.coolant_temp    = 85.0f;
  telemetry.oil_temp        = 90.0f;
  telemetry.battery_voltage = 13.8f;
  telemetry.engine_load     = 25;
  telemetry.stft            = 0.0f;
  telemetry.ltft            = 0.0f;
  telemetry.intake_air_temp = 28.0f;
  telemetry.status          = "INITIALIZING";
  telemetry.severity        = 0;
  telemetry.tamper_detected = false;
  telemetry.using_sim_data  = false;
  telemetry.fuel_level_pct  = -1;      // -1 = ECU does not report fuel level
  telemetry.odometer_km     = 0;
  telemetry.odometer_valid  = false;
  telemetry.health_score    = 87;
  telemetry.sys_engine      = 95;
  telemetry.sys_cooling     = 78;
  telemetry.sys_electrical  = 92;
  telemetry.sys_brakes      = 84;

  device.device_v        = 0.0f;
  device.device_pct      = 0;
  device.device_low      = false;
  device.device_critical = false;
  device.obd_detached    = false;
  device.disconnect_count = 0;
  device.everSawOBD      = false;

#if USE_TFT
  tft.fillScreen(COLOR_BLACK);
  uiInit();
#endif

  Serial.printf("[INIT] Boot complete. Publishing every %lu ms -> MQTT %s (topic: %s)\n",
                (unsigned long)TELEMETRY_INTERVAL_MS, MQTT_BROKER, MQTT_TOPIC);
  Serial.println(F("--------------------------------------------------------------------------------\n"));
}

// ==============================================================================================
//                                       MAIN LOOP
// ==============================================================================================
void loop() {
  unsigned long now = millis();

  // 1. WiFi watchdog
  if (WiFi.status() != WL_CONNECTED) {
    wifiConnected = false;
    if (now - lastWifiCheck > WIFI_RETRY_INTERVAL) {
      lastWifiCheck = now;
      Serial.println(F("[WiFi] Connection dropped, background reconnect..."));
      WiFi.reconnect();
    }
  } else {
    wifiConnected = true;
  }

  // 2. MQTT watchdog
  if (wifiConnected) {
    if (!mqttClient.connected()) {
      mqttConnected = false;
      connectMQTT();
    } else {
      mqttConnected = true;
      mqttClient.loop();
    }
  } else {
    mqttConnected = false;
  }

  // 3. Active OBD-II PID polling (request-response protocol, one PID per 100ms)
  cycleOBDRequests();

  // 4. Drain CAN receive queue + decode responses
  readCANBus();

  // 5. OBD-unplug / disconnect latch (battery variant of v1.0 anti-tamper)
  checkObdDetach(now);

  // 6. Device battery fuel gauge
  updateDeviceBattery();

  // 7. If the bus went fully silent, run the bench-simulation engine instead
  telemetry.using_sim_data = (now - lastCANMsgTime > CAN_TIMEOUT_MS);
  if (telemetry.using_sim_data) {
    simulateCANData();
  }

  // 8. Vehicle health evaluation
  evaluateSystemHealth();

  // 8b. Derive the subsystem scores + composite health score the web app renders
  computeHealthModel();

  // 9. Periodic telemetry burst
  if (now - lastPublishTime >= TELEMETRY_INTERVAL_MS) {
    lastPublishTime = now;
    if (mqttConnected) {
      publishTelemetry();
      publishAppPayload();
    }
    printTelemetrySerial();
#if USE_TFT
    uiTick(now);
#endif
  }

#if USE_TFT
  // 10. Critical-state pinned-footer strobe (the carousel freezes via uiTick)
  if (telemetry.severity == 2 && (now - lastFlashToggle >= 350)) {
    lastFlashToggle = now;
    flashState = !flashState;
    drawFooter(true);
  }
#endif

  yield();
}

// ==============================================================================================
//                                   CAN / TWAI FUNCTIONS
// ==============================================================================================

void initCANBus() {
  Serial.println(F("[CAN] Configuring TWAI controller (500 kbps ISO 11898-2)..."));
  Serial.printf("[CAN] TX=GPIO %d (chip pin 1) | RX=GPIO %d (chip pin 4) | RS pin 8 tied GND\n",
                CAN_TX_PIN, CAN_RX_PIN);

  twai_general_config_t g_config = TWAI_GENERAL_CONFIG_DEFAULT(CAN_TX_PIN, CAN_RX_PIN, TWAI_MODE_NORMAL);
  g_config.rx_queue_len = 16;
  g_config.tx_queue_len = 5;

  twai_timing_config_t t_config = TWAI_TIMING_CONFIG_500KBITS();
  twai_filter_config_t f_config = TWAI_FILTER_CONFIG_ACCEPT_ALL();

  esp_err_t installErr = twai_driver_install(&g_config, &t_config, &f_config);
  if (installErr == ESP_OK) {
    esp_err_t startErr = twai_start();
    if (startErr == ESP_OK) {
      canDriverInstalled = true;
      Serial.println(F("[CAN] TWAI driver installed & started at 500 kbps."));
    } else {
      Serial.printf("[CAN] ERROR: twai_start failed (0x%X)\n", startErr);
      canDriverInstalled = false;
    }
  } else {
    Serial.printf("[CAN] ERROR: twai_driver_install failed (0x%X) -> simulation mode\n", installErr);
    canDriverInstalled = false;
  }
}

/**
 * Sends a Mode-01 request frame on broadcast ID 0x7DF.
 * Byte0=PCI(0x02), Byte1=Mode(0x01), Byte2=PID, rest padding.
 */
void sendOBDRequest(uint8_t pid) {
  if (!canDriverInstalled) return;

  twai_message_t tx;
  tx.identifier = 0x7DF;
  tx.extd       = 0;
  tx.rtr        = 0;
  tx.data_length_code = 8;
  tx.data[0] = 0x02;
  tx.data[1] = 0x01;
  tx.data[2] = pid;
  tx.data[3] = 0x00;
  tx.data[4] = 0x00;
  tx.data[5] = 0x00;
  tx.data[6] = 0x00;
  tx.data[7] = 0x00;

  esp_err_t result = twai_transmit(&tx, pdMS_TO_TICKS(10));
  if (result != ESP_OK) {
    Serial.printf("[CAN] Request 0x%02X failed (0x%X)\n", pid, result);
  }
}

void cycleOBDRequests() {
  if (!canDriverInstalled) return;
  unsigned long now = millis();
  if (now - lastOBDRequestTime >= OBD_REQUEST_INTERVAL_MS) {
    lastOBDRequestTime = now;
    sendOBDRequest(OBD_REQUEST_PIDS[currentPIDIndex]);
    currentPIDIndex = (currentPIDIndex + 1) % OBD_PID_COUNT;
  }
}

void readCANBus() {
  if (!canDriverInstalled) return;

  twai_message_t rx;
  while (twai_receive(&rx, 0) == ESP_OK) {
    lastCANMsgTime = millis();

    if (rx.identifier >= 0x7E8 && rx.identifier <= 0x7EF && rx.data_length_code >= 3) {
      uint8_t mode = rx.data[1];
      uint8_t pid  = rx.data[2];
      if (mode != 0x41) continue;

      const uint8_t a = rx.data[3];
      const uint8_t b = (rx.data_length_code > 4) ? rx.data[4] : 0;
      const uint8_t c = (rx.data_length_code > 5) ? rx.data[5] : 0;
      const uint8_t d = (rx.data_length_code > 6) ? rx.data[6] : 0;

      lastOBDDataTime = millis();
      if (!device.everSawOBD) {
        device.everSawOBD = true;
        Serial.println(F("[OBD] First ECU response decoded - hardware feed is LIVE."));
      }

      switch (pid) {
        case 0x0C:
          telemetry.rpm = (uint16_t)(((a * 256) + b) / 4);
          break;
        case 0x05:
          telemetry.coolant_temp = (float)(a - 40);
          break;
        case 0x04:
          telemetry.engine_load = (uint8_t)((a * 100) / 255);
          break;
        case 0x0F:
          telemetry.intake_air_temp = (float)(a - 40);
          break;
        case 0x42:
          telemetry.battery_voltage = (float)(((a * 256) + b) / 1000.0f);
          break;
        case 0x06:
          telemetry.stft = (float)((a - 128) * 100.0f / 128.0f);
          break;
        case 0x07:
          telemetry.ltft = (float)((a - 128) * 100.0f / 128.0f);
          break;
        case 0x2F: {
          // Fuel tank level: A = whole percent, B = fraction of 1% (0-255 => 0.00-0.996)
          float frac = (float)b * 100.0f / 255.0f / 100.0f;
          telemetry.fuel_level_pct = (int16_t)constrain((float)a + frac, 0.0f, 100.0f);
          break;
        }
        case 0x31: {
          // Odometer: 4-byte big-endian kilometres
          uint32_t km = ((uint32_t)a << 24) | ((uint32_t)b << 16) |
                        ((uint32_t)c << 8)  | (uint32_t)d;
          if (km > 0 && km < 20000000UL) {
            telemetry.odometer_km    = km;
            telemetry.odometer_valid = true;
          }
          break;
        }
        default:
          break;
      }
    }
  }
}

// ==============================================================================================
//                        OBD-UNPLUG DETECTION (battery build anti-tamper)
// ==============================================================================================
/**
 * The device is battery-powered, so unplugging the OBD connector does NOT cut our power
 * (v1.0 voltage-drop logic can no longer detect tampering). Instead:
 *   - We latch "OBD DETACHED" when a previously live ECU feed goes silent
 *     for OBD_DETACH_TIMEOUT_MS while our systems (WiFi/MQTT/battery) are still healthy.
 *   - The latch auto-clears when the ECU starts responding again, and the
 *     disconnect_count keeps a permanent record of every dropout.
 */
void checkObdDetach(unsigned long /*now*/) {
  unsigned long now = millis();

  if (device.everSawOBD && !telemetry.using_sim_data) {
    bool silent = (now - lastOBDDataTime > OBD_DETACH_TIMEOUT_MS);
    if (silent && !device.obd_detached) {
      device.obd_detached = true;
      device.disconnect_count++;
      telemetry.tamper_detected = true;
      telemetry.status  = "OBD DETACHED";
      telemetry.severity = 2;
      Serial.println(F("********************************************************************************"));
      Serial.printf("[SECURITY] OBD-DETACH! ECU feed silent > %lus while node online (event #%u).\n",
                    (unsigned long)(OBD_DETACH_TIMEOUT_MS / 1000), device.disconnect_count);
      Serial.println(F("[SECURITY] Connector unplug or ECU failure. Alert latched until data returns."));
      Serial.println(F("********************************************************************************"));
    } else if (!silent && device.obd_detached) {
      device.obd_detached  = false;
      telemetry.status     = "NOMINAL";
      Serial.println(F("[SECURITY] OBD feed restored - detach alert auto-cleared."));
    }
  }
}

// ==============================================================================================
//                              DEVICE BATTERY FUEL GAUGE
// ==============================================================================================
void updateDeviceBattery() {
#if DEVICE_BATT_MONITOR
  // ADC1 / GPIO34, 11 dB attenuation, calibrated millivolt read then divider ratio
  uint32_t mv = analogReadMilliVolts(DEVICE_BATT_ADC_PIN);
  device.device_v = (float)mv * DEVICE_BATT_RATIO / 1000.0f;

  // Linear SOC estimate between 3.20V and 4.20V
  float pct = (device.device_v - DEVICE_BATT_MIN_V) /
              (DEVICE_BATT_MAX_V - DEVICE_BATT_MIN_V) * 100.0f;
  device.device_pct = (uint8_t)constrain(pct, 0.0f, 100.0f);

  device.device_low      = (device.device_v < DEVICE_BATT_WARN_V);
  device.device_critical = (device.device_v < DEVICE_BATT_CRIT_V);
#endif
}

// ==============================================================================================
//                              FALLBACK SIMULATION ENGINE
// ==============================================================================================
void simulateCANData() {
  unsigned long now = millis();

  float rpmPhase = (float)(now % 16000) / 16000.0f * 2.0f * PI;
  float normalizedRpm = (sin(rpmPhase) + 1.0f) * 0.5f;
  telemetry.rpm = 800 + (uint16_t)(normalizedRpm * 2700.0f) + random(-25, 26);

  telemetry.engine_load = (uint8_t)(20 + (normalizedRpm * 55.0f)) + random(-2, 3);
  if (telemetry.engine_load > 100) telemetry.engine_load = 100;

  float tempPhase = (float)(now % 60000) / 60000.0f * 2.0f * PI;
  telemetry.coolant_temp = 85.0f + (sin(tempPhase) * 8.0f) + ((float)random(-5, 6) / 10.0f);
  telemetry.oil_temp     = telemetry.coolant_temp + 7.5f + ((float)random(-3, 4) / 10.0f);

  telemetry.battery_voltage = 13.8f + (sin(rpmPhase * 2.0f) * 0.25f) + ((float)random(-10, 11) / 100.0f);

  telemetry.stft = (sin((float)(now % 8000) / 8000.0f * 2.0f * PI) * 2.5f) + ((float)random(-8, 9) / 10.0f);
  telemetry.ltft = (cos((float)(now % 24000) / 24000.0f * 2.0f * PI) * 1.5f);
  telemetry.intake_air_temp = 29.5f + (sin((float)(now % 45000) / 45000.0f * 2.0f * PI) * 3.0f);

  // Bench-demo anomalies (only while the simulator feeds data - never when hardware CAN is live)
  unsigned long cycleSec = (now / 1000) % 75;
  if (cycleSec >= 30 && cycleSec < 36) {
    telemetry.coolant_temp = 103.8f;
    telemetry.status       = "COOLANT OVERHEAT";
    telemetry.severity     = 1;
  } else if (cycleSec >= 60 && cycleSec < 66) {
    telemetry.rpm         = 4650;
    telemetry.engine_load = 88;
    telemetry.status      = "HIGH ENGINE STRESS";
    telemetry.severity    = 1;
  }
}

// ==============================================================================================
//                                 HEALTH EVALUATION
// ==============================================================================================
void evaluateSystemHealth() {
  // Priority 0: latched OBD unplug alert (cleared only by data returning)
  if (device.obd_detached) {
    telemetry.status   = "OBD DETACHED";
    telemetry.severity = 2;
    return;
  }

  // Priority 0.5: our own battery pack
#if DEVICE_BATT_MONITOR
  if (device.device_critical) {
    telemetry.status   = "DEVICE BATT CRITICAL";
    telemetry.severity = 2;
    return;
  }
#endif

  // Priority 1: vehicle overheat
  if (telemetry.coolant_temp >= 106.0f) {
    telemetry.status   = "ENGINE OVERHEAT";
    telemetry.severity = 2;
    return;
  }

  // Priority 2: coolant warning
  if (telemetry.coolant_temp >= 95.0f) {
    telemetry.status   = "COOLANT HIGH";
    telemetry.severity = 1;
    return;
  }

  // Priority 3: vehicle battery low (car 12V system, from PID 0x42)
  if (telemetry.battery_voltage < WARNING_VOLT_THRES) {
    telemetry.status   = "LOW BATTERY";
    telemetry.severity = 1;
    return;
  }

#if DEVICE_BATT_MONITOR
  // Priority 4: our pack getting low
  if (device.device_low) {
    telemetry.status   = "DEVICE BATT LOW";
    telemetry.severity = 1;
    return;
  }
#endif

  // Priority 5: redline
  if (telemetry.rpm >= 4500) {
    telemetry.status   = "RPM REDLINE";
    telemetry.severity = 1;
    return;
  }

  telemetry.status   = "NOMINAL";
  telemetry.severity = 0;
}

// ==============================================================================================
//                        DERIVED HEALTH MODEL (web-app subsystem scores)
// ==============================================================================================
/**
 * The web dashboard renders a composite health score plus four subsystem scores
 * (engine / cooling / electrical / brakes). Those are DERIVED, not directly measured,
 * so we compute them here from the real CAN values:
 *
 *   engine     : fuel-trim deviation + load stress + coolant penalty
 *   cooling    : coolant temperature curve (100 at <=88 C, falling as it heats)
 *   electrical : charging system voltage (100 at >=13.5 V, falling below 12.4 V)
 *   brakes     : odometer against a 50,000 km service interval (proxy - no brake PID exists)
 *
 * The composite score is the weighted mean, minus a penalty for active warnings.
 */
void computeHealthModel() {
  // ---- engine: trim deviation is the strongest real-world health signal we get
  float trimPenalty = fabsf(telemetry.stft) * 2.5f + fabsf(telemetry.ltft) * 1.5f;
  float loadStress  = (telemetry.engine_load > 85) ? (telemetry.engine_load - 85) * 0.6f : 0.0f;
  float engine = 100.0f - trimPenalty - loadStress;
  if (telemetry.coolant_temp > 95.0f) engine -= (telemetry.coolant_temp - 95.0f) * 1.5f;

  // ---- cooling: 100 up to 88 C, then degrades linearly
  float cooling = 100.0f;
  if (telemetry.coolant_temp > 88.0f) {
    cooling = 100.0f - (telemetry.coolant_temp - 88.0f) * 4.0f;
  }

  // ---- electrical: alternator output
  float electrical = 100.0f;
  if (telemetry.battery_voltage < 13.5f) {
    electrical = 100.0f - (13.5f - telemetry.battery_voltage) * 25.0f;
  }

  // ---- brakes: odometer-based wear proxy (50,000 km pad life)
  float brakes = 84.0f;
  if (telemetry.odometer_valid) {
    brakes = 100.0f - (float)((telemetry.odometer_km % 50000UL) / 500UL);
  }

  telemetry.sys_engine     = (uint8_t)constrain(engine, 0.0f, 100.0f);
  telemetry.sys_cooling    = (uint8_t)constrain(cooling, 0.0f, 100.0f);
  telemetry.sys_electrical = (uint8_t)constrain(electrical, 0.0f, 100.0f);
  telemetry.sys_brakes     = (uint8_t)constrain(brakes, 0.0f, 100.0f);

  // ---- composite
  float score = telemetry.sys_engine     * 0.35f +
                telemetry.sys_cooling    * 0.25f +
                telemetry.sys_electrical * 0.20f +
                telemetry.sys_brakes     * 0.20f;
  if (telemetry.severity == 1) score -= 6.0f;
  if (telemetry.severity == 2) score -= 22.0f;
  telemetry.health_score = (uint8_t)constrain(score, 0.0f, 100.0f);
}

// ==============================================================================================
//                                 NETWORKING & MQTT
// ==============================================================================================
void connectWiFi() {
  Serial.print(F("[WiFi] Connecting to SSID: "));
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  uint8_t attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < WIFI_MAX_BOOT_RETRIES) {
    delay(500);
    Serial.print(F("."));
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.println(F(" CONNECTED!"));
    Serial.printf("[WiFi] IP: %s | RSSI: %d dBm\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
  } else {
    wifiConnected = false;
    Serial.println(F(" TIMEOUT -> standalone offline mode"));
  }
}

bool connectMQTT() {
  if (!wifiConnected) return false;

  uint8_t retries = 0;
  while (!mqttClient.connected() && retries < MQTT_MAX_BOOT_RETRIES) {
    String clientId = "KollsAutoTronics_" + String(VEHICLE_ID) + "_" + String(random(0x1000, 0xFFFF), HEX);
    Serial.printf("[MQTT] Connecting to %s:%d as %s... ", MQTT_BROKER, MQTT_PORT, clientId.c_str());

    if (mqttClient.connect(clientId.c_str())) {
      Serial.println(F("CONNECTED!"));
      mqttConnected = true;
      mqttClient.subscribe(mqttCmdTopic);
      return true;
    }
    Serial.printf("FAILED (rc=%d), retrying...\n", mqttClient.state());
    retries++;
    delay(400);
  }
  return false;
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.printf("[MQTT CMD] %s\n", topic);

  char buf[96];
  unsigned int copyLen = (length < (sizeof(buf) - 1)) ? length : (sizeof(buf) - 1);
  memcpy(buf, payload, copyLen);
  buf[copyLen] = '\0';
  Serial.printf("[MQTT CMD] payload: %s\n", buf);

  if (strstr(buf, "PING") != NULL) {
    mqttClient.publish(MQTT_TOPIC, "{\"response\":\"PONG\",\"status\":\"ONLINE\"}");
  } else if (strstr(buf, "RESET_TAMPER") != NULL) {
    // Remote latch clear (e.g. confirmed travel event / planned unplug)
    device.obd_detached     = false;
    telemetry.tamper_detected = false;
    telemetry.status        = "NOMINAL";
    Serial.println(F("[SECURITY] OBD detach latch cleared via remote command."));
  }
}

/**
 * JSON payload - FULLY BACKWARD COMPATIBLE with the v1.0 schema consumed by the dashboard.
 * Every v1.0 field is unchanged; battery edition only ADDS:
 *   metrics.device_v, metrics.device_pct
 *   diagnostics.obd_detached, diagnostics.disconnect_count, diagnostics.device_low
 */
void publishTelemetry() {
#if ARDUINOJSON_VERSION_MAJOR >= 7
  JsonDocument doc;
#else
  StaticJsonDocument<640> doc;
#endif

  doc["vehicle_id"]   = VEHICLE_ID;
  doc["timestamp_ms"] = millis();
  doc["uptime_sec"]   = millis() / 1000;
  doc["can_feed"]     = telemetry.using_sim_data ? "SIMULATED" : "HARDWARE_CAN";
  doc["fw_version"]   = "2.1-battery";

#if ARDUINOJSON_VERSION_MAJOR >= 7
  JsonObject metrics = doc["metrics"].to<JsonObject>();
#else
  JsonObject metrics = doc.createNestedObject("metrics");
#endif
  metrics["rpm"]         = telemetry.rpm;
  metrics["coolant_c"]   = serialized(String(telemetry.coolant_temp, 1));
  metrics["oil_c"]       = serialized(String(telemetry.oil_temp, 1));
  metrics["battery_v"]   = serialized(String(telemetry.battery_voltage, 2));
  metrics["load_pct"]    = telemetry.engine_load;
  metrics["stft_pct"]    = serialized(String(telemetry.stft, 1));
  metrics["ltft_pct"]    = serialized(String(telemetry.ltft, 1));
  metrics["iat_c"]       = serialized(String(telemetry.intake_air_temp, 1));
  metrics["health_score"] = telemetry.health_score;
  if (telemetry.fuel_level_pct >= 0) {
    metrics["fuel_level_pct"] = telemetry.fuel_level_pct;
  }
  if (telemetry.odometer_valid) {
    metrics["odometer_km"] = telemetry.odometer_km;
  }
#if DEVICE_BATT_MONITOR
  metrics["device_v"]    = serialized(String(device.device_v, 2));
  metrics["device_pct"]  = device.device_pct;
#endif

#if ARDUINOJSON_VERSION_MAJOR >= 7
  JsonObject diag = doc["diagnostics"].to<JsonObject>();
#else
  JsonObject diag = doc.createNestedObject("diagnostics");
#endif
  diag["status"]           = telemetry.status;
  diag["severity"]         = telemetry.severity;
  diag["tamper_alert"]     = telemetry.tamper_detected;
  diag["obd_detached"]     = device.obd_detached;
  diag["disconnect_count"] = device.disconnect_count;
#if DEVICE_BATT_MONITOR
  diag["device_low"]       = device.device_low;
#endif

  char jsonBuffer[640];
  size_t bytesWritten = serializeJson(doc, jsonBuffer, sizeof(jsonBuffer));

  if (!mqttClient.publish(MQTT_TOPIC, jsonBuffer, bytesWritten)) {
    Serial.println(F("[MQTT] WARNING: telemetry publish failed!"));
  }
}

// ==============================================================================================
//                    APP-SHAPED PAYLOAD (mirrors the web app data model)
// ==============================================================================================
/**
 * The web dashboard's vehicle object uses flat, consumer-facing field names:
 *   battery, coolant, range, fuel, tires[], systems{engine,cooling,electrical,brakes}, score
 * This payload publishes exactly those names (real values, derived where no PID exists)
 * on its own topic so the app can bind to it without any translation layer.
 *
 * Topic: kolls/vehicle/{VEHICLE_ID}/app
 */
void publishAppPayload() {
#if ARDUINOJSON_VERSION_MAJOR >= 7
  JsonDocument doc;
#else
  StaticJsonDocument<768> doc;
#endif

  doc["vehicle_id"] = VEHICLE_ID;
  doc["name"]       = VEHICLE_NAME;
  doc["live"]       = true;                    // tells the app this is real hardware data
  doc["score"]      = telemetry.health_score;  // composite 0-100 -> health ring

  // ---- vital cards ----------------------------------------------------------
  doc["battery"] = serialized(String(telemetry.battery_voltage, 2));  // VEHICLE 12 V system
  doc["coolant"] = serialized(String(telemetry.coolant_temp, 1));
  doc["oil_temp"] = serialized(String(telemetry.oil_temp, 1));
  doc["rpm"]     = telemetry.rpm;

  // ---- fuel: PID 0x2F (null when the ECU does not report it) ----------------
  if (telemetry.fuel_level_pct >= 0) {
    doc["fuel"] = telemetry.fuel_level_pct;
    doc["range"] = (uint16_t)((float)telemetry.fuel_level_pct * TANK_RANGE_KM_FULL / 100.0f);
  } else {
    doc["fuel"]  = nullptr;
    doc["range"] = nullptr;
  }

  // ---- odometer (drives the service-interval wear rows) --------------------
  if (telemetry.odometer_valid) {
    doc["odometer_km"] = telemetry.odometer_km;
  } else {
    doc["odometer_km"] = nullptr;
  }

  // ---- subsystem scores -----------------------------------------------------
#if ARDUINOJSON_VERSION_MAJOR >= 7
  JsonObject systems = doc["systems"].to<JsonObject>();
#else
  JsonObject systems = doc.createNestedObject("systems");
#endif
  systems["engine"]     = telemetry.sys_engine;
  systems["cooling"]    = telemetry.sys_cooling;
  systems["electrical"] = telemetry.sys_electrical;
  systems["brakes"]     = telemetry.sys_brakes;

  // ---- status / alerts ------------------------------------------------------
  doc["status"]   = telemetry.status;
  doc["severity"] = telemetry.severity;
  doc["tone"]     = telemetry.severity == 2 ? "danger" : (telemetry.severity == 1 ? "warn" : "good");

  // ---- gateway (node) telemetry --------------------------------------------
#if ARDUINOJSON_VERSION_MAJOR >= 7
  JsonObject gw = doc["gateway"].to<JsonObject>();
#else
  JsonObject gw = doc.createNestedObject("gateway");
#endif
  gw["device_v"]        = serialized(String(device.device_v, 2));
  gw["device_pct"]      = device.device_pct;
  gw["obd_detached"]    = device.obd_detached;
  gw["disconnect_count"] = device.disconnect_count;
  gw["can_feed"]        = telemetry.using_sim_data ? "SIMULATED" : "HARDWARE_CAN";
  gw["fw_version"]      = "2.1-battery";
  gw["tires_available"] = false;   // no TPMS PID - app should keep its own tyre data

  char jsonBuffer[768];
  size_t bytesWritten = serializeJson(doc, jsonBuffer, sizeof(jsonBuffer));
  if (!mqttClient.publish(mqttAppTopic, jsonBuffer, bytesWritten)) {
    Serial.println(F("[MQTT] WARNING: app-shape publish failed!"));
  }
}

// ==============================================================================================
//                                 SERIAL MONITOR LOGGING
// ==============================================================================================
void printTelemetrySerial() {
  unsigned long uptime = millis() / 1000;
  Serial.println(F("================================================================================"));
  Serial.printf("[KOLLS v2.0] Uptime %02lu:%02lu:%02lu | ID: %s | Feed: %s\n",
                uptime / 3600, (uptime % 3600) / 60, uptime % 60, VEHICLE_ID,
                telemetry.using_sim_data ? "SIMULATOR" : "HARDWARE CAN");
  Serial.println(F("--------------------------------------------------------------------------------"));
  Serial.printf("  RPM: %4u  |  COOLANT: %5.1f C  |  OIL: %5.1f C  |  LOAD: %3u %%\n",
                telemetry.rpm, telemetry.coolant_temp, telemetry.oil_temp, telemetry.engine_load);
  Serial.printf("  SYS V: %5.2f  |  STFT: %+5.1f %%  |  LTFT: %+5.1f %%  |  HEALTH: %s (Sev %u)\n",
                telemetry.battery_voltage, telemetry.stft, telemetry.ltft,
                telemetry.status.c_str(), telemetry.severity);
#if DEVICE_BATT_MONITOR
  Serial.printf("  DEVICE PACK: %5.2f V (%3u %%)%s\n", device.device_v, device.device_pct,
                device.device_critical ? "  << CRITICAL - CHARGE NOW" : (device.device_low ? "  (<24h left)" : ""));
#endif
  Serial.printf("  OBD feed: %s | disconnects: %u | WiFi: %s | MQTT: %s\n",
                device.everSawOBD ? (device.obd_detached ? "LIVE (detached!)" : "LIVE") : "never seen",
                device.disconnect_count,
                wifiConnected ? "OK" : "DOWN", mqttConnected ? "OK" : "DOWN");
  Serial.println(F("================================================================================\n"));
}

// ==============================================================================================
//                                 TFT DISPLAY (ST7735)
// ==============================================================================================
#if USE_TFT

void displayBootScreen() {
  tft.fillScreen(COLOR_BLACK);
  tft.setTextWrap(false);

  tft.setTextColor(COLOR_CYAN);
  tft.setTextSize(3);
  tft.setCursor(18, 24);
  tft.print(F("KOLLS"));

  tft.setTextColor(COLOR_WHITE);
  tft.setTextSize(1);
  tft.setCursor(29, 52);
  tft.print(F("AUTOTRONICS"));

  tft.drawFastHLine(14, 66, 100, COLOR_KOLLS_BLUE);

  tft.setTextColor(COLOR_GRAY);
  tft.setCursor(6, 76);
  tft.print(F("Battery CAN Node v2.0"));

  const int16_t barX = 14, barY = 104, barW = 100, barH = 10;
  tft.drawRect(barX, barY, barW, barH, COLOR_WHITE);
  for (int16_t i = 0; i <= (barW - 4); i += 4) {
    tft.fillRect(barX + 2, barY + 2, i, barH - 4, COLOR_CYAN);
    delay(25);
  }

  tft.setTextColor(COLOR_GRAY);
  tft.setCursor(18, 134);
  tft.print(F("Battery Edition IoT"));
  delay(900);
}

// ==============================================================================================
//           TFT DISPLAY (ST7735) - PROFESSIONAL CAROUSEL UI / INFINITE SCROLL
// ==============================================================================================
// Design system (small-screen automotive HMI rules):
//   - Screen split: 120px scrollable viewport + 40px PINNED status footer (never scrolls).
//   - ONE story per page: label-left / value-right grid, hero numerics on page 1.
//   - Color = status only: GREEN nominal, YELLOW attention, RED danger, CYAN brand.
//   - 3-page infinite auto-scroll: HOLD 2.6s -> smooth 700ms downward glide -> wraps forever.
//   - Double-buffered (2x 30KB RAM canvases): zero flicker, zero torn frames.
//   - CRITICAL severity freezes the carousel and strobes the pinned footer.
// ==============================================================================================

const unsigned long UI_HOLD_MS    = 2600;   // ms a page rests before scrolling on
const unsigned long UI_GLIDE_MS   = 700;    // ms scroll animation duration
const uint8_t       UI_PAGE_COUNT = 3;      // pages in the endless cycle

GFXcanvas16* pageCanvas = NULL;    // page currently displayed
GFXcanvas16* nextCanvas = NULL;    // page being scrolled into
bool          canvasOk       = false;
uint8_t       currPage       = 0;
bool          uiAnimating    = false;
unsigned long pageHoldStart  = 0;
unsigned long uiAnimStart    = 0;
int16_t       lastAnimOff    = -1;

String  lastFooterStatus = "";
uint8_t lastFooterSev    = 255;
bool    lastFooterFlash  = false;

// ------------------------------------------------------------- status colors
float clampF(float v, float lo, float hi) { return v < lo ? lo : (v > hi ? hi : v); }

uint16_t coolantColorFor(float c) {
  if (c >= 100.0f) return COLOR_RED;
  if (c >= 90.0f)  return COLOR_YELLOW;
  return COLOR_GREEN;
}

uint16_t voltColorFor(float v) {
  if (v < 11.8f)  return COLOR_RED;
  if (v <= 12.4f) return COLOR_YELLOW;
  return COLOR_GREEN;
}

#if DEVICE_BATT_MONITOR
uint16_t packColorFor(float v) {
  if (v < DEVICE_BATT_CRIT_V) return COLOR_RED;
  if (v < DEVICE_BATT_WARN_V) return COLOR_YELLOW;
  return COLOR_GREEN;
}
#endif

uint16_t trimColorFor(float t) {
  float a = fabsf(t);
  if (a > 8.0f) return COLOR_RED;
  if (a > 5.0f) return COLOR_YELLOW;
  return COLOR_GREEN;
}

int8_t wifiBarsFor(int16_t rssi) {
  if (rssi == 0 || rssi <= -100) return 0;
  if (rssi >= -55) return 4;
  if (rssi >= -67) return 3;
  if (rssi >= -78) return 2;
  return 1;
}

// ---------------------------------------------------------- draw primitives
void uiTitle(Adafruit_GFX& g, const char* title, uint8_t pageIdx) {
  g.setTextWrap(false);
  g.setTextColor(COLOR_CYAN);
  g.setTextSize(1);
  g.setCursor(4, 6);
  g.print(title);

  // carousel position dots
  for (uint8_t i = 0; i < UI_PAGE_COUNT; i++) {
    int16_t x = 98 + (int16_t)i * 9;
    if (i == pageIdx) g.fillCircle(x, 10, 2, COLOR_CYAN);
    else              g.drawCircle(x, 10, 2, COLOR_GRAY);
  }
  g.drawFastHLine(0, 19, 128, COLOR_KOLLS_BLUE);
}

void uiLabel(Adafruit_GFX& g, int16_t x, int16_t y, const char* txt) {
  g.setTextColor(COLOR_GRAY);
  g.setTextSize(1);
  g.setCursor(x, y);
  g.print(txt);
}

void uiValue(Adafruit_GFX& g, int16_t right, int16_t y, const char* txt,
             uint8_t size, uint16_t color) {
  g.setTextColor(color);
  g.setTextSize(size);
  g.setCursor(right - (int16_t)(strlen(txt) * 6 * size), y);
  g.print(txt);
}

void uiRow(Adafruit_GFX& g, int16_t y, const char* label, const char* value, uint16_t color) {
  uiLabel(g, 4, y, label);
  uiValue(g, 124, y, value, 2, color);
  g.drawFastHLine(0, y + 20, 128, COLOR_DARK_GRAY);
}

void uiCentered(Adafruit_GFX& g, int16_t y, const char* txt, uint8_t size, uint16_t color) {
  int16_t x = (128 - (int16_t)(strlen(txt) * 6 * size)) / 2;
  if (x < 0) x = 0;
  g.setTextColor(color);
  g.setTextSize(size);
  g.setCursor(x, y);
  g.print(txt);
}

void uiBar(Adafruit_GFX& g, int16_t x, int16_t y, int16_t w, float pct01, uint16_t color) {
  g.drawRect(x, y, w, 7, COLOR_DARK_GRAY);
  g.fillRect(x + 2, y + 2, (int16_t)(clampF(pct01, 0.0f, 1.0f) * (w - 5) + 0.5f), 3, color);
}

void uiSignedBar(Adafruit_GFX& g, int16_t x, int16_t y, int16_t w, float pct, uint16_t color) {
  g.drawRect(x, y, w, 7, COLOR_DARK_GRAY);
  int16_t cx = x + w / 2;
  g.drawFastVLine(cx, y, 7, COLOR_WHITE);
  int16_t off = (int16_t)(clampF(pct / 10.0f, -1.0f, 1.0f) * ((w / 2) - 3));
  if (off >= 0) g.fillRect(cx + 1, y + 2, off, 3, color);
  else          g.fillRect(cx + off, y + 2, -off, 3, color);
}

void uiBatteryIcon(Adafruit_GFX& g, int16_t x, int16_t y, float pct01, uint16_t color) {
  g.drawRect(x, y, 22, 12, COLOR_WHITE);
  g.fillRect(x + 23, y + 3, 2, 6, COLOR_WHITE);
  g.fillRect(x + 2, y + 2, (int16_t)(clampF(pct01, 0.0f, 1.0f) * 18 + 0.5f), 8, color);
}

void uiWifiIcon(Adafruit_GFX& g, int16_t x, int16_t y, uint8_t bars) {
  for (int16_t i = 0; i < 4; i++) {
    int16_t h = 3 + i * 3;
    uint16_t col = i < (int16_t)bars ? COLOR_GREEN : COLOR_DARK_GRAY;
    g.fillRect(x + i * 4, y + 12 - h, 3, h, col);
  }
}

// --------------------------------------------------------- PAGE 0 : HERO / GLANCE
void renderPage0(Adafruit_GFX& g) {
  g.fillScreen(COLOR_BLACK);
  uiTitle(g, "KOLLS", 0);

  uiLabel(g, 4, 24, "ENGINE SPEED");
  char buf[10];
  snprintf(buf, sizeof(buf), "%u", telemetry.rpm);
  uiValue(g, 124, 33, buf, 3,
          telemetry.rpm >= 4500 ? COLOR_RED : (telemetry.rpm >= 3000 ? COLOR_YELLOW : COLOR_WHITE));

  // RPM range bar 0-6000 with redline tick at 4500
  uiBar(g, 4, 60, 114, telemetry.rpm / 6000.0f,
        telemetry.rpm >= 4500 ? COLOR_RED : COLOR_CYAN);
  int16_t rl = 4 + (int16_t)(4500.0f / 6000.0f * 114.0f);
  g.drawFastVLine(rl, 58, 11, COLOR_RED);
  uiLabel(g, 4, 70, "0");
  uiLabel(g, 110, 70, "6K");

  // twin data cards: coolant / oil
  g.drawRect(2, 82, 62, 22, COLOR_DARK_GRAY);
  uiLabel(g, 4, 84, "COOL");
  snprintf(buf, sizeof(buf), "%.1f", telemetry.coolant_temp);
  uiValue(g, 62, 84, buf, 1, coolantColorFor(telemetry.coolant_temp));

  g.drawRect(66, 82, 62, 22, COLOR_DARK_GRAY);
  uiLabel(g, 68, 84, "OIL");
  snprintf(buf, sizeof(buf), "%.1f", telemetry.oil_temp);
  uiValue(g, 126, 84, buf, 1, COLOR_WHITE);

  // compact bottom row: vehicle voltage + intake air
  uiLabel(g, 4, 108, "VOLT");
  snprintf(buf, sizeof(buf), "%.1f", telemetry.battery_voltage);
  uiValue(g, 56, 108, buf, 1, voltColorFor(telemetry.battery_voltage));
  uiLabel(g, 68, 108, "IAT");
  snprintf(buf, sizeof(buf), "%.1f", telemetry.intake_air_temp);
  uiValue(g, 124, 108, buf, 1, COLOR_WHITE);
}

// ------------------------------------- PAGE 1 : ENGINE DEEP-DIVE / FUEL HEALTH
void renderPage1(Adafruit_GFX& g) {
  g.fillScreen(COLOR_BLACK);
  uiTitle(g, "ENGINE", 1);
  char buf[10];

  uiLabel(g, 4, 24, "CALC LOAD");
  snprintf(buf, sizeof(buf), "%u %%", telemetry.engine_load);
  uiValue(g, 124, 24, buf, 2,
          telemetry.engine_load > 80 ? COLOR_RED : (telemetry.engine_load >= 50 ? COLOR_YELLOW : COLOR_GREEN));
  uiBar(g, 4, 44, 114, telemetry.engine_load / 100.0f, COLOR_CYAN);

  uiLabel(g, 4, 58, "SYS VOLT");
  snprintf(buf, sizeof(buf), "%.1f V", telemetry.battery_voltage);
  uiValue(g, 124, 58, buf, 1, voltColorFor(telemetry.battery_voltage));
  g.drawFastHLine(0, 70, 128, COLOR_DARK_GRAY);

  uiLabel(g, 4, 74, "INTAKE AIR");
  snprintf(buf, sizeof(buf), "%.1f C", telemetry.intake_air_temp);
  uiValue(g, 124, 74, buf, 1, COLOR_WHITE);
  g.drawFastHLine(0, 86, 128, COLOR_DARK_GRAY);

  uiLabel(g, 4, 88, "FUEL TRIMS");
  uiValue(g, 124, 88, "+-10%", 1, COLOR_GRAY);
  uiLabel(g, 4, 100, "STFT");
  uiSignedBar(g, 30, 98, 94, telemetry.stft, trimColorFor(telemetry.stft));
  uiLabel(g, 4, 111, "LTFT");
  uiSignedBar(g, 30, 109, 94, telemetry.ltft, trimColorFor(telemetry.ltft));
}

// ------------------------------------------- PAGE 2 : NODE STATUS / CONNECTIVITY
void renderPage2(Adafruit_GFX& g) {
  g.fillScreen(COLOR_BLACK);
  uiTitle(g, "NODE", 2);
  char buf[16];

#if DEVICE_BATT_MONITOR
  uiLabel(g, 4, 26, "PACK");
  uiBatteryIcon(g, 52, 24, device.device_pct / 100.0f, packColorFor(device.device_v));
  snprintf(buf, sizeof(buf), "%u%%", device.device_pct);
  uiValue(g, 124, 24, buf, 2, packColorFor(device.device_v));
#endif
  g.drawFastHLine(0, 46, 128, COLOR_DARK_GRAY);

  uiLabel(g, 4, 52, "WIFI");
  uiWifiIcon(g, 58, 50, (uint8_t)wifiBarsFor(WiFi.RSSI()));
  snprintf(buf, sizeof(buf), "%d", WiFi.RSSI());
  uiValue(g, 124, 52, buf, 1, COLOR_WHITE);
  g.drawFastHLine(0, 68, 128, COLOR_DARK_GRAY);

  uiLabel(g, 4, 72, "MQTT");
  if (mqttConnected) {
    uiValue(g, 124, 72, "ONLINE", 2, COLOR_GREEN);
  } else if (!wifiConnected) {
    uiValue(g, 124, 72, "NO WIFI", 2, COLOR_RED);
  } else {
    uiValue(g, 124, 72, "OFFLINE", 2, COLOR_RED);
  }
  g.drawFastHLine(0, 92, 128, COLOR_DARK_GRAY);

  uiLabel(g, 4, 96, "CAN FEED");
  uiValue(g, 124, 96, telemetry.using_sim_data ? "SIM" : "LIVE", 2,
          telemetry.using_sim_data ? COLOR_YELLOW : COLOR_GREEN);

  // footer strip: uptime + lifetime OBD dropout count
  uint32_t up = millis() / 1000;
  snprintf(buf, sizeof(buf), "UP %02lu:%02lu:%02lu",
           (unsigned long)((up / 3600) % 100), (unsigned long)((up / 60) % 60), (unsigned long)(up % 60));
  uiLabel(g, 4, 112, buf);
  snprintf(buf, sizeof(buf), "D %u", device.disconnect_count);
  uiValue(g, 124, 112, buf, 1, device.disconnect_count ? COLOR_RED : COLOR_GRAY);
}

void renderPage(uint8_t page, Adafruit_GFX& g) {
  switch (page % UI_PAGE_COUNT) {
    case 0:  renderPage0(g); break;
    case 1:  renderPage1(g); break;
    default: renderPage2(g); break;
  }
}

// -------------------------------------------------- infinite-scroll mechanics
/**
 * Pushes one frame of the scroll animation to the panel.
 * Viewport rows 0..119: top slice = outgoing page sliding up,
 * bottom slice = incoming page entering from below.
 */
void uiBlit(int16_t off) {
  tft.drawRGBBitmap(0, 0, pageCanvas->getBuffer() + off * 128, 128, 120 - off);
  if (off > 0) {
    tft.drawRGBBitmap(0, 120 - off, nextCanvas->getBuffer(), 128, off);
  }
}

void uiInit() {
  pageCanvas = new GFXcanvas16(128, 120);
  nextCanvas = new GFXcanvas16(128, 120);
  canvasOk = (pageCanvas != NULL) && (nextCanvas != NULL) &&
             (pageCanvas->getBuffer() != NULL) && (nextCanvas->getBuffer() != NULL);
  if (!canvasOk) {
    delete pageCanvas;
    pageCanvas = NULL;
    delete nextCanvas;
    nextCanvas = NULL;
    Serial.println(F("[TFT] Not enough heap for carousel buffers -> static fallback"));
    return;
  }
  Serial.printf("[TFT] Carousel ready: %u-page infinite scroll (2x %u-byte buffers)\n",
                UI_PAGE_COUNT, (unsigned)(128u * 120u * 2u));
  renderPage(0, *pageCanvas);
  tft.drawRGBBitmap(0, 0, pageCanvas->getBuffer(), 128, 120);
  drawFooter(true);
  pageHoldStart = millis();
}

void uiTick(unsigned long now) {
  drawFooter(false);   // cheap (cache-guarded); re-renders on status change

  // Degraded mode (heap too tight for buffers): keep the hero page static
  if (!canvasOk) {
    static unsigned long lastFallbackDraw = 0;
    if (now - lastFallbackDraw >= UI_HOLD_MS) {
      lastFallbackDraw = now;
      renderPage(0, tft);
      drawFooter(true);
    }
    return;
  }

  // CRITICAL: freeze the carousel so the strobing pinned footer can't be missed
  if (telemetry.severity == 2) {
    pageHoldStart = now;
    return;
  }

  if (uiAnimating) {
    int16_t off = (int16_t)(((float)(now - uiAnimStart) * 120.0f) / (float)UI_GLIDE_MS);
    if (off > 120) off = 120;
    if (off != lastAnimOff) {
      uiBlit(off);
      lastAnimOff = off;
      if (off >= 120) {
        GFXcanvas16* tmp = pageCanvas;
        pageCanvas = nextCanvas;
        nextCanvas = tmp;
        currPage = (currPage + 1) % UI_PAGE_COUNT;
        pageHoldStart = now;
        uiAnimating = false;
      }
    }
  } else if (now - pageHoldStart >= UI_HOLD_MS) {
    renderPage((currPage + 1) % UI_PAGE_COUNT, *nextCanvas);
    uiAnimStart = now;
    uiAnimating = true;
    lastAnimOff = -1;
  }
}

// --------------------------------------------------- PINNED STATUS FOOTER (y:120-159)
void drawFooter(bool force) {
  bool changed = (lastFooterSev != telemetry.severity) ||
                 (lastFooterStatus != telemetry.status) ||
                 (lastFooterFlash != flashState);
  if (!force && !changed) return;

  lastFooterSev    = telemetry.severity;
  lastFooterStatus = telemetry.status;
  lastFooterFlash  = flashState;

  const int16_t Y = 120, H = 40;

  if (telemetry.severity == 0) {
    tft.fillRect(0, Y, 128, H, COLOR_GREEN);
    uiCentered(tft, Y + 5, "NOMINAL", 2, COLOR_BLACK);
    uiCentered(tft, Y + 24, telemetry.using_sim_data ? "BENCH DEMO MODE" : "ALL SYSTEMS OK", 1, COLOR_BLACK);
  } else if (telemetry.severity == 1) {
    tft.fillRect(0, Y, 128, H, COLOR_YELLOW);
    uiCentered(tft, Y + 5, "WARNING", 2, COLOR_BLACK);
    uiCentered(tft, Y + 24, telemetry.status.c_str(), 1, COLOR_BLACK);
  } else {
    uint16_t bg = flashState ? COLOR_RED : COLOR_BLACK;
    uint16_t fg = flashState ? COLOR_WHITE : COLOR_RED;
    tft.fillRect(0, Y, 128, H, bg);
    tft.drawRect(0, Y, 127, H - 1, COLOR_RED);

    if (device.obd_detached) {
      uiCentered(tft, Y + 5, "DETACHED", 2, fg);
      uiCentered(tft, Y + 24, "OBD UNPLUGGED", 1, fg);
    } else {
      const char* s = telemetry.status.c_str();
      uint8_t size = (strlen(s) <= 10) ? 2 : 1;
      uiCentered(tft, Y + (size == 2 ? 5 : 10), s, size, fg);
      uiCentered(tft, Y + 24, device.device_critical ? "CHARGE DEVICE NOW" : "CHECK VEHICLE", 1, fg);
    }
  }
}

#endif // USE_TFT

