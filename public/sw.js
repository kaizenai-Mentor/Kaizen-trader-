/**
 * KAIZEN Mobile App Service Worker (PWA + Capacitor Shell Cache)
 * Network-first for dynamic pages/API, cache-fallback for core static assets.
 */
const CACHE_NAME = 'kaizen-mobile-v4';
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/css/style.css',
  '/js/feather.min.js',
  '/js/app.js',
  '/js/voice-input.js',
  '/images/kaizen-icon.png',
  '/images/kaizen-icon-192.png',
  '/images/kaizen-icon-512.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const asset of STATIC_ASSETS) {
        try {
          await cache.add(asset);
        } catch (_) {}
      }
    }).catch(() => {})
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

  // Dynamic routes: network first, cache latest response for offline PWA checks
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && req.mode === 'navigate') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((m) => m || caches.match('/dashboard') || caches.match('/')))
  );
});
