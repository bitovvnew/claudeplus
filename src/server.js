// Local dashboard server. Binds to 127.0.0.1 only; mutating requests need the X-CPlus header
// (custom header => browsers must preflight => cross-site pages can't call us) and a local Host
// header (blocks DNS-rebinding).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';
import { DASHBOARD_DIR, GUARD_LOG, ROOT } from './paths.js';
import { dict, detectLang, LANGS } from './i18n.js';
import { THEMES } from './statusline.js';

const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
import { scan } from './scanner.js';
import { buildReport, parseSince } from './analytics.js';
import { analyzeWaste } from './waste.js';
import { loadConfig, saveConfig } from './config.js';
import { PRICES } from './pricing.js';
import * as A from './agents.js';
import * as K from './skills.js';
import { status as installStatus, install, uninstall } from './installer.js';
import { c } from './ui.js';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon' };

let cached = null;
let cachedAt = 0;
let scanning = null;
async function data(force = false) {
  if (!force && cached && Date.now() - cachedAt < 15_000) return cached;
  scanning ||= scan().then((r) => { cached = r.files; cachedAt = Date.now(); scanning = null; return cached; });
  return scanning;
}

function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

async function readBody(req) {
  let s = '';
  for await (const chunk of req) { s += chunk; if (s.length > 2e6) throw new Error('Body too large'); }
  return s ? JSON.parse(s) : {};
}

function filterFrom(q) {
  return {
    since: parseSince(q.get('since') || '30d'),
    until: q.get('until') ? parseSince(q.get('until')) + 864e5 - 1 : undefined,
    project: q.get('project') || undefined,
    session: q.get('session') || undefined,
  };
}

function tailGuardLog(n = 100) {
  try {
    const lines = fs.readFileSync(GUARD_LOG, 'utf8').trim().split('\n').slice(-n);
    return lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean).reverse();
  } catch { return []; }
}

async function api(req, res, url) {
  const p = url.pathname.replace(/^\/api\//, '').split('/').map(decodeURIComponent);
  const m = req.method;
  const q = url.searchParams;

  if (p[0] === 'report' && m === 'GET') {
    const files = await data(q.get('refresh') === '1');
    const f = filterFrom(q);
    return send(res, 200, { report: buildReport(files, f), waste: analyzeWaste(files, f), today: buildReport(files, { since: parseSince('today'), project: f.project }).totals, month: buildReport(files, { since: parseSince('month'), project: f.project }).totals, config: loadConfig() });
  }
  if (p[0] === 'session' && p[1] && m === 'GET') {
    const files = await data();
    const r = buildReport(files, { session: p[1] });
    const sid = r.sessions[0]?.sid;
    const w = analyzeWaste(files.filter((f) => f.meta?.sid === sid));
    const own = files.filter((f) => f.meta?.sid === sid);
    const timeline = own.flatMap((f) => f.msgs).filter((x) => x.sid === sid || !x.sid).sort((a, b) => a.ts - b.ts)
      .map((x) => ({ ts: x.ts, model: x.model, ctx: x.in + x.cr + x.cw5 + x.cw1h, out: x.out, side: !!x.side, tools: x.tools || {} }));
    const big = own.flatMap((f) => f.meta?.big || []).sort((a, b) => b.chars - a.chars).slice(0, 10);
    return send(res, 200, { report: r, waste: w, timeline, big });
  }
  if (p[0] === 'agents') {
    const scope = p[1];
    const id = p[2];
    if (m === 'GET' && !scope) return send(res, 200, { agents: A.listAgents(), models: A.MODELS });
    if (m === 'GET' && id) return send(res, 200, A.readAgentText(id, { scope }));
    if (m === 'PUT' && id) { const b = await readBody(req); return send(res, 200, A.saveAgent({ id, scope, content: b.content })); }
    if (m === 'POST' && id && p[3] === 'toggle') { const cur = A.findAgent(id, { scope }); return send(res, 200, A.setEnabled(id, !cur.enabled, { scope })); }
    if (m === 'POST' && id && p[3] === 'model') { const b = await readBody(req); return send(res, 200, A.setModel(id, b.model, { scope })); }
    if (m === 'DELETE' && id) return send(res, 200, A.removeAgent(id, { scope }));
  }
  if (p[0] === 'meta' && m === 'GET') {
    const cfg = loadConfig();
    return send(res, 200, { version: VERSION, demo: !!process.env.CPLUS_DEMO, langs: LANGS, lang: detectLang(cfg.lang), configuredLang: cfg.lang || '', themes: THEMES, theme: cfg.statusline.theme });
  }
  if (p[0] === 'skills') {
    if (m === 'GET' && !p[1]) return send(res, 200, { skills: K.listSkills(), library: K.skillsLibrary() });
    if (m === 'POST' && p[1] === 'install' && p[2]) { const b = await readBody(req); return send(res, 200, K.installSkill(p[2], { scope: b.scope || 'user' })); }
    if (m === 'POST' && p[3] === 'toggle') { const cur = K.findSkill(p[2], { scope: p[1] }); return send(res, 200, K.setSkillEnabled(p[2], !cur.enabled, { scope: p[1] })); }
    if (m === 'DELETE' && p[2]) return send(res, 200, K.removeSkill(p[2], { scope: p[1] }));
  }
  if (p[0] === 'packs') {
    if (m === 'GET') return send(res, 200, { packs: A.packsList() });
    if (m === 'POST' && p[1]) { const b = await readBody(req); return send(res, 200, A.installPack(p[1], { scope: b.scope || 'user' })); }
  }
  if (p[0] === 'template' && m === 'POST') { const b = await readBody(req); return send(res, 200, { content: A.newAgentTemplate(b) }); }
  if (p[0] === 'library') {
    if (m === 'GET') return send(res, 200, { library: A.libraryList() });
    if (m === 'POST' && p[1]) { const b = await readBody(req); return send(res, 200, A.installFromLibrary(p[1], { scope: b.scope || 'user', force: !!b.force })); }
  }
  if (p[0] === 'config') {
    if (m === 'GET') return send(res, 200, { config: loadConfig(), prices: PRICES });
    if (m === 'PUT') { const b = await readBody(req); return send(res, 200, { config: saveConfig(b.config) }); }
  }
  if (p[0] === 'integration') {
    if (m === 'GET') return send(res, 200, installStatus());
    if (m === 'POST' && p[1] === 'install') { const b = await readBody(req); await install({ statusline: !!b.statusline, guard: !!b.guard, quiet: true }); return send(res, 200, installStatus()); }
    if (m === 'POST' && p[1] === 'uninstall') { const b = await readBody(req); await uninstall({ statusline: !!b.statusline, guard: !!b.guard, quiet: true }); return send(res, 200, installStatus()); }
  }
  if (p[0] === 'guard-log' && m === 'GET') return send(res, 200, { events: tailGuardLog(+q.get('n') || 100) });
  return send(res, 404, { error: 'Not found' });
}

export async function serve(args = {}) {
  const port = +(args.port || loadConfig().dashboard.port || 4317);
  const host = '127.0.0.1';
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);

  const server = http.createServer(async (req, res) => {
    try {
      if (!allowedHosts.has(req.headers.host || '')) return send(res, 403, { error: 'Bad host' });
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (url.pathname.startsWith('/api/')) {
        if (req.method !== 'GET' && req.headers['x-cplus'] !== '1') return send(res, 403, { error: 'Missing X-CPlus header' });
        return await api(req, res, url);
      }
      const lm = url.pathname.match(/^\/i18n\/([a-z]{2})\.json$/);
      if (lm) return send(res, 200, dict(lm[1]));
      if (url.pathname === '/logo.svg') return send(res, 200, fs.readFileSync(path.join(ROOT, 'assets', 'logo.svg')), MIME['.svg']);
      let file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      file = path.normalize(file).replace(/^(\.\.[\\/])+/, '');
      const full = path.join(DASHBOARD_DIR, file);
      if (!full.startsWith(DASHBOARD_DIR + path.sep) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) return send(res, 404, 'Not found', 'text/plain');
      send(res, 200, fs.readFileSync(full), MIME[path.extname(full)] || 'application/octet-stream');
    } catch (e) {
      send(res, 400, { error: e.message || String(e) });
    }
  });

  process.stderr.write(c.gray('  scanning transcripts…'));
  await data(true);
  process.stderr.write('\r\x1b[K');
  server.listen(port, host, () => {
    const link = `http://${host}:${port}`;
    console.log(`\n  ${c.violet(c.bold('◆ ClaudePlus dashboard'))}  ${c.cyan(link)}${process.env.CPLUS_DEMO ? c.yellow('  (demo data)') : ''}\n  ${c.gray('Ctrl+C to stop')}\n`);
    if (!args.noOpen) {
      const cmd = process.platform === 'win32' ? `start "" "${link}"` : process.platform === 'darwin' ? `open "${link}"` : `xdg-open "${link}"`;
      exec(cmd, () => {});
    }
  });
  server.on('error', (e) => {
    console.error(c.red(`  ✗ ${e.code === 'EADDRINUSE' ? `port ${port} is busy — try --port ${port + 1}` : e.message}`));
    process.exit(1);
  });
}
