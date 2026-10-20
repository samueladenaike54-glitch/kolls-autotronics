# 🚗 Orion by Kolls — AI Vehicle Health Monitoring System

> **Predictive vehicle diagnostics powered by edge AI and real-time telemetry.**

Orion is an edge-computing vehicle health monitoring platform from **Kolls**. It reads real-time sensor data from commercial vehicles via OBD-II/CAN bus, performs local AI-driven anomaly detection on an ESP32 microcontroller, and streams telemetry to a cloud dashboard for fleet managers.

---

## 🖥️ Vehicle Health App

Open [`index.html`](index.html) or the mirrored [`web-dashboard/index.html`](web-dashboard/index.html) in any modern browser — **no server or build step required**.

The app is a responsive, mobile-first vehicle dashboard with a warm neutral theme and a single green accent:
- **Health** — live score, system condition, tire pressure, coolant, battery and range
- **Trends** — health-score line chart with 7/30/90-day ranges, highlights, weekly fuel-economy bars and a battery-voltage chart
- **Maintenance** — prioritized repairs, estimated savings and part-life tracking
- **Assistant** — vehicle-aware chat plus driving habits and vehicle tools in a phone-friendly menu
- **Garage and demo lab** — switch between three sample vehicles or load a fault scenario
- **Orion constellation logo** used in the app shell, mobile header and service certificate
- **Naira (₦)** used for all monetary values and maintenance estimates; USD sample estimates are converted at **₦1,500 / $1**

The Trends page uses clearly labeled **illustrative sample history** so the charts are useful without a hardware connection. On phones and tablets the scrollbars are hidden while touch scrolling remains enabled.

### Demo scenarios
Open **Demo lab** from the sidebar or vehicle tools to simulate:
- 🌡️ Coolant overheat
- 🔋 Low battery voltage
- 🛞 Low front-left tire pressure

Use **Clear scenario** to return to normal readings.

---

## 🚐 Orion Fleet Portal

Open [`fleet.html`](fleet.html) or the mirrored [`web-dashboard/fleet.html`](web-dashboard/fleet.html). The fleet portal is linked from the main app sidebar, the topbar fleet icon, and the Assistant tools menu.

Orion Fleet is a separate, professional workspace for fleet managers:
- **Overview** — fleet size, active vehicles, attention items, average health, live-style map, brand mix and latest alerts
- **Vehicles** — searchable inventory across multiple brands with status filters, sorting, health bars and vehicle profiles
- **Live tracking** — illustrative Lagos map with moving, idle, service and alert vehicles plus a live vehicle list
- **Maintenance** — service queue ordered by urgency with naira workshop estimates
- **Alerts** — critical, warning and info alerts with review/dismiss workflows
- **Add and import vehicles** — register any brand/model manually or import many vehicles with comma-separated rows
- **Persistence** — added vehicles and reviewed alerts are stored in `localStorage` (`kollsFleetCustomVehiclesV1` and `kollsFleetAcknowledgedAlertsV1`)

All fleet telemetry, map locations and workshop rates are clearly labeled sample data for the front-end demo. The layout is responsive from small phones through wide dispatch displays.

---

## ⚡ ESP32 Hardware Prototype

The [`ESP32_Vehicle_Prototype/`](ESP32_Vehicle_Prototype/) folder contains the complete Arduino firmware for:
- **CAN bus** data acquisition at 500kbps via SN65HVD230 transceiver
- **MQTT** telemetry publishing to cloud broker
- **1.8" TFT display** with real-time dashboard (RPM, Coolant, Voltage, Load)
- **Anti-tamper detection** (OBD-II unplug alerts)
- **OBD-II PID parsing** (RPM, ECT, Engine Load, Fuel Trims, System Voltage)

### Hardware Components
| Component | Purpose |
|-----------|---------|
| ESP32 Dev Board | System brain — dual-core processing |
| SN65HVD230 | CAN bus transceiver (OBD-II → digital) |
| 1.8" ST7735 TFT | Local status display for drivers |
| LM2596 Step-Down | 12V/24V → 5V/3.3V power regulation |
| 5A Inline Fuse | Overcurrent protection |
| 18650 Battery | Anti-tamper backup power |
| OBD-II Male Plug | Vehicle diagnostic port connection |

---

## 📁 Project Structure

```
kolls-autotronics/
├── index.html              # Main app shell and pages
├── styles.css              # Responsive design system and charts
├── app.js                  # State, trends, chat, repairs, modals
├── fleet.html              # Orion Fleet operations portal
├── fleet.css               # Fleet layout, maps, cards and responsive styles
├── fleet.js                # Fleet data, tracking, imports, alerts and storage
├── logo.svg                # Orion constellation logo / favicon
├── web-dashboard/          # Mirrored copy of the app
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── fleet.html
│   ├── fleet.css
│   ├── fleet.js
│   └── logo.svg
├── ESP32_Vehicle_Prototype/
│   ├── ESP32_Vehicle_Prototype.ino  # Arduino firmware
│   └── README.md           # Hardware wiring guide
├── docs/
│   └── architecture.md     # System architecture documentation
└── .gitignore
```

---

## 🔗 Live MQTT Telemetry

The web app connects directly to the ESP32 firmware over MQTT. The dashboard shows its sample garage data immediately, then switches to live readings whenever a fresh packet arrives. If the feed goes quiet for 9 seconds it falls back to the sample data until the gateway reconnects.

- **Browser transport:** `wss://broker.hivemq.com:8884/mqtt`
- **Raw engineering topic:** `kolls/vehicle/telemetry`
- **App-shaped topic:** `kolls/vehicle/KA-TRUCK-001/app` (score, systems, fuel, range and odometer already derived on the ESP32)
- **Command topic:** `kolls/vehicle/KA-TRUCK-001/commands` (`PING`, `RESET_TAMPER`)

The raw packet carries `rpm`, `coolant_c`, `oil_c`, `battery_v`, `load_pct`, fuel trims, intake temperature, device pack voltage/percentage and diagnostics. The full v2.1 contract is in [`docs/backend-endpoint.md`](docs/backend-endpoint.md).

The ESP32 does not currently supply TPMS, brake-wear or fuel-economy data. Those values remain clearly labelled garage estimates.

---

## 📄 License

© 2026 Kolls. Orion is a Kolls product. All rights reserved.
