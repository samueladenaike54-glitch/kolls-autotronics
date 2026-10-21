HEY — handing over the backend for the Saturday competition. Please read fully, then reply with a short "what I'll bind" list.

────────────────────────────────────────
CONTEXT
────────────────────────────────────────
We have a competition on Saturday. The backend is DONE and flash-ready. The only
thing missing is the app binding live values to the UI you are building.

**Transport (updated):** the gateway now publishes to **EMQX Serverless over TLS
(8883)** with username/password auth, and the app subscribes over **WSS**. Because
the hosted site is `https://` and the broker link is `wss://`, there is **no
mixed-content block** — the demo runs from a phone with **no local server and no
laptop**. The local-HTTP `?gateway=` direct-connect path remains as a fallback
(it needs the app served over `http://`).

The hardware/firmware side is DONE and flash-ready. The only thing missing is the
app binding live values to the UI you are building.

────────────────────────────────────────
WHAT YOU NEED TO DO (small, specific)
────────────────────────────────────────
1) Add ONE constant near the top of app.js:

     const GATEWAY = 'http://192.168.43.123';   // ESP IP — shown on the gateway's TFT

2) Poll it once per second and feed your existing render functions:

     let live = null;
     async function pollGateway() {
       try {
         const res = await fetch(`${GATEWAY}/telemetry`, { cache: 'no-store' });
         live = await res.json();
         render(live);
       } catch (e) {
         live = null;            // keep the last good frame, show "device offline"
       }
     }
     setInterval(pollGateway, 1000);

   The gateway sends `Access-Control-Allow-Origin: *`, so a page served from
   GitHub Pages can fetch it cross-origin. No proxy, no CORS config, no MQTT library.

3) PAYLOAD — this is the exact shape (it is identical to the MQTT topic
   kolls/vehicle/KA-TRUCK-001/app, so you can wire either path):

     {
       "vehicle_id": "KA-TRUCK-001",
       "name":       "Kolls Autotronics Test Vehicle",
       "live":       true,
       "score":      87,                 // composite health 0-100  → health ring
       "battery":    "13.82",            // ⚠ VEHICLE 12 V system → "Battery" card
       "coolant":    "88.4",             // °C                      → "Engine temp" card
       "oil_temp":   "95.2",             // ➕ new
       "rpm":        2450,               // ➕ new
       "fuel":       62,                 // % or null (ECU may not support PID 0x2F)
       "range":      372,                // km or null
       "odometer_km":128430,             // ➕ new → service-interval wear rows
       "systems": { "engine":95, "cooling":88, "electrical":97, "brakes":84 },
       "status": "NOMINAL", "severity": 0, "tone": "good",     // good|warn|danger
       "gateway": {
         "device_v": "3.87",   // ⚠ THE 18650 PACK (~3.9 V) — NOT the car battery
         "device_pct": 66,     // gateway battery %
         "obd_detached": false,
         "disconnect_count": 0,
         "can_feed": "HARDWARE_CAN",      // or "SIMULATED"
         "ip": "192.168.43.123", "wifi_rssi": -58, "uptime_sec": 3812,
         "fw_version": "2.2-direct", "tires_available": false
       }
     }

4) ⚠️ THE ONE TRAP: `battery` is the CAR's 12 V system. `gateway.device_v` /
   `gateway.device_pct` is the GATEWAY's own 18650 pack. Do not put them in the
   same widget — the "Battery" card will show 3.9 V and look broken.

5) `fuel` and `range` can be `null` (some ECUs don't report fuel level) and
   `tires_available` is `false` (no TPMS PID) — keep your static tyre data and
   hide the fuel card rather than printing "null".

6) If the fetch fails (device off / different network), fall back to the MQTT
   broker path you may already have, or just keep the last frame with a
   "device offline" badge. NEVER let the page go blank.

7) Optional but nice: `status` + `severity` + `tone` are already computed on the
   device, so you can colour the header/ring from `tone` instead of recomputing.

────────────────────────────────────────
WHAT IS ALREADY DONE — DO NOT REDO IT
────────────────────────────────────────
✔ ESP32 firmware: CAN/OBD-II PID polling, health model + subsystem scores on-device
✔ TFT 4-page scrolling cluster UI (KOLLS → ENGINE → NODE → NET)
✔ Anti-tamper: latched "OBD DETACHED" alert when the CAN feed goes silent
✔ Gateway battery fuel gauge (ADC divider) with low/critical escalation
✔ HTTP API:  /            → the gateway's OWN live dashboard (demo fallback)
                /telemetry  → the JSON above
                /health     → device identity/health blob
✔ mDNS alias: http://kolls-gw.local
✔ MQTT (broker) publishing still works as a secondary path
✔ SIM mode: with no car connected the device simulates realistic data, so you
  can develop against it RIGHT NOW without hardware.

────────────────────────────────────────
FILES — MINE, DON'T TOUCH
────────────────────────────────────────
ESP32_Battery_CAN_Gateway/   firmware (mine)
tools/                       schematic exporter (mine)
images/                      exported schematic PNG/SVG (mine)
docs/                        backend-endpoint.md, DEMO-RUNBOOK.md,
                             device-registration-plan.md, wiring-schematic-battery.html
app.js, index.html, styles.css, fleet.html, fleet.css, web-dashboard/*  → YOURS

────────────────────────────────────────
DEADLINES
────────────────────────────────────────
Fri evening : app polls the gateway and renders live values (even just the 3 vital cards)
Sat morning : 15-minute rehearsal on the venue hotspot — laptop + ESP on the SAME
               phone hotspot, open http://<ESP-IP>/ and your app, confirm live numbers
Sat        : demo

────────────────────────────────────────
DOCS TO READ
────────────────────────────────────────
docs/DEMO-RUNBOOK.md              §5 has the exact integration snippet + demo script
docs/backend-endpoint.md          full API contract + every field's meaning
docs/device-registration-plan.md  post-competition roadmap (device tags/VIN/fleet) —
                                  NOT needed for Saturday, just FYI

────────────────────────────────────────
PLEASE REPLY WITH
────────────────────────────────────────
(a) which payload fields map to which of your UI elements,
(b) whether you want the MQTT fallback wired in as well,
(c) anything in the payload you need that isn't there (add it to the list and
    I'll add it to the firmware before Saturday).
