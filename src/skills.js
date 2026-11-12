// Skill manager: Claude Code skills are folders with a SKILL.md, in ~/.claude/skills (user)
// and <project>/.claude/skills (project). Disabling moves the folder to a sibling "skills.disabled".
import fs from 'node:fs';
import path from 'node:path';
import { CLAUDE_DIR, ROOT, ensureDir, moveToTrash } from './paths.js';
import { parseFrontmatter, assertName } from './agents.js';

export const SKILLS_LIBRARY = path.join(ROOT, 'library', 'skills');
const userDir = () => path.join(CLAUDE_DIR, 'skills');
const projectDir = (cwd = process.cwd()) => path.join(cwd, '.claude', 'skills');
const disabledOf = (dir) => path.join(path.dirname(dir), 'skills.disabled');

function scopes(cwd) {
  const list = [{ scope: 'user', dir: userDir() }];
  if (path.resolve(projectDir(cwd)) !== path.resolve(userDir())) list.push({ scope: 'project', dir: projectDir(cwd) });
  return list;
}

function readSkill(dir, scope, enabled) {
  const file = path.join(dir, 'SKILL.md');
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch { return null; }
  const { data } = parseFrontmatter(text);
  return { id: path.basename(dir), name: data.name || path.basename(dir), description: data.description || '', scope, enabled, dir, estTokens: Math.round(text.length / 4) };
}

function listIn(dir, scope, enabled) {
  let names = [];
  try { names = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { return []; }
  return names.map((n) => readSkill(path.join(dir, n), scope, enabled)).filter(Boolean);
}

export function listSkills(cwd) {
  const out = [];
  for (const s of scopes(cwd)) out.push(...listIn(s.dir, s.scope, true), ...listIn(disabledOf(s.dir), s.scope, false));
  return out.sort((a, b) => a.scope.localeCompare(b.scope) || a.id.localeCompare(b.id));
}

export function findSkill(id, { scope, cwd } = {}) {
  assertName(id);
  const hit = listSkills(cwd).filter((s) => s.id === id && (!scope || s.scope === scope));
  if (!hit.length) throw new Error(`Skill "${id}" not found`);
  return hit.find((s) => s.scope === 'project') || hit[0];
}

export function setSkillEnabled(id, enabled, opts = {}) {
  const s = findSkill(id, opts);
  if (s.enabled === enabled) return s;
  const base = scopes(opts.cwd).find((x) => x.scope === s.scope).dir;
  const target = path.join(ensureDir(enabled ? base : disabledOf(base)), s.id);
  if (fs.existsSync(target)) throw new Error(`${target} already exists`);
  fs.renameSync(s.dir, target);
  return { ...s, enabled, dir: target };
}

export function removeSkill(id, opts = {}) {
  const s = findSkill(id, opts);
  const dest = moveToTrash(s.dir, `skill-${s.scope}-${s.id}-${Date.now()}`);
  return { ...s, trashed: dest };
}

export function skillsLibrary() {
  const installed = new Set(listSkills().map((s) => s.id));
  const out = [];
  let cats = [];
  try { cats = fs.readdirSync(SKILLS_LIBRARY, { withFileTypes: true }).filter((e) => e.isDirectory()); } catch { return out; }
  for (const c of cats) {
    for (const e of fs.readdirSync(path.join(SKILLS_LIBRARY, c.name), { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const s = readSkill(path.join(SKILLS_LIBRARY, c.name, e.name), 'library', true);
      if (s) out.push({ ...s, category: c.name, installed: installed.has(s.id), content: fs.readFileSync(path.join(s.dir, 'SKILL.md'), 'utf8') });
    }
  }
  return out.sort((a, b) => a.category.localeCompare(b.category) || a.id.localeCompare(b.id));
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const a = path.join(src, e.name), b = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b);
  }
}

export function installSkill(id, { scope = 'user', cwd, force = false } = {}) {
  assertName(id);
  if (scope !== 'user' && scope !== 'project') throw new Error(`Unknown scope ${scope}`);
  const lib = skillsLibrary().find((s) => s.id === id);
  if (!lib) throw new Error(`No library skill "${id}". See: cplus skills library`);
  const base = scope === 'project' ? projectDir(cwd) : userDir();
  const disabled = path.join(disabledOf(base), id);
  const enabled = path.join(base, id);
  const dst = fs.existsSync(enabled) ? enabled : fs.existsSync(disabled) ? disabled : enabled;
  if (fs.existsSync(dst) && !force) throw new Error(`${dst} exists (use --force)`);
  copyDir(lib.dir, dst);
  return readSkill(dst, scope, dst === enabled);
}
