// Turns scanner output into aggregated reports (totals, per day/model/project/session/tool, heatmap).
import path from 'node:path';
import { costOf, priceFor, shortModel } from './pricing.js';

export const dayKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function startOfDay(ts = Date.now()) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Parse "7d", "30d", "2026-11-01", "today", "month", "all" into a timestamp. */
export function parseSince(v) {
  if (!v || v === 'all') return 0;
  if (v === 'today') return startOfDay();
  if (v === 'week') return startOfDay(Date.now() - 6 * 864e5);
  if (v === 'month') { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); }
  const m = String(v).match(/^(\d+)([dhw])$/);
  if (m) {
    const n = +m[1];
    if (m[2] === 'h') return Date.now() - n * 36e5;
    return startOfDay(Date.now() - (n * (m[2] === 'w' ? 7 : 1) - 1) * 864e5);
  }
  const t = Date.parse(v);
  return Number.isNaN(t) ? 0 : startOfDay(t);
}

export function projectName(meta, file) {
  if (meta?.cwd) return path.basename(meta.cwd) || meta.cwd;
  // Fallback: projects/<encoded-dir>/... → last segment of the encoded path
  const rel = file.split(/[\\/]projects[\\/]/)[1] || file;
  const enc = rel.split(/[\\/]/)[0];
  return enc.split('-').filter(Boolean).slice(-2).join('-') || enc;
}

const add = (a, b) => { for (const k in b) a[k] = (a[k] || 0) + b[k]; return a; };

export const BLOCK_MS = 5 * 36e5;

/**
 * 5-hour usage blocks (the windows Claude subscription limits are counted in), burn rate,
 * last-24h hourly spend and currently active sessions.
 * @param {Array<[ts:number, cost:number, sid:string]>} tl
 */
export function liveStats(tl, now = Date.now()) {
  tl.sort((a, b) => a[0] - b[0]);
  const blocks = [];
  let cur = null;
  for (const [ts, cost] of tl) {
    if (!cur || ts >= cur.end) {
      const start = new Date(ts); start.setMinutes(0, 0, 0);
      cur = { start: start.getTime(), end: start.getTime() + BLOCK_MS, cost: 0, calls: 0, lastTs: ts };
      blocks.push(cur);
    }
    cur.cost += cost; cur.calls++; cur.lastTs = ts;
  }
  const last = blocks.at(-1);
  let activeBlock = null;
  if (last && now < last.end) {
    const elapsed = Math.max(now - last.start, 10 * 60_000);
    activeBlock = { ...last, left: last.end - now, projected: (last.cost / elapsed) * BLOCK_MS };
  }
  const hourAgo = now - 36e5;
  let burn = 0;
  const hourly24 = Array(24).fill(0);
  const activeSessions = {};
  for (let i = tl.length - 1; i >= 0; i--) {
    const [ts, cost, sid] = tl[i];
    if (ts < now - 24 * 36e5) break;
    if (ts >= hourAgo) burn += cost;
    const slot = 23 - Math.floor((now - ts) / 36e5);
    if (slot >= 0) hourly24[slot] += cost;
    if (ts >= now - 15 * 60_000) activeSessions[sid] = (activeSessions[sid] || 0) + cost;
  }
  return {
    blocks: blocks.slice(-60).reverse(),
    activeBlock,
    burnRate: burn,
    hourly24,
    activeSessions: Object.keys(activeSessions),
  };
}

/**
 * @param {Array} files scanner files
 * @param {{since?:number, until?:number, project?:string, session?:string}} f
 */
export function buildReport(files, f = {}) {
  const since = f.since || 0;
  const until = f.until || Infinity;
  const seen = new Set();

  const totals = { cost: 0, msgs: 0, prompts: 0, in: 0, out: 0, cw: 0, cr: 0, think: 0, web: 0, side: 0, sideCost: 0, fastCost: 0 };
  const split = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, web: 0 };
  const days = new Map();
  const models = new Map();
  const projects = new Map();
  const sessions = new Map();
  const tools = new Map();
  const heat = Array.from({ length: 7 }, () => Array(24).fill(0));
  const estimated = new Set();
  const agentsSpawned = {};
  const timeline = [];

  // Resumed/forked sessions copy earlier messages into a new transcript. Process files oldest-first
  // so each API call is credited to the session that actually made it (dedup by message id).
  files = [...files].sort((a, b) => (a.meta?.firstTs || 0) - (b.meta?.firstTs || 0));
  for (const file of files) {
    const meta = file.meta || {};
    const proj = projectName(meta, file.file);
    if (f.project && !proj.toLowerCase().includes(f.project.toLowerCase())) continue;

    for (const m of file.msgs || []) {
      if (m.ts < since || m.ts > until) continue;
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      if (f.session && !(m.sid || '').startsWith(f.session)) continue;

      const c = costOf(m.model, m);
      const pf = priceFor(m.model);
      timeline.push([m.ts, c.total, m.sid]);
      if (pf.estimated) estimated.add(m.model);
      const cw = m.cw5 + m.cw1h;

      totals.cost += c.total; totals.msgs++;
      totals.in += m.in; totals.out += m.out; totals.cw += cw; totals.cr += m.cr;
      totals.think += m.think || 0; totals.web += m.web || 0;
      if (m.side) { totals.side++; totals.sideCost += c.total; }
      if (m.fast) totals.fastCost += c.total;
      add(split, { input: c.input, output: c.output, cacheWrite: c.cacheWrite, cacheRead: c.cacheRead, web: c.web });

      const dk = dayKey(m.ts);
      const d = days.get(dk) || { day: dk, cost: 0, msgs: 0, tokens: 0, byModel: {} };
      d.cost += c.total; d.msgs++; d.tokens += m.in + m.out + cw + m.cr;
      d.byModel[pf.key] = (d.byModel[pf.key] || 0) + c.total;
      days.set(dk, d);

      const mo = models.get(pf.key) || { model: pf.key, label: shortModel(pf.key), cost: 0, msgs: 0, in: 0, out: 0, cw: 0, cr: 0, estimated: pf.estimated };
      mo.cost += c.total; mo.msgs++; mo.in += m.in; mo.out += m.out; mo.cw += cw; mo.cr += m.cr;
      models.set(pf.key, mo);

      const pr = projects.get(proj) || { project: proj, path: meta.cwd || '', cost: 0, msgs: 0, sessions: new Set(), lastTs: 0 };
      pr.cost += c.total; pr.msgs++; pr.sessions.add(m.sid); pr.lastTs = Math.max(pr.lastTs, m.ts);
      projects.set(proj, pr);

      const sid = m.sid || file.file;
      const s = sessions.get(sid) || {
        sid, title: null, project: proj, cwd: meta.cwd || '', branch: meta.branch || '', cost: 0, msgs: 0, prompts: 0,
        firstTs: m.ts, lastTs: m.ts, models: {}, sideCost: 0, maxCtx: 0, tools: {}, files: new Set(),
      };
      s.cost += c.total; s.msgs++;
      s.firstTs = Math.min(s.firstTs, m.ts); s.lastTs = Math.max(s.lastTs, m.ts);
      s.models[pf.key] = (s.models[pf.key] || 0) + c.total;
      if (m.side) s.sideCost += c.total;
      s.maxCtx = Math.max(s.maxCtx, m.in + m.cr + cw);
      s.files.add(file.file);
      sessions.set(sid, s);

      // Attribute the call's cost evenly across the tools it invoked ("what did tool X cost me").
      const tl = m.tools ? Object.entries(m.tools) : [];
      const nCalls = tl.reduce((a, [, n]) => a + n, 0);
      if (!nCalls) {
        const t = tools.get('(reply)') || { tool: '(reply)', calls: 0, cost: 0, resultChars: 0 };
        t.cost += c.total; t.calls++; tools.set('(reply)', t);
      } else {
        for (const [name, n] of tl) {
          const t = tools.get(name) || { tool: name, calls: 0, cost: 0, resultChars: 0 };
          t.calls += n; t.cost += (c.total * n) / nCalls; tools.set(name, t);
          s.tools[name] = (s.tools[name] || 0) + n;
        }
      }

      const dt = new Date(m.ts);
      heat[(dt.getDay() + 6) % 7][dt.getHours()] += c.total;
    }
  }

  // Session metadata (titles, prompt counts, tool result volume) — only for sessions in range.
  for (const file of files) {
    const meta = file.meta || {};
    const s = sessions.get(meta.sid) || [...sessions.values()].find((x) => x.files.has(file.file));
    if (!s) continue;
    if (meta.title && !s.title) s.title = meta.title;
    if (!s.firstPrompt && meta.firstPrompt) s.firstPrompt = meta.firstPrompt;
    s.prompts += meta.prompts || 0;
    totals.prompts += meta.prompts || 0;
    for (const [name, r] of Object.entries(meta.results || {})) {
      const t = tools.get(name) || { tool: name, calls: 0, cost: 0, resultChars: 0 };
      t.resultChars += r.chars; tools.set(name, t);
    }
    for (const [t, n] of Object.entries(meta.agents || {})) agentsSpawned[t] = (agentsSpawned[t] || 0) + n;
  }

  // Continuous day axis
  const dayList = [];
  if (days.size) {
    const keys = [...days.keys()].sort();
    const start = since ? since : Date.parse(keys[0] + 'T00:00:00');
    const end = Math.min(until === Infinity ? Date.now() : until, Date.now());
    // Step with Date#setDate so DST shifts never skip or duplicate a day.
    for (const d = new Date(startOfDay(start)); d.getTime() <= end; d.setDate(d.getDate() + 1)) {
      const k = dayKey(d.getTime());
      dayList.push(days.get(k) || { day: k, cost: 0, msgs: 0, tokens: 0, byModel: {} });
    }
  }

  const sessList = [...sessions.values()].map((s) => {
    const { files: fset, ...rest } = s;
    return { ...rest, title: s.title || s.firstPrompt || '(untitled)', files: fset.size, costPerPrompt: s.prompts ? s.cost / s.prompts : null };
  }).sort((a, b) => b.lastTs - a.lastTs);

  const live = liveStats(timeline);

  return {
    ...live,
    generatedAt: Date.now(),
    range: { since, until: until === Infinity ? null : until },
    totals: { ...totals, sessions: sessions.size, projects: projects.size },
    split,
    days: dayList,
    models: [...models.values()].sort((a, b) => b.cost - a.cost),
    projects: [...projects.values()].map((p) => ({ ...p, sessions: p.sessions.size })).sort((a, b) => b.cost - a.cost),
    sessions: sessList,
    tools: [...tools.values()].map((t) => ({ ...t, resultTokens: Math.round(t.resultChars / 4) })).sort((a, b) => b.cost - a.cost),
    agents: Object.entries(agentsSpawned).map(([type, spawned]) => ({ type, spawned })).sort((a, b) => b.spawned - a.spawned),
    heat,
    estimatedModels: [...estimated],
  };
}
