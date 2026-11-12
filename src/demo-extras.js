// Seeds the demo environment with agents, guard events and a budget so every screen has content.
import fs from 'node:fs';
import path from 'node:path';
import { GUARD_LOG, ensureDir } from './paths.js';
import { installPack, installFromLibrary, setEnabled, setModel } from './agents.js';
import { loadConfig, saveConfig } from './config.js';
import { installSkill } from './skills.js';

export function seedDemoExtras() {
  for (const p of ['essentials', 'cost-saver']) { try { installPack(p); } catch {} }
  for (const id of ['ui-designer', 'nextjs-expert', 'sql-optimizer']) { try { installFromLibrary(id); } catch {} }
  for (const p of ['design-studio']) { try { installPack(p); } catch {} }
  try { setEnabled('refactorer', false); } catch {}
  for (const id of ['token-diet', 'human-grade-ui', 'spec-driven-dev', 'motion-design']) { try { installSkill(id); } catch {} }
  try { setModel('planner', 'opus'); } catch {}

  const cfg = loadConfig();
  cfg.budget = { daily: 60, monthly: 900 };
  saveConfig(cfg);

  ensureDir(path.dirname(GUARD_LOG));
  const now = Date.now();
  const ev = [
    ['dup-read', 'block', '/home/dev/code/acme-storefront/src/components/Cart.tsx'],
    ['noisy-shell', 'block', 'git log'],
    ['big-read', 'block', '/home/dev/code/ml-pipeline/data/train.csv'],
    ['dup-read', 'block', '/home/dev/code/rust-engine/src/render/mod.rs'],
    ['dup-read', 'allowed-retry', '/home/dev/code/rust-engine/src/render/mod.rs'],
    ['noisy-shell', 'block', 'ls -laR /home/dev/code'],
    ['dup-read', 'block', '/home/dev/code/acme-storefront/src/lib/api.ts'],
    ['big-read', 'block', '/home/dev/code/infra/terraform/terraform.tfstate'],
    ['noisy-shell', 'block', 'cat package-lock.json'],
    ['dup-read', 'block', '/home/dev/code/mobile-app/app/navigation.tsx'],
  ];
  fs.writeFileSync(GUARD_LOG, ev.map(([kind, mode, target], i) => JSON.stringify({ ts: now - (i + 1) * 47 * 60_000, sid: 'demo', tool: kind === 'noisy-shell' ? 'Bash' : 'Read', kind, mode, target })).join('\n') + '\n');
}
