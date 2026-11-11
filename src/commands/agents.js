import { spawnSync } from 'node:child_process';
import * as A from '../agents.js';
import { c, table } from '../ui.js';

const modelColor = (m) => (/opus|fable/.test(m) ? c.orange(m) : /sonnet/.test(m) ? c.blue(m) : /haiku/.test(m) ? c.green(m) : c.gray(m));

export async function run(args) {
  const sub = args._[1] || 'list';
  const id = args._[2];
  const opts = { scope: args.project ? 'project' : args.user ? 'user' : undefined };

  switch (sub) {
    case 'list': case 'ls': {
      const list = A.listAgents();
      if (!list.length) {
        console.log(c.gray('\n  No agents yet. Try: cplus agents library\n'));
        return;
      }
      console.log(`\n  ${c.bold('Agents')}  ${c.gray('user: ~/.claude/agents · project: ./.claude/agents')}\n`);
      console.log(table(list, [
        { label: '', get: (a) => (a.enabled ? c.green('●') : c.gray('○')) },
        { label: 'name', get: (a) => (a.enabled ? c.bold(a.id) : c.gray(a.id)) },
        { label: 'scope', get: (a) => c.gray(a.scope) },
        { label: 'model', get: (a) => modelColor(a.model) },
        { label: 'tools', get: (a) => (a.tools.length ? a.tools.join(',') : c.gray('all')), max: 34 },
        { label: '~tok', get: (a) => a.estTokens, align: 'right' },
        { label: 'description', get: (a) => c.gray(a.description), max: 60 },
      ]));
      console.log(c.gray('\n  cplus agents on|off|show|model|rm <name>   ·   cplus agents library\n'));
      return;
    }
    case 'on': case 'enable': {
      const a = A.setEnabled(need(id), true, opts);
      return console.log(c.green(`  ● ${a.id} enabled (${a.scope})`));
    }
    case 'off': case 'disable': {
      const a = A.setEnabled(need(id), false, opts);
      return console.log(c.gray(`  ○ ${a.id} disabled — moved to ${a.file}`));
    }
    case 'toggle': {
      const cur = A.findAgent(need(id), opts);
      const a = A.setEnabled(id, !cur.enabled, opts);
      return console.log(a.enabled ? c.green(`  ● ${a.id} enabled`) : c.gray(`  ○ ${a.id} disabled`));
    }
    case 'show': case 'cat': {
      const a = A.readAgentText(need(id), opts);
      console.log(c.gray(`  ${a.file}\n`));
      return console.log(a.content);
    }
    case 'model': {
      const model = args._[3];
      if (!model) throw new Error(`usage: cplus agents model <name> <${A.MODELS.join('|')}>`);
      const a = A.setModel(need(id), model, opts);
      return console.log(c.green(`  ✓ ${a.id} → model ${modelColor(a.model)}`));
    }
    case 'rm': case 'remove': case 'delete': {
      const a = A.removeAgent(need(id), opts);
      return console.log(c.yellow(`  ✓ ${a.id} moved to trash: ${a.trashed}`));
    }
    case 'edit': {
      const a = A.findAgent(need(id), opts);
      const editor = process.env.VISUAL || process.env.EDITOR || (process.platform === 'win32' ? 'notepad' : 'vi');
      spawnSync(editor, [a.file], { stdio: 'inherit', shell: process.platform === 'win32' });
      return;
    }
    case 'new': case 'create': {
      A.assertName(need(id));
      const content = A.newAgentTemplate({ name: id, description: args.description, model: args.model || 'sonnet', tools: args.tools || '' });
      const a = A.saveAgent({ id, scope: args.project ? 'project' : 'user', content });
      console.log(c.green(`  ✓ created ${a.file}`));
      return console.log(c.gray(`    edit it: cplus agents edit ${id}  (or in the dashboard: cplus dash)`));
    }
    case 'library': case 'lib': {
      let lib = A.libraryList();
      if (args.category) lib = lib.filter((a) => a.category === args.category);
      console.log(`\n  ${c.bold('Agent library')} ${c.gray(`— ${lib.length} agents · install: cplus agents add <name> · packs: cplus agents packs`)}`);
      let cat = null;
      for (const group of Object.entries(Object.groupBy ? Object.groupBy(lib, (a) => a.category) : lib.reduce((m, a) => ((m[a.category] ||= []).push(a), m), {}))) {
        [cat] = group;
        console.log(`\n  ${c.violet('◆ ' + cat)}`);
        console.log(table(group[1], [
          { label: '', get: (a) => (a.installed ? c.green('✓') : ' ') },
          { label: 'name', get: (a) => c.bold(a.id) },
          { label: 'model', get: (a) => modelColor(a.model) },
          { label: 'description', get: (a) => c.gray(a.description), max: 86 },
        ]));
      }
      return console.log();
    }
    case 'packs': {
      const packs = A.packsList();
      console.log(`\n  ${c.bold('Agent packs')} ${c.gray('— install a whole set: cplus agents pack <id> [--project]')}\n`);
      console.log(table(packs, [
        { label: 'id', get: (p) => c.bold(p.id) },
        { label: 'agents', get: (p) => `${p.installedCount}/${p.agents.length}`, align: 'right' },
        { label: 'description', get: (p) => c.gray(p.description), max: 90 },
      ]));
      return console.log();
    }
    case 'pack': case 'add-pack': {
      const r = A.installPack(need(id), { scope: args.project ? 'project' : 'user' });
      console.log(c.green(`  ✓ pack ${r.pack}: ${r.installed.length} installed`) + (r.skipped.length ? c.gray(` · ${r.skipped.length} already present: ${r.skipped.join(', ')}`) : ''));
      return;
    }
    case 'add': case 'install': {
      const ids = args._.slice(2);
      if (!ids.length) throw new Error('usage: cplus agents add <name...> | --all');
      const list = ids[0] === 'all' || args.all ? A.libraryList().map((x) => x.id) : ids;
      for (const x of list) {
        try {
          const a = A.installFromLibrary(x, { scope: args.project ? 'project' : 'user', force: !!args.force });
          console.log(c.green(`  ✓ ${a.id} → ${a.file}`));
        } catch (e) { console.log(c.yellow(`  · ${x}: ${e.message}`)); }
      }
      return;
    }
    default:
      throw new Error(`Unknown agents subcommand "${sub}"`);
  }
}

function need(id) {
  if (!id) throw new Error('Agent name required');
  return id;
}
