// Service Worker der Aufnahme-App (wird beim Build erzeugt). Offline-first: alles aus dem Cache.
const VERSION = '__VERSION__';
const CACHE = `aufnahme-${VERSION}`;
const DATEIEN = __DATEIEN__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(DATEIEN.map((d) => new Request(d, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k.startsWith('aufnahme-') && k !== CACHE) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      if (req.mode === 'navigate') {
        const index = await cache.match('./index.html', { ignoreVary: true });
        if (index) return index;
      }
      const treffer = await cache.match(req, { ignoreSearch: true, ignoreVary: true });
      if (treffer) return treffer;
      try {
        return await fetch(req);
      } catch {
        const index = await cache.match('./index.html', { ignoreVary: true });
        return index ?? new Response('Offline', { status: 503 });
      }
    })(),
  );
});
