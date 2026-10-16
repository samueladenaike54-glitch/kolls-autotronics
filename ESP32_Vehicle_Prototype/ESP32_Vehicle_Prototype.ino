/*
 * ==============================================================================================
 *                       KOLLS AUTOTRONICS - VEHICLE HEALTH MONITOR
 *                                   FIRMWARE VERSION 1.0
 * ==============================================================================================
 *  Target Board:     ESP32 Dev Module / NodeMCU-32S / ESP32-WROOM-32
 *  Application:      Heavy Vehicle IoT Telematics & Edge Diagnostic Node
 *  Features:         - Hardware CAN / TWAI Bus Controller (ISO 11898-2 OBD-II Standard)
 *                    - Secure MQTT Telemetry Reporting with Dynamic JSON Payload
 *                    - 1.8" ST7735 Color TFT Live Gauge Display
 *                    - Real-time Anti-Tamper & OBD Disconnect Detection
 *                    - Automatic Fallback CAN Simulation Engine for Bench Testing
 * ----------------------------------------------------------------------------------------------
 *  REQUIRED ARDUINO IDE BOARD CONFIGURATION:
 *    - Board Manager URL: https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
 *    - Board: "ESP32 Dev Module" (or your specific ESP32 board)
 *    - Flash Frequency: 80MHz | Flash Mode: QIO | Partition Scheme: Default 4MB with spiffs
 *
 *  REQUIRED LIBRARIES (Install via Arduino Library Manager):
 *    1. "PubSubClient" by Nick O'Leary (v2.8.0 or newer)
 *    2. "ArduinoJson" by Benoit Blanchon (v6.x or v7.x supported)
 *    3. Display Library:
 *       - OPTION A (Default): "Adafruit GFX Library" + "Adafruit ST7735 and ST7789 Library"
 *       - OPTION B: "TFT_eSPI" by Bodmer (Requires User_Setup.h pin configuration)
 *       See the USE_ADAFRUIT_ST7735 configuration toggle below.
 * ==============================================================================================
 */

// ==============================================================================================
//                                   SYSTEM INCLUDES
// ==============================================================================================
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include "driver/twai.h"

// ----------------------------------------------------------------------------------------------
// Display Library Selection:
// Set USE_ADAFRUIT_ST7735 to 1 to use standard Adafruit libraries (easiest, no config edits needed)
// Set USE_ADAFRUIT_ST7735 to 0 to use TFT_eSPI (requires configuring User_Setup.h in TFT_eSPI dir)
// ----------------------------------------------------------------------------------------------
#define USE_ADAFRUIT_ST7735 1

#if USE_ADAFRUIT_ST7735
  #include <Adafruit_GFX.h>
  #include <Adafruit_ST7735.h>
#else
  #include <TFT_eSPI.h>
#endif

// ==============================================================================================
//                             // ============== CONFIGURATION ==============
// ==============================================================================================
// Network & Telematics Credentials
const char* WIFI_SSID     = "ORION";
const char* WIFI_PASS     = "12345678";
const char* MQTT_BROKER   = "broker.hivemq.com";
const int   MQTT_PORT     = 1883;
const char* MQTT_TOPIC    = "kolls/vehicle/telemetry";
const char* VEHICLE_ID    = "KA-TRUCK-001";

// ----------------------------------------------------------------------------------------------
// CAN Bus Pins (SN65HVD230 / VP230 3.3V Transceiver connections)
// ----------------------------------------------------------------------------------------------
#define CAN_TX_PIN GPIO_NUM_5
#define CAN_RX_PIN GPIO_NUM_4

// ----------------------------------------------------------------------------------------------
// TFT Display Pins (1.8" ST7735 SPI 128x160)
// Note: If CAN_RX is assigned to GPIO 4, adjust TFT_RST to GPIO 16 (or -1 if tied to ESP32 EN)
// ----------------------------------------------------------------------------------------------
#define TFT_CS    15
#define TFT_RST   16    // Reassigned to GPIO 16 to prevent hardware collision with CAN_RX (GPIO 4)
#define TFT_DC    2
#define TFT_MOSI  23    // ESP32 Hardware VSPI MOSI
#define TFT_SCLK  18    // ESP32 Hardware VSPI SCK
// Note: Adjust pin assignments for your specific wiring if needed.

// ----------------------------------------------------------------------------------------------
// Timing & System Constants
// ----------------------------------------------------------------------------------------------
const unsigned long TELEMETRY_INTERVAL_MS = 2000;   // 2-second publishing interval
const unsigned long CAN_TIMEOUT_MS        = 3500;   // Time before fallback to simulation
const unsigned long WIFI_RETRY_INTERVAL   = 10000;  // WiFi reconnect retry interval
const uint8_t       WIFI_MAX_BOOT_RETRIES = 20;     // 20 attempts @ 500ms = 10s timeout
const uint8_t       MQTT_MAX_BOOT_RETRIES = 3;      // 3 connection attempts per cycle

// Anti-Tamper Configuration
#define TAMPER_WINDOW_SIZE     5
#define TAMPER_VOLT_HIGH_THRES 12.0f   // Normal vehicle battery threshold
#define TAMPER_VOLT_LOW_THRES  10.0f   // Sudden drop threshold indicating disconnection
#define WARNING_VOLT_THRES     11.8f   // Low battery warning threshold

// ----------------------------------------------------------------------------------------------
// 16-Bit Color Palette Definitions (RGB565)
// ----------------------------------------------------------------------------------------------
#define COLOR_BLACK       0x0000
#define COLOR_WHITE       0xFFFF
#define COLOR_CYAN        0x07FF  // Kolls Brand Primary Cyan
#define COLOR_KOLLS_BLUE  0x03FF  // Kolls Accent Blue
#define COLOR_GREEN       0x07E0  // Nominal State Green
#define COLOR_YELLOW      0xFFE0  // Warning State Yellow
#define COLOR_RED         0xF800  // Critical / Tamper State Red
#define COLOR_DARK_RED    0x7800  // Flashing alternate Red
#define COLOR_GRAY        0x7BEF  // Secondary text / Label Gray
#define COLOR_DARK_GRAY   0x2104  // Grid & Geometric Border Gray
#define COLOR_CARD_BG     0x0841  // Data Card Background

// ==============================================================================================
//                                   DATA STRUCTURES
// ==============================================================================================
struct TelemetryData {
  uint16_t rpm;               // Engine Speed (0 - 8000 RPM)
  float    coolant_temp;      // Coolant Temperature in °C (-40 to +150°C)
  float    oil_temp;          // Engine Oil Temperature in °C
  float    battery_voltage;   // System Battery Voltage in Volts (0.0 - 16.0V)
  uint8_t  engine_load;       // Engine Calculated Load (0 - 100%)
  float    stft;              // Short-Term Fuel Trim (-100% to +99.2%)
  float    ltft;              // Long-Term Fuel Trim (-100% to +99.2%)
  float    intake_air_temp;   // Intake Air Temperature (IAT) in °C
  String   status;            // Operational Status ("NOMINAL", "WARNING", "CRITICAL", "TAMPER")
  uint8_t  severity;          // 0 = NOMINAL, 1 = WARNING, 2 = CRITICAL
  bool     tamper_detected;   // Anti-tamper trigger flag
  bool     using_sim_data;    // True if hardware CAN is offline & using simulator
};

// ==============================================================================================
//                                   GLOBAL INSTANCES & STATE
// ==============================================================================================
WiFiClient espClient;
PubSubClient mqttClient(espClient);

#if USE_ADAFRUIT_ST7735
  Adafruit_ST7735 tft = Adafruit_ST7735(TFT_CS, TFT_DC, TFT_RST);
#else
  TFT_eSPI tft = TFT_eSPI();
#endif

// System Telemetry Instance
TelemetryData telemetry;

// Timing Control Variables
unsigned long lastPublishTime  = 0;
unsigned long lastCANMsgTime   = 0;
unsigned long lastWifiCheck    = 0;
unsigned long lastFlashToggle  = 0;
bool flashState                = false;

// Connection State Flags
bool wifiConnected = false;
bool mqttConnected = false;
bool canDriverInstalled = false;

// Anti-Tamper Sliding Window
float   voltageHistory[TAMPER_WINDOW_SIZE];
uint8_t voltageHistoryIdx = 0;
bool    voltageHistoryFull = false;
bool    tamperTriggered = false;

// Display State Cache (To eliminate screen flicker during partial redraws)
uint16_t lastDrawnRpm       = 9999;
int16_t  lastDrawnCoolant   = -999;
int16_t  lastDrawnVoltage   = -999;
uint8_t  lastDrawnLoad      = 255;
uint8_t  lastDrawnSeverity  = 255;
String   lastDrawnStatus    = "";
bool     lastDrawnMqttState = false;

// ==============================================================================================
//                           OBD-II ACTIVE REQUEST CONFIGURATION
// ==============================================================================================
// The OBD-II protocol is REQUEST-RESPONSE. The ECU will NOT send data on its own.
// We must actively transmit a request frame (CAN ID 0x7DF, Mode 01 + PID) for each
// parameter we want, then listen for the ECU's response on CAN IDs 0x7E8-0x7EF.
// We cycle through all 7 PIDs, sending one request every 100ms (10 requests/sec).
// This gives us a full telemetry refresh approximately every 700ms.
// ----------------------------------------------------------------------------------------------

// PIDs to query in sequence (Mode 01 - Show Current Data)
const uint8_t OBD_REQUEST_PIDS[] = {
  0x0C,  // Engine RPM
  0x05,  // Coolant Temperature
  0x04,  // Calculated Engine Load
  0x0F,  // Intake Air Temperature
  0x42,  // Control Module Voltage (System/Battery Voltage)
  0x06,  // Short-Term Fuel Trim (Bank 1)
  0x07   // Long-Term Fuel Trim (Bank 1)
};
const uint8_t OBD_PID_COUNT = sizeof(OBD_REQUEST_PIDS) / sizeof(OBD_REQUEST_PIDS[0]);

// OBD-II Request Timing
const unsigned long OBD_REQUEST_INTERVAL_MS = 100;  // 100ms between each PID request
unsigned long lastOBDRequestTime = 0;
uint8_t       currentPIDIndex    = 0;  // Cycles 0 through OBD_PID_COUNT-1

// ==============================================================================================
//                                   FORWARD DECLARATIONS
// ==============================================================================================
void setupHardware();
void connectWiFi();
bool connectMQTT();
void mqttCallback(char* topic, byte* payload, unsigned int length);
void initCANBus();
void sendOBDRequest(uint8_t pid);
void cycleOBDRequests();
void readCANBus();
void simulateCANData();
void evaluateSystemHealth();
void checkAntiTamper(float currentVoltage);
void publishTelemetry();
void printTelemetrySerial();
void displayBootScreen();
void displayMainScreen(const TelemetryData& data);
void updateStatusBlock(const String& statusText, uint8_t severity);
void drawDataBlock(int16_t x, int16_t y, int16_t w, int16_t h, const char* label, const char* value, const char* unit, uint16_t color);

// ==============================================================================================
//                                       SETUP FUNCTION
// ==============================================================================================
void setup() {
  // 1. Initialize Serial Interface
  Serial.begin(115200);
  delay(200);

  // Print Startup Banner
  Serial.println(F("\n================================================================================"));
  Serial.println(F("              KOLLS AUTOTRONICS - VEHICLE HEALTH MONITOR v1.0"));
  Serial.println(F("              Commercial Telematics & Edge AI Diagnostics Node"));
  Serial.println(F("================================================================================"));
  Serial.printf("[INIT] Hardware Vehicle ID: %s\n", VEHICLE_ID);
  Serial.printf("[INIT] Free Heap Memory: %u bytes\n", ESP.getFreeHeap());

  // 2. Initialize TFT Display & Show Boot Screen
  Serial.println(F("[DISPLAY] Initializing 1.8\" ST7735 SPI Display..."));
#if USE_ADAFRUIT_ST7735
  tft.initR(INITR_BLACKTAB);   // Standard 1.8" ST7735R Black Tab
  tft.setRotation(0);          // 128x160 Portrait Mode
#else
  tft.init();
  tft.setRotation(0);
#endif
  displayBootScreen();

  // 3. Initialize Voltage History Buffer for Anti-Tamper
  for (int i = 0; i < TAMPER_WINDOW_SIZE; i++) {
    voltageHistory[i] = 12.6f;
  }

  // 4. Connect to WiFi Network (Retry logic: max 20 attempts @ 500ms)
  connectWiFi();

  // 5. Initialize MQTT Client
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(512); // Ensure buffer accommodates complete JSON payload

  // 6. Initialize TWAI / CAN Bus Controller at 500kbps
  initCANBus();

  // 7. Seed Random Generator for realistic fallback simulation
  randomSeed(esp_random());

  // 8. Initialize default Telemetry values
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

  // Clear display and prepare static layout
  tft.fillScreen(COLOR_BLACK);
  updateStatusBlock("NOMINAL", 0);

  // 9. Print Initialization Summary
  Serial.println(F("--------------------------------------------------------------------------------"));
  Serial.println(F("[INIT] Initialization Complete. Entering Real-Time Telematics Loop."));
  Serial.printf("[INIT] Telemetry Publish Cadence: %lu ms | MQTT Topic: %s\n", TELEMETRY_INTERVAL_MS, MQTT_TOPIC);
  Serial.println(F("================================================================================\n"));
}

// ==============================================================================================
//                                        MAIN LOOP
// ==============================================================================================
void loop() {
  unsigned long currentMillis = millis();

  // 1. Maintain WiFi Connection
  if (WiFi.status() != WL_CONNECTED) {
    wifiConnected = false;
    if (currentMillis - lastWifiCheck > WIFI_RETRY_INTERVAL) {
      lastWifiCheck = currentMillis;
      Serial.println(F("[WiFi] Connection dropped! Attempting background reconnect..."));
      WiFi.reconnect();
    }
  } else {
    wifiConnected = true;
  }

  // 2. Maintain MQTT Connection
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

  // 3. Send OBD-II PID Requests (Active Polling)
  // OBD-II is request-response: we must ASK the ECU for each sensor reading.
  // This cycles through RPM, Coolant, Load, IAT, Voltage, STFT, LTFT at 100ms intervals.
  cycleOBDRequests();

  // 4. Poll Real CAN Bus for ECU Responses
  readCANBus();

  // If no hardware CAN messages have arrived within timeout, switch to simulated feed
  if (currentMillis - lastCANMsgTime > CAN_TIMEOUT_MS) {
    telemetry.using_sim_data = true;
    simulateCANData();
  } else {
    telemetry.using_sim_data = false;
  }

  // 4. Execute Anti-Tamper & Health Analysis Logic
  checkAntiTamper(telemetry.battery_voltage);
  evaluateSystemHealth();

  // 5. Periodic 2-Second Telematics Task
  if (currentMillis - lastPublishTime >= TELEMETRY_INTERVAL_MS) {
    lastPublishTime = currentMillis;

    // a. Publish JSON Telemetry to MQTT
    if (mqttConnected) {
      publishTelemetry();
    }

    // b. Print Formatted Data to Serial Monitor
    printTelemetrySerial();

    // c. Update ST7735 Graphical Dashboard
    displayMainScreen(telemetry);
  }

  // 6. Handle Critical / Tamper Display Blinking
  if (telemetry.severity == 2) {
    if (currentMillis - lastFlashToggle >= 350) {
      lastFlashToggle = currentMillis;
      flashState = !flashState;
      // Force redrawing status block during blink
      lastDrawnSeverity = 255;
      updateStatusBlock(telemetry.status, telemetry.severity);
    }
  }

  // Non-blocking yield to ESP32 RTOS background tasks
  yield();
}

// ==============================================================================================
//                                   CAN / TWAI BUS FUNCTIONS
// ==============================================================================================

/**
 * @brief Initializes the ESP32 built-in Two-Wire Automotive Interface (TWAI/CAN)
 * Configured for standard ISO 11898-2 500kbps High-Speed CAN Bus.
 */
void initCANBus() {
  Serial.println(F("[CAN] Configuring TWAI / CAN Bus Controller..."));
  Serial.printf("[CAN] Pin Mapping -> TX: GPIO %d, RX: GPIO %d\n", CAN_TX_PIN, CAN_RX_PIN);

  // Configure TWAI general driver options
  twai_general_config_t g_config = TWAI_GENERAL_CONFIG_DEFAULT(CAN_TX_PIN, CAN_RX_PIN, TWAI_MODE_NORMAL);
  g_config.rx_queue_len = 16;
  g_config.tx_queue_len = 5;

  // Set bit rate to 500 kbps (Standard Heavy Duty / OBD-II bit rate)
  twai_timing_config_t t_config = TWAI_TIMING_CONFIG_500KBITS();

  // Filter configuration: Accept all standard and extended identifiers
  twai_filter_config_t f_config = TWAI_FILTER_CONFIG_ACCEPT_ALL();

  // Install the TWAI driver
  esp_err_t installErr = twai_driver_install(&g_config, &t_config, &f_config);
  if (installErr == ESP_OK) {
    // Start TWAI driver
    esp_err_t startErr = twai_start();
    if (startErr == ESP_OK) {
      canDriverInstalled = true;
      Serial.println(F("[CAN] TWAI driver installed & started successfully at 500kbps."));
    } else {
      Serial.printf("[CAN] ERROR: Failed to start TWAI driver (Code: 0x%X)\n", startErr);
      canDriverInstalled = false;
    }
  } else {
    Serial.printf("[CAN] ERROR: Failed to install TWAI driver (Code: 0x%X). Using Simulator.\n", installErr);
    canDriverInstalled = false;
  }
}

/**
 * @brief Sends an OBD-II Mode 01 PID request to the vehicle ECU.
 * Transmits a standard 8-byte CAN frame to broadcast address 0x7DF.
 * The ECU will respond on CAN ID 0x7E8 (or 0x7E8-0x7EF for multi-ECU vehicles).
 *
 * OBD-II Request Frame Format:
 *   Byte 0: Number of additional data bytes (always 0x02 for Mode 01 single PID)
 *   Byte 1: Mode (0x01 = Show Current Data)
 *   Byte 2: PID number to request
 *   Bytes 3-7: Padding (0x00 or 0x55 per ISO 15765-4)
 *
 * @param pid The OBD-II PID to request (e.g., 0x0C for RPM, 0x05 for Coolant Temp)
 */
void sendOBDRequest(uint8_t pid) {
  if (!canDriverInstalled) return;

  twai_message_t txMessage;
  txMessage.identifier   = 0x7DF;    // OBD-II broadcast request address
  txMessage.extd         = 0;        // Standard 11-bit identifier (not extended 29-bit)
  txMessage.rtr          = 0;        // Data frame (not Remote Transmission Request)
  txMessage.data_length_code = 8;    // Always 8 bytes per ISO 15765-4

  // Build the OBD-II request payload
  txMessage.data[0] = 0x02;  // Number of additional data bytes following
  txMessage.data[1] = 0x01;  // Mode 01: Show Current Data
  txMessage.data[2] = pid;   // The specific PID we're requesting
  txMessage.data[3] = 0x00;  // Padding
  txMessage.data[4] = 0x00;  // Padding
  txMessage.data[5] = 0x00;  // Padding
  txMessage.data[6] = 0x00;  // Padding
  txMessage.data[7] = 0x00;  // Padding

  // Transmit with 10ms timeout (non-blocking for real-time loop)
  esp_err_t result = twai_transmit(&txMessage, pdMS_TO_TICKS(10));
  if (result != ESP_OK) {
    Serial.printf("[CAN] OBD-II request failed for PID 0x%02X (err: 0x%X)\n", pid, result);
  }
}

/**
 * @brief Cycles through all configured OBD-II PIDs, sending one request every 100ms.
 * This ensures we don't flood the CAN bus while still getting fresh data for all parameters.
 * Full cycle through 7 PIDs takes ~700ms → approx 1.4 full refreshes per 2-second publish interval.
 */
void cycleOBDRequests() {
  if (!canDriverInstalled) return;

  unsigned long now = millis();
  if (now - lastOBDRequestTime >= OBD_REQUEST_INTERVAL_MS) {
    lastOBDRequestTime = now;

    // Send request for the current PID in the rotation
    sendOBDRequest(OBD_REQUEST_PIDS[currentPIDIndex]);

    // Advance to next PID (wrap around)
    currentPIDIndex = (currentPIDIndex + 1) % OBD_PID_COUNT;
  }
}

/**
 * @brief Non-blocking read of CAN / TWAI messages.
 * Decodes standard OBD-II Mode 01 diagnostic response frames (IDs 0x7E8 to 0x7EF).
 */
void readCANBus() {
  if (!canDriverInstalled) return;

  twai_message_t rxMessage;
  // Non-blocking poll (timeout = 0 ticks)
  while (twai_receive(&rxMessage, 0) == ESP_OK) {
    lastCANMsgTime = millis(); // Refresh hardware activity timestamp

    // Check for Standard 11-bit OBD-II ECU response IDs (0x7E8 through 0x7EF)
    if (rxMessage.identifier >= 0x7E8 && rxMessage.identifier <= 0x7EF) {
      // Byte 0 = Number of additional data bytes
      // Byte 1 = Mode (0x41 is response to Mode 01 Show Current Data)
      if (rxMessage.data_length_code >= 3 && rxMessage.data[1] == 0x41) {
        uint8_t pid = rxMessage.data[2];
        uint8_t a   = rxMessage.data[3];
        uint8_t b   = (rxMessage.data_length_code > 4) ? rxMessage.data[4] : 0;

        switch (pid) {
          // PID 0x0C: Engine RPM -> Formula: ((A * 256) + B) / 4
          case 0x0C:
            telemetry.rpm = (uint16_t)(((a * 256) + b) / 4);
            break;

          // PID 0x05: Engine Coolant Temperature -> Formula: A - 40
          case 0x05:
            telemetry.coolant_temp = (float)(a - 40);
            break;

          // PID 0x04: Calculated Engine Load -> Formula: (A * 100) / 255
          case 0x04:
            telemetry.engine_load = (uint8_t)((a * 100) / 255);
            break;

          // PID 0x0F: Intake Air Temperature (IAT) -> Formula: A - 40
          case 0x0F:
            telemetry.intake_air_temp = (float)(a - 40);
            break;

          // PID 0x42: Control Module / System Voltage -> Formula: ((A * 256) + B) / 1000.0
          case 0x42:
            telemetry.battery_voltage = (float)(((a * 256) + b) / 1000.0f);
            break;

          // PID 0x06: Short Term Fuel Trim Bank 1 -> Formula: ((A - 128) * 100) / 128
          case 0x06:
            telemetry.stft = (float)((a - 128) * 100.0f / 128.0f);
            break;

          // PID 0x07: Long Term Fuel Trim Bank 1 -> Formula: ((A - 128) * 100) / 128
          case 0x07:
            telemetry.ltft = (float)((a - 128) * 100.0f / 128.0f);
            break;

          default:
            // Unhandled PID
            break;
        }
      }
    }
  }
}

/**
 * @brief Generates realistic vehicle physics and engine telemetry when bench testing
 * or when the vehicle CAN bus is disconnected.
 */
void simulateCANData() {
  unsigned long now = millis();

  // 1. Smooth sinusoidal RPM curve between 800 (idle) and 3500 (cruising)
  float rpmPhase = (float)(now % 16000) / 16000.0f * 2.0f * PI;
  float normalizedRpm = (sin(rpmPhase) + 1.0f) * 0.5f; // Range: 0.0 to 1.0
  telemetry.rpm = 800 + (uint16_t)(normalizedRpm * 2700.0f) + random(-25, 26);

  // 2. Engine load tightly correlated with RPM (20% to 75%)
  telemetry.engine_load = (uint8_t)(20 + (normalizedRpm * 55.0f)) + random(-2, 3);
  if (telemetry.engine_load > 100) telemetry.engine_load = 100;

  // 3. Coolant temperature slow drift between 78°C and 94°C
  float tempPhase = (float)(now % 60000) / 60000.0f * 2.0f * PI;
  telemetry.coolant_temp = 85.0f + (sin(tempPhase) * 8.0f) + ((float)random(-5, 6) / 10.0f);

  // 4. Engine oil temp follows coolant with slight positive offset (88°C - 102°C)
  telemetry.oil_temp = telemetry.coolant_temp + 7.5f + ((float)random(-3, 4) / 10.0f);

  // 5. System voltage with alternator ripple (13.6V to 14.2V nominal)
  telemetry.battery_voltage = 13.8f + (sin(rpmPhase * 2.0f) * 0.25f) + ((float)random(-10, 11) / 100.0f);

  // 6. Fuel trims centered near zero with slight stochastic wander
  telemetry.stft = (sin((float)(now % 8000) / 8000.0f * 2.0f * PI) * 2.5f) + ((float)random(-8, 9) / 10.0f);
  telemetry.ltft = (cos((float)(now % 24000) / 24000.0f * 2.0f * PI) * 1.5f);

  // 7. Intake Air Temperature (ambient drift)
  telemetry.intake_air_temp = 29.5f + (sin((float)(now % 45000) / 45000.0f * 2.0f * PI) * 3.0f);

  // --------------------------------------------------------------------------------------------
  // Periodic Bench Demo Anomaly Injection (Occurs every ~35 seconds for 6 seconds)
  // Demonstrates edge diagnostic alerts without needing a damaged vehicle!
  // --------------------------------------------------------------------------------------------
  unsigned long cycleSec = (now / 1000) % 75;

  if (cycleSec >= 30 && cycleSec < 36) {
    // Inject Coolant Overheat Warning Anomaly
    telemetry.coolant_temp = 103.8f;
    telemetry.status       = "COOLANT OVERHEAT";
    telemetry.severity     = 1;
  } else if (cycleSec >= 60 && cycleSec < 66) {
    // Inject High RPM / Stress Warning
    telemetry.rpm          = 4650;
    telemetry.engine_load  = 88;
    telemetry.status       = "HIGH ENGINE STRESS";
    telemetry.severity     = 1;
  }
}

// ==============================================================================================
//                                   HEALTH & ANTI-TAMPER LOGIC
// ==============================================================================================

/**
 * @brief Sliding window anti-tamper detector. Detects abrupt battery voltage drops
 * characteristic of the telematics dongle being pulled out of the vehicle OBD-II port.
 */
void checkAntiTamper(float currentVoltage) {
  // Push current voltage into circular sliding window
  voltageHistory[voltageHistoryIdx] = currentVoltage;
  voltageHistoryIdx = (voltageHistoryIdx + 1) % TAMPER_WINDOW_SIZE;

  // Retrieve previous 2 readings for transient slope evaluation
  uint8_t prevIdx1 = (voltageHistoryIdx + TAMPER_WINDOW_SIZE - 2) % TAMPER_WINDOW_SIZE;
  uint8_t prevIdx2 = (voltageHistoryIdx + TAMPER_WINDOW_SIZE - 3) % TAMPER_WINDOW_SIZE;
  float recentMaxVolt = max(voltageHistory[prevIdx1], voltageHistory[prevIdx2]);

  // Anti-tamper condition: Sudden drop from normal vehicle operating voltage (>12V)
  // to power disconnect / internal capacitor discharge voltage (<10V)
  if (recentMaxVolt >= TAMPER_VOLT_HIGH_THRES && currentVoltage < TAMPER_VOLT_LOW_THRES) {
    tamperTriggered           = true;
    telemetry.tamper_detected = true;
    telemetry.status          = "POWER TAMPER";
    telemetry.severity        = 2; // CRITICAL

    Serial.println(F("\n********************************************************************************"));
    Serial.printf("[SECURITY ALERT] TAMPER DETECTED! Voltage plummeted from %.2fV to %.2fV!\n", recentMaxVolt, currentVoltage);
    Serial.println(F("[SECURITY ALERT] OBD-II Dongle Disconnection or Power Tamper Event Logged!"));
    Serial.println(F("********************************************************************************\n"));
  }
}

/**
 * @brief Evaluates overall vehicle parameter thresholds to set system severity.
 */
void evaluateSystemHealth() {
  // If anti-tamper has triggered, retain CRITICAL priority until power cycle or reset
  if (telemetry.tamper_detected) {
    telemetry.status   = "POWER TAMPER";
    telemetry.severity = 2;
    return;
  }

  // Priority 1: Critical Overheat Condition
  if (telemetry.coolant_temp >= 106.0f) {
    telemetry.status   = "ENGINE OVERHEAT";
    telemetry.severity = 2;
    return;
  }

  // Priority 2: Coolant Warning Condition
  if (telemetry.coolant_temp >= 95.0f) {
    telemetry.status   = "COOLANT HIGH";
    telemetry.severity = 1;
    return;
  }

  // Priority 3: Low Battery System Voltage
  if (telemetry.battery_voltage < WARNING_VOLT_THRES && telemetry.battery_voltage >= TAMPER_VOLT_LOW_THRES) {
    telemetry.status   = "LOW BATTERY";
    telemetry.severity = 1;
    return;
  }

  // Priority 4: High RPM Limit
  if (telemetry.rpm >= 4500) {
    telemetry.status   = "RPM REDLINE";
    telemetry.severity = 1;
    return;
  }

  // Default: System operating within normal thresholds
  telemetry.status   = "NOMINAL";
  telemetry.severity = 0;
}

// ==============================================================================================
//                                   NETWORKING & MQTT
// ==============================================================================================

/**
 * @brief Connects to WiFi network with timeout and status visualizer.
 */
void connectWiFi() {
  Serial.print(F("[WiFi] Connecting to SSID: "));
  Serial.print(WIFI_SSID);

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
    Serial.printf("[WiFi] Assigned IP Address: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("[WiFi] Signal Strength (RSSI): %d dBm\n", WiFi.RSSI());
  } else {
    wifiConnected = false;
    Serial.println(F(" TIMEOUT!"));
    Serial.println(F("[WiFi] Operating in standalone / offline diagnostic mode."));
  }
}

/**
 * @brief Establishes MQTT broker connection with unique randomized client ID.
 */
bool connectMQTT() {
  if (!wifiConnected) return false;

  uint8_t retries = 0;
  while (!mqttClient.connected() && retries < MQTT_MAX_BOOT_RETRIES) {
    String clientId = "KollsAutoTronics_" + String(VEHICLE_ID) + "_" + String(random(0x1000, 0xFFFF), HEX);
    Serial.printf("[MQTT] Connecting to %s:%d as %s... ", MQTT_BROKER, MQTT_PORT, clientId.c_str());

    if (mqttClient.connect(clientId.c_str())) {
      Serial.println(F("CONNECTED!"));
      mqttConnected = true;

      // Subscribe to bidirectional vehicle command topic for remote diagnostics
      String cmdTopic = String("kolls/vehicle/") + VEHICLE_ID + "/commands";
      mqttClient.subscribe(cmdTopic.c_str());
      return true;
    } else {
      Serial.printf("FAILED (rc=%d). Retrying...\n", mqttClient.state());
      retries++;
      delay(400);
    }
  }
  return false;
}

/**
 * @brief MQTT incoming message callback handler.
 */
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.print(F("[MQTT CMD] Incoming message on topic: "));
  Serial.println(topic);

  // Convert payload to null-terminated string
  char messageBuffer[128];
  unsigned int copyLen = min(length, (unsigned int)(sizeof(messageBuffer) - 1));
  memcpy(messageBuffer, payload, copyLen);
  messageBuffer[copyLen] = '\0';

  Serial.printf("[MQTT CMD] Payload: %s\n", messageBuffer);

  // Remote Diagnostic Command Execution Placeholder
  if (strstr(messageBuffer, "PING") != NULL) {
    mqttClient.publish("kolls/vehicle/telemetry", "{\"response\":\"PONG\",\"status\":\"ONLINE\"}");
  } else if (strstr(messageBuffer, "RESET_TAMPER") != NULL) {
    tamperTriggered = false;
    telemetry.tamper_detected = false;
    telemetry.status = "NOMINAL";
    telemetry.severity = 0;
    Serial.println(F("[SECURITY] Tamper latch cleared via authorized remote command."));
  }
}

/**
 * @brief Serializes complete telematics document to JSON and publishes to MQTT.
 */
void publishTelemetry() {
  // ArduinoJson v6 and v7 compatibility wrapper
#if ARDUINOJSON_VERSION_MAJOR >= 7
  JsonDocument doc;
#else
  StaticJsonDocument<512> doc;
#endif

  // Populate Telematics JSON Schema
  doc["vehicle_id"]      = VEHICLE_ID;
  doc["timestamp_ms"]    = millis();
  doc["uptime_sec"]      = millis() / 1000;
  doc["can_feed"]        = telemetry.using_sim_data ? "SIMULATED" : "HARDWARE_CAN";

  // Engine Performance Metrics
  JsonObject metrics = doc.createNestedObject("metrics");
  metrics["rpm"]         = telemetry.rpm;
  metrics["coolant_c"]   = serialized(String(telemetry.coolant_temp, 1));
  metrics["oil_c"]       = serialized(String(telemetry.oil_temp, 1));
  metrics["battery_v"]   = serialized(String(telemetry.battery_voltage, 2));
  metrics["load_pct"]    = telemetry.engine_load;
  metrics["stft_pct"]    = serialized(String(telemetry.stft, 1));
  metrics["ltft_pct"]    = serialized(String(telemetry.ltft, 1));
  metrics["iat_c"]       = serialized(String(telemetry.intake_air_temp, 1));

  // Diagnostic Status & Health
  JsonObject diag = doc.createNestedObject("diagnostics");
  diag["status"]         = telemetry.status;
  diag["severity"]       = telemetry.severity;
  diag["tamper_alert"]   = telemetry.tamper_detected;

  // Serialize to character buffer
  char jsonBuffer[512];
  size_t bytesWritten = serializeJson(doc, jsonBuffer, sizeof(jsonBuffer));

  // Publish to broker
  if (mqttClient.publish(MQTT_TOPIC, jsonBuffer, bytesWritten)) {
    // Successfully published
  } else {
    Serial.println(F("[MQTT] WARNING: Telemetry publish packet failed!"));
  }
}

// ==============================================================================================
//                                   SERIAL MONITOR LOGGING
// ==============================================================================================
void printTelemetrySerial() {
  unsigned long uptime = millis() / 1000;

  Serial.println(F("================================================================================"));
  Serial.printf("[KOLLS TELEMETRY] Uptime: %02luh %02lum %02lus | ID: %s | Mode: %s\n",
                uptime / 3600, (uptime % 3600) / 60, uptime % 60,
                VEHICLE_ID,
                telemetry.using_sim_data ? "SIMULATOR" : "HARDWARE CAN");
  Serial.println(F("--------------------------------------------------------------------------------"));
  Serial.printf("  ENGINE RPM  : %4u RPM     |  COOLANT TEMP : %5.1f °C  |  OIL TEMP   : %5.1f °C\n",
                telemetry.rpm, telemetry.coolant_temp, telemetry.oil_temp);
  Serial.printf("  ENGINE LOAD : %3u %%       |  SYS VOLTAGE  : %5.2f V   |  INTAKE AIR : %5.1f °C\n",
                telemetry.engine_load, telemetry.battery_voltage, telemetry.intake_air_temp);
  Serial.printf("  SHORT TRIM  : %+5.1f %%     |  LONG TRIM    : %+5.1f %%  |  HEALTH     : %s (Sev %u)\n",
                telemetry.stft, telemetry.ltft, telemetry.status.c_str(), telemetry.severity);
  Serial.printf("  WIFI STATE  : %-11s |  MQTT BROKER  : %-9s |  TAMPER DET : %s\n",
                wifiConnected ? "CONNECTED" : "OFFLINE",
                mqttConnected ? "CONNECTED" : "DISCONN",
                telemetry.tamper_detected ? "TRIGGERED (ALERT!)" : "NOMINAL");
  Serial.println(F("================================================================================\n"));
}

// ==============================================================================================
//                                   TFT DISPLAY FUNCTIONS (ST7735 128x160)
// ==============================================================================================

/**
 * @brief Renders the Kolls Autotronics startup brand splash screen with animated loading bar.
 */
void displayBootScreen() {
  tft.fillScreen(COLOR_BLACK);

  // 1. Kolls Autotronics Branding Header
  tft.setTextWrap(false);
  tft.setTextColor(COLOR_CYAN);
  tft.setTextSize(3);
  tft.setCursor(18, 24);
  tft.print(F("KOLLS"));

  tft.setTextColor(COLOR_WHITE);
  tft.setTextSize(1);
  tft.setCursor(29, 52);
  tft.print(F("AUTOTRONICS"));

  // Decorative Accent Line
  tft.drawFastHLine(14, 66, 100, COLOR_KOLLS_BLUE);

  // Subtitle
  tft.setTextColor(COLOR_GRAY);
  tft.setTextSize(1);
  tft.setCursor(6, 76);
  tft.print(F("Vehicle Health Monitor"));

  // 2. Animated Progress Bar
  const int16_t barX = 14;
  const int16_t barY = 104;
  const int16_t barW = 100;
  const int16_t barH = 10;

  tft.drawRect(barX, barY, barW, barH, COLOR_WHITE);

  for (int16_t i = 0; i <= (barW - 4); i += 4) {
    tft.fillRect(barX + 2, barY + 2, i, barH - 4, COLOR_CYAN);
    delay(25);
  }

  // 3. Firmware Version Footnote
  tft.setTextColor(COLOR_GRAY);
  tft.setTextSize(1);
  tft.setCursor(18, 134);
  tft.print(F("v1.0 - IoT CAN Node"));

  delay(900); // Hold splash screen for visual impact
}

/**
 * @brief Modular helper that renders a single geometric card block with borders,
 * label, dynamic value, and engineering units. Uses localized redraw to prevent flicker.
 */
void drawDataBlock(int16_t x, int16_t y, int16_t w, int16_t h,
                   const char* label, const char* value, const char* unit,
                   uint16_t color) {
  // Draw subtle geometric card frame
  tft.drawRect(x, y, w, h, COLOR_DARK_GRAY);

  // Draw small label
  tft.setTextColor(COLOR_GRAY, COLOR_BLACK);
  tft.setTextSize(1);
  tft.setCursor(x + 4, y + 4);
  tft.print(label);

  // Clear previous value area within this block to prevent flicker
  tft.fillRect(x + 48, y + 2, w - 50, h - 4, COLOR_BLACK);

  // Draw primary value in accented color
  tft.setTextColor(color, COLOR_BLACK);
  tft.setTextSize(2);
  tft.setCursor(x + 50, y + 3);
  tft.print(value);

  // Draw optional engineering unit
  if (unit != NULL && strlen(unit) > 0) {
    tft.setTextColor(COLOR_GRAY, COLOR_BLACK);
    tft.setTextSize(1);
    tft.setCursor(x + w - 14, y + 5);
    tft.print(unit);
  }
}

/**
 * @brief Renders the complete live running telematics dashboard on the 128x160 ST7735 screen.
 * Layout partitioned into:
 *   - TOP SECTION    (y: 0 - 24):   Header & Real-time Network Indicator
 *   - MIDDLE SECTION (y: 25 - 119): Four Geometric Diagnostic Gauges
 *   - BOTTOM SECTION (y: 120 - 159): Status Bar with Nominal/Warning/Tamper Visuals
 */
void displayMainScreen(const TelemetryData& data) {
  // ============================================================================================
  // TOP SECTION (y: 0 - 24): BRAND HEADER & MQTT STATUS ICON
  // ============================================================================================
  tft.setTextWrap(false);
  tft.setTextColor(COLOR_CYAN, COLOR_BLACK);
  tft.setTextSize(1);
  tft.setCursor(4, 7);
  tft.print(F("KOLLS DYNAMICS"));

  // Right-aligned MQTT connection icon: Green circle = Connected, Red circle = Offline
  uint16_t mqttColor = mqttConnected ? COLOR_GREEN : COLOR_RED;
  if (mqttConnected != lastDrawnMqttState) {
    tft.fillCircle(118, 10, 4, mqttColor);
    lastDrawnMqttState = mqttConnected;
  }

  // Thin separator line between header and data blocks
  tft.drawFastHLine(0, 22, 128, COLOR_CYAN);

  // ============================================================================================
  // MIDDLE SECTION (y: 25 - 119): FOUR DATA BLOCKS WITH GEOMETRIC BORDERS
  // ============================================================================================

  // --------------------------------------------------------------------------------------------
  // BLOCK 1: ENGINE RPM (y: 24, h: 23)
  // Large prominent bold font colored by operational threshold
  // --------------------------------------------------------------------------------------------
  uint16_t rpmColor = COLOR_WHITE;
  if (data.rpm < 3000) {
    rpmColor = COLOR_GREEN;
  } else if (data.rpm < 4500) {
    rpmColor = COLOR_YELLOW;
  } else {
    rpmColor = COLOR_RED;
  }

  if (data.rpm != lastDrawnRpm) {
    // Redraw RPM Block frame
    tft.drawRect(2, 24, 124, 23, COLOR_DARK_GRAY);

    tft.setTextColor(COLOR_GRAY, COLOR_BLACK);
    tft.setTextSize(1);
    tft.setCursor(6, 27);
    tft.print(F("RPM"));

    // Overwrite previous RPM value area
    tft.fillRect(44, 25, 78, 20, COLOR_BLACK);

    // Format right-aligned 4-digit RPM
    char rpmBuf[8];
    snprintf(rpmBuf, sizeof(rpmBuf), "%4u", data.rpm);

    // Large Size 2 font (crisp and perfectly fitted within 23px block)
    tft.setTextColor(rpmColor, COLOR_BLACK);
    tft.setTextSize(2);
    tft.setCursor(50, 26);
    tft.print(rpmBuf);

    lastDrawnRpm = data.rpm;
  }

  // --------------------------------------------------------------------------------------------
  // BLOCK 2: ENGINE COOLANT TEMPERATURE (y: 48, h: 23)
  // Range: Green (<90°C), Yellow (90-100°C), Red (>100°C)
  // --------------------------------------------------------------------------------------------
  uint16_t coolantColor = COLOR_GREEN;
  if (data.coolant_temp >= 100.0f) {
    coolantColor = COLOR_RED;
  } else if (data.coolant_temp >= 90.0f) {
    coolantColor = COLOR_YELLOW;
  }

  int16_t currentCoolantInt = (int16_t)(data.coolant_temp * 10);
  if (currentCoolantInt != lastDrawnCoolant) {
    char coolantBuf[8];
    snprintf(coolantBuf, sizeof(coolantBuf), "%.1f", data.coolant_temp);
    drawDataBlock(2, 48, 124, 23, "COOLANT", coolantBuf, "C", coolantColor);
    lastDrawnCoolant = currentCoolantInt;
  }

  // --------------------------------------------------------------------------------------------
  // BLOCK 3: SYSTEM VOLTAGE (y: 72, h: 23)
  // Range: Green (>12.4V), Yellow (11.8 - 12.4V), Red (<11.8V)
  // --------------------------------------------------------------------------------------------
  uint16_t voltColor = COLOR_GREEN;
  if (data.battery_voltage < 11.8f) {
    voltColor = COLOR_RED;
  } else if (data.battery_voltage <= 12.4f) {
    voltColor = COLOR_YELLOW;
  }

  int16_t currentVoltInt = (int16_t)(data.battery_voltage * 10);
  if (currentVoltInt != lastDrawnVoltage) {
    char voltBuf[8];
    snprintf(voltBuf, sizeof(voltBuf), "%.1f", data.battery_voltage);
    drawDataBlock(2, 72, 124, 23, "SYS VOLT", voltBuf, "V", voltColor);
    lastDrawnVoltage = currentVoltInt;
  }

  // --------------------------------------------------------------------------------------------
  // BLOCK 4: ENGINE CALCULATED LOAD (y: 96, h: 23)
  // Range: Green (<50%), Yellow (50-80%), Red (>80%)
  // --------------------------------------------------------------------------------------------
  uint16_t loadColor = COLOR_GREEN;
  if (data.engine_load > 80) {
    loadColor = COLOR_RED;
  } else if (data.engine_load >= 50) {
    loadColor = COLOR_YELLOW;
  }

  if (data.engine_load != lastDrawnLoad) {
    char loadBuf[8];
    snprintf(loadBuf, sizeof(loadBuf), "%u", data.engine_load);
    drawDataBlock(2, 96, 124, 23, "LOAD %", loadBuf, "%", loadColor);
    lastDrawnLoad = data.engine_load;
  }

  // ============================================================================================
  // BOTTOM SECTION (y: 120 - 159): STATUS BLOCK
  // ============================================================================================
  updateStatusBlock(data.status, data.severity);
}

/**
 * @brief Updates the bottom status block with color-coded operational modes and flashing alerts.
 *  - Severity 0 = NOMINAL   (Solid Green card, Black bold text)
 *  - Severity 1 = WARNING   (Solid Yellow card, Black text with warning message)
 *  - Severity 2 = CRITICAL  (Flashing Red/Dark Red card, White text, Anti-Tamper notification)
 */
void updateStatusBlock(const String& statusText, uint8_t severity) {
  // Check if status block requires redraw
  if (severity == lastDrawnSeverity && statusText == lastDrawnStatus && severity != 2) {
    return; // No redraw required, preserving display performance
  }

  lastDrawnSeverity = severity;
  lastDrawnStatus   = statusText;

  const int16_t boxX = 2;
  const int16_t boxY = 121;
  const int16_t boxW = 124;
  const int16_t boxH = 37;

  // --------------------------------------------------------------------------------------------
  // SEVERITY 0: NOMINAL
  // --------------------------------------------------------------------------------------------
  if (severity == 0) {
    tft.fillRect(boxX, boxY, boxW, boxH, COLOR_GREEN);

    tft.setTextColor(COLOR_BLACK);
    tft.setTextSize(2);
    tft.setCursor(boxX + 22, boxY + 6);
    tft.print(F("NOMINAL"));

    tft.setTextSize(1);
    tft.setCursor(boxX + 18, boxY + 24);
    tft.print(F("ALL SYSTEMS OK"));
  }
  // --------------------------------------------------------------------------------------------
  // SEVERITY 1: WARNING
  // --------------------------------------------------------------------------------------------
  else if (severity == 1) {
    tft.fillRect(boxX, boxY, boxW, boxH, COLOR_YELLOW);

    tft.setTextColor(COLOR_BLACK);
    tft.setTextSize(2);
    tft.setCursor(boxX + 20, boxY + 5);
    tft.print(F("WARNING"));

    // Subtext: specific alert message
    tft.setTextSize(1);
    int16_t textLen = statusText.length();
    int16_t startX = boxX + max(2, (124 - (textLen * 6)) / 2);
    tft.setCursor(startX, boxY + 24);
    tft.print(statusText);
  }
  // --------------------------------------------------------------------------------------------
  // SEVERITY 2: CRITICAL / ANTI-TAMPER (Flashing state)
  // --------------------------------------------------------------------------------------------
  else {
    uint16_t bgCol = flashState ? COLOR_RED : COLOR_BLACK;
    uint16_t fgCol = flashState ? COLOR_WHITE : COLOR_RED;

    tft.fillRect(boxX, boxY, boxW, boxH, bgCol);
    tft.drawRect(boxX, boxY, boxW, boxH, COLOR_RED);

    tft.setTextColor(fgCol);
    tft.setTextSize(2);

    if (telemetry.tamper_detected) {
      tft.setCursor(boxX + 18, boxY + 5);
      tft.print(F("TAMPER!"));

      tft.setTextSize(1);
      tft.setCursor(boxX + 8, boxY + 24);
      tft.print(F("POWER DISCONNECT"));
    } else {
      tft.setCursor(boxX + 16, boxY + 5);
      tft.print(F("CRITICAL"));

      tft.setTextSize(1);
      int16_t textLen = statusText.length();
      int16_t startX = boxX + max(2, (124 - (textLen * 6)) / 2);
      tft.setCursor(startX, boxY + 24);
      tft.print(statusText);
    }
  }
}
