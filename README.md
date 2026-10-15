# 🚗 Kolls Autotronics — AI Vehicle Health Monitoring System

> **Predictive vehicle diagnostics powered by edge AI and real-time telemetry.**

An edge-computing vehicle health monitoring platform that reads real-time sensor data from commercial vehicles via OBD-II/CAN bus, performs local AI-driven anomaly detection on an ESP32 microcontroller, and streams telemetry to a cloud dashboard for fleet managers.

---

## 🖥️ Live Web Dashboard

Open [`web-dashboard/index.html`](web-dashboard/index.html) in any modern browser — **no server required**.

The dashboard features:
- **Liquid Glass** futuristic UI with deep space blue theme
- Semi-circular RPM gauge with animated needle
- Real-time Engine Load & Battery Voltage vertical gauges
- Oil vs Coolant temperature trend charts
- AI-powered Short-Term & Long-Term Fuel Trim drift analysis
- Live diagnostic activity feed
- **Auto-simulation mode** — works without any hardware connected

### Demo Controls
Click the anomaly injector buttons to simulate faults during presentations:
- 🔴 Throttle Blip (5,800 RPM)
- 🔴 Lean Fuel Spike (+14.8%)
- 🔴 Coolant Overheat (108°C)
- 🔴 Voltage Sag (11.2V)
- 🟢 Restore Nominal

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
├── web-dashboard/
│   ├── index.html          # Main dashboard UI
│   ├── styles.css          # Liquid Glass theme
│   └── app.js              # MQTT client, charts, simulation
├── ESP32_Vehicle_Prototype/
│   ├── ESP32_Vehicle_Prototype.ino  # Arduino firmware
│   └── README.md           # Hardware wiring guide
├── docs/
│   └── architecture.md     # System architecture documentation
└── .gitignore
```

---

## 🔗 MQTT Protocol

| Field | Type | Description |
|-------|------|-------------|
| `rpm` | int | Engine speed (0-8000) |
| `coolant_temp` | float | Coolant temperature °C |
| `oil_temp` | float | Oil temperature °C |
| `battery_voltage` | float | System voltage (V) |
| `engine_load` | int | Engine load (0-100%) |
| `stft` | float | Short-term fuel trim (%) |
| `ltft` | float | Long-term fuel trim (%) |
| `status` | string | NOMINAL / WARNING / CRITICAL / TAMPER |
| `vehicle_id` | string | Vehicle identifier |

**Topic:** `kolls/vehicle/telemetry`  
**Broker:** `broker.hivemq.com` (MQTT: 1883, WebSocket: 8884)

---

## 📄 License

© 2026 Kolls Autotronics. All rights reserved.
