// Bisect helper: patch the cached sketch .cpp, compile it directly, report errors.
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const CPP = 'C:/Users/HomePC/AppData/Local/arduino/sketches/473C0EBF493EE440A64F505F90CAC136/sketch/ESP32_Battery_CAN_Gateway.ino.cpp';
const TMP = 'C:/Users/HomePC/AppData/Local/Temp/opencode/bisect.cpp';
const ROOT = path.resolve(__dirname, '..');

let src = fs.readFileSync(CPP, 'utf8');
const mode = process.argv[2];

if (mode === 'explicit') {
  // use the elaborated type specifier at the declaration
  src = src.replace(/^TelemetryData telemetry;/m, 'struct TelemetryData telemetry;');
} else if (mode === 'noglobal') {
  // delete the global declaration entirely
  src = src.replace(/^TelemetryData telemetry;\r?\n/m, '');
} else if (mode === 'noloc') {
  // remove the whole location function block (fetchIpGeolocation .. updateLocation)
  const start = src.indexOf('void fetchIpGeolocation() {');
  const end = src.indexOf('void updateLocation();');
  if (start > 0 && end > start) src = src.slice(0, start) + src.slice(end);
  else console.log('!! location block not found');
} else if (mode === 'nolocstruct') {
  // remove the LocationState struct + its global
  src = src.replace(/struct LocationState \{[\s\S]*?\};\r?\n/, '');
  src = src.replace(/^LocationState location;\r?\n/m, '');
} else {
  console.log('usage: node tools/bisect.js explicit|noglobal|noloc|nolocstruct');
  process.exit(1);
}

fs.writeFileSync(TMP, src, 'utf8');
console.log('mode:', mode, '-> patched copy written');

try {
  execSync('cmd /c "' + path.join(ROOT, 'tools', 'compile-cpp.cmd').replace(/\//g, '\\') + '" "' + TMP.replace(/\//g, '\\') + '"', {
    stdio: 'pipe', maxBuffer: 64 * 1024 * 1024
  });
  console.log('RESULT: COMPILES CLEAN');
} catch (e) {
  const out = ((e.stdout || '') + (e.stderr || '')).split(/\r?\n/).filter(l => /error:/.test(l));
  console.log('RESULT: ' + out.length + ' errors');
  out.slice(0, 3).forEach(l => console.log('  ' + l.trim().slice(0, 120)));
}
