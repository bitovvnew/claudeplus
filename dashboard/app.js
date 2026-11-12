// ClaudePlus dashboard — vanilla JS, no dependencies, served from 127.0.0.1 only.
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = (() => { try { localStorage.setItem('cp.t', '1'); return localStorage; } catch { return null; } })();
const sget = (k) => { try { return store?.getItem(k); } catch { return null; } };
const sset = (k, v) => { try { store?.setItem(k, v); } catch {} };
const qs = new URLSearchParams(location.search);

/* ---------- i18n ---------- */
let L = {};
const t = (key, p = {}) => String(L[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => (p[k] ?? `{${k}}`));
function applyI18n() {
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  $$('[data-i18n-label]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nLabel)); });
  $$('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  document.documentElement.lang = S.lang;
}
async function loadLang(lang) {
  S.lang = lang;
  L = await fetch(`/i18n/${lang}.json`).then((r) => r.json()).catch(() => ({}));
  applyI18n();
  requestAnimationFrame(moveIndicator);
}

/* ---------- formatting ---------- */
const usd = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1000) return '$' + Math.round(n).toLocaleString('en-US');
  if (a >= 100) return '$' + n.toFixed(0);
  if (a >= 1) return '$' + n.toFixed(2);
  if (a >= 0.01) return '$' + n.toFixed(3);
  return n === 0 ? '$0' : '$' + n.toFixed(4);
};
const tickUsd = (n) => (n >= 1 ? '$' + (+n.toFixed(1)).toString() : usd(n));
const num = (n) => {
  const a = Math.abs(n || 0);
  if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(Math.round(n || 0));
};
const ago = (ts) => {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return t('time.now');
  if (s < 3600) return t('time.min', { n: Math.floor(s / 60) });
  if (s < 86400) return t('time.h', { n: Math.floor(s / 3600) });
  return t('time.d', { n: Math.floor(s / 86400) });
};
const hm = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`; };
const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '—');
const shortModel = (m) => {
  const x = String(m).match(/(fable|mythos|opus|sonnet|haiku)-(\d+(?:-\d+)?)/);
  return x ? `${x[1][0].toUpperCase()}${x[1].slice(1)} ${x[2].replace('-', '.')}` : m;
};
const shortTool = (n) => n.replace(/^mcp__[0-9a-f-]{20,}__/, 'mcp:').replace(/^mcp__/, 'mcp:');

// Color follows the entity (model id), never its rank.
const MODEL_SLOT = { 'claude-opus-5-5': 1, 'claude-sonnet-5-5': 2, 'claude-haiku-5-5': 3, 'claude-opus-4-8': 4, 'claude-mythos-5-2': 5, 'claude-sonnet-5': 6, 'claude-fable-5-2': 7, 'claude-opus-5': 8 };
const modelColor = (m) => {
  let slot = MODEL_SLOT[m];
  if (!slot) { let h = 0; for (const ch of String(m)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; slot = (h % 8) + 1; }
  return `var(--s${slot})`;
};
const SPLIT = [['cacheRead', 'split.cacheRead', 'var(--s1)'], ['cacheWrite', 'split.cacheWrite', 'var(--s7)'], ['output', 'split.output', 'var(--s2)'], ['input', 'split.input', 'var(--s3)'], ['web', 'split.web', 'var(--s4)']];

/* ---------- motion ---------- */
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = motionPreference.matches || qs.has('still');
motionPreference.addEventListener('change', (e) => { reduced = e.matches || qs.has('still'); });
if (qs.has('still')) document.documentElement.classList.add('still');
const ease = (t) => 1 - Math.pow(1 - t, 3);
/** Animate a number from its previous value to `to`, formatting every frame. */
function countUp(el, to, fmt = usd, suffix = '') {
  if (!el) return;
  el.classList.remove('skel');
  const from = +el.dataset.v || 0;
  el.dataset.v = to;
  cancelAnimationFrame(+el.dataset.raf || 0);
  if (reduced || !document.body.classList.contains('anim') || !isFinite(to) || from === to) { el.textContent = fmt(to) + suffix; return; }
  const t0 = performance.now(), dur = 750;
  const step = (now) => {
    const k = reduced ? 1 : Math.max(0, Math.min(1, (now - t0) / dur));
    el.textContent = fmt(from + (to - from) * ease(k)) + suffix;
    if (k < 1) el.dataset.raf = requestAnimationFrame(step);
  };
  el.dataset.raf = requestAnimationFrame(step);
}
/** Replay entrance animations only for user-driven renders (not the silent 30s refresh). */
function animateNext() {
  document.body.classList.remove('anim');
  void document.body.offsetWidth;
  document.body.classList.add('anim');
  clearTimeout(animateNext.t);
  animateNext.t = setTimeout(() => document.body.classList.remove('anim'), 2200);
}
function stagger(section) { $$('.tile, .card', section).forEach((el, i) => el.style.setProperty('--i', Math.min(i, 12))); }
function moveIndicator() {
  const nav = $('.tabs'), on = $('.tabs button.on');
  if (!nav || !on) return;
  let ind = $('.ind', nav);
  if (!ind) { ind = document.createElement('span'); ind.className = 'ind'; nav.prepend(ind); }
  ind.style.width = on.offsetWidth + 'px';
  ind.style.transform = `translateX(${on.offsetLeft}px)`;
}

/* ---------- api ---------- */
async function api(path, opts = {}) {
  const res = await fetch('/api/' + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'X-CPlus': '1', ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}
function toast(msg, err = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast on' + (err ? ' err' : '');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.className = 'toast'), 2600);
}

/* ---------- tooltip ---------- */
const tip = $('#tip');
function showTip(html, ev) {
  tip.innerHTML = html;
  tip.classList.add('on');
  const r = tip.getBoundingClientRect();
  let x = ev.clientX + 14, y = ev.clientY + 14;
  if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - 14;
  if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - 14;
  tip.style.left = Math.max(8, x) + 'px';
  tip.style.top = Math.max(8, y) + 'px';
}
const hideTip = () => tip.classList.remove('on');
document.addEventListener('scroll', hideTip, true);

/* ---------- state ---------- */
const S = { range: qs.get('range') || sget('cp.range') || '30d', project: '', tab: 'overview', data: null, sessSort: 'cost', lang: 'en', meta: {}, libCat: 'all' };

/* ---------- theme ---------- */
const applyTheme = (th) => { if (th) document.documentElement.dataset.theme = th; else delete document.documentElement.dataset.theme; };
applyTheme(qs.get('theme') || sget('cp.theme'));
$('#theme').onclick = () => {
  const cur = document.documentElement.dataset.theme;
  const dark = cur ? cur === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  const next = dark ? 'light' : 'dark';
  applyTheme(next); sset('cp.theme', next);
};

/* ---------- tabs ---------- */
function setTab(raw) {
  let [tab, arg] = String(raw || 'overview').split('/');
  if (!$(`#tab-${tab}`)) tab = 'overview';
  S.tab = tab;
  $$('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  $$('.tab').forEach((s) => s.classList.toggle('on', s.id === `tab-${tab}`));
  history.replaceState(null, '', location.search + '#' + raw);
  stagger($(`#tab-${tab}`));
  animateNext();
  requestAnimationFrame(moveIndicator);
  if (tab === 'agents') loadAgents();
  if (tab === 'settings') loadSettings();
  if (tab === 'leaks') loadGuardLog();
  if (tab === 'sessions' && arg) openSession(decodeURIComponent(arg));
}
$$('.tabs button').forEach((b) => (b.onclick = () => setTab(b.dataset.tab)));
addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h && h.split('/')[0] !== S.tab) setTab(h); });

$('#range').value = S.range;
$('#range').onchange = (e) => { S.range = e.target.value; sset('cp.range', S.range); load(false, true); };
$('#project').onchange = (e) => { S.project = e.target.value; load(false, true); };
$('#refresh').onclick = () => load(true, true);
async function changeLanguage(lang) {
  sset('cp.lang', lang);
  $('#lang').value = lang;
  await loadLang(lang);
  renderAll();
  if (S.tab === 'agents') await loadAgents();
  if (S.tab === 'leaks') await loadGuardLog();
  if (S.tab === 'settings') await loadSettings();
  const sid = location.hash.match(/^#sessions\/(.+)$/)?.[1];
  if (S.tab === 'sessions' && sid) await openSession(decodeURIComponent(sid));
}
$('#lang').onchange = (e) => changeLanguage(e.target.value);

/* ---------- load ---------- */
async function load(refresh = false, animate = false) {
  $('#refresh').textContent = '…';
  try {
    const q = new URLSearchParams({ since: S.range });
    if (S.project) q.set('project', S.project);
    if (refresh) q.set('refresh', '1');
    S.data = await api('report?' + q);
    if (animate) animateNext();
    renderAll();
  } catch (e) { toast(e.message, true); }
  finally { $('#refresh').textContent = '↻'; }
}

function setMeter(el, ratio) {
  el.classList.remove('hidden', 'warn', 'bad');
  if (ratio >= 1) el.classList.add('bad'); else if (ratio >= 0.8) el.classList.add('warn');
  $('i', el).style.width = Math.min(100, ratio * 100) + '%';
}

function renderAll() {
  if (!S.data) return;
  const { report: r, waste: w, today, month, config: cfg } = S.data;
  const tt = r.totals;

  const sel = $('#project');
  const cur = S.project;
  sel.innerHTML = `<option value="">${esc(t('proj.all'))}</option>` + r.projects.map((p) => `<option value="${esc(p.project)}">${esc(p.project)}</option>`).join('');
  if (cur && !r.projects.some((p) => p.project === cur)) sel.insertAdjacentHTML('beforeend', `<option value="${esc(cur)}">${esc(cur)}</option>`);
  sel.value = cur;

  countUp($('#t-total'), tt.cost);
  $('#t-total-sub').textContent = t('sub.calls', { calls: num(tt.msgs), sessions: tt.sessions });
  countUp($('#t-today'), today.cost);
  $('#t-today-sub').textContent = cfg.budget.daily ? t('sub.budgetDay', { pct: pct(today.cost, cfg.budget.daily), limit: usd(cfg.budget.daily) }) : t('sub.callsOnly', { calls: num(today.msgs) });
  if (cfg.budget.daily) setMeter($('#t-today-meter'), today.cost / cfg.budget.daily); else $('#t-today-meter').classList.add('hidden');
  countUp($('#t-month'), month.cost);
  $('#t-month-sub').textContent = cfg.budget.monthly ? t('sub.budgetMonth', { pct: pct(month.cost, cfg.budget.monthly), limit: usd(cfg.budget.monthly) }) : projectedMonth(month.cost);
  countUp($('#t-burn'), r.burnRate, usd, '/h');
  const ab = r.activeBlock;
  if (ab) countUp($('#t-block'), ab.cost); else { $('#t-block').textContent = '—'; $('#t-block').classList.remove('skel'); }
  $('#t-block-sub').textContent = ab ? t('sub.blockLeft', { left: hm(ab.left), calls: ab.calls }) + ` · → ${usd(ab.projected)}` : t('sub.idle');
  setMeter($('#t-block-meter'), ab ? 1 - ab.left / (5 * 36e5) : 0);
  $('#t-block-meter').classList.remove('warn', 'bad');
  countUp($('#t-prompt'), tt.prompts ? tt.cost / tt.prompts : 0);
  $('#t-prompt-sub').textContent = t('sub.prompts', { count: num(tt.prompts) });
  countUp($('#t-waste'), w.savings);
  $('#t-waste-sub').textContent = t('sub.savable', { pct: Math.round(w.pct * 100) + '%' });
  $('#live').classList.toggle('hidden', !r.activeSessions?.length);

  renderDaily(r);
  renderSplit(r);
  renderRows($('#models'), r.models.map((m) => ({ name: m.label + (m.estimated ? ' ~' : ''), value: m.cost, color: modelColor(m.model), tip: `<b>${esc(m.label)}</b><br>${usd(m.cost)} · ${t('tt.calls', { n: num(m.msgs) })}<br>${t('th.input')} ${num(m.in)} · ${t('th.output')} ${num(m.out)}<br>${t('th.cacheW5')} ${num(m.cw)} · ${t('th.cacheRead')} ${num(m.cr)}` })));
  renderRows($('#projects'), r.projects.slice(0, 12).map((p) => ({ name: p.project, value: p.cost, color: 'var(--s3)', tip: `<b>${esc(p.project)}</b><br>${usd(p.cost)} · ${t('tt.sessions', { n: p.sessions })}<br>${esc(p.path)}<br>${t('tt.last', { when: ago(p.lastTs) })}`, onClick: () => { S.project = p.project; load(); } })));
  renderHeat(r.heat);
  renderBlocks(r);
  renderSessions();
  renderTools(r);
  renderWaste(w);
}

function projectedMonth(spent) {
  const d = new Date();
  const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const elapsed = d.getDate() - 1 + d.getHours() / 24;
  return elapsed > 1 ? t('sub.forecast', { value: usd((spent / elapsed) * days) }) : '';
}

/* ---------- charts ---------- */
function renderRows(el, rows) {
  if (!rows.length) { el.innerHTML = `<div class="empty">${esc(t('empty'))}</div>`; return; }
  const max = Math.max(...rows.map((r) => r.value), 0) || 1;
  const total = rows.reduce((a, r) => a + r.value, 0);
  const animate = !reduced && document.body.classList.contains('anim');
  el.innerHTML = `<div class="rows">${rows.map((r, i) => `
    <div class="row" data-i="${i}" ${r.onClick ? 'style="cursor:pointer"' : ''}>
      <div class="name" title="${esc(r.name)}">${esc(r.name)}</div>
      <div class="track"><div class="fill" data-w="${(r.value / max) * 100}" style="width:${animate ? 0 : (r.value / max) * 100}%;background:${r.color};--d:${Math.min(i, 14) * 35}ms"></div></div>
      <div class="v">${r.label ?? usd(r.value)}${r.label ? '' : `<small>${pct(r.value, total)}</small>`}</div>
    </div>`).join('')}</div>`;
  if (animate) requestAnimationFrame(() => requestAnimationFrame(() => $$('.fill', el).forEach((f) => { f.style.width = f.dataset.w + '%'; })));
  $$('.row', el).forEach((row) => {
    const r = rows[+row.dataset.i];
    row.onmousemove = (e) => r.tip && showTip(r.tip, e);
    row.onmouseleave = hideTip;
    if (r.onClick) row.onclick = r.onClick;
  });
}

function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * p) return m * p;
  return 10 * p;
}

/** Generic vertical bar chart. items: [{ label, segs:[{v,color,name}], tip }] */
function barChart(el, items, { height = 240, valueFmt = tickUsd, aria = '' } = {}) {
  if (!items.length) { el.innerHTML = `<div class="empty">${esc(t('empty'))}</div>`; return; }
  const W = Math.max(el.clientWidth, 300), H = height, Lp = 52, R = 8, T = 10, B = 26;
  const iw = W - Lp - R, ih = H - T - B;
  const max = niceMax(Math.max(...items.map((d) => d.segs.reduce((a, s) => a + s.v, 0))));
  const bw = iw / items.length;
  const barW = Math.max(2, Math.min(28, bw - Math.max(2, bw * 0.25)));
  const y = (v) => T + ih - (v / max) * ih;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const labelEvery = Math.ceil(items.length / Math.max(2, Math.floor(iw / 64)));
  let svg = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="${esc(aria)}">`;
  svg += `<g class="axis">${ticks.map((v) => `<line class="gridline" x1="${Lp}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${Lp - 8}" y="${y(v) + 4}" text-anchor="end">${valueFmt(v)}</text>`).join('')}</g>`;
  items.forEach((d, i) => {
    const x = Lp + i * bw + (bw - barW) / 2;
    let acc = 0;
    const segs = d.segs.filter((z) => z.v > 0);
    segs.forEach((z, j) => {
      const gap = j > 0 ? 2 : 0;
      const y0 = y(acc) - gap, y1 = y(acc + z.v);
      const h = y0 - y1;
      if (h > 0.3) {
        const rr = j === segs.length - 1 ? Math.min(4, barW / 2, h) : 0;
        svg += `<path class="bar" data-i="${i}" style="--d:${Math.min(i * 18, 700)}ms" d="M${x},${y0} V${y1 + rr} q0,-${rr} ${rr},-${rr} H${x + barW - rr} q${rr},0 ${rr},${rr} V${y0} Z" fill="${z.color}"/>`;
      }
      acc += z.v;
    });
    if (i % labelEvery === 0) svg += `<text x="${x + barW / 2}" y="${H - 8}" text-anchor="middle" fill="var(--muted)" font-size="11">${esc(d.label)}</text>`;
    svg += `<rect class="hit" data-i="${i}" x="${Lp + i * bw}" y="${T}" width="${bw}" height="${ih}" fill="transparent"/>`;
  });
  svg += `<line class="baseline" x1="${Lp}" x2="${W - R}" y1="${T + ih}" y2="${T + ih}"/>`;
  svg += `<line class="cross" x1="0" x2="0" y1="${T}" y2="${T + ih}" stroke="var(--axis)" stroke-dasharray="3 3" visibility="hidden"/></svg>`;
  el.innerHTML = svg;
  const cross = $('.cross', el);
  $$('.hit', el).forEach((h) => {
    h.onmousemove = (e) => {
      const cx = +h.getAttribute('x') + bw / 2;
      cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
      $$('path.bar', el).forEach((p) => p.classList.toggle('hot', p.dataset.i === h.dataset.i));
      showTip(items[+h.dataset.i].tip, e);
    };
    h.onmouseleave = () => { hideTip(); cross.setAttribute('visibility', 'hidden'); $$('path.bar.hot', el).forEach((p) => p.classList.remove('hot')); };
  });
}

function renderDaily(r) {
  const days = r.days;
  const totals = {};
  for (const d of days) for (const [m, v] of Object.entries(d.byModel)) totals[m] = (totals[m] || 0) + v;
  const keys = Object.keys(totals).sort((a, b) => totals[b] - totals[a]);
  const shown = keys.slice(0, 4);
  const series = shown.map((k) => ({ key: k, label: shortModel(k), color: modelColor(k) }));
  if (keys.length > 4) series.push({ key: '__other', label: t('other'), color: 'var(--muted)' });
  const val = (d, k) => (k === '__other' ? Object.entries(d.byModel).filter(([m]) => !shown.includes(m)).reduce((a, [, v]) => a + v, 0) : d.byModel[k] || 0);
  $('#daily-legend').innerHTML = series.length > 1 ? series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.label)}</span>`).join('') : '';
  barChart($('#daily'), days.map((d) => {
    const dt = new Date(d.day + 'T12:00:00');
    const lines = series.map((s) => [s, val(d, s.key)]).filter(([, v]) => v > 0).map(([s, v]) => `<i style="background:${s.color}"></i>${esc(s.label)} <b>${usd(v)}</b>`);
    return {
      label: `${dt.getDate()}.${String(dt.getMonth() + 1).padStart(2, '0')}`,
      segs: series.map((s) => ({ v: val(d, s.key), color: s.color })),
      tip: `<div>${dt.toLocaleDateString(S.lang, { weekday: 'short', day: 'numeric', month: 'long' })}</div><div style="font-size:16px;font-weight:700">${usd(d.cost)}</div>${lines.join('<br>')}<div style="opacity:.7">${t('tt.calls', { n: num(d.msgs) })} · ${t('tt.tokens', { n: num(d.tokens) })}</div>`,
    };
  }), { aria: t('card.daily') });
}

function renderBlocks(r) {
  const list = [...(r.blocks || [])].slice(0, 30).reverse();
  const activeStart = r.activeBlock?.start;
  barChart($('#blocks'), list.map((b) => {
    const d = new Date(b.start);
    const active = b.start === activeStart;
    return {
      label: `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}h`,
      segs: [{ v: b.cost, color: active ? 'var(--s2)' : 'var(--s7)' }],
      tip: `<div>${d.toLocaleString(S.lang, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} → ${new Date(b.end).toLocaleTimeString(S.lang, { hour: '2-digit', minute: '2-digit' })}</div><div style="font-size:16px;font-weight:700">${usd(b.cost)}</div>${t('tt.calls', { n: b.calls })}${active ? `<br>● ${t('live')} · ${hm(r.activeBlock.left)} · → ${usd(r.activeBlock.projected)}` : ''}`,
    };
  }), { height: 200, aria: t('card.blocks') });
}

function renderSplit(r) {
  const total = r.totals.cost || 1;
  const parts = SPLIT.map(([k, key, color]) => ({ k, label: t(key), color, v: r.split[k] || 0 })).filter((p) => p.v > 0);
  const el = $('#split');
  el.innerHTML = `<div class="stack">${parts.map((p, i) => `<div data-i="${i}" style="flex:${p.v};background:${p.color}"></div>`).join('')}</div>`;
  const rowsEl = document.createElement('div');
  el.appendChild(rowsEl);
  renderRows(rowsEl, parts.map((p) => ({ name: p.label, value: p.v, color: p.color, tip: `<b>${esc(p.label)}</b><br>${usd(p.v)} · ${pct(p.v, total)}` })));
  $$('.stack > div', el).forEach((seg) => {
    const p = parts[+seg.dataset.i];
    seg.onmousemove = (e) => showTip(`<b>${esc(p.label)}</b><br>${usd(p.v)} · ${pct(p.v, total)}`, e);
    seg.onmouseleave = hideTip;
  });
  const { cr, cw, in: inp } = r.totals;
  const hit = cr / (cr + cw + inp || 1);
  const note = document.createElement('p');
  note.className = 'muted small';
  note.textContent = t(hit > 0.9 ? 'split.hitGood' : 'split.hitBad', { pct: Math.round(hit * 100) + '%' });
  el.appendChild(note);
}

function renderHeat(heat) {
  const days = t('days').split(',');
  const max = Math.max(...heat.flat(), 0);
  const step = (v) => (v <= 0 ? 0 : Math.min(5, 1 + Math.floor((v / max) * 4.999)));
  let h = '<div class="heat"><span></span>';
  for (let i = 0; i < 24; i++) h += `<span class="h">${i % 3 === 0 ? i : ''}</span>`;
  heat.forEach((row, d) => {
    h += `<span>${esc(days[d] || '')}</span>`;
    row.forEach((v, hr) => { h += `<div class="c" data-d="${d}" data-h="${hr}" style="background:var(--seq-${step(v)});--d:${(d + hr) * 22}ms"></div>`; });
  });
  $('#heat').innerHTML = h + '</div>';
  $$('.heat .c').forEach((c) => {
    c.onmousemove = (e) => showTip(`${esc(days[+c.dataset.d])}, ${c.dataset.h}:00–${+c.dataset.h + 1}:00<br><b>${usd(heat[+c.dataset.d][+c.dataset.h])}</b>`, e);
    c.onmouseleave = hideTip;
  });
}

/* ---------- sessions ---------- */
$('#s-search').oninput = () => renderSessions();
function renderSessions() {
  if (!S.data) return;
  const q = $('#s-search').value.toLowerCase();
  let list = S.data.report.sessions.filter((s) => !q || `${s.title} ${s.project} ${s.sid}`.toLowerCase().includes(q));
  const sorters = { cost: (a, b) => b.cost - a.cost, last: (a, b) => b.lastTs - a.lastTs, ppp: (a, b) => (b.costPerPrompt || 0) - (a.costPerPrompt || 0), ctx: (a, b) => b.maxCtx - a.maxCtx };
  list = list.sort(sorters[S.sessSort]);
  const max = Math.max(...list.map((s) => s.cost), 0) || 1;
  const arrow = (k) => (S.sessSort === k ? ' ▾' : '');
  $('#sessions').innerHTML = !list.length ? `<div class="empty">${esc(t('empty'))}</div>` : `<table>
    <thead><tr><th>${t('th.session')}</th><th>${t('th.project')}</th><th class="num sort" data-s="cost">${t('th.cost')}${arrow('cost')}</th><th></th><th class="num">${t('th.prompts')}</th><th class="num sort" data-s="ppp">${t('th.perPrompt')}${arrow('ppp')}</th><th class="num sort" data-s="ctx">${t('th.peakCtx')}${arrow('ctx')}</th><th class="sort" data-s="last">${t('th.when')}${arrow('last')}</th></tr></thead>
    <tbody>${list.slice(0, 300).map((s) => `<tr class="click" data-sid="${esc(s.sid)}">
      <td><div class="t" title="${esc(s.title)}">${esc(s.title)}</div><span class="muted small">${esc(String(s.sid).slice(0, 8))} · ${Object.keys(s.models).map(shortModel).join(', ')}</span></td>
      <td>${esc(s.project)}</td>
      <td class="num"><b>${usd(s.cost)}</b></td>
      <td style="width:120px"><div class="minibar" style="width:${(s.cost / max) * 100}%"></div></td>
      <td class="num">${s.prompts}</td>
      <td class="num">${s.costPerPrompt != null ? usd(s.costPerPrompt) : '—'}</td>
      <td class="num">${num(s.maxCtx)}</td>
      <td class="muted small" style="white-space:nowrap">${ago(s.lastTs)}</td></tr>`).join('')}</tbody></table>`;
  $$('#sessions th.sort').forEach((th) => (th.onclick = () => { S.sessSort = th.dataset.s; renderSessions(); }));
  $$('#sessions tr.click').forEach((tr) => (tr.onclick = () => openSession(tr.dataset.sid)));
}

async function openSession(sid) {
  const el = $('#s-detail');
  el.classList.remove('hidden');
  el.innerHTML = `<div class="empty">${esc(t('loading'))}</div>`;
  history.replaceState(null, '', location.search + '#sessions/' + encodeURIComponent(sid));
  try {
    const d = await api('session/' + encodeURIComponent(sid));
    const s = d.report.sessions[0];
    if (!s) { el.innerHTML = `<div class="empty">${esc(t('sess.notFound'))}</div>`; return; }
    el.innerHTML = `
      <div class="card-h"><h2>${esc(s.title)}</h2><button class="icon" id="s-close" aria-label="Close">✕</button></div>
      <div class="kv">
        <div><b>${usd(s.cost)}</b><span>${t('sess.cost')}</span></div>
        <div><b>${s.prompts}</b><span>${t('sess.prompts')}</span></div>
        <div><b>${s.costPerPrompt != null ? usd(s.costPerPrompt) : '—'}</b><span>${t('sess.perPrompt')}</span></div>
        <div><b>${num(s.maxCtx)}</b><span>${t('sess.peak')}</span></div>
        <div><b>${usd(s.sideCost)}</b><span>${t('sess.sub')}</span></div>
        <div><b>${s.msgs}</b><span>${t('sess.calls')}</span></div>
      </div>
      <p class="muted small">${esc(s.project)} · ${esc(s.cwd)} · ${s.branch ? '⎇ ' + esc(s.branch) + ' · ' : ''}${new Date(s.firstTs).toLocaleString(S.lang)} → ${new Date(s.lastTs).toLocaleString(S.lang)} · <code>claude --resume ${esc(s.sid)}</code></p>
      <h3 class="small muted" style="margin:14px 0 6px">${t('sess.ctxTitle')}</h3>
      <div id="s-timeline" class="chart"></div>
      <div class="grid2" style="margin-top:12px">
        <div><h3 class="small muted" style="margin:0 0 8px">${t('sess.tools')}</h3><div id="s-tools"></div></div>
        <div><h3 class="small muted" style="margin:0 0 8px">${t('sess.leaks')}</h3><div id="s-leaks"></div></div>
      </div>`;
    $('#s-close').onclick = () => { el.classList.add('hidden'); history.replaceState(null, '', location.search + '#sessions'); };
    renderTimeline($('#s-timeline'), d.timeline);
    renderRows($('#s-tools'), d.report.tools.filter((x) => x.calls).slice(0, 10).map((x) => ({ name: shortTool(x.tool), value: x.cost, color: 'var(--s2)', tip: `<b>${esc(x.tool)}</b><br>${t('tt.calls', { n: x.calls })} · ${usd(x.cost)}<br>${t('th.outCtx')} ≈ ${num(x.resultTokens)}` })));
    const leaks = d.waste.findings.filter((f) => f.savings > 0.001);
    $('#s-leaks').innerHTML = leaks.length ? leaks.map((f) => `<div class="row" style="grid-template-columns:1fr auto"><div class="name">${esc(t(`leak.${f.id}.title`, f.params))}</div><div class="v">${usd(f.savings)}</div></div>`).join('') : `<div class="muted small">${t('sess.clean')}</div>`;
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  } catch (e) { el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}

function renderTimeline(el, points) {
  const pts = points.filter((p) => !p.side);
  if (pts.length < 2) { el.innerHTML = `<div class="muted small">${esc(t('empty'))}</div>`; return; }
  const W = Math.max(el.clientWidth, 300), H = 170, Lp = 52, R = 8, T = 8, B = 20;
  const iw = W - Lp - R, ih = H - T - B;
  const max = niceMax(Math.max(...pts.map((p) => p.ctx)));
  const x = (i) => Lp + (i / (pts.length - 1)) * iw;
  const y = (v) => T + ih - (v / max) * ih;
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.ctx).toFixed(1)}`).join('');
  const ticks = [0, 0.5, 1].map((f) => f * max);
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}">
    <g class="axis">${ticks.map((v) => `<line class="gridline" x1="${Lp}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${Lp - 8}" y="${y(v) + 4}" text-anchor="end">${num(v)}</text>`).join('')}</g>
    ${max >= 200000 ? `<line x1="${Lp}" x2="${W - R}" y1="${y(200000)}" y2="${y(200000)}" stroke="var(--serious)" stroke-dasharray="4 4"/><text x="${W - R}" y="${y(200000) - 4}" text-anchor="end" font-size="10" fill="var(--ink-2)">200k</text>` : ''}
    <path class="area" d="${d}L${x(pts.length - 1)},${T + ih}L${Lp},${T + ih}Z" fill="var(--s1)" opacity=".12"/>
    <path class="line" pathLength="1" d="${d}" fill="none" stroke="var(--s1)" stroke-width="2" stroke-linejoin="round"/>
    <line class="baseline" x1="${Lp}" x2="${W - R}" y1="${T + ih}" y2="${T + ih}"/>
    <circle class="dot" r="4" fill="var(--s1)" stroke="var(--surface)" stroke-width="2" visibility="hidden"/>
    <rect class="hit" x="${Lp}" y="${T}" width="${iw}" height="${ih}" fill="transparent"/>
  </svg>`;
  const hit = $('.hit', el), dot = $('.dot', el);
  hit.onmousemove = (e) => {
    const rect = hit.getBoundingClientRect();
    const i = Math.max(0, Math.min(pts.length - 1, Math.round(((e.clientX - rect.left) / rect.width) * (pts.length - 1))));
    const p = pts[i];
    dot.setAttribute('cx', x(i)); dot.setAttribute('cy', y(p.ctx)); dot.setAttribute('visibility', 'visible');
    const tools = Object.entries(p.tools).map(([k, v]) => `${esc(shortTool(k))}${v > 1 ? ' ×' + v : ''}`).join(', ');
    showTip(`${new Date(p.ts).toLocaleTimeString(S.lang)} · ${shortModel(p.model)}<br>${t('sess.peak')}: <b>${num(p.ctx)}</b> · ${t('th.output')} ${num(p.out)}${tools ? '<br>' + tools : ''}`, e);
  };
  hit.onmouseleave = () => { hideTip(); dot.setAttribute('visibility', 'hidden'); };
}

/* ---------- tools ---------- */
function renderTools(r) {
  const list = r.tools;
  const max = Math.max(...list.map((x) => x.cost), 0) || 1;
  $('#tools').innerHTML = `<table><thead><tr><th>${t('th.tool')}</th><th class="num">${t('th.calls')}</th><th class="num">${t('th.cost')}</th><th></th><th class="num">${t('th.perCall')}</th><th class="num">${t('th.outCtx')}</th></tr></thead><tbody>
    ${list.map((x) => `<tr><td><div class="t" title="${esc(x.tool)}">${esc(shortTool(x.tool))}</div></td><td class="num">${num(x.calls)}</td><td class="num"><b>${usd(x.cost)}</b></td><td style="width:140px"><div class="minibar" style="width:${(x.cost / max) * 100}%;background:var(--s1)"></div></td><td class="num">${usd(x.calls ? x.cost / x.calls : 0)}</td><td class="num">${num(x.resultTokens)}</td></tr>`).join('')}
  </tbody></table>`;
  $('#side-total').textContent = t('side.total', { cost: usd(r.totals.sideCost), pct: pct(r.totals.sideCost, r.totals.cost) });
  renderRows($('#spawned'), r.agents.map((a) => ({ name: a.type, value: a.spawned, label: `${a.spawned}×`, color: 'var(--s7)', tip: `<b>${esc(a.type)}</b><br>${a.spawned}×` })));
}

/* ---------- waste ---------- */
const SEV = { high: 'var(--critical)', medium: 'var(--serious)', low: 'var(--warning)', info: 'var(--muted)' };
const codeify = (s) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/(\/compact|\/clear|\/effort \w+|cplus [\w -]+?(?=[).,:]|$))/g, '<code>$1</code>');
function renderWaste(w) {
  countUp($('#w-score'), w.score, (n) => String(Math.round(n)));
  setMeter($('#w-score-meter'), w.score / 100);
  $('#w-score-meter').classList.remove('warn', 'bad');
  if (w.score < 60) $('#w-score-meter').classList.add('bad'); else if (w.score < 80) $('#w-score-meter').classList.add('warn');
  countUp($('#w-save'), w.savings);
  $('#w-pct').textContent = t('w.pctOf', { pct: Math.round(w.pct * 100) + '%', total: usd(w.total) });
  $('#findings').innerHTML = w.findings.map((f) => `
    <div class="card finding">
      <span class="sev" style="background:${SEV[f.severity]}"></span>
      <h3>${esc(t(`leak.${f.id}.title`, f.params))}<span class="sevlabel">● ${esc(t('sev.' + f.severity))}</span></h3>
      <div class="save">${f.savings ? usd(f.savings) : ''}</div>
      <div class="body">${esc(t(`leak.${f.id}.detail`, f.params))}</div>
      <div class="advice">${codeify(t(`leak.${f.id}.advice`, f.params))}</div>
      ${f.examples?.length ? `<ul>${f.examples.slice(0, 6).map((e) => `<li>${esc(e.what)}${e.times ? ` ×${e.times}` : ''}${e.cost ? ` — <b>${usd(e.cost)}</b>` : ''}${e.session ? ` <span class="muted">[${esc(String(e.session).slice(0, 40))}]</span>` : ''}</li>`).join('')}</ul>` : ''}
    </div>`).join('') || `<div class="card empty">${esc(t('w.none'))}</div>`;
}

async function loadGuardLog() {
  try {
    const { events } = await api('guard-log?n=200');
    countUp($('#w-guard'), events.filter((e) => e.mode === 'block' || e.mode === 'warn').length, (n) => String(Math.round(n)));
    $('#guardlog').innerHTML = events.length ? `<table><thead><tr><th>${t('th.when')}</th><th>${t('th.what')}</th><th>${t('th.action')}</th><th>${t('th.target')}</th></tr></thead><tbody>
      ${events.slice(0, 100).map((e) => `<tr><td class="muted small" style="white-space:nowrap">${ago(e.ts)}</td><td>${esc(t('kind.' + e.kind))}</td><td><span class="pill">${esc(e.mode)}</span></td><td><div class="t small" title="${esc(e.target)}">${esc(e.target || '')}</div></td></tr>`).join('')}
    </tbody></table>` : `<div class="empty">${esc(t('guard.empty'))}</div>`;
  } catch (e) { toast(e.message, true); }
}

/* ---------- agents ---------- */
let MODELS = ['inherit', 'haiku', 'sonnet', 'opus', 'fable'];
async function loadAgents() {
  try {
    const [{ agents, models }, { library }, { packs }, sk] = await Promise.all([api('agents'), api('library'), api('packs'), api('skills')]);
    MODELS = models;
    renderAgents(agents);
    renderLibrary(library);
    renderPacks(packs);
    renderSkills(sk);
  } catch (e) { toast(e.message, true); }
}
const modelClass = (m) => 'model-' + (['opus', 'fable', 'sonnet', 'haiku'].find((f) => String(m).includes(f)) || 'x');

function renderPacks(packs) {
  $('#packs').innerHTML = packs.map((p, i) => `
    <div class="pack" data-i="${i}">
      <b>${esc(p.name)}</b>
      <p>${esc(p.description)}</p>
      <div class="row2"><span class="muted small">${p.installedCount}/${p.agents.length}</span><span class="grow"></span>
      ${p.installedCount === p.agents.length ? `<span class="pill">${esc(t('ag.installed'))}</span>` : `<button class="btn sm">${esc(t('ag.installPack'))}</button>`}</div>
    </div>`).join('');
  $$('#packs .pack').forEach((el) => {
    const p = packs[+el.dataset.i];
    const b = $('button', el);
    if (b) b.onclick = async () => {
      try { const r = await api('packs/' + encodeURIComponent(p.id), { method: 'POST', body: { scope: 'user' } }); toast(t('ag.packInstalled', { n: r.installed.length })); loadAgents(); } catch (e) { toast(e.message, true); }
    };
  });
}

function renderSkills({ skills, library }) {
  const mine = new Map(skills.map((s) => [s.id, s]));
  $('#skills').innerHTML = library.map((s, i) => {
    const own = mine.get(s.id);
    const ctl = own
      ? `<button class="switch ${own.enabled ? 'on' : ''}" data-act="toggle" role="switch" aria-checked="${own.enabled}" aria-label="${esc(s.id)}"></button>`
      : `<button class="btn sm" data-act="add">${esc(t('ag.add'))}</button>`;
    return `<div class="pack" data-i="${i}"><b>${esc(s.id)} <span class="muted small" style="font-weight:400">${esc(s.category)}</span></b><p>${esc(s.description)}</p><div class="row2"><span class="muted small">${esc(t('ag.tokens', { n: s.estTokens }))}</span><span class="grow"></span>${ctl}</div></div>`;
  }).join('');
  $$('#skills .pack').forEach((el) => {
    const s = library[+el.dataset.i];
    const own = mine.get(s.id);
    const add = $('[data-act=add]', el), tog = $('[data-act=toggle]', el);
    if (add) add.onclick = async () => { try { await api('skills/install/' + encodeURIComponent(s.id), { method: 'POST', body: { scope: 'user' } }); toast(t('ag.installedToast', { id: s.id })); loadAgents(); } catch (e) { toast(e.message, true); } };
    if (tog) tog.onclick = async () => { try { const r = await api(`skills/${own.scope}/${encodeURIComponent(s.id)}/toggle`, { method: 'POST' }); toast(t(r.enabled ? 'ag.on' : 'ag.off', { id: s.id })); loadAgents(); } catch (e) { toast(e.message, true); } };
  });
}

function renderAgents(agents) {
  const el = $('#agents');
  if (!agents.length) { el.innerHTML = `<div class="empty">${esc(t('ag.empty'))}</div>`; return; }
  el.innerHTML = agents.map((a, i) => `
    <div class="agent ${a.enabled ? '' : 'off'}" data-i="${i}">
      <button class="switch ${a.enabled ? 'on' : ''}" data-act="toggle" role="switch" aria-checked="${a.enabled}" aria-label="${esc(a.id)}"></button>
      <div style="min-width:0">
        <div class="name">${esc(a.id)}</div>
        <div class="desc">${esc(a.description)}</div>
        <div class="meta"><span class="pill">${a.scope}</span><span class="pill">${a.tools.length ? esc(a.tools.join(', ')) : esc(t('ag.allTools'))}</span><span class="pill">${esc(t('ag.tokens', { n: a.estTokens }))}</span></div>
      </div>
      <div class="acts">
        <select data-act="model" class="${modelClass(a.model)}" aria-label="Model">${[...new Set([...MODELS, a.model])].map((m) => `<option ${m === a.model ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select>
        <button class="btn ghost sm" data-act="edit">${esc(t('ag.edit'))}</button>
        <button class="btn danger sm" data-act="rm" aria-label="Delete">✕</button>
      </div>
    </div>`).join('');
  $$('.agent', el).forEach((row) => {
    const a = agents[+row.dataset.i];
    const path = `agents/${a.scope}/${encodeURIComponent(a.id)}`;
    $('[data-act=toggle]', row).onclick = async () => {
      try { const r = await api(path + '/toggle', { method: 'POST' }); toast(t(r.enabled ? 'ag.on' : 'ag.off', { id: a.id })); loadAgents(); } catch (e) { toast(e.message, true); }
    };
    $('[data-act=model]', row).onchange = async (e) => {
      try { await api(path + '/model', { method: 'POST', body: { model: e.target.value } }); toast(`${a.id} → ${e.target.value}`); loadAgents(); } catch (er) { toast(er.message, true); }
    };
    $('[data-act=edit]', row).onclick = async () => {
      try { const full = await api(path); openEditor({ id: a.id, scope: a.scope, content: full.content, existing: true }); } catch (e) { toast(e.message, true); }
    };
    $('[data-act=rm]', row).onclick = async () => {
      if (!confirm(t('ag.confirmRm', { id: a.id }))) return;
      try { await api(path, { method: 'DELETE' }); toast(t('ag.trashed')); loadAgents(); } catch (e) { toast(e.message, true); }
    };
  });
}

function renderLibrary(lib) {
  const cats = ['all', ...new Set(lib.map((a) => a.category))];
  $('#lib-count').textContent = t('ag.count', { n: lib.length });
  $('#lib-cats').innerHTML = cats.map((c) => `<button class="chip ${S.libCat === c ? 'on' : ''}" data-c="${esc(c)}">${esc(c === 'all' ? t('ag.all') : c)}</button>`).join('');
  $$('#lib-cats .chip').forEach((b) => (b.onclick = () => { S.libCat = b.dataset.c; renderLibrary(lib); }));
  const shown = lib.filter((a) => S.libCat === 'all' || a.category === S.libCat);
  let last = null;
  $('#library').innerHTML = shown.map((a) => {
    const head = a.category !== last ? `<div class="cat">${esc(a.category)}</div>` : '';
    last = a.category;
    return `${head}<div class="agent" data-id="${esc(a.id)}" style="grid-template-columns:1fr auto">
      <div style="min-width:0"><div class="name">${esc(a.id)} <span class="small ${modelClass(a.model)}">${esc(a.model)}</span></div><div class="desc">${esc(a.description)}</div></div>
      <div class="acts">${a.installed ? `<span class="pill">${esc(t('ag.installed'))}</span>` : `<button class="btn sm" data-act="add">${esc(t('ag.add'))}</button>`}<button class="btn ghost sm" data-act="view">${esc(t('ag.view'))}</button></div>
    </div>`;
  }).join('');
  $$('#library .agent').forEach((row) => {
    const a = lib.find((x) => x.id === row.dataset.id);
    const add = $('[data-act=add]', row);
    if (add) add.onclick = async () => { try { await api('library/' + encodeURIComponent(a.id), { method: 'POST', body: { scope: 'user' } }); toast(t('ag.installedToast', { id: a.id })); loadAgents(); } catch (e) { toast(e.message, true); } };
    $('[data-act=view]', row).onclick = () => openEditor({ id: a.id, scope: 'user', content: a.content, existing: false, fromLibrary: true });
  });
}

const dlg = $('#editor');
function openEditor({ id = '', scope = 'user', content, existing, fromLibrary }) {
  $('#ed-title').textContent = existing ? t('ed.title', { id }) : fromLibrary ? t('ed.lib', { id }) : t('ed.new');
  $('#ed-id').value = id;
  $('#ed-id').readOnly = !!existing;
  $('#ed-scope').value = scope;
  $('#ed-scope').disabled = !!existing;
  $('#ed-content').value = content;
  const m = content.match(/^model:\s*(.+)$/m)?.[1]?.trim() || 'inherit';
  $('#ed-model').innerHTML = [...new Set([...MODELS, m])].map((x) => `<option ${x === m ? 'selected' : ''}>${esc(x)}</option>`).join('');
  dlg.showModal();
}
$('#ed-model').onchange = (e) => {
  const ta = $('#ed-content');
  ta.value = /^model:.*$/m.test(ta.value) ? ta.value.replace(/^model:.*$/m, `model: ${e.target.value}`) : ta.value.replace(/^---\n/, `---\nmodel: ${e.target.value}\n`);
};
$('#ed-save').onclick = async (e) => {
  e.preventDefault();
  const id = $('#ed-id').value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) return toast(t('ed.badName'), true);
  try {
    await api(`agents/${$('#ed-scope').value}/${encodeURIComponent(id)}`, { method: 'PUT', body: { content: $('#ed-content').value } });
    dlg.close(); toast(t('ag.saved')); loadAgents();
  } catch (er) { toast(er.message, true); }
};
$('#a-new').onclick = async () => {
  const { content } = await api('template', { method: 'POST', body: { name: 'my-agent', model: 'sonnet' } });
  openEditor({ id: 'my-agent', content, existing: false });
};
$('#ed-id').oninput = (e) => {
  if ($('#ed-id').readOnly) return;
  const ta = $('#ed-content');
  ta.value = ta.value.replace(/^name:.*$/m, `name: ${e.target.value}`);
};

/* ---------- settings ---------- */
const SL_TONE = { accent: ['#9085e9', '#6250d6'], good: ['#0ca30c', '#1f6b3a'], warn: ['#fab219', '#8a6a10'], info: ['#3fb6c9', '#1d5876'], plain: ['#f0efec', '#444'], muted: ['#898781', '#303030'] };
const SL_SAMPLE = [['model', 'accent', '', 'Opus 5.5', '🧠'], ['context', 'good', '', '▰▰▰▱▱▱▱▱ 38% 384k', '📦'], ['session', 'plain', 'session ', '$4.12', '💸'], ['today', 'good', 'today ', '$23.40/$60', '📅'], ['burn', 'warn', '', '$2.06/h', '🔥'], ['branch', 'info', '', 'main', '🌿']];
function slPreview(theme) {
  const span = (txt, fg, bg) => `<span style="color:${fg};${bg ? `background:${bg};` : ''}">${esc(txt)}</span>`;
  if (theme === 'minimal') return span(SL_SAMPLE.map((s) => s[2] + s[3]).join(' · '), '#898781');
  if (theme === 'emoji') return SL_SAMPLE.map((s) => `${s[4]} ${span(s[3], SL_TONE[s[1]][0])}`).join('  ');
  if (theme === 'capsule' || theme === 'powerline') {
    return SL_SAMPLE.map((s, i) => {
      const bg = SL_TONE[s[1]][1];
      const icon = s[0] === 'model' ? '◆ ' : s[0] === 'branch' ? '⎇ ' : '';
      const body = span(` ${icon}${s[2]}${s[3]} `, '#fff', bg);
      if (theme === 'capsule') return body + (i < SL_SAMPLE.length - 1 ? ' ' : '');
      const next = SL_SAMPLE[i + 1];
      return body + span('▶', bg, next ? SL_TONE[next[1]][1] : null);
    }).join('');
  }
  return SL_SAMPLE.map((s) => s[0] === 'model' ? span('◆ ', '#9085e9') + span(s[3], '#fff') : s[0] === 'branch' ? span('⎇ ' + s[3], '#3fb6c9') : (s[2] ? span(s[2], '#898781') : '') + span(s[3], SL_TONE[s[1]][0])).join(span(' │ ', '#555'));
}

async function loadSettings() {
  try {
    const [integ, { config, prices }, meta] = await Promise.all([api('integration'), api('config'), api('meta')]);
    S.config = config;
    renderIntegration(integ);
    const g = $('#general');
    g.lang.innerHTML = `<option value="">auto (${esc(meta.langs[meta.lang] || meta.lang)})</option>` + Object.entries(meta.langs).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
    g.lang.value = config.lang || '';
    g.theme.innerHTML = meta.themes.map((th) => `<option>${th}</option>`).join('');
    g.theme.value = config.statusline.theme || 'classic';
    $('#slpreview').innerHTML = slPreview(g.theme.value);
    g.theme.onchange = () => { $('#slpreview').innerHTML = slPreview(g.theme.value); };
    const b = $('#budget');
    b.daily.value = config.budget.daily || '';
    b.monthly.value = config.budget.monthly || '';
    b.budgetStop.checked = !!config.guard.budgetStop;
    const gd = $('#guard');
    gd.mode.value = config.guard.mode;
    gd.dedupeReads.checked = !!config.guard.dedupeReads;
    gd.noisyBash.checked = !!config.guard.noisyBash;
    gd.maxReadKb.value = Math.round(config.guard.maxReadBytes / 1024);
    const all = { ...prices, ...(config.pricing || {}) };
    $('#prices').innerHTML = `<table><thead><tr><th>${t('th.model')}</th><th class="num">${t('th.input')}</th><th class="num">${t('th.output')}</th><th class="num">${t('th.cacheRead')}</th><th class="num">${t('th.cacheW5')}</th><th class="num">${t('th.cacheW1')}</th></tr></thead><tbody>
      ${Object.entries(all).map(([m, p]) => `<tr><td>${esc(m)}</td><td class="num">${usd(p.input)}</td><td class="num">${usd(p.output)}</td><td class="num">${usd(p.cacheRead)}</td><td class="num">${usd(p.input * 1.25)}</td><td class="num">${usd(p.input * 2)}</td></tr>`).join('')}
    </tbody></table>`;
  } catch (e) { toast(e.message, true); }
}

function renderIntegration(st) {
  const line = (on, label, part) => `<div class="line"><span class="dot" style="background:${on ? 'var(--good)' : 'var(--axis)'}"></span><b>${esc(t(label))}</b><span class="muted small">${esc(t(on ? 'int.installed' : 'int.notInstalled'))}</span><span class="grow"></span>
    <button class="btn sm ${on ? 'ghost' : ''}" data-part="${part}" data-on="${on}">${esc(t(on ? 'int.remove' : 'int.install'))}</button></div>`;
  $('#integration').innerHTML = `<div class="integ">
    ${line(st.statusline, 'int.statusline', 'statusline')}
    ${line(st.guard, 'int.guard', 'guard')}
    ${st.otherStatusline ? `<div class="muted small">${esc(t('int.other', { cmd: st.otherStatusline }))}</div>` : ''}
    ${st.error ? `<div style="color:var(--critical)">${esc(st.error)}</div>` : ''}
    <div class="muted small">${esc(t('int.file', { file: st.settingsFile }))}</div>
  </div>`;
  $$('#integration [data-part]').forEach((b) => (b.onclick = async () => {
    try {
      const st2 = await api(`integration/${b.dataset.on === 'true' ? 'uninstall' : 'install'}`, { method: 'POST', body: { [b.dataset.part]: true } });
      renderIntegration(st2); toast(t('int.done'));
    } catch (e) { toast(e.message, true); }
  }));
}

const saveConfig = async (msgKey) => { try { await api('config', { method: 'PUT', body: { config: S.config } }); toast(t(msgKey)); } catch (er) { toast(er.message, true); } };
$('#general').onsubmit = async (e) => {
  e.preventDefault();
  S.config.lang = e.target.lang.value;
  S.config.statusline.theme = e.target.theme.value;
  await saveConfig('set.saved');
  const meta = await api('meta');
  const lang = e.target.lang.value || meta.lang;
  sset('cp.lang', lang); $('#lang').value = lang;
  await loadLang(lang); renderAll(); loadSettings();
};
$('#budget').onsubmit = async (e) => {
  e.preventDefault();
  const f = e.target;
  S.config.budget.daily = +f.daily.value || 0;
  S.config.budget.monthly = +f.monthly.value || 0;
  S.config.guard.budgetStop = f.budgetStop.checked;
  await saveConfig('b.saved'); load();
};
$('#guard').onsubmit = async (e) => {
  e.preventDefault();
  const f = e.target;
  Object.assign(S.config.guard, { mode: f.mode.value, dedupeReads: f.dedupeReads.checked, noisyBash: f.noisyBash.checked, maxReadBytes: (+f.maxReadKb.value || 250) * 1024 });
  await saveConfig('g.saved');
};

/* ---------- command palette (Ctrl/⌘+K) ---------- */
const TABS = ['overview', 'sessions', 'tools', 'leaks', 'agents', 'settings'];
const RANGES = ['today', '7d', '30d', 'month', '90d', 'all'];
let cmdSel = 0, cmdItems = [];
const cmdDialog = $('#cmdk');
function commands(q) {
  const out = [];
  const add = (group, ic, label, run, hint = '') => out.push({ group, ic, label, run, hint });
  TABS.forEach((tb, i) => add('cmd.goTo', '→', t('nav.' + tb), () => setTab(tb), String(i + 1)));
  RANGES.forEach((r) => add('cmd.range', '◷', t('range.' + r), () => { S.range = r; $('#range').value = r; sset('cp.range', r); load(false, true); }));
  add('cmd.actions', '↻', t('cmd.refresh'), () => load(true, true), 'r');
  add('cmd.actions', '◐', t('cmd.theme'), () => $('#theme').click(), 't');
  add('cmd.actions', '⤓', t('cmd.export'), async () => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText('cplus export');
      toast(t('cmd.copied'));
    } catch { toast(t('cmd.copyFailed'), true); }
  });
  Object.entries(S.meta.langs || {}).forEach(([k, v]) => add('set.lang', '文', v, () => changeLanguage(k)));
  for (const s of (S.data?.report.sessions || []).slice(0, 400)) add('nav.sessions', '#', s.title, () => { setTab('sessions'); openSession(s.sid); }, usd(s.cost));
  if (!q) return out.filter((x) => x.group !== 'nav.sessions' && x.group !== 'set.lang').concat(out.filter((x) => x.group === 'nav.sessions').slice(0, 6));
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return out.filter((x) => words.every((w) => `${t(x.group)} ${x.label}`.toLowerCase().includes(w))).slice(0, 60);
}
function renderCmd() {
  cmdItems = commands($('#cmdk-q').value.trim());
  cmdSel = Math.min(cmdSel, Math.max(0, cmdItems.length - 1));
  let g = null;
  $('#cmdk-list').innerHTML = cmdItems.map((x, i) => {
    const head = x.group !== g ? `<div class="cmdk-group" role="presentation">${esc(t(x.group))}</div>` : '';
    g = x.group;
    return `${head}<div id="cmdk-option-${i}" class="cmdk-item ${i === cmdSel ? 'on' : ''}" role="option" aria-selected="${i === cmdSel}" data-i="${i}"><span class="ic" aria-hidden="true">${esc(x.ic)}</span><span class="cmdk-label">${esc(x.label)}</span><span class="hint">${esc(x.hint)}</span></div>`;
  }).join('') || `<div class="empty">${esc(t('empty'))}</div>`;
  $$('#cmdk-list .cmdk-item').forEach((el) => {
    el.onmousemove = () => {
      if (cmdSel === +el.dataset.i) return;
      cmdSel = +el.dataset.i;
      $$('#cmdk-list .cmdk-item').forEach((x) => { x.classList.toggle('on', x === el); x.setAttribute('aria-selected', String(x === el)); });
      $('#cmdk-q').setAttribute('aria-activedescendant', el.id);
    };
    el.onclick = () => runCmd(+el.dataset.i);
  });
  const selected = $('#cmdk-list .cmdk-item.on');
  if (selected) $('#cmdk-q').setAttribute('aria-activedescendant', selected.id);
  else $('#cmdk-q').removeAttribute('aria-activedescendant');
  selected?.scrollIntoView({ block: 'nearest' });
}
async function runCmd(i) {
  const c = cmdItems[i];
  if (!c) return;
  closeCmd();
  try { await c.run(); } catch (e) { toast(e.message, true); }
}
function openCmd() {
  if (dlg.open || cmdDialog.open) return;
  $('#cmdk-q').value = ''; cmdSel = 0;
  cmdDialog.showModal();
  renderCmd();
  $('#cmdk-q').focus();
}
function closeCmd() { cmdDialog.close(); }
$('#cmdk-open').onclick = openCmd;
$('#cmdk-close').onclick = closeCmd;
cmdDialog.onclick = (e) => { if (e.target === cmdDialog) closeCmd(); };
$('#cmdk-q').oninput = () => { cmdSel = 0; renderCmd(); };
$('#cmdk-q').onkeydown = (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); cmdSel = Math.min(cmdSel + 1, cmdItems.length - 1); renderCmd(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); cmdSel = Math.max(cmdSel - 1, 0); renderCmd(); }
  else if (e.key === 'Enter') { e.preventDefault(); runCmd(cmdSel); }
};
document.addEventListener('keydown', (e) => {
  if (e.isComposing) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); cmdDialog.open ? closeCmd() : openCmd(); return; }
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable || dlg.open || cmdDialog.open;
  if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key >= '1' && e.key <= '6') setTab(TABS[+e.key - 1]);
  else if (e.key === 't') $('#theme').click();
  else if (e.key === 'r') load(true, true);
  else if (e.key === '/') { e.preventDefault(); setTab('sessions'); $('#s-search').focus(); }
});
$('#cmdk-open').innerHTML = `<span class="cmdk-symbol" aria-hidden="true">⌕</span><span class="cmdk-shortcut">${/Mac|iPhone/.test(navigator.platform) ? '⌘' : 'Ctrl'} K</span>`;

/* ---------- boot ---------- */
(async function boot() {
  const meta = await api('meta').catch(() => ({ langs: { en: 'English' }, lang: 'en', version: '' }));
  S.meta = meta;
  $('#ver').textContent = meta.version ? 'v' + meta.version : '';
  $('#demo').classList.toggle('hidden', !meta.demo);
  $('#lang').innerHTML = Object.entries(meta.langs).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
  const nav = (navigator.language || 'en').slice(0, 2).toLowerCase();
  const lang = [qs.get('lang'), sget('cp.lang'), meta.configuredLang, meta.lang !== 'en' ? meta.lang : null, nav].find((l) => l && meta.langs[l]) || 'en';
  $('#lang').value = lang;
  await loadLang(lang);
  $$('.tile .val').forEach((v) => v.classList.add('skel'));
  setTab((location.hash || '#overview').slice(1));
  await load(false, true);
  let rt;
  addEventListener('resize', () => { moveIndicator(); clearTimeout(rt); rt = setTimeout(() => S.data && (renderDaily(S.data.report), renderBlocks(S.data.report)), 150); });
  document.fonts?.ready.then(moveIndicator);
  setInterval(() => { if (document.visibilityState === 'visible' && S.tab === 'overview') load(); }, 30_000);
})();
