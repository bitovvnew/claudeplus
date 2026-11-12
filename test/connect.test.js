import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough, Writable } from 'node:stream';
import { spawnSync } from 'node:child_process';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cplus-connect-'));
process.env.CLAUDEPLUS_HOME = path.join(tmp, 'home');
process.env.CLAUDE_CONFIG_DIR = path.join(tmp, 'claude');

const { run } = await import('../src/commands/connect.js');
const { BIN, SETTINGS_FILE, BACKUP_DIR, CONFIG_FILE } = await import('../src/paths.js');
const { STATUS_CMD, GUARD_CMD } = await import('../src/installer.js');

function terminal(isTTY = true) {
  const input = new PassThrough();
  input.isTTY = isTTY;
  let text = '';
  const output = new Writable({ write(chunk, encoding, done) { text += chunk.toString(); done(); } });
  return { input, output, text: () => text };
}

test('connect: piped consent is refused without creating settings or cache', () => {
  const home = path.join(tmp, 'cli-home'), claude = path.join(tmp, 'cli-claude');
  const result = spawnSync(process.execPath, [BIN, 'connect'], {
    encoding: 'utf8', input: 'y\n',
    env: { ...process.env, CLAUDEPLUS_HOME: home, CLAUDE_CONFIG_DIR: claude },
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /WARNING/);
  assert.match(result.stderr, /--yes/);
  assert.equal(fs.existsSync(home), false);
  assert.equal(fs.existsSync(claude), false);
});

test('connect: no, an empty answer and EOF all cancel without mutation', async () => {
  for (const answer of ['n\n', '\n', '']) {
    const io = terminal();
    const result = run({}, { ...io, startDashboard: () => assert.fail('Dashboard must not start') });
    io.input.end(answer);
    assert.equal(await result, false);
    assert.match(io.text(), /\[y\/N\]/);
    assert.match(io.text(), /Cancelled/);
    assert.equal(fs.existsSync(process.env.CLAUDEPLUS_HOME), false);
    assert.equal(fs.existsSync(process.env.CLAUDE_CONFIG_DIR), false);
  }
});

test('connect: explicit confirmation preserves settings and backs them up before opening the dashboard', async () => {
  const previousStatus = { type: 'command', command: 'my-statusline' };
  const previousHook = { matcher: 'Write', hooks: [{ type: 'command', command: 'my-hook' }] };
  const previous = { statusLine: previousStatus, hooks: { PreToolUse: [previousHook] }, customSetting: 'keep me' };
  fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
  const original = JSON.stringify(previous, null, 2);
  fs.writeFileSync(SETTINGS_FILE, original);
  const io = terminal();
  let started = false;
  const result = run({ port: 4321, noOpen: true }, { ...io, startDashboard: async (args) => {
    started = true;
    assert.equal(args.port, 4321);
    assert.equal(args.noOpen, true);
    const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    assert.equal(settings.customSetting, 'keep me');
    assert.equal(settings.statusLine.command, STATUS_CMD);
    assert.deepEqual(settings.hooks.PreToolUse[0], previousHook);
    assert.ok(settings.hooks.PreToolUse.some((entry) => entry.hooks.some((hook) => hook.command === GUARD_CMD)));
    const backups = fs.readdirSync(BACKUP_DIR);
    assert.ok(backups.some((name) => fs.readFileSync(path.join(BACKUP_DIR, name), 'utf8') === original));
    assert.deepEqual(JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')).previousStatusLine, previousStatus);
  } });
  io.input.end('yes\n');
  assert.equal(await result, true);
  assert.equal(started, true);
  assert.match(io.text(), /Settings backup folder:/);
  assert.ok(io.text().indexOf('WARNING') < io.text().indexOf('[y/N]'));
});

test('connect: --yes supports non-interactive setup and still displays the warning', async () => {
  const io = terminal(false);
  let started = false;
  assert.equal(await run({ yes: true }, { ...io, startDashboard: async () => { started = true; } }), true);
  assert.equal(started, true);
  assert.match(io.text(), /WARNING/);
  assert.doesNotMatch(io.text(), /\[y\/N\]/);
  const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
  assert.equal(settings.hooks.PreToolUse.filter((entry) => entry.hooks.some((hook) => hook.command === GUARD_CMD)).length, 1);
});
