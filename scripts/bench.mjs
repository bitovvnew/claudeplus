// Reproducible performance numbers on synthetic data.  node scripts/bench.mjs [--scale 8]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scale = +(process.argv[process.argv.indexOf('--scale') + 1] || 8) || 8;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cplus-bench-'));
process.env.CLAUDEPLUS_HOME = path.join(tmp, 'home');
process.env.CLAUDE_CONFIG_DIR = path.join(tmp, 'claude');

const { generateDemo } = await import('../src/demo.js');
const { scan } = await import('../src/scanner.js');
const { buildReport } = await import('../src/analytics.js');
const { analyzeWaste } = await import('../src/waste.js');

const time = async (fn) => { const t0 = performance.now(); const r = await fn(); return [performance.now() - t0, r]; };
const g = generateDemo(process.env.CLAUDE_CONFIG_DIR, { scale, seed: 1 });
const mb = g.bytes / 1e6;

const [cold] = await time(() => scan());
const [warm, res] = await time(() => scan());
const [rep] = await time(() => buildReport(res.files, {}));
const [wst] = await time(() => analyzeWaste(res.files));

// statusline + guard as Claude Code runs them: a fresh node process per call
const biggest = res.files.sort((a, b) => b.size - a.size)[0];
const bin = path.join(ROOT, 'bin', 'cplus.js');
const input = JSON.stringify({ session_id: 'bench', transcript_path: biggest.file, model: { id: 'claude-opus-5-5' } });
const proc = (args, stdin) => { const t0 = performance.now(); execFileSync(process.execPath, [bin, ...args], { input: stdin, stdio: ['pipe', 'ignore', 'ignore'] }); return performance.now() - t0; };
const slCold = proc(['statusline'], input);
const slWarm = Math.min(...Array.from({ length: 5 }, () => proc(['statusline'], input)));
const guard = Math.min(...Array.from({ length: 5 }, () => proc(['guard'], JSON.stringify({ session_id: 'b', tool_name: 'Read', tool_input: { file_path: bin } }))));
const nodeOnly = Math.min(...Array.from({ length: 5 }, () => { const t0 = performance.now(); execFileSync(process.execPath, ['-e', '0']); return performance.now() - t0; }));

const rows = [
  ['Transcripts', `${g.sessions} sessions · ${g.calls.toLocaleString('en-US')} API calls · ${mb.toFixed(0)} MB`],
  ['Cold scan (parse everything)', `${(cold / 1000).toFixed(2)} s  (${(mb / (cold / 1000)).toFixed(0)} MB/s)`],
  ['Warm scan (nothing changed)', `${warm.toFixed(0)} ms`],
  ['Full report (all aggregations)', `${rep.toFixed(0)} ms`],
  ['Leak analysis', `${wst.toFixed(0)} ms`],
  [`Statusline, first call (${(biggest.size / 1e6).toFixed(1)} MB transcript)`, `${slCold.toFixed(0)} ms`],
  ['Statusline, steady state', `${slWarm.toFixed(0)} ms  (bare node startup: ${nodeOnly.toFixed(0)} ms)`],
  ['Guard hook per tool call', `${guard.toFixed(0)} ms`],
];
console.log(`\nClaudePlus benchmark · Node ${process.versions.node} · ${os.cpus()[0].model.trim()} · ${os.platform()}\n`);
for (const [k, v] of rows) console.log(`  ${k.padEnd(46)} ${v}`);
fs.rmSync(tmp, { recursive: true, force: true });
