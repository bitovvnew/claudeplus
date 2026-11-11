// Terminal reports: overview, sessions, tools, models, projects, waste, export.
import fs from 'node:fs';
import { scan } from '../scanner.js';
import { buildReport, parseSince, dayKey } from '../analytics.js';
import { analyzeWaste } from '../waste.js';
import { loadConfig } from '../config.js';
import { shortModel } from '../pricing.js';
import { c, usd, num, bar, spark, table, box, logo, progress, ago } from '../ui.js';
import { detectLang, t } from '../i18n.js';

export async function load(args) {
  for (const k of ['since', 'until', 'days', 'project']) if (args[k] === true || args[k] === '') delete args[k];
  const res = await scan({ onProgress: (d, t, f) => progress(d, t, f) });
  const filter = {
    since: parseSince(args.since || (args.days ? `${args.days}d` : args.defaultSince)),
    until: args.until ? parseSince(args.until) + 864e5 - 1 : undefined,
    project: args.project,
    session: args.session,
  };
  return { files: res.files, filter, report: buildReport(res.files, filter) };
}

const rangeLabel = (since) => (since ? `since ${dayKey(since)}` : 'all time');

export async function overview(args) {
  const { files, report: r, filter } = await load({ defaultSince: '30d', ...args });
  const cfg = loadConfig();
  const today = buildReport(files, { since: parseSince('today') });
  const month = buildReport(files, { since: parseSince('month') });
  const t = r.totals;

  console.log('\n' + logo() + '\n');
  const budgetLine = (spent, limit, name) => {
    if (!limit) return '';
    const pct = spent / limit;
    const col = pct >= 1 ? c.red : pct >= 0.8 ? c.yellow : c.green;
    return `  ${c.gray(name + ' budget')} ${bar(Math.min(spent, limit), limit, 20, col)} ${col(Math.round(pct * 100) + '%')} ${c.gray('of ' + usd(limit))}`;
  };
  const head = [
    `${c.gray('Today')}  ${c.bold(c.white(usd(today.totals.cost)))}   ${c.gray('This month')}  ${c.bold(usd(month.totals.cost))}   ${c.gray(rangeLabel(filter.since))}  ${c.bold(usd(t.cost))}`,
    `${c.gray('Calls')} ${num(t.msgs)}   ${c.gray('Sessions')} ${t.sessions}   ${c.gray('Prompts')} ${num(t.prompts)}   ${c.gray('Avg/prompt')} ${usd(t.prompts ? t.cost / t.prompts : 0)}`,
    `${c.gray('Tokens')}  in ${num(t.in)} · out ${num(t.out)} · cache write ${num(t.cw)} · cache read ${num(t.cr)}`,
  ];
  if (today.activeBlock || today.burnRate) {
    const ab = today.activeBlock;
    head.push(`${c.gray('Burn rate')} ${c.orange(usd(today.burnRate) + '/h')}${ab ? `   ${c.gray('5h block')} ${usd(ab.cost)} ${c.gray('→ projected')} ${usd(ab.projected)} ${c.gray('· ' + Math.round(ab.left / 60_000) + ' min left')}` : ''}`);
  }
  const b1 = budgetLine(today.totals.cost, cfg.budget.daily, 'Daily');
  const b2 = budgetLine(month.totals.cost, cfg.budget.monthly, 'Monthly');
  console.log(box('Spend', [...head, b1, b2].filter(Boolean).join('\n')));

  const days = r.days.slice(-30);
  console.log(`\n  ${c.bold('Daily spend')} ${c.gray('(last ' + days.length + ' days)')}  ${spark(days.map((d) => d.cost))}  ${c.gray('max')} ${usd(Math.max(...days.map((d) => d.cost), 0))}`);

  const s = r.split;
  const parts = [['Cache read', s.cacheRead, c.teal], ['Cache write', s.cacheWrite, c.violet], ['Output', s.output, c.orange], ['Input', s.input, c.blue], ['Web', s.web, c.yellow]];
  console.log(`\n  ${c.bold('Where the money goes')}`);
  for (const [n, v, col] of parts) if (v > 0.0001) console.log(`  ${n.padEnd(12)} ${bar(v, t.cost, 30, col)} ${usd(v).padStart(8)} ${c.gray(Math.round((v / t.cost) * 100) + '%')}`);

  console.log(`\n  ${c.bold('Models')}`);
  const mmax = r.models[0]?.cost || 0;
  console.log(table(r.models.slice(0, 8), [
    { label: 'model', get: (m) => m.label + (m.estimated ? c.yellow(' ~') : '') },
    { label: 'cost', get: (m) => usd(m.cost), align: 'right' },
    { label: '', get: (m) => bar(m.cost, mmax, 22) },
    { label: 'calls', get: (m) => num(m.msgs), align: 'right' },
    { label: 'out', get: (m) => num(m.out), align: 'right' },
  ]));

  console.log(`\n  ${c.bold('Projects')}`);
  const pmax = r.projects[0]?.cost || 0;
  console.log(table(r.projects.slice(0, 8), [
    { label: 'project', get: (p) => p.project, max: 28 },
    { label: 'cost', get: (p) => usd(p.cost), align: 'right' },
    { label: '', get: (p) => bar(p.cost, pmax, 22, c.teal) },
    { label: 'sessions', get: (p) => p.sessions, align: 'right' },
    { label: 'last', get: (p) => c.gray(ago(p.lastTs)) },
  ]));

  console.log(`\n  ${c.bold('Top sessions')}`);
  printSessions([...r.sessions].sort((a, b) => b.cost - a.cost).slice(0, 6));

  const w = analyzeWaste(files, filter);
  if (w.findings.some((f) => f.savings > 0.01)) {
    console.log(`\n  ${c.bold('Leaks')} ${c.gray('— could have saved ~')}${c.yellow(usd(w.savings))} ${c.gray('(' + Math.round(w.pct * 100) + '%). Details: ')}${c.cyan('cplus waste')}`);
  }
  if (r.estimatedModels.length) console.log(c.yellow(`\n  ~ unknown model ids priced by family: ${r.estimatedModels.join(', ')}`));
  console.log(c.gray(`\n  Dashboard: ${c.cyan('cplus dash')}   Sessions: ${c.cyan('cplus sessions')}   Tools: ${c.cyan('cplus tools')}\n`));
}

function printSessions(list) {
  const max = Math.max(...list.map((s) => s.cost), 0);
  console.log(table(list, [
    { label: 'id', get: (s) => c.gray(String(s.sid).slice(0, 8)) },
    { label: 'title', get: (s) => s.title, max: 44 },
    { label: 'project', get: (s) => s.project, max: 18 },
    { label: 'cost', get: (s) => usd(s.cost), align: 'right' },
    { label: '', get: (s) => bar(s.cost, max, 14, c.orange) },
    { label: 'prompts', get: (s) => s.prompts, align: 'right' },
    { label: '$/prompt', get: (s) => (s.costPerPrompt != null ? usd(s.costPerPrompt) : '—'), align: 'right' },
    { label: 'peak ctx', get: (s) => num(s.maxCtx), align: 'right' },
    { label: 'last', get: (s) => c.gray(ago(s.lastTs)) },
  ]));
}

export async function sessions(args) {
  const { report: r } = await load({ defaultSince: '30d', ...args });
  const list = args.sort === 'recent' ? r.sessions : [...r.sessions].sort((a, b) => b.cost - a.cost);
  console.log(`\n  ${c.bold('Sessions')} ${c.gray(rangeLabel(r.range.since) + ' · ' + r.sessions.length + ' total')}\n`);
  printSessions(list.slice(0, +args.limit || 25));
  console.log(c.gray(`\n  Details: cplus session <id>\n`));
}

export async function session(args) {
  let id = args._[1];
  if (!id) throw new Error('usage: cplus session <id-prefix|latest>');
  if (id === 'latest') {
    const { report: all } = await load({ since: '7d' });
    const here = process.cwd().toLowerCase();
    const s = all.sessions.find((x) => x.cwd && x.cwd.toLowerCase() === here) || all.sessions[0];
    if (!s) return console.log(c.red('  No recent sessions'));
    id = s.sid;
  }
  const { files, report: r } = await load({ since: 'all', session: id });
  const s = r.sessions[0];
  if (!s) return console.log(c.red(`  No session matching ${id}`));
  console.log('\n' + box(s.title.slice(0, 70), [
    `${c.gray('id')} ${s.sid}   ${c.gray('project')} ${s.project}   ${c.gray('branch')} ${s.branch || '—'}`,
    `${c.gray('cost')} ${c.bold(usd(s.cost))}   ${c.gray('calls')} ${s.msgs}   ${c.gray('prompts')} ${s.prompts}   ${c.gray('$/prompt')} ${s.costPerPrompt != null ? usd(s.costPerPrompt) : '—'}`,
    `${c.gray('subagents')} ${usd(s.sideCost)}   ${c.gray('peak context')} ${num(s.maxCtx)}   ${c.gray('span')} ${new Date(s.firstTs).toLocaleString()} → ${new Date(s.lastTs).toLocaleString()}`,
    `${c.gray('models')} ${Object.entries(s.models).map(([m, v]) => `${shortModel(m)} ${usd(v)}`).join(' · ')}`,
  ].join('\n')));
  console.log(`\n  ${c.bold('Tools')}`);
  const tl = r.tools.filter((t) => t.calls);
  const tmax = tl[0]?.cost || 0;
  console.log(table(tl.slice(0, 15), [
    { label: 'tool', get: (t) => t.tool, max: 40 },
    { label: 'calls', get: (t) => t.calls, align: 'right' },
    { label: 'cost', get: (t) => usd(t.cost), align: 'right' },
    { label: '', get: (t) => bar(t.cost, tmax, 18) },
    { label: 'output→ctx', get: (t) => num(t.resultTokens), align: 'right' },
  ]));
  const w = analyzeWaste(files.filter((f) => (f.meta?.sid || '').startsWith(id)));
  const leaks = w.findings.filter((f) => f.savings > 0.001);
  if (leaks.length) {
    console.log(`\n  ${c.bold('Leaks in this session')}`);
    const lang = detectLang(loadConfig().lang);
    for (const f of leaks) console.log(`  ${c.yellow('●')} ${t(lang, `leak.${f.id}.title`, f.params)} ${c.gray('~')}${c.yellow(usd(f.savings))}`);
  }
  console.log();
}

export async function tools(args) {
  const { report: r } = await load({ defaultSince: '30d', ...args });
  const list = r.tools;
  const max = list[0]?.cost || 0;
  console.log(`\n  ${c.bold('Cost by tool')} ${c.gray('— cost of the API calls that invoked each tool (split evenly) · ' + rangeLabel(r.range.since))}\n`);
  console.log(table(list.slice(0, +args.limit || 30), [
    { label: 'tool', get: (t) => t.tool, max: 46 },
    { label: 'calls', get: (t) => num(t.calls), align: 'right' },
    { label: 'cost', get: (t) => usd(t.cost), align: 'right' },
    { label: '', get: (t) => bar(t.cost, max, 24) },
    { label: '$/call', get: (t) => usd(t.calls ? t.cost / t.calls : 0), align: 'right' },
    { label: 'output→ctx', get: (t) => num(t.resultTokens), align: 'right' },
  ]));
  if (r.agents.length) {
    console.log(`\n  ${c.bold('Subagents spawned')}  ${c.gray('total subagent spend')} ${usd(r.totals.sideCost)}`);
    console.log(table(r.agents.slice(0, 12), [{ label: 'agent', get: (a) => a.type }, { label: 'spawned', get: (a) => a.spawned, align: 'right' }]));
  }
  console.log();
}

export async function models(args) {
  const { report: r } = await load({ defaultSince: '30d', ...args });
  console.log(`\n  ${c.bold('Models')} ${c.gray(rangeLabel(r.range.since))}\n`);
  const max = r.models[0]?.cost || 0;
  console.log(table(r.models, [
    { label: 'model', get: (m) => m.label },
    { label: 'id', get: (m) => c.gray(m.model) },
    { label: 'cost', get: (m) => usd(m.cost), align: 'right' },
    { label: '', get: (m) => bar(m.cost, max, 20) },
    { label: 'calls', get: (m) => num(m.msgs), align: 'right' },
    { label: 'input', get: (m) => num(m.in), align: 'right' },
    { label: 'output', get: (m) => num(m.out), align: 'right' },
    { label: 'cache w', get: (m) => num(m.cw), align: 'right' },
    { label: 'cache r', get: (m) => num(m.cr), align: 'right' },
  ]));
  console.log();
}

export async function projects(args) {
  const { report: r } = await load({ defaultSince: '30d', ...args });
  console.log(`\n  ${c.bold('Projects')} ${c.gray(rangeLabel(r.range.since))}\n`);
  const max = r.projects[0]?.cost || 0;
  console.log(table(r.projects, [
    { label: 'project', get: (p) => p.project, max: 30 },
    { label: 'cost', get: (p) => usd(p.cost), align: 'right' },
    { label: '', get: (p) => bar(p.cost, max, 24, c.teal) },
    { label: 'sessions', get: (p) => p.sessions, align: 'right' },
    { label: 'calls', get: (p) => num(p.msgs), align: 'right' },
    { label: 'last', get: (p) => c.gray(ago(p.lastTs)) },
    { label: 'path', get: (p) => c.gray(p.path), max: 40 },
  ]));
  console.log();
}

export async function daily(args) {
  const { report: r } = await load({ defaultSince: '30d', ...args });
  const max = Math.max(...r.days.map((d) => d.cost), 0);
  console.log(`\n  ${c.bold('Daily')}\n`);
  for (const d of r.days) {
    const wd = new Date(d.day + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
    console.log(`  ${c.gray(d.day)} ${c.gray(wd)} ${usd(d.cost).padStart(8)} ${bar(d.cost, max, 40)} ${c.gray(d.msgs ? num(d.msgs) + ' calls' : '')}`);
  }
  console.log();
}

export async function waste(args) {
  const { files, filter } = await load({ defaultSince: '30d', ...args });
  const w = analyzeWaste(files, filter);
  const sevColor = { high: c.red, medium: c.yellow, low: c.cyan, info: c.gray };
  console.log('\n' + box('Leak report', [
    `${c.gray('Spend analysed')} ${c.bold(usd(w.total))}   ${c.gray('avoidable (est.)')} ${c.yellow(c.bold(usd(w.savings)))} ${c.gray('(' + Math.round(w.pct * 100) + '%)')}`,
    `${c.gray('Efficiency score')} ${(w.score >= 80 ? c.green : w.score >= 60 ? c.yellow : c.red)(c.bold(w.score + '/100'))}`,
  ].join('\n')));
  const lang = detectLang(loadConfig().lang);
  for (const f of w.findings) {
    const col = sevColor[f.severity] || c.gray;
    console.log(`\n  ${col('●')} ${c.bold(t(lang, `leak.${f.id}.title`, f.params))}  ${f.savings ? c.yellow('~' + usd(f.savings)) : ''}`);
    console.log(`    ${t(lang, `leak.${f.id}.detail`, f.params)}`);
    console.log(`    ${c.green('→')} ${t(lang, `leak.${f.id}.advice`, f.params)}`);
    for (const e of (f.examples || []).slice(0, +args.examples || 4)) {
      console.log(c.gray(`      · ${String(e.what || '').slice(0, 90)}${e.times ? ` ×${e.times}` : ''}${e.cost ? '  ' + usd(e.cost) : ''}${e.session ? '  [' + String(e.session).slice(0, 30) + ']' : ''}`));
    }
  }
  console.log();
}

export async function exportData(args) {
  const { files, filter } = await load({ defaultSince: 'all', ...args });
  const r = buildReport(files, filter);
  const out = args.out || (args.json ? 'claudeplus-export.json' : 'claudeplus-sessions.csv');
  if (args.json || out.endsWith('.json')) fs.writeFileSync(out, JSON.stringify(r, null, 2));
  else {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [['session', 'title', 'project', 'cost_usd', 'calls', 'prompts', 'subagent_cost', 'peak_context', 'first', 'last', 'models']];
    for (const s of r.sessions) rows.push([s.sid, s.title, s.project, s.cost.toFixed(4), s.msgs, s.prompts, s.sideCost.toFixed(4), s.maxCtx, new Date(s.firstTs).toISOString(), new Date(s.lastTs).toISOString(), Object.keys(s.models).join(' ')]);
    fs.writeFileSync(out, '﻿' + rows.map((r) => r.map(esc).join(',')).join('\n'));
  }
  console.log(c.green(`  ✓ exported → ${out}`));
}
