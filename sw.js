/* Service Worker: кэшируем статику, чтобы игра открывалась быстро и работала офлайн
   (онлайн-режим, разумеется, требует соединения с сервером). */
const CACHE = 'royal-chess-v2';
const ASSETS = [
  '/', '/index.html', '/style.css',
  '/pieces.js', '/icons.js', '/audio.js', '/bots.js', '/engine.js',
  '/ai.js', '/stockfish-engine.js', '/analysis.js', '/online.js',
  '/menu.js', '/app.js', '/pwa.js', '/favicon.svg',
  '/stockfish/stockfish.js', '/stockfish/stockfish.wasm.js', '/stockfish/stockfish.wasm'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k !== CACHE).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  // Network-first: свежая версия с сервера при каждом деплое,
  // кэш используется только офлайн/при недоступности сети.
  e.respondWith(
    fetch(e.request).then(res => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(async () => {
      const hit = await caches.match(e.request);
      if (hit) return hit;
      if (e.request.mode === 'navigate') return caches.match('/index.html');
      return Response.error();
    })
  );
});
