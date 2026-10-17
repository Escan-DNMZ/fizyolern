// Service Worker: alle App-Dateien offline verfügbar machen.
// Bei jeder Änderung an den Dateien VERSION erhöhen, damit Handys die neue Version laden.
const VERSION = 'fizyolern-v34';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
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
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Netzwerk zuerst (damit Updates ankommen), bei Offline aus dem Cache
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    // no-cache: immer beim Server nachfragen (ETag), damit nach einem Update keine alten und neuen Dateien gemischt werden
    fetch(e.request, new URL(e.request.url).origin === location.origin ? { cache: 'no-cache' } : {})
      .then((res) => {
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html'))),
  );
});
