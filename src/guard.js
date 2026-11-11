// ClaudePlus Guard — a PreToolUse hook that stops the most common token leaks before they happen.
//   • re-reading a file that has not changed since it was read in this session
//   • full Read of a huge file (no offset/limit)
//   • shell commands that dump enormous output (recursive listings, full logs, lockfiles…)
//   • optional hard stop when the daily budget is exceeded
// Policy is "deny once": the same call repeated right after a deny is allowed, so Claude is never
// stuck when it genuinely needs the data (e.g. after /compact).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { GUARD_DIR, GUARD_LOG, readJson, writeJson, ensureDir } from './paths.js';
import { loadConfig } from './config.js';

const BINARY_OK = /\.(png|jpe?g|gif|webp|bmp|pdf|ipynb)$/i;

const NOISY = [
  [/\bls\b[^|;&]*\s-[a-zA-Z]*R/, 'recursive ls'],
  [/\bGet-ChildItem\b(?=[^|]*-Recurse)(?![^|]*-(Filter|Include|Depth))[^|]*$/i, 'Get-ChildItem -Recurse without filter/depth or pipe'],
  [/\bfind\s+(\/|~|\.)\s*($|[;&|])/, 'find over a whole tree without filters'],
  [/\btree\b(?![^|]*\s-L\s)(?![^|]*\|)/, 'tree without -L depth'],
  [/\b(cat|type|Get-Content)\b[^|]*\b(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|poetry\.lock)\b(?![^|]*\|)/i, 'dumping a lockfile'],
  [/\b(cat|type|Get-Content)\b[^|]*\.(log|min\.js|map)\b(?![^|]*(\||-Tail|-TotalCount|-First))/i, 'dumping a log/minified file'],
  [/\bgit\s+log\b(?![^|]*(-n\s*\d|-\d+|--max-count|--oneline|\|))/, 'git log without a limit'],
  [/\bdocker\s+logs\b(?![^|]*--tail)/, 'docker logs without --tail'],
  [/\bjournalctl\b(?![^|]*(-n|--lines|\|))/, 'journalctl without a limit'],
];

async function stdinJson() {
  let s = '';
  for await (const ch of process.stdin) s += ch;
  return JSON.parse(s.replace(/^﻿/, '') || '{}');
}

const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 16);

function log(ev) {
  try {
    ensureDir(path.dirname(GUARD_LOG));
    fs.appendFileSync(GUARD_LOG, JSON.stringify({ ts: Date.now(), ...ev }) + '\n');
  } catch {}
}

function respond(mode, reason, ev) {
  log({ ...ev, mode, reason });
  if (mode === 'block') {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: `[ClaudePlus Guard] ${reason}` },
    }));
  } else if (mode === 'warn') {
    process.stdout.write(JSON.stringify({
      systemMessage: `ClaudePlus Guard: ${reason}`,
      hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: `[ClaudePlus Guard] ${reason}` },
    }));
  }
}

export function evaluate(input, cfg, state, todaySpend = 0) {
  const g = cfg.guard;
  const tool = input.tool_name;
  const ti = input.tool_input || {};

  if (g.budgetStop && cfg.budget.daily && todaySpend >= cfg.budget.daily) {
    return { reason: `Daily budget $${cfg.budget.daily} reached (spent $${todaySpend.toFixed(2)}). Finish up and tell the user; raise it with \`cplus budget --daily N\`.`, kind: 'budget', key: 'budget' };
  }

  if (tool === 'Read' && ti.file_path && !BINARY_OK.test(ti.file_path)) {
    let st;
    try { st = fs.statSync(ti.file_path); } catch { return null; }
    const partial = ti.offset != null || ti.limit != null;
    const sig = `${st.size}:${Math.round(st.mtimeMs)}`;
    if (!partial && st.size > g.maxReadBytes) {
      return { kind: 'big-read', key: `big:${ti.file_path}:${sig}`, reason: `${path.basename(ti.file_path)} is ${(st.size / 1024).toFixed(0)} KB (~${Math.round(st.size / 4 / 1000)}k tokens). Use Grep to find the relevant part, then Read with offset/limit.` };
    }
    if (g.dedupeReads && !partial) {
      const prev = state.reads[ti.file_path];
      state.reads[ti.file_path] = sig;
      if (prev === sig) {
        return { kind: 'dup-read', key: `dup:${ti.file_path}:${sig}`, reason: `${path.basename(ti.file_path)} has not changed since you last read it in this session — reuse that content instead of reading it again. (If it is no longer in your context, repeat the call and it will go through.)` };
      }
    }
  }

  if (g.noisyBash && (tool === 'Bash' || tool === 'PowerShell') && ti.command) {
    for (const [re, what] of NOISY) {
      if (re.test(ti.command)) {
        return { kind: 'noisy-shell', key: `sh:${hash(ti.command)}`, reason: `This command looks like it will dump a huge output (${what}). Narrow it (filters, depth, | head / Select-Object -First N). Repeat the exact command if you really need the full output.` };
      }
    }
  }
  return null;
}

export async function run() {
  try {
    const input = await stdinJson();
    const cfg = loadConfig();
    if (cfg.guard.mode === 'off') return;
    const sid = (input.session_id || 'nosession').replace(/[^\w-]/g, '');
    const file = path.join(GUARD_DIR, `${sid}.json`);
    const state = readJson(file, { reads: {}, denied: {} });
    state.reads ||= {}; state.denied ||= {};

    let spend = 0;
    if (cfg.guard.budgetStop && cfg.budget.daily) spend = (await import('./statusline.js')).todaySpend();

    const hit = evaluate(input, cfg, state, spend);
    if (hit) {
      // deny once: an identical retry goes through (budget stop is always enforced)
      if (hit.kind !== 'budget' && state.denied[hit.key]) {
        delete state.denied[hit.key];
        log({ sid, tool: input.tool_name, kind: hit.kind, mode: 'allowed-retry' });
      } else {
        if (hit.kind !== 'budget') state.denied[hit.key] = Date.now();
        respond(hit.kind === 'budget' ? 'block' : cfg.guard.mode, hit.reason, { sid, tool: input.tool_name, kind: hit.kind, target: input.tool_input?.file_path || input.tool_input?.command?.slice(0, 120) });
      }
    }
    // A file edited in this session must be re-readable.
    if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(input.tool_name) && input.tool_input?.file_path) delete state.reads[input.tool_input.file_path];
    writeJson(file, state, false);
  } catch {
    // A hook must never break Claude Code.
  }
}

/** Remove guard state files older than 7 days. */
export function cleanup() {
  try {
    for (const f of fs.readdirSync(GUARD_DIR)) {
      const p = path.join(GUARD_DIR, f);
      if (Date.now() - fs.statSync(p).mtimeMs > 7 * 864e5) fs.unlinkSync(p);
    }
  } catch {}
}
