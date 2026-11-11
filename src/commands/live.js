// `cplus watch` — live terminal monitor; `cplus blocks` — 5-hour usage blocks.
import { scan } from '../scanner.js';
import { buildReport, parseSince } from '../analytics.js';
import { loadConfig } from '../config.js';
import { shortModel } from '../pricing.js';
import { c, usd, num, bar, spark, table, box, logo, ago } from '../ui.js';

const hm = (ms) => {
  const m = Math.max(0, Math.round(ms / 60_000));
  return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
};
const clock = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export async function blocks(args) {
  const { files } = await scan();
  const r = buildReport(files, { since: parseSince(args.since || '7d'), project: args.project });
  const list = r.blocks.slice(0, +args.limit || 20);
  const max = Math.max(...list.map((b) => b.cost), 0);
  console.log(`\n  ${c.bold('5-hour blocks')} ${c.gray('— the windows Claude subscription limits are counted in')}\n`);
  if (r.activeBlock) {
    const b = r.activeBlock;
    const pct = 1 - b.left / (5 * 36e5);
    console.log(box('Active block', [
      `${c.gray('started')} ${clock(b.start)}  ${c.gray('ends')} ${clock(b.end)}  ${c.gray('left')} ${c.bold(hm(b.left))}`,
      `${bar(pct, 1, 30, c.teal)} ${Math.round(pct * 100)}% of the window elapsed`,
      `${c.gray('spent')} ${c.bold(usd(b.cost))}   ${c.gray('projected for the block')} ${c.orange(usd(b.projected))}   ${c.gray('calls')} ${b.calls}`,
    ].join('\n')) + '\n');
  }
  console.log(table(list, [
    { label: 'start', get: (b) => new Date(b.start).toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }) },
    { label: 'cost', get: (b) => usd(b.cost), align: 'right' },
    { label: '', get: (b) => bar(b.cost, max, 30, c.violet) },
    { label: 'calls', get: (b) => num(b.calls), align: 'right' },
    { label: 'active', get: (b) => (r.activeBlock && b.start === r.activeBlock.start ? c.green('● now') : '') },
  ]));
  console.log();
}

export async function watch(args) {
  const every = Math.max(1, +(args.interval || 3)) * 1000;
  const cfg = loadConfig();
  const tty = process.stdout.isTTY;
  const draw = async () => {
    const { files } = await scan();
    const today = buildReport(files, { since: parseSince('today') });
    const day = buildReport(files, { since: Date.now() - 24 * 36e5 });
    const t = today.totals;
    const lines = [];
    lines.push(`${logo()}   ${c.gray(new Date().toLocaleTimeString())}  ${c.green('● live')}`);
    lines.push('');
    const lim = cfg.budget.daily;
    const ratio = lim ? t.cost / lim : 0;
    const col = !lim ? c.white : ratio >= 1 ? c.red : ratio >= 0.8 ? c.yellow : c.green;
    lines.push(`  ${c.gray('Today')}      ${c.bold(col(usd(t.cost)))}${lim ? c.gray(' / ' + usd(lim)) + '  ' + bar(Math.min(t.cost, lim), lim, 24, col) : ''}`);
    lines.push(`  ${c.gray('Burn rate')}  ${c.orange(usd(day.burnRate) + '/h')}   ${c.gray('calls today')} ${num(t.msgs)}   ${c.gray('prompts')} ${num(t.prompts)}`);
    const ab = day.activeBlock;
    if (ab) {
      const pct = 1 - ab.left / (5 * 36e5);
      lines.push(`  ${c.gray('5h block')}   ${usd(ab.cost)} ${c.gray('→')} ${c.orange(usd(ab.projected))} ${c.gray('projected')}   ${bar(pct, 1, 20, c.teal)} ${c.gray(hm(ab.left) + ' left')}`);
    } else lines.push(`  ${c.gray('5h block')}   ${c.gray('idle — next message starts a new block')}`);
    lines.push(`  ${c.gray('Last 24h')}   ${spark(day.hourly24)} ${c.gray('max ' + usd(Math.max(...day.hourly24)))}/h`);
    lines.push('');
    const active = day.sessions.filter((s) => day.activeSessions.includes(s.sid));
    lines.push(`  ${c.bold('Active sessions')} ${c.gray('(last 15 min)')}`);
    if (!active.length) lines.push(c.gray('  none'));
    else lines.push(table(active.slice(0, 8), [
      { label: 'session', get: (s) => s.title, max: 40 },
      { label: 'project', get: (s) => s.project, max: 18 },
      { label: 'model', get: (s) => shortModel(Object.keys(s.models)[0] || '') },
      { label: '24h cost', get: (s) => usd(s.cost), align: 'right' },
      { label: 'ctx', get: (s) => num(s.maxCtx), align: 'right' },
      { label: 'last', get: (s) => c.gray(ago(s.lastTs)) },
    ]));
    lines.push('');
    lines.push(c.gray(`  refresh ${every / 1000}s · Ctrl+C to quit · full UI: cplus dash`));
    if (tty) process.stdout.write('\x1b[H\x1b[2J');
    process.stdout.write(lines.join('\n') + '\n');
  };
  if (args.once) return draw();
  if (tty) process.stdout.write('\x1b[?25l');
  const restore = () => { if (tty) process.stdout.write('\x1b[?25h'); process.exit(0); };
  process.on('SIGINT', restore);
  await draw();
  setInterval(() => draw().catch(() => {}), every);
}
