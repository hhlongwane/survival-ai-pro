// Clean, safe Android WebAPK Service Worker (v3)
// Clears any old caches on activate and lets browser HTTP handle all network calls directly with zero interference.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", () => {
  // Intentionally empty pass-through listener: satisfies Android Chrome PWA install criteria without breaking fetches on restart.
});
