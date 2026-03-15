const CACHE_NAME = "mmm-remote-control-v4.8.2-basepath";
const urlsToCache = [
  "./remote.html",
  "./css/main.css",
  "./css/roboto.css",
  "./css/font-awesome.css",
  "./socket.io/socket.io.js",
  "./js/socketclient.js",
  "./modules/MMM-Remote-Control/remote.css",
  "./modules/MMM-Remote-Control/manifest.json",
  "./modules/MMM-Remote-Control/img/favicon.svg",
  "./modules/MMM-Remote-Control/img/icon-192.png",
  "./modules/MMM-Remote-Control/img/icon-512.png",
  "./modules/MMM-Remote-Control/remote.mjs",
  "./modules/MMM-Remote-Control/remote-menu.mjs",
  "./modules/MMM-Remote-Control/remote-utils.mjs",
  "./modules/MMM-Remote-Control/remote-socket.mjs",
  "./modules/MMM-Remote-Control/remote-modules.mjs",
  "./modules/MMM-Remote-Control/remote-config.mjs",
  "./modules/MMM-Remote-Control/remote-render.mjs",
  "./modules/MMM-Remote-Control/node_modules/marked/lib/marked.esm.js"
];

// Install service worker and skip waiting
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(urlsToCache.map(async (url) => {
      try {
        await cache.add(url);
      } catch (error) {
        console.warn(`Cache: skipping ${url}:`, error);
      }
    }));
    globalThis.skipWaiting();
  })());
});

// Cache and return requests
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

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
