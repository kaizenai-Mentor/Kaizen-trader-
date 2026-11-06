/**
 * KAIZEN Mobile App Service Worker (PWA + Capacitor Shell Cache)
 * Network-first for dynamic pages/API, cache-fallback for core static assets.
 */
const CACHE_NAME = 'kaizen-mobile-v1';
const STATIC_ASSETS = [
  '/css/style.css',
  '/js/feather.min.js',
  '/js/app.js',
  '/images/kaizen-icon.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Static assets: stale-while-revalidate
  if (url.pathname.startsWith('/css/') || url.pathname.startsWith('/js/') || url.pathname.startsWith('/images/')) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const networkFetch = fetch(req).then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // Dynamic routes: network first, fallback to cache if offline
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
