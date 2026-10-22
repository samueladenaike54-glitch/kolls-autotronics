// Scan the exact include paths used by the build for anything that would
// shadow the TelemetryData type (macros, typedefs, class names).
const fs = require('fs');
const path = require('path');

const dirs = [
  'C:/Users/HomePC/AppData/Local/Arduino15/packages/esp32/hardware/esp32/3.3.12/cores/esp32',
  'C:/Users/HomePC/AppData/Local/Arduino15/packages/esp32/hardware/esp32/3.3.12/libraries/WiFi/src',
  'C:/Users/HomePC/AppData/Local/Arduino15/packages/esp32/hardware/esp32/3.3.12/libraries/Network/src',
  'C:/Users/HomePC/AppData/Local/Arduino15/packages/esp32/hardware/esp32/3.3.12/libraries/NetworkClientSecure/src',
  'C:/Users/HomePC/Documents/Arduino/libraries/PubSubClient/src',
  'C:/Users/HomePC/Documents/Arduino/libraries/ArduinoJson/src',
  'C:/Users/HomePC/AppData/Local/Arduino15/packages/esp32/hardware/esp32/3.3.12/libraries/WebServer/src',
  'C:/Users/HomePC/AppData/Local/Arduino15/packages/esp32/hardware/esp32/3.3.12/libraries/FS/src',
  'C:/Users/HomePC/AppData/Local/Arduino15/packages/esp32/hardware/esp32/3.3.12/libraries/ESPmDNS/src',
  'C:/Users/HomePC/AppData/Local/Arduino15/packages/esp32/hardware/esp32/3.3.12/libraries/SPI/src',
  'C:/Users/HomePC/Documents/Arduino/libraries/Adafruit_GFX_Library',
  'C:/Users/HomePC/Documents/Arduino/libraries/Adafruit_BusIO',
  'C:/Users/HomePC/Documents/Arduino/libraries/Wire/src',
  'C:/Users/HomePC/Documents/Arduino/libraries/Adafruit_ST7735_and_ST7789_Library',
  'C:/Users/HomePC/AppData/Local/Arduino15/packages/esp32/hardware/esp32/3.3.12/libraries/Hash/src'
];

const hits = [];
for (const d of dirs) {
  if (!fs.existsSync(d)) { hits.push('MISSING DIR: ' + d); continue; }
  const walk = (p) => {
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      const f = path.join(p, e.name);
      if (e.isDirectory()) { walk(f); continue; }
      if (!/\.(h|hpp|cpp|inc)$/i.test(e.name)) continue;
      let txt; try { txt = fs.readFileSync(f, 'utf8'); } catch (x) { continue; }
      txt.split(/\r?\n/).forEach((l, i) => {
        if (/TelemetryData/i.test(l)) hits.push(path.basename(f) + ':' + (i + 1) + ': ' + l.trim().slice(0, 120));
        if (/^\s*#\s*define\s+(telemetry|TelemetryData)\b/.test(l)) hits.push('MACRO! ' + path.basename(f) + ':' + (i + 1) + ': ' + l.trim().slice(0, 120));
      });
    }
  };
  walk(d);
}
console.log(hits.length ? hits.join('\n') : 'no TelemetryData / telemetry macro found in any include dir');
