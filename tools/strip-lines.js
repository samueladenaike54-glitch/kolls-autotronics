// Strip the Arduino #line directives so GCC reports true .cpp line numbers.
const fs = require('fs');
const p = 'C:/Users/HomePC/AppData/Local/arduino/sketches/473C0EBF493EE440A64F505F90CAC136/sketch/ESP32_Battery_CAN_Gateway.ino.cpp';
let s = fs.readFileSync(p, 'utf8');
const before = s.length;
s = s.replace(/^#line\s+\d+\s+".*"$/gm, '// #line stripped');
fs.writeFileSync('C:/Users/HomePC/AppData/Local/Temp/opencode/noline.cpp', s);
console.log('written, stripped ' + (before - s.length) + ' bytes of #line directives');
