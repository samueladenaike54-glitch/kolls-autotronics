// Fix the global declarations (elaborated type specifier) and normalise the
// file's line endings, which had drifted to mixed CRLF/LF.
const fs = require('fs');
const f = 'ESP32_Battery_CAN_Gateway/ESP32_Battery_CAN_Gateway.ino';

let raw = fs.readFileSync(f, 'utf8');
let lines = raw.split(/\r?\n/);

const note = [
  '// NOTE: the elaborated type specifier is deliberate. A name introduced with the',
  '// `struct` keyword is not a "class-name", so the bare `TelemetryData` is not',
  '// guaranteed to resolve (GCC: "\'TelemetryData\' does not name a type").',
  '// Always declare these as `struct X x;`.'
];

let changed = [];
lines = lines.map(l => {
  const t = l.trim();
  if (t === 'TelemetryData telemetry;') { changed.push('TelemetryData'); return 'struct TelemetryData telemetry;'; }
  if (t === 'DeviceState   device;') { changed.push('DeviceState'); return 'struct DeviceState   device;'; }
  if (t === 'LocationState location;') { changed.push('LocationState'); return 'struct LocationState location;'; }
  return l;
});

// add the explanatory comment above the declarations
const idx = lines.findIndex(l => l.startsWith('struct TelemetryData telemetry;'));
if (idx >= 0 && !lines.slice(Math.max(0, idx - 5), idx).some(l => l.includes('elaborated type specifier'))) {
  lines.splice(idx, 0, ...note);
}

const out = lines.join('\n');
fs.writeFileSync(f, out, 'utf8');

console.log('patched declarations:', changed.join(', ') || '(none)');
const crlf = (out.match(/\r\n/g) || []).length;
console.log('CRLF sequences remaining:', crlf);
console.log('line count:', lines.length);
lines.forEach((l, i) => { if (/^struct (TelemetryData|DeviceState|LocationState)/.test(l)) console.log((i + 1) + ': ' + l); });
