#!/usr/bin/env node
// ClaudePlus CLI entry point.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { c, logo } from '../src/ui.js';

const PKG = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json'), 'utf8'));

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      const key = k.replace(/-([a-z])/g, (_, x) => x.toUpperCase());
      if (v !== undefined) out[key] = v;
      else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('-')) out[key] = argv[++i];
      else out[key] = true;
    } else if (a.startsWith('-') && a.length === 2) {
      const map = { d: 'days', p: 'project', s: 'since', n: 'limit', h: 'help', v: 'version' };
      const key = map[a[1]] || a[1];
      if (key === 'help' || key === 'version') out[key] = true;
      else out[key] = argv[++i];
    } else out._.push(a);
  }
  return out;
}

const HELP = `
${logo()}  ${c.gray('v' + PKG.version)}

${c.bold('Usage')}  cplus <command> [options]

${c.bold('Spend & analytics')}
  ${c.cyan('cplus')}                         overview: today, month, burn rate, models, projects, top sessions
  ${c.cyan('cplus watch')}                   live terminal monitor (burn rate, 5h block, active sessions)
  ${c.cyan('cplus blocks')}                  5-hour usage blocks (the windows subscription limits use)
  ${c.cyan('cplus daily')}                   spend per day
  ${c.cyan('cplus sessions')}                sessions by cost   (--sort recent, -n 50)
  ${c.cyan('cplus session <id|latest>')}     one session in detail
  ${c.cyan('cplus tools')}                   what every tool cost you
  ${c.cyan('cplus models')} | ${c.cyan('projects')}      breakdowns
  ${c.cyan('cplus waste')}                   leak report: where tokens were burned for nothing
  ${c.cyan('cplus dash')}                    local web dashboard (http://127.0.0.1:4317)
  ${c.cyan('cplus demo')} [command]          try everything on synthetic data (no account needed)
  ${c.cyan('cplus export')}                  CSV / JSON (--out file.csv | --json)
    filters: -d 7 | --since 2026-11-01 | --since month | --until 2026-11-10 | -p <project>

${c.bold('Claude Code integration')}
  ${c.cyan('cplus install')}                 statusline + guard hook (settings.json is backed up first)
      --statusline | --guard              install only one part
  ${c.cyan('cplus uninstall')}               remove everything ClaudePlus added
  ${c.cyan('cplus statusline --preview')}    see all statusline themes
  ${c.cyan('cplus doctor')}                  check setup

${c.bold('Agents')}  ${c.gray('(62 in the library, 10 packs)')}
  ${c.cyan('cplus agents')}                  list user + project agents (on/off, model, tools)
  ${c.cyan('cplus agents on|off <name>')}    enable / disable       (--project for ./.claude/agents)
  ${c.cyan('cplus agents library')}          browse the library      (--category frontend)
  ${c.cyan('cplus agents packs')}            curated sets: essentials, cost-saver, frontend, backend…
  ${c.cyan('cplus agents pack <id>')}        install a whole pack
  ${c.cyan('cplus agents add <name>')}       install one agent from the library
  ${c.cyan('cplus agents model <name> <m>')} switch model (haiku|sonnet|opus|inherit)
  ${c.cyan('cplus agents new <name>')}       scaffold a new agent   (--model haiku --tools "Read,Grep")
  ${c.cyan('cplus agents show|edit|rm <name>')}

${c.bold('Settings')}
  ${c.cyan('cplus budget --daily 20 --monthly 300')} [--stop on]
  ${c.cyan('cplus lang <code>')}             UI language: en ru uk es pt fr de it pl tr zh ja ko hi id vi
  ${c.cyan('cplus config [key] [value]')}    e.g. cplus config statusline.theme capsule
  ${c.cyan('cplus prices')}                  price table used for estimates
`;

async function runDemo(args, rest) {
  const home = path.join(process.env.CLAUDEPLUS_DEMO_DIR || path.join(os.homedir(), '.claudeplus', 'demo'));
  process.env.CLAUDE_CONFIG_DIR = path.join(home, 'claude');
  process.env.CLAUDEPLUS_HOME = path.join(home, 'home');
  const stamp = path.join(home, 'generated.json');
  let fresh = false;
  try { fresh = Date.now() - JSON.parse(fs.readFileSync(stamp, 'utf8')).at < 6 * 36e5 && !args.regen; } catch {}
  if (!fresh) {
    const { generateDemo } = await import('../src/demo.js');
    const r = generateDemo(process.env.CLAUDE_CONFIG_DIR, { scale: +(args.scale || 1), seed: +(args.seed || 42) });
    const { seedDemoExtras } = await import('../src/demo-extras.js');
    seedDemoExtras();
    fs.mkdirSync(home, { recursive: true });
    fs.writeFileSync(stamp, JSON.stringify({ at: Date.now(), ...r }));
    console.error(c.gray(`  demo: ${r.sessions} synthetic sessions, ${r.calls} API calls, ${(r.bytes / 1e6).toFixed(1)} MB → ${home}`));
  }
  process.env.CPLUS_DEMO = '1';
  return main(rest.length ? rest : ['dash']);
}

async function main(argv) {
  const args = parseArgs(argv);
  const cmd = args._[0] || 'overview';
  if (args.version || cmd === 'version') return console.log(PKG.version);
  if (args.help || cmd === 'help') return console.log(HELP);
  if (cmd === 'demo') return runDemo(args, argv.slice(argv.indexOf('demo') + 1));

  const R = () => import('../src/commands/report.js');
  const L = () => import('../src/commands/live.js');
  switch (cmd) {
    case 'overview': case 'stats': return (await R()).overview(args);
    case 'today': return (await R()).overview({ ...args, since: 'today' });
    case 'daily': case 'days': return (await R()).daily(args);
    case 'sessions': return (await R()).sessions(args);
    case 'session': return (await R()).session(args);
    case 'tools': return (await R()).tools(args);
    case 'models': return (await R()).models(args);
    case 'projects': return (await R()).projects(args);
    case 'waste': case 'leaks': return (await R()).waste(args);
    case 'export': return (await R()).exportData(args);
    case 'watch': case 'live': case 'top': return (await L()).watch(args);
    case 'blocks': return (await L()).blocks(args);
    case 'dash': case 'dashboard': case 'ui': return (await import('../src/server.js')).serve(args);
    case 'statusline': return (await import('../src/statusline.js')).run(args);
    case 'guard': return (await import('../src/guard.js')).run(args);
    case 'install': return (await import('../src/installer.js')).install(args);
    case 'uninstall': return (await import('../src/installer.js')).uninstall(args);
    case 'doctor': return (await import('../src/installer.js')).doctor(args);
    case 'agents': case 'agent': return (await import('../src/commands/agents.js')).run(args);
    case 'budget': return (await import('../src/commands/settings.js')).budget(args);
    case 'config': return (await import('../src/commands/settings.js')).config(args);
    case 'lang': case 'language': return (await import('../src/commands/settings.js')).lang(args);
    case 'prices': return (await import('../src/commands/settings.js')).prices(args);
    default:
      console.log(c.red(`  Unknown command: ${cmd}`));
      console.log(HELP);
      process.exitCode = 1;
  }
}

main(process.argv.slice(2)).catch((e) => {
  console.error(c.red('  ✗ ' + (e?.message || e)));
  if (process.env.CPLUS_DEBUG) console.error(e);
  process.exitCode = 1;
});
