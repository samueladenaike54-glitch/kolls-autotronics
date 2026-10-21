# 🏁 DEMO RUNBOOK — Kolls Autotronics (Saturday)

> **Objective:** live vehicle data on screen in under 60 seconds, with **zero dependence on the internet or a cloud broker**.
> Direct-connect mode: the ESP32 hosts its own dashboard and JSON API on the local network.

---

## 1. The demo in one line

> "Plug this into the car. It talks to the ECU over CAN, decodes the OBD-II PIDs, and runs the health model **on the device** — and the whole thing is served straight from the gateway over WiFi."

---

## 2. Three ways to show it (use the best one that works)

| Mode | What the audience sees | Needs internet? | Use when |
|---|---|---|---|
| **C — Cloud MQTT ⭐** | The real app, fed by **EMQX Serverless** over WSS | ✅ yes (hotspot data) | **Main act.** Works from the hosted site, phone or laptop — no local server |
| **B — Direct HTTP** | The app polling `http://<esp-ip>/telemetry` | ❌ no | Fallback when the broker is unreachable. Needs the app served over local HTTP (mixed-content rule) |
| **A — Device-hosted page** | The gateway's own live dashboard at `http://<ip>/` | ❌ no | Last-resort fallback. Always works |

**Recommendation:** run **C** as the main act (it is the only mode that needs no laptop server), keep **A** open in a second tab as the instant fallback. If C is slow or blank, switch tabs — you never show a broken screen.

---

## 3. Pre-flight (do this at home, Thursday/Friday)

- [ ] Flash the firmware, confirm the Serial Monitor shows `Sketch uses …` and the boot banner
- [ ] Confirm the car data: plug into a running car → `[OBD] First ECU response decoded - hardware feed is LIVE` and RPM/coolant values that match a normal scan tool
- [ ] Confirm the TFT carousel runs (4 pages: KOLLS → ENGINE → NODE → NET)
- [ ] On the NET page, read the **IP ADDRESS** — that is the URL you will use on stage
- [ ] Charge the 18650 pack (device should be > 3.9 V / > 50 %)
- [ ] Save a copy of the firmware + a **pre-flashed spare** if you have one

---

## 4. Venue setup (5 minutes, before you present)

### ⭐ Fastest path — one double-click

```
1. Phone hotspot ON  →  laptop joins it  →  ESP joins the SAME hotspot
2. Plug the OBD into the car, ignition ON
3. Double-click  demo-start.bat   (in the project folder)
   → it starts a local server, auto-finds the ESP32, opens the browser pointed at it
4. Done. The console shows:  [demo] GATEWAY FOUND: 192.168.43.123
```

`demo-start.bat` → `tools/serve-demo.js` does three things:
- serves the dashboard over **local HTTP** (an `https://` page cannot `fetch()` an `http://` gateway — mixed-content block)
- **auto-discovers the ESP32** by probing `/health` across your LAN subnets (no typing IPs on stage)
- opens `http://127.0.0.1:8125/index.html?gateway=http://192.168.43.123`

It only exposes the dashboard's own files (`index.html`, `app.js`, `live-telemetry.js`, `styles.css`, `fleet.*`) — the repo, `.git` and the firmware binaries are **not** reachable over the wire.

> If auto-discovery finds nothing, the console prints the exact URL to paste with the IP from the TFT NET page.

### Manual path (if the .bat misbehaves)

```text
http://127.0.0.1:8123/index.html?gateway=http://192.168.43.123
```

…or any static server in the project folder, e.g. `npx serve -l 8123`.

### ☁️ Cloud path (needs no laptop at all)

The gateway publishes to **EMQX Serverless over TLS (8883)**; the app subscribes over **WSS**. Because the app is on `https://` and the broker connection is `wss://`, there is **no mixed-content block** — so the **hosted site works as-is**, and the demo runs from a phone.

```
ESP32 ──MQTT/TLS 8883──▶ EMQX Serverless ──WSS──▶ browser (any device, any network)
```

Only requirement: the hotspot has data. Verify the badge flips to **"ESP32 live"**.

**Hotspot tips**
- Use a phone hotspot, **not** venue WiFi — venue WiFi usually has *client isolation* (blocks laptop → ESP) and captive portals that break HTTP
- If the venue insists on their WiFi, use **Mode C (MQTT)** — that path only needs internet
- Keep the hotspot on and airplane mode off for the phone


---

## 5. Integration snippet for the app agent (Mode B)

One constant + one poll. No broker, no registration, no MQTT library.

```js
// 1) point this at the gateway (shown on the TFT NET page)
const GATEWAY = 'http://192.168.43.123';   // or 'http://kolls-gw.local'

// 2) poll the same JSON the MQTT topic carries
let live = null;
async function pollGateway() {
  try {
    const res = await fetch(`${GATEWAY}/telemetry`, { cache: 'no-store' });
    live = await res.json();      // identical shape to the MQTT app payload
    render(live);                 // bind to the existing render functions
  } catch (e) {
    live = null;                  // keep the last good frame + show "device offline"
  }
}
setInterval(pollGateway, 1000);
```

The gateway sends `Access-Control-Allow-Origin: *`, so a dashboard served from GitHub Pages can fetch it cross-origin without any proxy.

**Payload shape** (identical to the MQTT app topic `kolls/vehicle/KA-TRUCK-001/app`):

```json
{ "vehicle_id":"KA-TRUCK-001","name":"Kolls Autotronics Test Vehicle","live":true,
  "score":87,"battery":"13.82","coolant":"88.4","oil_temp":"95.2","rpm":2450,
  "fuel":62,"range":372,"odometer_km":128430,
  "systems":{"engine":95,"cooling":88,"electrical":97,"brakes":84},
  "status":"NOMINAL","severity":0,"tone":"good",
  "gateway":{"device_v":"3.87","device_pct":66,"obd_detached":false,"disconnect_count":0,
             "can_feed":"HARDWARE_CAN","ip":"192.168.43.123","wifi_rssi":-58,
             "uptime_sec":3812,"fw_version":"2.2-direct","tires_available":false} }
```

> ⚠️ `battery` = the **car's** 12 V system. `gateway.device_v` / `device_pct` = the **gateway's 18650 pack** (~3.9 V). Never bind them to the same widget.

---

## 6. What to say (30-second script)

1. *"This is a gateway node — an ESP32 with a donor CAN transceiver board, battery powered, drawing zero power from the car."*
2. *"Plugged into the OBD port. It requests Mode 01 PIDs on the CAN bus and decodes RPM, coolant, load, voltage and fuel trims."*
3. *"The health model runs **on the device** — that's the score and the subsystem breakdown you're seeing."*
4. *"Anti-tamper: if someone pulls the plug, the node sees the CAN feed go silent and latches an alert."*
5. *"The TFT is a four-page scrolling cluster; the dashboard you're looking at is served by the device itself over local WiFi."*

---

## 7. Failure playbook (do not freeze)

| Symptom | Cause | Fix (5 seconds) |
|---|---|---|
| Browser shows "device offline" | Laptop not on the same hotspot | Join the phone hotspot the ESP is on |
| Page loads but values frozen | ESP rebooted / lost WiFi | Check the TFT NET page IP; re-read the IP |
| Values show `--` / SIM | OBD not answering | Ignition ON, then engine ON (some ECUs need the engine) |
| TFT black | Backlight / RST | Check the SPI wires; the boot splash confirms it |
| App blank but Mode A works | App-side fetch issue | Switch to Mode A tab (device page) |
| TFT shows **DEVICE BATT LOW** (yellow) / **DEVICE BATT CRITICAL** (red strobe) | 18650 pack flat | **Swap the charged cell now** — the node will brown out and reboot mid-demo. The pack gauge is on the TFT NODE page and in the app's `gateway.device_pct` |
| Everything dead | Battery flat | 5V from the bench supply; the node runs fine from USB too |
| Venue WiFi only (no hotspot allowed) | client isolation | Switch to Mode C (MQTT) — needs internet only |

**Last-resort demo (zero hardware):** the app's own simulation/anomaly-injector mode — the dashboard is designed to demo without a car.

---

## 8. Hardware checklist to pack

- [ ] ESP32 board + MS309 donor board (wired, heat-shrinked) + TFT
- [ ] 18650 cell(s) + holder + **charged**
- [ ] Buck/boost module (set to 5.0 V) — plus a USB cable as backup power
- [ ] Laptop charger + phone hotspot with plenty of data
- [ ] USB cable for the Serial Monitor (for live proof on screen)
- [ ] OBD adapter for the car (in case the donor board needs a re-seat)
- [ ] The firmware `.bin` on a USB stick (reflash in 2 min if needed)

---

## 9. Deferring the big features (post-competition)

These are **planned, not broken** — say so if asked:

| Feature | Status | Why deferred |
|---|---|---|
| Device tag + registration + VIN auto-read | Spec'd in `device-registration-plan.md` (v2.2→v2.3) | Not needed for a single-device demo |
| Fleet multi-vehicle pairing | Same plan §4 | Demo is one vehicle |
| MAF/VSS fuel economy (real L/100 km) | v2.3 optional | Chart is mocked in the app for now |
| TPMS tyre pressure | ⚠️ needs ISO-TP Mode 22 | Rarely supported by stock ECUs |
| Cloud MQTT fleet ingestion | v2.1 already live | Demo uses direct connect |

---

*Related docs:* `backend-endpoint.md` (API contract) · `device-registration-plan.md` (post-demo roadmap) · `wiring-schematic-battery.html` (wiring)*
