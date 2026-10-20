# Device Registration & Tagging — Implementation Plan (hand-off for the UI agent)

> **Owner split**
> - **Backend (ESP32 firmware)** — implemented by the hardware side. Contract is *frozen* in §3 so the UI can start now.
> - **UI (web app)** — screens, flows and states described in §4–§6. Mock payloads for offline UI work are in §7.
>
> No app files are touched by the backend work. The UI agent owns `app.js`, `index.html`, `styles.css`, `fleet.html`.

---

## 1. The concept

Every physical gateway node (the ESP32 + MS309 board) is a **device** with a permanent, unchangeable **tag** derived from the ESP32's factory MAC:

```
KA-GW-7F3A21        ← device tag (stable, derived from chip MAC, no factory provisioning)
```

A device is then **registered against a vehicle**. The vehicle is identified by its **VIN** (17 characters) — the ESP32 reads it *by itself* over OBD Mode 09, so the human never has to type it:

```
Device KA-GW-7F3A21  ──registered──▶  Vehicle VIN 1HGCM82633A004352  (Kolls Autotronics Test Vehicle)
```

**Why VIN as the vehicle key**
| Key | Problem |
|---|---|
| Plate / number plate | changes when the vehicle is re-registered or moved between states |
| OBD user-set ID | may be blank, duplicated, or reset by the ECU |
| **VIN** | **globally unique, physically tied to the vehicle, readable by the ECU** ✅ |

---

## 2. Device lifecycle (the states the UI must render)

| State | Backend flag | Meaning | UI treatment |
|---|---|---|---|
| `UNREGISTERED` | `registered: false` | Tag known, no vehicle bound | Blue **"Needs registration"** CTA |
| `WAITING_FOR_VIN` | `registered: false`, `vin: ""` | ECU didn't answer Mode 09 | Ask the user to enter the VIN manually |
| `REGISTERED` | `registered: true` | Bound to a vehicle | Green **"Paired"**, show vehicle name + VIN |
| `OBD_DETACHED` | `gateway.obd_detached: true` | Device online but unplugged from the car | Amber **"OBD disconnected"** |
| `OFFLINE` | no heartbeat > 120 s | Device not reporting | Grey row + "last seen 4 min ago" |
| `LOW_PACK` | `gateway.device_pct < 20` | Gateway 18650 nearly flat | Amber battery pill, "charge soon" |

The binding is stored in the device's **NVS flash**, so it survives unplugging, power loss and reflash of the application firmware. The app keeps a **local mirror** of the bindings, so a device can be re-registered while it is offline.

---

## 3. Backend contract (frozen — build against this)

### 3.1 Identity fields added to the existing payloads

| Field | Type | Source | Notes |
|---|---|---|---|
| `device_id` | string | ESP32 MAC | `KA-GW-XXXXXX`, permanent, shown on the TFT |
| `vin` | string | OBD Mode 09 PID 02 | 17 chars, `""` if the ECU won't answer |
| `registered` | bool | NVS | true once bound to a vehicle |
| `vehicle_id` | string | NVS | fleet-internal id, e.g. `KA-TRUCK-001` |
| `vehicle_name` | string | NVS | human label shown in the UI |

### 3.2 Topics

| Direction | Topic | Payload |
|---|---|---|
| device → app | `kolls/vehicle/telemetry` | existing engineering schema **+** `device_id`, `vin`, `registered`, `vehicle_id`, `vehicle_name` (2 s cadence) |
| device → app | `kolls/vehicle/{vehicle_id}/app` | existing app-shaped payload **+** the same 5 identity fields (2 s cadence) |
| device → app | `kolls/registry/devices` | **heartbeat, every 30 s** — see §3.3 |
| app → device | `kolls/device/{device_id}/config` | **registration command** — see §3.4 |
| device → app | `kolls/device/{device_id}/registered` | **ack** — confirms the NVS write, see §3.5 |
| app → device | `kolls/vehicle/{vehicle_id}/commands` | existing (`PING`, `RESET_TAMPER`) |

### 3.3 Registry heartbeat — `kolls/registry/devices` (every 30 s)

```json
{
  "device_id":      "KA-GW-7F3A21",
  "vin":            "1HGCM82633A004352",
  "vehicle_id":     "KA-TRUCK-001",
  "vehicle_name":   "Kolls Autotronics Test Vehicle",
  "registered":     true,
  "fw_version":     "2.2-battery",
  "uptime_sec":     3812,
  "rssi":           -58,
  "ip":             "192.168.1.42",
  "can_feed":       "HARDWARE_CAN",
  "obd_detached":   false,
  "device_v":       "3.87",
  "device_pct":     66,
  "last_seen_ms":   1774123456789
}
```

> The app builds its **device roster** from this heartbeat, then enriches each device with the live telemetry stream.

### 3.4 Registration command — app → `kolls/device/{device_id}/config`

```json
{
  "vehicle_id":   "KA-TRUCK-001",
  "vehicle_name": "Kolls Autotronics Test Vehicle",
  "vin":          "1HGCM82633A004352",
  "plate":        "ABC-123-L",
  "action":       "register"
}
```

| `action` | Effect on the device |
|---|---|
| `register` | write binding to NVS, start publishing under the new `vehicle_id` |
| `unregister` | clear the binding (device goes back to `UNREGISTERED`) |
| `update` | change name/plate only, keep the binding |

The VIN in the command is optional — if the device already read it, the app may omit it and the device keeps its own value.

### 3.5 Ack — device → `kolls/device/{device_id}/registered`

```json
{
  "device_id":    "KA-GW-7F3A21",
  "status":       "OK",            // OK | ERROR | UNKNOWN_DEVICE
  "registered":   true,
  "vehicle_id":   "KA-TRUCK-001",
  "vehicle_name": "Kolls Autotronics Test Vehicle",
  "vin":          "1HGCM82633A004352",
  "message":      "Binding stored in NVS"
}
```

The UI should **wait for this ack** before showing "Paired" — the write is confirmed by the device, not assumed by the sender.

---

## 4. UI work — what to build

### 4.1 Onboarding / "Register a device" flow (new)

```
[+] Add device
   ├─ Step 1: enter or scan the tag      → KA-GW-7F3A21
   │          (manual entry + paste support; QR is a future option)
   ├─ Step 2: pick / create the vehicle   → list of vehicles + "new vehicle"
   ├─ Step 3: confirm VIN                 → prefilled from device, editable if empty
   └─ Step 4: send config, await ack      → spinner → "Paired ✓" / error
```

- The **tag is the only thing the user must read off the device** (the TFT shows it large, on its own page).
- If the device is already bound, the flow must **warn and offer re-assignment** ("KA-GW-7F3A21 is currently paired to KA-TRUCK-001").
- The whole flow must work for an **offline** device (queue the config and send when the heartbeat returns).

### 4.2 Device roster (extend the existing fleet page)

Each device row should show:

| Element | Source |
|---|---|
| Tag `KA-GW-7F3A21` | `device_id` |
| Bound vehicle (name + plate) | `vehicle_name` / `vehicle_id` |
| VIN | `vin` |
| Status pill | `registered` / `obd_detached` / heartbeat age |
| Gateway battery pill | `gateway.device_pct` (⚠️ the **18650**, not the car battery) |
| Signal | `rssi` |
| Link to vehicle detail | `vehicle_id` |

### 4.3 Unpaired-device inbox

A strip/section on the fleet overview:

> **1 device needs registration — `KA-GW-7F3A21`** → *Register now*

Devices appear here when the heartbeat arrives with `registered: false`.

### 4.4 Vehicle detail page — pairing block

- Gateway tag + VIN + pairing status
- Actions: **Re-assign device**, **Unpair**, **Rename vehicle**
- If no device is paired: *"This vehicle has no gateway — live diagnostics unavailable"* + *Pair a device*

### 4.5 States to handle everywhere

| Condition | UI response |
|---|---|
| device offline (no heartbeat > 120 s) | grey out the row, show "last seen Xm ago", keep the binding |
| `registered:false` | blue CTA, exclude the device from live vehicle metrics |
| `obd_detached:true` | amber badge "OBD disconnected" even though the device is online |
| `vin:""` | manual VIN entry field in the pairing flow |
| two devices claim the same vehicle | the app shows a conflict warning and offers to release one |
| unknown tag in a config command | ack with `status:"UNKNOWN_DEVICE"` — the UI shows "device not seen (check the tag)" |

---

## 5. Data-binding cheat sheet (app field ← payload key)

| App element | Payload key | Watch out |
|---|---|---|
| Health ring | `score` (app-shaped topic) | already derived on the device |
| "Battery" vital card | `battery` | **vehicle** 12 V system — NOT `gateway.device_v` |
| "Engine temp" card | `coolant` | °C |
| Fuel range / fuel % | `range` / `fuel` | `null` if the ECU has no PID 0x2F |
| System rows | `systems.engine|cooling|electrical|brakes` | derived on the device |
| Gateway battery | `gateway.device_pct` / `gateway.device_v` | the 18650 pack (≈3.9 V) |
| Device tag | `device_id` | new |
| VIN | `vin` | new, 17 chars |
| Pairing state | `registered` | new |
| OBD unplug | `gateway.obd_detached` | new |

---

## 6. End-to-end acceptance test

1. Flash a device → TFT shows tag `KA-GW-XXXXXX`; app sees it in the **unpaired inbox** within 30 s (heartbeat).
2. Plug it into a car with the ignition on → within ~10 s the device reads the **VIN** and publishes it; the app row shows the VIN.
3. Register the tag against a vehicle → ack received → row flips to **Paired**, and the device starts publishing under `kolls/vehicle/{vehicle_id}/...`.
4. Unplug the OBD plug (device still powered) → app shows **OBD disconnected**, `disconnect_count` increments.
5. Power-cycle the device → binding still present (NVS) and the app still shows it paired.
6. Two devices, two cars → no cross-talk; each publishes under its own `vehicle_id`.
7. Unpair from the UI → device returns to `UNREGISTERED` and stops publishing under the old vehicle id.

---

## 7. Mock payloads (paste into the UI agent's fixtures)

**Unregistered device heartbeat**
```json
{"device_id":"KA-GW-7F3A21","vin":"","vehicle_id":"","vehicle_name":"","registered":false,
 "fw_version":"2.2-battery","uptime_sec":128,"rssi":-61,"ip":"192.168.1.51",
 "can_feed":"HARDWARE_CAN","obd_detached":false,"device_v":"3.91","device_pct":72,
 "last_seen_ms":1774123456789}
```

**Registered device heartbeat**
```json
{"device_id":"KA-GW-7F3A21","vin":"1HGCM82633A004352","vehicle_id":"KA-TRUCK-001",
 "vehicle_name":"Kolls Autotronics Test Vehicle","registered":true,"fw_version":"2.2-battery",
 "uptime_sec":3812,"rssi":-58,"ip":"192.168.1.42","can_feed":"HARDWARE_CAN",
 "obd_detached":false,"device_v":"3.87","device_pct":66,"last_seen_ms":1774123456789}
```

**App-shaped telemetry with identity**
```json
{"vehicle_id":"KA-TRUCK-001","name":"Kolls Autotronics Test Vehicle","live":true,"score":87,
 "battery":"13.82","coolant":"88.4","oil_temp":"95.2","rpm":2450,"fuel":62,"range":372,
 "odometer_km":128430,"systems":{"engine":95,"cooling":88,"electrical":97,"brakes":84},
 "status":"NOMINAL","severity":0,"tone":"good",
 "device_id":"KA-GW-7F3A21","vin":"1HGCM82633A004352","registered":true,
 "vehicle_name":"Kolls Autotronics Test Vehicle",
 "gateway":{"device_v":"3.87","device_pct":66,"obd_detached":false,"disconnect_count":0,
            "can_feed":"HARDWARE_CAN","fw_version":"2.2-battery","tires_available":false}}
```

---

## 8. Open decisions (need a call before the UI is finalised)

| # | Question | Default if no answer |
|---|---|---|
| 1 | Separate **Devices** tab, or merge devices into the existing Vehicles list? | merged, with an "unpaired" strip on top |
| 2 | Tag format on the device: `KA-GW-XXXXXX` (MAC) or a short 6-char code? | `KA-GW-XXXXXX` |
| 3 | Should the app allow **re-assigning** a device that is already paired? | yes, with a warning |
| 4 | Offline registration (queue + send on reconnect) — in scope? | yes, queued in local storage |
| 5 | Do we need a **QR code on the TFT** for fast tag entry? | not in v1 (128×160 is too small for a scannable QR) |

---

## 9. Backend timeline (for planning)

| Step | Status |
|---|---|
| v2.1 — app-shaped payload + derived scores + fuel/odometer PIDs | ✅ done, compiles (75% flash, 15% RAM) |
| v2.2 — device tag (MAC), VIN reader (Mode 09 + ISO-TP flow control), NVS binding, registry heartbeat, config/ack topics | ⏭️ next — **detailed in §10** |
| v2.3 — MAF + VSS for real fuel economy (fills the app's fuel-economy chart) | optional |
| TPMS (tyre pressure) | ⚠️ not feasible on generic Mode 01 — needs ISO-TP Mode 22 per wheel |

---

## 10. ESP32 firmware implementation plan (v2.2) — backend detail

> This section is the **hardware-side contract and build plan**. The UI agent only needs §3 (topics/fields) and §7 (mocks); this is for whoever implements/verifies the firmware.

### 10.1 Scope & files

| Item | Value |
|---|---|
| Sketch | `ESP32_Battery_CAN_Gateway/ESP32_Battery_CAN_Gateway.ino` (folder name must equal sketch name for the Arduino IDE) |
| New library | **none** — `Preferences` ships with the ESP32 core (verified: `hardware/esp32/3.3.12/libraries/Preferences`) |
| New headers | `#include "esp_mac.h"` (IDF, present in `tools/esp32-libs/3.3.12/include/esp_hw_support/include/`) and `#include <Preferences.h>` |
| Touches | this sketch only — **no app files**, no change to `ESP32_Vehicle_Prototype/` (v1.0 stays as the car-powered reference) |
| Flash/RAM impact | +~6 KB flash, +~2 KB RAM, 4 KB NVS partition — the ~278 KB free heap is unaffected (carousel buffers still fit) |

### 10.2 New modules & function surface

```cpp
// ---- identity -------------------------------------------------------------
void   initDeviceIdentity();          // derive the tag from the chip MAC at boot
const char* deviceTag();              // "KA-GW-7F3A21"

// ---- VIN reader -----------------------------------------------------------
enum VinState { VIN_IDLE, VIN_REQUESTED, VIN_COLLECTING, VIN_DONE, VIN_FAILED };
void   initVinReader();
void   cycleVinRequests();             // non-blocking scheduler, called every loop()
bool   sendVinRequest();               // emits the 09 02 frame on 0x7DF
void   handleVinFrame(const twai_message_t& m);  // parse frames + send flow control
bool   isValidVin(const String& s);    // 17 chars, VIN alphabet (no I/O/Q)

// ---- registration (NVS) ---------------------------------------------------
void   loadRegistration();             // read binding at boot
bool   saveRegistration(const String& vehicleId, const String& name,
                        const String& vin, const String& plate);
void   clearRegistration();
bool   isRegistered();

// ---- MQTT plumbing --------------------------------------------------------
void   publishRegistryHeartbeat();     // every 30 s -> kolls/registry/devices
void   publishRegistrationAck(const char* status, const char* message);
bool   handleConfigCommand(const char* payload);   // parse + act + ack
```

### 10.3 Device tag derivation

```cpp
#include "esp_mac.h"
uint8_t mac[6];
esp_read_mac(mac, ESP_MAC_WIFI_STA);
snprintf(deviceId, sizeof(deviceId), "KA-GW-%02X%02X%02X", mac[3], mac[4], mac[5]);
```

- Last **3 bytes** of the MAC → 6 hex chars, short enough to type on a phone, still unique per unit.
- The **full MAC** is published in the registry heartbeat (`mac`) for auditability.
- Fallback if `esp_read_mac` is unavailable: `WiFi.macAddress()` (pure Arduino API).

### 10.4 VIN acquisition — the hard part (Mode 09 + ISO-TP)

OBD Mode 09 (Request Vehicle Information), PID `0x02` (VIN) returns **17 ASCII characters split over 3–4 CAN frames**, so a flow-control handshake is mandatory. Sequence:

```
ESP ──► bus  0x7DF : 02 09 02 00 00 00 00 00      "give me the VIN"
ECU ──► 0x7E8 : 10 14 49 02 '0''1''2''3'          first frame (FF=0x10, len=0x14=20)
ESP ──► 0x7E8 : 30 00 00 00 00 00 00 00          FLOW CONTROL (CTS, unlimited block, seq 0)
ECU ──► 0x7E8 : 21 49 02 '4''5''6''7'            consecutive frame 1
ECU ──► 0x7E8 : 22 49 02 '8''9''A''B'            consecutive frame 2
ECU ──► 0x7E8 : 23 49 02 'C''D''E''F''G' + pad  consecutive frame 3 (padded 0x20/0x00)
```

Implementation rules:
- **Flow control is mandatory** — without it the ECU stops after the first frame and the VIN never completes.
- Parse tolerantly: take printable ASCII from **byte 3** of every frame whose bytes 1–2 are `0x49 0x02`; stop at 17 characters, or at the first space/NUL pad.
- **VIN alphabet excludes `I`, `O`, `Q`** → `isValidVin()` rejects a string containing them (a common symptom of a mis-parsed frame).
- Many ECUs answer Mode 09 **only with the engine running**; a few brands disable Mode 09 entirely → see the fallback below.

### 10.5 VIN reader state machine & timings

| Constant | Value | Purpose |
|---|---|---|
| `VIN_REQUEST_INTERVAL_MS` | 15000 | retry cadence until the VIN is captured |
| `VIN_REQUEST_TIMEOUT_MS` | 5000 | per-request deadline |
| `VIN_MAX_ATTEMPTS` | 8 | after this → `VIN_FAILED` (≈2 min of trying) |

States: `IDLE → REQUESTED → (first frame) → COLLECTING → DONE` / `→ FAILED`.
On `FAILED` the device publishes `vin: ""` and a flag `vin_supported: false`; the UI then asks the user to type the VIN, and the value can be supplied through the **config command** (§3.4) instead of being read from the bus.

### 10.6 NVS layout (Preferences, namespace `kolls`)

| Key | Type | Content |
|---|---|---|
| `reg_vin` | string | 17-char VIN |
| `reg_vid` | string | `vehicle_id` (e.g. `KA-TRUCK-001`) |
| `reg_name` | string | `vehicle_name` |
| `reg_plate` | string | plate (optional) |
| `reg_ts` | uint64 | registration timestamp |
| `reg_v` | uint8 | schema version (for future migrations) |
| `reg_commit` | uint8 | power-loss-safe commit flag |

**Write safety:** Preferences has no atomic rename, so use the pattern *write all fields → then set `reg_commit = 1`*. On boot, if `reg_commit != 1` the binding is treated as invalid (a write that was cut off by a power loss is discarded instead of half-applied).

### 10.7 MQTT behaviour

- On connect, subscribe to **both** `kolls/vehicle/{id}/commands` (existing) **and** `kolls/device/{device_id}/config` (new).
- The registry heartbeat every 30 s doubles as the "device is alive" signal and as MQTT keep-alive traffic.
- **No retained messages** on the config topic — a retained command would re-fire the registration on every reconnect. The UI must re-send deliberately.
- QoS 0 everywhere; the config payload is tiny (< 200 bytes), well inside the 640-byte `setBufferSize()`.

### 10.8 Payload augmentation (both existing topics)

Added to `kolls/vehicle/telemetry` (top level) **and** `kolls/vehicle/{id}/app`:

```json
"device_id":     "KA-GW-7F3A21",
"vin":           "1HGCM82633A004352",
"registered":    true,
"vehicle_id":    "KA-TRUCK-001",
"vehicle_name":  "Kolls Autotronics Test Vehicle"
```

`registered` is `false` and `vehicle_id`/`vehicle_name` are empty strings until a binding exists.

### 10.9 TFT changes

| Screen | Change |
|---|---|
| Splash | show the tag large — it is the one thing a human reads off the device |
| NODE page (carousel page 3) | new rows: `TAG KA-GW-XXXXXX`, `VIN 1HGCM8…A004352` (truncated), and a pairing pill `PAIRED` (green) / `UNPAIRED` (amber) / `VIN?` (amber, when the ECU refuses Mode 09) |

### 10.10 Failure-mode matrix

| Symptom | Detection | Device behaviour | UI signal |
|---|---|---|---|
| ECU has no Mode 09 | 8 failed attempts | `vin:""`, `vin_supported:false` | "VIN unavailable — enter manually" |
| Mode 09 needs engine running | no response while cranked | retries every 15 s | "Turn ignition on / start engine" |
| VIN frame mis-parsed | fails `isValidVin()` | discard, retry | — |
| OBD unplugged after binding | CAN silence | `obd_detached:true`, binding kept | amber "OBD disconnected" |
| Device unpaired by the UI | `action:"unregister"` | NVS cleared, publishes `registered:false` | back to the unpaired inbox |
| Config for an unknown tag | topic has no subscriber | no ack | UI: "device not seen (check the tag)" |

### 10.11 Bench test procedure (serial monitor at 115200)

1. **Boot** → expect `[ID] Device tag: KA-GW-7F3A21` and `[REG] no binding found (unregistered)`.
2. **No car attached** → expect `[VIN] request 1/8 … timeout` every 15 s.
3. **Plug into a running car** → expect `[VIN] captured: 1HGCM82633A004352 (17 chars)`.
4. **Send a config command** (`mosquitto_pub -h broker.hivemq.com -t 'kolls/device/KA-GW-7F3A21/config' -m '{"action":"register","vehicle_id":"KA-TRUCK-001","vehicle_name":"Test Truck"}'`) → expect the ack on `kolls/device/KA-GW-7F3A21/registered` with `"status":"OK"`.
5. **Power-cycle the device** → expect `[REG] binding restored: KA-TRUCK-001` (NVS survived).
6. **Watch the heartbeat** → `kolls/registry/devices` shows the tag, VIN, vehicle id, RSSI, uptime.
7. **Unplug the OBD plug** (device still powered) → expect `[SECURITY] OBD-DETACH` and `disconnect_count` incrementing in the next payload.

### 10.12 Implementation order

| # | Step | ~Effort |
|---|---|---|
| 1 | `initDeviceIdentity()` + tag on the TFT splash | 30 min |
| 2 | Registration struct + NVS load/save/clear | 45 min |
| 3 | Config command parsing + ack publisher | 45 min |
| 4 | Identity fields added to both payloads | 20 min |
| 5 | Registry heartbeat publisher (30 s) | 20 min |
| 6 | VIN reader: request + ISO-TP flow control + parser | 90 min |
| 7 | VIN failure handling + manual-override path | 30 min |
| 8 | TFT NODE page rows + pairing pill | 30 min |
| 9 | Bench test (§10.11) + recompile | 60 min |

### 10.13 Backend questions for the UI agent

1. Should a device accept a **config command while unregistered**? (default: yes — that is the normal onboarding path)
2. Should the UI ever send `action:"register"` for a device it has **never seen** (so the command waits in the broker)? (default: no — a device that has never published cannot be paired; show "device not seen")
3. Do you want the **plate** field stored on the device as well, or is it app-only? (default: stored, harmless)
4. Is `KA-GW-XXXXXX` the tag format you want on the device label, or a shorter human code? (default: as specified)

---

*Backend questions for the UI agent: send them back and the v2.2 firmware will implement the agreed contract.*
