const CACHE_NAME = 'farm-empire-travel-v1';
const APP_ROOT = new URL('./', self.location.href).href;

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const response = await fetch(APP_ROOT, { cache: 'reload' });
  if (!response.ok) throw new Error(`Farm Empire shell request failed: ${response.status}`);
  await cache.put(APP_ROOT, response.clone());

  const html = await response.text();
  const assetUrls = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => new URL(match[1], APP_ROOT))
    .filter((url) => url.origin === self.location.origin)
    .map((url) => url.href);
  await Promise.all(assetUrls.map(async (url) => {
    const assetResponse = await fetch(url, { cache: 'reload' });
    if (assetResponse.ok) await cache.put(url, assetResponse);
  }));
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheAppShell());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) void caches.open(CACHE_NAME).then((cache) => cache.put(APP_ROOT, response.clone()));
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match(APP_ROOT)) || Response.error()),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) void caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        return response;
      });
    }),
  );
});
