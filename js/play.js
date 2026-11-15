/* Română 1000 - arcade games, quiz runner, Boss Quiz and Course Book Companion lessons. */
(() => {
'use strict';
const P = window.APP, { G, A, $, esc, rnd, shuffle, ic, spk, speak, stage, topBar, toast, boom, gain, save, later, every, clearTimers, title } = P;
const pick = (a, n) => shuffle(a).slice(0, n);
const uniq = a => a.filter((x, i) => x && a.indexOf(x) === i);
const clean = s => String(s || '').replace(/\s*\(.*?\)/g, '').replace(/^(un|o|doi|două|niște)\s+/, '').trim();
const present = f => String(f).replace(/\s*\(.*?\)/g, '');

/* ---------- pools ---------- */
const verbPool = () => P.ALL.filter(w => w.pos === 'verb' && w.conj && !w.imp && w.sa && w.conj.every(f => f && f !== '—'));
const snapPool = () => P.ALL.filter(w => w.forms && w.forms.d && w.forms.p && w.forms.dp && !/[(—]/.test(w.forms.p) && w.forms.dp !== '—' && w.g !== 'pl' && w.ro !== 'bani')
  .map(w => ({ w, bare: w.ro, i: w.forms.i, d: clean(w.forms.d), p: clean(w.forms.p), dp: clean(w.forms.dp) }));
// Games and quizzes only ever use words you have studied (learning) or marked as known (mastered).
const isSeen = w => !!P.S.prog[w.id];
const seenWords = () => P.ALL.filter(isSeen);
const seenVerbs = () => verbPool().filter(isSeen);
const seenNouns = () => snapPool().filter(n => isSeen(n.w));
function sentencePool(words, min, max) {
  const out = [], had = new Set();
  words.forEach(w => (w.ex || []).forEach(e => { const n = e[0].split(/\s+/).length; if (n >= min && n <= max && !/[—\/…]/.test(e[0]) && !had.has(e[0])) { had.add(e[0]); out.push(e); } }));
  return out;
}
function bridgePool() {                                          // sentences from your own cards, the să ones first
  const all = sentencePool(seenWords(), 3, 8), sa = all.filter(e => /(^|\s)să(\s|-)/i.test(e[0]));
  return shuffle(sa).concat(shuffle(all.filter(e => !sa.includes(e)))).slice(0, 8);
}
const blitzPool = () => seenWords().filter(w => String(w.en).length <= 26);
function recentPool() {
  const t = P.today(), S = P.S, seen = seenWords();
  const recent = seen.filter(w => { const p = S.prog[w.id]; return p.first && P.dayDiff(p.first, t) <= 10; });
  return recent.length >= 12 ? recent : seen;
}
function gameReq(k) {
  const need = (have, min, what) => have >= min ? '' : '🔒 Learn ' + (min - have) + ' more ' + what + (min - have === 1 ? '' : 's') + ' to unlock';
  if (k === 'gBridge') return need(bridgePool().length, 3, 'word');
  if (k === 'gSnap') return need(seenNouns().length, 4, 'noun');
  if (k === 'gRoulette') return need(seenVerbs().length, 3, 'verb');
  if (k === 'gBlitz') return need(blitzPool().length, 6, 'word');
  if (k === 'boss') return need(seenWords().length, 10, 'word');
  return '';
}
P.gameReq = gameReq;

/* ---------- question factories ---------- */
function qSnap(n, mode) {
  mode = mode || ['d', 'p', 'dp'][rnd(3)];
  const label = { d: 'THE', p: 'PLURAL', dp: 'THE + PLURAL' }[mode];
  return { type: 'mc', two: 1, tag: 'Article & plural', prompt: n.i, sub: `Snap it to: <b class="text-amber-300">${label}</b>`, opts: shuffle(uniq([n.bare, n.d, n.p, n.dp])), ans: n[mode], say: n[mode], why: `${n.i} → ${n.d} → ${n.p} → ${n.dp}` + (n.w.note ? '. ' + n.w.note : '') };
}
function qVerb(v, idx) {
  const PR = ['EU', 'TU', 'EL / EA', 'NOI', 'VOI', 'EI / ELE', 'EL / EA SĂ…'];
  const forms = v.conj.map(present), sa = (v.saAll ? v.saAll[2] : v.sa).replace(/^să\s+/, '');
  if (idx == null) idx = rnd(7);
  const ans = idx === 6 ? sa : forms[idx];
  let opts = uniq([ans].concat(shuffle(uniq(forms.concat([sa])).filter(f => f !== ans)))).slice(0, 4);
  return { type: 'mc', two: 1, tag: 'Verb form', prompt: PR[idx], sub: `<b class="text-sky-300">${esc(title(v))}</b> · ${esc(v.en)}`, opts: shuffle(opts), ans, say: (idx === 6 ? 'să ' : '') + ans, why: v.note || '' };
}
function qMeaning(w, pool, listen) {
  const others = pick(pool.filter(x => x.id !== w.id && x.en !== w.en), 3).map(x => x.en);
  return { type: 'mc', tag: listen ? 'Listening' : 'Meaning', prompt: listen ? null : title(w), listen: listen ? title(w) : null, sub: listen ? 'Listen, then pick the meaning' : 'What does it mean?', opts: shuffle(uniq([w.en].concat(others))), ans: w.en, say: listen ? null : title(w), why: listen ? 'You heard: ' + title(w) : '' };
}
function qBuild(ro, en) { return { type: 'build', tag: 'Sentence builder', words: ro.replace(/[.,!?;:—"„”]/g, ' ').split(/\s+/).filter(Boolean), en, full: ro }; }

/* ---------- quiz runner (Boss Quiz + lesson quizzes) ---------- */
function runQuiz(name, qs, onEnd) {
  let i = 0, right = 0; const marks = [];
  const head = () => topBar(name, `<span class="chip">${right} ✓</span>`) + `<div class="dots mb-3">${qs.map((q, k) => `<i class="${k < i ? (marks[k] ? 'ok' : 'bad') : k === i ? 'cur' : ''}"></i>`).join('')}</div>`;
  const done = ok => { marks[i] = ok; if (ok) right++; };
  const next = () => { i++; i < qs.length ? show() : onEnd(right, qs.length); };
  function show() {
    const q = qs[i];
    if (q.type === 'build') return buildUI(q, { head, free: true, onDone: ok => { done(ok); verdict(ok, q.full, q.en); } });
    stage(head() + `<div class="glass p-5 text-center"><div class="chip">${esc(q.tag || 'Question')} · ${i + 1}/${qs.length}</div>
      ${q.listen ? `<div class="mt-4">${spk(q.listen)}</div>` : `<div class="text-3xl font-extrabold mt-3 leading-tight">${esc(q.prompt)}</div>`}
      <div class="text-sm text-slate-300 mt-2">${q.sub || ''}</div></div>
      <div class="${q.two ? 'opts2' : 'space-y-2'} mt-4" id="opts">${q.opts.map(o => `<button class="opt" data-act="qPick" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div><div id="fb" class="mt-3"></div>`);
    if (q.listen) later(() => speak(q.listen), 350);
  }
  function verdict(ok, answer, extra) {
    $('#fb').innerHTML = `<div class="callout ${ok ? '' : 'red'}"><b>${ok ? 'Corect!' : 'Not quite.'}</b> ${ok ? '' : 'Answer: <b>' + esc(answer) + '</b>. '}${esc(extra || '')}</div>
      <button class="btn btn-pri btn-big mt-3" data-act="qNext">${i + 1 < qs.length ? 'Next' : 'See result'} ${ic('chevron-right')}</button>`;
    $('#fb').scrollIntoView({ block: 'end', behavior: 'smooth' });
  }
  A.qPick = el => {
    const q = qs[i]; if (marks[i] !== undefined) return;
    const ok = el.dataset.v === q.ans; done(ok);
    $('#opts').querySelectorAll('.opt').forEach(b => { if (b.dataset.v === q.ans) b.classList.add('ok'); else if (b === el) b.classList.add('bad'); });
    if (q.say) speak(q.say);
    verdict(ok, q.ans, q.why);
  };
  A.qNext = next;
  show();
}

/* ---------- tile builder (shared by the quiz and by Bridge Builder) ---------- */
function buildUI(q, o) {
  const tiles = (() => { let t, n = 0; do { t = shuffle(q.words.map((w, k) => ({ w, k }))); } while (q.words.length > 2 && t.every((x, k) => x.w === q.words[k]) && ++n < 9); return t; })();
  let placed = [];
  stage(o.head() + `<div class="glass p-5"><div class="chip">${esc(q.tag || 'Build it')}</div><div class="text-xl font-bold mt-3 leading-snug">${esc(q.en)}</div>${o.extra || ''}
    <div class="slot mt-4" id="slot"></div></div><div class="flex flex-wrap gap-2 mt-4 justify-center" id="bank"></div><div id="fb" class="mt-3"></div>`);
  let locked = false;
  const draw = () => {
    $('#slot').innerHTML = placed.map((t, k) => `<button class="tile" data-act="tOut" data-k="${k}">${esc(t.w)}</button>`).join('');
    $('#bank').innerHTML = tiles.map((t, k) => `<button class="tile ${placed.includes(t) ? 'used' : ''}" data-act="tIn" data-k="${k}">${esc(t.w)}</button>`).join('');
  };
  A.tIn = el => {
    if (locked) return; const t = tiles[+el.dataset.k]; if (placed.includes(t)) return;
    if (!o.free && t.w !== q.words[placed.length]) { el.classList.add('shake'); later(() => el.classList.remove('shake'), 380); return o.onWrong && o.onWrong(); }
    placed.push(t); draw();
    if (placed.length === q.words.length) { locked = true; const ok = placed.every((x, k) => x.w === q.words[k]); speak(q.full); o.onDone(ok); }
  };
  A.tOut = el => { if (locked || !o.free) return; placed.splice(+el.dataset.k, 1); draw(); };
  draw();
}

/* ---------- arcade shell ---------- */
function endGame(key, name, score, line, again) {
  clearTimers(); const S = P.S, best = S.hi[key] || 0, xp = Math.min(80, Math.round(score / 4));
  if (score > best) S.hi[key] = score; gain(xp); save(); if (score > best && score > 0) boom(true);
  stage(topBar(name) + `<div class="glass flash front"><div class="muted text-sm uppercase tracking-wide font-bold">Score</div><div class="big-num gt">${score}</div>
    <div class="mt-2">${score > best && score > 0 ? '<span class="chip mastered">New best!</span>' : '<span class="chip">Best: ' + best + '</span>'} <span class="chip">${ic('zap')} +${xp} XP</span></div>
    <div class="text-sm text-slate-300 mt-4">${line || ''}</div></div>
    <div class="grid grid-cols-2 gap-2 mt-3"><button class="btn" data-act="closeStage">Close</button><button class="btn btn-pri" data-act="${again}">${ic('rotate-ccw')} Play again</button></div>`);
}
const hud = (score, combo, lives) => `<span class="chip">${ic('zap')} ${score}</span>${combo > 1 ? `<span class="chip on">×${combo}</span>` : ''}${lives != null ? `<span class="chip irr">${'♥'.repeat(Math.max(0, lives))}${'♡'.repeat(Math.max(0, 3 - lives))}</span>` : ''}`;
function countdown(sec, onEnd, sel) {
  const t0 = Date.now(); let stop = false;
  const id = every(() => { if (stop) return; const left = 1 - (Date.now() - t0) / (sec * 1000), el = $(sel || '#tm'); if (el) el.style.width = Math.max(0, left * 100) + '%'; if (left <= 0) { stop = true; clearInterval(id); onEnd(); } }, 80);
  return { left: () => Math.max(0, sec - (Date.now() - t0) / 1000), stop: () => { stop = true; clearInterval(id); } };
}

/* 1. „Să” Bridge Builder */
A.gBridge = () => {
  const lock = gameReq('gBridge'); if (lock) return toast(lock);
  clearTimers(); const list = shuffle(bridgePool()); let n = 0, score = 0, combo = 0, lives = 3, cd;
  const round = () => {
    if (n >= list.length || lives <= 0) return endGame('gBridge', '„Să” Bridge Builder', score, lives > 0 ? 'All bridges built, using sentences from your own cards.' : 'Out of time. These sentences come from cards you have studied.', 'gBridge');
    const q = qBuild(list[n][0], list[n][1]); q.tag = `Bridge ${n + 1} of ${list.length}`;
    buildUI(q, { head: () => topBar('„Să” Bridge Builder', hud(score, combo, lives)) + '<div class="timer mb-3"><i id="tm"></i></div>',
      onWrong: () => { combo = 0; },
      onDone: () => { cd.stop(); combo++; score += 10 * Math.min(combo, 5) + Math.round(cd.left()); n++; $('#fb').innerHTML = `<div class="callout"><b>Corect!</b> ${esc(q.full)}.</div>`; later(round, 1300); } });
    cd = countdown(12 + q.words.length * 2.5, () => { lives--; combo = 0; n++; $('#fb').innerHTML = `<div class="callout red"><b>Time!</b> ${esc(q.full)}.</div>`; speak(q.full); later(round, 1900); });
  };
  round();
};

/* 2. Article & Plural Snap */
A.gSnap = () => {
  const lock = gameReq('gSnap'); if (lock) return toast(lock);
  clearTimers(); const pool = shuffle(seenNouns()); let n = 0, score = 0, combo = 0, lives = 3, busy = false, cur;
  const total = Math.min(15, pool.length);
  const round = () => {
    if (n >= total || lives <= 0) return endGame('gSnap', 'Article & Plural Snap', score, lives > 0 ? 'You caught them all.' : 'Three nouns hit the floor. The rebels need another round.', 'gSnap');
    cur = qSnap(pool[n]); busy = false; const dur = Math.max(3.6, 7.5 - n * 0.3);
    stage(topBar('Article & Plural Snap', hud(score, combo, lives)) + `<div class="lane"><div class="fall" id="fall" style="animation-duration:${dur}s"><div class="text-xs muted uppercase font-bold">${n + 1}/${total} · ${cur.sub}</div><div class="text-3xl font-extrabold">${esc(cur.prompt)}</div></div></div>
      <div class="opts2 mt-3" id="opts">${cur.opts.map(o => `<button class="opt" data-act="snapPick" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div><div id="fb" class="mt-2 text-sm text-center muted" style="min-height:40px"></div>`);
    $('#fall').addEventListener('animationend', () => settle(null));
  };
  const settle = el => {
    if (busy) return; busy = true; const ok = !!el && el.dataset.v === cur.ans;
    $('#fall').style.animationPlayState = 'paused';
    $('#opts').querySelectorAll('.opt').forEach(b => { if (b.dataset.v === cur.ans) b.classList.add('ok'); else if (b === el) b.classList.add('bad'); });
    if (ok) { combo++; score += 10 * Math.min(combo, 5); } else { combo = 0; lives--; }
    $('#fb').textContent = cur.why; speak(cur.say); n++; later(round, ok ? 1100 : 2400);
  };
  A.snapPick = settle; round();
};

/* 3. Verb Ending Roulette */
A.gRoulette = () => {
  const lock = gameReq('gRoulette'); if (lock) return toast(lock);
  clearTimers(); const all = seenVerbs(), irr = all.filter(v => v.tag === 'irr'); let n = 0, score = 0, combo = 0, right = 0, busy = false, cur, cd; const total = 12;
  const PR = ['EU', 'TU', 'EL / EA', 'NOI', 'VOI', 'EI / ELE', 'EL / EA SĂ…'];
  const round = () => {
    if (n >= total) return endGame('gRoulette', 'Verb Ending Roulette', score, `${right} of ${total} correct.`, 'gRoulette');
    const src = irr.length && Math.random() < 0.75 ? irr : all, v = src[rnd(src.length)];
    cur = qVerb(v); busy = true;
    stage(topBar('Verb Ending Roulette', hud(score, combo)) + '<div class="timer mb-3"><i id="tm"></i></div>' + `<div class="glass p-5 text-center"><div class="chip">${n + 1}/${total}</div>
      <div class="pron gt mt-3" id="pron">…</div><div class="text-xl font-bold mt-2">${cur.sub}</div></div>
      <div class="opts2 mt-4" id="opts">${cur.opts.map(o => `<button class="opt" data-act="rlPick" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div><div id="fb" class="mt-3"></div>`);
    let spins = 0; const sp = every(() => { const el = $('#pron'); if (!el) return clearInterval(sp); spins++; el.textContent = spins < 9 ? PR[rnd(7)] : cur.prompt; if (spins >= 9) { clearInterval(sp); busy = false; cd = countdown(8, () => settle(null)); } }, 70);
  };
  const settle = el => {
    if (busy) return; busy = true; cd.stop(); const ok = !!el && el.dataset.v === cur.ans;
    $('#opts').querySelectorAll('.opt').forEach(b => { if (b.dataset.v === cur.ans) b.classList.add('ok'); else if (b === el) b.classList.add('bad'); });
    if (ok) { combo++; right++; score += 10 * Math.min(combo, 5) + Math.round(cd.left()); } else combo = 0;
    if (!ok && cur.why) $('#fb').innerHTML = `<div class="callout red">${esc(cur.why)}</div>`;
    speak(cur.say); n++; later(round, ok ? 900 : 2600);
  };
  A.rlPick = settle; round();
};

/* 4. 60-Second Blitz Match */
A.gBlitz = () => {
  const lock = gameReq('gBlitz'); if (lock) return toast(lock);
  clearTimers(); const src = blitzPool();
  let score = 0, combo = 0, sel = null, left = 0, tilesData = [], over = false;
  const board = () => {
    const ws = [], ro = new Set(), en = new Set();
    for (const w of shuffle(src)) { if (ws.length === 6) break; if (ro.has(w.ro) || en.has(w.en)) continue; ro.add(w.ro); en.add(w.en); ws.push(w); }
    tilesData = shuffle(ws.map(w => ({ id: w.id, side: 'ro', t: title(w) })).concat(ws.map(w => ({ id: w.id, side: 'en', t: w.en })))); left = ws.length; sel = null;
    $('#grid').innerHTML = tilesData.map((t, k) => `<button class="mt-tile ${t.side}" data-act="mtPick" data-k="${k}">${esc(t.t)}</button>`).join('');
  };
  stage(topBar('60-Second Blitz Match', '<span id="hud" class="flex gap-2"></span>') + '<div class="timer mb-3"><i id="tm"></i></div><div class="grid grid-cols-3 gap-2" id="grid"></div>');
  const paint = () => { const h = $('#hud'); if (h) h.innerHTML = hud(score, combo); };
  A.mtPick = el => {
    if (over) return; const k = +el.dataset.k, t = tilesData[k];
    if (sel === null) { sel = k; return el.classList.add('sel'); }
    if (sel === k) { sel = null; return el.classList.remove('sel'); }
    const a = tilesData[sel], first = $('#grid').children[sel]; first.classList.remove('sel');
    if (a.id === t.id && a.side !== t.side) {
      combo++; score += 10 * Math.min(combo, 6); first.classList.add('gone'); el.classList.add('gone'); left--;
      if (a.side === 'ro' ? a.t : t.t) speak(a.side === 'ro' ? a.t : t.t);
      if (!left) later(board, 320);
    } else { combo = 0; [first, el].forEach(x => { x.classList.add('shake'); later(() => x.classList.remove('shake'), 380); }); }
    sel = null; paint();
  };
  board(); paint();
  countdown(60, () => { over = true; endGame('gBlitz', '60-Second Blitz Match', score, 'Sixty seconds, done.', 'gBlitz'); });
};

/* ---------- Boss Quiz ---------- */
A.boss = () => {
  const lock = gameReq('boss'); if (lock) return toast(lock);
  clearTimers(); const S = P.S, pool = recentPool(), all = seenWords(), inPool = new Set(pool.map(w => w.id));
  const prefer = (list, id) => { const r = list.filter(x => inPool.has(id(x))); return r.length >= 3 ? r : list; };   // recent words first, older learned words as backup
  const verbs = prefer(seenVerbs(), v => v.id), nouns = prefer(seenNouns(), n => n.w.id);
  const flips = verbs.filter(v => v.sa !== 'să ' + present(v.conj[2]));
  const sents = sentencePool(pool, 3, 7), distract = pool.length >= 8 ? pool : all;
  let qs = [];
  pick(flips.length ? flips : verbs, 3).forEach(v => qs.push(Object.assign(qVerb(v, 6), { tag: 'The să flip' })));
  pick(verbs, 3).forEach(v => qs.push(qVerb(v, rnd(6))));
  pick(nouns, 5).forEach(n => qs.push(qSnap(n)));
  pick(sents, 3).forEach(b => qs.push(qBuild(b[0], b[1])));
  const rest = shuffle(pool);                                    // fill up to 20 with meaning and listening questions
  for (let i = 0; qs.length < 20 && i < rest.length * 3; i++) qs.push(qMeaning(rest[i % rest.length], distract, i % 3 === 2 && P.canSpeak()));
  qs = shuffle(qs).slice(0, 20);
  stage(topBar('Boss Quiz') + `<div class="glass flash front"><div style="font-size:56px">⚔️</div><div class="text-3xl font-extrabold gt mt-2">Boss Quiz</div>
    <div class="text-slate-300 mt-2 leading-snug">${qs.length} questions on the words you have learned, the last 10 days first: verb forms, articles and plurals, sentence building and listening.</div>
    <div class="flex gap-2 mt-4 flex-wrap justify-center"><span class="chip">80% to win</span><span class="chip mastered">${ic('trophy')} trophy</span><span class="chip new">${ic('shield')} Streak Freeze</span><span class="chip learning">+200 XP</span></div></div>
    <button class="btn btn-gold btn-big mt-3" data-act="bossGo">${ic('swords')} Fight!</button>`);
  A.bossGo = () => runQuiz('Boss Quiz', qs, (right, total) => {
    const pct = Math.round(right / total * 100), win = pct >= 80;
    S.bossLog.push({ d: P.today(), pct });
    if (win) { S.trophies++; S.freezes++; S.bossDue = false; gain(200); boom(true); } else gain(right * 3);
    save();
    stage(topBar('Boss Quiz') + `<div class="glass flash front"><div style="font-size:56px">${win ? '🏆' : '🛡️'}</div><div class="big-num gt mt-2">${pct}%</div><div class="muted">${right} of ${total}</div>
      <div class="text-xl font-bold mt-4">${win ? 'Boss defeated!' : 'So close. The boss survives.'}</div>
      <div class="text-sm text-slate-300 mt-2">${win ? 'Trophy unlocked, +1 Streak Freeze, +200 XP.' : 'You need 80%. Review the missed forms and try again whenever you like.'}</div></div>
      <div class="grid grid-cols-2 gap-2 mt-3"><button class="btn" data-act="closeStage">Close</button><button class="btn btn-pri" data-act="boss">${ic('rotate-ccw')} ${win ? 'Again' : 'Rematch'}</button></div>`);
  });
};

/* ---------- quiz on a given list of words ---------- */
P.quizWords = (name, words, onEnd) => {
  const vp = seenVerbs(), np = seenNouns(), all = seenWords(), distract = all.length >= 8 ? all : words, qs = [];
  shuffle(words).slice(0, 20).forEach((w, i) => {
    const n = np.find(x => x.w === w);
    if (vp.includes(w) && i % 2) qs.push(qVerb(w)); else if (n && i % 2) qs.push(qSnap(n));
    else qs.push(qMeaning(w, distract, i % 4 === 3 && P.canSpeak()));
  });
  runQuiz(name, qs, onEnd);
};

/* ---------- Course Book Companion ---------- */
A.lesson = el => {
  const l = G.lessons[+el.dataset.i];
  P.modal(`<div class="lesson"><div class="flex items-center justify-between"><span class="chip">${ic('book-open')} Lecția ${l.L} · manual p. ${l.pages}</span><button class="icon-btn" data-act="closeModal">${ic('x')}</button></div>
    <h2 class="text-2xl font-extrabold mt-3 leading-tight">${esc(l.title)}</h2><ul>${l.pts.map(p => `<li>${p}</li>`).join('')}</ul>
    ${l.ex.map(e => `<div class="ex">${spk(e[0])}<div><b>${esc(e[0])}</b><span>${esc(e[1])}</span></div></div>`).join('')}</div>
    <button class="btn btn-pri btn-big mt-4" data-act="lessonQuiz" data-i="${el.dataset.i}">${ic('play')} Quiz me (${l.quiz.length} questions)</button>`);
};
A.lessonQuiz = el => {
  const l = G.lessons[+el.dataset.i]; P.closeModal();
  const qs = l.quiz.map(q => ({ type: 'mc', tag: 'Lecția ' + l.L, prompt: q.q, sub: '', opts: q.o, ans: q.o[q.a], why: q.why }));
  runQuiz('Lecția ' + l.L + ' · ' + l.title, qs, (right, total) => {
    const perfect = right === total, S = P.S;
    if (perfect && !S.lessonsDone[l.L]) { S.lessonsDone[l.L] = P.today(); gain(40); boom(); } else gain(right * 5);
    save();
    stage(topBar('Lecția ' + l.L) + `<div class="glass flash front"><div class="big-num gt">${right}/${total}</div>
      <div class="text-xl font-bold mt-3">${perfect ? 'Lesson cleared ✓' : 'Almost. Read the card once more.'}</div>
      <div class="text-sm text-slate-300 mt-2">Full explanation: Learn Romanian Manual, p. ${l.pages}.</div></div>
      <button class="btn btn-pri btn-big mt-3" data-act="closeStage">Done</button>`);
  });
};
})();
