// Writes docs/AGENTS.md — the browsable catalog of the agent library and packs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.CLAUDEPLUS_HOME ||= path.join(ROOT, '.tmp-home');
const { libraryList, packsList } = await import('../src/agents.js');

const lib = libraryList();
const packs = packsList();
const badge = { haiku: '🟢 haiku', sonnet: '🔵 sonnet', opus: '🟠 opus', inherit: '⚪ inherit', fable: '🟣 fable' };
let md = `# Agent library\n\n${lib.length} ready-made Claude Code subagents in ${new Set(lib.map((a) => a.category)).size} categories, plus ${packs.length} packs.\n\n`;
md += 'Models are picked for cost: 🟢 **haiku** for reading, searching and mechanical work, 🔵 **sonnet** for everyday engineering, 🟠 **opus** for design and planning.\n\n';
md += '```bash\ncplus agents library            # browse\ncplus agents add scout           # one agent\ncplus agents pack cost-saver     # a whole pack\n```\n\n## Packs\n\n| Pack | Agents | What it is for |\n|---|---|---|\n';
for (const p of packs) md += `| \`${p.id}\` | ${p.agents.length} | ${p.description} |\n`;
let cat = null;
for (const a of lib) {
  if (a.category !== cat) { cat = a.category; md += `\n## ${cat}\n\n| Agent | Model | Tools | When Claude uses it |\n|---|---|---|---|\n`; }
  md += `| \`${a.id}\` | ${badge[a.model] || a.model} | ${a.tools || 'all'} | ${a.description.replace(/\|/g, '\\|')} |\n`;
}
fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'docs', 'AGENTS.md'), md);
fs.rmSync(path.join(ROOT, '.tmp-home'), { recursive: true, force: true });
console.log(`docs/AGENTS.md: ${lib.length} agents, ${packs.length} packs`);

const { skillsLibrary } = await import('../src/skills.js');
const skills = skillsLibrary();
let sk = `# Skill library\n\n${skills.length} Claude Code skills — playbooks Claude loads automatically when the task matches their description.\n\n`;
sk += '```bash\ncplus skills library          # browse\ncplus skills add token-diet    # install one (~/.claude/skills)\ncplus skills add all           # install everything\n```\n';
let scat = null;
for (const s of skills) {
  if (s.category !== scat) { scat = s.category; sk += `\n## ${scat}\n\n| Skill | When Claude uses it |\n|---|---|\n`; }
  sk += `| [\`${s.id}\`](../library/skills/${s.category}/${s.id}/SKILL.md) | ${s.description.replace(/\|/g, '\\|')} |\n`;
}
fs.writeFileSync(path.join(ROOT, 'docs', 'SKILLS.md'), sk);
console.log(`docs/SKILLS.md: ${skills.length} skills`);
