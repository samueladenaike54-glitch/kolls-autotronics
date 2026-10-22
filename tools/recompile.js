// Re-runs the exact compiler command from the verbose build log against a
// modified copy of the sketch, so GCC reports the TRUE error location.
const fs = require('fs');
const { execSync } = require('child_process');

const LOG = 'C:/Users/HomePC/AppData/Local/Temp/opencode/verbose.log';
const log = fs.readFileSync(LOG, 'utf8');
const line = log.split(/\r?\n/).find(l => l.includes('xtensa-esp32-elf-g++') && l.includes('-MMD'));
if (!line) { console.error('no g++ line found'); process.exit(1); }

const mode = process.argv[2] || 'c';            // 'c' = compile, 'E' = preprocess
const src = process.argv[3];                    // source file to compile
let cmd = line.trim();

if (mode === 'E') cmd = cmd.replace('-MMD -c ', '-E ');
cmd = cmd.replace(/-o "[^"]*"/, '-o "C:/Users/HomePC/AppData/Local/Temp/opencode/out.o"');
// replace the sketch .cpp path (it appears with doubled backslashes in the log)
cmd = cmd.replace(/"[^"]*sketch[^"]*ESP32_Battery_CAN_Gateway\.ino\.cpp"/, '"' + src + '"');

const cmdFile = 'C:/Users/HomePC/AppData/Local/Temp/opencode/run.cmd';
fs.writeFileSync(cmdFile, '@echo off\r\n' + cmd + '\r\n', 'latin1');
console.log('source arg ->', (cmd.match(/"([^"]*\.cpp)"/) || [])[1]);

try {
  const out = execSync('cmd /c "' + cmdFile + '" 2>&1', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  console.log(out.split(/\r?\n/).slice(0, 25).join('\n'));
} catch (e) {
  const out = (e.stdout || '') + (e.stderr || '');
  const errs = out.split(/\r?\n/).filter(l => /error:|warning:/.test(l)).slice(0, 12);
  console.log(errs.join('\n') || out.split(/\r?\n/).slice(0, 12).join('\n'));
}
