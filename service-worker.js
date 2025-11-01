// Basic service worker: cache core assets and serve them from cache-first strategy
const CACHE_NAME = 'fearless-impeccable-v1';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/ui-enhancements.js',
  '/js/snow.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Network first for API requests, cache-first for others
  const url = new URL(event.request.url);
  if (url.origin === location.origin && url.pathname.startsWith('/api')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((resp) => {
        return caches.open(CACHE_NAME).then((cache) => {
          // put a copy in cache
          // Кэшируем только GET-запросы с http(s) схемой
          const url = new URL(event.request.url);
          if ((url.protocol === 'http:' || url.protocol === 'https:') && 
              event.request.method === 'GET') {
            try { 
              cache.put(event.request, resp.clone()); 
            } catch(e){
              console.warn('Failed to cache:', e);
            }
          }
          return resp;
        });
      }).catch(() => {
        // Fallback to index.html for navigation requests
        if (event.request.mode === 'navigate') return caches.match('/index.html');
      });
    })
  );
});
