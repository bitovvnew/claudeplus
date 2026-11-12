import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
export const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');
export const SETTINGS_FILE = path.join(CLAUDE_DIR, 'settings.json');
export const USER_AGENTS_DIR = path.join(CLAUDE_DIR, 'agents');

export const CPLUS_DIR = process.env.CLAUDEPLUS_HOME || path.join(os.homedir(), '.claudeplus');
export const CACHE_FILE = path.join(CPLUS_DIR, 'scan-cache.json');
export const CONFIG_FILE = path.join(CPLUS_DIR, 'config.json');
export const STATUS_STATE = path.join(CPLUS_DIR, 'statusline-state.json');
export const GUARD_DIR = path.join(CPLUS_DIR, 'guard');
export const GUARD_LOG = path.join(CPLUS_DIR, 'guard-log.jsonl');
export const TRASH_DIR = path.join(CPLUS_DIR, 'trash');
export const BACKUP_DIR = path.join(CPLUS_DIR, 'backups');

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const LIBRARY_DIR = path.join(ROOT, 'library', 'agents');
export const DASHBOARD_DIR = path.join(ROOT, 'dashboard');
export const BIN = path.join(ROOT, 'bin', 'cplus.js');

/** Agents of the current project live in <cwd>/.claude/agents */
export const projectAgentsDir = (cwd = process.cwd()) => path.join(cwd, '.claude', 'agents');
/** Disabled agents are moved next to the agents dir so Claude Code never loads them. */
export const disabledDirFor = (agentsDir) => path.join(path.dirname(agentsDir), 'agents.disabled');

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Project files may live on a different drive from the user's trash directory. */
export function moveToTrash(source, name) {
  const dest = path.join(ensureDir(TRASH_DIR), name);
  try {
    fs.renameSync(source, dest);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
    // Remove the original only after its complete copy exists in trash.
    fs.cpSync(source, dest, { recursive: true, errorOnExist: true, force: false, verbatimSymlinks: true });
    fs.rmSync(source, { recursive: true });
  }
  return dest;
}

export function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
  } catch {
    return fallback;
  }
}

/** Atomic write: tmp file + rename, so a crash never leaves half a JSON file. */
export function writeJson(file, data, pretty = true) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data));
  fs.renameSync(tmp, file);
}
