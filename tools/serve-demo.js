// Saturday demo launcher:
//   1. serves the dashboard over LOCAL HTTP on 127.0.0.1:8123 (required: an
//      https:// page cannot fetch() an http:// gateway - mixed content block)
//   2. auto-discovers the ESP32 on the local network by probing /health
//   3. opens the browser straight at ?gateway=http://<discovered-ip>
//
// Usage:  node tools/serve-demo.js        (or double-click demo-start.bat)
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT_PREFERENCE = [8124, 8125, 8126, 8127, 8128];   // 8123 is often taken
let PORT = PORT_PREFERENCE[0];

// Files the dashboard is allowed to serve (everything else stays private).
const ALLOW = new Set([
  'index.html', 'app.js', 'live-telemetry.js', 'styles.css', 'logo.svg',
  'fleet.html', 'fleet.js', 'fleet.css'
]);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.json': 'application/json', '.ico': 'image/x-icon'
};

/* --------------------------------------------------- 1. static server */
const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  // Strict allow-list: only the dashboard's own files are reachable.
  const name = path.basename(urlPath);
  if (!ALLOW.has(name)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('not found');
  }
  const file = path.join(ROOT, name);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(name)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
});

// Bind to the first free port so it never collides with another dev server.
let bound = false;
function listenOnFreePort(index) {
  if (bound || index >= PORT_PREFERENCE.length) {
    if (!bound) console.log('[demo] could not find a free port (tried ' + PORT_PREFERENCE.join(', ') + ')');
    return;
  }
  PORT = PORT_PREFERENCE[index];
  server.once('error', err => {
    if (err.code === 'EADDRINUSE') {
      console.log('[demo] port ' + PORT + ' busy, trying ' + PORT_PREFERENCE[index + 1] + ' ...');
      listenOnFreePort(index + 1);
    } else { throw err; }
  });
  server.once('listening', () => {
    if (bound) return;          // guard: never start twice
    bound = true;
    console.log('[demo] dashboard served at http://127.0.0.1:' + PORT + '/');
    discoverGateway();
  });
  server.listen(PORT, '127.0.0.1');
}

listenOnFreePort(0);

/* --------------------------------------- 2. gateway auto-discovery */
function localSubnets() {
  const nets = os.networkInterfaces();
  const subs = [];
  Object.values(nets).forEach(list => (list || []).forEach(n => {
    if (n.family !== 'IPv4' || n.internal) return;
    if (n.address.startsWith('169.254.')) return;      // APIPA = no DHCP
    subs.push(n.address.split('.').slice(0, 3).join('.'));
  }));
  return [...new Set(subs)];
}

function probe(ip) {
  return new Promise(resolve => {
    const req = http.get({ host: ip, port: 80, path: '/health', timeout: 1200 }, r => {
      let body = '';
      r.on('data', d => (body += d));
      r.on('end', () => {
        try {
          const j = JSON.parse(body);
          resolve(j && j.device ? ip : null);           // our gateway answers /health
        } catch (e) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

async function discoverGateway() {
  const subs = localSubnets();
  if (!subs.length) {
    console.log('[demo] no LAN interface found - open the app manually and set the gateway in the UI');
    return openBrowser(null);
  }
  console.log('[demo] scanning for the ESP32 gateway on ' + subs.join(', ') + ' ...');

  const found = [];
  for (const sub of subs) {
    const batch = [];
    for (let i = 1; i <= 254; i++) batch.push(probe(`${sub}.${i}`));
    const hits = await Promise.all(batch);
    hits.filter(Boolean).forEach(ip => found.push(ip));
    if (found.length) break;                             // first subnet that answers wins
  }

  if (found.length) {
    console.log('[demo] GATEWAY FOUND: ' + found.join(', '));
    openBrowser(found[0]);
  } else {
    console.log('[demo] no gateway answered /health.');
    console.log('[demo] -> check the TFT NET page for the IP, then open:');
    console.log('[demo]    http://127.0.0.1:' + PORT + '/index.html?gateway=http://<ESP-IP>');
    openBrowser(null);
  }
}

/* ------------------------------------------------------- 3. open browser */
function openBrowser(ip) {
  const target = 'http://127.0.0.1:' + PORT + '/index.html' + (ip ? `?gateway=http://${ip}` : '');
  console.log('[demo] opening: ' + target);
  const cmd = process.platform === 'win32' ? `start "" "${target}"`
            : process.platform === 'darwin' ? `open "${target}"` : `xdg-open "${target}"`;
  exec(cmd, () => {});
}
