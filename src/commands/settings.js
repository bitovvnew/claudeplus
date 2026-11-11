import { loadConfig, saveConfig, setKey } from '../config.js';
import { PRICES } from '../pricing.js';
import { CONFIG_FILE } from '../paths.js';
import { c, table, usd } from '../ui.js';

export async function budget(args) {
  const cfg = loadConfig();
  if (args.daily !== undefined) cfg.budget.daily = +args.daily || 0;
  if (args.monthly !== undefined) cfg.budget.monthly = +args.monthly || 0;
  if (args.stop !== undefined) cfg.guard.budgetStop = args.stop !== 'false' && args.stop !== 'off';
  saveConfig(cfg);
  console.log(`\n  ${c.bold('Budget')}  daily ${cfg.budget.daily ? usd(cfg.budget.daily) : c.gray('none')}  ·  monthly ${cfg.budget.monthly ? usd(cfg.budget.monthly) : c.gray('none')}  ·  hard stop ${cfg.guard.budgetStop ? c.red('on') : c.gray('off')}`);
  console.log(c.gray('  cplus budget --daily 20 --monthly 300 [--stop on|off]\n'));
}

export async function config(args) {
  const [, key, value] = args._;
  if (key && value !== undefined) {
    setKey(key, value);
    console.log(c.green(`  ✓ ${key} = ${value}`));
    return;
  }
  const cfg = loadConfig();
  if (key) return console.log(JSON.stringify(key.split('.').reduce((o, k) => o?.[k], cfg), null, 2));
  console.log(c.gray(`  ${CONFIG_FILE}\n`));
  console.log(JSON.stringify(cfg, null, 2));
}

export async function lang(args) {
  const { LANGS, normalizeLang, detectLang } = await import('../i18n.js');
  const want = args._[1];
  if (want) {
    const code = normalizeLang(want);
    if (!code && want !== 'auto') throw new Error(`Unknown language "${want}". Available: ${Object.keys(LANGS).join(', ')}`);
    const cfg = loadConfig();
    cfg.lang = want === 'auto' ? '' : code;
    saveConfig(cfg);
    console.log(c.green(`  ✓ language: ${want === 'auto' ? 'auto (' + detectLang('') + ')' : LANGS[code]}`));
    return;
  }
  const cur = detectLang(loadConfig().lang);
  console.log(`\n  ${c.bold('Languages')} ${c.gray('— cplus lang <code> | auto')}\n`);
  for (const [k, v] of Object.entries(LANGS)) console.log(`  ${k === cur ? c.green('●') : c.gray('○')} ${k.padEnd(3)} ${v}`);
  console.log();
}

export async function prices() {
  const cfg = loadConfig();
  const rows = Object.entries({ ...PRICES, ...cfg.pricing }).map(([model, p]) => ({ model, ...p }));
  console.log(`\n  ${c.bold('Prices')} ${c.gray('$ per 1M tokens · cache write 5m = 1.25× input, 1h = 2× input · override in config "pricing"')}\n`);
  console.log(table(rows, [
    { label: 'model', get: (r) => r.model },
    { label: 'input', get: (r) => usd(r.input), align: 'right' },
    { label: 'output', get: (r) => usd(r.output), align: 'right' },
    { label: 'cache read', get: (r) => usd(r.cacheRead), align: 'right' },
    { label: 'cache write 5m', get: (r) => usd(r.input * 1.25), align: 'right' },
    { label: 'note', get: (r) => (r.longContext ? c.gray(`>${r.longContext.threshold / 1000}k prompt ×${r.longContext.mult}`) : '') },
  ]));
  console.log();
}
