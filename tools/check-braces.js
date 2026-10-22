// Brace/paren balance check on the Arduino preprocessed sketch (.cpp)
const fs = require('fs');
const CPP = 'C:/Users/HomePC/AppData/Local/arduino/sketches/473C0EBF493EE440A64F505F90CAC136/sketch/ESP32_Battery_CAN_Gateway.ino.cpp';
const lines = fs.readFileSync(CPP, 'utf8').split(/\r?\n/);

let depth = 0, inStr = false, inLine = false, inBlock = false, inChar = false;
const marks = new Set([135, 198, 200, 297, 400, 900, 1200, 1500]);
const suspects = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const before = depth;
  for (let j = 0; j < line.length; j++) {
    const c = line[j], n = line[j + 1];
    if (inLine) { if (c === '\n') inLine = false; continue; }
    if (inBlock) { if (c === '*' && n === '/') { inBlock = false; j++; } continue; }
    if (inStr) { if (c === '\\') { j++; continue; } if (c === '"') inStr = false; continue; }
    if (inChar) { if (c === '\\') { j++; continue; } if (c === "'") inChar = false; continue; }
    if (c === '/' && n === '/') { inLine = true; break; }
    if (c === '/' && n === '*') { inBlock = true; j++; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === "'") { inChar = true; continue; }
    if (c === '{') depth++;
    if (c === '}') depth--;
  }
  if (marks.has(i + 1)) console.log('after line ' + (i + 1) + ' depth=' + depth + ' | ' + line.slice(0, 55));
  // report lines where depth returns to 0 unexpectedly inside a function
  if (before > 0 && depth === 0 && /^\S/.test(line) && !/^}/.test(line)) {
    suspects.push((i + 1) + ': ' + line.slice(0, 60));
  }
}
console.log('FINAL depth:', depth);
console.log('\nlines that closed back to depth 0 (first 15):');
suspects.slice(0, 15).forEach(s => console.log('  ' + s));
