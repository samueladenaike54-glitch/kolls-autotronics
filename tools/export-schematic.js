// Export the battery schematic into standalone SVG + high-DPI PNG assets,
// and LINT the layout (text/text, text/wire, text/dot collisions + clipping).
// Usage: node tools/export-schematic.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'docs', 'wiring-schematic-battery.html');
const OUT = path.join(ROOT, 'images');           // web-served asset folder
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

fs.mkdirSync(OUT, { recursive: true });

const html = fs.readFileSync(SRC, 'utf8');
const css = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const svgs = [...html.matchAll(/<svg viewBox="([^"]+)"[\s\S]*?<\/svg>/g)].map(m => ({
  viewBox: m[1],
  markup: m[0]
}));
if (svgs.length !== 2) {
  console.error('Expected 2 SVG sheets, found ' + svgs.length);
  process.exit(1);
}
const names = ['schematic-signals-can', 'schematic-power-divider'];

/* ------------------------------------------------------------------ build SVG */
svgs.forEach((s, i) => {
  const [, , vw, vh] = s.viewBox.split(/\s+/).map(Number);
  const standalone = s.markup
    .replace(/<svg viewBox="([^"]+)"/, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="$1" width="${vw}" height="${vh}"`)
    .replace(/(<svg[^>]*>)/, `$1\n<style>${css}\ntext{font-family:ui-monospace,Consolas,monospace}</style>`);
  fs.writeFileSync(path.join(OUT, `${names[i]}.svg`), standalone, 'utf8');
  console.log(`sheet ${i + 1}: ${vw}x${vh} -> docs/schematic/${names[i]}.svg`);
});

/* -------------------------------------------------------------------- audit */
const AUDIT = `
(function () {
  const problems = [];
  document.querySelectorAll('svg').forEach((svg, si) => {
    const sheet = si + 1;
    const vb = svg.viewBox.baseVal;
    const texts = [...svg.querySelectorAll('text')].map(t => {
      const b = t.getBBox();
      return { label: t.textContent.trim().slice(0, 40), x: b.x, y: b.y, w: b.width, h: b.height };
    });
    const rects = (a, b) => {
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      return (ox > 1 && oy > 1) ? { ox, oy } : null;
    };
    // 1) text vs text
    for (let i = 0; i < texts.length; i++)
      for (let j = i + 1; j < texts.length; j++) {
        const r = rects(texts[i], texts[j]);
        if (r) problems.push({ sheet, type: 'text/text', a: texts[i].label, b: texts[j].label, r });
      }
    // 2) text outside viewBox
    texts.forEach(t => {
      if (t.x < vb.x - 1 || t.x + t.w > vb.x + vb.width + 1 || t.y < vb.y - 1 || t.y + t.h > vb.y + vb.height + 1)
        problems.push({ sheet, type: 'text/out-of-bounds', a: t.label });
    });
    // 3) text vs pin dots (circles)
    const dots = [...svg.querySelectorAll('circle')].map(c => ({
      x: +c.getAttribute('cx') - +c.getAttribute('r'),
      y: +c.getAttribute('cy') - +c.getAttribute('r'),
      w: 2 * +c.getAttribute('r'), h: 2 * +c.getAttribute('r')
    }));
    texts.forEach(t => dots.forEach(d => {
      const r = rects(t, d);
      if (r) problems.push({ sheet, type: 'text/dot', a: t.label, r });
    }));
    // 4) text vs wire segments (M/L/H/V paths only)
    const segs = [];
    [...svg.querySelectorAll('path')].forEach(p => {
      const d = p.getAttribute('d'); if (!d) return;
      const cmds = d.match(/[MLHVmlhv][^MLHVmlhv]*/g); if (!cmds) return;
      let cur = null;
      cmds.forEach(c => {
        const t = c[0]; const n = c.slice(1).trim().split(/[ ,]+/).map(Number);
        if (t === 'M') { cur = { x: n[0], y: n[1] }; }
        else if (t === 'L' && cur) { segs.push({ x1: cur.x, y1: cur.y, x2: n[0], y2: n[1] }); cur = { x: n[0], y: n[1] }; }
        else if (t === 'H' && cur) { segs.push({ x1: cur.x, y1: cur.y, x2: n[0], y2: cur.y }); cur = { x: n[0], y: cur.y }; }
        else if (t === 'V' && cur) { segs.push({ x1: cur.x, y1: cur.y, x2: cur.x, y2: n[0] }); cur = { x: cur.x, y: n[0] }; }
      });
    });
    const segRect = (s, t) => {
      const sx1 = Math.min(s.x1, s.x2), sx2 = Math.max(s.x1, s.x2);
      const sy1 = Math.min(s.y1, s.y2), sy2 = Math.max(s.y1, s.y2);
      const ox = Math.min(sx2, t.x + t.w) - Math.max(sx1, t.x);
      const oy = Math.min(sy2, t.y + t.h) - Math.max(sy1, t.y);
      return (ox > 0.5 && oy > 0.5) ? { ox, oy } : null;
    };
    texts.forEach(t => segs.forEach(s => {
      const r = segRect(s, t);
      if (r) problems.push({ sheet, type: 'text/wire', a: t.label, r });
    }));
  });
  const pre = document.createElement('pre');
  pre.id = 'audit';
  pre.textContent = JSON.stringify(problems);
  document.body.appendChild(pre);
})();
`;

const auditHtml = path.join(OUT, '_audit.html');
fs.writeFileSync(auditHtml, `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#162033}</style></head><body>${html.replace(/<\/body>/, '')}
<script>${AUDIT}</script></body></html>`, 'utf8');

const dumped = execFileSync(CHROME, [
  '--headless=new', '--disable-gpu', '--virtual-time-budget=4000', '--dump-dom',
  `file://${auditHtml}`
], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });

const m = dumped.match(/<pre id="audit">([\s\S]*?)<\/pre>/);
fs.unlinkSync(auditHtml);
if (!m) {
  console.error('AUDIT FAILED: no results');
  process.exit(1);
}
const problems = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
console.log('\n--- LAYOUT AUDIT ---');
if (!problems.length) {
  console.log('CLEAN: no text/text, text/dot, text/wire or out-of-bounds collisions.');
} else {
  const seen = new Set();
  problems.forEach(p => {
    const key = p.sheet + p.type + p.a + (p.b || '');
    if (seen.has(key)) return;
    seen.add(key);
    console.log(`  sheet ${p.sheet}  ${p.type.padEnd(18)} "${p.a}"${p.b ? ' ⨯ "' + p.b + '"' : ''}`);
  });
  console.log(`  total issues: ${problems.length}`);
}

/* ------------------------------------------------------------------- render */
function render(file, outPng, width, height, scale) {
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars',
    `--force-device-scale-factor=${scale}`,
    `--window-size=${width},${height}`,
    `--screenshot=${outPng}`,
    `file://${file}`
  ], { stdio: 'pipe' });
}

svgs.forEach((s, i) => {
  const [, , vw, vh] = s.viewBox.split(/\s+/).map(Number);
  const wrap = path.join(OUT, `_wrap_${names[i]}.html`);
  fs.writeFileSync(wrap, `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>html,body{margin:0;padding:0;background:#162033}svg{display:block}</style></head>
<body>${fs.readFileSync(path.join(OUT, names[i] + '.svg'), 'utf8')}</body></html>`, 'utf8');
  render(wrap, path.join(OUT, `${names[i]}@3x.png`), vw, vh, 3);
  fs.unlinkSync(wrap);
});
render(SRC, path.join(OUT, 'wiring-schematic-battery@2x.png'), 1220, 2500, 2);

function pngSize(p) {
  const b = fs.readFileSync(p);
  return `${b.readUInt32BE(16)} x ${b.readUInt32BE(20)} px`;
}
console.log('\n--- OUTPUT ---');
[...svgs.map((_, i) => path.join(OUT, `${names[i]}@3x.png`)), path.join(OUT, 'wiring-schematic-battery@2x.png')]
  .forEach(p => console.log(`  ${path.basename(p).padEnd(40)} ${pngSize(p)}  ${(fs.statSync(p).size / 1024).toFixed(0)} KB`));
