/* Română 1000 - web app glue: offline service worker, persistent storage, install hint. */
(() => {
'use strict';
const standalone = window.navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);

// 1. Offline: sw.js caches every file of the app on the first visit.
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(e => console.warn('service worker:', e)); });
}

// 2. Ask the browser not to evict localStorage (progress, streak, custom words).
async function persist() {
  if (!navigator.storage || !navigator.storage.persist) return false;
  try { return (await navigator.storage.persisted()) || (await navigator.storage.persist()); } catch (e) { return false; }
}
persist().then(ok => { window.RO_PERSISTED = ok; });
// Some browsers only grant it after a user gesture, so ask once more on the first tap.
document.addEventListener('click', function once() { document.removeEventListener('click', once); persist().then(ok => { window.RO_PERSISTED = ok; }); });

// 3. In a browser tab on an iPhone, explain how to install. Storage is only durable once the app is on the Home Screen.
const iOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let dismissed = false; try { dismissed = localStorage.getItem('ro1000.tip') === '1'; } catch (e) { /* private mode */ }
if (iOS && !standalone && !dismissed) {
  const tip = document.createElement('div'); tip.id = 'pwa-tip';
  tip.innerHTML = '<span>Install it: tap <b>Share</b>, then <b>Add to Home Screen</b>. Open it from the Home Screen from then on, because that copy keeps its own progress.</span><button type="button">OK</button>';
  tip.querySelector('button').addEventListener('click', () => { tip.remove(); try { localStorage.setItem('ro1000.tip', '1'); } catch (e) { /* ignore */ } });
  document.body.appendChild(tip);
}

// 4. Voice check (Setări): shows what the phone's speech engine reports, so a silent voice can be diagnosed from a screenshot.
const P = window.APP;
if (P) {
  const info = () => {
    const ss = window.speechSynthesis, v = ss ? ss.getVoices() : [], ro = v.filter(x => /^ro/i.test(x.lang));
    const rows = [['Opened from Home Screen', standalone ? 'yes' : 'no (browser tab)'], ['Speech engine', ss ? 'present' : 'MISSING'], ['Voices on this phone', v.length],
      ['Romanian voices', ro.length ? ro.map(x => x.name + ' [' + x.lang + (x.localService ? ', on device' : ', network') + ']').join('; ') : 'NONE'],
      ['Engine state', ss ? 'speaking=' + ss.speaking + ' pending=' + ss.pending + ' paused=' + ss.paused : '-'], ['Storage persisted', String(window.RO_PERSISTED)]];
    return rows.map(r => '<div class="ex"><div><span>' + P.esc(r[0]) + '</span><b>' + P.esc(r[1]) + '</b></div></div>').join('') +
      '<div class="label">Last speech events</div><div class="callout blue" style="font-family:ui-monospace,monospace;font-size:12px;white-space:pre-wrap">' + P.esc((window.RO_SPEECH_LOG || ['(nothing yet)']).join('\n')) + '</div>';
  };
  const show = () => {
    P.modal('<div class="flex items-center justify-between mb-2"><h2 class="text-xl font-extrabold">Voice check</h2><button class="icon-btn" data-act="closeModal">✕</button></div>' +
      '<div class="text-xs muted" id="vc-ver">App version: …</div><div id="vc-info">' + info() + '</div>' +
      '<div class="grid grid-cols-2 gap-2 mt-3"><button class="btn btn-pri btn-sm" data-act="vcRaw" data-lang="ro-RO" data-say="Bună ziua, ce mai faci?">Raw test: Romanian</button><button class="btn btn-sm" data-act="vcRaw" data-lang="en-US" data-say="Hello, this is a test.">Raw test: English</button></div>' +
      '<button class="btn btn-sm w-full mt-2" data-act="voiceCheck">Refresh</button>' +
      '<div class="text-xs muted mt-3 leading-snug">Tap a raw test, wait three seconds, tap Refresh, then screenshot this panel. If the events say start and end but you heard nothing, the phone is muting it: check the silent switch and the volume.</div>');
    if (window.caches) caches.keys().then(k => { const el = document.getElementById('vc-ver'); if (el) el.textContent = 'App version: ' + (k.filter(x => x.startsWith('ro1000-')).join(', ') || 'not cached'); });
  };
  P.A.voiceCheck = show;
  // the barest possible call, straight from the tap, bypassing the app's own speech code
  P.A.vcRaw = el => {
    const ss = window.speechSynthesis, L = window.RO_SPEECH_LOG = window.RO_SPEECH_LOG || [], t = () => new Date().toTimeString().slice(0, 8) + ' RAW ' + el.dataset.lang + ' ';
    if (!ss) return L.push(t() + 'no speechSynthesis');
    try {
      const u = new SpeechSynthesisUtterance(el.dataset.say); u.lang = el.dataset.lang;
      u.onstart = () => L.push(t() + 'start'); u.onend = () => L.push(t() + 'end'); u.onerror = e => L.push(t() + 'error: ' + (e && e.error));
      window.__rawUtterance = u; L.push(t() + 'speak() called'); ss.speak(u);
    } catch (e) { L.push(t() + 'threw: ' + e.message); }
  };
}
})();
