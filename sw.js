// Service worker: кэширует приложение, чтобы работало и без интернета.
// Версия кэша поднимается при каждом обновлении кода — тогда старая копия
// гарантированно выбрасывается и подтягивается новая.
const CACHE = 'calculator-v19';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './versions.html',
  './b3-34.html',
  './b3-34.js',
  './b3-34.css',
  './b3-34-fix.js',
  './b3-34-follow.js',
  './b3-34-study.js',
  './b3-34-nostudy.js',
  './b3-34-panel.js',
  './catalog.js',
  './b3-34-v2.html',
  './b3-34-v3.html',
  './b3-34-v4.html',
  './b3-34-v5.html',
  './b3-34-v6.html',
  './b3-34-v7.html',
  './b3-34-v8.html',
  './b3-34-classic.html',
  './b3-34-export.js',
  './b3-34-txt.html',
  './core.js',
  './programs.js',
  './ui.js',
  './storage.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const isPage = event.request.mode === 'navigate';

  if (isPage) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((c) => c || caches.match('./index.html')))
  );
});
