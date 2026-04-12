/* Shield Website — Service Worker
 * Cache-first strategy for static assets (CSS, fonts, SVG, JS).
 * Network-first for HTML so users always see the latest content.
 *
 * Cache versioning: bump CACHE_VERSION to invalidate caches on deploy.
 */

const CACHE_VERSION = 'shield-v4';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const HTML_CACHE    = `${CACHE_VERSION}-html`;

// Precache critical assets on install
const PRECACHE_URLS = [
  '/tokens.css?v=3',
  '/components.css?v=3',
  '/reveal.js?v=1',
  '/favicon.svg',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin GET requests
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // Skip /app/ (React dashboard — has its own caching strategy)
  // and /api/ (backend API — never cache)
  if (url.pathname.startsWith('/app/') || url.pathname.startsWith('/api/')) return;

  // HTML → network-first (always fresh, fall back to cache offline)
  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isHTML) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(HTML_CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('/404.html')))
    );
    return;
  }

  // Static assets → cache-first (fast, fall back to network)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      });
    })
  );
});
