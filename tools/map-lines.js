// Map Arduino #line directives back to .ino lines so we can see exactly which
// source line the compiler is complaining about.
const fs = require('fs');
const cpp = 'C:/Users/HomePC/AppData/Local/arduino/sketches/473C0EBF493EE440A64F505F90CAC136/sketch/ESP32_Battery_CAN_Gateway.ino.cpp';
const lines = fs.readFileSync(cpp, 'utf8').split(/\r?\n/);

const map = {};
let cur = 1;
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^#line\s+(\d+)\s+"/);
  if (m) { cur = parseInt(m[1], 10); continue; }
  if (map[cur] === undefined) map[cur] = i + 1;
  cur++;
}

const targets = process.argv.slice(2).map(Number);
const list = targets.length ? targets : [194, 195, 196, 197, 198, 199, 200, 201, 202];
list.forEach(t => {
  const c = map[t];
  console.log('ino ' + t + ' -> cpp ' + (c || '?') + ' : ' + (c ? lines[c - 1].slice(0, 120) : ''));
});
