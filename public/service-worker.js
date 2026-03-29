/* ============================================================
   Sparks Dinheiro – Service Worker
   Offline-first, cache estático
   ============================================================ */

// Atualizamos a versão para v1.0.1 para limpar o cache com erro anterior
const CACHE_NAME = 'sparks-dinheiro-v1.0.1';

const ASSETS = [
  '/',
  'index.html',
  'app.js',
  'style.css',
  'manifest.json',
  'frases.json',
  'icon-192.png',      // Removido /icons/
  'icon-512.png',      // Removido /icons/
  'spks-welcome.png'   // Removido /icons/
];

/* ── Instala e faz cache dos assets ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // O cache.addAll agora vai encontrar os arquivos na raiz da pasta public
        return cache.addAll(ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

/* ── Ativa e limpa caches antigos ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── Intercepta requests: cache-first ── */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      }).catch(() => {
        /* Offline fallback para navegação */
        if (event.request.mode === 'navigate') {
          return caches.match('index.html');
        }
      });
    })
  );
});
