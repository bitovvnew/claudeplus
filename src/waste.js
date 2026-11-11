// "Where did money leak?" — heuristics over transcripts. Every finding carries an estimated $ amount;
// texts are i18n keys (leak.<id>.title|detail|advice) rendered by the CLI or the dashboard.
// Estimates are deliberately conservative (lower bounds).
import { costOf, priceFor, canonicalModel } from './pricing.js';
import { projectName } from './analytics.js';

const GAP_5M = 5 * 60_000;
const GAP_1H = 60 * 60_000;
const CTX_HEAVY = 200_000;
const CTX_TARGET = 150_000;

function mainModel(msgs) {
  const by = {};
  for (const m of msgs) by[m.model] = (by[m.model] || 0) + m.out + m.in;
  return Object.entries(by).sort((a, b) => b[1] - a[1])[0]?.[0] || 'claude-opus-5-5';
}

/** $ for N tokens entering the context once (written to cache). */
function contextCost(model, tokens) {
  const p = priceFor(model).price;
  return p ? (tokens * p.input * 1.25) / 1e6 : 0;
}

const money = (n) => '$' + (n >= 100 ? n.toFixed(0) : n.toFixed(2));
const k = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : Math.round(n / 1000) + 'k');

export function analyzeWaste(files, f = {}) {
  const since = f.since || 0;
  const findings = [];
  const dup = { cost: 0, tokens: 0, count: 0, examples: [] };
  const big = { cost: 0, tokens: 0, count: 0, examples: [] };
  const rebuild = { cost: 0, tokens: 0, count: 0, examples: [] };
  const heavy = { cost: 0, savings: 0, count: 0, examples: [] };
  const subs = { cost: 0, savings: 0, count: 0, byModel: {} };
  let think = 0, out = 0, total = 0;
  const seen = new Set();

  for (const file of [...files].sort((a, b) => (a.meta?.firstTs || 0) - (b.meta?.firstTs || 0))) {
    const meta = file.meta || {};
    const proj = projectName(meta, file.file);
    if (f.project && !proj.toLowerCase().includes(f.project.toLowerCase())) continue;
    const msgs = (file.msgs || []).filter((m) => m.ts >= since && !seen.has(m.id));
    if (!msgs.length) continue;
    msgs.forEach((m) => seen.add(m.id));
    const model = mainModel(msgs);
    const label = meta.title || meta.firstPrompt || meta.sid || '';

    for (const [p, r] of Object.entries(meta.reads || {})) {
      const tokens = Math.round(((r.n - 1) * r.chars) / 4);
      const cost = contextCost(model, tokens);
      dup.cost += cost; dup.tokens += tokens; dup.count += r.n - 1;
      dup.examples.push({ project: proj, session: label, what: p, times: r.n, tokens, cost });
    }
    for (const b of meta.big || []) {
      const tokens = Math.round(b.chars / 4);
      const cost = contextCost(model, tokens);
      big.cost += cost; big.tokens += tokens; big.count++;
      big.examples.push({ project: proj, session: label, what: `${b.tool}: ${b.hint || ''}`.trim(), tokens, cost });
    }

    const main = msgs.filter((m) => !m.side).sort((a, b) => a.ts - b.ts);
    for (let i = 1; i < main.length; i++) {
      const m = main[i];
      const gap = m.ts - main[i - 1].ts;
      const cw = m.cw5 + m.cw1h;
      const limit = m.cw1h > m.cw5 ? GAP_1H : GAP_5M;
      if (gap > limit && cw > 30_000) {
        const p = priceFor(m.model).price;
        if (!p) continue;
        const extra = ((m.cw5 * 1.25 + m.cw1h * 2) * p.input) / 1e6 - (cw * p.cacheRead) / 1e6;
        rebuild.cost += extra; rebuild.tokens += cw; rebuild.count++;
        rebuild.examples.push({ project: proj, session: label, what: `${Math.round(gap / 60_000)} min idle → ${Math.round(cw / 1000)}k tokens re-cached`, tokens: cw, cost: extra, ts: m.ts });
      }
    }
    for (const m of msgs) {
      const c = costOf(m.model, m).total;
      total += c; think += m.think || 0; out += m.out;
      const ctx = m.in + m.cr + m.cw5 + m.cw1h;
      if (ctx > CTX_HEAVY) {
        const p = priceFor(m.model).price;
        heavy.cost += c; heavy.savings += p ? ((ctx - CTX_TARGET) * p.cacheRead) / 1e6 : 0; heavy.count++;
      }
      if (m.side && /opus|fable|mythos/.test(canonicalModel(m.model))) {
        const alt = costOf('claude-sonnet-5-5', m).total;
        subs.cost += c; subs.savings += Math.max(0, c - alt); subs.count++;
        const key = priceFor(m.model).key;
        subs.byModel[key] = (subs.byModel[key] || 0) + c;
      }
    }
    const heavyHere = msgs.filter((m) => m.in + m.cr + m.cw5 + m.cw1h > CTX_HEAVY);
    if (heavyHere.length) {
      const peak = Math.max(...heavyHere.map((m) => m.in + m.cr + m.cw5 + m.cw1h));
      heavy.examples.push({ project: proj, session: label, what: `${heavyHere.length} calls over 200k context, peak ${Math.round(peak / 1000)}k`, cost: heavyHere.reduce((a, m) => a + costOf(m.model, m).total, 0) });
    }
  }

  const top = (arr, n = 8) => arr.sort((a, b) => (b.cost || 0) - (a.cost || 0)).slice(0, n);
  const add = (id, severity, savings, params, examples) => findings.push({ id, severity, savings, params, examples });

  if (rebuild.count) add('cache-rebuild', rebuild.cost > 5 ? 'high' : 'medium', rebuild.cost, { count: rebuild.count, tokens: k(rebuild.tokens) }, top(rebuild.examples));
  if (heavy.count) add('heavy-context', heavy.savings > 5 ? 'high' : 'medium', heavy.savings, { count: heavy.count, cost: money(heavy.cost) }, top(heavy.examples));
  if (subs.count) add('premium-subagents', subs.savings > 5 ? 'high' : 'low', subs.savings, { count: subs.count, cost: money(subs.cost), savings: money(subs.savings) }, Object.entries(subs.byModel).map(([what, cost]) => ({ what, cost })));
  if (dup.count) add('duplicate-reads', dup.cost > 2 ? 'medium' : 'low', dup.cost, { count: dup.count, tokens: k(dup.tokens) }, top(dup.examples));
  if (big.count) add('big-outputs', big.cost > 2 ? 'medium' : 'low', big.cost, { count: big.count, tokens: k(big.tokens) }, top(big.examples));
  if (out > 0) add('thinking', 'info', 0, { pct: Math.round((think / out) * 100) + '%' }, []);

  const savings = findings.reduce((a, x) => a + (x.savings || 0), 0);
  return {
    total, savings, pct: total ? savings / total : 0,
    score: Math.max(0, Math.round(100 - (total ? (savings / total) * 100 * 2 : 0))),
    findings: findings.sort((a, b) => (b.savings || 0) - (a.savings || 0)),
  };
}
