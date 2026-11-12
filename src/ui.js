// Tiny terminal UI kit: colors, tables, bars, sparklines. No dependencies.
const enabled = (process.stdout.isTTY || process.env.FORCE_COLOR) && !process.env.NO_COLOR;
const wrap = (open, close) => (s) => (enabled ? `\x1b[${open}m${s}\x1b[${close}m` : String(s));

export const c = {
  bold: wrap(1, 22), dim: wrap(2, 22), italic: wrap(3, 23),
  red: wrap(31, 39), green: wrap(32, 39), yellow: wrap(33, 39), blue: wrap(34, 39),
  magenta: wrap(35, 39), cyan: wrap(36, 39), gray: wrap(90, 39), white: wrap(97, 39),
  orange: wrap('38;5;208', 39), violet: wrap('38;5;141', 39), teal: wrap('38;5;43', 39), brand: wrap('38;5;42', 39),
};

export const strip = (s) => String(s).replace(/\x1b\[[0-9;]*m/g, '');
export const vlen = (s) => [...strip(s)].length;
const pad = (s, w, align = 'left') => {
  const n = Math.max(0, w - vlen(s));
  return align === 'right' ? ' '.repeat(n) + s : s + ' '.repeat(n);
};

export function usd(n) {
  if (n == null || Number.isNaN(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (a >= 100) return '$' + n.toFixed(0);
  if (a >= 1) return '$' + n.toFixed(2);
  if (a >= 0.01) return '$' + n.toFixed(3);
  return a === 0 ? '$0' : '$' + n.toFixed(4);
}

export function num(n) {
  if (n == null) return '—';
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(Math.round(n));
}

export function ago(ts) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const BLOCKS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'];
export function bar(value, max, width = 24, color = c.violet) {
  if (!max || value <= 0) return c.gray('·') + ' '.repeat(width - 1);
  const full = Math.min(1, value / max) * width;
  const whole = Math.floor(full);
  const part = BLOCKS[Math.floor((full - whole) * 8)];
  const s = '█'.repeat(whole) + part;
  return color(s) + ' '.repeat(Math.max(0, width - [...s].length));
}

const SPARK = '▁▂▃▄▅▆▇█';
export function spark(values, color = c.teal) {
  const max = Math.max(...values, 0);
  if (!max) return c.gray('▁'.repeat(values.length));
  return color(values.map((v) => (v <= 0 ? ' ' : SPARK[Math.min(7, Math.floor((v / max) * 7.999))])).join(''));
}

/** cols: [{ label, get(row), align?, color?(v,row), max? }] */
export function table(rows, cols, { indent = '  ' } = {}) {
  const cells = rows.map((r) => cols.map((col) => {
    let v = col.get(r);
    v = v == null ? '' : String(v);
    if (col.max && vlen(v) > col.max) v = [...strip(v)].slice(0, col.max - 1).join('') + '…';
    return col.color ? col.color(v, r) : v;
  }));
  const widths = cols.map((col, i) => Math.max(vlen(col.label), ...cells.map((r) => vlen(r[i]))));
  const head = cols.map((col, i) => c.gray(pad(col.label, widths[i], col.align))).join('  ');
  const lines = [indent + head, indent + c.gray(widths.map((w) => '─'.repeat(w)).join('  '))];
  for (const r of cells) lines.push(indent + r.map((v, i) => pad(v, widths[i], cols[i].align)).join('  '));
  return lines.join('\n');
}

export function box(title, body) {
  const lines = String(body).split('\n');
  const w = Math.max(vlen(title) + 4, ...lines.map(vlen)) + 2;
  const top = c.gray('╭─ ') + c.bold(title) + ' ' + c.gray('─'.repeat(Math.max(0, w - vlen(title) - 3)) + '╮');
  const mid = lines.map((l) => c.gray('│') + ' ' + pad(l, w - 1) + c.gray('│'));
  const bot = c.gray('╰' + '─'.repeat(w) + '╯');
  return [top, ...mid, bot].join('\n');
}

export const logo = () => c.brand('▣') + ' ' + c.bold('Claude') + c.brand(c.bold('Plus')) + c.gray('  · the companion for Claude Code');

export function progress(done, total, label = '') {
  if (!process.stderr.isTTY) return;
  const w = 28;
  const f = total ? Math.round((done / total) * w) : w;
  process.stderr.write(`\r  ${c.brand('█'.repeat(f))}${c.gray('░'.repeat(w - f))} ${done}/${total} ${c.gray(label.slice(-40))}\x1b[K`);
  if (done >= total) process.stderr.write('\r\x1b[K');
}
