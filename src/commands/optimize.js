// `cplus optimize` — turns the leak report into concrete, one-command fixes.
//   cplus optimize            show the plan
//   cplus optimize --apply    apply every safe fix (settings.json is backed up first)
import { scan } from '../scanner.js';
import { buildReport, parseSince } from '../analytics.js';
import { analyzeWaste } from '../waste.js';
import { loadConfig, saveConfig } from '../config.js';
import { status, install } from '../installer.js';
import { listAgents, packsList, installPack, setModel } from '../agents.js';
import { c, usd, box } from '../ui.js';

const READ_ONLY = new Set(['Read', 'Grep', 'Glob', 'WebSearch', 'WebFetch']);

export async function plan() {
  const { files } = await scan();
  const since = parseSince('30d');
  const r = buildReport(files, { since });
  const w = analyzeWaste(files, { since });
  const leak = (id) => w.findings.find((f) => f.id === id);
  const st = status();
  const cfg = loadConfig();
  const actions = [];

  const dup = leak('duplicate-reads'), big = leak('big-outputs');
  if (!st.guard) actions.push({
    id: 'guard', title: 'Install Guard (blocks repeated reads, huge reads and noisy commands)',
    savings: (dup?.savings || 0) + (big?.savings || 0) * 0.5, cmd: 'cplus install --guard',
    apply: () => install({ guard: true, quiet: true }),
  });
  if (!st.statusline) actions.push({
    id: 'statusline', title: 'Install the statusline (see context fill and cost live, /compact on time)',
    savings: (leak('heavy-context')?.savings || 0) * 0.3, cmd: 'cplus install --statusline',
    apply: () => install({ statusline: true, quiet: true }),
  });

  // Read-only agents running on premium models → haiku
  // Agents whose job is judgment (planning, architecture, design, security) keep their strong model.
  const THINKERS = /plan|architect|design|critic|auth|security|incident|spec|migration|prompt|api-/;
  const premium = listAgents().filter((a) => a.enabled && /opus|fable|inherit/.test(a.model) && !THINKERS.test(a.id) && a.tools.length && a.tools.every((t) => READ_ONLY.has(t)));
  const subLeak = leak('premium-subagents');
  if (premium.length) actions.push({
    id: 'agent-models', title: `Move ${premium.length} read-only agent(s) to Haiku: ${premium.map((a) => a.id).join(', ')}`,
    savings: subLeak?.savings || 0, cmd: premium.map((a) => `cplus agents model ${a.id} haiku --${a.scope}`).join(' && '),
    apply: () => premium.forEach((a) => setModel(a.id, 'haiku', { scope: a.scope })),
  });

  const cs = packsList().find((p) => p.id === 'cost-saver');
  if (cs && cs.installedCount < cs.agents.length) actions.push({
    id: 'cost-saver', title: 'Install the Cost Saver pack (Haiku agents for research, bulk edits, logs, handoffs)',
    savings: (subLeak?.savings || 0) * 0.5 + (leak('cache-rebuild')?.savings || 0) * 0.2, cmd: 'cplus agents pack cost-saver',
    apply: () => installPack('cost-saver'),
  });

  if (!cfg.budget.daily && r.days.length) {
    const vals = r.days.map((d) => d.cost).filter((v) => v > 0).sort((a, b) => a - b);
    const p90 = vals[Math.floor(vals.length * 0.9)] || vals.at(-1) || 0;
    const daily = Math.max(5, Math.ceil((p90 * 1.2) / 5) * 5);
    actions.push({
      id: 'budget', title: `Set a daily budget of ${usd(daily)} (≈ your 90th-percentile day + 20%) so the statusline warns you`,
      savings: 0, cmd: `cplus budget --daily ${daily}`,
      apply: () => { const k = loadConfig(); k.budget.daily = daily; saveConfig(k); },
    });
  }

  const habits = [];
  if (leak('cache-rebuild')) habits.push(`Before breaks: /compact or /claudeplus:handoff + /clear  (~${usd(leak('cache-rebuild').savings)} re-cached after idle gaps)`);
  if (leak('heavy-context')) habits.push(`Compact around 150k tokens; one task per session  (~${usd(leak('heavy-context').savings)} on oversized contexts)`);

  return { total: w.total, savings: w.savings, actions: actions.sort((a, b) => b.savings - a.savings), habits };
}

export async function run(args) {
  const p = await plan();
  console.log('\n' + box('Optimization plan · last 30 days', [
    `${c.gray('Spend')} ${c.bold(usd(p.total))}   ${c.gray('leaking (est.)')} ${c.yellow(usd(p.savings))}`,
  ].join('\n')));
  if (!p.actions.length) console.log(c.green('\n  ✓ Everything that can be automated is already set up.'));
  p.actions.forEach((a, i) => {
    console.log(`\n  ${c.bold(`${i + 1}.`)} ${a.title}${a.savings > 0.01 ? c.yellow(`  ~${usd(a.savings)}/mo`) : ''}`);
    console.log(c.gray(`     $ ${a.cmd}`));
  });
  if (p.habits.length) {
    console.log(`\n  ${c.bold('Habits')} ${c.gray('(not automatable)')}`);
    for (const h of p.habits) console.log(`  ${c.green('→')} ${h}`);
  }
  if (!p.actions.length) return console.log();
  if (!args.apply) return console.log(c.gray(`\n  Apply all: ${c.cyan('cplus optimize --apply')}  (settings.json is backed up first)\n`));
  console.log();
  for (const a of p.actions) {
    try { await a.apply(); console.log(c.green(`  ✓ ${a.title}`)); }
    catch (e) { process.exitCode = 1; console.log(c.red(`  ✗ ${a.title}: ${e.message}`)); }
  }
  console.log(c.gray('\n  Open a new Claude Code session to pick up hook/statusline changes.\n'));
}
