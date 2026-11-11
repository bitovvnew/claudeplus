// Regenerates every image in docs/img from the synthetic demo dataset (never from real data).
//   node scripts/screenshots.mjs
// Needs Chrome or Edge (set CHROME_PATH to override).
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs', 'img');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'cplus-shots-'));
const DEMO = path.join(TMP, 'demo');
const PORT = 4411;
const BIN = path.join(ROOT, 'bin', 'cplus.js');
fs.mkdirSync(OUT, { recursive: true });

const BROWSERS = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean);
const BROWSER = BROWSERS.find((p) => fs.existsSync(p));
if (!BROWSER) throw new Error('No Chrome/Edge found. Set CHROME_PATH.');

const env = { ...process.env, CLAUDEPLUS_DEMO_DIR: DEMO, CPLUS_LANG: 'en', FORCE_COLOR: '1', NO_COLOR: '' };
delete env.NO_COLOR;

function shot(url, file, w, h, scale = 1) {
  execFileSync(BROWSER, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--force-device-scale-factor=${scale}`, `--window-size=${w},${h}`,
    '--virtual-time-budget=7000', `--user-data-dir=${path.join(TMP, 'profile')}`, `--screenshot=${path.join(OUT, file)}`, url], { stdio: 'ignore' });
  console.log('  ✓', file);
}

/* ---------- ANSI → HTML ---------- */
const BASE16 = ['#1a1a19', '#e34948', '#1baf7a', '#eda100', '#3987e5', '#d55181', '#3fb6c9', '#f0efec', '#898781', '#e66767', '#4cd69a', '#fab219', '#6da7ec', '#e87ba4', '#7fd3df', '#ffffff'];
function xterm(n) {
  if (n < 16) return BASE16[n];
  if (n >= 232) { const v = 8 + (n - 232) * 10; return `rgb(${v},${v},${v})`; }
  const i = n - 16, r = Math.floor(i / 36), g = Math.floor((i % 36) / 6), b = i % 6;
  const c = (x) => (x ? 55 + x * 40 : 0);
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}
function ansiToHtml(s) {
  const esc = (x) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let fg = null, bg = null, bold = false, dim = false, out = '';
  const parts = s.split(/(\x1b\[[0-9;]*m)/);
  for (const p of parts) {
    const m = p.match(/^\x1b\[([0-9;]*)m$/);
    if (!m) {
      if (!p) continue;
      const st = [fg && `color:${fg}`, bg && `background:${bg}`, bold && 'font-weight:700', dim && 'opacity:.6'].filter(Boolean).join(';');
      out += st ? `<span style="${st}">${esc(p)}</span>` : esc(p);
      continue;
    }
    const codes = (m[1] || '0').split(';').map(Number);
    for (let i = 0; i < codes.length; i++) {
      const k = codes[i];
      if (k === 0) { fg = bg = null; bold = dim = false; }
      else if (k === 1) bold = true;
      else if (k === 2) dim = true;
      else if (k === 22) bold = dim = false;
      else if (k === 39) fg = null;
      else if (k === 49) bg = null;
      else if (k >= 30 && k <= 37) fg = BASE16[k - 30];
      else if (k >= 90 && k <= 97) fg = BASE16[k - 90 + 8];
      else if (k === 38 && codes[i + 1] === 5) { fg = xterm(codes[i + 2]); i += 2; }
      else if (k === 48 && codes[i + 1] === 5) { bg = xterm(codes[i + 2]); i += 2; }
    }
  }
  return out;
}

function terminal(title, cmd, text, file, width = 1180) {
  const lines = text.replace(/\x1b\[\?25[lh]|\x1b\[H|\x1b\[2J|\x1b\[K/g, '').replace(/\r/g, '').split('\n');
  while (lines.length && !lines.at(-1).trim()) lines.pop();
  const height = lines.length * 20 + 128;
  const html = `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;background:transparent}
    body{padding:28px;background:linear-gradient(135deg,#2a1f6b,#0e0d1a 55%,#13213d)}
    .win{border-radius:12px;background:#121212;box-shadow:0 20px 60px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.08);overflow:hidden}
    .bar{height:36px;display:flex;align-items:center;gap:8px;padding:0 14px;background:#1d1d1c;color:#898781;font:12px system-ui,sans-serif}
    .bar i{width:12px;height:12px;border-radius:50%;display:inline-block}.bar span{margin-left:10px}
    pre{margin:0;padding:16px 20px 20px;color:#f0efec;font:13.5px/20px "Cascadia Mono","Cascadia Code",Consolas,"DejaVu Sans Mono",monospace;white-space:pre}
    .ps{color:#9085e9}</style>
    <div class="win"><div class="bar"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i><span>${title}</span></div>
    <pre><span class="ps">❯</span> ${cmd}\n${lines.map(ansiToHtml).join('\n')}</pre></div>`;
  const f = path.join(TMP, file.replace('.png', '.html'));
  fs.writeFileSync(f, html);
  shot('file:///' + f.replace(/\\/g, '/'), file, width + 56, height + 56);
}

const run = (args) => execFileSync(process.execPath, [BIN, 'demo', ...args], { env: { ...env, COLUMNS: '140' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

/* ---------- go ---------- */
console.log('generating demo data…');
run(['--regen=1', 'version']);

console.log('terminal shots…');
terminal('cplus — overview', 'cplus', run(['overview']), 'cli-overview.png');
terminal('cplus — leak report', 'cplus waste', run(['waste', '--examples', '3']), 'cli-waste.png');
terminal('cplus — live monitor', 'cplus watch', run(['watch', '--once']), 'cli-watch.png');
terminal('cplus — 5-hour blocks', 'cplus blocks', run(['blocks', '-n', '8']), 'cli-blocks.png');
terminal('cplus — statusline themes', 'cplus statusline --preview', execFileSync(process.execPath, [BIN, 'statusline', '--preview'], { env, encoding: 'utf8' }), 'cli-statusline.png', 1000);
terminal('cplus — agent packs', 'cplus agents packs', run(['agents', 'packs']), 'cli-packs.png');

console.log('dashboard shots…');
const server = spawn(process.execPath, [BIN, 'demo', 'dash', '--no-open', '--port', String(PORT)], { env, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((res, rej) => {
  const to = setTimeout(() => rej(new Error('server did not start')), 30000);
  server.stdout.on('data', (d) => { if (String(d).includes('127.0.0.1')) { clearTimeout(to); res(); } });
});
try {
  const base = `http://127.0.0.1:${PORT}/`;
  const top = await fetch(`${base}api/report?since=30d`).then((r) => r.json());
  const sid = [...top.report.sessions].sort((a, b) => b.cost - a.cost)[0].sid;
  shot(`${base}?lang=en&theme=dark#overview`, 'dashboard-dark.png', 1440, 1420);
  shot(`${base}?lang=en&theme=light#overview`, 'dashboard-light.png', 1440, 1420);
  shot(`${base}?lang=en&theme=dark#leaks`, 'dashboard-leaks.png', 1440, 1500);
  shot(`${base}?lang=en&theme=dark#sessions/${sid}`, 'dashboard-session.png', 1440, 1080);
  shot(`${base}?lang=en&theme=dark#agents`, 'dashboard-agents.png', 1440, 1300);
  shot(`${base}?lang=en&theme=dark#settings`, 'dashboard-settings.png', 1440, 1100);
  shot(`${base}?lang=ja&theme=light#overview`, 'dashboard-ja.png', 1440, 900);
  shot(`${base}?lang=en&theme=dark#overview`, 'dashboard-mobile.png', 400, 1500, 2);
} finally {
  server.kill();
}

console.log('banner…');
shot('file:///' + path.join(ROOT, 'assets', 'banner.html').replace(/\\/g, '/'), 'banner.png', 1280, 640);
shot('file:///' + path.join(ROOT, 'assets', 'banner.html').replace(/\\/g, '/') + '?social', 'social-preview.png', 1280, 640);
fs.rmSync(TMP, { recursive: true, force: true });
console.log(`done → ${OUT}`);
