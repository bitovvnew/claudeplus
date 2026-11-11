import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

// Isolate from the real ~/.claudeplus before any module reads config.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cplus-test-'));
process.env.CLAUDEPLUS_HOME = tmp;
process.env.CLAUDE_CONFIG_DIR = path.join(tmp, 'claude');

const { costOf, priceFor, canonicalModel, shortModel } = await import('../src/pricing.js');
const { parseFile, normUsage } = await import('../src/parser.js');
const { buildReport } = await import('../src/analytics.js');
const { analyzeWaste } = await import('../src/waste.js');
const { evaluate } = await import('../src/guard.js');
const { parseFrontmatter, setFrontmatterKey } = await import('../src/agents.js');
const { DEFAULTS } = await import('../src/config.js');

const here = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(here, 'fixtures', 'session.jsonl');
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('model ids are normalised', () => {
  assert.equal(canonicalModel('us.anthropic.claude-opus-4-8-20250101-v1:0'), 'claude-opus-4-8');
  assert.equal(canonicalModel('claude-sonnet-4-6[1m]'), 'claude-sonnet-4-6');
  assert.equal(canonicalModel('claude-opus-4-5@20251101'), 'claude-opus-4-5');
  assert.equal(priceFor('claude-opus-5-5').price.input, 4);
  assert.equal(priceFor('claude-opus-9-9').estimated, true);
  assert.equal(shortModel('claude-opus-5-5'), 'Opus 5.5');
});

test('cost formula: cache write 1h = 2x input, 5m = 1.25x, cache read from table', () => {
  const c = costOf('claude-opus-5-5', { in: 1e6, out: 1e6, cw5: 1e6, cw1h: 1e6, cr: 1e6 });
  close(c.input, 4); close(c.output, 20); close(c.cacheWrite, 4 * 1.25 + 4 * 2); close(c.cacheRead, 0.2);
  close(costOf('claude-opus-5-5', { out: 1e6, fast: 1 }).total, 40);
});

test('haiku 5.5 long-context surcharge above 100k prompt', () => {
  close(costOf('claude-haiku-5-5', { in: 50_000 }).total, 0.005);
  close(costOf('claude-haiku-5-5', { in: 200_000 }).total, 0.1);
});

test('usage: iterations win over zeroed top-level fields', () => {
  const u = normUsage({ input_tokens: 0, output_tokens: 0, iterations: [{ input_tokens: 2, output_tokens: 5, cache_read_input_tokens: 7, cache_creation: { ephemeral_1h_input_tokens: 3 } }] });
  assert.deepEqual([u.in, u.out, u.cr, u.cw1h, u.cw5], [2, 5, 7, 3, 0]);
});

test('parser merges split lines, counts prompts, tools and repeated reads', async () => {
  const { msgs, meta } = await parseFile(FIX);
  assert.equal(msgs.length, 3, 'msg_1 is written twice but must count once');
  const m1 = msgs.find((m) => m.id.startsWith('msg_1'));
  assert.equal(m1.out, 1000);
  assert.deepEqual(m1.tools, { Read: 1 });
  assert.equal(meta.title, 'Fixture session');
  assert.equal(meta.prompts, 1, 'slash-command noise is not a prompt');
  assert.equal(meta.reads['/work/demo/app.js'].n, 2);
  assert.equal(msgs.find((m) => m.model === 'claude-haiku-5-5').side, 1);
});

test('report totals and dedup across copied transcripts', async () => {
  const parsed = await parseFile(FIX);
  const file = { file: FIX, ...parsed };
  const copy = { file: FIX + '.copy', msgs: parsed.msgs.map((m) => ({ ...m, sid: 's-2' })), meta: { ...parsed.meta, sid: 's-2', firstTs: parsed.meta.firstTs + 1 } };
  const r = buildReport([copy, file]);
  const expected = parsed.msgs.reduce((a, m) => a + costOf(m.model, m).total, 0);
  close(r.totals.cost, expected, 1e-9);
  assert.equal(r.sessions.length, 1, 'copies are credited to the original session');
  assert.equal(r.sessions[0].sid, 's-1');
  assert.ok(r.totals.sideCost > 0);
  const w = analyzeWaste([file]);
  assert.ok(w.findings.some((f) => f.id === 'duplicate-reads'));
});

test('guard: duplicate read, huge read, noisy shell, clean commands', () => {
  const cfg = structuredClone(DEFAULTS);
  const state = { reads: {}, denied: {} };
  const read = { tool_name: 'Read', tool_input: { file_path: FIX } };
  assert.equal(evaluate(read, cfg, state), null);
  assert.equal(evaluate(read, cfg, state).kind, 'dup-read');
  assert.equal(evaluate({ tool_name: 'Read', tool_input: { file_path: FIX, offset: 1, limit: 2 } }, cfg, state), null);
  cfg.guard.maxReadBytes = 10;
  assert.equal(evaluate({ tool_name: 'Read', tool_input: { file_path: FIX } }, cfg, { reads: {}, denied: {} }).kind, 'big-read');
  const sh = (command, tool = 'Bash') => evaluate({ tool_name: tool, tool_input: { command } }, cfg, state)?.kind ?? null;
  assert.equal(sh('git log'), 'noisy-shell');
  assert.equal(sh('git log --oneline -20'), null);
  assert.equal(sh('ls -laR /'), 'noisy-shell');
  assert.equal(sh('ls -la'), null);
  assert.equal(sh('Get-ChildItem -Recurse C:\\', 'PowerShell'), 'noisy-shell');
  assert.equal(sh('Get-ChildItem -Recurse -Filter *.js src', 'PowerShell'), null);
  assert.equal(sh('cat package-lock.json'), 'noisy-shell');
  assert.equal(sh('npm test'), null);
  cfg.budget.daily = 5; cfg.guard.budgetStop = true;
  assert.equal(evaluate({ tool_name: 'Bash', tool_input: { command: 'ls' } }, cfg, state, 6).kind, 'budget');
});

test('agent frontmatter edit keeps the rest of the file intact', () => {
  const src = '---\nname: x\ndescription: does x\nmodel: opus\n---\n\nBody stays.\n';
  const out = setFrontmatterKey(src, 'model', 'haiku');
  assert.equal(out, src.replace('model: opus', 'model: haiku'));
  assert.equal(parseFrontmatter(setFrontmatterKey(src, 'color', 'blue')).data.color, 'blue');
  assert.equal(parseFrontmatter(out).body, '\nBody stays.\n');
});
