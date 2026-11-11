// Agent manager: Claude Code subagents are Markdown files with YAML frontmatter in
// ~/.claude/agents (user) and <project>/.claude/agents (project). Disabling moves a file to a
// sibling "agents.disabled" folder, which Claude Code never reads — fully reversible.
import fs from 'node:fs';
import path from 'node:path';
import { USER_AGENTS_DIR, projectAgentsDir, disabledDirFor, LIBRARY_DIR, TRASH_DIR, ensureDir } from './paths.js';

const NAME_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
export const MODELS = ['inherit', 'haiku', 'sonnet', 'opus', 'fable'];

export function assertName(name) {
  if (!NAME_RE.test(name || '')) throw new Error(`Invalid agent name "${name}" (letters, digits, - _ . only)`);
  return name;
}

export function parseFrontmatter(text) {
  const m = text.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text, hasFm: false };
  const data = {};
  let key = null;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (kv) {
      key = kv[1];
      let v = kv[2].trim();
      if (v === '|' || v === '>') v = '';
      if (v.length > 1 && v[0] === '"' && v.at(-1) === '"') { try { v = JSON.parse(v); } catch { v = v.slice(1, -1); } }
      else if (v.length > 1 && v[0] === "'" && v.at(-1) === "'") v = v.slice(1, -1).replace(/''/g, "'");
      data[key] = v;
    } else if (key && /^\s+/.test(line)) data[key] = (data[key] ? data[key] + ' ' : '') + line.trim();
  }
  return { data, body: m[2], hasFm: true };
}

/** Set (or add) a single frontmatter key, keeping the rest of the file byte-identical. */
export function setFrontmatterKey(text, key, value) {
  const { hasFm } = parseFrontmatter(text);
  if (!hasFm) return `---\n${key}: ${value}\n---\n${text}`;
  const re = new RegExp(`^(${key}):.*$`, 'm');
  const end = text.indexOf('\n---', 3);
  const fm = text.slice(0, end);
  if (re.test(fm)) return fm.replace(re, `$1: ${value}`) + text.slice(end);
  return fm + `\n${key}: ${value}` + text.slice(end);
}

function scopes(cwd) {
  const list = [{ scope: 'user', dir: USER_AGENTS_DIR }];
  const pdir = projectAgentsDir(cwd);
  if (path.resolve(pdir) !== path.resolve(USER_AGENTS_DIR)) list.push({ scope: 'project', dir: pdir });
  return list;
}

export function dirFor(scope, enabled, cwd) {
  const s = scopes(cwd).find((x) => x.scope === scope);
  if (!s) throw new Error(`Unknown scope ${scope}`);
  return enabled ? s.dir : disabledDirFor(s.dir);
}

function readAgent(file, scope, enabled) {
  const text = fs.readFileSync(file, 'utf8');
  const { data, body } = parseFrontmatter(text);
  const st = fs.statSync(file);
  return {
    id: path.basename(file, '.md'),
    name: data.name || path.basename(file, '.md'),
    description: data.description || '',
    model: data.model || 'inherit',
    tools: data.tools ? data.tools.split(',').map((s) => s.trim()).filter(Boolean) : [],
    color: data.color || '',
    scope, enabled, file, size: st.size, mtime: st.mtimeMs,
    bodyChars: body.length,
    estTokens: Math.round(text.length / 4),
  };
}

function listDir(dir, scope, enabled) {
  let names = [];
  try { names = fs.readdirSync(dir).filter((n) => n.endsWith('.md')); } catch { return []; }
  return names.map((n) => readAgent(path.join(dir, n), scope, enabled));
}

export function listAgents(cwd = process.cwd()) {
  const out = [];
  for (const s of scopes(cwd)) {
    out.push(...listDir(s.dir, s.scope, true), ...listDir(disabledDirFor(s.dir), s.scope, false));
  }
  return out.sort((a, b) => a.scope.localeCompare(b.scope) || a.id.localeCompare(b.id));
}

export function findAgent(id, { scope, cwd } = {}) {
  assertName(id);
  const all = listAgents(cwd).filter((a) => a.id === id || a.name === id);
  const hit = scope ? all.filter((a) => a.scope === scope) : all;
  if (!hit.length) throw new Error(`Agent "${id}" not found${scope ? ` in ${scope} scope` : ''}`);
  if (hit.length > 1 && !scope) return hit.find((a) => a.scope === 'project') || hit[0];
  return hit[0];
}

export function readAgentText(id, opts) {
  const a = findAgent(id, opts);
  return { ...a, content: fs.readFileSync(a.file, 'utf8') };
}

export function setEnabled(id, enabled, opts = {}) {
  const a = findAgent(id, opts);
  if (a.enabled === enabled) return a;
  const target = path.join(ensureDir(dirFor(a.scope, enabled, opts.cwd)), path.basename(a.file));
  if (fs.existsSync(target)) throw new Error(`${target} already exists`);
  fs.renameSync(a.file, target);
  return { ...a, enabled, file: target };
}

export function saveAgent({ id, scope = 'user', content, cwd }) {
  assertName(id);
  const { data } = parseFrontmatter(content);
  if (!data.name) throw new Error('Frontmatter must contain "name:"');
  if (!data.description) throw new Error('Frontmatter must contain "description:"');
  let file;
  try {
    const existing = findAgent(id, { scope, cwd });
    file = existing.file;
  } catch {
    file = path.join(ensureDir(dirFor(scope, true, cwd)), `${id}.md`);
  }
  fs.writeFileSync(file, content.replace(/\r\n/g, '\n'));
  return readAgent(file, scope, !file.includes('agents.disabled'));
}

export function setModel(id, model, opts = {}) {
  if (!MODELS.includes(model) && !/^claude-[a-z0-9-]+$/.test(model)) throw new Error(`Model must be one of ${MODELS.join(', ')} or a full claude-* id`);
  const a = findAgent(id, opts);
  const text = fs.readFileSync(a.file, 'utf8');
  fs.writeFileSync(a.file, setFrontmatterKey(text, 'model', model));
  return readAgent(a.file, a.scope, a.enabled);
}

export function removeAgent(id, opts = {}) {
  const a = findAgent(id, opts);
  const dest = path.join(ensureDir(TRASH_DIR), `${a.scope}-${a.id}-${Date.now()}.md`);
  fs.renameSync(a.file, dest);
  return { ...a, trashed: dest };
}

export function newAgentTemplate({ name, description, model = 'sonnet', tools = '' }) {
  return `---
name: ${name}
description: ${JSON.stringify(description || `Describe when Claude should delegate to ${name}. Be specific — this text decides routing.`)}
${tools ? `tools: ${tools}\n` : ''}model: ${model}
---

You are ${name}.

## Goal
<what this agent is responsible for>

## How to work
1. ...
2. ...

## Output
Return a short report: what you found / changed, with file paths and line numbers.
Keep it under 200 words unless asked otherwise.
`;
}

/** Library layout: library/agents/<category>/<id>.md (flat files are accepted too). */
function libraryFiles() {
  const out = [];
  let entries = [];
  try { entries = fs.readdirSync(LIBRARY_DIR, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.isDirectory()) {
      for (const n of fs.readdirSync(path.join(LIBRARY_DIR, e.name))) if (n.endsWith('.md')) out.push({ category: e.name, file: path.join(LIBRARY_DIR, e.name, n) });
    } else if (e.name.endsWith('.md')) out.push({ category: 'other', file: path.join(LIBRARY_DIR, e.name) });
  }
  return out;
}

const CATEGORY_ORDER = ['core', 'cost-saver', 'quality', 'frontend', 'backend', 'devops', 'data-ai', 'docs', 'mobile', 'product', 'other'];

export function libraryList() {
  const installed = new Set(listAgents().map((a) => a.id));
  return libraryFiles().map(({ category, file }) => {
    const content = fs.readFileSync(file, 'utf8');
    const { data } = parseFrontmatter(content);
    const id = path.basename(file, '.md');
    return { id, category, name: data.name || id, description: data.description || '', model: data.model || 'inherit', tools: data.tools || '', content, installed: installed.has(id) };
  }).sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.id.localeCompare(b.id));
}

export function packsList() {
  let packs = [];
  try { packs = JSON.parse(fs.readFileSync(path.join(LIBRARY_DIR, '..', 'packs.json'), 'utf8')); } catch { return []; }
  const installed = new Set(listAgents().map((a) => a.id));
  return packs.map((p) => ({ ...p, installedCount: p.agents.filter((a) => installed.has(a)).length }));
}

/** Installs every agent of a pack; already-present agents are skipped (not overwritten). */
export function installPack(packId, opts = {}) {
  const pack = packsList().find((p) => p.id === packId);
  if (!pack) throw new Error(`No pack "${packId}". See: cplus agents packs`);
  const done = [], skipped = [];
  for (const id of pack.agents) {
    try { installFromLibrary(id, opts); done.push(id); } catch { skipped.push(id); }
  }
  return { pack: pack.id, installed: done, skipped };
}

export function installFromLibrary(id, { scope = 'user', cwd, force = false } = {}) {
  assertName(id);
  const src = libraryFiles().find((x) => path.basename(x.file, '.md') === id)?.file;
  if (!src) throw new Error(`No library agent "${id}". See: cplus agents library`);
  const dest = path.join(ensureDir(dirFor(scope, true, cwd)), `${id}.md`);
  if (fs.existsSync(dest) && !force) throw new Error(`${dest} exists (use --force to overwrite)`);
  fs.copyFileSync(src, dest);
  return readAgent(dest, scope, true);
}
