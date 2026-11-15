/* Română 1000 - journey map, modules and units, progress charts, "Revise today's words". */
(() => {
'use strict';
const P = window.APP, { G, A, esc, ic, spk, stage, topBar, modal, toast, gain, save, shuffle, title, today, addDays, dayDiff, CATS } = P;

/* ---------- modules: the 10 word groups, each a stop on the journey ---------- */
const MODS = [
  { city: 'București', icon: '🏛️', blurb: 'The glue of every sentence: pronouns, prepositions, question words, yes and no.', lessons: [2, 19, 23, 25, 26, 33], hacks: ['pe', 'neg', 'place'] },
  { city: 'Sinaia', icon: '🏰', blurb: 'The 100 verbs you cannot live without, and the să bridge that connects them.', lessons: [8, 9, 16], hacks: ['sa1', 'sa2', 'boost', 'shift'] },
  { city: 'Brașov', icon: '⛰️', blurb: 'Feelings, routines and plans: reflexive verbs, the past and the future.', lessons: [12, 17, 13, 18], hacks: ['refl', 'past', 'fut'] },
  { city: 'Sighișoara', icon: '🕰️', blurb: 'Describing things: sizes, moods, colours and tastes that agree with their noun.', lessons: [5, 11, 20], hacks: ['adj'] },
  { city: 'Sibiu', icon: '🌉', blurb: 'When, where and how much: adverbs, days, seasons and numbers.', lessons: [6, 14, 37], hacks: [] },
  { city: 'Cluj-Napoca', icon: '🎓', blurb: 'People, family, the body and a visit to the doctor.', lessons: [7, 10], hacks: ['the1', 'the2', 'mie'] },
  { city: 'Timișoara', icon: '🌹', blurb: 'At home and at the table: rooms, furniture, food and drink.', lessons: [10, 24], hacks: ['neut', 'place'] },
  { city: 'Iași', icon: '🚋', blurb: 'Out and about: clothes, places in town, transport, tickets and money.', lessons: [14, 15, 21, 22], hacks: [] },
  { city: 'Constanța', icon: '⚓', blurb: 'Work, school, news and society.', lessons: [24, 29], hacks: [] },
  { city: 'Delta Dunării', icon: '🦢', blurb: 'Nature, animals, materials and the abstract words that make you sound fluent.', lessons: [33, 44], hacks: [] }
];
const UNIT = 25;
const C_MAST = '#199e70', C_LEARN = '#3987e5', C_MISS = '#d95926';     // validated for the dark surface (dataviz palette slots)
function rangeStats(a, b) {
  const t = today(), r = { total: 0, seen: 0, mast: 0, due: 0 };
  for (const w of P.ALL) { if (w.custom || w.id < a || w.id > b) continue; r.total++; const p = P.S.prog[w.id]; if (!p) continue; r.seen++; if (p.st === 'mastered') r.mast++; else if (p.due <= t) r.due++; }
  return r;
}
const modStats = i => rangeStats(CATS[i][0], CATS[i][1]);
function currentMod() {
  if (P.S.focus != null && CATS[P.S.focus]) return P.S.focus;
  const w = P.ALL.find(x => !x.custom && !P.S.prog[x.id]); if (!w) return CATS.length - 1;
  return Math.max(0, CATS.findIndex(c => w.id >= c[0] && w.id <= c[1]));
}
const pct = (n, d) => d ? Math.round(n / d * 100) : 0;

/* ---------- journey map ---------- */
function vMap() {
  const cur = currentMod(), STEP = 122, TOP = 64, H = TOP + (CATS.length - 1) * STEP + 70, X = i => (i % 2 ? 76 : 24);
  let d = `M${X(0)},${TOP}`, done = d;
  for (let i = 1; i < CATS.length; i++) {
    const y0 = TOP + (i - 1) * STEP, y1 = TOP + i * STEP, seg = ` C${X(i - 1)},${y0 + STEP * 0.55} ${X(i)},${y1 - STEP * 0.55} ${X(i)},${y1}`;
    d += seg; if (i <= cur) done += seg;
  }
  const nodes = CATS.map((c, i) => {
    const s = modStats(i), y = TOP + i * STEP, side = i % 2 ? 'r' : 'l';
    return `<button class="mnode ${i === cur ? 'cur' : ''} ${s.mast === s.total ? 'gold' : ''}" style="left:${X(i)}%;top:${y}px;--m:${s.mast / s.total * 100};--s:${s.seen / s.total * 100}" data-act="module" data-i="${i}" aria-label="${esc(c[2])}"><span>${MODS[i].icon}</span></button>
      <button class="mlabel ${side}" style="top:${y}px" data-act="module" data-i="${i}">${i === cur ? '<span class="chip learning mb-1">📍 you are here</span>' : ''}
        <b>${esc(MODS[i].city)}</b><small>${i + 1}. ${esc(c[2])}</small><small class="muted">${s.seen}/${s.total} learned · ${s.mast} mastered</small></button>`;
  }).join('');
  return `<div class="text-xs muted mt-3">Ten modules of 100 words, each split into four units. Tap a stop to open it. The ring shows what you have <b style="color:${C_LEARN}">learned</b> and <b style="color:${C_MAST}">mastered</b>.</div>
    <div class="jmap" style="height:${H}px"><svg viewBox="0 0 100 ${H}" preserveAspectRatio="none" aria-hidden="true">
      <path d="${d}" fill="none" stroke="#ffffff30" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
      <path d="${done}" fill="none" stroke="#fbbf24" stroke-width="3" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>${nodes}</div>`;
}
A.module = el => {
  const i = +el.dataset.i, c = CATS[i], m = MODS[i], s = modStats(i), cur = P.S.focus === i;
  const units = [0, 1, 2, 3].map(u => {
    const a = c[0] + u * UNIT, b = Math.min(c[1], a + UNIT - 1), r = rangeStats(a, b), left = r.total - r.seen;
    const sample = P.ALL.filter(w => w.id >= a && w.id <= b).slice(0, 4).map(w => title(w)).join(', ');
    return `<div class="row" style="align-items:flex-start"><span class="chip ${r.mast === r.total ? 'mastered' : r.seen ? 'learning' : ''}">U${u + 1}</span>
      <span class="flex-1"><b>Words ${a}–${b}</b><span class="block text-xs muted truncate" style="max-width:190px">${esc(sample)}…</span>
        <span class="bar mt-2" style="height:6px"><i style="width:${pct(r.mast, r.total)}%;background:${C_MAST}"></i><i style="width:${pct(r.seen - r.mast, r.total)}%;background:${C_LEARN}"></i></span>
        <span class="block text-xs muted mt-1">${r.seen}/${r.total} learned${r.due ? ' · ' + r.due + ' due' : ''}</span></span>
      ${left || r.due ? `<button class="btn btn-pri btn-sm" data-act="unit" data-a="${a}" data-b="${b}">${left ? 'Learn' : 'Review'}</button>` : '<span class="text-emerald-300 font-bold">✓</span>'}</div>`;
  }).join('');
  const lessons = m.lessons.map(L => { const k = G.lessons.findIndex(x => x.L === L); return k < 0 ? '' : `<button class="row" data-act="lesson" data-i="${k}"><span class="chip">L${L}</span><span class="flex-1 text-sm"><b>${esc(G.lessons[k].title)}</b></span>${ic('chevron-right')}</button>`; }).join('');
  const hacks = m.hacks.map(id => { const k = G.hacks.find(x => x.id === id); return k ? `<button class="row" data-act="hack" data-id="${id}"><span class="chip">hack</span><span class="flex-1 text-sm"><b>${esc(k.title)}</b></span>${ic('chevron-right')}</button>` : ''; }).join('');
  modal(`<div class="flex items-center gap-3"><div style="font-size:38px">${m.icon}</div><div class="flex-1"><div class="text-xs muted uppercase font-bold tracking-wide">Module ${i + 1} · ${esc(m.city)}</div><h2 class="text-xl font-extrabold leading-tight">${esc(c[2])}</h2></div><button class="icon-btn" data-act="closeModal">${ic('x')}</button></div>
    <p class="text-sm text-slate-300 mt-2 leading-snug">${esc(m.blurb)}</p>
    <div class="bar mt-3"><i style="width:${pct(s.mast, s.total)}%;background:${C_MAST}"></i><i style="width:${pct(s.seen - s.mast, s.total)}%;background:${C_LEARN}"></i></div>
    <div class="flex gap-2 mt-2 flex-wrap"><span class="chip">${s.seen}/${s.total} learned</span><span class="chip mastered">${s.mast} mastered</span>${s.due ? `<span class="chip learning">${s.due} due</span>` : ''}</div>
    <button class="btn ${cur ? '' : 'btn-cyan'} w-full mt-3" data-act="focusMod" data-i="${i}">${cur ? '📍 Current module. Tap to go back to frequency order' : 'Make this my current module'}</button>
    <div class="text-xs muted mt-1">Your daily session takes its new words from the current module first.</div>
    <div class="label">Units</div><div class="space-y-2">${units}</div>
    ${lessons || hacks ? `<div class="label">Grammar for this module</div><div class="space-y-2">${hacks}${lessons}</div>` : ''}
    <button class="btn w-full mt-3" data-act="modWords" data-i="${i}">${ic('layers')} Browse all ${s.total} words</button>`);
};
A.focusMod = el => { const i = +el.dataset.i; P.S.focus = P.S.focus === i ? null : i; save(); P.closeModal(); P.render(); toast(P.S.focus === i ? 'New words now come from ' + MODS[i].city + ' first' : 'Back to frequency order'); };
A.unit = el => { P.closeModal(); P.startStudy({ range: [+el.dataset.a, +el.dataset.b] }); };
A.modWords = el => { P.closeModal(); P.browse(+el.dataset.i); };

/* ---------- charts ---------- */
const dayList = (n, from) => Array.from({ length: n }, (_, k) => addDays(from, k));
const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const nice = d => { const x = new Date(d + 'T12:00:00'); return DOW[x.getDay()] + ' ' + x.getDate() + '/' + (x.getMonth() + 1); };
const niceMax = m => { if (m <= 5) return 5; const p = Math.pow(10, Math.floor(Math.log10(m))), f = m / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; };
let chartN = 0;
// Stacked column chart. series = [{name, color, values}], labels = one per column, tips = one sentence per column.
function columns(series, labels, tips, opt) {
  const id = 'ch' + (++chartN), n = labels.length, W = 320, H = 132, L = 24, B = 18, T = 14, pw = W - L - 4, ph = H - B - T;
  const totals = labels.map((_, k) => series.reduce((s, x) => s + x.values[k], 0)), max = niceMax(Math.max(1, ...totals));
  const slot = pw / n, bw = Math.min(18, slot - 3), y = v => T + ph - v / max * ph, peak = totals.indexOf(Math.max(...totals));
  let g = '';
  [0, max / 2, max].forEach(v => { g += `<line x1="${L}" x2="${W - 4}" y1="${y(v)}" y2="${y(v)}" stroke="#ffffff${v ? '14' : '33'}"/><text x="${L - 4}" y="${y(v) + 3}" text-anchor="end" class="ax">${v % 1 ? '' : v}</text>`; });
  labels.forEach((lb, k) => {
    const x = L + slot * k + (slot - bw) / 2; let base = 0;
    series.forEach((s, si) => {
      const v = s.values[k]; if (!v) return;
      const y1 = y(base + v), hgt = Math.max(1, y(base) - y1 - (base ? 2 : 0)), top = si === series.length - 1 || !series.slice(si + 1).some(z => z.values[k]);
      g += top ? `<path d="M${x},${y1 + hgt} V${y1 + Math.min(3, hgt)} q0,-${Math.min(3, hgt)} ${Math.min(3, hgt)},-${Math.min(3, hgt)} H${x + bw - Math.min(3, hgt)} q${Math.min(3, hgt)},0 ${Math.min(3, hgt)},${Math.min(3, hgt)} V${y1 + hgt} Z" fill="${s.color}"/>`
               : `<rect x="${x}" y="${y1}" width="${bw}" height="${hgt}" fill="${s.color}"/>`;
      base += v;
    });
    if (totals[k] && (k === peak || k === n - 1 || (opt && opt.first && k === 0))) g += `<text x="${x + bw / 2}" y="${y(totals[k]) - 4}" text-anchor="middle" class="vl">${totals[k]}</text>`;
    if (lb) g += `<text x="${x + bw / 2}" y="${H - 5}" text-anchor="middle" class="ax">${lb}</text>`;
    g += `<rect x="${L + slot * k}" y="${T}" width="${slot}" height="${ph + B}" fill="transparent" data-act="tip" data-id="${id}" data-t="${esc(tips[k])}"/>`;
  });
  const legend = series.length > 1 ? `<div class="legend">${series.map(s => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
  const table = `<details class="nums"><summary>Show the numbers</summary><table><tr><th>Day</th>${series.map(s => `<th>${esc(s.name)}</th>`).join('')}</tr>${labels.map((_, k) => `<tr><td>${esc(tips[k].split(':')[0])}</td>${series.map(s => `<td>${s.values[k]}</td>`).join('')}</tr>`).join('')}</table></details>`;
  return `${legend}<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${g}</svg><div class="tip" id="${id}">Tap a column for the exact numbers.</div>${table}`;
}
function lineChart(values, labels, tips) {
  const id = 'ch' + (++chartN), n = values.length, W = 320, H = 132, L = 28, B = 18, T = 14, pw = W - L - 30, ph = H - B - T, max = niceMax(Math.max(1, ...values));
  const x = k => L + (n > 1 ? pw * k / (n - 1) : 0), y = v => T + ph - v / max * ph, pts = values.map((v, k) => x(k) + ',' + y(v)).join(' ');
  let g = '';
  [0, max / 2, max].forEach(v => { g += `<line x1="${L}" x2="${W - 4}" y1="${y(v)}" y2="${y(v)}" stroke="#ffffff${v ? '14' : '33'}"/><text x="${L - 4}" y="${y(v) + 3}" text-anchor="end" class="ax">${v % 1 ? '' : v}</text>`; });
  g += `<polygon points="${x(0)},${y(0)} ${pts} ${x(n - 1)},${y(0)}" fill="${C_LEARN}" opacity=".16"/><polyline points="${pts}" fill="none" stroke="${C_LEARN}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  g += `<circle cx="${x(n - 1)}" cy="${y(values[n - 1])}" r="4" fill="${C_LEARN}" stroke="#0f1430" stroke-width="2"/><text x="${x(n - 1) + 7}" y="${y(values[n - 1]) + 4}" class="vl">${values[n - 1]}</text>`;
  labels.forEach((lb, k) => { if (lb) g += `<text x="${x(k)}" y="${H - 5}" text-anchor="middle" class="ax">${lb}</text>`; g += `<rect x="${x(k) - pw / n / 2}" y="${T}" width="${pw / n}" height="${ph + B}" fill="transparent" data-act="tip" data-id="${id}" data-t="${esc(tips[k])}"/>`; });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${g}</svg><div class="tip" id="${id}">Tap the line for the exact numbers.</div>`;
}
A.tip = el => { const t = document.getElementById(el.dataset.id); if (t) t.textContent = el.dataset.t; };
const hrow = (label, segs, total, right) => `<div class="hrow"><span class="hl">${label}</span><span class="ht">${segs.map(s => s[0] ? `<i style="width:${s[0] / total * 100}%;background:${s[1]}"></i>` : '').join('')}</span><span class="hv">${right}</span></div>`;

function vCharts() {
  chartN = 0;
  const S = P.S, t = today(), words = P.ALL.filter(w => S.prog[w.id]), seen = words.length, mast = words.filter(w => S.prog[w.id].st === 'mastered').length;
  if (!seen) return `<div class="glass p-5 mt-3 text-center"><div style="font-size:40px">📊</div><b class="block mt-2">No data yet</b><div class="text-sm muted mt-1">Finish your first session and the charts fill in.</div></div>`;
  // 1. activity, last 14 days (from the daily log, which starts with this version)
  const past = dayList(14, addDays(t, -13)), lg = d => S.log[d] || { c: 0, n: 0, g: 0, f: 0, k: 0, x: 0 };
  const ok = past.map(d => lg(d).g + lg(d).k), miss = past.map(d => lg(d).f), sumOk = ok.reduce((a, b) => a + b, 0), sumMiss = miss.reduce((a, b) => a + b, 0);
  const active = past.filter(d => lg(d).c).length, xl = past.map((d, k) => (k % 2 === 1 || k === 13) ? String(+d.slice(8)) : '');
  // 2. new words per day (from each word's first-seen date, so it goes back before this version)
  const firstBy = {}; words.forEach(w => { const f = S.prog[w.id].first; if (f) firstBy[f] = (firstBy[f] || 0) + 1; });
  const fresh = past.map(d => firstBy[d] || 0);
  // 3. reviews coming up
  const next = dayList(14, t), dueBy = {}; words.forEach(w => { const p = S.prog[w.id]; if (p.st === 'learning' && p.due) { const d = p.due < t ? t : p.due; dueBy[d] = (dueBy[d] || 0) + 1; } });
  const coming = next.map(d => dueBy[d] || 0), nl = next.map((d, k) => k === 0 ? 'today' : (k % 2 === 0 ? String(+d.slice(8)) : ''));
  // 4. cumulative words learned, last 30 days
  const month = dayList(30, addDays(t, -29)); let run = words.filter(w => (S.prog[w.id].first || t) < month[0]).length;
  const cum = month.map(d => (run += firstBy[d] || 0)), ml = month.map((d, k) => (k % 7 === 1 || k === 29) ? String(+d.slice(8)) + '/' + (+d.slice(5, 7)) : '');
  // 5. where the words sit in the schedule
  const steps = S.intervals.map(() => 0); words.forEach(w => { const p = S.prog[w.id]; if (p.st === 'learning') steps[Math.min(S.intervals.length, Math.max(1, p.step)) - 1]++; });
  const stepMax = Math.max(1, mast, ...steps);
  const kpi = (v, l) => `<div class="kpi"><b>${v}</b><small>${l}</small></div>`;
  const card = (h, sub, body) => `<div class="glass p-4 mt-3"><b>${h}</b><div class="text-xs muted mb-2">${sub}</div>${body}</div>`;
  return `<div class="grid grid-cols-2 gap-2 mt-3">${kpi(seen, 'words learned')}${kpi(mast, 'mastered')}${kpi(sumOk + sumMiss ? pct(sumOk, sumOk + sumMiss) + '%' : '–', 'remembered, last 14 days')}${kpi(active ? Math.round((sumOk + sumMiss) / active) : '–', 'cards per study day')}</div>
    ${card('Cards studied', 'Last 14 days. A card you forgot counts once, as forgotten.', columns([{ name: 'Remembered', color: C_LEARN, values: ok }, { name: 'Forgot', color: C_MISS, values: miss }], xl, past.map((d, k) => `${nice(d)}: ${ok[k]} remembered, ${miss[k]} forgot`)) + (sumOk + sumMiss ? '' : '<div class="text-xs muted mt-1">This chart starts counting from today.</div>'))}
    ${card('New words per day', 'Last 14 days.', columns([{ name: 'New words', color: C_LEARN, values: fresh }], xl, past.map((d, k) => `${nice(d)}: ${fresh[k]} new word${fresh[k] === 1 ? '' : 's'}`)))}
    ${card('Words learned so far', 'Running total over the last 30 days.', lineChart(cum, ml, month.map((d, k) => `${nice(d)}: ${cum[k]} words`)))}
    ${card('Reviews coming up', 'Cards that fall due in the next 14 days, before any new words.', columns([{ name: 'Due', color: C_LEARN, values: coming }], nl, next.map((d, k) => `${k ? nice(d) : 'Today'}: ${coming[k]} card${coming[k] === 1 ? '' : 's'} due`), { first: 1 }))}
    ${card('Where your words are', 'Each “Got It” moves a word one step right; after the last step it is mastered.',
      steps.map((n, k) => hrow(`Step ${k + 1} · ${S.intervals[k]}d`, [[n, C_LEARN]], stepMax, n)).join('') + hrow('Mastered', [[mast, C_MAST]], stepMax, mast))}
    ${card('Modules', '<span class="legend" style="margin:0"><span><i style="background:' + C_MAST + '"></i>Mastered</span><span><i style="background:' + C_LEARN + '"></i>Learning</span></span>',
      CATS.map((c, i) => { const s = modStats(i); return hrow(`${i + 1}. ${esc(MODS[i].city)}`, [[s.mast, C_MAST], [s.seen - s.mast, C_LEARN]], s.total, `${s.seen}/${s.total}`); }).join(''))}`;
}

/* ---------- Progres tab ---------- */
let sub = 'map';
P.VIEWS.progress = () => `<h1 class="text-2xl font-extrabold mb-3">Progres</h1>
  <div class="seg"><button class="${sub === 'map' ? 'on' : ''}" data-act="progTab" data-t="map">Hartă · Map</button><button class="${sub === 'charts' ? 'on' : ''}" data-act="progTab" data-t="charts">Grafice · Charts</button></div>
  ${sub === 'map' ? vMap() : vCharts()}`;
A.progTab = el => { sub = el.dataset.t; P.render(); };

/* ---------- home screen additions ---------- */
const todayIds = () => (P.S.day && P.S.day.d === today() ? P.S.day.ids.filter(id => P.BY[id]) : []);
P.homeExtra = () => {
  const n = todayIds().length, i = currentMod(), s = modStats(i);
  return (n ? `<button class="btn btn-cyan btn-big mt-3" data-act="revise">${ic('rotate-ccw')} Revise today's ${n} word${n === 1 ? '' : 's'}</button>` : '') +
    `<button class="glass p-4 mt-3 w-full text-left flex items-center gap-3" data-act="tab" data-tab="progress"><span style="font-size:30px">${MODS[i].icon}</span>
      <span class="flex-1"><span class="block text-xs muted uppercase font-bold tracking-wide">Module ${i + 1} · ${esc(MODS[i].city)}</span><b>${esc(CATS[i][2])}</b>
        <span class="bar mt-2" style="height:6px"><i style="width:${pct(s.mast, s.total)}%;background:${C_MAST}"></i><i style="width:${pct(s.seen - s.mast, s.total)}%;background:${C_LEARN}"></i></span>
        <span class="block text-xs muted mt-1">${s.seen}/${s.total} learned · open the map</span></span>${ic('chevron-right')}</button>`;
};

/* ---------- Revise today's words: free practice, never touches the schedule ---------- */
let rv = null;
A.revise = () => {
  const ids = todayIds(); if (!ids.length) return toast('Study a session first, then come back to revise it.');
  stage(topBar("Revise today's words") + `<div class="glass flash front"><div style="font-size:48px">🔁</div><div class="text-2xl font-extrabold mt-2">${ids.length} word${ids.length === 1 ? '' : 's'} from today</div>
    <div class="text-sm text-slate-300 mt-2 leading-snug">Free practice. It does not change when your cards come back, so repeat it as often as you like.</div></div>
    <button class="btn btn-pri btn-big mt-3" data-act="rvGo" data-dir="0">Romanian → English</button>
    <button class="btn btn-cyan btn-big mt-3" data-act="rvGo" data-dir="1">English → Romanian <small style="font-weight:500">(harder)</small></button>
    <button class="btn btn-big mt-3" data-act="rvQuiz">${ic('zap')} Quiz me on them</button>`);
};
A.rvGo = el => { const ids = shuffle(todayIds()); rv = { q: ids, total: ids.length, done: 0, again: 0, dir: +el.dataset.dir }; rvShow(); };
const rvBar = () => topBar(`Revise · ${rv.done} / ${rv.total}`) + `<div class="bar mb-3"><i class="f2" style="width:${rv.done / rv.total * 100}%"></i></div>`;
function rvShow() {
  if (!rv.q.length) {
    gain(Math.min(10, rv.total)); save(); P.boom();
    return stage(topBar("Revise today's words") + `<div class="glass flash front"><div style="font-size:48px">✨</div><div class="text-2xl font-extrabold gt mt-2">All ${rv.total} revised</div>
      <div class="muted mt-1">${rv.again ? rv.again + ' needed a second look' : 'Not a single slip'}</div></div>
      <button class="btn btn-cyan btn-big mt-3" data-act="revise">${ic('rotate-ccw')} Go again</button><button class="btn btn-pri btn-big mt-3" data-act="closeStage">Done</button>`);
  }
  const w = P.BY[rv.q[0]], ask = rv.dir ? w.en : title(w);
  stage(rvBar() + `<div class="glass flash front" data-act="rvReveal"><span class="chip">${rv.dir ? 'say it in Romanian' : 'what does it mean?'}</span>
    <div class="word mt-4 ${String(ask).length > 13 ? 'sm' : ''}">${esc(ask)}</div>${rv.dir ? '' : `<div class="mt-4">${spk(title(w))}</div>`}
    <div class="muted text-sm mt-6 pulse">Answer in your head, then tap</div></div>`);
}
A.rvReveal = () => {
  const w = P.BY[rv.q[0]];
  stage(rvBar() + `<div class="glass flash"><div class="flex items-center gap-3"><div class="word sm flex-1">${esc(title(w))}</div>${spk(title(w))}</div><div class="mt-2">${P.cardBack(w)}</div></div>
    <div class="flex gap-2 mt-3"><button class="btn btn-forgot grade" data-act="rvGrade" data-k="0">${ic('rotate-ccw')} Again<small>show it once more</small></button>
      <button class="btn btn-got grade" data-act="rvGrade" data-k="1">${ic('check')} Knew it<small>next word</small></button></div>`);
  if (P.S.auto) P.speak(title(w));
};
A.rvGrade = el => {
  const id = rv.q.shift();
  if (el.dataset.k === '1') rv.done++; else { rv.again++; rv.q.splice(Math.min(rv.q.length, 3), 0, id); }
  rvShow();
};
A.rvQuiz = () => {
  const words = todayIds().map(id => P.BY[id]);
  P.quizWords("Today's words", words, (right, total) => {
    gain(right); save(); if (right === total) P.boom();
    stage(topBar("Today's words") + `<div class="glass flash front"><div class="big-num gt">${right}/${total}</div><div class="text-xl font-bold mt-3">${right === total ? 'Perfect!' : 'Nice work.'}</div></div>
      <button class="btn btn-cyan btn-big mt-3" data-act="revise">${ic('rotate-ccw')} Revise again</button><button class="btn btn-pri btn-big mt-3" data-act="closeStage">Done</button>`);
  });
};

P.render();
})();
