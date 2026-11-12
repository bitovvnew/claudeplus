import * as K from '../skills.js';
import { c, table } from '../ui.js';

export async function run(args) {
  const sub = args._[1] || 'list';
  const id = args._[2];
  const opts = { scope: args.project ? 'project' : args.user ? 'user' : undefined };
  const need = () => { if (!id) throw new Error('Skill name required'); return id; };
  switch (sub) {
    case 'list': case 'ls': {
      const list = K.listSkills();
      if (!list.length) return console.log(c.gray('\n  No skills yet. Try: cplus skills library\n'));
      console.log(`\n  ${c.bold('Skills')}  ${c.gray('user: ~/.claude/skills · project: ./.claude/skills')}\n`);
      console.log(table(list, [
        { label: '', get: (s) => (s.enabled ? c.green('●') : c.gray('○')) },
        { label: 'name', get: (s) => (s.enabled ? c.bold(s.id) : c.gray(s.id)) },
        { label: 'scope', get: (s) => c.gray(s.scope) },
        { label: '~tok', get: (s) => s.estTokens, align: 'right' },
        { label: 'description', get: (s) => c.gray(s.description), max: 80 },
      ]));
      return console.log();
    }
    case 'library': case 'lib': {
      const lib = K.skillsLibrary();
      console.log(`\n  ${c.bold('Skill library')} ${c.gray(`— ${lib.length} skills · install: cplus skills add <name> | all`)}`);
      const groups = lib.reduce((m, s) => ((m[s.category] ||= []).push(s), m), {});
      for (const [cat, items] of Object.entries(groups)) {
        console.log(`\n  ${c.violet('◆ ' + cat)}`);
        console.log(table(items, [
          { label: '', get: (s) => (s.installed ? c.green('✓') : ' ') },
          { label: 'name', get: (s) => c.bold(s.id) },
          { label: 'description', get: (s) => c.gray(s.description), max: 96 },
        ]));
      }
      return console.log();
    }
    case 'add': case 'install': {
      const ids = args._.slice(2);
      const list = ids[0] === 'all' || args.all ? K.skillsLibrary().map((s) => s.id) : ids;
      if (!list.length) throw new Error('usage: cplus skills add <name...> | all');
      for (const x of list) {
        try { const s = K.installSkill(x, { scope: args.project ? 'project' : 'user', force: !!args.force }); console.log(c.green(`  ✓ ${s.id} → ${s.dir}`)); }
        catch (e) { console.log(c.yellow(`  · ${x}: ${e.message}`)); }
      }
      return;
    }
    case 'on': case 'enable': return console.log(c.green(`  ● ${K.setSkillEnabled(need(), true, opts).id} enabled`));
    case 'off': case 'disable': return console.log(c.gray(`  ○ ${K.setSkillEnabled(need(), false, opts).id} disabled`));
    case 'rm': case 'remove': return console.log(c.yellow(`  ✓ moved to trash: ${K.removeSkill(need(), opts).trashed}`));
    default: throw new Error(`Unknown skills subcommand "${sub}"`);
  }
}
