const cacheName = 'e4e5-v6';
const staticFiles = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './htm.js',
  './chess.js',
  './stockfish.js',
  './stockfish.wasm.js',
  './stockfish.wasm',
  './pieces/light/wp.svg',
  './pieces/light/wn.svg',
  './pieces/light/wb.svg',
  './pieces/light/wr.svg',
  './pieces/light/wq.svg',
  './pieces/light/wk.svg',
  './pieces/light/bp.svg',
  './pieces/light/bn.svg',
  './pieces/light/bb.svg',
  './pieces/light/br.svg',
  './pieces/light/bq.svg',
  './pieces/light/bk.svg',
  './pieces/dark/wp.svg',
  './pieces/dark/wn.svg',
  './pieces/dark/wb.svg',
  './pieces/dark/wr.svg',
  './pieces/dark/wq.svg',
  './pieces/dark/wk.svg',
  './pieces/dark/bp.svg',
  './pieces/dark/bn.svg',
  './pieces/dark/bb.svg',
  './pieces/dark/br.svg',
  './pieces/dark/bq.svg',
  './pieces/dark/bk.svg',
  './icons/android-chrome-192x192.png',
  './icons/android-chrome-512x512.png',
  './icons/apple-touch-icon.png',
  './icons/browserconfig.xml',
  './icons/favicon-16x16.png',
  './icons/favicon-32x32.png',
  './icons/favicon.ico',
  './icons/mstile-144x144.png',
  './icons/mstile-150x150.png',
  './icons/mstile-310x150.png',
  './icons/mstile-310x310.png',
  './icons/mstile-70x70.png',
  './icons/safari-pinned-tab.svg',
];

self.addEventListener('install', e => {
  console.log('[Service Worker] Install');
  e.waitUntil(
    caches.open(cacheName).then(cache => {
      console.log('[Service Worker] Caching all: ', staticFiles);
      return cache.addAll(staticFiles);
    }),
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => {
      console.log('[Service Worker] Fetching resource: ' + e.request.url);
      return r || fetch(e.request);
    }),
  );
});

