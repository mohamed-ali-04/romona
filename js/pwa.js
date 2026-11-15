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
})();
