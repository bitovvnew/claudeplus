import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cplus-v010-'));
process.env.CLAUDEPLUS_HOME = path.join(tmp, 'home');
process.env.CLAUDE_CONFIG_DIR = path.join(tmp, 'claude');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { LANGS, dict, t, normalizeLang } = await import('../src/i18n.js');
const { libraryList, packsList, parseFrontmatter, installPack, listAgents, setEnabled } = await import('../src/agents.js');
const { liveStats, buildReport } = await import('../src/analytics.js');
const { generateDemo } = await import('../src/demo.js');
const { scan } = await import('../src/scanner.js');
const { analyzeWaste } = await import('../src/waste.js');
const { render, THEMES } = await import('../src/statusline.js');
const { DEFAULTS } = await import('../src/config.js');

const en = JSON.parse(fs.readFileSync(path.join(ROOT, 'locales', 'en.json'), 'utf8'));
const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

test('every locale is complete and keeps placeholders', () => {
  assert.equal(Object.keys(LANGS).length, 17);
  for (const lang of Object.keys(LANGS)) {
    const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'locales', `${lang}.json`), 'utf8'));
    for (const k of Object.keys(en)) {
      assert.ok(k in raw, `${lang} is missing "${k}"`);
      assert.equal(placeholders(raw[k]), placeholders(en[k]), `${lang}:${k} placeholders differ`);
    }
    assert.equal(raw.days.split(',').length, 7, `${lang}: days must have 7 entries`);
  }
  assert.equal(t('de', 'tt.calls', { n: 3 }), '3 Aufrufe');
  assert.equal(dict('xx')['nav.overview'], 'Overview');
  assert.equal(normalizeLang('pt_BR.UTF-8'), 'pt');
});

test('library: 60+ agents with valid frontmatter, packs reference real agents', () => {
  const lib = libraryList();
  assert.ok(lib.length >= 90, `only ${lib.length} agents`);
  const ids = new Set();
  for (const a of lib) {
    assert.ok(!ids.has(a.id), `duplicate ${a.id}`); ids.add(a.id);
    const { data } = parseFrontmatter(a.content);
    assert.equal(data.name, a.id);
    assert.ok(data.description?.length > 30, `${a.id}: description too short`);
    assert.match(data.model, /^(haiku|sonnet|opus|inherit|fable)$/);
    const raw = a.content.match(/^description: (.*)$/m)[1];
    assert.ok(!/: /.test(raw) || raw.startsWith('"'), `${a.id}: unquoted description with ": " breaks YAML`);
  }
  for (const p of packsList()) for (const id of p.agents) assert.ok(ids.has(id), `pack ${p.id} references unknown agent ${id}`);
});

test('install a pack, then disable an agent', () => {
  const r = installPack('essentials');
  assert.equal(r.installed.length, 6);
  assert.equal(installPack('essentials').installed.length, 0, 'second install skips existing');
  setEnabled('scout', false);
  const scout = listAgents().find((a) => a.id === 'scout');
  assert.equal(scout.enabled, false);
  assert.ok(scout.file.includes('agents.disabled'));
});

test('5-hour blocks, burn rate, active block', () => {
  const now = Date.parse('2026-11-11T15:30:00');
  const tl = [
    [Date.parse('2026-11-11T08:10:00'), 1, 'a'],
    [Date.parse('2026-11-11T12:59:00'), 2, 'a'], // still inside the 08:00–13:00 block
    [Date.parse('2026-11-11T13:05:00'), 3, 'b'], // new block 13:00–18:00
    [Date.parse('2026-11-11T15:20:00'), 4, 'b'],
  ];
  const s = liveStats(tl, now);
  assert.equal(s.blocks.length, 2);
  assert.equal(s.blocks[0].cost, 7);
  assert.equal(s.blocks[1].cost, 3);
  assert.equal(s.activeBlock.cost, 7);
  assert.equal(s.activeBlock.left, Date.parse('2026-11-11T18:00:00') - now);
  assert.equal(s.burnRate, 4);
  assert.deepEqual(s.activeSessions, ['b']);
});

test('demo data → full pipeline', async () => {
  const dir = path.join(tmp, 'demo');
  const g = generateDemo(dir, { seed: 7 });
  assert.ok(g.sessions > 20 && g.calls > 1000);
  const { files } = await scan({ root: path.join(dir, 'projects') });
  const r = buildReport(files, {});
  assert.ok(r.totals.cost > 50);
  assert.ok(r.projects.length >= 4);
  assert.ok(r.blocks.length > 5);
  const w = analyzeWaste(files);
  const ids = w.findings.map((f) => f.id);
  for (const id of ['cache-rebuild', 'heavy-context', 'duplicate-reads']) assert.ok(ids.includes(id), `demo should show ${id}`);
  for (const f of w.findings) assert.ok(!t('en', `leak.${f.id}.detail`, f.params).includes('{'), `unfilled params in ${f.id}`);
});

test('statusline renders every theme', () => {
  const state = { sessions: { s: { cost: 3.5, ctx: 420_000, model: 'claude-opus-5-5', start: Date.now() - 36e5, days: {} } } };
  for (const theme of THEMES) {
    const cfg = structuredClone(DEFAULTS);
    cfg.statusline.theme = theme;
    const out = render({ session_id: 's', model: { id: 'claude-opus-5-5', display_name: 'Opus 5.5' }, __branch: 'main' }, state, cfg);
    const plain = out.replace(/\x1b\[[0-9;]*m/g, '');
    assert.ok(plain.includes('Opus 5.5') && plain.includes('$3.50') && plain.includes('42%'), `${theme}: ${plain}`);
  }
});
