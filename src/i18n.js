// Tiny i18n: locales/<lang>.json, English fallback, {param} interpolation.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './paths.js';

export const LOCALES_DIR = path.join(ROOT, 'locales');
export const LANGS = {
  en: 'English', ru: 'Русский', uk: 'Українська', es: 'Español', pt: 'Português', fr: 'Français', de: 'Deutsch', it: 'Italiano',
  pl: 'Polski', tr: 'Türkçe', zh: '中文', ja: '日本語', ko: '한국어', hi: 'हिन्दी', id: 'Bahasa Indonesia', vi: 'Tiếng Việt', kk: 'Қазақша',
};

const cache = new Map();
function raw(lang) {
  if (!cache.has(lang)) {
    try { cache.set(lang, JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${lang}.json`), 'utf8'))); } catch { cache.set(lang, {}); }
  }
  return cache.get(lang);
}

/** Full dictionary for a language with English fallback for any missing key. */
export function dict(lang) {
  return { ...raw('en'), ...(LANGS[lang] ? raw(lang) : {}) };
}

export function normalizeLang(l) {
  if (!l) return null;
  const s = String(l).toLowerCase().replace('_', '-').split(/[-.]/)[0];
  return LANGS[s] ? s : null;
}

/** Config lang → env (LANG, LC_ALL) → OS locale → en. */
export function detectLang(cfgLang) {
  return normalizeLang(cfgLang)
    || normalizeLang(process.env.CPLUS_LANG)
    || normalizeLang(process.env.LC_ALL)
    || normalizeLang(process.env.LANG)
    || normalizeLang(Intl.DateTimeFormat().resolvedOptions().locale)
    || 'en';
}

export function t(lang, key, params = {}) {
  const d = dict(lang);
  const s = d[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? `{${k}}`));
}
