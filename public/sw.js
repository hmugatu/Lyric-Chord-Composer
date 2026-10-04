// Service worker: makes the app installable and lets it open offline.
// Network-first, so online users always get the latest deploy; the cache is
// only a fallback. Cross-origin requests (Google sign-in, Drive API) are never
// touched.
const CACHE = 'lcc-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        // Offline: serve the cached copy; any page navigation falls back to the app shell.
        const cached = await caches.match(request)
          ?? (request.mode === 'navigate' ? await caches.match(self.registration.scope) : undefined);
        return cached ?? Response.error();
      }),
  );
});
