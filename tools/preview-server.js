// Tiny static server for the TFT mockup preview (ports 8777).
const http = require('http');
const fs   = require('fs');
const path = require('path');

const ROOT = 'C:\\Users\\HomePC\\Documents\\kolls autotronics';
const TYPES = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript',
                '.png':'image/png', '.svg':'image/svg+xml', '.json':'application/json' };

http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, rel);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found: ' + rel); }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
}).listen(8777, () => console.log('serving http://localhost:8777/'));
