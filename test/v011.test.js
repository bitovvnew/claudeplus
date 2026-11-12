import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cplus-v011-'));
process.env.CLAUDEPLUS_HOME = path.join(tmp, 'home');
process.env.CLAUDE_CONFIG_DIR = path.join(tmp, 'claude');

const K = await import('../src/skills.js');
const { parseFrontmatter } = await import('../src/agents.js');
const { generateDemo } = await import('../src/demo.js');
const { plan } = await import('../src/commands/optimize.js');
const { installFromLibrary, setModel, setEnabled, findAgent, installPack, removeAgent } = await import('../src/agents.js');
const { BIN } = await import('../src/paths.js');

test('skill library: valid SKILL.md files with name + quoted description', () => {
  const lib = K.skillsLibrary();
  assert.ok(lib.length >= 18, `only ${lib.length} skills`);
  for (const s of lib) {
    const { data, body } = parseFrontmatter(s.content);
    assert.equal(data.name, s.id);
    assert.ok(data.description.length > 40, `${s.id}: short description`);
    assert.ok(body.includes('## '), `${s.id}: no sections`);
    assert.match(s.content.match(/^description: (.*)$/m)[1], /^".*"$/);
  }
});

test('skills: install, disable, re-enable, remove', () => {
  const s = K.installSkill('token-diet');
  assert.ok(fs.existsSync(path.join(s.dir, 'SKILL.md')));
  assert.throws(() => K.installSkill('token-diet'), /exists/);
  K.setSkillEnabled('token-diet', false);
  assert.ok(K.listSkills().find((x) => x.id === 'token-diet' && !x.enabled).dir.includes('skills.disabled'));
  assert.throws(() => K.installSkill('token-diet'), /exists/);
  assert.equal(K.installSkill('token-diet', { force: true }).enabled, false, 'reinstall preserves disabled state');
  assert.equal(K.listSkills().filter((x) => x.id === 'token-diet').length, 1, 'reinstall never creates an enabled duplicate');
  K.setSkillEnabled('token-diet', true);
  const r = K.removeSkill('token-diet');
  assert.ok(fs.existsSync(r.trashed));
  assert.equal(K.listSkills().length, 0);
});

test('skills: --user targets the user copy when a project skill has the same name', () => {
  const cwd = path.join(tmp, 'project');
  K.installSkill('token-diet');
  K.installSkill('token-diet', { scope: 'project', cwd });
  const result = spawnSync(process.execPath, [BIN, 'skills', 'off', 'token-diet', '--user'], { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(K.findSkill('token-diet', { scope: 'user', cwd }).enabled, false);
  assert.equal(K.findSkill('token-diet', { scope: 'project', cwd }).enabled, true);
  K.removeSkill('token-diet', { scope: 'user', cwd });
  K.removeSkill('token-diet', { scope: 'project', cwd });
  assert.throws(() => K.installSkill('token-diet', { scope: 'invalid' }), /Unknown scope/);
});

test('agents: reinstall and pack installs preserve disabled agents', () => {
  const opts = { scope: 'project', cwd: path.join(tmp, 'pack-project') };
  installFromLibrary('cheap-researcher', opts);
  const disabled = setEnabled('cheap-researcher', false, opts);
  fs.appendFileSync(disabled.file, '\nCustom instruction.\n');
  assert.throws(() => installFromLibrary('cheap-researcher', opts), /exists/);
  const pack = installPack('cost-saver', opts);
  assert.ok(pack.skipped.includes('cheap-researcher'));
  assert.equal(findAgent('cheap-researcher', opts).enabled, false);
  assert.match(fs.readFileSync(disabled.file, 'utf8'), /Custom instruction/);
  assert.equal(installFromLibrary('cheap-researcher', { ...opts, force: true }).enabled, false);
  assert.equal(setEnabled('cheap-researcher', true, opts).enabled, true, 'no duplicate blocks re-enabling');
});

test('trash: project agents and complete skill folders can move across drives', () => {
  const opts = { scope: 'project', cwd: path.join(tmp, 'cross-drive-project') };
  const agent = installFromLibrary('scout', opts);
  const skill = K.installSkill('token-diet', opts);
  const agentText = fs.readFileSync(agent.file, 'utf8');
  fs.mkdirSync(path.join(skill.dir, 'references'));
  fs.writeFileSync(path.join(skill.dir, 'references', 'notes.md'), 'Keep this resource.');
  const rename = fs.renameSync;
  const sources = new Set([agent.file, skill.dir]);
  fs.renameSync = (source, dest) => {
    if (sources.has(source)) throw Object.assign(new Error('Different device'), { code: 'EXDEV' });
    return rename(source, dest);
  };
  try {
    const a = removeAgent('scout', opts);
    const s = K.removeSkill('token-diet', opts);
    assert.equal(fs.readFileSync(a.trashed, 'utf8'), agentText);
    assert.equal(fs.readFileSync(path.join(s.trashed, 'references', 'notes.md'), 'utf8'), 'Keep this resource.');
    assert.ok(fs.existsSync(path.join(s.trashed, 'SKILL.md')));
    assert.equal(fs.existsSync(agent.file), false);
    assert.equal(fs.existsSync(skill.dir), false);
  } finally {
    fs.renameSync = rename;
  }
});

test('trash: failed copies and permission errors leave the original skill intact', () => {
  const opts = { scope: 'project', cwd: path.join(tmp, 'failed-trash-project') };
  const skill = K.installSkill('token-diet', opts);
  const original = fs.readFileSync(path.join(skill.dir, 'SKILL.md'), 'utf8');
  const rename = fs.renameSync, copy = fs.cpSync;
  fs.cpSync = () => { throw Object.assign(new Error('Cannot copy'), { code: 'EACCES' }); };
  try {
    fs.renameSync = () => { throw Object.assign(new Error('Different device'), { code: 'EXDEV' }); };
    assert.throws(() => K.removeSkill('token-diet', opts), { code: 'EACCES' });
    assert.equal(fs.readFileSync(path.join(skill.dir, 'SKILL.md'), 'utf8'), original);
    fs.renameSync = () => { throw Object.assign(new Error('Permission denied'), { code: 'EPERM' }); };
    assert.throws(() => K.removeSkill('token-diet', opts), { code: 'EPERM' });
    assert.equal(fs.readFileSync(path.join(skill.dir, 'SKILL.md'), 'utf8'), original);
  } finally {
    fs.renameSync = rename;
    fs.cpSync = copy;
  }
});

test('optimize: proposes guard + statusline + budget, keeps thinkers on strong models', async () => {
  generateDemo(process.env.CLAUDE_CONFIG_DIR, { seed: 3 });
  installFromLibrary('planner');
  installFromLibrary('scout');
  setModel('scout', 'opus');
  const p = await plan();
  const ids = p.actions.map((a) => a.id);
  for (const id of ['guard', 'statusline', 'budget', 'agent-models', 'cost-saver']) assert.ok(ids.includes(id), `missing ${id}`);
  const am = p.actions.find((a) => a.id === 'agent-models');
  assert.match(am.title, /scout/);
  assert.doesNotMatch(am.title, /planner/);
  assert.match(am.cmd, /scout haiku --user/);
  assert.ok(p.savings > 0);
});
