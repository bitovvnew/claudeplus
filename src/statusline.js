// Claude Code statusline: reads the session JSON on stdin, prints one colored line.
// Session cost is computed incrementally (only new bytes of the transcript are read on each refresh),
// and a small ledger in ~/.claudeplus/statusline-state.json gives "today" across all sessions.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { STATUS_STATE, readJson, writeJson } from './paths.js';
import { normUsage } from './parser.js';
import { costOf, contextWindow, shortModel } from './pricing.js';
import { loadConfig } from './config.js';
import { dayKey } from './analytics.js';

const E = (code) => (s) => `\x1b[${code}m${s}\x1b[0m`;
const col = { gray: E('90'), violet: E('38;5;141'), green: E('32'), yellow: E('33'), red: E('31'), cyan: E('36'), white: E('97'), orange: E('38;5;208'), bold: E('1') };
const SEP = col.gray(' │ ');

async function stdinJson() {
  if (process.stdin.isTTY) return {};
  let s = '';
  for await (const ch of process.stdin) s += ch;
  try { return JSON.parse(s.replace(/^﻿/, '')); } catch { return {}; }
}

/** Read new complete lines of `file` from `st.offset`, accumulate cost into `st`. */
function consume(file, st, isMain) {
  let size;
  let born = 0;
  try {
    const s = fs.statSync(file);
    size = s.size;
    // A resumed session starts with a copy of the old history (older timestamps) — don't bill it twice.
    born = s.birthtimeMs ? s.birthtimeMs - 60_000 : 0;
  } catch { return; }
  if (size < (st.offset || 0)) Object.assign(st, { offset: 0, cost: 0, seen: {} }); // file rewritten
  if (size === st.offset) return;
  const fd = fs.openSync(file, 'r');
  try {
    const len = size - (st.offset || 0);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, st.offset || 0);
    const text = buf.toString('utf8');
    const lastNl = text.lastIndexOf('\n');
    if (lastNl < 0) return;
    const chunk = text.slice(0, lastNl);
    st.offset = (st.offset || 0) + Buffer.byteLength(chunk, 'utf8') + 1;
    st.seen ||= {};
    for (const line of chunk.split('\n')) {
      if (!line.includes('"assistant"') || !line.includes('"usage"')) continue;
      let o; try { o = JSON.parse(line); } catch { continue; }
      if (o.type !== 'assistant' || !o.message?.usage) continue;
      const u = normUsage(o.message.usage);
      const ts = Date.parse(o.timestamp) || Date.now();
      if (born && ts < born) {
        if (isMain && !o.isSidechain) { st.ctx = u.in + u.cr + u.cw5 + u.cw1h; st.model = o.message.model; }
        continue;
      }
      const key = `${o.message.id}|${o.requestId || ''}`;
      const c = costOf(o.message.model, u).total;
      const prev = st.seen[key] || 0;
      if (c > prev) {
        const delta = c - prev;
        st.cost = (st.cost || 0) + delta;
        const d = dayKey(ts);
        st.days ||= {};
        st.days[d] = (st.days[d] || 0) + delta;
        st.seen[key] = c;
      }
      if (isMain && !o.isSidechain) {
        st.ctx = u.in + u.cr + u.cw5 + u.cw1h;
        st.model = o.message.model;
      }
    }
    // keep only the most recent ids (a message's lines are adjacent)
    const keys = Object.keys(st.seen);
    if (keys.length > 40) for (const k of keys.slice(0, keys.length - 40)) delete st.seen[k];
  } finally { fs.closeSync(fd); }
}

function gitBranch(cwd) {
  try {
    const head = fs.readFileSync(path.join(cwd, '.git', 'HEAD'), 'utf8').trim();
    return head.startsWith('ref:') ? head.split('/').slice(2).join('/') : head.slice(0, 7);
  } catch {
    try { return execFileSync('git', ['-C', cwd, 'branch', '--show-current'], { encoding: 'utf8', timeout: 300, stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; }
  }
}

function money(n) {
  return n >= 100 ? `$${n.toFixed(0)}` : `$${n.toFixed(2)}`;
}

export const THEMES = ['classic', 'capsule', 'powerline', 'emoji', 'minimal'];
const TONE_FG = { accent: col.violet, good: col.green, warn: col.yellow, bad: col.red, info: col.cyan, plain: col.white, muted: col.gray };
// 256-color backgrounds for capsule/powerline: [bg, fg]
const TONE_BG = { accent: [99, 231], good: [29, 231], warn: [136, 231], bad: [124, 231], info: [24, 231], plain: [238, 231], muted: [236, 250] };
const EMOJI = { model: '🧠', context: '📦', session: '💸', today: '📅', burn: '🔥', branch: '🌿', lines: '✏️', budget: '⚠️' };

function bar(pct, cells = 8) {
  const filled = Math.min(cells, Math.round((pct / 100) * cells));
  return '▰'.repeat(filled) + '▱'.repeat(cells - filled);
}

/** Collect segment data independent of theme. */
export function segments(input, state, cfg, now = Date.now()) {
  const sid = input.session_id || 'unknown';
  const s = state.sessions[sid] || {};
  const today = dayKey(now);
  const todayTotal = Object.values(state.sessions).reduce((a, x) => a + (x.days?.[today] || 0), 0);
  const model = input.model?.id || s.model;
  const out = [];
  for (const seg of cfg.statusline.segments) {
    if (seg === 'model') out.push({ id: seg, tone: 'accent', label: '', value: input.model?.display_name || shortModel(model) });
    else if (seg === 'context' && s.ctx) {
      const win = input.context_window?.context_window_size || contextWindow(model);
      const pct = (s.ctx / win) * 100;
      out.push({ id: seg, tone: pct >= 85 ? 'bad' : pct >= cfg.statusline.contextWarnPct ? 'warn' : 'good', label: '', value: `${bar(pct)} ${Math.round(pct)}% ${Math.round(s.ctx / 1000)}k`, bar: bar(pct), pct });
    } else if (seg === 'session') out.push({ id: seg, tone: 'plain', label: 'session', value: money(s.cost || input.cost?.total_cost_usd || 0) });
    else if (seg === 'today') {
      const lim = cfg.budget.daily;
      const ratio = lim ? todayTotal / lim : 0;
      out.push({ id: seg, tone: !lim ? 'plain' : ratio >= 1 ? 'bad' : ratio >= 0.8 ? 'warn' : 'good', label: 'today', value: money(todayTotal) + (lim ? '/' + money(lim) : '') });
    } else if (seg === 'burn' && s.cost && s.start) {
      const hours = Math.max((now - s.start) / 36e5, 0.25);
      out.push({ id: seg, tone: 'warn', label: '', value: `${money(s.cost / hours)}/h` });
    } else if (seg === 'budget' && cfg.budget.daily && todayTotal >= cfg.budget.daily) out.push({ id: seg, tone: 'bad', label: '', value: '⚠ budget' });
    else if (seg === 'branch') {
      const b = input.__branch ?? gitBranch(input.workspace?.current_dir || input.cwd || process.cwd());
      if (b) out.push({ id: seg, tone: 'info', label: '', value: b });
    } else if (seg === 'lines' && input.cost) out.push({ id: seg, tone: 'good', label: '', value: `+${input.cost.total_lines_added || 0} -${input.cost.total_lines_removed || 0}` });
  }
  return out;
}

export function render(input, state, cfg, now) {
  const segs = segments(input, state, cfg, now);
  const theme = THEMES.includes(cfg.statusline.theme) ? cfg.statusline.theme : 'classic';
  const lbl = (x) => (x.label ? x.label + ' ' : '');
  if (theme === 'minimal') return col.gray(segs.map((x) => lbl(x) + x.value).join(' · '));
  if (theme === 'emoji') return segs.map((x) => `${EMOJI[x.id] || '•'} ${TONE_FG[x.tone](x.value)}`).join('  ');
  if (theme === 'capsule' || theme === 'powerline') {
    const parts = segs.map((x) => {
      const [bg, fg] = TONE_BG[x.tone];
      const icon = x.id === 'model' ? '◆ ' : x.id === 'branch' ? '⎇ ' : '';
      return { bg, text: `\x1b[48;5;${bg}m\x1b[38;5;${fg}m ${icon}${lbl(x)}${x.value} \x1b[0m` };
    });
    if (theme === 'capsule') return parts.map((p) => p.text).join(' ');
    // Powerline: needs a Powerline/Nerd font for the  glyph.
    return parts.map((p, i) => {
      const next = parts[i + 1];
      const arrow = next ? `\x1b[38;5;${p.bg}m\x1b[48;5;${next.bg}m\x1b[0m` : `\x1b[38;5;${p.bg}m\x1b[0m`;
      return p.text + arrow;
    }).join('');
  }
  // classic
  return segs.map((x) => {
    if (x.id === 'model') return col.violet('◆ ') + col.bold(x.value);
    if (x.id === 'context') return `${TONE_FG[x.tone](x.bar)} ${TONE_FG[x.tone](Math.round(x.pct) + '%')} ${col.gray(x.value.split(' ').pop())}`;
    if (x.id === 'branch') return col.cyan('⎇ ' + x.value);
    return (x.label ? col.gray(x.label) + ' ' : '') + TONE_FG[x.tone](x.value);
  }).join(SEP);
}

/** `cplus statusline --preview`: every theme rendered with sample data. */
export function preview(cfg) {
  const now = Date.now();
  const state = { sessions: { demo: { cost: 4.12, ctx: 384_000, model: 'claude-opus-5-5', start: now - 2 * 36e5, days: { [dayKey(now)]: 23.4 } } } };
  const input = { session_id: 'demo', model: { id: 'claude-opus-5-5', display_name: 'Opus 5.5' }, __branch: 'main', cost: { total_lines_added: 182, total_lines_removed: 41 } };
  const c2 = { ...cfg, budget: { ...cfg.budget, daily: cfg.budget.daily || 50 }, statusline: { ...cfg.statusline, segments: ['model', 'context', 'session', 'today', 'burn', 'branch'] } };
  for (const theme of THEMES) {
    console.log(`  ${col.gray(theme.padEnd(10))} ${render(input, state, { ...c2, statusline: { ...c2.statusline, theme } }, now)}`);
  }
  console.log(col.gray(`\n  set with: cplus config statusline.theme <${THEMES.join('|')}>`));
}

export async function run(args = {}) {
  const cfg = loadConfig();
  if (args.preview) return preview(cfg);
  const input = await stdinJson();
  const state = readJson(STATUS_STATE, { sessions: {} });
  state.sessions ||= {};
  const sid = input.session_id || 'unknown';
  const s = (state.sessions[sid] ||= { files: {} });
  s.files ||= {};
  try {
    const tp = input.transcript_path;
    if (tp) {
      const files = [[tp, true]];
      const subDir = path.join(path.dirname(tp), path.basename(tp, '.jsonl'), 'subagents');
      try { for (const f of fs.readdirSync(subDir)) if (f.endsWith('.jsonl')) files.push([path.join(subDir, f), false]); } catch {}
      for (const [f, main] of files) {
        const fst = (s.files[f] ||= { offset: 0 });
        consume(f, fst, main);
        if (main) { if (fst.ctx) s.ctx = fst.ctx; if (fst.model) s.model = fst.model; }
      }
      s.cost = Object.values(s.files).reduce((a, x) => a + (x.cost || 0), 0);
      s.days = {};
      for (const x of Object.values(s.files)) for (const [d, v] of Object.entries(x.days || {})) s.days[d] = (s.days[d] || 0) + v;
      s.updated = Date.now();
      s.start ||= Date.now();
    }
    // forget sessions idle > 3 days
    for (const [k, v] of Object.entries(state.sessions)) if (Date.now() - (v.updated || 0) > 3 * 864e5) delete state.sessions[k];
    writeJson(STATUS_STATE, state, false);
  } catch { /* never break the statusline */ }
  process.stdout.write(render(input, state, cfg));
}

/** Today's spend across sessions seen by the statusline (used by the guard's budget stop). */
export function todaySpend() {
  const state = readJson(STATUS_STATE, { sessions: {} });
  const today = dayKey(Date.now());
  return Object.values(state.sessions || {}).reduce((a, x) => a + (x.days?.[today] || 0), 0);
}
