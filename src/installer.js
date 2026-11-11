// Wires ClaudePlus into Claude Code's settings.json (statusLine + PreToolUse hook).
// Always backs up settings.json first; uninstall restores a previous statusline if we replaced one.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SETTINGS_FILE, BACKUP_DIR, BIN, CPLUS_DIR, CLAUDE_DIR, PROJECTS_DIR, CACHE_FILE, readJson, writeJson, ensureDir } from './paths.js';
import { loadConfig, saveConfig } from './config.js';
import { c } from './ui.js';

const binPath = BIN.replace(/\\/g, '/');
export const STATUS_CMD = `node "${binPath}" statusline`;
export const GUARD_CMD = `node "${binPath}" guard`;
const GUARD_MATCHER = 'Read|Bash|PowerShell';
const isOurs = (cmd) => typeof cmd === 'string' && /cplus\.js"?\s+(statusline|guard)|claudeplus\s+(statusline|guard)|cplus\s+(statusline|guard)/.test(cmd);

function readSettings() {
  if (!fs.existsSync(SETTINGS_FILE)) return {};
  const raw = fs.readFileSync(SETTINGS_FILE, 'utf8').replace(/^﻿/, '');
  try { return raw.trim() ? JSON.parse(raw) : {}; } catch (e) { throw new Error(`${SETTINGS_FILE} is not valid JSON (${e.message}). Fix it first — nothing was changed.`); }
}

function backup() {
  if (!fs.existsSync(SETTINGS_FILE)) return null;
  const dest = path.join(ensureDir(BACKUP_DIR), `settings-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.copyFileSync(SETTINGS_FILE, dest);
  return dest;
}

function guardInstalled(s) {
  return (s.hooks?.PreToolUse || []).some((h) => (h.hooks || []).some((x) => isOurs(x.command)));
}

export function status() {
  let s = {};
  let error = null;
  try { s = readSettings(); } catch (e) { error = e.message; }
  const home = os.homedir();
  const shown = process.env.CPLUS_DEMO ? '~/.claude/settings.json' : SETTINGS_FILE.startsWith(home) ? '~' + SETTINGS_FILE.slice(home.length) : SETTINGS_FILE;
  return {
    settingsFile: shown,
    statusline: isOurs(s.statusLine?.command),
    otherStatusline: s.statusLine && !isOurs(s.statusLine.command) ? s.statusLine.command : null,
    guard: guardInstalled(s),
    guardMode: loadConfig().guard.mode,
    error,
  };
}

export async function install(args = {}) {
  const both = !args.statusline && !args.guard;
  const wantStatus = both || args.statusline;
  const wantGuard = both || args.guard;
  const s = readSettings();
  const bak = backup();
  const cfg = loadConfig();

  if (wantStatus) {
    if (s.statusLine && !isOurs(s.statusLine.command)) { cfg.previousStatusLine = s.statusLine; saveConfig(cfg); }
    s.statusLine = { type: 'command', command: STATUS_CMD, padding: 0 };
  }
  if (wantGuard && !guardInstalled(s)) {
    s.hooks ||= {};
    s.hooks.PreToolUse ||= [];
    s.hooks.PreToolUse.push({ matcher: GUARD_MATCHER, hooks: [{ type: 'command', command: GUARD_CMD, timeout: 5 }] });
  }
  writeJson(SETTINGS_FILE, s);
  if (!args.quiet) {
    console.log(c.green(`\n  ✓ ClaudePlus installed into ${SETTINGS_FILE}`));
    if (bak) console.log(c.gray(`    backup: ${bak}`));
    if (wantStatus) console.log(`    ${c.violet('◆')} statusline   ${c.gray(STATUS_CMD)}`);
    if (wantGuard) console.log(`    ${c.violet('◆')} guard hook   ${c.gray(`PreToolUse[${GUARD_MATCHER}] mode=${cfg.guard.mode}`)}`);
    console.log(c.gray('    Restart Claude Code (or open a new session) to pick it up.\n'));
  }
}

export async function uninstall(args = {}) {
  const both = !args.statusline && !args.guard;
  const s = readSettings();
  const bak = backup();
  const cfg = loadConfig();
  if ((both || args.statusline) && isOurs(s.statusLine?.command)) {
    if (cfg.previousStatusLine) { s.statusLine = cfg.previousStatusLine; delete cfg.previousStatusLine; saveConfig(cfg); }
    else delete s.statusLine;
  }
  if ((both || args.guard) && s.hooks?.PreToolUse) {
    s.hooks.PreToolUse = s.hooks.PreToolUse
      .map((h) => ({ ...h, hooks: (h.hooks || []).filter((x) => !isOurs(x.command)) }))
      .filter((h) => h.hooks.length);
    if (!s.hooks.PreToolUse.length) delete s.hooks.PreToolUse;
    if (!Object.keys(s.hooks).length) delete s.hooks;
  }
  writeJson(SETTINGS_FILE, s);
  if (!args.quiet) {
    console.log(c.green(`\n  ✓ ClaudePlus removed from ${SETTINGS_FILE}`));
    if (bak) console.log(c.gray(`    backup: ${bak}\n`));
  }
}

export async function doctor() {
  const ok = (b, msg, hint = '') => console.log(`  ${b ? c.green('✓') : c.yellow('!')} ${msg}${!b && hint ? c.gray('  → ' + hint) : ''}`);
  console.log(`\n  ${c.bold('ClaudePlus doctor')}\n`);
  const major = +process.versions.node.split('.')[0];
  ok(major >= 18, `Node ${process.versions.node}`, 'Node 18+ required');
  ok(fs.existsSync(CLAUDE_DIR), `Claude dir ${CLAUDE_DIR}`, 'set CLAUDE_CONFIG_DIR if it lives elsewhere');
  let n = 0;
  const walk = (d) => { try { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.jsonl') && n++; } catch {} };
  walk(PROJECTS_DIR);
  ok(n > 0, `${n} transcripts in ${PROJECTS_DIR}`);
  const st = status();
  if (st.error) ok(false, st.error);
  ok(st.statusline, 'statusline installed', 'cplus install --statusline');
  if (st.otherStatusline) console.log(c.gray(`      (current statusline: ${st.otherStatusline})`));
  ok(st.guard, `guard hook installed (mode: ${st.guardMode})`, 'cplus install --guard');
  ok(fs.existsSync(CACHE_FILE), `scan cache ${CACHE_FILE}`, 'run `cplus` once');
  console.log(c.gray(`\n  data dir: ${CPLUS_DIR}\n`));
}
