// Synthetic Claude Code transcripts for `cplus demo`, screenshots and benchmarks.
// 100% fake: invented projects, prompts and paths. Deterministic (seeded), always relative to "now".
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PROJECTS = [
  { name: 'acme-storefront', files: ['src/app/page.tsx', 'src/components/Cart.tsx', 'src/lib/api.ts', 'package.json', 'src/styles/globals.css', 'next.config.js'], w: 5 },
  { name: 'rust-engine', files: ['src/main.rs', 'src/render/mod.rs', 'src/physics.rs', 'Cargo.toml', 'benches/frame.rs'], w: 3 },
  { name: 'ml-pipeline', files: ['pipeline/train.py', 'pipeline/features.py', 'configs/base.yaml', 'notebooks/eda.ipynb', 'requirements.txt'], w: 3 },
  { name: 'mobile-app', files: ['app/screens/Home.tsx', 'app/navigation.tsx', 'app/store/user.ts', 'app.json'], w: 2 },
  { name: 'docs-site', files: ['docs/intro.md', 'docs/api.md', 'astro.config.mjs'], w: 1 },
  { name: 'infra', files: ['terraform/main.tf', 'k8s/deploy.yaml', '.github/workflows/ci.yml', 'Dockerfile'], w: 1 },
];

const TITLES = [
  'Add dark mode to settings', 'Fix checkout race condition', 'Speed up frame time', 'Refactor auth middleware',
  'Migrate to App Router', 'Write unit tests for cart', 'Investigate memory leak', 'Add CSV export', 'Set up CI matrix',
  'Optimize SQL queries', 'Implement search with filters', 'Upgrade dependencies', 'Add i18n support', 'Design onboarding flow',
  'Fix flaky e2e tests', 'Add rate limiting', 'Train baseline model', 'Clean up feature store', 'Write API docs', 'Add push notifications',
];
const PROMPTS = [
  'Look at the failing test and fix it', 'Can you make this faster?', 'Add a loading state', 'Now update the docs',
  'Refactor this into smaller functions', 'Why does this crash on Windows?', 'Run the tests again', 'Looks good, commit it',
  'Add error handling for the network call', 'Explain what this module does', 'Make it responsive on mobile', 'Add types everywhere',
];
const BASH = ['npm test', 'npm run build', 'git status', 'git diff', 'cargo test', 'pytest -q', 'ls -la', 'git log', 'npm run lint', 'cargo bench'];
const MODELS = [['claude-opus-5-5', 0.62], ['claude-sonnet-5-5', 0.22], ['claude-fable-5-2', 0.1], ['claude-opus-4-8', 0.06]];
const FILLER = 'const value = compute(input); // demo content line for ClaudePlus synthetic transcript\n';

const uuid = (r) => {
  const b = Array.from({ length: 16 }, () => Math.floor(r() * 256));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

/**
 * @param {string} claudeDir target dir (gets projects/<enc>/<sid>.jsonl)
 * @param {{days?:number, scale?:number, seed?:number}} o
 */
export function generateDemo(claudeDir, o = {}) {
  const days = o.days || 30;
  const scale = o.scale || 1;
  const r = rng(o.seed || 42);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const between = (a, b) => a + r() * (b - a);
  const weighted = (pairs) => { let x = r() * pairs.reduce((a, p) => a + p[1], 0); for (const p of pairs) { x -= p[1]; if (x <= 0) return p[0]; } return pairs[0][0]; };
  const projW = PROJECTS.map((p) => [p, p.w]);
  const root = path.join(claudeDir, 'projects');
  fs.rmSync(root, { recursive: true, force: true });
  let bytes = 0, sessions = 0, calls = 0;

  const now = Date.now();
  for (let d = days - 1; d >= 0; d--) {
    const day = new Date(now - d * 864e5);
    const weekend = [0, 6].includes(day.getDay());
    const nSess = Math.round((weekend ? between(0, 1.6) : between(0.6, 3.4)) * scale);
    for (let s = 0; s < nSess; s++) {
      const proj = weighted(projW);
      const cwd = `/home/dev/code/${proj.name}`;
      const enc = cwd.replace(/[^A-Za-z0-9]/g, '-');
      const sid = uuid(r);
      const model = weighted(MODELS);
      const start = new Date(day); start.setHours(Math.floor(between(9, 21)), Math.floor(between(0, 59)), 0, 0);
      let ts = Math.min(start.getTime(), now - 60_000 * (nSess - s) * 30);
      if (d === 0 && s === nSess - 1) ts = now - 95 * 60_000; // a session that is "live" right now
      const lines = [];
      const push = (o2) => lines.push(JSON.stringify(o2));
      const base = { sessionId: sid, cwd, gitBranch: pick(['main', 'main', 'feat/new-ui', 'fix/perf']), version: '2.1.0', userType: 'external' };
      push({ type: 'custom-title', customTitle: pick(TITLES), sessionId: sid });
      let ctx = between(18_000, 32_000);
      let tuN = 0;
      const prompts = Math.floor(between(3, 26));
      for (let p = 0; p < prompts; p++) {
        const live = d === 0 && s === nSess - 1;
        const idle = !live && r() < 0.12 ? between(20, 140) * 60_000 : between(0.5, 4) * 60_000;
        ts += idle;
        if (ts > now - 3 * 60_000) break;
        push({ ...base, type: 'user', message: { role: 'user', content: p === 0 ? pick(TITLES) : pick(PROMPTS) }, timestamp: new Date(ts).toISOString(), uuid: uuid(r) });
        if (ctx > 260_000 && r() < 0.3) ctx = between(35_000, 60_000); // /compact
        const steps = Math.floor(between(2, 11));
        let rebuild = idle > 5 * 60_000;
        for (let k = 0; k < steps; k++) {
          ts += between(4, 40) * 1000;
          const add = between(600, 9_000);
          const out = Math.floor(between(150, 3800));
          const usage = rebuild
            ? { input_tokens: 4, output_tokens: out, cache_read_input_tokens: 0, cache_creation_input_tokens: Math.floor(ctx + add), cache_creation: { ephemeral_1h_input_tokens: Math.floor(ctx + add), ephemeral_5m_input_tokens: 0 } }
            : { input_tokens: 4, output_tokens: out, cache_read_input_tokens: Math.floor(ctx), cache_creation_input_tokens: Math.floor(add), cache_creation: { ephemeral_1h_input_tokens: Math.floor(add), ephemeral_5m_input_tokens: 0 } };
          usage.output_tokens_details = { thinking_tokens: Math.floor(out * between(0.1, 0.5)) };
          usage.service_tier = 'standard';
          rebuild = false;
          ctx += add;
          const last = k === steps - 1;
          const tool = last ? null : weighted([['Read', 30], ['Edit', 18], ['Bash', 18], ['Grep', 10], ['Glob', 4], ['Write', 6], ['Agent', 5], ['WebSearch', 2], ['WebFetch', 2], ['TodoWrite', 5]]);
          const msgId = 'msg_demo' + crypto.createHash('md5').update(sid + p + k).digest('hex').slice(0, 20);
          const content = [{ type: 'thinking', thinking: '', signature: 'demo' }];
          let input = {};
          const tuId = `toolu_demo_${sid.slice(0, 8)}_${tuN++}`;
          if (tool) {
            const file = `${cwd}/${pick(proj.files)}`;
            input = tool === 'Read' || tool === 'Edit' || tool === 'Write' ? { file_path: file }
              : tool === 'Bash' ? { command: pick(BASH) }
                : tool === 'Grep' ? { pattern: pick(['TODO', 'useEffect', 'fn render', 'def train', 'fetch(']), path: cwd }
                  : tool === 'Glob' ? { pattern: '**/*.ts' }
                    : tool === 'Agent' ? { subagent_type: pick(['scout', 'code-reviewer', 'test-runner', 'general-purpose']), description: 'Investigate', prompt: 'demo' }
                      : tool === 'WebSearch' ? { query: 'library changelog' } : tool === 'WebFetch' ? { url: 'https://example.com/docs' } : { todos: [] };
            content.push({ type: 'tool_use', id: tuId, name: tool, input });
          } else content.push({ type: 'text', text: 'Done.' });
          push({ ...base, type: 'assistant', requestId: 'req_' + msgId.slice(4), message: { id: msgId, type: 'message', role: 'assistant', model, content, stop_reason: tool ? 'tool_use' : 'end_turn', usage }, timestamp: new Date(ts).toISOString(), uuid: uuid(r) });
          calls++;
          if (tool) {
            const size = tool === 'Read' ? (r() < 0.08 ? between(40_000, 90_000) : between(1_500, 22_000))
              : tool === 'Bash' ? (input.command === 'git log' ? between(30_000, 60_000) : between(100, 4_000))
                : tool === 'Grep' ? between(300, 6_000) : between(80, 1_200);
            const text = FILLER.repeat(Math.max(1, Math.round(size / FILLER.length)));
            push({ ...base, type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: tuId, content: text }] }, timestamp: new Date(ts + 1500).toISOString(), uuid: uuid(r) });
            if (tool === 'Agent') {
              const subModel = r() < 0.55 ? model : 'claude-haiku-5-5';
              const subCalls = Math.floor(between(3, 12));
              let sctx = between(8_000, 20_000);
              for (let j = 0; j < subCalls; j++) {
                const sid2 = 'msg_demosub' + crypto.createHash('md5').update(sid + p + k + j).digest('hex').slice(0, 18);
                const sadd = between(1_000, 9_000);
                push({ ...base, type: 'assistant', isSidechain: true, requestId: 'req_' + sid2.slice(4), message: { id: sid2, model: subModel, role: 'assistant', content: [{ type: 'text', text: '…' }], usage: { input_tokens: 4, output_tokens: Math.floor(between(100, 1200)), cache_read_input_tokens: Math.floor(sctx), cache_creation_input_tokens: Math.floor(sadd), cache_creation: { ephemeral_5m_input_tokens: Math.floor(sadd), ephemeral_1h_input_tokens: 0 } } }, timestamp: new Date(ts + 2000 + j * 3000).toISOString(), uuid: uuid(r) });
                sctx += sadd;
                calls++;
              }
            }
          }
        }
      }
      const dir = path.join(root, enc);
      fs.mkdirSync(dir, { recursive: true });
      const body = lines.join('\n') + '\n';
      fs.writeFileSync(path.join(dir, `${sid}.jsonl`), body);
      bytes += body.length; sessions++;
    }
  }
  return { root, bytes, sessions, calls };
}
