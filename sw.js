/* Calisthenics Tracker — service worker (GitHub Pages–friendly relative URLs) */
const CACHE = "calisthenics-tracker-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./data/catalog.json",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-180.png",
  "./js/main.js",
  "./js/config.js",
  "./js/catalog.js",
  "./js/context.js",
  "./js/storage.js",
  "./js/rest.js",
  "./js/pwa.js",
  "./js/lib/dom.js",
  "./js/ui/tabs.js",
  "./js/ui/home.js",
  "./js/ui/workout.js",
  "./js/ui/schedule.js",
  "./js/ui/history.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
