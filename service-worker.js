const CACHE_NAME = "mmm-remote-control-v4.2.0";
const urlsToCache = [
  "/remote.html",
  "/css/main.css",
  "/css/roboto.css",
  "/css/font-awesome.css",
  "/modules/MMM-Remote-Control/remote.css",
  "/modules/MMM-Remote-Control/remote.js"
];

// Install service worker and skip waiting
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      await cache.addAll(urlsToCache);
    } catch (error) {
      console.warn("Cache addAll failed, continuing:", error);
    }
    globalThis.skipWaiting();
  })());
});

// Cache and return requests
self.addEventListener("fetch", (event) => {
  event.respondWith((async () => {
    const response = await caches.match(event.request);
    // Cache hit - return response
    if (response) {
      return response;
    }
    return fetch(event.request);
  })());
});

// Update service worker
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => {
      if (cacheName !== CACHE_NAME) {
        return caches.delete(cacheName);
      }
    }));
    return globalThis.clients.claim();
  })());
});
