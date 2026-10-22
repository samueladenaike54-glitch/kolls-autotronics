// Firmware patch: light-theme TFT already spliced in; this adds
//   1. device.connected flag  (no divider fitted => pack is "unknown", not "low")
//   2. battery alerts guarded by that flag (fixes the false "DEVICE BATT LOW")
//   3. slower carousel (hold 4.0 s, glide 1.4 s) to match the mockup
//   4. null pack values in the payloads when the divider is missing
const fs = require('fs');
const f = 'ESP32_Battery_CAN_Gateway/ESP32_Battery_CAN_Gateway.ino';
let s = fs.readFileSync(f, 'utf8');
const before = s;
const log = [];

// 1. DeviceState: add connected flag
s = s.replace(
  '  bool     device_low;         // below warn threshold',
  '  bool     device_low;         // below warn threshold\n  bool     connected;          // false = no ADC divider fitted (pack value unknown)'
);

// 2. updateDeviceBattery: detect a missing divider
s = s.replace(
  `  device.device_v        = (float)mv * DEVICE_BATT_RATIO / 1000.0f;`,
  `  device.device_v        = (float)mv * DEVICE_BATT_RATIO / 1000.0f;

  // A missing divider reads ~0 V. That is "unknown", NOT "empty" - so never
  // raise a low-battery alarm on an unconnected ADC.
  if (device.device_v < 1.5f) {
    device.connected      = false;
    device.device_v       = 0.0f;
    device.device_pct     = 0;
    device.device_low     = false;
    device.device_critical = false;
    return;
  }
  device.connected = true;`
);

// 3. guard the battery alerts
s = s.replace(
  `  // Priority 0.5: our own battery pack
#if DEVICE_BATT_MONITOR
  if (device.device_critical) {`,
  `  // Priority 0.5: our own battery pack (only if the gauge is actually connected)
#if DEVICE_BATT_MONITOR
  if (device.connected && device.device_critical) {`
);
s = s.replace(
  `  // Priority 4: our pack getting low
#if DEVICE_BATT_MONITOR
  if (device.device_low) {`,
  `  // Priority 4: our pack getting low
#if DEVICE_BATT_MONITOR
  if (device.connected && device.device_low) {`
);

// 4. payload: null when not connected
s = s.replace(
  `  gw["device_v"]        = serialized(String(device.device_v, 2));
  gw["device_pct"]      = device.device_pct;`,
  `  if (device.connected) {
    gw["device_v"]   = serialized(String(device.device_v, 2));
    gw["device_pct"] = device.device_pct;
  } else {
    gw["device_v"]   = nullptr;      // no divider fitted -> unknown, not 0%
    gw["device_pct"] = nullptr;
  }`
);

// 5. slower carousel (hold + glide) in the firmware
s = s.replace('} else if (now - pageHoldStart >= 2600) {', '} else if (now - pageHoldStart >= 4000) {');
s = s.replace('/ 700.0f);', '/ 1400.0f);');
s = s.replace('if (now - lastFallback > 2600) {', 'if (now - lastFallback > 4000) {');

fs.writeFileSync(f, s, 'utf8');
console.log('changed:', s !== before);
['device.connected', 'device.connected && device.device_low', 'gw["device_pct"] = nullptr',
 'pageHoldStart >= 4000', '1400.0f'].forEach(k => console.log('  ' + (s.includes(k) ? 'OK  ' : 'MISS') + ' ' + k));
