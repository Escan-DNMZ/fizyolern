// Service Worker: alle App-Dateien offline verfügbar machen.
// Bei jeder Änderung an den Dateien VERSION erhöhen, damit Handys die neue Version laden.
const VERSION = 'fizyolern-v42';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/i18n.js',
  './js/strings.js',
  './js/store.js',
  './js/quizgen.js',
  './js/lessons.js',
  './js/anatomy3d.js',
  './js/data/anatomy.js',
  './js/data/muscle3d.js', './js/data/landmarks.js', './js/data/axes.js',
  './js/data/uebungen.js',
  './js/data/vocab.js',
  './js/data/questions.js',
  './js/data/lessons.js',
  './js/data/grundwortschatz.js',
  './js/private.js',
  './js/notion.js',
  './js/report.js',
  './js/exam.js',
  './js/words.js',
  './js/fuzzy.js',
  './js/befund.js',
  './js/data/cases.js',
  './js/oral.js',
  './js/speech.js',
  './vendor/three.module.min.js',
  './vendor/OrbitControls.js',
  './vendor/GLTFLoader.js',
  './vendor/DRACOLoader.js',
  './vendor/BufferGeometryUtils.js',
  './vendor/draco/draco_decoder.wasm',
  './vendor/draco/draco_wasm_wrapper.js',
  './models/bones.glb',
  './models/muscles.glb',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      // nur alte FizyoLern-Caches löschen (gleiche Domain kann andere Seiten haben)
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('fizyolern-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Netzwerk zuerst (damit Updates ankommen), bei Offline aus dem Cache
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Fremde Adressen (z. B. api.notion.com) gehen am Service Worker vorbei – nie zwischenspeichern
  if (url.origin !== location.origin) return;
  // private Dateien (nur beim Entwickeln vorhanden) nie in den Cache
  const privat = url.pathname.includes('/private/');
  e.respondWith(
    // no-cache: immer beim Server nachfragen (ETag), damit nach einem Update keine alten und neuen Dateien gemischt werden
    fetch(e.request, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok && !privat) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => (privat ? Response.error() : caches.match(e.request, { ignoreSearch: true })
        .then((r) => r || (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())))),
  );
});
