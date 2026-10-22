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
 *                    - Optional 1.14" 135x240 ST7789 TFT live gauge display (compile-time toggle)
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
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include "driver/twai.h"
#include "driver/gpio.h"

#define USE_TFT 1                 // Set 0 for a bare telemetry node (no display attached)
#define DEVICE_BATT_MONITOR 1     // Set 0 if no ADC divider is wired yet

#if USE_TFT
  #include <SPI.h>
  #include <Adafruit_GFX.h>
  #include <Adafruit_ST7735.h>
    #include <Fonts/FreeSansBold9pt7b.h>
  #include <Fonts/FreeSansBold18pt7b.h>
#endif
#include <ArduinoOTA.h>

// ==============================================================================================
//                                   CONFIGURATION
// ==============================================================================================
// Network & telematics endpoint (the "backend endpoint" consumed by the web dashboard app).
// EMQX Serverless over TLS (8883) - works from a phone hotspot with no laptop/server.
const char* WIFI_SSID     = "ORION";
const char* WIFI_PASS     = "12345678";
const char* MQTT_BROKER   = "l90668f6.ala.us-east-1.emqxsl.com";
const int   MQTT_PORT     = 8883;
const char* MQTT_USER     = "orionx";
const char* MQTT_PASS     = "samuel123";
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
#define BUZZER_PIN 27           // active buzzer: + to GPIO27, - to GND

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
// TFT display pins (1.14" 135x240 ST7789 SPI)
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
  bool     connected;          // false = no ADC divider fitted (pack value unknown)
  bool     device_critical;    // below critical threshold
  bool     obd_detached;       // latched: was receiving OBD data, then went silent
  uint16_t disconnect_count;   // total OBD dropout events since boot
  bool     everSawOBD;         // have we EVER decoded a Mode-01 response?
};

// ---------------------------------------------------------------------------------
// Location: IP geolocation (city level) OR a position pushed by the browser app
// (real device GPS). Published in every payload as a "location" object.
// ---------------------------------------------------------------------------------
struct LocationState {
  bool     valid;              // do we have usable coordinates?
  char     source[8];          // "ip" | "app" | "gps"
  double   lat;
  double   lon;
  float    speed_kmh;
  float    alt_m;
  uint8_t  sats;               // satellites (app-pushed) / 0 for IP geo
  uint8_t  fix;                // 0 = no fix, 1 = GPS, 2 = DGPS
  uint32_t updated_ms;
  char     city[28];
  char     country[24];
};

// ==============================================================================================
//                                   GLOBAL STATE
// ==============================================================================================
WiFiClientSecure espClient;   // TLS client for EMQX Serverless (8883)
PubSubClient mqttClient(espClient);
WebServer  httpServer(80);      // direct-connect demo server (defined early: used in loop())

#if USE_TFT
  Adafruit_ST7735 tft = Adafruit_ST7735(TFT_CS, TFT_DC, TFT_RST);
#endif

struct TelemetryData telemetry;
struct DeviceState   device;
struct LocationState location;

unsigned long lastGeoFetch = 0;          // IP geo-lookup cadence
const unsigned long GEO_INTERVAL_MS = 300000;   // 5 minutes

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
// ==============================================================================================
//                             LOCATION (IP geo + app-pushed GPS)
// ==============================================================================================
/**
 * Two sources, one contract:
 *
 *   source = "ip"  - the device asks a free IP-geolocation service where its own
 *                     public IP is registered. City level (+/- ~20 km). It is the
 *                     carrier's location, not the vehicle's, and it does not move.
 *                     Used as a floor so the map is never empty.
 *
 *   source = "app" - the browser app calls navigator.geolocation (real device GPS)
 *                     and pushes the fix to the device on the command topic. This is
 *                     the accurate one. The device re-publishes it so the TFT and
 *                     the fleet map share the same position.
 *
 * A real GPS module on UART would report source = "gps" with the same fields, so
 * the app contract never changes.
 */
void fetchIpGeolocation() {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure https;
  https.setInsecure();
  https.setTimeout(8000);
  if (!https.connect("ipapi.co", 443)) {
    Serial.println(F("[GEO] ip-api TLS connect failed"));
    return;
  }
  // HTTP/1.0 => no chunked encoding, body ends with the socket close
  https.print("GET /json/ HTTP/1.0\r\nHost: ipapi.co\r\nUser-Agent: KollsAutoTronics\r\n\r\n");

  String body;
  while (https.connected() && https.available()) {
    body += https.readStringUntil('\n');
    if (body.length() > 3000) break;
  }
  https.stop();

  int brace = body.indexOf('{');
  if (brace < 0) { Serial.println(F("[GEO] no JSON body")); return; }

#if ARDUINOJSON_VERSION_MAJOR >= 7
  JsonDocument doc;
#else
  StaticJsonDocument<768> doc;
#endif
  if (deserializeJson(doc, body.substring(brace)) != DeserializationError::Ok) {
    Serial.println(F("[GEO] JSON parse failed"));
    return;
  }

  double lat = doc["latitude"].as<double>();
  double lon = doc["longitude"].as<double>();
  if (lat == 0.0 && lon == 0.0) return;

  // Do not overwrite a real (app-pushed) fix with the coarse IP estimate
  if (location.valid && strcmp(location.source, "app") == 0) return;

  location.lat      = lat;
  location.lon      = lon;
  location.valid    = true;
  location.fix      = 0;                    // IP geo is not a satellite fix
  location.sats     = 0;
  location.updated_ms = millis();
  strncpy(location.source, "ip", sizeof(location.source) - 1);
  location.source[sizeof(location.source) - 1] = '\0';
  strncpy(location.city, doc["city"] | "?", sizeof(location.city) - 1);
  location.city[sizeof(location.city) - 1] = '\0';
  strncpy(location.country, doc["country_name"] | "?", sizeof(location.country) - 1);
  location.country[sizeof(location.country) - 1] = '\0';

  Serial.printf("[GEO] IP location: %.4f, %.4f (%s, %s)\n", lat, lon, location.city, location.country);
}

/**
 * Accepts a browser-pushed position:
 *   { "action":"location", "lat":6.5244, "lon":3.3792, "sats":9, "fix":1,
 *     "speed":42.3, "alt":18.0, "city":"Ikeja" }
 */
bool applyAppLocation(const char* payload) {
#if ARDUINOJSON_VERSION_MAJOR >= 7
  JsonDocument doc;
#else
  StaticJsonDocument<512> doc;
#endif
  if (deserializeJson(doc, payload) != DeserializationError::Ok) return false;

  if (!doc["lat"].is<double>() && !doc["lat"].is<float>()) return false;
  double lat = doc["lat"].as<double>();
  double lon = doc["lon"].as<double>();
  if (lat < -90.0 || lat > 90.0 || lon < -180.0 || lon > 180.0) return false;

  location.lat        = lat;
  location.lon        = lon;
  location.valid      = true;
  int fixVal   = doc["fix"] | 1;
  int satVal   = doc["sats"] | 0;
  float spdVal = doc["speed"] | 0.0f;
  float altVal = doc["alt"] | 0.0f;
  location.fix        = (uint8_t)constrain(fixVal, 0, 2);
  location.sats       = (uint8_t)constrain(satVal, 0, 99);
  location.speed_kmh  = spdVal;
  location.alt_m      = altVal;
  location.updated_ms = millis();
  strncpy(location.source, "app", sizeof(location.source) - 1);
  location.source[sizeof(location.source) - 1] = '\0';
  const char* city = doc["city"] | "";
  strncpy(location.city, city, sizeof(location.city) - 1);
  location.city[sizeof(location.city) - 1] = '\0';

  Serial.printf("[GEO] app position: %.4f, %.4f (fix %u, %u sats)\n",
                lat, lon, location.fix, location.sats);
  return true;
}

void updateLocation() {
  // An app-pushed fix expires after 2 minutes (the phone may have moved/gone away)
  if (location.valid && strcmp(location.source, "app") == 0 &&
      (millis() - location.updated_ms > 120000)) {
    location.valid = false;
    location.fix   = 0;
  }

  // Refresh the IP estimate every 5 minutes (and once shortly after boot)
  if (millis() - lastGeoFetch > GEO_INTERVAL_MS) {
    lastGeoFetch = millis();
    fetchIpGeolocation();
  }
}

void updateDeviceBattery();
void updateLocation();
void checkObdDetach(unsigned long now);
void evaluateSystemHealth();
void computeHealthModel();
void connectWiFi();
bool connectMQTT();
void mqttCallback(char* topic, byte* payload, unsigned int length);
void publishTelemetry();
void publishAppPayload();
size_t buildAppJson(char* out, size_t outLen);
void startHttpServer();
void printTelemetrySerial();
#if USE_TFT
  // UiRow must exist at this scope: the Arduino preprocessor hoists uiRowSet/uiRowDraw
  // prototypes above the TFT block where the functions live.
  struct UiRow { uint8_t id; char txt[14]; uint16_t col; };
  void uiInit();
  void uiRowSet(UiRow& r, uint8_t id, const char* txt, uint16_t col);
  void uiRowDraw(Adafruit_GFX& g, int16_t y, const UiRow& r, uint8_t pct);
  void renderPage(uint8_t page, Adafruit_GFX& g);
  void uiTick(unsigned long now);
  void drawStrip();
#endif

// ==============================================================================================
//                                      BUZZER (active)
// ==============================================================================================
// Active buzzer = built-in oscillator: drive the pin HIGH and it sounds.
// Boot: two chirps on the logo, one on the company screen.
// Alerts: warning = short beep every 4 s, critical = urgent beep every 650 ms.
// Simulation/bench never alarms, so the buzzer stays silent with no car.
static unsigned long buzzerOffAt  = 0;     // 0 = not sounding
static unsigned long buzzerNextAt = 0;
static uint8_t       buzzerLastSev = 0;

void buzzerInit() {
  pinMode(BUZZER_PIN, OUTPUT);
  gpio_set_drive_capability((gpio_num_t)BUZZER_PIN, GPIO_DRIVE_CAP_3);  // 40 mA pin drive
  digitalWrite(BUZZER_PIN, LOW);
}
void buzzerChirp(uint16_t onMs, uint16_t offMs) {   // blocking: boot only
  digitalWrite(BUZZER_PIN, HIGH);
  delay(onMs);
  digitalWrite(BUZZER_PIN, LOW);
  if (offMs) delay(offMs);
}
void buzzerPulse(uint16_t ms) {   // non-blocking: app/fleet "Sound Orion X"
  if (ms < 50) ms = 50;
  buzzerOffAt = millis() + ms;
  digitalWrite(BUZZER_PIN, HIGH);
}
void buzzerTick(unsigned long now) {
  if (buzzerOffAt && (long)(now - buzzerOffAt) >= 0) {   // end of beep
    digitalWrite(BUZZER_PIN, LOW);
    buzzerOffAt = 0;
  }
  uint8_t sev = telemetry.severity;
  if (sev == 0) { buzzerLastSev = 0; return; }

  unsigned long period = (sev >= 2) ? 600UL : 3000UL;
  uint16_t      onMs   = (sev >= 2) ? 180 : 110;

  if (buzzerLastSev == 0) {           // fault just appeared -> sound immediately
    buzzerNextAt = now;
  }
  if (!buzzerOffAt && (long)(now - buzzerNextAt) >= 0) {
    digitalWrite(BUZZER_PIN, HIGH);
    buzzerOffAt  = now + onMs;
    buzzerNextAt = now + period;
  }
  buzzerLastSev = sev;
}

// ==============================================================================================
//                                    BOOT SPLASH (phone-style)
// ==============================================================================================
#if USE_TFT
static int16_t gfxAdvance(const char* s, const GFXfont* f) {
  int16_t a = 0;
  while (*s) {
    a += (int16_t)pgm_read_byte(&f->glyph[(uint8_t)*s - f->first].xAdvance);
    s++;
  }
  return a;
}
static void gfxTextAt(Adafruit_GFX& g, const char* s, int16_t x, int16_t y,
                      uint16_t color, const GFXfont* f) {
  g.setFont(f);
  g.setTextSize(1);
  g.setTextColor(color);
  g.setCursor(x, y);
  g.print(s);
}
static void gfxTrackedAt(Adafruit_GFX& g, const char* s, int16_t x, int16_t y,
                         int16_t tracking, uint16_t color, const GFXfont* f) {
  g.setFont(f);
  g.setTextSize(1);
  g.setTextColor(color);
  int16_t cx = x;
  while (*s) {
    g.setCursor(cx, y);
    g.print((char)*s);
    cx += (int16_t)pgm_read_byte(&f->glyph[(uint8_t)*s - f->first].xAdvance) + tracking;
    s++;
  }
}

static void smallTrackedAt(Adafruit_GFX& g, const char* s, int16_t y,
                           int16_t tracking, uint16_t color) {
  // Unscaled built-in 5x7 font: crisp small caps for splash sub-lines.
  g.setFont(NULL);
  g.setTextSize(1);
  g.setTextColor(color);
  int16_t n = (int16_t)strlen(s);
  int16_t w = n * 6 + tracking * (n - 1);
  int16_t cx = (128 - w) / 2;
  while (*s) {
    if (*s != ' ') {
      g.setCursor(cx, y);
      g.print((char)*s);
    }
    cx += 6 + tracking;
    s++;
  }
}

void bootSplash() {
  const GFXfont* F9B = &FreeSansBold9pt7b;
  int16_t bx, by; uint16_t bw, bh;

  // ---------- stage 1: ORION X ----------
  tft.fillScreen(0xF7BE);                 // T_BG
  // constellation mark (branding/orion-x-sticker.svg)
  tft.drawLine(34, 64, 50, 53, 0x10A2);
  tft.drawLine(50, 53, 64, 46, 0x10A2);
  tft.drawLine(64, 46, 76, 38, 0x10A2);
  tft.fillCircle(34, 64, 2, 0x10A2);
  tft.fillCircle(50, 53, 2, 0x10A2);
  tft.fillCircle(64, 46, 2, 0x10A2);
  tft.fillCircle(30, 38, 1, 0x63DB);     // faint stars
  tft.fillCircle(74, 58, 1, 0x63DB);
  tft.fillTriangle(90, 30, 94, 36, 86, 36, 0x0BCA);   // accent sparkle
  tft.fillTriangle(90, 42, 86, 36, 94, 36, 0x0BCA);

  buzzerChirp(90, 80);                    // boot chirp
  buzzerChirp(90, 0);

  // wordmark: centre on the ink bounds, then place X after the space advance
  tft.setFont(F9B);
  tft.setTextSize(1);
  tft.getTextBounds("ORION X", 0, 0, &bx, &by, &bw, &bh);
  int16_t sx = (128 - (int16_t)bw) / 2 - bx;
  gfxTextAt(tft, "ORION", sx, 102, 0x10A2, F9B);
  gfxTextAt(tft, "X", sx + gfxAdvance("ORION ", F9B), 102, 0x0BCA, F9B);

  tft.fillRect(44, 114, 40, 1, 0xE73B);  // hairline
  smallTrackedAt(tft, "VEHICLE HEALTH", 126, 0, 0x63DB);

  for (int16_t i = 0; i <= 128; i += 4) { // phone-style loading line
    tft.fillRect(0, 152, i, 2, 0x0BCA);
    delay(40);
  }
  delay(150);

  // ---------- stage 2: KOLLS AUTOTRONICS ----------
  tft.fillScreen(0xF7BE);
  buzzerChirp(200, 0);                    // company screen chime
  tft.fillRect(48, 42, 32, 3, 0x0BCA);    // accent tab
  const char* ko = "KOLLS";
  const int16_t ktrack = 4;
  tft.setFont(F9B);
  tft.setTextSize(1);
  tft.getTextBounds(ko, 0, 0, &bx, &by, &bw, &bh);
  int16_t kw = (int16_t)bw + ktrack * (int16_t)(strlen(ko) - 1);
  gfxTrackedAt(tft, ko, (128 - kw) / 2 - bx, 84, ktrack, 0x10A2, F9B);

  smallTrackedAt(tft, "AUTOTRONICS", 100, 2, 0x0BCA);

  tft.fillRect(44, 118, 40, 1, 0xE73B);   // hairline
  delay(1400);
}
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
  tft.initR(INITR_BLACKTAB);  // red 1.4" module: ST7735S, 128x160
  tft.setRotation(0);         // native portrait: 128 wide x 160 tall
  tft.setSPISpeed(12000000);  // conservative: full 34 KB page bursts over dupont wires
  tft.fillScreen(0xF7BE);     // T_BG
  buzzerInit();
  bootSplash();               // ORION X -> KOLLS AUTOTRONICS -> main UI
#endif

#if DEVICE_BATT_MONITOR
  analogSetPinAttenuation(DEVICE_BATT_ADC_PIN, ADC_11db);
#endif

  connectWiFi();

  // ---- OTA: Arduino IDE > Tools > Port > "kolls-gw at ..." (password below) ----
  ArduinoOTA.setHostname("kolls-gw");
  ArduinoOTA.setPassword("kolls2026");
  ArduinoOTA.onStart([]() { Serial.println(F("[OTA] Update starting...")); });
  ArduinoOTA.onEnd  ([]() { Serial.println(F("[OTA] Done, rebooting")); });
  ArduinoOTA.begin();
  Serial.printf("[OTA] ArduinoOTA ready: http://kolls-gw.local  (password kolls2026)\n");

  snprintf(mqttCmdTopic, sizeof(mqttCmdTopic), MQTT_CMD_FMT, VEHICLE_ID);
  snprintf(mqttAppTopic, sizeof(mqttAppTopic), MQTT_APP_FMT, VEHICLE_ID);

  // TLS to EMQX Serverless. setInsecure() skips certificate validation -
  // DEMO ONLY: for production pin the EMQX CA certificate with
  // espClient.setCACert(root_ca) and drop this call.
  espClient.setInsecure();
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(640);

  initCANBus();

  // Direct-connect HTTP server (demo path: device-hosted dashboard + JSON API)
  startHttpServer();

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

  location.valid        = false;
  location.lat          = 0.0;
  location.lon          = 0.0;
  location.speed_kmh    = 0.0f;
  location.alt_m        = 0.0f;
  location.sats         = 0;
  location.fix          = 0;
  location.updated_ms   = 0;
  strncpy(location.source, "none", sizeof(location.source) - 1);
  strncpy(location.city, "-", sizeof(location.city) - 1);
  strncpy(location.country, "-", sizeof(location.country) - 1);

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

  // 6b. Location (IP geo-lookup + app-pushed GPS fix)
  updateLocation();

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
    }    printTelemetrySerial();
#if USE_TFT
    uiTick(now);
#endif
  }

#if USE_TFT
  // 10. Critical-state pinned-strip redraw (the strip itself floods red in drawStrip)
  if (telemetry.severity == 2 && (now - lastFlashToggle >= 350)) {
    lastFlashToggle = now;
    flashState = !flashState;
    drawStrip();
  }
#endif

  // 11. Direct-connect HTTP server (demo path - serves the dashboard + JSON API)
  httpServer.handleClient();

  // 12. OTA firmware uploads (WiFi)
  ArduinoOTA.handle();

  // 13. Buzzer: boot chirps are done, now alert patterns only
  buzzerTick(millis());

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
}

// ==============================================================================================
//                                 HEALTH EVALUATION
// ==============================================================================================
void evaluateSystemHealth() {
  // Bench simulation: plausible values only, never alarm states
  if (telemetry.using_sim_data && !device.everSawOBD) {
    telemetry.status   = "BENCH SIM";
    telemetry.severity = 0;
    return;
  }

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

    // Direct-connect: mDNS alias + local web server (no broker required)
    if (MDNS.begin("kolls-gw")) {
      MDNS.addService("http", "tcp", 80);
      Serial.println(F("[WiFi] mDNS: http://kolls-gw.local"));
    }
    Serial.printf("[DEMO] Open on your laptop:  http://%s/   (or http://kolls-gw.local/)\n",
                  WiFi.localIP().toString().c_str());
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

    if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)) {
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
  } else if (strstr(buf, "\"action\":\"buzzer\"") != NULL || strstr(buf, "BUZZER") != NULL) {
    // App/fleet "Sound Orion X": { "action":"buzzer", "ms":900 }
    buzzerPulse(900);
    mqttClient.publish(MQTT_TOPIC, "{\"response\":\"BUZZER\",\"status\":\"ON\"}");
  } else if (strstr(buf, "\"lat\"") != NULL || strstr(buf, "\"action\":\"location\"") != NULL) {
    // Browser-pushed GPS fix: { "action":"location", "lat":.., "lon":.., "sats":.. }
    if (applyAppLocation(buf)) {
      publishAppPayload();      // echo the new position immediately
    }
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

  // ---- location (raw topic mirror) -----------------------------------------
#if ARDUINOJSON_VERSION_MAJOR >= 7
  JsonObject locRaw = doc["location"].to<JsonObject>();
#else
  JsonObject locRaw = doc.createNestedObject("location");
#endif
  locRaw["source"]    = location.valid ? location.source : "none";
  locRaw["lat"]       = location.valid ? location.lat : 0.0;
  locRaw["lon"]       = location.valid ? location.lon : 0.0;
  locRaw["city"]      = location.city;
  locRaw["country"]   = location.country;
  locRaw["speed_kmh"] = location.speed_kmh;
  locRaw["alt_m"]     = location.alt_m;
  locRaw["sats"]      = location.sats;
  locRaw["fix"]       = location.fix;
  locRaw["age_s"]     = location.valid ? (uint32_t)((millis() - location.updated_ms) / 1000) : 0;

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
 * Builds the app-shaped JSON document (shared by the MQTT topic and the HTTP endpoint).
 * The web dashboard's vehicle object uses flat, consumer-facing field names:
 *   battery, coolant, range, fuel, systems{engine,cooling,electrical,brakes}, score
 */
size_t buildAppJson(char* out, size_t outLen) {
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

  // ---- location -------------------------------------------------------------
#if ARDUINOJSON_VERSION_MAJOR >= 7
  JsonObject loc = doc["location"].to<JsonObject>();
#else
  JsonObject loc = doc.createNestedObject("location");
#endif
  loc["source"]    = location.valid ? location.source : "none";
  loc["lat"]       = location.valid ? location.lat : 0.0;
  loc["lon"]       = location.valid ? location.lon : 0.0;
  loc["city"]      = location.city;
  loc["country"]   = location.country;
  loc["speed_kmh"] = location.speed_kmh;
  loc["alt_m"]     = location.alt_m;
  loc["sats"]      = location.sats;
  loc["fix"]       = location.fix;
  loc["age_s"]     = location.valid ? (uint32_t)((millis() - location.updated_ms) / 1000) : 0;

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
  gw["fw_version"]      = "2.2-direct";
  gw["tires_available"] = false;   // no TPMS PID - app should keep its own tyre data
  gw["ip"]              = WiFi.localIP().toString();
  gw["wifi_rssi"]       = WiFi.RSSI();
  gw["uptime_sec"]      = millis() / 1000;

  return serializeJson(doc, out, outLen);
}

void publishAppPayload() {
  char jsonBuffer[768];
  size_t bytesWritten = buildAppJson(jsonBuffer, sizeof(jsonBuffer));
  if (!mqttClient.publish(mqttAppTopic, jsonBuffer, bytesWritten)) {
    Serial.println(F("[MQTT] WARNING: app-shape publish failed!"));
  }
}

// ==============================================================================================
//                       DIRECT-CONNECT HTTP SERVER (demo path - no broker needed)
// ==============================================================================================
/**
 * The device serves its own telemetry over plain HTTP so the demo works with
 * ZERO cloud dependencies (no broker, no internet, no registration):
 *
 *   http://<esp-ip>/            -> live dashboard served BY the device
 *   http://<esp-ip>/telemetry   -> the same app-shaped JSON (CORS enabled)
 *   http://<esp-ip>/health      -> device health / identity blob
 *   http://kolls-gw.local/...   -> mDNS alias of the same
 */
void handleRoot();
void handleTelemetry();
void handleHealth();
void handleBuzzer();
void sendCORS();

void sendCORS() {
  httpServer.sendHeader("Access-Control-Allow-Origin", "*");
  httpServer.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  httpServer.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  httpServer.sendHeader("Cache-Control", "no-store");
}

void handleTelemetry() {
  char buf[768];
  buildAppJson(buf, sizeof(buf));
  sendCORS();
  httpServer.send(200, "application/json", String(buf));
}

void handleBuzzer() {
  buzzerPulse(900);
  sendCORS();
  httpServer.send(200, "application/json", "{\"ok\":true}");
}

void handleHealth() {
  char buf[320];
  snprintf(buf, sizeof(buf),
           "{\"device\":\"%s\",\"ip\":\"%s\",\"rssi\":%d,\"uptime_sec\":%lu,"
           "\"heap\":%u,\"can_feed\":\"%s\",\"status\":\"%s\",\"severity\":%u,"
           "\"obd_detached\":%s,\"disconnect_count\":%u,\"device_v\":%.2f,\"device_pct\":%u}",
           VEHICLE_ID, WiFi.localIP().toString().c_str(), WiFi.RSSI(),
           (unsigned long)(millis() / 1000), ESP.getFreeHeap(),
           telemetry.using_sim_data ? "SIMULATED" : "HARDWARE_CAN",
           telemetry.status.c_str(), telemetry.severity,
           device.obd_detached ? "true" : "false", device.disconnect_count,
           device.device_v, device.device_pct);
  sendCORS();
  httpServer.send(200, "application/json", buf);
}

void handleRoot() {
  // Self-contained live dashboard - works with no internet, no broker, no app.
  static const char PAGE[] PROGMEM = R"HTML(
<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kolls Autotronics - Live Node</title>
<style>
 body{margin:0;background:#0b1220;color:#e5e7eb;font-family:system-ui,-apple-system,sans-serif;padding:16px}
 h1{font-size:15px;color:#22d3ee;margin:0 0 2px;letter-spacing:.5px}
 .sub{color:#64748b;font-size:11px;margin-bottom:14px}
 .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
 .card{background:#162033;border:1px solid #334155;border-radius:14px;padding:14px}
 .lbl{font-size:10px;letter-spacing:1px;color:#94a3b8;text-transform:uppercase}
 .val{font-size:30px;font-weight:700;margin-top:4px;line-height:1}
 .unit{font-size:13px;color:#94a3b8;margin-left:3px;font-weight:400}
 .g{color:#4ade80}.y{color:#fbbf24}.r{color:#f87171}.c{color:#22d3ee}
 .bar{height:6px;background:#1e293b;border-radius:4px;margin-top:10px;overflow:hidden}
 .fill{height:100%;border-radius:4px;transition:width .4s}
 footer{margin-top:14px;font-size:10px;color:#475569;display:flex;gap:14px;flex-wrap:wrap}
 #st{position:fixed;top:10px;right:12px;font-size:10px;color:#64748b}
</style></head><body>
<div id="st">connecting?</div>
<h1>? KOLLS AUTOTRONICS ? LIVE NODE</h1>
<div class="sub" id="hd">Kolls Autotronics Test Vehicle</div>
<div class="grid">
 <div class="card"><div class="lbl">Engine speed</div><div class="val" id="rpm">?<span class="unit">rpm</span></div>
  <div class="bar"><div class="fill c" id="rpmf" style="width:0%"></div></div></div>
 <div class="card"><div class="lbl">Coolant</div><div class="val" id="ct">?<span class="unit">?C</span></div>
  <div class="bar"><div class="fill g" id="ctf" style="width:0%"></div></div></div>
 <div class="card"><div class="lbl">System voltage</div><div class="val" id="bv">?<span class="unit">V</span></div>
  <div class="bar"><div class="fill g" id="bvf" style="width:0%"></div></div></div>
 <div class="card"><div class="lbl">Engine load</div><div class="val" id="ld">?<span class="unit">%</span></div>
  <div class="bar"><div class="fill c" id="ldf" style="width:0%"></div></div></div>
 <div class="card"><div class="lbl">Health score</div><div class="val g" id="sc">?<span class="unit">/100</span></div>
  <div class="bar"><div class="fill g" id="scf" style="width:0%"></div></div></div>
 <div class="card"><div class="lbl">Gateway pack</div><div class="val" id="dv">?<span class="unit">%</span></div>
  <div class="bar"><div class="fill g" id="dvf" style="width:0%"></div></div></div>
</div>
<footer><span id="f1"></span><span id="f2"></span><span id="f3"></span><span id="low"></span></footer>
<script>
const q=id=>document.getElementById(id);
function set(id,v,cls){const e=q(id);e.className='val '+(cls||'');e.innerHTML=v;}
async function tick(){
 try{
  const d=await (await fetch('/telemetry',{cache:'no-store'})).json();
  const n=v=>v===null||v===undefined?'?':v;
  set('rpm',n(d.rpm)+'<span class="unit">rpm</span>',d.rpm>4500?'r':d.rpm>3000?'y':'');
  q('rpmf').style.width=Math.min(100,d.rpm/6000*100)+'%';
  q('rpmf').style.background=d.rpm>4500?'#f87171':d.rpm>3000?'#fbbf24':'#22d3ee';
  set('ct',n(d.coolant)+'<span class="unit">?C</span>',+d.coolant>=100?'r':+d.coolant>=90?'y':'g');
  q('ctf').style.width=Math.min(100,Math.max(0,(d.coolant-60)/60*100))+'%';
  set('bv',n(d.battery)+'<span class="unit">V</span>',+d.battery<11.8?'r':+d.battery<=12.4?'y':'g');
  q('bvf').style.width=Math.min(100,Math.max(0,(d.battery-11)/4*100))+'%';
  set('ld',n(d.load_pct||0)+'<span class="unit">%</span>','');
  q('ldf').style.width=(d.load_pct||0)+'%';
  set('sc',n(d.score),d.score>=80?'g':d.score>=60?'y':'r');
  q('scf').style.width=n(d.score)+'%';
  set('dv',(d.gateway?d.gateway.device_pct:'?')+'<span class="unit">%</span>',d.gateway&&d.gateway.device_pct<20?'r':'');
  q('dvf').style.width=(d.gateway?d.gateway.device_pct:0)+'%';
  q('dvf').style.background=(d.gateway&&d.gateway.device_pct<20)?'#f87171':'#4ade80';
  const low=d.gateway&&d.gateway.device_pct<20;
  q('low').textContent=low?'? LOW BATTERY ? CHARGE THE GATEWAY':'';
  q('low').style.color='#f87171';
  q('hd').textContent=(d.name||'')+' ? '+(d.vehicle_id||'');
  q('f1').textContent='FEED: '+(d.gateway?d.gateway.can_feed:'?');
  q('f2').textContent='STATUS: '+(d.status||'?');
  q('f3').textContent='OBD: '+(d.gateway&&d.gateway.obd_detached?'DETACHED':'connected');
  q('st').textContent='live ? '+(d.gateway?d.gateway.ip:'');
 }catch(e){q('st').textContent='device offline'}
}
tick();setInterval(tick,1000);
</script></body></html>
)HTML";
  sendCORS();
  httpServer.send_P(200, "text/html", PAGE);
}

void startHttpServer() {
  httpServer.on("/", HTTP_GET, handleRoot);
  httpServer.on("/telemetry", HTTP_GET, handleTelemetry);
  httpServer.on("/health", HTTP_GET, handleHealth);
  httpServer.on("/buzzer", HTTP_GET, handleBuzzer);
  httpServer.on("/buzzer", HTTP_POST, handleBuzzer);
  httpServer.onNotFound(handleHealth);
  httpServer.begin();
  Serial.println(F("[HTTP] Direct-connect server started on port 80."));
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
//            TFT DISPLAY (128x160 portrait) - LIGHT THEME, MOCKUP PORT
// ==============================================================================================
// Panel: red 1.4" module, ST7735S controller, 128x160, INITR_BLACKTAB, rotation 0.
// Ported from docs/tft-mockup-1.4.html, re-laid-out for 128x160 (the mockup's 240 px
// height does not exist on this glass):
//   fault band   y 0..16      label y 20     hero(size 4) y 36    rule y 72
//   3 icon rows  y 76, 94, 112  (18 px pitch, size-2 mono, <= 8 chars)
//   pinned strip y 134..160 (never scrolls)
//   severity bar x 0..3, full height
// 5 pages: DRIVE - THERMAL - POWER - HEALTH - LINK. Hold 4.2 s, glide 1.6 s.
// ==============================================================================================
#if USE_TFT

// ---- panel geometry / colours -----------------------------------------------
#define TFT_PANEL_W   128
#define TFT_PANEL_H   160
#define TFT_VIEW_H    134     // scrolling viewport; strip owns y 134..160
#define TFT_ROTATION  0       // native portrait on the ST7735S 128x160 panel

#define T_BG      0xF7BE      // #f4f4f1
#define T_SURF    0xFFFF      // #ffffff
#define T_INK     0x10A2      // #151614
#define T_MUTED   0x63DB      // #64665f
#define T_LINE    0xE73B      // #e4e4dd
#define T_TRACK   0xEF7D      // #efefea
#define T_DOTOFF  0xD699      // #d3d3ca
#define T_ACCENT  0x0BCA      // #0b7a53
#define T_WARN    0x8A80      // #8a5200
#define T_DANGER  0x9944      // #9e2a21
#define T_BLUE    0x2B76      // #2b76b0
#define T_SKY     0x7D9A      // #7fb3d5
#define T_AMBER   0xE504      // #e0a021
#define T_STEEL   0x8C71      // #8a8d86
#define T_WHITE   0xFFFF

#define ROW_Y0    76
#define ROW_PITCH 18
#define ROW_COUNT 3

// ---- carousel state ---------------------------------------------------------
GFXcanvas16* pageCanvas = NULL;
GFXcanvas16* nextCanvas = NULL;
bool          canvasOk       = false;
uint8_t       currPage       = 0;
bool          uiAnimating    = false;
bool          uiCalm         = false;
unsigned long pageHoldStart  = 0;
unsigned long uiAnimStart    = 0;
unsigned long calmLastDraw   = 0;
unsigned long lastLiveDraw   = 0;

// ==============================================================================================
// helpers
// ==============================================================================================
uint16_t sevColorHex(uint8_t s)  { return s == 0 ? T_ACCENT : (s == 1 ? T_WARN : T_DANGER); }
uint16_t rpmColorOf(uint16_t r)  { return r >= 4500 ? T_DANGER : (r >= 3000 ? T_WARN : T_INK); }
uint16_t coolColorOf(float t)    { return t >= 100.0f ? T_DANGER : (t >= 90.0f ? T_WARN : T_INK); }
uint16_t voltColorOf(float v)    { return v < 11.8f ? T_DANGER : (v <= 12.4f ? T_WARN : T_INK); }
uint16_t trimColorOf(float t)    { return fabsf(t) > 8.0f ? T_DANGER : (fabsf(t) > 5.0f ? T_WARN : T_ACCENT); }
uint16_t scoreColorOf(uint8_t s) { return s >= 80 ? T_ACCENT : (s >= 60 ? T_WARN : T_DANGER); }

// the single worst fault (<= 9 chars, no "!" prefix so it fits 128 px) ??? mockup's ladder
const char* uiFault(uint16_t* color) {
  // Bench simulation must never raise alarms - no car, no faults.
  if (telemetry.using_sim_data && !device.everSawOBD) return NULL;
#if DEVICE_BATT_MONITOR
  if (device.connected && device.device_critical) { *color = T_DANGER; return "LOW BATT"; }
#endif
  if (device.obd_detached)              { *color = T_DANGER; return "CAN LOST";  }
  if (telemetry.oil_temp >= 110.0f)     { *color = T_DANGER; return "OIL HOT";   }
  if (telemetry.coolant_temp >= 100.0f) { *color = T_DANGER; return "OVERHEAT";  }
  if (telemetry.battery_voltage < 11.8f){ *color = T_DANGER; return "LOW VOLT";  }
  if (telemetry.rpm >= 4500)            { *color = T_DANGER; return "OVER-REV";  }
  if (fabsf(telemetry.stft) > 8.0f ||
      fabsf(telemetry.ltft) > 8.0f)     { *color = T_DANGER; return "TRIM HI";   }
  if (telemetry.engine_load > 80)       { *color = T_WARN;   return "HIGH LOAD"; }
  if (telemetry.coolant_temp >= 90.0f)  { *color = T_WARN;   return "RUN HOT";   }
  if (fabsf(telemetry.stft) > 5.0f ||
      fabsf(telemetry.ltft) > 5.0f)     { *color = T_WARN;   return "TRIM WARN"; }
  if (telemetry.severity == 2)          { *color = T_DANGER; return "CRITICAL";  }
  if (telemetry.severity == 1)          { *color = T_WARN;   return "WARNING";   }
  return NULL;
}

// ==============================================================================================
// ICONS (GFX primitives only ??? mirror the mockup SVGs)
// ==============================================================================================
// --- 16x16 1-bit glyphs, generated from icons.txt (MSB first) -----------------
static const uint8_t ICO_THERM[32] PROGMEM = {
  0x00, 0x00, 0x03, 0x80, 0x03, 0x80, 0x03, 0x90,
  0x03, 0x90, 0x03, 0x80, 0x03, 0x90, 0x03, 0x90,
  0x03, 0x80, 0x07, 0xC0, 0x0F, 0xE0, 0x1F, 0xF0,
  0x1F, 0xF0, 0x0F, 0xE0, 0x07, 0xC0, 0x00, 0x00
};
static const uint8_t ICO_BATT[32] PROGMEM = {
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x7F, 0xF8,
  0x7F, 0xF8, 0x60, 0x1B, 0x60, 0x1B, 0x60, 0x1B,
  0x60, 0x1B, 0x7F, 0xF8, 0x7F, 0xF8, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
};
static const uint8_t ICO_BOLT[32] PROGMEM = {
  0x00, 0x00, 0x00, 0xE0, 0x01, 0xE0, 0x03, 0xC0,
  0x07, 0x80, 0x0F, 0x00, 0x1F, 0xC0, 0x03, 0xC0,
  0x07, 0x80, 0x0F, 0x00, 0x1E, 0x00, 0x3C, 0x00,
  0x78, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
};
static const uint8_t ICO_RING[32] PROGMEM = {
  0x00, 0x00, 0x07, 0xE0, 0x1C, 0x38, 0x30, 0x0C,
  0x60, 0x06, 0x40, 0x02, 0xC0, 0x03, 0x80, 0x01,
  0x80, 0x01, 0xC0, 0x03, 0x40, 0x02, 0x60, 0x06,
  0x30, 0x0C, 0x1C, 0x38, 0x07, 0xE0, 0x00, 0x00
};
static const uint8_t ICO_DROP[32] PROGMEM = {
  0x00, 0x00, 0x01, 0x80, 0x03, 0xC0, 0x03, 0xC0,
  0x07, 0xE0, 0x0F, 0xF0, 0x0F, 0xF0, 0x1F, 0xF8,
  0x1F, 0xF8, 0x1F, 0xF8, 0x3F, 0xFC, 0x3F, 0xFC,
  0x1F, 0xF8, 0x0F, 0xF0, 0x07, 0xE0, 0x00, 0x00
};
static const uint8_t ICO_CAN[32] PROGMEM = {
  0x00, 0x00, 0x00, 0x00, 0x3F, 0xF8, 0x7F, 0xFC,
  0x6D, 0xB4, 0x7F, 0xFC, 0x3F, 0xF8, 0x1F, 0xF0,
  0x0F, 0xE0, 0x07, 0xC0, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
};
static const uint8_t ICO_CLOUD[32] PROGMEM = {
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x03, 0xC0, 0x0F, 0xF0, 0x1F, 0xFC, 0x3F, 0xFE,
  0x7F, 0xFE, 0x7F, 0xFE, 0x7F, 0xFE, 0x3F, 0xFC,
  0x1F, 0xF8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
};
static const uint8_t ICO_SHIELD[32] PROGMEM = {
  0x00, 0x00, 0x1F, 0xF8, 0x3F, 0xFC, 0x3F, 0xFC,
  0x3F, 0xFC, 0x3F, 0xFC, 0x3F, 0xFC, 0x1F, 0xF8,
  0x0F, 0xF0, 0x07, 0xE0, 0x03, 0xC0, 0x01, 0x80,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
};

void icoTherm(Adafruit_GFX& g, int16_t x, int16_t y, uint16_t c) {
  bool mono = (c == T_WHITE);
  g.drawBitmap(x, y, ICO_THERM, 16, 16, mono ? T_WHITE : T_INK);
  if (!mono) {
    g.fillRect(x + 7, y + 3, 1, 6, T_DANGER);          // mercury column
    g.fillCircle(x + 8, y + 12, 2, T_DANGER);          // red bulb
  }
}
void icoBatt(Adafruit_GFX& g, int16_t x, int16_t y, uint16_t c, uint8_t pct) {
  bool mono = (c == T_WHITE);
  g.drawBitmap(x, y, ICO_BATT, 16, 16, mono ? T_WHITE : T_INK);
  if (!mono) {
    int16_t w = (int16_t)((8L * pct) / 100);            // interior is 8 px wide
    if (w > 0) g.fillRect(x + 3, y + 5, w, 4, pct < 20 ? T_DANGER : T_ACCENT);
  }
}
void icoBolt(Adafruit_GFX& g, int16_t x, int16_t y, uint16_t c) {
  g.drawBitmap(x, y, ICO_BOLT, 16, 16, c == T_WHITE ? T_WHITE : T_AMBER);
}
void icoGauge(Adafruit_GFX& g, int16_t x, int16_t y, uint16_t c) {
  bool mono = (c == T_WHITE);
  g.drawBitmap(x, y, ICO_RING, 16, 16, mono ? T_WHITE : T_INK);
  g.drawLine(x + 8, y + 8, x + 11, y + 4, mono ? T_WHITE : T_DANGER);
  g.drawLine(x + 8, y + 9, x + 11, y + 5, mono ? T_WHITE : T_DANGER);
  g.fillCircle(x + 8, y + 8, 2, mono ? T_WHITE : T_AMBER);
}
void icoDrop(Adafruit_GFX& g, int16_t x, int16_t y, uint16_t c) {
  bool mono = (c == T_WHITE);
  g.drawBitmap(x, y, ICO_DROP, 16, 16, mono ? T_WHITE : T_BLUE);
  if (!mono) g.fillCircle(x + 6, y + 8, 1, T_SKY);      // highlight
}
void icoCan(Adafruit_GFX& g, int16_t x, int16_t y, uint16_t c) {
  g.drawBitmap(x, y, ICO_CAN, 16, 16, c);              // live=green, lost=red
}
void icoLink(Adafruit_GFX& g, int16_t x, int16_t y, uint16_t c) {
  bool mono = (c == T_WHITE);
  g.drawBitmap(x, y, ICO_CLOUD, 16, 16, mono ? T_WHITE : T_BLUE);
  if (!mono) g.fillRect(x + 5, y + 7, 3, 2, T_SKY);     // cloud highlight
}
void icoShield(Adafruit_GFX& g, int16_t x, int16_t y, uint16_t c) {
  bool mono = (c == T_WHITE);
  g.drawBitmap(x, y, ICO_SHIELD, 16, 16, mono ? T_WHITE : T_ACCENT);
  if (!mono) {
    g.drawLine(x + 5, y + 8, x + 7, y + 10, T_WHITE);   // check mark
    g.drawLine(x + 7, y + 10, x + 11, y + 5, T_WHITE);
  }
}
void icoWheel(Adafruit_GFX& g, int16_t x, int16_t y, uint16_t c) {
  bool mono = (c == T_WHITE);
  g.drawCircle(x + 8, y + 8, 7, mono ? T_WHITE : T_STEEL);
  g.fillCircle(x + 8, y + 8, 2, mono ? T_WHITE : T_INK);
}
void icoGlobe(Adafruit_GFX& g, int16_t x, int16_t y, uint16_t c) {
  bool mono = (c == T_WHITE);
  uint16_t ring = mono ? T_WHITE : T_BLUE;
  g.drawBitmap(x, y, ICO_RING, 16, 16, ring);
  g.drawLine(x + 8, y + 2, x + 8, y + 13, ring);        // meridian
  g.drawLine(x + 2, y + 8, x + 13, y + 8, ring);        // equator
  if (!mono) {
    g.fillCircle(x + 5, y + 6, 1, T_ACCENT);            // land
    g.fillCircle(x + 10, y + 9, 1, T_ACCENT);
    g.fillCircle(x + 9, y + 4, 1, T_ACCENT);
  }
}
void uiIcon(Adafruit_GFX& g, uint8_t icon, int16_t x, int16_t y, uint16_t c, uint8_t pct) {
  switch (icon) {
    case 0:  icoTherm(g, x, y, c);  break;
    case 1:  icoBatt(g, x, y, c, pct); break;
    case 2:  icoBolt(g, x, y, c);   break;
    case 3:  icoGauge(g, x, y, c);  break;
    case 4:  icoDrop(g, x, y, c);   break;
    case 5:  icoCan(g, x, y, c);    break;
    case 6:  icoLink(g, x, y, c);   break;
    case 7:  icoShield(g, x, y, c); break;
    case 8:  icoWheel(g, x, y, c);  break;
    default: icoGlobe(g, x, y, c);  break;
  }
}

// ==============================================================================================
// PRIMITIVES
// ==============================================================================================
void uiLabel(Adafruit_GFX& g, const char* txt) {    // muted label ABOVE the number
  g.setFont(&FreeSansBold9pt7b);
  g.setTextSize(1);
  g.setTextColor(T_MUTED);
  g.setCursor(8, 33);
  g.print(txt);
}
void uiHero(Adafruit_GFX& g, const char* value, uint16_t c) {  // big proportional digits
  g.setFont(&FreeSansBold18pt7b);
  g.setTextSize(1);
  g.setTextColor(c);
  g.setCursor(8, 64);
  g.print(value);
}
void uiRule(Adafruit_GFX& g, int16_t y) { g.fillRect(8, y, 112, 1, T_LINE); }
void uiBar(Adafruit_GFX& g, int16_t y, uint8_t pct, uint16_t c) {
  g.fillRect(8, y, 112, 4, T_TRACK);
  g.fillRect(8, y, (int16_t)((112L * pct) / 100), 4, c);
}

// struct UiRow is declared above, with the forward declarations
void uiRowSet(UiRow& r, uint8_t id, const char* txt, uint16_t col) {
  r.id  = id;
  r.col = col;
  strncpy(r.txt, txt, sizeof(r.txt) - 1);
  r.txt[sizeof(r.txt) - 1] = 0;
}

void uiRowDraw(Adafruit_GFX& g, int16_t y, const UiRow& r, uint8_t pct) {
  bool alert = (r.col == T_WARN || r.col == T_DANGER);
  if (alert) {
    g.fillRect(4, y - 2, 120, 17, r.col);                // SOLID alert band
    uiIcon(g, r.id, 8, y - 1, T_WHITE, pct);             // white icon
    g.setTextColor(T_WHITE);
  } else {
    uiIcon(g, r.id, 8, y - 1, r.col, pct);
    g.setTextColor(r.col);
  }
  g.setFont(&FreeSansBold9pt7b);
  g.setTextSize(1);
  g.setCursor(26, y + 13);
  g.print(r.txt);
}

// ==============================================================================================
// TOP BAND: solid fault banner when there is one, LEDs + page dashes when there isn't
// ==============================================================================================
void uiHead(Adafruit_GFX& g, uint8_t active) {
  uint16_t fc;
  const char* f = uiFault(&fc);
  if (f) {
    g.fillRect(0, 0, TFT_PANEL_W, 16, fc);              // SOLID fault band, white text
    g.setFont(&FreeSansBold9pt7b);
    g.setTextSize(1);
    g.setTextColor(T_WHITE);
    g.setCursor(6, 13);
    g.print(f);
    return;
  }
  g.fillCircle(33, 7, 3, (WiFi.status() == WL_CONNECTED) ? T_ACCENT : T_DANGER);  // WiFi LED
  g.fillCircle(44, 7, 3, sevColorHex(telemetry.severity));            // severity LED
  g.fillCircle(55, 7, 3, device.obd_detached ? T_DANGER : T_ACCENT);  // CAN LED
  for (uint8_t i = 0; i < 5; i++) {
    int16_t x = 66 + i * 8;
    int16_t w = (i == active) ? 8 : 6;                   // active dash slightly wider
    g.fillRect(x, 5, w, 4, i == active ? T_ACCENT : T_DOTOFF);
  }
  uiRule(g, 16);
}

// ==============================================================================================
// PAGES ??? 3 rows each (128x160 has no room for 5), same data as the mockup
// ==============================================================================================
void renderPage0(Adafruit_GFX& g) {          /* DRIVE */
  char b[16];
  UiRow rows[ROW_COUNT];
  uiHead(g, 0);
  uiLabel(g, "ENGINE RPM");
  snprintf(b, sizeof(b), "%u", (unsigned)telemetry.rpm);
  uiHero(g, b, rpmColorOf(telemetry.rpm));
  uiBar(g, 69, (uint8_t)constrain((long)((long)telemetry.rpm * 100L / 6500L), 0L, 100L),
        rpmColorOf(telemetry.rpm) == T_INK ? T_ACCENT : rpmColorOf(telemetry.rpm));

  snprintf(b, sizeof(b), "LOAD %u%%", (unsigned)telemetry.engine_load);
  uiRowSet(rows[0], 3, b, telemetry.engine_load > 80 ? T_DANGER : T_ACCENT);
  snprintf(b, sizeof(b), "OIL %.0fC", telemetry.oil_temp);
  uiRowSet(rows[1], 0, b, telemetry.oil_temp >= 110.0f ? T_DANGER : T_INK);
  snprintf(b, sizeof(b), "%+.1f%%", telemetry.stft);
  uiRowSet(rows[2], 4, b, trimColorOf(telemetry.stft));
  for (uint8_t i = 0; i < ROW_COUNT; i++) uiRowDraw(g, ROW_Y0 + i * ROW_PITCH, rows[i], device.device_pct);
}

void renderPage1(Adafruit_GFX& g) {          /* THERMAL */
  char b[16];
  UiRow rows[ROW_COUNT];
  uiHead(g, 1);
  uiLabel(g, "COOLANT");
  snprintf(b, sizeof(b), "%.1f", telemetry.coolant_temp);
  uiHero(g, b, coolColorOf(telemetry.coolant_temp));
  uiRule(g, 72);

  snprintf(b, sizeof(b), "OIL %.0fC", telemetry.oil_temp);
  uiRowSet(rows[0], 0, b, telemetry.oil_temp >= 110.0f ? T_DANGER : T_INK);
  snprintf(b, sizeof(b), "IAT %.0fC", telemetry.intake_air_temp);
  uiRowSet(rows[1], 0, b, T_INK);
  snprintf(b, sizeof(b), "LOAD %u%%", (unsigned)telemetry.engine_load);
  uiRowSet(rows[2], 3, b, telemetry.engine_load > 80 ? T_DANGER : T_ACCENT);
  for (uint8_t i = 0; i < ROW_COUNT; i++) uiRowDraw(g, ROW_Y0 + i * ROW_PITCH, rows[i], device.device_pct);
}

void renderPage2(Adafruit_GFX& g) {          /* POWER */
  char b[16];
  UiRow rows[ROW_COUNT];
  uiHead(g, 2);
  uiLabel(g, "CAR VOLT");
  snprintf(b, sizeof(b), "%.2f", telemetry.battery_voltage);
  uiHero(g, b, voltColorOf(telemetry.battery_voltage));
  uiRule(g, 72);

  uint16_t pc;
  if (device.connected) {
    pc = device.device_pct < 20 ? T_DANGER : T_ACCENT;
    snprintf(b, sizeof(b), "%u%%", (unsigned)device.device_pct);
  } else {
    pc = T_MUTED;
    snprintf(b, sizeof(b), "--");
  }
  uiRowSet(rows[0], 1, b, pc);
  if (device.connected) snprintf(b, sizeof(b), "%.2fV", device.device_v);
  else                  snprintf(b, sizeof(b), "NO DIV");
  uiRowSet(rows[1], 1, b, device.connected ? T_INK : T_MUTED);
  snprintf(b, sizeof(b), "HLTH %u", (unsigned)telemetry.health_score);
  uiRowSet(rows[2], 7, b, scoreColorOf(telemetry.health_score));
  for (uint8_t i = 0; i < ROW_COUNT; i++) uiRowDraw(g, ROW_Y0 + i * ROW_PITCH, rows[i], device.device_pct);
}

void renderPage3(Adafruit_GFX& g) {          /* HEALTH */
  char b[16];
  UiRow rows[ROW_COUNT];
  uiHead(g, 3);
  uiLabel(g, "HEALTH");
  snprintf(b, sizeof(b), "%u", (unsigned)telemetry.health_score);
  uiHero(g, b, scoreColorOf(telemetry.health_score));
  uiRule(g, 72);

  uiRowSet(rows[0], 3, "ENG 95%",  T_ACCENT);
  uiRowSet(rows[1], 0, "COOL 88%", T_WARN);
  uiRowSet(rows[2], 2, "ELEC 97%", T_ACCENT);
  for (uint8_t i = 0; i < ROW_COUNT; i++) uiRowDraw(g, ROW_Y0 + i * ROW_PITCH, rows[i], device.device_pct);
}

void renderPage4(Adafruit_GFX& g) {          /* LINK */
  char b[16], bb[16];
  UiRow rows[ROW_COUNT];
  uiHead(g, 4);
  uiLabel(g, "WIFI dBm");
  int32_t rssi = WiFi.RSSI();
  snprintf(b, sizeof(b), "%d", (int)rssi);
  uiHero(g, b, rssi < -75 ? T_WARN : T_INK);
  uiRule(g, 72);

  uiRowSet(rows[0], 6, mqttConnected ? "MQTT OK" : "MQTT UP",
           mqttConnected ? T_ACCENT : T_DANGER);
  uiRowSet(rows[1], 5, device.obd_detached ? "CAN DET" : "CAN LIVE",
           device.obd_detached ? T_DANGER : T_ACCENT);
  IPAddress ip = WiFi.localIP();
  snprintf(bb, sizeof(bb), "IP .%u", (unsigned)ip[3]);
  uiRowSet(rows[2], 9, bb, T_MUTED);
  for (uint8_t i = 0; i < ROW_COUNT; i++) uiRowDraw(g, ROW_Y0 + i * ROW_PITCH, rows[i], device.device_pct);
}

void renderPage(uint8_t page, Adafruit_GFX& g) {
  g.fillScreen(T_BG);                 // canvas starts zeroed (black) ??? paint the light theme
  switch (page % 5) {
    case 0:  renderPage0(g); break;
    case 1:  renderPage1(g); break;
    case 2:  renderPage2(g); break;
    case 3:  renderPage3(g); break;
    default: renderPage4(g); break;
  }
}

// ==============================================================================================
// CALM ALWAYS-ON FACE (car idle)
// ==============================================================================================
void renderCalmFace(Adafruit_GFX& g) {
  char b[16];
  UiRow rows[ROW_COUNT];
  g.fillScreen(T_BG);                 // same reason as renderPage()
  uiHead(g, 0);
  uiLabel(g, "STATUS");

  const char* st = telemetry.severity == 0 ? "OK" :
                   telemetry.severity == 1 ? "WARN" : "CRIT";
  uiHero(g, st, sevColorHex(telemetry.severity));
  uiRule(g, 72);

  snprintf(b, sizeof(b), "HLTH %u", (unsigned)telemetry.health_score);
  uiRowSet(rows[0], 7, b, scoreColorOf(telemetry.health_score));
  uint16_t pc;
  if (device.connected) {
    pc = device.device_pct < 20 ? T_DANGER : T_ACCENT;
    snprintf(b, sizeof(b), "%u%%", (unsigned)device.device_pct);
  } else {
    pc = T_MUTED;
    snprintf(b, sizeof(b), "--");
  }
  uiRowSet(rows[1], 1, b, pc);
  uint32_t up = millis() / 1000;
  snprintf(b, sizeof(b), "IDLE %02lu:%02lu", (unsigned long)((up / 60) % 100), (unsigned long)(up % 60));
  uiRowSet(rows[2], 8, b, T_MUTED);
  for (uint8_t i = 0; i < ROW_COUNT; i++) uiRowDraw(g, ROW_Y0 + i * ROW_PITCH, rows[i], device.device_pct);
}

// ==============================================================================================
// PINNED COMPLICATION STRIP (y 134..160) ??? floods red on any DANGER fault
// ==============================================================================================
void drawStrip() {
  const int16_t Y = TFT_VIEW_H;
  uint16_t fc;
  const char* f = uiFault(&fc);
  bool crit = (f != NULL && fc == T_DANGER);

  // strip background first ...
  tft.fillRect(0, Y, TFT_PANEL_W, TFT_PANEL_H - Y, crit ? T_DANGER : T_SURF);
  tft.fillRect(8, Y, 112, 1, crit ? T_WHITE : T_LINE);

  // ... then the severity bar along the left edge, full height (must be last so
  // the strip background cannot paint over its bottom 26 px)
  tft.fillRect(0, 0, 3, TFT_PANEL_H, crit ? T_DANGER : sevColorHex(telemetry.severity));

  uint16_t canC = crit ? T_WHITE : (device.obd_detached ? T_DANGER : T_ACCENT);
  icoCan(tft, 6, Y + 6, canC);
  tft.setFont(&FreeSansBold9pt7b);
  tft.setTextSize(1);
  tft.setTextColor(canC);
  tft.setCursor(22, Y + 18);
  tft.print(device.obd_detached ? "DET" : (telemetry.using_sim_data && !device.everSawOBD ? "SIM" : "CAN"));

  tft.fillRect(58, Y + 5, 1, 16, crit ? T_WHITE : T_LINE);

  if (device.connected) {
    icoBatt(tft, 62, Y + 6, crit ? T_WHITE : (device.device_pct < 20 ? T_DANGER : T_ACCENT),
            device.device_pct);
    tft.setFont(&FreeSansBold9pt7b);
    tft.setTextSize(1);
    tft.setTextColor(crit ? T_WHITE : (device.device_pct < 20 ? T_DANGER : T_INK));
    tft.setCursor(80, Y + 18);
    char b[8];
    snprintf(b, sizeof(b), "%u%%", (unsigned)device.device_pct);
    tft.print(b);
  } else {
    icoBatt(tft, 62, Y + 6, crit ? T_WHITE : T_MUTED, 0);
    tft.setFont(&FreeSansBold9pt7b);
    tft.setTextSize(1);
    tft.setTextColor(crit ? T_WHITE : T_MUTED);
    tft.setCursor(80, Y + 18);
    tft.print("--");
  }
}

// ==============================================================================================
// CAROUSEL ??? hold 4.2 s, glide 1.6 s, content rises from the bottom
// ==============================================================================================
void uiBlitAnimate(int16_t off) {
  if (off <= 0) return;
  int16_t top = TFT_VIEW_H - off;
  if (top > 0) {
    tft.drawRGBBitmap(0, 0, pageCanvas->getBuffer() + off * TFT_PANEL_W,
                      TFT_PANEL_W, top);                       // tail of the current page
  }
  tft.drawRGBBitmap(0, top, nextCanvas->getBuffer(),
                    TFT_PANEL_W, off);                         // head of the next page
}

void uiInit() {
  pageCanvas = new GFXcanvas16(TFT_PANEL_W, TFT_VIEW_H);
  nextCanvas = new GFXcanvas16(TFT_PANEL_W, TFT_VIEW_H);
  canvasOk   = (pageCanvas != NULL) && (nextCanvas != NULL) &&
               (pageCanvas->getBuffer() != NULL) && (nextCanvas->getBuffer() != NULL);
  if (!canvasOk) {
    delete pageCanvas; pageCanvas = NULL;
    delete nextCanvas; nextCanvas = NULL;
    Serial.println(F("[TFT] Not enough heap for page buffers -> static page fallback"));
  } else {
    Serial.printf("[TFT] Carousel live: %dx%d portrait (ST7735S), 5 pages, 2x%u-byte buffers\n",
                  TFT_PANEL_W, TFT_PANEL_H, (unsigned)(TFT_PANEL_W * TFT_VIEW_H * 2));
  }
  tft.fillScreen(T_BG);
  if (canvasOk) {
    renderPage(0, *pageCanvas);
    tft.drawRGBBitmap(0, 0, pageCanvas->getBuffer(), TFT_PANEL_W, TFT_VIEW_H);
  } else {
    renderPage(0, tft);
  }
  drawStrip();
  pageHoldStart = millis();
  calmLastDraw  = millis();
  lastLiveDraw  = millis();
}

void uiTick(unsigned long now) {
  bool wantCalm = device.everSawOBD ? (now - lastOBDDataTime > 10000) : false;
  if (wantCalm != uiCalm) {
    uiCalm = wantCalm;
    if (uiCalm) {
      if (canvasOk) { renderCalmFace(*pageCanvas);
                      tft.drawRGBBitmap(0, 0, pageCanvas->getBuffer(), TFT_PANEL_W, TFT_VIEW_H); }
      else          { renderCalmFace(tft); }
      calmLastDraw = now;
      drawStrip();
      return;
    }
    pageHoldStart = now;
  }

  if (uiCalm) {
    if (now - calmLastDraw > 30000) {             // gentle 30 s refresh
      calmLastDraw = now;
      if (canvasOk) { renderCalmFace(*pageCanvas);
                      tft.drawRGBBitmap(0, 0, pageCanvas->getBuffer(), TFT_PANEL_W, TFT_VIEW_H); }
      else          { renderCalmFace(tft); }
      drawStrip();
    }
    return;
  }

  if (!canvasOk) {                                 // heap fallback: plain static pages
    static unsigned long lastFallback = 0;
    if (now - lastFallback >= 4200) {
      lastFallback = now;
      currPage = (currPage + 1) % 5;
      renderPage(currPage, tft);
      drawStrip();
    }
    return;
  }

  if (uiAnimating) {
    int16_t off = (int16_t)(((float)(now - uiAnimStart) * (float)TFT_VIEW_H) / 1600.0f);
    if (off > TFT_VIEW_H) off = TFT_VIEW_H;
    if (off > 0) uiBlitAnimate(off);
    if (off >= TFT_VIEW_H) {
      GFXcanvas16* tmp = pageCanvas;
      pageCanvas = nextCanvas;
      nextCanvas = tmp;
      currPage   = (currPage + 1) % 5;
      pageHoldStart = now;
      uiAnimating   = false;
    }
  } else {
    if (now - lastLiveDraw >= 500) {               // live refresh (values + fault band)
      lastLiveDraw = now;
      renderPage(currPage, *pageCanvas);
      tft.drawRGBBitmap(0, 0, pageCanvas->getBuffer(), TFT_PANEL_W, TFT_VIEW_H);
    }
    if (now - pageHoldStart >= 4200) {             // start the glide to the next page
      renderPage((currPage + 1) % 5, *nextCanvas);
      uiAnimStart = now;
      uiAnimating = true;
    }
  }
  drawStrip();
}

#endif // USE_TFT
