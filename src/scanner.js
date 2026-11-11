// Incremental scanner: walks ~/.claude/projects, re-parses only files whose size/mtime changed,
// keeps results in ~/.claudeplus/scan-cache.json.
import fs from 'node:fs';
import path from 'node:path';
import { PROJECTS_DIR, CACHE_FILE, readJson, writeJson } from './paths.js';
import { parseFile } from './parser.js';

const CACHE_VERSION = 3;

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile() && e.name.endsWith('.jsonl')) out.push(p);
  }
  return out;
}

/**
 * @param {{ onProgress?: (done:number, total:number, file:string)=>void, root?: string }} opts
 * @returns {Promise<{files: Array<{file, size, mtime, msgs, meta}>, parsed: number, total: number}>}
 */
export async function scan(opts = {}) {
  const root = opts.root || PROJECTS_DIR;
  let cache = readJson(CACHE_FILE, null);
  if (!cache || cache.v !== CACHE_VERSION || cache.root !== root) cache = { v: CACHE_VERSION, root, files: {} };

  const files = walk(root);
  const seen = new Set();
  const todo = [];
  for (const f of files) {
    let st;
    try { st = fs.statSync(f); } catch { continue; }
    seen.add(f);
    const c = cache.files[f];
    if (!c || c.size !== st.size || c.mtime !== st.mtimeMs) todo.push([f, st]);
  }

  let done = 0;
  // Biggest first so the progress bar is honest about the long tail.
  todo.sort((a, b) => b[1].size - a[1].size);
  const CONCURRENCY = 4;
  let idx = 0;
  async function worker() {
    while (idx < todo.length) {
      const [f, st] = todo[idx++];
      try {
        const { msgs, meta } = await parseFile(f);
        cache.files[f] = { size: st.size, mtime: st.mtimeMs, msgs, meta };
      } catch (e) {
        cache.files[f] = { size: st.size, mtime: st.mtimeMs, msgs: [], meta: { error: String(e.message || e) } };
      }
      done++;
      opts.onProgress?.(done, todo.length, f);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker));

  let removed = 0;
  for (const f of Object.keys(cache.files)) if (!seen.has(f)) { delete cache.files[f]; removed++; }
  if (todo.length || removed) writeJson(CACHE_FILE, cache, false);

  return {
    files: Object.entries(cache.files).map(([file, v]) => ({ file, ...v })),
    parsed: todo.length,
    total: files.length,
  };
}
