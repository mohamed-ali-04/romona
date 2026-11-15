/* Română 1000 - core: state, spaced repetition, views, study session, import/export, notifications. */
(() => {
'use strict';
const BASE = window.RO_WORDS || [], CATS = window.RO_CATS || [], G = window.RO_GRAMMAR;
const $ = (s, r) => (r || document).querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const today = () => iso(new Date());
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
const dayDiff = (a, b) => Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);
const FALLBACK = { x: '✕', plus: '+', 'volume-2': '🔊', flame: '🔥', shield: '🛡', trophy: '🏆', pencil: '✎', 'chevron-right': '›', check: '✓', 'trash-2': '🗑', play: '▶', zap: '⚡', star: '★', swords: '⚔', bell: '🔔' };
const ic = n => `<i data-lucide="${n}"></i>`;
function icons() {
  if (window.lucide && window.lucide.createIcons) return window.lucide.createIcons();
  document.querySelectorAll('i[data-lucide]').forEach(i => { i.textContent = FALLBACK[i.dataset.lucide] || ''; i.style.fontStyle = 'normal'; });
}

/* ---------- native bridge (Capacitor) ---------- */
const Cap = window.Capacitor;
const native = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
const plug = n => { if (!native) return null; try { return (Cap.Plugins && Cap.Plugins[n]) || (window.capacitorExports && window.capacitorExports.registerPlugin(n)) || null; } catch (e) { return null; } };

/* ---------- state ---------- */
const KEY = 'ro1000.v1';
const defaults = () => ({ v: 1, intervals: [1, 2, 4, 8, 16, 30], daily: 15, prog: {}, custom: [], over: {}, nextId: 0, xp: 0, streak: 0, best: 0, freezes: 1,
  last: null, studyDays: 0, intro: { d: null, n: 0 }, bossDue: false, trophies: 0, bossLog: [], remind: { on: false, h: 19, m: 0 }, rate: 0.9, auto: true,
  hackIdx: 0, lessonsDone: {}, hi: {}, packs: [] });
let S = defaults();
function hydrate(raw) { try { const o = typeof raw === 'string' ? JSON.parse(raw) : raw; if (o && typeof o === 'object') S = Object.assign(defaults(), o); } catch (e) { /* keep defaults */ } }
function save() {
  const j = JSON.stringify(S);
  try { localStorage.setItem(KEY, j); } catch (e) { /* storage full or blocked */ }
  const P = plug('Preferences'); if (P) P.set({ key: KEY, value: j }).catch(() => {});
}
let ALL = [], BY = {};
function rebuild() {
  ALL = BASE.map(w => S.over[w.id] ? Object.assign({}, w, S.over[w.id]) : w).concat(S.custom);
  BY = {}; ALL.forEach(w => { BY[w.id] = w; });
}
const status = w => { const p = S.prog[w.id]; return p ? p.st : 'new'; };
const isDue = (w, t) => { const p = S.prog[w.id]; return !!p && p.st === 'learning' && p.due <= t; };
function counts() {
  const t = today(), c = { total: ALL.length, mastered: 0, learning: 0, fresh: 0, due: 0 };
  ALL.forEach(w => { const s = status(w); if (s === 'mastered') c.mastered++; else if (s === 'learning') { c.learning++; if (isDue(w, t)) c.due++; } else c.fresh++; });
  return c;
}
const LEVELS = [[0, 'Turist'], [400, 'Explorator'], [1500, 'Localnic'], [4000, 'Voievod']];
function level() {
  let i = 0; LEVELS.forEach((l, k) => { if (S.xp >= l[0]) i = k; });
  const next = LEVELS[i + 1];
  return { i, name: LEVELS[i][1], next: next ? next[1] : null, pct: next ? Math.round((S.xp - LEVELS[i][0]) / (next[0] - LEVELS[i][0]) * 100) : 100, need: next ? next[0] - S.xp : 0 };
}
function gain(n) { const before = level().i; S.xp += n; const lv = level(); if (lv.i > before) { toast('Level up! You are now ' + lv.name + ' 🎉'); boom(); } }
const liveStreak = () => (S.last && dayDiff(S.last, today()) - 1 > S.freezes) ? 0 : S.streak;
function markStudyDay() {
  const t = today(); if (S.last === t) return;
  if (S.last) {
    const gap = dayDiff(S.last, t) - 1;
    if (gap <= 0) S.streak++;
    else if (gap <= S.freezes) { S.freezes -= gap; S.streak++; toast('Streak Freeze used. Your streak is safe 🛡'); }
    else S.streak = 1;
  } else S.streak = 1;
  S.best = Math.max(S.best, S.streak); S.last = t; S.studyDays++;
  if (S.studyDays % 10 === 0) S.bossDue = true;
}

/* ---------- small UI helpers ---------- */
let toastT;
function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2600); }
function boom(big) {
  if (!window.confetti) return;
  window.confetti({ particleCount: big ? 170 : 80, spread: big ? 100 : 70, origin: { y: 0.65 }, colors: ['#8b5cf6', '#ec4899', '#22d3ee', '#fbbf24', '#34d399'] });
  if (big) setTimeout(() => window.confetti({ particleCount: 120, angle: 60, spread: 70, origin: { x: 0 } }), 250), setTimeout(() => window.confetti({ particleCount: 120, angle: 120, spread: 70, origin: { x: 1 } }), 400);
}
let timers = [];
const later = (f, ms) => { const id = setTimeout(f, ms); timers.push(() => clearTimeout(id)); return id; };
const every = (f, ms) => { const id = setInterval(f, ms); timers.push(() => clearInterval(id)); return id; };
const clearTimers = () => { timers.forEach(f => f()); timers = []; };
function sentinel() { if (!history.state) history.pushState(1, ''); }
function stage(html) { const st = $('#stage'); st.innerHTML = '<div class="wrap">' + html + '</div>'; st.classList.remove('hidden'); st.scrollTop = 0; sentinel(); icons(); }
function closeStage() { clearTimers(); stopSpeak(); $('#stage').classList.add('hidden'); $('#stage').innerHTML = ''; ses = null; render(); }
const topBar = (title, right) => `<div class="flex items-center gap-3 mb-3"><button class="icon-btn" data-act="closeStage" aria-label="Close">${ic('x')}</button><div class="flex-1 font-bold truncate">${title}</div>${right || ''}</div>`;
function modal(html) { const m = $('#modal'); m.innerHTML = '<div class="sheet">' + html + '</div>'; m.classList.remove('hidden'); sentinel(); icons(); }
function closeModal() { $('#modal').classList.add('hidden'); $('#modal').innerHTML = ''; }

/* ---------- speech ---------- */
const cleanSpeak = s => String(s).replace(/\(.*?\)/g, ' ').replace(/[\/|]/g, ', ').replace(/[—–→]/g, ', ').replace(/\s+/g, ' ').trim();
let warned = false;
function webSpeak(text) {
  const ss = window.speechSynthesis;
  if (!ss || !window.SpeechSynthesisUtterance) { if (!warned) { warned = true; toast('No speech engine found on this device'); } return; }
  if (!roVoice) pickVoice();                                   // iOS fills the voice list late
  if (ss.speaking || ss.pending) ss.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = 'ro-RO'; u.rate = S.rate; u.pitch = 1; u.volume = 1;
  if (roVoice) u.voice = roVoice;
  window.__roUtterance = u;                                    // keep a reference: Safari drops utterances that are garbage-collected
  ss.speak(u); if (ss.paused) ss.resume();
}
let roVoice = null;
function pickVoice() {
  const ss = window.speechSynthesis; if (!ss) return;
  const v = ss.getVoices();
  roVoice = v.find(x => /^ro[-_]RO$/i.test(x.lang) && x.localService) || v.find(x => /^ro[-_]RO$/i.test(x.lang)) || v.find(x => /^ro/i.test(x.lang)) || null;
}
if (window.speechSynthesis) { pickVoice(); if (window.speechSynthesis.addEventListener) window.speechSynthesis.addEventListener('voiceschanged', pickVoice); }
function speak(text) {
  text = cleanSpeak(text); if (!text) return;
  const T = plug('TextToSpeech');
  if (T) T.speak({ text, lang: 'ro-RO', rate: S.rate, pitch: 1, volume: 1, category: 'ambient' }).catch(() => webSpeak(text)); else webSpeak(text);
}
function stopSpeak() { const T = plug('TextToSpeech'); if (T) T.stop().catch(() => {}); else if (window.speechSynthesis) window.speechSynthesis.cancel(); }
const canSpeak = () => native || !!window.speechSynthesis;
const spk = (text, cls) => `<button class="icon-btn spk ${cls || ''}" data-act="speak" data-say="${esc(text)}" aria-label="Listen">${ic('volume-2')}</button>`;

/* ---------- word presentation ---------- */
const PRON = ['eu', 'tu', 'el / ea', 'noi', 'voi', 'ei / ele'];
const POS = { fn: 'core word', verb: 'verb', adj: 'adjective', adv: 'adverb', num: 'number', noun: 'noun', other: 'word' };
const GEN = { m: 'masculine', f: 'feminine', n: 'neuter', pl: 'plural' };
const TAG = { irr: 'irregular / stem shift', ez: '-ez booster', esc: '-esc booster', 0: 'bare stem' };
function title(w) {
  if (w.pos !== 'verb' || /^a[ -]/.test(w.ro)) return w.ro;
  if (w.refl && w.conj) return (/^îmi\b/.test(w.conj[0]) ? 'a-și ' : 'a se ') + w.ro;
  return 'a ' + w.ro;
}
function saForms(w) {
  if (w.saAll) return w.saAll;
  if (!w.conj || !w.sa) return null;
  return w.conj.map((f, i) => (i === 2 || i === 5) ? w.sa : (f && f !== '—' ? 'să ' + f : '—'));
}
function formsHTML(w, hi) {
  let o = '';
  if (w.pos === 'verb' && w.imp) {
    o += `<div class="forms ${hi ? 'hi' : ''}"><div class="k"><small>all persons</small><b>${esc(w.conj[2])}</b></div><div class="k"><small>after să</small><b>${esc(w.sa)}</b></div></div>`;
  } else if (w.conj && w.conj.some(x => x && x !== '—')) {
    const sa = saForms(w);
    o += `<table class="tbl ${hi ? 'hi' : ''}"><tr><th></th><th>present</th>${sa ? '<th>after să</th>' : ''}</tr>` + w.conj.map((f, i) =>
      `<tr class="${i === 1 || i === 2 ? 'k' : ''}"><td>${PRON[i]}</td><td><b>${esc(f)}</b></td>${sa ? `<td class="sa">${esc(sa[i])}</td>` : ''}</tr>`).join('') + '</table>';
  }
  if (w.forms && (w.forms.i || w.forms.d || w.forms.p || w.forms.dp)) {
    const f = w.forms, cell = (l, v, k) => v ? `<div class="${k ? 'k' : ''}"><small>${l}</small><b>${esc(v)}</b></div>` : '';
    o += `<div class="forms ${hi ? 'hi' : ''}">${cell('a / an', f.i)}${cell('the', f.d, 1)}${cell('plural', f.p, 1)}${cell('the (plural)', f.dp)}</div>`;
  }
  if (w.adj && w.adj.length) {
    const L = ['masc. sg.', 'fem. sg.', 'masc. pl.', 'fem. pl.'];
    o += `<div class="forms mt-2">${w.adj.map((v, i) => v ? `<div><small>${L[i] || ''}</small><b>${esc(v)}</b></div>` : '').join('')}</div>`;
  }
  return o;
}
function bookRef(w) {
  const r = [];
  if (w.pos === 'verb') { r.push('present tense: Lecția 8–9 (p. 70–88)', 'să forms: Lecția 16 (p. 148)'); if (w.refl) r.push('reflexives: Lecția 17 (p. 160)'); }
  else if (w.pos === 'noun') r.push('articles: Lecția 7 (p. 61)', 'plurals: Lecția 10 (p. 93)');
  else if (w.pos === 'adj') r.push('adjective forms: Lecția 11 (p. 106)');
  else if (w.pos === 'num') r.push('numbers: Lecția 6 (p. 52)');
  if (w.L) r.unshift('first appears in Lecția ' + w.L);
  return r.length ? `<div class="text-xs muted mt-3">${ic('book-open')} Course book: ${r.join(' · ')}</div>` : '';
}
function chipsHTML(w) {
  const st = status(w), p = S.prog[w.id];
  let c = `<span class="chip">${POS[w.pos] || esc(w.pos || 'word')}${w.g ? ' · ' + (GEN[w.g] || w.g) : ''}</span>`;
  if (w.pos === 'verb' && w.tag != null) c += `<span class="chip ${w.tag === 'irr' ? 'irr' : ''}">${TAG[w.tag] || ''}</span>`;
  c += `<span class="chip ${st}">${st}${st === 'learning' && p ? ' · step ' + p.step + '/' + S.intervals.length : ''}</span>`;
  return c;
}
function cardBack(w, hi) {
  let o = `<div class="text-xl font-bold text-sky-300">${esc(w.en)}</div><div class="flex flex-wrap gap-2 mt-2">${chipsHTML(w)}</div>`;
  const f = formsHTML(w, hi); if (f) o += `<div class="label">Forms</div>` + f;
  if (w.note) o += `<div class="callout ${hi ? 'red' : ''} mt-3">${ic('triangle-alert')} ${esc(w.note)}</div>`;
  if (w.use) o += `<div class="callout blue mt-2">${ic('lightbulb')} ${esc(w.use)}</div>`;
  if (w.ex && w.ex.length) o += `<div class="label">In real life</div>` + w.ex.map(e => `<div class="ex">${spk(e[0])}<div><b>${esc(e[0])}</b><span>${esc(e[1] || '')}</span></div></div>`).join('');
  else o += `<div class="callout blue mt-3">${ic('pencil')} No example yet. Tap Edit to add your own sentence.</div>`;
  return o + bookRef(w);
}

/* ---------- views ---------- */
let tab = 'home', deck = { q: '', f: 'all', cat: -1, n: 60 }, bookTab = 'hacks';
const photoURL = id => `https://unsplash.com/photos/${id}/download?force=true&w=900`;
function vHome() {
  const c = counts(), t = today(), lv = level(), ph = G.photos[Math.floor(Date.now() / 864e5) % G.photos.length];
  const quota = Math.max(0, S.daily - (S.intro.d === t ? S.intro.n : 0)), newN = Math.min(quota, c.fresh), todo = c.due + newN;
  const pc = n => (n / c.total * 100).toFixed(1);
  const nextBoss = 10 - (S.studyDays % 10);
  return `<div class="flex items-center justify-between mb-3"><div><h1 class="text-2xl font-extrabold gt">Română 1000</h1><div class="tricolor mt-1"></div></div>
    <div class="chip">${ic('zap')} ${S.xp} XP</div></div>
  <div class="hero"><img src="${photoURL(ph.id)}" alt="" onerror="this.remove()"><div class="shade"></div>
    <div class="credit">${esc(ph.place)} · ${esc(ph.by)} / Unsplash</div>
    <div class="in"><div class="text-xs uppercase tracking-wide font-bold opacity-70">Ziua ${S.studyDays + (S.last === t ? 0 : 1)} · ${lv.name}</div>
      <div class="text-2xl font-extrabold leading-tight">${todo ? `${todo} cards today` : (S.last === t ? 'Gata pe azi! ✔' : 'Nothing due. Bravo!')}</div>
      <div class="text-sm text-slate-300">${c.due} to review · ${newN} new</div></div></div>
  <div class="glass flex mt-3"><div class="stat"><b><span class="flame">${ic('flame')}</span> ${liveStreak()}</b><small>day streak</small></div>
    <div class="stat"><b>${ic('shield')} ${S.freezes}</b><small>freezes</small></div><div class="stat"><b>${ic('trophy')} ${S.trophies}</b><small>boss wins</small></div></div>
  <button class="btn btn-pri btn-big mt-3" data-act="study">${ic('play')} ${todo ? 'Start today\'s session' : 'Learn 5 extra words'}</button>
  ${S.bossDue ? `<button class="btn btn-gold btn-big mt-3 pulse" data-act="boss">${ic('swords')} Boss Quiz is ready! Day ${S.studyDays}</button>` : ''}
  <div class="glass p-4 mt-3"><div class="flex justify-between text-sm font-bold"><span>${lv.name}</span><span class="muted">${lv.next ? lv.need + ' XP to ' + lv.next : 'Top rank reached'}</span></div>
    <div class="bar mt-2"><i class="f1" style="width:${lv.pct}%"></i></div>
    <div class="flex justify-between text-sm font-bold mt-4"><span>Your 1,000 words</span><span class="muted">${c.mastered} mastered</span></div>
    <div class="bar mt-2"><i class="f3" style="width:${pc(c.mastered)}%"></i><i class="f2" style="width:${pc(c.learning)}%"></i></div>
    <div class="flex gap-2 mt-3 flex-wrap"><span class="chip mastered">${c.mastered} mastered</span><span class="chip learning">${c.learning} learning</span><span class="chip new">${c.fresh} new</span></div>
    <div class="text-xs muted mt-3">Next Boss Quiz in ${nextBoss} study day${nextBoss === 1 ? '' : 's'} · best streak ${S.best}</div></div>`;
}
function deckList() {
  const q = deck.q.trim().toLowerCase();
  let list = ALL.filter(w => {
    if (deck.f === 'mine' ? !w.custom : (deck.f !== 'all' && status(w) !== deck.f)) return false;
    if (deck.cat >= 0 && !(w.id >= CATS[deck.cat][0] && w.id <= CATS[deck.cat][1])) return false;
    return !q || w.ro.toLowerCase().includes(q) || String(w.en).toLowerCase().includes(q);
  });
  const total = list.length; list = list.slice(0, deck.n);
  return `<div class="text-xs muted mb-2">${total} word${total === 1 ? '' : 's'}</div><div class="space-y-2">` + list.map(w =>
    `<button class="row" data-act="word" data-id="${w.id}"><span class="n">${w.custom ? '★' : w.id}</span><span class="dot ${status(w)}"></span>
      <span class="flex-1 truncate"><b>${esc(title(w))}</b> <span class="muted text-sm">· ${esc(w.en)}</span></span></button>`).join('') +
    `</div>${total > deck.n ? `<button class="btn w-full mt-3" data-act="more">Show more</button>` : ''}`;
}
function vDeck() {
  const F = [['all', 'All'], ['new', 'New'], ['learning', 'Learning'], ['mastered', 'Mastered'], ['mine', 'My words']];
  return `<h1 class="text-2xl font-extrabold mb-3">Cuvinte</h1>
  <input class="inp" id="q" placeholder="Search Romanian or English…" value="${esc(deck.q)}" data-inp="search" autocomplete="off">
  <div class="chips mt-3">${F.map(f => `<button class="chip ${deck.f === f[0] ? 'on' : ''}" data-act="filter" data-f="${f[0]}">${f[1]}</button>`).join('')}</div>
  <select class="inp mt-2" data-chg="cat"><option value="-1">All categories</option>${CATS.map((c, i) => `<option value="${i}" ${deck.cat === i ? 'selected' : ''}>${c[0]}–${c[1]} · ${esc(c[2])}</option>`).join('')}</select>
  <div id="list" class="mt-3">${deckList()}</div>`;
}
function vArcade() {
  const g = (cls, act, icn, name, sub) => `<button class="glass game-card ${cls}" data-act="${act}"><span class="ic">${ic(icn)}</span><b>${name}</b><small>${sub}</small>${S.hi[act] ? `<small>Best: ${S.hi[act]}</small>` : ''}</button>`;
  return `<h1 class="text-2xl font-extrabold mb-3">Arcade</h1><div class="grid grid-cols-2 gap-3">
    ${g('gc1', 'gBridge', 'git-merge', '„Să” Bridge Builder', 'Build the sentence before the timer runs out')}
    ${g('gc2', 'gSnap', 'arrow-down-to-line', 'Article & Plural Snap', 'Catch the falling noun with the right form')}
    ${g('gc3', 'gRoulette', 'dices', 'Verb Ending Roulette', 'Pronoun + verb. Pick the right ending')}
    ${g('gc4', 'gBlitz', 'timer', '60-Second Blitz Match', 'Match words to meanings. Chase the combo')}</div>
  <button class="btn btn-gold btn-big mt-4" data-act="boss">${ic('swords')} Launch a Boss Quiz</button>
  <div class="text-xs muted mt-2 text-center">20 questions · 80% wins a trophy, a Streak Freeze and 200 XP</div>`;
}
function vBook() {
  const body = bookTab === 'hacks'
    ? G.hacks.map(k => `<button class="row" data-act="hack" data-id="${k.id}"><span class="icon-btn">${ic(k.icon)}</span><span class="flex-1"><b>${esc(k.title)}</b><span class="block text-xs muted">${esc(k.hook)}</span></span></button>`).join('')
    : G.lessons.map((l, i) => `<button class="row" data-act="lesson" data-i="${i}"><span class="chip ${S.lessonsDone[l.L] ? 'mastered' : ''}">L${l.L}</span><span class="flex-1"><b>${esc(l.title)}</b><span class="block text-xs muted">Manual p. ${l.pages} · ${l.quiz.length} quiz questions${S.lessonsDone[l.L] ? ' · done ✓' : ''}</span></span>${ic('chevron-right')}</button>`).join('');
  return `<h1 class="text-2xl font-extrabold mb-3">Grammar &amp; Course Book</h1>
  <div class="seg"><button class="${bookTab === 'hacks' ? 'on' : ''}" data-act="bookTab" data-t="hacks">Grammar Hacks</button><button class="${bookTab === 'lessons' ? 'on' : ''}" data-act="bookTab" data-t="lessons">Course Book Companion</button></div>
  <div class="text-xs muted mt-3">${bookTab === 'hacks' ? 'The cheat codes. One pops up every 8–10 cards while you study.' : 'Bite-sized cards for the grammar lessons of “Learn Romanian Manual”, in the book\'s order, each with a quiz. Page numbers point to the full explanation in your copy.'}</div>
  <div class="space-y-2 mt-3">${body}</div>`;
}
function vSettings() {
  const time = pad(S.remind.h) + ':' + pad(S.remind.m);
  return `<h1 class="text-2xl font-extrabold mb-3">Setări</h1>
  <div class="glass p-4"><b>Recall intervals (days)</b><div class="text-xs muted mt-1">“Got It” moves a word one step to the right. After the last step it is mastered.</div>
    <div class="flex flex-wrap gap-2 mt-3">${S.intervals.map((d, i) => `<span class="chip"><input type="number" min="1" max="365" value="${d}" data-chg="iv" data-i="${i}" style="width:44px;background:none;border:0;outline:0;text-align:center;font-weight:800"><button data-act="ivDel" data-i="${i}" aria-label="Remove step">✕</button></span>`).join('<span class="muted">→</span>')}
      <button class="chip on" data-act="ivAdd">+ step</button></div>
    <button class="btn btn-sm mt-3" data-act="ivReset">Reset to 1 → 2 → 4 → 8 → 16 → 30</button></div>
  <div class="glass p-4 mt-3"><div class="flex justify-between"><b>New words per day</b><b class="text-amber-300" id="dailyV">${S.daily}</b></div>
    <input type="range" min="5" max="50" step="1" value="${S.daily}" data-inp="daily" class="mt-3"><div class="flex justify-between text-xs muted"><span>5</span><span>50</span></div></div>
  <div class="glass p-4 mt-3"><div class="flex items-center justify-between gap-3"><div><b>${ic('bell')} Daily reminder</b><div class="text-xs muted">Android notification with your streak and due cards</div></div>
      <button class="switch ${S.remind.on ? 'on' : ''}" data-act="remind" aria-label="Toggle reminder"></button></div>
    <input type="time" class="inp mt-3" value="${time}" data-chg="remindTime"></div>
  <div class="glass p-4 mt-3"><div class="flex justify-between"><b>Speech speed</b><b class="text-amber-300" id="rateV">${S.rate.toFixed(2)}×</b></div>
    <input type="range" min="0.5" max="1.3" step="0.05" value="${S.rate}" data-inp="rate" class="mt-3">
    <div class="flex items-center justify-between mt-3"><span class="text-sm">Say the word when a card is revealed</span><button class="switch ${S.auto ? 'on' : ''}" data-act="auto" aria-label="Toggle auto speech"></button></div>
    <button class="btn btn-sm mt-3" data-act="speak" data-say="Bună ziua! Ce mai faci?">${ic('volume-2')} Test voice</button></div>
  <div class="glass p-4 mt-3"><b>Words &amp; backup</b>
    <div class="grid grid-cols-2 gap-2 mt-3"><button class="btn btn-cyan btn-sm" data-act="pack">${ic('package-plus')} Import pack</button><button class="btn btn-sm" data-act="importFile">${ic('upload')} Import file</button>
      <button class="btn btn-sm" data-act="exportXlsx">${ic('sheet')} Export Excel</button><button class="btn btn-sm" data-act="exportCsv">${ic('file-text')} Export CSV</button>
      <button class="btn btn-sm" data-act="exportJson">${ic('download')} Backup (JSON)</button><button class="btn btn-sm" data-act="addWord">${ic('plus')} Add a word</button></div>
    <div class="text-xs muted mt-3">Import accepts .xlsx, .csv and .json. All 1,000 built-in words are full cards.${S.packs.length ? ' Imported: ' + S.packs.map(esc).join(', ') + '.' : ''}</div></div>
  <div class="glass p-4 mt-3"><b>Reset</b><div class="text-xs muted mt-1">Clears progress, streak and XP. Your custom words and imported packs stay.</div>
    <button class="btn btn-forgot btn-sm mt-3" data-act="reset">${ic('trash-2')} Reset progress</button></div>
  <div class="text-xs muted mt-4 text-center leading-snug">Photos: ${G.photos.map(p => esc(p.by)).join(', ')} on Unsplash.<br>Grammar page references: Learn Romanian Manual, ROLANG School.</div>`;
}
const VIEWS = { home: vHome, deck: vDeck, arcade: vArcade, book: vBook, settings: vSettings };
function render() {
  $('#view').innerHTML = VIEWS[tab]();
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  $('#fab').classList.toggle('hidden', tab !== 'deck');
  icons();
}
function go(t) { tab = t; render(); window.scrollTo(0, 0); sentinel(); }

/* ---------- study session ---------- */
let ses = null;
const freshPool = () => ALL.filter(w => !S.prog[w.id]).sort((a, b) => (b.custom ? 1 : 0) - (a.custom ? 1 : 0) || a.id - b.id);
function startStudy() {
  const t = today(); if (S.intro.d !== t) S.intro = { d: t, n: 0 };
  const due = shuffle(ALL.filter(w => isDue(w, t)));
  let quota = Math.max(0, S.daily - S.intro.n);
  if (!due.length && !quota) quota = 5;                       // bonus round once the daily target is met
  const fresh = freshPool().slice(0, quota);
  if (!due.length && !fresh.length) return toast('Nothing left to study. You have seen every word!');
  const a = due.map(w => ({ id: w.id })), b = fresh.map(w => ({ id: w.id, isNew: 1 })), q = [];
  while (a.length || b.length) { q.push(...a.splice(0, 2)); if (b.length) q.push(b.shift()); }
  ses = { q, total: q.length, done: 0, graded: 0, nextHack: 8 + rnd(3), got: 0, forgot: 0, known: 0, xp0: S.xp };
  showCard();
}
const sesBar = () => topBar(`${ses.done} / ${ses.total}`, `<span class="chip">${ic('zap')} +${S.xp - ses.xp0}</span>`) + `<div class="bar mb-3"><i class="f1" style="width:${ses.total ? ses.done / ses.total * 100 : 0}%"></i></div>`;
function showCard() {
  if (!ses) return;
  const it = ses.q[0]; if (!it) return finish();
  const w = BY[it.id]; if (!w) { ses.q.shift(); return showCard(); }
  const badge = it.again ? '<span class="chip irr">one more time</span>' : it.isNew ? '<span class="chip new">new word</span>' : '<span class="chip learning">review</span>';
  stage(sesBar() + `<div class="glass flash front" data-act="reveal">${badge}
    <div class="word mt-4 ${title(w).length > 13 ? 'sm' : ''}">${esc(title(w))}</div><div class="mt-4">${spk(title(w))}</div>
    <div class="muted text-sm mt-6 pulse">Say the meaning in your head, then tap to reveal</div></div>`);
}
function reveal() {
  const it = ses.q[0], w = BY[it.id];
  stage(sesBar() + `<div class="glass flash"><div class="flex items-center gap-3"><div class="word sm flex-1">${esc(title(w))}</div>${spk(title(w))}</div>
    <div class="mt-2">${cardBack(w)}</div></div>
    <div class="flex gap-2 mt-3"><button class="btn btn-forgot grade" data-act="grade" data-k="forgot">${ic('rotate-ccw')} Forgot It<small>back in a few cards</small></button>
      <button class="btn btn-got grade" data-act="grade" data-k="got">${ic('check')} Got It<small>${it.again ? 'see you tomorrow' : nextLabel(w)}</small></button>
      <button class="btn btn-know grade" data-act="grade" data-k="know">${ic('star')} Already Know It<small>skip forever</small></button></div>`);
  if (S.auto) speak(title(w));
}
function nextLabel(w) {
  const p = S.prog[w.id]; if (!p) return 'next in ' + S.intervals[0] + 'd';
  return p.step >= S.intervals.length ? 'mastered!' : 'next in ' + S.intervals[p.step] + 'd';
}
function grade(k) {
  if (!ses || !ses.q.length) return;
  const it = ses.q.shift(), w = BY[it.id], t = today(); let p = S.prog[w.id];
  markStudyDay();
  if (k === 'know') {
    S.prog[w.id] = { st: 'mastered', step: S.intervals.length, due: null, lapses: p ? p.lapses : 0, first: p ? p.first : t, bypass: 1 };
    gain(15); ses.known++; ses.done++;
    if (it.isNew) {                                            // keep the daily quota for words that are really new to you
      const inQ = new Set(ses.q.map(x => x.id)), r = freshPool().find(x => !inQ.has(x.id));
      if (r) { ses.q.push({ id: r.id, isNew: 1 }); ses.total++; }
    }
  } else if (k === 'got') {
    if (it.again) { /* already reset to step 0 and due tomorrow */ }
    else if (!p) { S.prog[w.id] = { st: 'learning', step: 1, due: addDays(t, S.intervals[0]), lapses: 0, first: t }; S.intro.n++; }
    else if (p.step >= S.intervals.length) { p.st = 'mastered'; p.due = null; gain(30); toast('“' + title(w) + '” is mastered! 🏅'); }
    else { p.due = addDays(t, S.intervals[p.step]); p.step++; }
    gain(10); ses.got++; ses.done++;
  } else {
    if (!p) { p = S.prog[w.id] = { st: 'learning', step: 1, due: addDays(t, S.intervals[0]), lapses: 0, first: t }; S.intro.n++; ses.forgot++; }
    else if (!it.again) { p.st = 'learning'; p.step = 1; p.due = addDays(t, S.intervals[0]); p.lapses = (p.lapses || 0) + 1; ses.forgot++; }
    ses.q.splice(Math.min(ses.q.length, 3 + rnd(3)), 0, { id: w.id, again: 1 });
    gain(2); save();
    return stage(sesBar() + `<div class="glass flash"><div class="chip irr">${ic('search')} Breakdown</div>
      <div class="flex items-center gap-3 mt-3"><div class="word sm flex-1">${esc(title(w))}</div>${spk(title(w))}</div>
      <div class="mt-2">${cardBack(w, true)}</div></div>
      <button class="btn btn-pri btn-big mt-3" data-act="afterCard">It will come back in a few cards ${ic('chevron-right')}</button>`);
  }
  save(); afterCard();
}
function afterCard() {
  if (!ses) return;
  ses.graded++;
  if (ses.graded >= ses.nextHack && ses.q.length) {
    ses.nextHack = ses.graded + 8 + rnd(3);
    const k = G.hacks[S.hackIdx % G.hacks.length]; S.hackIdx++; save();
    return stage(sesBar() + hackHTML(k) + `<button class="btn btn-pri btn-big mt-3" data-act="showCard">Got it, keep going ${ic('chevron-right')}</button>`);
  }
  showCard();
}
function finish() {
  const s = ses; save(); scheduleReminder(); boom(true);
  stage(topBar('Session complete') + `<div class="glass flash front"><div style="font-size:54px">🎉</div><div class="text-3xl font-extrabold gt mt-2">Bravo!</div>
    <div class="muted mt-1">${s.total} cards · +${S.xp - s.xp0} XP</div>
    <div class="flex gap-2 mt-4 flex-wrap justify-center"><span class="chip mastered">${s.got} got it</span><span class="chip irr">${s.forgot} forgotten, then recalled</span><span class="chip new">${s.known} already known</span></div>
    <div class="text-xl font-bold mt-5"><span class="flame">${ic('flame')}</span> ${S.streak}-day streak</div>
    ${S.bossDue ? '<div class="callout mt-4">Day ' + S.studyDays + ': the Boss Quiz is unlocked on your home screen.</div>' : ''}</div>
    <button class="btn btn-pri btn-big mt-3" data-act="closeStage">Done</button>`);
}
const hackHTML = k => `<div class="hack"><div class="chip">${ic(k.icon)} Grammar Hack · 20 seconds</div><h2 class="text-2xl font-extrabold mt-3 leading-tight">${esc(k.title)}</h2>
  <p class="text-slate-300 mt-1">${esc(k.hook)}</p><ul>${k.body.map(b => `<li>${b}</li>`).join('')}</ul>
  ${k.ex.map(e => `<div class="ex">${spk(e[0])}<div><b>${esc(e[0])}</b><span>${esc(e[1])}</span></div></div>`).join('')}
  <div class="text-xs muted mt-3">${ic('book-open')} In your course book: ${esc(k.book)}</div></div>`;

/* ---------- word detail, add / edit ---------- */
function openWord(id) {
  const w = BY[id]; if (!w) return;
  modal(`<div class="flex items-center gap-3"><div class="word sm flex-1">${esc(title(w))}</div>${spk(title(w))}<button class="icon-btn" data-act="closeModal">${ic('x')}</button></div>
    <div class="mt-2">${cardBack(w)}</div>
    <div class="flex gap-2 mt-4"><button class="btn flex-1" data-act="editWord" data-id="${w.id}">${ic('pencil')} Edit</button>
      ${S.prog[w.id] ? `<button class="btn flex-1" data-act="forget" data-id="${w.id}">${ic('rotate-ccw')} Mark as new</button>` : `<button class="btn btn-know flex-1" data-act="knowIt" data-id="${w.id}">${ic('star')} Already know it</button>`}</div>
    ${w.custom ? `<button class="btn btn-forgot w-full mt-2" data-act="delWord" data-id="${w.id}">${ic('trash-2')} Delete this word</button>` : (S.over[w.id] ? `<button class="btn w-full mt-2" data-act="revert" data-id="${w.id}">Restore the original card</button>` : '')}`);
}
function wordForm(id) {
  const w = id ? BY[id] : {}, c = w.conj || [], f = w.forms || {}, e = (w.ex && w.ex[0]) || [];
  const fld = (k, label, v, ph) => `<label class="fld"><span>${label}</span><input class="inp" id="f-${k}" value="${esc(v || '')}" placeholder="${ph || ''}" autocomplete="off" autocapitalize="off"></label>`;
  const posSel = ['noun', 'verb', 'adj', 'adv', 'fn', 'num', 'other'].map(p => `<option value="${p}" ${(w.pos || 'noun') === p ? 'selected' : ''}>${POS[p]}</option>`).join('');
  const genSel = [['', '—'], ['m', 'masculine'], ['f', 'feminine'], ['n', 'neuter'], ['pl', 'plural only']].map(g => `<option value="${g[0]}" ${(w.g || '') === g[0] ? 'selected' : ''}>${g[1]}</option>`).join('');
  modal(`<div class="flex items-center justify-between mb-3"><h2 class="text-xl font-extrabold">${id ? 'Edit card' : 'Add a word'}</h2><button class="icon-btn" data-act="closeModal">${ic('x')}</button></div>
    <div class="space-y-3">${fld('ro', 'Romanian', w.ro, 'verbs without “a”: merge')}${fld('en', 'English', w.en)}
    <div class="grid grid-cols-2 gap-2"><label class="fld"><span>Type</span><select class="inp" id="f-pos">${posSel}</select></label><label class="fld"><span>Gender</span><select class="inp" id="f-g">${genSel}</select></label></div>
    <div class="label">Verb: present tense + să</div><div class="grid grid-cols-2 gap-2">${['eu', 'tu', 'el / ea', 'noi', 'voi', 'ei / ele'].map((p, i) => fld('c' + i, p, c[i] === '—' ? '' : c[i])).join('')}</div>
    ${fld('sa', 'el / ea să …', w.sa, 'să meargă')}
    <div class="label">Noun: articles + plural</div><div class="grid grid-cols-2 gap-2">${fld('fi', 'un / o', f.i, 'o casă')}${fld('fd', 'the', f.d, 'casa')}${fld('fp', 'plural', f.p, 'două case')}${fld('fdp', 'the (plural)', f.dp, 'casele')}</div>
    <div class="label">Example</div>${fld('ex', 'Example sentence', e[0])}${fld('tr', 'Translation', e[1])}${fld('note', 'Grammar note', w.note)}</div>
    <button class="btn btn-pri btn-big mt-4" data-act="saveWord" data-id="${id || ''}">${ic('check')} Save</button>`);
}
function saveWord(id) {
  const v = k => ($('#f-' + k).value || '').trim();
  if (!v('ro') || !v('en')) return toast('Romanian and English are required');
  const w = { ro: v('ro'), en: v('en'), pos: v('pos'), g: v('g') || undefined, note: v('note') || undefined };
  const c = [0, 1, 2, 3, 4, 5].map(i => v('c' + i));
  w.conj = c.some(Boolean) ? c.map(x => x || '—') : undefined; w.sa = v('sa') || undefined;
  const f = { i: v('fi'), d: v('fd'), p: v('fp'), dp: v('fdp') }; w.forms = (f.i || f.d || f.p || f.dp) ? f : undefined;
  const old = id ? BY[id] : null, rest = old && old.ex ? old.ex.slice(1) : [];
  w.ex = v('ex') ? [[v('ex'), v('tr')]].concat(rest) : (rest.length ? rest : undefined);
  if (id && id < 10000) S.over[id] = Object.assign({}, S.over[id], w);
  else if (id) Object.assign(S.custom.find(x => x.id === id), w);
  else { w.id = 10000 + (++S.nextId); w.custom = 1; S.custom.push(w); }
  save(); rebuild(); closeModal(); render(); toast(id ? 'Card updated' : 'Word added. It will show up first in your next session');
}

/* ---------- import / export ---------- */
function toWord(r) {
  if (!r || typeof r !== 'object') return null;
  const keys = Object.keys(r), g = (...names) => { for (const k of keys) { if (names.includes(k.toLowerCase().replace(/[^a-zăâîșț]/g, ''))) { const x = r[k]; return x == null ? '' : (typeof x === 'object' ? x : String(x).trim()); } } return ''; };
  const w = {}, id = parseInt(g('id'), 10); if (id) w.id = id;
  const set = (k, x) => { if (x !== '' && x != null) w[k] = x; };
  set('ro', g('ro', 'romanian', 'word', 'cuvânt')); set('en', g('en', 'english', 'meaning', 'translationword'));
  const pos = g('pos', 'type'); if (pos) w.pos = String(pos).toLowerCase(); const gen = g('g', 'gender'); if (gen) w.g = String(gen).toLowerCase().replace(/^plural.*/, 'pl').replace(/^(m|f|n)\w+$/, '$1');
  if (Array.isArray(r.conj)) w.conj = r.conj; else { const c = [g('eu'), g('tu'), g('el', 'elea'), g('noi'), g('voi'), g('ei', 'eiele')]; if (c.some(Boolean)) { w.conj = c.map(x => x || '—'); w.pos = w.pos || 'verb'; } }
  set('sa', g('sa', 'să', 'elsă', 'elsa', 'subjunctive')); if (Array.isArray(r.saAll)) w.saAll = r.saAll; if (r.refl) w.refl = 1;
  if (r.forms && typeof r.forms === 'object') w.forms = r.forms; else { const f = { i: g('indef', 'uno', 'indefinite'), d: g('def', 'the', 'definite'), p: g('plural'), dp: g('defplural', 'theplural', 'definiteplural') }; if (f.i || f.d || f.p || f.dp) w.forms = f; }
  if (Array.isArray(r.adj)) w.adj = r.adj;
  if (Array.isArray(r.ex)) w.ex = r.ex.map(e => Array.isArray(e) ? e : [e.ro, e.en]); else { const e = g('example', 'sentence'); if (e) w.ex = [[e, g('translation', 'exampleen')]]; }
  set('note', g('note', 'grammarnote')); set('use', g('use', 'usage')); if (r.tag != null && r.tag !== '') w.tag = r.tag;
  return (w.ro || (w.id && BY[w.id])) ? w : null;
}
function mergeWord(w) {
  const t = (w.id && BY[w.id]) || (w.ro && ALL.find(x => x.ro.toLowerCase() === w.ro.toLowerCase() && (!w.pos || x.pos === w.pos)));
  if (t) {
    const patch = Object.assign({}, w, { id: t.id }); if (patch.ex) patch.deep = 1;
    if (t.id >= 10000) Object.assign(S.custom.find(x => x.id === t.id), patch); else S.over[t.id] = Object.assign({}, S.over[t.id], patch);
    return 'u';
  }
  if (!w.en) return null;
  w.id = 10000 + (++S.nextId); w.pos = w.pos || 'other'; w.custom = 1; S.custom.push(w); BY[w.id] = w; ALL.push(w); return 'a';
}
function importRecords(rows, label) {
  let a = 0, u = 0, bad = 0;
  rows.forEach(r => { const w = toWord(r), res = w && mergeWord(w); if (res === 'a') a++; else if (res === 'u') u++; else bad++; });
  if (label && (a || u) && !S.packs.includes(label)) S.packs.push(label);
  save(); rebuild(); render();
  toast(`${u} card${u === 1 ? '' : 's'} upgraded, ${a} added${bad ? ', ' + bad + ' skipped' : ''}`); if (a + u) boom();
}
function importJSON(text) {
  let o; try { o = JSON.parse(text); } catch (e) { return toast('That is not valid JSON: ' + e.message); }
  if (o && o.app === 'ro1000' && o.state) {
    if (!confirm('Restore this backup? It replaces your current progress.')) return;
    hydrate(o.state); save(); rebuild(); render(); return toast('Backup restored');
  }
  const rows = Array.isArray(o) ? o : (o && Array.isArray(o.words) ? o.words : null);
  if (!rows) return toast('No "words" list found in this JSON');
  importRecords(rows, o && o.pack ? 'Pack ' + o.pack : (o && o.name) || null);
}
function importFile(file) {
  if (!file) return;
  const name = file.name.toLowerCase(), rd = new FileReader();
  if (name.endsWith('.json')) { rd.onload = () => importJSON(rd.result); return rd.readAsText(file); }
  if (!window.XLSX) return toast('Spreadsheet import needs the bundled SheetJS library (missing in this preview)');
  rd.onload = () => {
    try { const wb = window.XLSX.read(rd.result, { type: 'array' }); importRecords(window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' }), null); }
    catch (e) { toast('Could not read that file: ' + e.message); }
  };
  rd.readAsArrayBuffer(file);
}
function exportRows() {
  return ALL.map(w => { const c = w.conj || [], f = w.forms || {}, e = (w.ex && w.ex[0]) || [], p = S.prog[w.id] || {};
    return { id: w.id, ro: w.ro, en: w.en, pos: w.pos || '', gender: w.g || '', eu: c[0] || '', tu: c[1] || '', el: c[2] || '', noi: c[3] || '', voi: c[4] || '', ei: c[5] || '', sa: w.sa || '',
      indef: f.i || '', def: f.d || '', plural: f.p || '', defplural: f.dp || '', example: e[0] || '', translation: e[1] || '', note: w.note || '', status: p.st || 'new', step: p.step || 0, due: p.due || '', lapses: p.lapses || 0 }; });
}
async function saveFile(name, data, b64, mime) {
  const F = plug('Filesystem');
  if (F) {
    const opt = Object.assign({ path: 'Romana1000/' + name, data, recursive: true }, b64 ? {} : { encoding: 'utf8' });
    try { await F.writeFile(Object.assign({ directory: 'DOCUMENTS' }, opt)); return toast('Saved to Documents/Romana1000/' + name); }
    catch (e) { try { const r = await F.writeFile(Object.assign({ directory: 'DATA' }, opt)); return toast('Saved inside the app: ' + r.uri); } catch (e2) { return toast('Could not save: ' + (e2.message || e2)); } }
  }
  let blob;
  if (b64) { const bin = atob(data), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); blob = new Blob([u8], { type: mime }); }
  else blob = new Blob([data], { type: mime });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); toast('Downloaded ' + name);
}
function exportSheet(kind) {
  if (!window.XLSX) return toast('Spreadsheet export needs the bundled SheetJS library (missing in this preview)');
  const X = window.XLSX, ws = X.utils.json_to_sheet(exportRows()), stamp = today();
  if (kind === 'csv') return saveFile('romana1000-' + stamp + '.csv', '﻿' + X.utils.sheet_to_csv(ws), false, 'text/csv');
  const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'Words');
  saveFile('romana1000-' + stamp + '.xlsx', X.write(wb, { type: 'base64', bookType: 'xlsx' }), true, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}
function packModal() {
  modal(`<div class="flex items-center justify-between mb-2"><h2 class="text-xl font-extrabold">${ic('package-plus')} Pack Importer</h2><button class="icon-btn" data-act="closeModal">${ic('x')}</button></div>
    <p class="text-sm text-slate-300 leading-snug">All 1,000 words already have full cards. Use this to add extra example sentences, corrections or new word lists: paste the JSON here or pick the file.</p>
    <textarea class="inp mt-3" id="packText" placeholder='{"pack": 2, "words": [{"id": 301, "adj": ["bun","bună","buni","bune"], "ex": [["O idee bună.","A good idea."]], "note": "…"}]}'></textarea>
    <div class="grid grid-cols-2 gap-2 mt-3"><button class="btn btn-pri" data-act="packPaste">${ic('check')} Import pasted</button><button class="btn" data-act="importFile">${ic('upload')} Choose file</button></div>
    <div class="text-xs muted mt-3 leading-snug">Each entry is matched by <b>id</b>. Fields: en, g, conj [6 forms], sa, forms {i, d, p, dp}, adj [m, f, m.pl, f.pl], ex [[ro, en]], use, note. Your progress is never touched.</div>`);
}

/* ---------- notifications ---------- */
async function scheduleReminder(ask) {
  const LN = plug('LocalNotifications');
  if (!LN) { if (ask) toast('Reminders need the Android app. An iPhone web app cannot schedule them.'); return; }
  try {
    await LN.cancel({ notifications: [{ id: 1001 }] }).catch(() => {});
    if (!S.remind.on) return;
    if (ask) { const r = await LN.requestPermissions(); if (r.display !== 'granted') { S.remind.on = false; save(); render(); return toast('Notifications are blocked. Allow them in Android settings.'); } }
    await LN.createChannel({ id: 'daily-reminder', name: 'Daily reminder', description: 'Streak and due-card reminder', importance: 5, visibility: 1, vibration: true });
    const tm = addDays(today(), 1), due = ALL.filter(w => isDue(w, tm)).length, st = liveStreak();
    await LN.schedule({ notifications: [{ id: 1001, channelId: 'daily-reminder', title: st ? `🔥 Keep your ${st}-day streak alive` : '🇷🇴 Time for Romanian',
      body: (due ? due + ' cards are due. ' : 'New words are waiting. ') + 'Hai să învățăm!', schedule: { on: { hour: S.remind.h, minute: S.remind.m }, allowWhileIdle: true } }] });
    if (ask) toast('Daily reminder set for ' + pad(S.remind.h) + ':' + pad(S.remind.m));
  } catch (e) { if (ask) toast('Could not schedule: ' + (e.message || e)); }
}

/* ---------- actions ---------- */
const A = {
  tab: el => go(el.dataset.tab), closeStage, closeModal, showCard, afterCard, reveal, study: startStudy,
  grade: el => grade(el.dataset.k), speak: el => speak(el.dataset.say),
  word: el => openWord(+el.dataset.id), addWord: () => wordForm(0), editWord: el => wordForm(+el.dataset.id), saveWord: el => saveWord(+el.dataset.id || 0),
  delWord: el => { if (!confirm('Delete this word?')) return; const id = +el.dataset.id; S.custom = S.custom.filter(w => w.id !== id); delete S.prog[id]; save(); rebuild(); closeModal(); render(); },
  revert: el => { delete S.over[+el.dataset.id]; save(); rebuild(); closeModal(); render(); toast('Original card restored'); },
  forget: el => { delete S.prog[+el.dataset.id]; save(); closeModal(); render(); },
  knowIt: el => { const id = +el.dataset.id; S.prog[id] = { st: 'mastered', step: S.intervals.length, due: null, lapses: 0, first: today(), bypass: 1 }; gain(15); save(); closeModal(); render(); },
  filter: el => { deck.f = el.dataset.f; deck.n = 60; render(); }, more: () => { deck.n += 80; $('#list').innerHTML = deckList(); },
  bookTab: el => { bookTab = el.dataset.t; render(); },
  hack: el => { const k = G.hacks.find(x => x.id === el.dataset.id); modal(hackHTML(k) + `<button class="btn w-full mt-3" data-act="closeModal">Close</button>`); },
  ivAdd: () => { S.intervals.push(Math.min(365, S.intervals[S.intervals.length - 1] * 2)); save(); render(); },
  ivDel: el => { if (S.intervals.length < 2) return toast('Keep at least one step'); S.intervals.splice(+el.dataset.i, 1); save(); render(); },
  ivReset: () => { S.intervals = [1, 2, 4, 8, 16, 30]; save(); render(); },
  remind: () => { S.remind.on = !S.remind.on; save(); render(); scheduleReminder(true); },
  auto: () => { S.auto = !S.auto; save(); render(); },
  pack: packModal, packPaste: () => { const t = $('#packText').value.trim(); if (!t) return toast('Paste the pack JSON first'); closeModal(); importJSON(t); },
  importFile: () => { closeModal(); $('#file').value = ''; $('#file').click(); },
  exportXlsx: () => exportSheet('xlsx'), exportCsv: () => exportSheet('csv'),
  exportJson: () => saveFile('romana1000-backup-' + today() + '.json', JSON.stringify({ app: 'ro1000', exported: new Date().toISOString(), state: S }), false, 'application/json'),
  copy: el => { const t = el.dataset.text; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('Copied')).catch(() => toast(t)); },
  reset: () => { if (!confirm('Reset all progress, streak and XP?')) return; const keep = { custom: S.custom, over: S.over, nextId: S.nextId, packs: S.packs, intervals: S.intervals, daily: S.daily, remind: S.remind, rate: S.rate, auto: S.auto }; S = Object.assign(defaults(), keep); save(); rebuild(); render(); toast('Progress reset'); }
};
const CHG = {
  cat: el => { deck.cat = +el.value; deck.n = 60; $('#list').innerHTML = deckList(); },
  iv: el => { const n = Math.max(1, Math.min(365, parseInt(el.value, 10) || 1)); S.intervals[+el.dataset.i] = n; el.value = n; save(); },
  remindTime: el => { const p = el.value.split(':'); if (p.length < 2) return; S.remind.h = +p[0]; S.remind.m = +p[1]; save(); if (S.remind.on) scheduleReminder(true); }
};
const INP = {
  search: el => { deck.q = el.value; deck.n = 60; $('#list').innerHTML = deckList(); },
  daily: el => { S.daily = +el.value; $('#dailyV').textContent = S.daily; save(); },
  rate: el => { S.rate = +el.value; $('#rateV').textContent = S.rate.toFixed(2) + '×'; save(); }
};
document.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (el && A[el.dataset.act]) A[el.dataset.act](el, e); });
document.addEventListener('change', e => { const el = e.target.closest('[data-chg]'); if (el && CHG[el.dataset.chg]) CHG[el.dataset.chg](el); });
document.addEventListener('input', e => { const el = e.target.closest('[data-inp]'); if (el && INP[el.dataset.inp]) INP[el.dataset.inp](el); });
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
$('#file').addEventListener('change', e => importFile(e.target.files[0]));
window.addEventListener('popstate', () => {
  if (!$('#modal').classList.contains('hidden')) closeModal();
  else if (!$('#stage').classList.contains('hidden')) closeStage();
  else if (tab !== 'home') { tab = 'home'; render(); }
  else return;                                                 // nothing open: the next Back leaves the app
  history.pushState(1, '');
});
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

window.APP = { get S() { return S; }, get ALL() { return ALL; }, get BY() { return BY; }, G, A, $, esc, rnd, shuffle, ic, spk, speak, canSpeak, stage, topBar, closeStage, modal, closeModal,
  toast, boom, gain, save, later, every, clearTimers, today, dayDiff, title, status, render, hackHTML };

/* ---------- boot ---------- */
async function boot() {
  hydrate(localStorage.getItem(KEY));
  const P = plug('Preferences');
  if (P && !localStorage.getItem(KEY)) { try { const r = await P.get({ key: KEY }); if (r && r.value) hydrate(r.value); } catch (e) { /* first run */ } }
  rebuild(); render(); sentinel();
  if (S.remind.on) scheduleReminder();
  if (window.speechSynthesis) window.speechSynthesis.getVoices();
}
boot();
})();
