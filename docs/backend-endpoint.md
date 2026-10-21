# Backend Endpoint Contract — ESP32 Telemetry Node (v2.1)

> **For the web/app agent:** this is the live backend endpoint that the vehicle hardware publishes to. No app code was modified to write this. The firmware publishes **two** topics: a raw engineering schema, and an **app-shaped payload that mirrors the dashboard's existing data model field-for-field** (see §3) so you can bind live values straight into the current render functions with no translation layer.

## 0. Data-model comparison (app display vs. what the ESP actually gets)

| What the app displays today | App field | ESP source | Status |
|---|---|---|---|
| Health score ring (87) | `score` / `baseScore` | **derived** on ESP from trims/coolant/voltage/odometer | ✅ now supplied (v2.1) |
| Vital card "Battery" (13.8 V) | `battery` | PID `0x42` control-module voltage | ✅ direct |
| Vital card "Engine temp" (88 °C) | `coolant` | PID `0x05` coolant temp | ✅ direct |
| Vital card "Fuel range" (680 km) | `range` | PID `0x2F` fuel level × tank range | ✅ now supplied (v2.1) |
| Fuel % (75) | `fuel` | PID `0x2F` | ✅ now supplied (v2.1) |
| System rows engine/cooling/electrical/brakes % | `systems{}` | **derived** on ESP (no such PIDs exist) | ✅ now supplied (v2.1) |
| Service wear % (PARTS) | `PARTS[].usedKm` | PID `0x31` odometer | ✅ now supplied (v2.1) |
| Tire pressure (4 corners, PSI) | `tires[]` | TPMS — no standard Mode-01 PID on most vehicles | ⚠️ **not available** → `gateway.tires_available:false` |
| Battery voltage 14-day chart | history | app-side local storage | ℹ️ app concern |
| Fuel economy chart | history | needs MAF + VSS + fuel-flow PIDs (`0xAF`/`0x5E`) | ⚠️ partial — not published yet |
| "₦ saved" / repair costs | `repairs[]` | app-side business logic | ℹ️ app concern |
| — | — | **ESP extra:** rpm, oil temp, load %, fuel trims, IAT, gateway pack V/%, OBD-detach counter | ➕ new live data you can render |

> ⚠️ **Semantic trap:** the dashboard's `battery` means the **vehicle's 12 V system** (ESP `metrics.battery_v` = PID 0x42). The **gateway's own 18650 pack** is a different value (`metrics.device_v` / `gateway.device_v`, ≈3.9 V). Do not bind them to the same widget.

## 1. How the link works

```text
┌──────────────┐   CAN 500kbps    ┌──────────────────────┐   MQTT/TLS publish
│ Vehicle ECU  │ ◄──────────────► │ MS309-3 donor board  │───────────────┐
└──────────────┘   OBD-II pins    │ (8-pin transceiver)  │               ▼
                                  │ + ESP32 (TWAI+WiFi)  │    ┌─────────────────────┐
                                  └──────────────────────┘    │ EMQX Serverless     │
                                                              │ TLS 8883 (MQTT)    │
  Web / phone app (browser)  ◄── MQTT over WSS (8884) ────────│ 8884 (WebSocket)   │
                                                              └─────────────────────┘
```

- **Broker:** `l90668f6.ala.us-east-1.emqxsl.com` (EMQX Serverless)
- **Device → broker:** MQTT over **TLS on port 8883**, with username/password auth
- **App → broker:** MQTT over **WSS** (same hostname, WebSocket port) — a secure context, so a page served from GitHub Pages (**https**) can subscribe without any mixed-content problem and **without a local server or laptop**
- **Data topic:** `kolls/vehicle/telemetry` (ESP32 publishes here every **2 seconds**)
- **App-shaped topic:** `kolls/vehicle/KA-TRUCK-001/app` (the dashboard's live feed)
- **Command topic:** `kolls/vehicle/KA-TRUCK-001/commands` (app → ESP32)

> ⚠️ The demo credentials are compiled into the firmware **and** visible in the site's JavaScript. Rotate the password after Saturday.

## 2. Telemetry payload (published every 2 s)

All **v1.0 fields are unchanged**. New battery-edition fields are **additive only** (marked ➕).

```json
{
  "vehicle_id":      "KA-TRUCK-001",
  "timestamp_ms":    142850,
  "uptime_sec":      142,
  "can_feed":        "HARDWARE_CAN",        // "HARDWARE_CAN" | "SIMULATED" (bench mode)
  "fw_version": "2.0-battery",              // ➕ new
  "metrics": {
    "rpm":         2450,
    "coolant_c":   "88.4",
    "oil_c":       "95.2",
    "battery_v":   "13.82",                 // VEHICLE 12V system (PID 0x42)
    "load_pct":    45,
    "stft_pct":    "+1.2",
    "ltft_pct":    "-0.8",
    "iat_c":       "29.0",
    "device_v":    "3.87",                  // ➕ device 18650 pack voltage
    "device_pct":  66                       // ➕ device pack state of charge 0-100
  },
  "diagnostics": {
    "status":           "NOMINAL",
    "severity":         0,                  // 0 NOMINAL | 1 WARNING | 2 CRITICAL
    "tamper_alert":     false,              // true while a detach alert is latched
    "obd_detached":     false,              // ➕ latched OBD-unplug state
    "disconnect_count": 0,                  // ➕ lifetime OBD dropout events
    "device_low":       false               // ➕ device pack below warn threshold
  }
}
```

Note: `battery_v` is the **vehicle's** battery. The **device's** own pack is `device_v` / `device_pct` — don't conflate the two in the UI.

## 2b. ⭐ App-shaped payload (bind to this one)

**Topic: `kolls/vehicle/KA-TRUCK-001/app`** — published every 2 s alongside the raw topic.

Field names match the dashboard's current vehicle object (`CARS.suv`) so the existing render functions can consume them with a near-zero-diff binding:

```json
{
  "vehicle_id": "KA-TRUCK-001",
  "name":       "Kolls Autotronics Test Vehicle",
  "live":       true,
  "score":      87,                    // composite health 0-100  -> health ring
  "battery":    "13.82",               // vehicle 12 V system      -> "Battery" vital card
  "coolant":    "88.4",                // °C                       -> "Engine temp" vital card
  "oil_temp":   "95.2",                // ➕ new
  "rpm":        2450,                  // ➕ new
  "fuel":       62,                    // % (PID 0x2F) or null if unsupported
  "range":      372,                   // km (fuel% × 600 km full tank) or null
  "odometer_km": 128430,               // ➕ new (PID 0x31) -> service wear rows
  "systems": {
    "engine":     95,                  // derived
    "cooling":    88,                  // derived
    "electrical": 97,                  // derived
    "brakes":     84                   // derived (odometer proxy)
  },
  "status":   "NOMINAL",
  "severity": 0,
  "tone":     "good",                   // good | warn | danger  -> matches app tone classes
  "gateway": {
    "device_v":         "3.87",        // our 18650 pack (NOT the car battery)
    "device_pct":       66,
    "obd_detached":     false,
    "disconnect_count": 0,
    "can_feed":         "HARDWARE_CAN",
    "fw_version":       "2.1-battery",
    "tires_available":  false          // no TPMS PID -> app keeps its own tyre values
  }
}
```

**How the derived scores are computed** (all on the ESP, so the app stays dumb):

| Score | Formula |
|---|---|
| `systems.engine` | `100 − |STFT|·2.5 − |LTFT|·1.5 − load stress − coolant penalty` |
| `systems.cooling` | `100` up to 88 °C, then `−4 per °C` |
| `systems.electrical` | `100` at ≥ 13.5 V, then `−25 per volt` |
| `systems.brakes` | `100 − (odometer mod 50 000) / 500` (pad-life proxy) |
| `score` | `0.35·engine + 0.25·cooling + 0.20·electrical + 0.20·brakes − 6 (warning) − 22 (critical)` |

## 3. Status values (diagnostics.status)

| Status | Severity | Meaning |
|---|---|---|
| `NOMINAL` / `INITIALIZING` | 0 | All normal |
| `COOLANT HIGH` | 1 | Coolant ≥ 95 °C |
| `LOW BATTERY` | 1 | Vehicle 12V < 11.8 V |
| `DEVICE BATT LOW` | 1 | Our 18650 pack < 3.40 V |
| `RPM REDLINE` | 1 | RPM ≥ 4500 |
| `ENGINE OVERHEAT` | 2 | Coolant ≥ 106 °C |
| `DEVICE BATT CRITICAL` | 2 | Our pack < 3.10 V — charge now |
| `OBD DETACHED` | 2 | Latched: ECU feed went silent while node online (unplug / tamper) |
| `POWER TAMPER` / sim anomalies | – | Bench-demo injected values (only while `can_feed = "SIMULATED"`) |

## 4. Inbound commands (app → device)
Topic: `kolls/vehicle/KA-TRUCK-001/commands` · qos 0 · payload is plain text

| Payload | Device response |
|---|---|
| `PING` | publishes `{"response":"PONG","status":"ONLINE"}` on the telemetry topic |
| `RESET_TAMPER` | clears the latched `OBD DETACHED` alert (for planned unplug events) |

## 5. Hardware reality (battery build)

- ESP32 is powered from the **18650 pack** (boost/buck → 5.0V → VIN) — **no power is drawn from OBD pin 16** (purple wire unused).
- ESP32 `GND` must be tied to the OBD-II ground (black/blue wires, pins 4/5) — CAN has no common ground otherwise.
- ESP32 `3V3` feeds the transceiver VCC (pin 3); RXD pin 4 → GPIO4, TXD pin 1 → GPIO5 (trace cut isolates the board's old MCU); RS pin 8 → GND.
- Consequence of battery power: *unplugging the OBD plug no longer cuts device power*, so unplug detection is **CAN-silence latching** (`OBD DETACHED`), not the v1.0 voltage-drop trick. Disconnect events are counted in `disconnect_count`.

## 6. Firmware source

`ESP32_Battery_CAN_Gateway/ESP32_Battery_CAN_Gateway.ino` — same folder name = sketch name (required by Arduino IDE). Libraries: `PubSubClient`, `ArduinoJson`, optional `Adafruit ST7735` + `GFX` (toggle `USE_TFT 0` for a display-less unit).
