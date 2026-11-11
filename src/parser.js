// Streams one Claude Code transcript (*.jsonl) and extracts a compact, cacheable summary.
// One API call can be written as several lines (one per content block) sharing message.id —
// we merge them so tokens are counted exactly once.
import fs from 'node:fs';
import readline from 'node:readline';

const BIG_RESULT_CHARS = 25_000;
const KEEP_BIG = 15;

function contentChars(c) {
  if (c == null) return 0;
  if (typeof c === 'string') return c.length;
  if (Array.isArray(c)) {
    let n = 0;
    for (const b of c) {
      if (!b) continue;
      if (typeof b.text === 'string') n += b.text.length;
      else if (b.type === 'image') n += 6_000; // ~1.5k tokens per typical screenshot
      else n += JSON.stringify(b).length;
    }
    return n;
  }
  return JSON.stringify(c).length;
}

function hintFor(name, input) {
  if (!input || typeof input !== 'object') return '';
  switch (name) {
    case 'Read': return input.file_path ? input.file_path + (input.offset || input.limit ? `#${input.offset || 0}+${input.limit || ''}` : '') : '';
    case 'Edit': case 'Write': case 'NotebookEdit': return input.file_path || input.notebook_path || '';
    case 'Bash': case 'PowerShell': return String(input.command || '').slice(0, 160);
    case 'Grep': return `${input.pattern || ''} ${input.path || ''}`.trim().slice(0, 160);
    case 'Glob': return String(input.pattern || '').slice(0, 160);
    case 'WebFetch': return String(input.url || '').slice(0, 160);
    case 'WebSearch': return String(input.query || '').slice(0, 160);
    case 'Agent': case 'Task': return `${input.subagent_type || 'general'}: ${String(input.description || '').slice(0, 120)}`;
    default: return '';
  }
}

export function normUsage(u) {
  if (!u) return null;
  const src = Array.isArray(u.iterations) && u.iterations.length ? u.iterations : [u];
  const r = { in: 0, out: 0, cw5: 0, cw1h: 0, cr: 0 };
  for (const x of src) {
    r.in += x.input_tokens || 0;
    r.out += x.output_tokens || 0;
    r.cr += x.cache_read_input_tokens || 0;
    const cc = x.cache_creation;
    if (cc && (cc.ephemeral_1h_input_tokens || cc.ephemeral_5m_input_tokens)) {
      r.cw1h += cc.ephemeral_1h_input_tokens || 0;
      r.cw5 += cc.ephemeral_5m_input_tokens || 0;
    } else r.cw5 += x.cache_creation_input_tokens || 0;
  }
  r.think = u.output_tokens_details?.thinking_tokens || 0;
  r.web = (u.server_tool_use?.web_search_requests || 0);
  r.fast = u.speed === 'fast' ? 1 : 0;
  return r;
}

const NOISE = /^\s*(<command-|<local-command|<system-reminder|<bash-|<user-prompt-submit-hook|Caveat:|\[Request interrupted)/;

/**
 * @returns {Promise<{msgs: object[], meta: object}>}
 * msg: { id, ts, model, sid, side, in, out, cw5, cw1h, cr, think, web, fast, tools:{name:n}, effort }
 */
export async function parseFile(file) {
  const msgs = new Map();
  const toolById = new Map();
  const meta = {
    sid: null, cwd: null, branch: null, title: null, firstPrompt: null, version: null,
    prompts: 0, firstTs: 0, lastTs: 0,
    results: {}, // tool -> { n, chars }
    reads: {}, // full-file Read path -> { n, chars }
    big: [], // largest tool results
    agents: {}, // subagent_type -> spawned count
  };

  const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.length < 10) continue;
    // Cheap pre-filter before JSON.parse on giant lines.
    const head = line.slice(0, 400);
    if (!head.includes('"type"')) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }

    if (o.sessionId && !meta.sid) meta.sid = o.sessionId;
    if (o.cwd && !meta.cwd) meta.cwd = o.cwd;
    if (o.gitBranch) meta.branch = o.gitBranch;
    if (o.version) meta.version = o.version;
    const ts = o.timestamp ? Date.parse(o.timestamp) : 0;
    if (ts) {
      if (!meta.firstTs || ts < meta.firstTs) meta.firstTs = ts;
      if (ts > meta.lastTs) meta.lastTs = ts;
    }

    if (o.type === 'custom-title' && o.customTitle) meta.title = o.customTitle;
    else if (o.type === 'summary' && o.summary && !meta.title) meta.title = o.summary;
    else if (o.type === 'assistant' && o.message) {
      const m = o.message;
      const key = `${m.id || o.uuid}|${o.requestId || ''}`;
      let r = msgs.get(key);
      if (!r) {
        r = {
          id: key, ts, model: m.model || 'unknown', sid: o.sessionId || meta.sid, side: o.isSidechain ? 1 : 0,
          in: 0, out: 0, cw5: 0, cw1h: 0, cr: 0, think: 0, web: 0, fast: 0, tools: {}, effort: o.effort || undefined,
        };
        msgs.set(key, r);
      }
      const u = normUsage(m.usage);
      if (u) for (const k of ['in', 'out', 'cw5', 'cw1h', 'cr', 'think', 'web', 'fast']) if (u[k] > r[k]) r[k] = u[k];
      if (Array.isArray(m.content)) {
        for (const b of m.content) {
          if (b?.type !== 'tool_use' || toolById.has(b.id)) continue;
          const hint = hintFor(b.name, b.input);
          toolById.set(b.id, { name: b.name, hint, full: b.name === 'Read' && !(b.input?.offset || b.input?.limit) });
          r.tools[b.name] = (r.tools[b.name] || 0) + 1;
          if ((b.name === 'Agent' || b.name === 'Task') && b.input) {
            const t = b.input.subagent_type || 'general-purpose';
            meta.agents[t] = (meta.agents[t] || 0) + 1;
          }
        }
      }
    } else if (o.type === 'user' && o.message) {
      const ct = o.message.content;
      if (typeof ct === 'string') {
        if (!o.isMeta && !o.isSidechain && !NOISE.test(ct)) {
          meta.prompts++;
          if (!meta.firstPrompt) meta.firstPrompt = ct.trim().slice(0, 160);
        }
      } else if (Array.isArray(ct)) {
        let text = null;
        let hasResult = false;
        for (const b of ct) {
          if (b?.type === 'tool_result') {
            hasResult = true;
            const t = toolById.get(b.tool_use_id) || { name: 'unknown', hint: '' };
            const chars = contentChars(b.content);
            const agg = (meta.results[t.name] ||= { n: 0, chars: 0 });
            agg.n++; agg.chars += chars;
            if (t.full && t.hint && !b.is_error) {
              const rd = (meta.reads[t.hint] ||= { n: 0, chars: 0 });
              rd.n++; rd.chars = Math.max(rd.chars, chars);
            }
            if (chars >= BIG_RESULT_CHARS) {
              meta.big.push({ tool: t.name, hint: t.hint, chars, ts });
              if (meta.big.length > KEEP_BIG * 2) meta.big = meta.big.sort((a, b) => b.chars - a.chars).slice(0, KEEP_BIG);
            }
          } else if (b?.type === 'text' && !text) text = b.text;
        }
        if (!hasResult && text && !o.isMeta && !o.isSidechain && !NOISE.test(text)) {
          meta.prompts++;
          if (!meta.firstPrompt) meta.firstPrompt = text.trim().slice(0, 160);
        }
      }
    }
  }
  meta.big = meta.big.sort((a, b) => b.chars - a.chars).slice(0, KEEP_BIG);
  // Drop single reads to keep the cache small — only repeats matter for waste analysis.
  for (const [p, v] of Object.entries(meta.reads)) if (v.n < 2) delete meta.reads[p];
  const list = [...msgs.values()].filter((r) => r.in + r.out + r.cr + r.cw5 + r.cw1h > 0);
  for (const r of list) {
    if (!Object.keys(r.tools).length) delete r.tools;
    for (const k of ['think', 'web', 'fast', 'side']) if (!r[k]) delete r[k];
  }
  return { msgs: list, meta };
}
