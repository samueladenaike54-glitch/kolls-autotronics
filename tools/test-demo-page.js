// Extracts the device-hosted demo page from the firmware and renders it with
// mock telemetry, so the projector view can be verified before the competition.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INO = path.join(ROOT, 'ESP32_Battery_CAN_Gateway', 'ESP32_Battery_CAN_Gateway.ino');
const OUT = path.join(ROOT, 'docs', '_demo_page_test.html');

const ino = fs.readFileSync(INO, 'utf8');
const m = ino.match(/R"HTML\(([\s\S]*?)\)HTML"/);
if (!m) { console.error('demo page not found in firmware'); process.exit(1); }
let page = m[1];

const mock = {
  vehicle_id: 'KA-TRUCK-001', name: 'Kolls Autotronics Test Vehicle', live: true, score: 87,
  battery: '13.82', coolant: '88.4', oil_temp: '95.2', rpm: 2450, fuel: 62, range: 372,
  odometer_km: 128430,
  systems: { engine: 95, cooling: 88, electrical: 97, brakes: 84 },
  status: 'NOMINAL', severity: 0, tone: 'good',
  gateway: {
    device_v: '3.87', device_pct: 66, obd_detached: false, disconnect_count: 0,
    can_feed: 'HARDWARE_CAN', ip: '192.168.43.123', wifi_rssi: -58, uptime_sec: 3812,
    fw_version: '2.2-direct', tires_available: false
  }
};

const stub = `<script>window.fetch=async()=>({json:async()=>JSON.parse(${JSON.stringify(JSON.stringify(mock))})});</script>`;
page = page.replace('<script>', stub + '<script>');

fs.writeFileSync(OUT, page, 'utf8');
console.log('wrote ' + path.relative(ROOT, OUT) + ' (' + page.length + ' bytes)');
