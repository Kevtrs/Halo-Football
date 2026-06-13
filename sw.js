const CACHE = 'veher-live-v2';
const API_CACHE = 'veher-api-v2';
const ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE && k !== API_CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Fonts: cache-first (immutable CDN assets)
  if (url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(r => {
        if (r.ok) caches.open(CACHE).then(c => c.put(e.request, r.clone()));
        return r;
      }))
    );
    return;
  }

  // ESPN API: network-first, serve stale on failure (offline resilience)
  if (url.includes('api.espn.com') || url.includes('site.web.api.espn.com')) {
    e.respondWith(
      fetch(e.request).then(r => {
        if (r.ok) {
          const clone = r.clone();
          caches.open(API_CACHE).then(c => c.put(e.request, clone));
        }
        return r;
      }).catch(async () => {
        const cached = await caches.match(e.request);
        // Return cached ESPN response if available, otherwise empty scoreboard
        return cached || new Response('{"events":[]}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // App shell: cache-first
  e.respondWith(caches.match(e.request).then(c => c || fetch(e.request)));
});
