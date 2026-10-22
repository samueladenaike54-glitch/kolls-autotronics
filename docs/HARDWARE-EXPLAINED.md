# 🛠️ Kolls Autotronics — Hardware Explained (complete)

> Everything the physical device does, from the OBD socket to the cloud. Written for demo prep: know this and you can answer any judge question.

---

## 1. What the device is

A **battery-powered OBD-II gateway**: a small box that plugs into the car's diagnostic port, speaks **CAN bus** to the ECU, decodes the sensor data, runs a **health model on the microcontroller**, and streams the result three ways (TFT screen, local web API, cloud MQTT).

```
   CAR ECU ──CAN bus──▶ CAN TRANSCEIVER ──3.3V logic──▶ ESP32 ──┬──▶ 1.8" TFT carousel
   (via OBD-II)         (PCA82C250)                          ├──▶ 2. HTTP API (local)
                                                            └──▶ 3. MQTT/TLS → EMQX → web app
   18650 ──▶ 5V boost ──▶ ESP32 VIN + transceiver VCC
   18650 ──▶ 100k/100k divider ──▶ GPIO34 (ADC) = battery fuel gauge
```

**It draws zero power from the car.** The OBD port supplies data only; the purple (+12 V) wire is deliberately left unconnected. That means it can't drain the vehicle battery and keeps working after the ignition is off.

---

## 2. The CAN acquisition layer

**Bus:** ISO 11898-2 high-speed CAN at **500 kbps** (standard for passenger vehicles; heavy trucks use 250 kbps — a one-constant change).

**Protocol:** OBD-II **Mode 01 "Show Current Data"** — request/response. The ECU does *not* volunteer data, so the ESP actively asks:

| Step | Frame |
|---|---|
| ESP → bus | `0x7DF` : `02 01 <PID> 00 00 00 00 00` (broadcast request) |
| ECU → ESP | `0x7E8` : `41 <PID> <data…>` (response) |

**The PIDs the device requests** (one every 100 ms, ~900 ms for a full sweep):

| PID | Meaning | Decode |
|---|---|---|
| `0x0C` | Engine RPM | `((A×256)+B) / 4` |
| `0x05` | Coolant temp | `A − 40` (°C) |
| `0x04` | Calculated engine load | `(A×100) / 255` (%) |
| `0x0F` | Intake air temp | `A − 40` (°C) |
| `0x42` | Control-module voltage | `((A×256)+B) / 1000` (V) |
| `0x06` | Short-term fuel trim | `((A−128)×100) / 128` (%) |
| `0x07` | Long-term fuel trim | `((A−128)×100) / 128` (%) |
| `0x2F` | Fuel tank level | `A + B/255` (%) — `null` if unsupported |
| `0x31` | Odometer | 4-byte big-endian (km) |

**Why fuel trims matter:** they are the single most honest health signal a stock ECU exposes. A healthy engine sits within ±5 %; drift beyond ±8 % means an air/fuel problem even when no fault code is stored. The device's engine score is built on them.

**Active safety:** the device never writes to the bus — it only sends diagnostic *requests*, so it cannot disturb other systems in the car.

---

## 3. The transceiver (the part that touches the car's bus)

A CAN transceiver converts the differential bus (CANH/CANL) into logic levels for the microcontroller.

**Why it's the riskiest component:** the ESP32's GPIO is **3.3 V only**. The 82C250 runs on **5 V**, so its `RXD` output swings to 5 V — which would destroy an ESP32 input.

```
   RXD (5 V) ──[1k]──┬──[1k]──[1k]── GND
                     │
                     └──▶ ESP32 GPIO4      5 V × (2k / 3k) = 3.33 V
```

- `TXD` ← ESP32 GPIO5 (3.3 V drive is fine; the input threshold is ≈2.0 V)
- `RS` (pin 8) → **GND** — high would put the receiver in standby/high-Z
- `VREF` (pin 5) → left open
- `VCC` (pin 3) → the **5 V rail** (not 3.3 V)
- **No 120 Ω terminator on the module** — the car already has two (one at each end of the bus). A third would drop the bus to 40 Ω and cause intermittent errors.
- **Common ground is mandatory** — CAN has no ground reference; ESP32 GND must join OBD pins 4/5

---

## 4. Power system

| Stage | Detail |
|---|---|
| Cell | 18650 Li-ion, 3.0–4.2 V |
| Boost | → **5.0 V** rail (a *buck* cannot do this from one cell — it only steps down) |
| ESP32 | VIN ← 5 V (its onboard LDO makes 3.3 V for the GPIOs) |
| Transceiver | VCC ← 5 V rail |
| Fuel gauge | 18650+ → 100k → node → 100k → GND; node → **GPIO34** (ADC1) |
| Reading | `device_v = analogReadMilliVolts(GPIO34) × 2.0 / 1000` |
| SOC | 3.20 V = 0 %, 4.20 V = 100 % |
| Alerts | < 3.40 V → `DEVICE BATT LOW` (yellow) · < 3.10 V → `DEVICE BATT CRITICAL` (red, carousel freezes) |

**Why a fuel gauge at all:** the device is battery-powered, so the one thing that can kill a demo is a flat cell. The gauge is on the TFT, in the web app, and in the MQTT payload.

---

## 5. The on-device health model

Raw PIDs in, a verdict out — computed on the ESP32, not in the cloud. That is the product: **the device can judge the car by itself.**

| Score | Formula |
|---|---|
| `engine` | `100 − |STFT|·2.5 − |LTFT|·1.5 − load stress − coolant penalty` |
| `cooling` | `100` up to 88 °C, then `−4` per °C above |
| `electrical` | `100` at ≥13.5 V, then `−25` per volt below |
| `brakes` | `100 − (odometer mod 50 000)/500` (pad-life proxy) |
| **composite `score`** | `0.35·engine + 0.25·cooling + 0.20·electrical + 0.20·brakes − 6 (warning) − 22 (critical)` |

**Alert thresholds:** coolant ≥ 95 °C (warn) / ≥ 106 °C (critical) · vehicle 12 V < 11.8 V (warn) · RPM ≥ 4500 (redline) · device pack (see above).

**Honest limitation:** brakes and cooling have no OBD PID — these are *derived proxies* from odometer and coolant temperature, not direct measurements. The app labels them as subsystem scores, not sensor readings.

---

## 6. Anti-tamper (the OBD-unplug detector)

The device is battery-powered, so **pulling the OBD plug no longer cuts power** — the classic "voltage drops when disconnected" trick from the car-powered version is dead. The battery build detects it differently:

```
  was receiving ECU data  →  CAN goes silent for 6 s  →  LATCH "OBD DETACHED"
                                                        →  auto-clears when data returns
                                                        →  disconnect_count increments forever
```

Consequence for the demo: the screen can show a **live, connected** device that is nonetheless *not talking to the car* — which is exactly what a fleet manager needs to know.

---

## 7. The TFT cluster (128×160, ST7735)

- **4 pages, infinite carousel:** `KOLLS` (hero RPM + range bar + coolant/oil) → `ENGINE` (load bar, voltage, intake, STFT/LTFT signed bars) → `NODE` (pack, WiFi bars, MQTT, feed mode) → `NET` (IP, mDNS name, signal, uptime)
- **Scroll:** 2.6 s hold → 700 ms downward glide → wraps forever
- **Pinned 40 px footer** never scrolls: green `NOMINAL`, yellow `WARNING`, red/black strobe for critical
- **Zero flicker:** two 30 KB RAM canvases; each page is composed off-screen and pushed as one bitmap. A partial redraw only repaints the digits that changed.
- **Critical freeze:** when severity = 2 the carousel stops so the strobing footer can't be missed
- **Positions dots** in the header show which page you're on

---

## 8. Three ways out of the device

| Output | Where | Needs internet? |
|---|---|---|
| **TFT** | on the device | ❌ |
| **HTTP API** | `http://<ip>/` (its own dashboard), `/telemetry` (JSON, CORS open), `/health` | ❌ (local) |
| **MQTT/TLS** | EMQX Serverless `…emqxsl.com:8883` → `kolls/vehicle/telemetry` + `kolls/vehicle/{id}/app` | ✅ |

Plus **mDNS**: `http://kolls-gw.local/` so you never type an IP.

The app can consume any of them: MQTT over WSS from the hosted site (no laptop needed), or direct HTTP if served locally.

---

## 9. Incoming commands

| Command | Effect |
|---|---|
| `PING` | device replies `{"response":"PONG","status":"ONLINE"}` |
| `RESET_TAMPER` | clears a latched OBD-detach alert (e.g. a planned unplug) |

---

## 10. Bench simulator (why the demo never dies)

If the CAN bus is silent for 3.5 s, the device **feeds itself realistic data** — RPM curves, thermal drift, alternator ripple, and scripted anomalies (coolant overheat, high-RPM stress). The dashboard, the health model, the alerts and the carousel all keep working with **no car attached**. A judge plugging in and unplugging the OBD plug sees the real thing; a failure on stage degrades into a live demo rather than a dead screen.

---

## 11. What it does *not* do (say this honestly)

| Not supported | Why |
|---|---|
| Tyre pressure | TPMS needs ISO-TP Mode 22 per wheel — rarely supported by stock ECUs |
| Real fuel economy (L/100 km) | needs MAF + VSS + fuel-flow PIDs (planned, not implemented) |
| Instantaneous fuel economy | no standard OBD PID |
| Read/write of ECU fault codes | Mode 03/07 (clearing codes) is deliberately **not** implemented — dangerous on a live car |
| Per-wheel data | requires manufacturer-specific extended PIDs |

---

## 12. Build facts (for the "how is it built?" question)

| Item | Value |
|---|---|
| MCU | ESP32-WROOM-32, dual-core, 240 MHz, 4 MB flash |
| Framework | ESP32 Arduino core 3.3.12, `driver/twai.h` (hardware CAN) |
| Libraries | PubSubClient, ArduinoJson 7, WebServer, ESPmDNS, Adafruit GFX + ST7735 — all stock or core-bundled |
| Flash use | 1,148,043 B (87 %) |
| RAM use | 52,288 B global (15 %), ~275 KB heap free |
| CAN | hardware TWAI controller, 500 kbps, 16-frame RX queue, accept-all filter |
| Boot time | splash → WiFi → CAN → HTTP → MQTT, then live within ~3 s |

---

*Related: `DEMO-RUNBOOK.md` (how to show it) · `backend-endpoint.md` (API contract) · `wiring-schematic-battery.html` (wiring) · `device-registration-plan.md` (roadmap)*
