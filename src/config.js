import { CONFIG_FILE, readJson, writeJson } from './paths.js';

export const DEFAULTS = {
  // Budgets in USD. 0 = no limit. Statusline turns yellow at 80% and red at 100%.
  budget: { daily: 0, monthly: 0 },
  // Token guard hook (PreToolUse). mode: "block" denies the wasteful call ONCE (an identical retry goes
  // through), "warn" lets it run and adds a note for Claude, "off" disables the guard.
  guard: {
    mode: 'block',
    dedupeReads: true, // re-reading an unchanged file in the same session
    maxReadBytes: 256 * 1024, // full Read of files bigger than this without offset/limit
    noisyBash: true, // commands that dump huge outputs (ls -R, find /, cat of logs, ...)
    budgetStop: false, // deny tool calls once the daily budget is exceeded
  },
  // UI language for the dashboard and leak report (en, ru, uk, es, pt, fr, de, it, pl, tr, zh, ja, ko, hi, id, vi).
  // Empty = auto-detect from the system locale.
  lang: '',
  statusline: {
    theme: 'classic', // classic | capsule | powerline | emoji | minimal
    segments: ['model', 'context', 'session', 'today', 'burn', 'budget', 'branch'],
    contextWarnPct: 60,
  },
  // Override or add prices, $ per 1M tokens: { "my-model": { "input": 1, "output": 5, "cacheRead": 0.1 } }
  pricing: {},
  dashboard: { port: 4317 },
};

function merge(base, over) {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return over === undefined ? base : over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over || {})) {
    out[k] = typeof v === 'object' && v !== null && !Array.isArray(v) && typeof base[k] === 'object' ? merge(base[k], v) : v;
  }
  return out;
}

export function loadConfig() {
  return merge(DEFAULTS, readJson(CONFIG_FILE, {}));
}

export function saveConfig(cfg) {
  writeJson(CONFIG_FILE, cfg);
  return cfg;
}

/** Set a dotted key, e.g. setKey("budget.daily", 20). Values are JSON-parsed when possible. */
export function setKey(key, raw) {
  const cfg = loadConfig();
  let value = raw;
  if (typeof raw === 'string') {
    try { value = JSON.parse(raw); } catch { value = raw; }
  }
  const parts = key.split('.');
  let node = cfg;
  for (const p of parts.slice(0, -1)) {
    if (typeof node[p] !== 'object' || node[p] === null) node[p] = {};
    node = node[p];
  }
  node[parts.at(-1)] = value;
  return saveConfig(cfg);
}
