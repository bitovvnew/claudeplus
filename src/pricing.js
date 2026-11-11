// $ per 1M tokens. Cache writes: 5-minute TTL = 1.25x input, 1-hour TTL = 2x input.
// cacheRead defaults to 0.1x input when not listed. Prices: Anthropic first-party API list prices.
// Override any of them in ~/.claudeplus/config.json -> "pricing".
import { loadConfig } from './config.js';

const P = (input, output, cacheRead, extra = {}) => ({ input, output, cacheRead: cacheRead ?? +(input * 0.1).toFixed(4), ...extra });

export const PRICES = {
  'claude-fable-5-2': P(8, 40, 0.2),
  'claude-mythos-5-2': P(8, 40, 0.2),
  'claude-fable-5-1': P(10, 50),
  'claude-mythos-5-1': P(10, 50),
  'claude-fable-5': P(10, 50),
  'claude-mythos-5': P(10, 50),
  'claude-opus-5-5': P(4, 20, 0.2),
  'claude-opus-5': P(5, 25),
  'claude-opus-4-8': P(5, 25),
  'claude-opus-4-7': P(5, 25),
  'claude-opus-4-6': P(5, 25),
  'claude-opus-4-5': P(5, 25),
  'claude-opus-4-1': P(15, 75),
  'claude-opus-4': P(15, 75),
  'claude-sonnet-5-5': P(2, 10, 0.1),
  'claude-sonnet-5': P(2, 10),
  'claude-sonnet-4-6': P(3, 15),
  'claude-sonnet-4-5': P(3, 15),
  'claude-sonnet-4': P(3, 15),
  'claude-3-7-sonnet': P(3, 15),
  'claude-3-5-sonnet': P(3, 15),
  // Haiku 5.5: prompts above 100K tokens are billed at 5x.
  'claude-haiku-5-5': P(0.1, 0.5, 0.01, { longContext: { threshold: 100_000, mult: 5 } }),
  'claude-haiku-4-5': P(1, 5),
  'claude-3-5-haiku': P(0.8, 4),
  'claude-3-haiku': P(0.25, 1.25),
};

export const WEB_SEARCH_PER_REQUEST = 0.01; // $10 / 1000 searches
export const FAST_MULT = 2; // fast mode is billed at 2x standard

const FAMILY_FALLBACK = [
  ['fable', 'claude-fable-5-2'],
  ['mythos', 'claude-mythos-5-2'],
  ['opus', 'claude-opus-5-5'],
  ['sonnet', 'claude-sonnet-5-5'],
  ['haiku', 'claude-haiku-5-5'],
];

let table = null;
const resolved = new Map();

function getTable() {
  if (!table) table = { ...PRICES, ...(loadConfig().pricing || {}) };
  return table;
}

/** Normalise ids like "us.anthropic.claude-opus-4-8-20250101-v1:0", "claude-sonnet-4-6[1m]", "claude-opus-4-5@20251101". */
export function canonicalModel(model) {
  if (!model) return 'unknown';
  let m = String(model).toLowerCase();
  m = m.replace(/\[.*?\]/g, '').replace(/^.*?anthropic\./, '').replace(/@.*$/, '').replace(/-v\d+(:\d+)?$/, '');
  m = m.replace(/-\d{8}$/, '');
  return m;
}

/** Returns { key, price, estimated } — estimated=true when we fell back to a family guess. */
export function priceFor(model) {
  if (resolved.has(model)) return resolved.get(model);
  const t = getTable();
  const m = canonicalModel(model);
  let out;
  if (m === '<synthetic>' || m === 'unknown') out = { key: m, price: null, estimated: false };
  else if (t[m]) out = { key: m, price: t[m], estimated: false };
  else {
    const keys = Object.keys(t).sort((a, b) => b.length - a.length);
    const hit = keys.find((k) => m.startsWith(k));
    if (hit) out = { key: hit, price: t[hit], estimated: false };
    else {
      const fam = FAMILY_FALLBACK.find(([f]) => m.includes(f));
      out = fam ? { key: fam[1], price: t[fam[1]], estimated: true } : { key: m, price: null, estimated: true };
    }
  }
  resolved.set(model, out);
  return out;
}

/**
 * Cost of one API call. u = { in, out, cw5, cw1h, cr, web, fast }.
 * Returns { total, input, output, cacheWrite, cacheRead, web }.
 */
export function costOf(model, u) {
  const { price } = priceFor(model);
  const zero = { total: 0, input: 0, output: 0, cacheWrite: 0, cacheRead: 0, web: 0 };
  if (!price) return zero;
  let mult = u.fast ? FAST_MULT : 1;
  const prompt = (u.in || 0) + (u.cr || 0) + (u.cw5 || 0) + (u.cw1h || 0);
  if (price.longContext && prompt > price.longContext.threshold) mult *= price.longContext.mult;
  const k = mult / 1e6;
  const input = (u.in || 0) * price.input * k;
  const output = (u.out || 0) * price.output * k;
  const cacheWrite = ((u.cw5 || 0) * 1.25 + (u.cw1h || 0) * 2) * price.input * k;
  const cacheRead = (u.cr || 0) * price.cacheRead * k;
  const web = (u.web || 0) * WEB_SEARCH_PER_REQUEST;
  return { total: input + output + cacheWrite + cacheRead + web, input, output, cacheWrite, cacheRead, web };
}

/** Context window size used for the "context %" indicator. */
export function contextWindow(model) {
  const m = canonicalModel(model);
  if (/haiku-4-5|3-5-haiku|3-haiku|3-7-sonnet|3-5-sonnet|opus-4-1|opus-4$|sonnet-4$|sonnet-4-5/.test(m)) return 200_000;
  return 1_000_000;
}

export function shortModel(model) {
  const m = canonicalModel(model);
  const x = m.match(/(fable|mythos|opus|sonnet|haiku)-(\d+(?:-\d+)?)/);
  if (x) return `${x[1][0].toUpperCase()}${x[1].slice(1)} ${x[2].replace('-', '.')}`;
  const y = m.match(/claude-(\d-\d)-(\w+)/);
  if (y) return `${y[2][0].toUpperCase()}${y[2].slice(1)} ${y[1].replace('-', '.')}`;
  return m;
}
